from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.hospital import Hospital, BedHistory
from models.bed import Bed
from models.booking import Booking
from datetime import datetime

hospital_bp = Blueprint('hospital', __name__)

def get_hospital_for_user(user_id):
    return Hospital.query.filter_by(user_id=user_id).first()


@hospital_bp.route('/api/hospital/dashboard', methods=['GET'])
@jwt_required()
def hospital_dashboard():
    identity = get_jwt_identity()
    if identity['role'] != 'hospital':
        return jsonify({'error': 'Unauthorized'}), 403

    hospital = get_hospital_for_user(identity['id'])
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    total_beds = sum(b.total_count for b in hospital.beds)
    available_beds = sum(b.available_count for b in hospital.beds)
    active_bookings = Booking.query.filter(
        Booking.hospital_id == hospital.id,
        Booking.status.in_(['pending', 'confirmed', 'admitted'])
    ).count()

    today_admissions = Booking.query.filter(
        Booking.hospital_id == hospital.id,
        Booking.status == 'admitted',
        db.func.date(Booking.admission_date) == datetime.utcnow().date()
    ).count()

    today_discharges = Booking.query.filter(
        Booking.hospital_id == hospital.id,
        Booking.status == 'discharged',
        db.func.date(Booking.discharge_date) == datetime.utcnow().date()
    ).count()

    return jsonify({
        'hospital': hospital.to_dict(),
        'stats': {
            'total_beds': total_beds,
            'available_beds': available_beds,
            'occupied_beds': total_beds - available_beds,
            'occupancy_rate': round((1 - available_beds / total_beds) * 100, 1) if total_beds > 0 else 0,
            'active_bookings': active_bookings,
            'today_admissions': today_admissions,
            'today_discharges': today_discharges
        }
    }), 200


@hospital_bp.route('/api/hospital/beds', methods=['GET'])
@jwt_required()
def get_beds():
    identity = get_jwt_identity()
    if identity['role'] != 'hospital':
        return jsonify({'error': 'Unauthorized'}), 403

    hospital = get_hospital_for_user(identity['id'])
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    beds = Bed.query.filter_by(hospital_id=hospital.id).all()
    return jsonify({'beds': [b.to_dict() for b in beds]}), 200


# FIX 1: Removed duplicate add_bed() — merged into single create_bed() route
@hospital_bp.route('/api/hospital/beds', methods=['POST'])
@jwt_required()
def create_bed():
    identity = get_jwt_identity()
    if identity['role'] != 'hospital':
        return jsonify({'error': 'Unauthorized'}), 403

    hospital = get_hospital_for_user(identity['id'])
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    data = request.get_json()

    if not data.get('bed_type'):
        return jsonify({'error': 'bed_type is required'}), 400

    total = data.get('total_count', 0)
    available = data.get('available_count', total)  # default available = total

    bed = Bed(
        hospital_id=hospital.id,
        bed_type=data['bed_type'],
        total_count=total,
        available_count=min(available, total),
        price_per_day=data.get('price_per_day', data.get('price', 0)),
        ward_name=data.get('ward_name', f"{data['bed_type']} Ward"),
        floor_number=data.get('floor_number', 1)
    )

    db.session.add(bed)

    history = BedHistory(
        hospital_id=hospital.id,
        bed_type=bed.bed_type,
        total_count=bed.total_count,
        available_count=bed.available_count,
        occupied_count=bed.total_count - bed.available_count,
        day_of_week=datetime.utcnow().weekday(),
        hour_of_day=datetime.utcnow().hour
    )
    db.session.add(history)
    db.session.commit()

    return jsonify({'message': 'Bed created', 'bed': bed.to_dict()}), 201


