from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from models import db
from models.user import User
from models.hospital import Hospital
from models.bed import Bed
from datetime import datetime

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/register/patient', methods=['POST'])
def register_patient():
    data = request.get_json()

    required = ['email', 'password', 'full_name']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(
        email=data['email'],
        role='patient',
        full_name=data['full_name'],
        phone=data.get('phone'),
        blood_group=data.get('blood_group'),
        emergency_contact=data.get('emergency_contact')
    )

    if data.get('date_of_birth'):
        try:
            user.date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
        except ValueError:
            pass

    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity={'id': user.id, 'role': user.role})
    refresh_token = create_refresh_token(identity={'id': user.id, 'role': user.role})

    return jsonify({
        'message': 'Patient registered successfully',
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 201


@auth_bp.route('/api/auth/register/hospital', methods=['POST'])
def register_hospital():
    data = request.get_json()

    required = ['email', 'password', 'full_name', 'hospital_name',
                'address', 'city', 'state', 'pincode', 'latitude',
                'longitude', 'phone']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(
        email=data['email'],
        role='hospital',
        full_name=data['full_name'],
        phone=data.get('phone')
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.flush()

    hospital = Hospital(
        user_id=user.id,
        name=data['hospital_name'],
        address=data['address'],
        city=data['city'],
        state=data['state'],
        pincode=data['pincode'],
        latitude=float(data['latitude']),
        longitude=float(data['longitude']),
        phone=data['phone'],
        email=data.get('hospital_email', data['email']),
        website=data.get('website'),
        hospital_type=data.get('hospital_type', 'Private'),
        specializations=data.get('specializations', ''),
        emergency_available=data.get('emergency_available', True),
        ambulance_available=data.get('ambulance_available', False),
        icu_available=data.get('icu_available', False)
    )
    db.session.add(hospital)

    # Create default bed types
    default_beds = [
        {'bed_type': 'General', 'total_count': 50, 'price_per_day': 500},
        {'bed_type': 'ICU', 'total_count': 10, 'price_per_day': 3000},
        {'bed_type': 'Ventilator', 'total_count': 5, 'price_per_day': 5000},
        {'bed_type': 'Oxygen', 'total_count': 15, 'price_per_day': 2000},
        {'bed_type': 'Premium', 'total_count': 10, 'price_per_day': 4000},
        {'bed_type': 'Pediatric', 'total_count': 8, 'price_per_day': 1500},
    ]

    for bed_data in default_beds:
        bed = Bed(
            hospital_id=hospital.id,
            bed_type=bed_data['bed_type'],
            total_count=bed_data['total_count'],
            available_count=bed_data['total_count'],
            price_per_day=bed_data['price_per_day'],
            ward_name=f"{bed_data['bed_type']} Ward",
            floor_number=1
        )
        db.session.add(bed)

    db.session.commit()

    access_token = create_access_token(identity={'id': user.id, 'role': user.role})
    refresh_token = create_refresh_token(identity={'id': user.id, 'role': user.role})

    return jsonify({
        'message': 'Hospital registered successfully',
        'user': user.to_dict(),
        'hospital': hospital.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 201


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400

    user = User.query.filter_by(email=data['email']).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403

    access_token = create_access_token(identity={'id': user.id, 'role': user.role})
    refresh_token = create_refresh_token(identity={'id': user.id, 'role': user.role})

    response = {
        'message': 'Login successful',
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token,
        'role': user.role
    }

    if user.role == 'hospital':
        hospital = Hospital.query.filter_by(user_id=user.id).first()
        if hospital:
            response['hospital'] = hospital.to_dict()

    return jsonify(response), 200


@auth_bp.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    identity = get_jwt_identity()
    user = User.query.get(identity['id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404

    response = {'user': user.to_dict()}
    if user.role == 'hospital':
        hospital = Hospital.query.filter_by(user_id=user.id).first()
        if hospital:
            response['hospital'] = hospital.to_dict()

    return jsonify(response), 200


@auth_bp.route('/api/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify({'access_token': access_token}), 200
