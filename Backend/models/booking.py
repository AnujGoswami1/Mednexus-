from models import db
from datetime import datetime

class Booking(db.Model):
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    hospital_id = db.Column(db.Integer, db.ForeignKey('hospitals.id'), nullable=False)
    bed_id = db.Column(db.Integer, db.ForeignKey('beds.id'), nullable=False)
    booking_date = db.Column(db.DateTime, default=datetime.utcnow)
    admission_date = db.Column(db.DateTime)
    discharge_date = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='pending')
    reason = db.Column(db.Text)
    priority = db.Column(db.String(20), default='normal')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships inside class, no conflicting backrefs
    bed = db.relationship('Bed', foreign_keys=[bed_id])
    patient = db.relationship('User', foreign_keys=[patient_id])
    # self.hospital comes via backref from Hospital.bookings in hospital.py

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient.full_name if self.patient else None,
            'hospital_id': self.hospital_id,
            'hospital_name': self.hospital.name if self.hospital else None,
            'bed_id': self.bed_id,
            'bed_type': self.bed.bed_type if self.bed else None,
            'booking_date': self.booking_date.isoformat() if self.booking_date else None,
            'admission_date': self.admission_date.isoformat() if self.admission_date else None,
            'discharge_date': self.discharge_date.isoformat() if self.discharge_date else None,
            'status': self.status,
            'reason': self.reason,
            'priority': self.priority,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }