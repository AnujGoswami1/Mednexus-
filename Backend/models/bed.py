from models import db
from datetime import datetime

class Bed(db.Model):
    __tablename__ = 'beds'

    id = db.Column(db.Integer, primary_key=True)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    bed_type = db.Column(db.String(50), nullable=False)  # General, ICU, Ventilator, Oxygen, Premium, Pediatric
    total_count = db.Column(db.Integer, nullable=False, default=0)
    available_count = db.Column(db.Integer, nullable=False, default=0)
    price_per_day = db.Column(db.Float, default=0.0)
    ward_name = db.Column(db.String(100))
    floor_number = db.Column(db.Integer)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint
    __table_args__ = (db.UniqueConstraint('hospital_id', 'bed_type', 'ward_name',
                                          name='unique_bed_ward'),)

    def to_dict(self):
        return {
            'id': self.id,
            'hospital_id': self.hospital_id,
            'bed_type': self.bed_type,
            'total_count': self.total_count,
            'available_count': self.available_count,
            'occupied_count': self.total_count - self.available_count,
            'price_per_day': self.price_per_day,
            'ward_name': self.ward_name,
            'floor_number': self.floor_number,
            'occupancy_rate': round((1 - self.available_count / self.total_count) * 100, 1) if self.total_count > 0 else 0,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }