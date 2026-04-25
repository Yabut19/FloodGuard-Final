from flask_socketio import SocketIO

# Initialize SocketIO without an app first
# This allows us to import it in routes without circular dependencies
socketio = SocketIO(
    cors_allowed_origins="*", 
    async_mode="threading", 
    logger=True,           # Enable logging for debugging
    engineio_logger=True,  # Enable engineio logging for debugging
    ping_timeout=10,
    ping_interval=5,
    manage_session=False
)
