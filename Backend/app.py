from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import DevelopmentConfig
from models import db, bcrypt

def create_app(config_class=DevelopmentConfig):
    import os
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.abspath(os.path.join(backend_dir, '..', 'Frontend'))
    instance_dir = os.path.abspath(os.path.join(backend_dir, 'instance'))

    app = Flask(__name__, static_folder=frontend_dir, static_url_path='', instance_path=instance_dir)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)

    # Register blueprints
    from routes.auth import auth_bp
    from routes.hospital_routes import hospital_bp
    from routes.patient_routes import patient_bp
    from routes.map_routes import map_bp
    from routes.prediction_routes import prediction_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(hospital_bp)
    app.register_blueprint(patient_bp)
    app.register_blueprint(map_bp)
    app.register_blueprint(prediction_bp)

    # Serve frontend
    @app.route('/')
    def serve_index():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(app.static_folder, path)

    # Create tables and seed if empty
    with app.app_context():
        db.create_all()
        from models.user import User
        if User.query.count() == 0:
            from seed_data import seed_database
            seed_database()
            print("[Database] Database initialized and seeded")

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5001)
    