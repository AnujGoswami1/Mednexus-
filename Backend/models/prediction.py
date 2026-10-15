from models import db
from datetime import datetime

class PredictionLog(db.Model):
    __tablename__ = 'prediction_logs'

    id = db.Column(db.Integer, primary_key=True)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    model_type = db.Column(db.String(20), nullable=False)  # 'lstm' or 'arima'
    bed_type = db.Column(db.String(50))
    predicted_occupancy = db.Column(db.Float)
    predicted_available = db.Column(db.Integer)
    predicted_patients = db.Column(db.Integer)
    prediction_date = db.Column(db.DateTime)
    confidence = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'hospital_id': self.hospital_id,
            'model_type': self.model_type,
            'bed_type': self.bed_type,
            'predicted_occupancy': self.predicted_occupancy,
            'predicted_available': self.predicted_available,
            'predicted_patients': self.predicted_patients,
            'prediction_date': self.prediction_date.isoformat() if self.prediction_date else None,
            'confidence': self.confidence,
            'created_at': self.created_at.isoformat()
        }