import logging
from flask import Flask
from flask_cors import CORS
from config import Config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp
from routes.alerts import alerts_bp
from routes.reports import reports_bp
from routes.user import user_bp
from routes.evacuation import evacuation_bp
from routes.subscriptions import subscriptions_bp
from routes.iot import iot_bp
from routes.config import config_bp
from utils.db import close_db

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for frontend integration
CORS(app)

from routes.admin import admin_bp

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
app.register_blueprint(alerts_bp, url_prefix='/api/alerts')
app.register_blueprint(reports_bp, url_prefix='/api/reports')
app.register_blueprint(user_bp, url_prefix='/api/users')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(evacuation_bp, url_prefix='/api/evacuation-centers')
app.register_blueprint(subscriptions_bp, url_prefix='/api/subscriptions')
app.register_blueprint(iot_bp, url_prefix="/api/iot")
app.register_blueprint(config_bp, url_prefix='/api/config')

# Teardown DB connection
app.teardown_appcontext(close_db)

@app.route('/')
def home():
    return {"message": "FloodGuard Flask Backend is Running!"}

if __name__ == '__main__':
    # Running on port 5000 by default.
    # Use 'flask run' in production or gunicorn.
    import os
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)
