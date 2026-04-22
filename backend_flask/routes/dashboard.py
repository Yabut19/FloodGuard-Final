from flask import Blueprint, jsonify
from utils.db import get_db

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/stats', methods=['GET'])
def get_stats():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    # Active Sensors (Truly Online: status='active' AND fresh data < 5s)
    cursor.execute("""
        SELECT COUNT(DISTINCT s.id) as count 
        FROM sensors s
        JOIN iot_readings r ON s.id = r.sensor_id
        WHERE s.status = 'active'
        AND r.created_at >= DATE_SUB(NOW(), INTERVAL 5 SECOND)
    """)
    active_sensors = cursor.fetchone()['count']
    
    # Active Alerts
    cursor.execute("SELECT COUNT(*) as count FROM alerts WHERE status='active'")
    active_alerts = cursor.fetchone()['count']
    
    # Registered Users
    cursor.execute("SELECT COUNT(*) as count FROM users")
    users_count = cursor.fetchone()['count']
    
    # Avg Water Level - Optimized query using a join to find the latest reading per sensor
    cursor.execute("""
        SELECT AVG(wl.level) as avg_level 
        FROM water_levels wl
        INNER JOIN (
            SELECT sensor_id, MAX(timestamp) as max_ts
            FROM water_levels 
            GROUP BY sensor_id
        ) latest ON wl.sensor_id = latest.sensor_id AND wl.timestamp = latest.max_ts
    """)
    result = cursor.fetchone()
    avg_water_level = round(float(result['avg_level']), 2) if result and result['avg_level'] is not None else 0.0
    
    cursor.close()
    
    return jsonify({
        "active_sensors": active_sensors,
        "active_alerts": active_alerts,
        "registered_users": users_count,
        "avg_water_level": avg_water_level
    })
