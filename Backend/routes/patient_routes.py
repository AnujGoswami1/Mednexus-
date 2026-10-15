from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.hospital import Hospital
from models.bed import Bed
from models.booking import Booking
from datetime import datetime
from sqlalchemy.exc import IntegrityError
# ADD THIS LINE:
from sqlalchemy.exc import IntegrityError

patient_bp = Blueprint('patient', __name__)


@patient_bp.route('/api/patient/dashboard', methods=['GET'])
@jwt_required()
def patient_dashboard():
    identity = get_jwt_identity()
    if identity['role'] != 'patient':
        return jsonify({'error': 'Unauthorized'}), 403

    user = User.query.get(identity['id'])
    bookings = Booking.query.filter_by(patient_id=user.id)\
        .order_by(Booking.created_at.desc()).limit(20).all()

    active_bookings = [b for b in bookings if b.status in ['pending', 'confirmed', 'admitted']]
    past_bookings = [b for b in bookings if b.status in ['discharged', 'cancelled']]

    return jsonify({
        'user': user.to_dict(),
        'active_bookings': [b.to_dict() for b in active_bookings],
        'past_bookings': [b.to_dict() for b in past_bookings],
        'total_visits': len([b for b in bookings if b.status == 'discharged'])
    }), 200


@patient_bp.route('/api/patient/book', methods=['POST'])
@jwt_required()
def book_bed():
    """
    FIX: Proper transaction handling with validation and rollback
    - Use with_for_update() to lock bed row and prevent race conditions
    - Validate bed availability before decrementing
    - Proper error handling and rollback on failure
    """
    identity = get_jwt_identity()
    if identity['role'] != 'patient':
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()

    hospital_id = data.get('hospital_id')
    bed_type = data.get('bed_type', 'General')

    if not hospital_id:
        return jsonify({'error': 'Hospital ID is required'}), 400

    try:
        hospital = Hospital.query.get(hospital_id)
        if not hospital:
            return jsonify({'error': 'Hospital not found'}), 404

        # FIX: Lock the bed row to prevent race conditions
        # This ensures atomic read-modify-write operation
        bed = Bed.query.filter_by(
            hospital_id=hospital_id,
            bed_type=bed_type
        ).with_for_update().first()

        if not bed:
            return jsonify({'error': f'No beds of type {bed_type} found at this hospital'}), 404

        # FIX: Validate availability BEFORE modification
        if bed.available_count <= 0:
            return jsonify({
                'error': 'No available beds of this type',
                'details': {
                    'bed_type': bed_type,
                    'available': bed.available_count,
                    'total': bed.total_count
                }
            }), 409

        # Create booking first (before modifying bed)
        booking = Booking(
            patient_id=identity['id'],
            hospital_id=hospital_id,
            bed_id=bed.id,
            reason=data.get('reason', ''),
            priority=data.get('priority', 'normal'),
            notes=data.get('notes', ''),
            status='pending'
        )

        # FIX: Decrement with validation
        bed.available_count -= 1

        # FIX: Ensure count doesn't go negative (extra safety check)
        if bed.available_count < 0:
            db.session.rollback()
            return jsonify({
                'error': 'Bed availability check failed. Please try again.',
                'details': 'Invalid bed state detected'
            }), 409

        # Add both objects to session
        db.session.add(booking)
        db.session.add(bed)

        # FIX: Explicit commit with error handling
        db.session.commit()
        db.session.refresh(booking)

        return jsonify({
            'message': 'Booking created successfully',
            'booking': booking.to_dict(),
            'bed_status': {
                'available_remaining': bed.available_count,
                'total': bed.total_count
            }
        }), 201

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({
            'error': 'Booking failed due to data conflict',
            'details': 'This bed may have been booked by another patient. Please try again.'
        }), 409

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to create booking',
            'details': str(e)
        }), 500


@patient_bp.route('/api/patient/bookings', methods=['GET'])
@jwt_required()
def get_patient_bookings():
    identity = get_jwt_identity()
    bookings = Booking.query.filter_by(patient_id=identity['id'])\
        .order_by(Booking.created_at.desc()).all()
    return jsonify({'bookings': [b.to_dict() for b in bookings]}), 200


@patient_bp.route('/api/patient/bookings/<int:booking_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_booking(booking_id):
    identity = get_jwt_identity()
    booking = Booking.query.filter_by(id=booking_id, patient_id=identity['id']).first()

    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    if booking.status in ['discharged', 'cancelled']:
        return jsonify({'error': 'Cannot cancel this booking'}), 400

    try:
        # FIX: Lock bed for update to prevent race conditions
        bed = Bed.query.filter_by(id=booking.bed_id).with_for_update().first()
        
        if bed and booking.status in ['pending', 'confirmed', 'admitted']:
            # Restore the bed count safely
            bed.available_count = min(bed.total_count, bed.available_count + 1)

        booking.status = 'cancelled'
        db.session.commit()

        return jsonify({
            'message': 'Booking cancelled successfully',
            'booking': booking.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to cancel booking',
            'details': str(e)
        }), 500


@patient_bp.route('/api/patient/profile', methods=['PUT'])
@jwt_required()
def update_patient_profile():
    identity = get_jwt_identity()
    user = User.query.get(identity['id'])

    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()

    try:
        if 'full_name' in data:
            user.full_name = data['full_name']
        if 'phone' in data:
            user.phone = data['phone']
        if 'blood_group' in data:
            user.blood_group = data['blood_group']
        if 'emergency_contact' in data:
            user.emergency_contact = data['emergency_contact']
        if 'medical_history' in data:
            user.medical_history = data['medical_history']
        if 'date_of_birth' in data:
            try:
                user.date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        db.session.commit()
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to update profile',
            'details': str(e)
        }), 500