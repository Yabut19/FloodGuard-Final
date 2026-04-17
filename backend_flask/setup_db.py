import mysql.connector
from config import Config
import os

def get_db_connection():
    return mysql.connector.connect(
        host=Config.DB_HOST,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME
    )

def run_schema(cursor):
    print("Applying schema...")
    with open('db_schema.sql', 'r') as f:
        schema = f.read()
        statements = schema.split(';')
        for statement in statements:
            if statement.strip():
                try:
                    cursor.execute(statement)
                except mysql.connector.Error as err:
                    print(f"Error executing statement: {err}")
                    print(f"Statement: {statement[:50]}...")

def seed_data(cursor, conn):
    print("Seeding data...")
    
    # 1. Sensors
    sensors = [
        ('sensor-1', 'Sensor A1', 10.3189, 123.9162, 'active', 85, 'strong', '2024-03-10 10:00:00'),
        ('sensor-2', 'Sensor B2', 10.3166, 123.9194, 'active', 92, 'strong', '2024-03-10 10:05:00'),
        ('sensor-3', 'Sensor C3', 10.3152, 123.9169, 'maintenance', 45, 'weak', '2024-03-10 09:30:00'),
        ('sensor-4', 'Sensor D4', 10.3181, 123.9207, 'active', 78, 'medium', '2024-03-10 10:10:00')
    ]
    cursor.executemany("""
        INSERT INTO sensors (id, name, lat, lng, status, battery_level, signal_strength, last_update)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE 
        status=VALUES(status), battery_level=VALUES(battery_level), signal_strength=VALUES(signal_strength), last_update=VALUES(last_update)
    """, sensors)

    # 2. Alerts
    alerts = [
        ('Medium Risk Alert', 'Water level rising in Sitio Magtalisay. Monitor conditions closely.', 'warning', 'Sitio Magtalisay', 'active', '2024-03-10 09:45:00'),
        ('Weather Update', 'Heavy rainfall expected in the next 2 hours. Stay alert.', 'advisory', 'City-wide', 'active', '2024-03-10 09:00:00'),
        ('All Clear', 'Water levels have returned to normal in Sitio San Vicente.', 'advisory', 'Sitio San Vicente', 'resolved', '2024-03-10 07:00:00'),
         ('High Risk - Evacuate Now', 'Immediate evacuation required for low-lying areas.', 'critical', 'Sitio Laray Holy Name', 'active', '2024-03-10 05:00:00')
    ]
    cursor.executemany("""
        INSERT INTO alerts (title, description, level, barangay, status, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, alerts)

    # 3. Reports
    reports = [
        ('Juan User', 'Flooding', 'Sitio San Vicente', 'Water level is approx 2ft deep.', '2024-03-10 09:55:00', 'pending'),
         ('Maria Resident', 'Road Closure', 'Sitio Magtalisay', 'Bridge is impassable due to debris.', '2024-03-10 08:30:00', 'verified')
    ]
    cursor.executemany("""
        INSERT INTO reports (reporter_name, type, location, description, timestamp, status)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, reports)

    # 4. Water Levels (Historical sample)
    import random
    water_levels = []
    for sensor in sensors:
        s_id = sensor[0]
        base_level = 2.0
        for i in range(10):
            level = base_level + random.uniform(-0.5, 0.5)
            water_levels.append((s_id, round(level, 2)))
    
    cursor.executemany("""
        INSERT INTO water_levels (sensor_id, level) VALUES (%s, %s)
    """, water_levels)

    conn.commit()
    print("Seeding complete.")

if __name__ == "__main__":
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        run_schema(cursor)
        seed_data(cursor, conn)
        cursor.close()
        conn.close()
        print("Database setup successful!")
    except Exception as e:
        print(f"Setup failed: {e}")
