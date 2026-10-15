from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.hospital import Hospital, BedHistory

prediction_bp = Blueprint('prediction', __name__)

# FIX: Lazy import ML models so app doesn't crash if tensorflow/statsmodels not installed
def _load_predictors():
    try:
        from ml.lstm_model import LSTMPredictor
        from ml.arima_model import ARIMAPredictor
        return LSTMPredictor, ARIMAPredictor
    except ImportError:
        return None, None

# Cache for trained models per hospital
model_cache = {}


def get_or_train_models(hospital_id, total_beds):
    if hospital_id not in model_cache:
        LSTMPredictor, ARIMAPredictor = _load_predictors()
        if not LSTMPredictor or not ARIMAPredictor:
            return None

        lstm = LSTMPredictor()
        arima = ARIMAPredictor()

        history = BedHistory.query.filter_by(hospital_id=hospital_id)\
            .order_by(BedHistory.timestamp.asc()).all()

        lstm.train(hospital_id, history, total_beds)
        arima.train(hospital_id, history, total_beds)

        model_cache[hospital_id] = {'lstm': lstm, 'arima': arima}

    return model_cache[hospital_id]


@prediction_bp.route('/api/predict/beds/<int:hospital_id>', methods=['GET'])
@jwt_required()
def predict_bed_availability(hospital_id):
    hospital = Hospital.query.get(hospital_id)
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    hours_ahead = request.args.get('hours', 24, type=int)
    total_beds = sum(b.total_count for b in hospital.beds)

    models = get_or_train_models(hospital_id, total_beds)
    if not models:
        return jsonify({'error': 'ML models not available on this Python version'}), 503

    return jsonify({
        'hospital_id': hospital_id,
        'hospital_name': hospital.name,
        'total_beds': total_beds,
        'model': 'LSTM',
        'predictions': models['lstm'].predict(hours_ahead, total_beds)
    }), 200


@prediction_bp.route('/api/predict/trend/<int:hospital_id>', methods=['GET'])
@jwt_required()
def predict_trend(hospital_id):
    hospital = Hospital.query.get(hospital_id)
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    days_ahead = request.args.get('days', 14, type=int)
    total_beds = sum(b.total_count for b in hospital.beds)

    models = get_or_train_models(hospital_id, total_beds)
    if not models:
        return jsonify({'error': 'ML models not available on this Python version'}), 503

    return jsonify({
        'hospital_id': hospital_id,
        'hospital_name': hospital.name,
        'total_beds': total_beds,
        'model': 'ARIMA',
        'predictions': models['arima'].predict(days_ahead, total_beds),
        'trend': models['arima'].get_trend_analysis(total_beds)
    }), 200


@prediction_bp.route('/api/predict/patients/<int:hospital_id>', methods=['GET'])
@jwt_required()
def predict_patients(hospital_id):
    hospital = Hospital.query.get(hospital_id)
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    days_ahead = request.args.get('days', 7, type=int)
    total_beds = sum(b.total_count for b in hospital.beds)

    models = get_or_train_models(hospital_id, total_beds)
    if not models:
        return jsonify({'error': 'ML models not available on this Python version'}), 503

    return jsonify({
        'hospital_id': hospital_id,
        'hospital_name': hospital.name,
        'model': 'LSTM',
        'predictions': models['lstm'].predict_patients(days_ahead)
    }), 200


@prediction_bp.route('/api/predict/combined/<int:hospital_id>', methods=['GET'])
@jwt_required()
def combined_prediction(hospital_id):
    hospital = Hospital.query.get(hospital_id)
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    total_beds = sum(b.total_count for b in hospital.beds)
    models = get_or_train_models(hospital_id, total_beds)
    if not models:
        return jsonify({'error': 'ML models not available on this Python version'}), 503

    return jsonify({
        'hospital_id': hospital_id,
        'hospital_name': hospital.name,
        'total_beds': total_beds,
        'current_available': sum(b.available_count for b in hospital.beds),
        'lstm_hourly_predictions': models['lstm'].predict(24, total_beds),
        'arima_daily_predictions': models['arima'].predict(14, total_beds),
        'patient_predictions': models['lstm'].predict_patients(7),
        'trend_analysis': models['arima'].get_trend_analysis(total_beds)
    }), 200