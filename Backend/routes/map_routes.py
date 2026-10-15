from flask import Blueprint, request, jsonify
from models.hospital import Hospital
from ml.recommender import HospitalRecommender

# ❌ Disabled ML models (TensorFlow not supported in Python 3.14)
# from ml.lstm_model import LSTMPredictor
# from ml.arima_model import ARIMAPredictor

map_bp = Blueprint('map', __name__)

# Initialize recommender
recommender = HospitalRecommender()

# ❌ Disabled ML predictors
lstm_predictor = None
arima_predictor = None


@map_bp.route('/api/map/hospitals', methods=['GET'])
def get_all_hospitals_for_map():
    hospitals = Hospital.query.all()
    return jsonify({
        'hospitals': [h.to_map_dict() for h in hospitals],
        'total': len(hospitals)
    }), 200


@map_bp.route('/api/map/recommend', methods=['POST'])
def recommend_hospital():
    data = request.get_json()

    user_lat = data.get('latitude')
    user_lng = data.get('longitude')

    if not user_lat or not user_lng:
        return jsonify({'error': 'Location required'}), 400

    bed_type = data.get('bed_type')
    priority = data.get('priority', 'normal')
    max_distance = data.get('max_distance', 50)

    hospitals = Hospital.query.all()

    recommendations = recommender.recommend(
        user_lat=float(user_lat),
        user_lng=float(user_lng),
        hospitals=hospitals,
        bed_type=bed_type,
        priority=priority,
        lstm_predictor=lstm_predictor,
        arima_predictor=arima_predictor,
        max_distance=float(max_distance)
    )

    return jsonify({
        'recommendations': recommendations,
        'total': len(recommendations),
        'user_location': {'latitude': user_lat, 'longitude': user_lng},
        'filters': {
            'bed_type': bed_type,
            'priority': priority,
            'max_distance': max_distance
        }
    }), 200


@map_bp.route('/api/map/hospital/<int:hospital_id>', methods=['GET'])
def get_hospital_detail(hospital_id):
    hospital = Hospital.query.get(hospital_id)
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    return jsonify({'hospital': hospital.to_dict()}), 200
