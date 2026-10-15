from models import db
from datetime import datetime

class Hospital(db.Model):
    __tablename__ = 'hospitals'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.Text, nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    pincode = db.Column(db.String(10), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(120))
    website = db.Column(db.String(200))
    hospital_type = db.Column(db.String(50))  # Government, Private, NGO
    specializations = db.Column(db.Text)  # JSON string
    rating = db.Column(db.Float, default=0.0)
    total_reviews = db.Column(db.Integer, default=0)
    is_verified = db.Column(db.Boolean, default=False)
    emergency_available = db.Column(db.Boolean, default=True)
    ambulance_available = db.Column(db.Boolean, default=False)
    icu_available = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    beds = db.relationship('Bed', backref='hospital', lazy=True, cascade='all, delete-orphan')
    bookings = db.relationship('Booking', backref='hospital', lazy=True)
    bed_history = db.relationship('BedHistory', backref='hospital', lazy=True,
                                  cascade='all, delete-orphan')

    def to_dict(self):
        total_beds = sum(b.total_count for b in self.beds)
        available_beds = sum(b.available_count for b in self.beds)
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'city': self.city,
            'state': self.state,
            'pincode': self.pincode,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'phone': self.phone,
            'email': self.email,
            'website': self.website,
            'hospital_type': self.hospital_type,
            'specializations': self.specializations,
            'rating': self.rating,
            'total_reviews': self.total_reviews,
            'is_verified': self.is_verified,
            'emergency_available': self.emergency_available,
            'ambulance_available': self.ambulance_available,
            'icu_available': self.icu_available,
            'total_beds': total_beds,
            'available_beds': available_beds,
            'occupancy_rate': round((1 - available_beds / total_beds) * 100, 1) if total_beds > 0 else 0,
            'beds': [b.to_dict() for b in self.beds]
        }

    def to_map_dict(self):
        total_beds = sum(b.total_count for b in self.beds)
        available_beds = sum(b.available_count for b in self.beds)
        return {
            'id': self.id,
            'name': self.name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'total_beds': total_beds,
            'available_beds': available_beds,
            'emergency_available': self.emergency_available,
            'hospital_type': self.hospital_type,
            'phone': self.phone,
            'rating': self.rating
        }


class BedHistory(db.Model):
    __tablename__ = 'bed_history'

    id = db.Column(db.Integer, primary_key=True)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    bed_type = db.Column(db.String(50), nullable=False)
    total_count = db.Column(db.Integer, nullable=False)
    available_count = db.Column(db.Integer, nullable=False)
    occupied_count = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    day_of_week = db.Column(db.Integer)
    hour_of_day = db.Column(db.Integer)

    def to_dict(self):
        return {
            'id': self.id,
            'hospital_id': self.hospital_id,
            'bed_type': self.bed_type,
            'total_count': self.total_count,
            'available_count': self.available_count,
            'occupied_count': self.occupied_count,
            'timestamp': self.timestamp.isoformat(),
            'day_of_week': self.day_of_week,
            'hour_of_day': self.hour_of_day
        }
    