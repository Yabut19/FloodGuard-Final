import logging
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
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
CORS(app, resources={r"/*": {"origins": "*"}})

# ── WebSocket (Socket.IO) ──────────────────────────────────────────────────────
# 'threading' mode is used for compatibility with Python 3.13/3.14.
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading",
                    logger=False, engineio_logger=False)

# Auto-apply DB column migrations on startup
try:
    from setup_db import run_migrations
    run_migrations()
except Exception as _mig_err:
    logging.warning("DB migration check failed: %s", _mig_err)

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

# ── Socket.IO event handlers ───────────────────────────────────────────────────
@socketio.on("connect")
def on_connect():
    logging.info("[WS] Client connected")
    try:
        from utils.db import get_db
        db = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("""
            SELECT sensor_id, raw_distance, flood_level, status, created_at
            FROM iot_readings
            ORDER BY created_at DESC LIMIT 1
        """)
        row = cur.fetchone()
        cur.close()
        db.close()
        
        if row:
            if hasattr(row["created_at"], "isoformat"):
                row["timestamp"] = row["created_at"].isoformat()
            socketio.emit("sensor_update", row)
    except Exception as e:
        print("[WS] Failed to send latest data on connect:", e)

@socketio.on("disconnect")
def on_disconnect():
    logging.info("[WS] Client disconnected")


if __name__ == '__main__':
    import os
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    # Use socketio.run() which handles the threading server automatically
    socketio.run(app, debug=debug_mode, host='0.0.0.0', port=5000)
