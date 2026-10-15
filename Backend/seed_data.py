"""Seed database with sample hospital data"""
from models import db
from models.user import User
from models.hospital import Hospital, BedHistory
from models.bed import Bed
from datetime import datetime, timedelta
import random
import numpy as np

def seed_database():
    """Create sample hospitals across a city"""

    # Sample hospitals data (Delhi NCR area)
    hospitals_data = [
        {
            'admin': {'email': 'admin@aiims.com', 'name': 'Dr. Rajesh Kumar', 'password': 'hospital123'},
            'hospital': {
                'name': 'AIIMS - All India Institute of Medical Sciences',
                'address': 'Sri Aurobindo Marg, Ansari Nagar',
                'city': 'New Delhi', 'state': 'Delhi', 'pincode': '110029',
                'latitude': 28.5672, 'longitude': 77.2100,
                'phone': '+91-11-26588500', 'hospital_type': 'Government',
                'specializations': 'Cardiology,Neurology,Oncology,Trauma',
                'rating': 4.5, 'emergency_available': True,
                'ambulance_available': True, 'icu_available': True
            },
            'beds': [
                {'type': 'General', 'total': 200, 'available': 45, 'price': 100},
                {'type': 'ICU', 'total': 50, 'available': 8, 'price': 2000},
                {'type': 'Ventilator', 'total': 30, 'available': 5, 'price': 4000},
                {'type': 'Oxygen', 'total': 80, 'available': 20, 'price': 1500},
                {'type': 'Premium', 'total': 40, 'available': 12, 'price': 5000},
                {'type': 'Pediatric', 'total': 30, 'available': 10, 'price': 800},
            ]
        },
        {
            'admin': {'email': 'admin@fortis.com', 'name': 'Dr. Priya Sharma', 'password': 'hospital123'},
            'hospital': {
                'name': 'Fortis Hospital',
                'address': 'Sector 62, Phase VIII, Mohali',
                'city': 'New Delhi', 'state': 'Delhi', 'pincode': '110044',
                'latitude': 28.5355, 'longitude': 77.2510,
                'phone': '+91-11-42776222', 'hospital_type': 'Private',
                'specializations': 'Cardiology,Orthopedics,Gastroenterology',
                'rating': 4.2, 'emergency_available': True,
                'ambulance_available': True, 'icu_available': True
            },
            'beds': [
                {'type': 'General', 'total': 120, 'available': 30, 'price': 3000},
                {'type': 'ICU', 'total': 25, 'available': 5, 'price': 8000},
                {'type': 'Ventilator', 'total': 15, 'available': 3, 'price': 12000},
                {'type': 'Oxygen', 'total': 40, 'available': 12, 'price': 5000},
                {'type': 'Premium', 'total': 30, 'available': 8, 'price': 15000},
                {'type': 'Pediatric', 'total': 20, 'available': 7, 'price': 4000},
            ]
        },
        {
            'admin': {'email': 'admin@apollo.com', 'name': 'Dr. Arun Mehta', 'password': 'hospital123'},
            'hospital': {
                'name': 'Apollo Hospital',
                'address': 'Sarita Vihar, Delhi Mathura Road',
                'city': 'New Delhi', 'state': 'Delhi', 'pincode': '110076',
                'latitude': 28.5298, 'longitude': 77.2854,
                'phone': '+91-11-71791090', 'hospital_type': 'Private',
                'specializations': 'Oncology,Neurosurgery,Transplants,Cardiology',
                'rating': 4.6, 'emergency_available': True,
                'ambulance_available': True, 'icu_available': True
            },
            'beds': [
                {'type': 'General', 'total': 150, 'available': 35, 'price': 3500},
                {'type': 'ICU', 'total': 30, 'available': 6, 'price': 10000},
                {'type': 'Ventilator', 'total': 20, 'available': 4, 'price': 15000},
                {'type': 'Oxygen', 'total': 50, 'available': 15, 'price': 6000},
                {'type': 'Premium', 'total': 35, 'available': 10, 'price': 20000},
                {'type': 'Pediatric', 'total': 25, 'available': 8, 'price': 4500},
            ]
        },
        {
            'admin': {'email': 'admin@maxhealthcare.com', 'name': 'Dr. Sunita Verma', 'password': 'hospital123'},
            'hospital': {
                'name': 'Max Super Speciality Hospital',
                'address': '1, Press Enclave Road, Saket',
                'city': 'New Delhi', 'state': 'Delhi', 'pincode': '110017',
                'latitude': 28.5265, 'longitude': 77.2077,
                'phone': '+91-11-26515050', 'hospital_type': 'Private',
                'specializations': 'Cardiology,Oncology,Neuroscience,Orthopedics',
                'rating': 4.4, 'emergency_available': True,
                'ambulance_available': True, 'icu_available': True
            },
            'beds': [
                {'type': 'General', 'total': 180, 'available': 50, 'price': 2800},
                {'type': 'ICU', 'total': 35, 'available': 7, 'price': 9000},
                {'type': 'Ventilator', 'total': 18, 'available': 3, 'price': 13000},
                {'type': 'Oxygen', 'total': 60, 'available': 18, 'price': 5500},
                {'type': 'Premium', 'total': 25, 'available': 6, 'price': 18000},
                {'type': 'Pediatric', 'total': 22, 'available': 9, 'price': 3500},
            ]
        },
        {
            'admin': {'email': 'admin@safdarjung.com', 'name': 'Dr. Vikram Singh', 'password': 'hospital123'},
            'hospital': {
                'name': 'Safdarjung Hospital',
                'address': 'Ansari Nagar West',
                'city': 'New Delhi', 'state': 'Delhi', 'pincode': '110029',
                'latitude': 28.5685, 'longitude': 77.2065,
                'phone': '+91-11-26707437', 'hospital_type': 'Government',
                'specializations': 'General Medicine,Surgery,Gynecology,Pediatrics',
                'rating': 3.8, 'emergency_available': True,
                'ambulance_available': True, 'icu_available': True
            },
            'beds': [
                {'type': 'General', 'total': 250, 'available': 60, 'price': 50},
                {'type': 'ICU', 'total': 40, 'available': 10, 'price': 500},
                {'type': 'Ventilator', 'total': 25, 'available': 6, 'price': 1000},
                {'type': 'Oxygen', 'total': 100, 'available': 30, 'price': 300},
                {'type': 'Pediatric', 'total': 35, 'available': 12, 'price': 50},
            ]
        },
        {
            'admin': {'email': 'admin@gangaram.com', 'name': 'Dr. Neha Gupta', 'password': 'hospital123'},
            'hospital': {
                'name': 'Sir Ganga Ram Hospital',
                'address': 'Rajinder Nagar',
                'city': 'New Delhi', 'state': 'Delhi', 'pincode': '110060',
                'latitude': 28.6387, 'longitude': 77.1903,
                'phone': '+91-11-25861234', 'hospital_type': 'Private',
                'specializations': 'Transplant,Cardiology,Neurology,Urology',
                'rating': 4.3, 'emergency_available': True,
                'ambulance_available': True, 'icu_available': True
            },
            'beds': [
                {'type': 'General', 'total': 130, 'available': 25, 'price': 2500},
                {'type': 'ICU', 'total': 28, 'available': 4, 'price': 7500},
                {'type': 'Ventilator', 'total': 12, 'available': 2, 'price': 11000},
                {'type': 'Oxygen', 'total': 45, 'available': 10, 'price': 4500},
                {'type': 'Premium', 'total': 20, 'available': 5, 'price': 12000},
                {'type': 'Pediatric', 'total': 18, 'available': 6, 'price': 3000},
            ]
        },
        {
            'admin': {'email': 'admin@lnjp.com', 'name': 'Dr. Rakesh Jain', 'password': 'hospital123'},
            'hospital': {
                'name': 'LNJP Hospital',
                'address': 'JLN Marg, Delhi Gate',
                'city': 'New Delhi', 'state': 'Delhi', 'pincode': '110002',
                'latitude': 28.6358, 'longitude': 77.2373,
                'phone': '+91-11-23232400', 'hospital_type': 'Government',
                'specializations': 'Emergency,Trauma,Burns,General Medicine',
                'rating': 3.5, 'emergency_available': True,
                'ambulance_available': True, 'icu_available': True
            },
            'beds': [
                {'type': 'General', 'total': 300, 'available': 80, 'price': 30},
                {'type': 'ICU', 'total': 45, 'available': 12, 'price': 300},
                {'type': 'Ventilator', 'total': 30, 'available': 8, 'price': 600},
                {'type': 'Oxygen', 'total': 120, 'available': 35, 'price': 200},
                {'type': 'Pediatric', 'total': 40, 'available': 15, 'price': 30},
            ]
        },
        {
            'admin': {'email': 'admin@blk.com', 'name': 'Dr. Meena Patel', 'password': 'hospital123'},
            'hospital': {
                'name': 'BLK-Max Super Speciality Hospital',
                'address': 'Pusa Road',
                'city': 'New Delhi', 'state': 'Delhi', 'pincode': '110005',
                'latitude': 28.6447, 'longitude': 77.1828,
                'phone': '+91-11-30403040', 'hospital_type': 'Private',
                'specializations': 'Oncology,Bone Marrow Transplant,Cardiac Sciences',
                'rating': 4.4, 'emergency_available': True,
                'ambulance_available': True, 'icu_available': True
            },
            'beds': [
                {'type': 'General', 'total': 100, 'available': 20, 'price': 3200},
                {'type': 'ICU', 'total': 22, 'available': 3, 'price': 9500},
                {'type': 'Ventilator', 'total': 10, 'available': 2, 'price': 14000},
                {'type': 'Oxygen', 'total': 35, 'available': 8, 'price': 6000},
                {'type': 'Premium', 'total': 18, 'available': 4, 'price': 22000},
                {'type': 'Pediatric', 'total': 15, 'available': 5, 'price': 4000},
            ]
        }
    ]

    # Also seed a patient
    patient = User(
        email='patient@test.com',
        role='patient',
        full_name='Rahul Sharma',
        phone='+91-9876543210',
        blood_group='O+',
        emergency_contact='+91-9876543211',
        date_of_birth=datetime(1995, 5, 15).date()
    )
    patient.set_password('patient123')
    db.session.add(patient)

    for h_data in hospitals_data:
        # Create hospital admin user
        admin = User(
            email=h_data['admin']['email'],
            role='hospital',
            full_name=h_data['admin']['name'],
            phone=h_data['hospital']['phone']
        )
        admin.set_password(h_data['admin']['password'])
        db.session.add(admin)
        db.session.flush()

        # Create hospital
        hospital = Hospital(
            user_id=admin.id,
            **h_data['hospital']
        )
        db.session.add(hospital)
        db.session.flush()

        # Create beds
        for bed_data in h_data['beds']:
            bed = Bed(
                hospital_id=hospital.id,
                bed_type=bed_data['type'],
                total_count=bed_data['total'],
                available_count=bed_data['available'],
                price_per_day=bed_data['price'],
                ward_name=f"{bed_data['type']} Ward",
                floor_number=random.randint(1, 5)
            )
            db.session.add(bed)

        # Generate historical data (60 days)
        for day in range(60):
            for hour in [6, 10, 14, 18, 22]:
                ts = datetime.utcnow() - timedelta(days=60 - day, hours=24 - hour)
                for bed_data in h_data['beds']:
                    # Simulate realistic occupancy patterns
                    base_occupied = bed_data['total'] - bed_data['available']
                    variation = random.gauss(0, bed_data['total'] * 0.05)
                    day_effect = 3 if ts.weekday() < 5 else -2
                    hour_effect = 2 if 8 <= hour <= 16 else -1

                    occupied = int(base_occupied + variation + day_effect + hour_effect)
                    occupied = max(0, min(occupied, bed_data['total']))
                    available = bed_data['total'] - occupied

                    history = BedHistory(
                        hospital_id=hospital.id,
                        bed_type=bed_data['type'],
                        total_count=bed_data['total'],
                        available_count=available,
                        occupied_count=occupied,
                        timestamp=ts,
                        day_of_week=ts.weekday(),
                        hour_of_day=ts.hour
                    )
                    db.session.add(history)

    db.session.commit()
    print("[Seed] Database seeded successfully with 8 hospitals and historical data!")