@hospital_bp.route('/api/hospital/beds/<int:bed_id>', methods=['PUT'])
@jwt_required()
def update_bed(bed_id):
    identity = get_jwt_identity()
    if identity['role'] != 'hospital':
        return jsonify({'error': 'Unauthorized'}), 403

    hospital = get_hospital_for_user(identity['id'])
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    bed = Bed.query.filter_by(id=bed_id, hospital_id=hospital.id).first()
    if not bed:
        return jsonify({'error': 'Bed not found'}), 404

    data = request.get_json()

    if 'total_count' in data:
        bed.total_count = data['total_count']
    if 'available_count' in data:
        bed.available_count = min(data['available_count'], bed.total_count)
    if 'price_per_day' in data:
        bed.price_per_day = data['price_per_day']
    if 'ward_name' in data:
        bed.ward_name = data['ward_name']
    if 'floor_number' in data:
        bed.floor_number = data['floor_number']

    history = BedHistory(
        hospital_id=hospital.id,
        bed_type=bed.bed_type,
        total_count=bed.total_count,
        available_count=bed.available_count,
        occupied_count=bed.total_count - bed.available_count,
        day_of_week=datetime.utcnow().weekday(),
        hour_of_day=datetime.utcnow().hour
    )
    db.session.add(history)
    db.session.commit()

    return jsonify({'message': 'Bed updated', 'bed': bed.to_dict()}), 200


@hospital_bp.route('/api/hospital/beds/<int:bed_id>', methods=['DELETE'])
@jwt_required()
def delete_bed(bed_id):
    identity = get_jwt_identity()
    if identity['role'] != 'hospital':
        return jsonify({'error': 'Unauthorized'}), 403

    hospital = get_hospital_for_user(identity['id'])
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    bed = Bed.query.filter_by(id=bed_id, hospital_id=hospital.id).first()
    if not bed:
        return jsonify({'error': 'Bed not found'}), 404

    db.session.delete(bed)
    db.session.commit()

    return jsonify({'message': 'Bed deleted'}), 200


@hospital_bp.route('/api/hospital/bookings', methods=['GET'])
@jwt_required()
def get_hospital_bookings():
    identity = get_jwt_identity()
    hospital = get_hospital_for_user(identity['id'])
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    status = request.args.get('status')
    query = Booking.query.filter_by(hospital_id=hospital.id)
    if status:
        query = query.filter_by(status=status)

    bookings = query.order_by(Booking.created_at.desc()).all()
    return jsonify({'bookings': [b.to_dict() for b in bookings]}), 200


@hospital_bp.route('/api/hospital/bookings/<int:booking_id>', methods=['PUT'])
@jwt_required()
def update_booking(booking_id):
    identity = get_jwt_identity()
    if identity['role'] != 'hospital':
        return jsonify({'error': 'Unauthorized'}), 403

    hospital = get_hospital_for_user(identity['id'])
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    booking = Booking.query.filter_by(id=booking_id, hospital_id=hospital.id).first()
    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    data = request.get_json()
    old_status = booking.status
    new_status = data.get('status', booking.status)

    booking.status = new_status
    if data.get('notes'):
        booking.notes = data['notes']

    bed = Bed.query.get(booking.bed_id)
    if bed:
        # FIX 2: 'admitted' no longer decrements — bed was already decremented at booking time
        if new_status == 'admitted' and old_status != 'admitted':
            booking.admission_date = datetime.utcnow()

        # Discharged: restore bed count
        elif new_status == 'discharged' and old_status == 'admitted':
            bed.available_count = min(bed.total_count, bed.available_count + 1)
            booking.discharge_date = datetime.utcnow()

        # FIX 3: Cancelled from any non-admitted status also restores bed count
        elif new_status == 'cancelled' and old_status not in ('cancelled', 'discharged'):
            bed.available_count = min(bed.total_count, bed.available_count + 1)

    db.session.commit()

    return jsonify({'message': 'Booking updated', 'booking': booking.to_dict()}), 200


@hospital_bp.route('/api/hospital/profile', methods=['PUT'])
@jwt_required()
def update_hospital_profile():
    identity = get_jwt_identity()
    if identity['role'] != 'hospital':
        return jsonify({'error': 'Unauthorized'}), 403

    hospital = get_hospital_for_user(identity['id'])
    if not hospital:
        return jsonify({'error': 'Hospital not found'}), 404

    data = request.get_json()

    updatable_fields = ['name', 'address', 'city', 'state', 'pincode',
                        'phone', 'email', 'website', 'hospital_type',
                        'specializations', 'emergency_available',
                        'ambulance_available', 'icu_available']

    for field in updatable_fields:
        if field in data:
            setattr(hospital, field, data[field])

    db.session.commit()

    return jsonify({'message': 'Profile updated', 'hospital': hospital.to_dict()}), 200
