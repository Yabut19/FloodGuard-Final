import time
import json
from flask import Blueprint, request, jsonify, Response, stream_with_context
from utils.db import get_db
from datetime import datetime
from utils.timezone_utils import get_pst_now, format_pst, to_pst
from utils.auth_middleware import admin_required, lgu_or_admin_required

iot_bp = Blueprint("iot", __name__)


def _emit_sensor_update(payload: dict):
    """Broadcast sensor data to all WebSocket clients. Imported lazily to avoid circular import."""
    try:
        from socket_instance import socketio
        socketio.emit("sensor_update", payload, namespace="/")
        print(f"[WS] Broadcast sent for {payload.get('sensor_id')}", flush=True)
    except Exception as _e:
        print(f"[WS] Broadcast failed: {_e}", flush=True)

def _emit_sensor_list_update():
    """Broadcast sensor list change to all WebSocket clients."""
    try:
        from socket_instance import socketio
        socketio.emit("sensor_list_update", {"message": "refresh"}, namespace="/")
    except Exception:
        pass

# ── AUTOMATED ALERT STABILITY TRACKER ──────────────────────────────────────────
# Keeps track of sensors currently in Warning/Critical state to enforce 5s stability
_pending_alerts = {} # { sensor_id: { "level": str, "start_time": datetime, "triggered": bool } }

from utils.thresholds import calculate_status, sync_thresholds_from_db, get_current_thresholds, _thresholds


@iot_bp.route("/thresholds", methods=["GET"])
def get_thresholds():
    """ESP32 calls this every 60 s. Always reflects what admin saved in Threshold Config."""
    sync_thresholds_from_db()
    return jsonify(_thresholds), 200

@iot_bp.route("/thresholds", methods=["PUT", "POST"])
def set_thresholds():
    data = request.get_json(silent=True) or {}
    updated = {}
    db = get_db()
    cur = db.cursor()
    
    mapping = {
        "advisory_cm": "advisory_level",
        "warning_cm": "warning_level",
        "critical_cm": "critical_level"
    }
    
    try:
        for key, db_key in mapping.items():
            if key in data:
                val = float(data[key])
                _thresholds[key] = val
                updated[key] = val
                cur.execute(
                    "INSERT INTO system_config (config_key, config_value) VALUES (%s, %s) "
                    "ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)",
                    (db_key, str(val))
                )
        db.commit()
        
        # Broadcast threshold update to all WebSocket clients (sync with config_bp)
        try:
            from socket_instance import socketio
            socketio.emit("threshold_update", {
                "advisory_level": _thresholds["advisory_cm"],
                "warning_level": _thresholds["warning_cm"],
                "critical_level": _thresholds["critical_cm"]
            }, namespace="/")
        except:
            pass
            
        return jsonify({"message": "Thresholds updated", "thresholds": _thresholds}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()


@iot_bp.route("/sensor-readings", methods=["POST"])
def sensor_reading():
    data = request.get_json(silent=True) or {}
    sensor_id = data.get("sensor_id")
    if not sensor_id:
        return jsonify({"error": "sensor_id is required"}), 400
        
    raw_distance = data.get("raw_distance", 0)
    flood_level = data.get("flood_level")
    status = data.get("status", "NORMAL")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    maps_url = data.get("maps_url")
    
    # ALWAYS use Philippine Standard Time (UTC+8)
    timestamp = format_pst(get_pst_now())

    if flood_level is None:
        return jsonify({"error": "flood_level is required"}), 400

    db = get_db()
    cur = db.cursor()
    
    try:
        # Verify sensor exists AND fetch its metadata for processing
        cur.execute("SELECT id, name, barangay, status FROM sensors WHERE id = %s", (sensor_id,))
        sensor_data = cur.fetchone()
        if not sensor_data:
            return jsonify({"error": f"Sensor {sensor_id} not registered"}), 404
        
        sensor_name = sensor_data[1]
        sensor_barangay = sensor_data[2]
        sensor_active_status = sensor_data[3]

        # ── HEARTBEAT UPDATE: Always update last_update to track connection ──
        # Extract metadata if provided
        battery_level = data.get("battery_level")
        signal_strength = data.get("signal_strength")
        power_supply = data.get("power_supply")
        
        update_query = "UPDATE sensors SET last_update = NOW()"
        update_params = []
        if battery_level is not None:
            update_query += ", battery_level = %s"
            update_params.append(battery_level)
        if signal_strength is not None:
            update_query += ", signal_strength = %s"
            update_params.append(signal_strength)
        if power_supply is not None:
            update_query += ", power_supply = %s"
            update_params.append(power_supply)
        update_query += " WHERE id = %s"
        update_params.append(sensor_id)
        
        cur.execute(update_query, update_params)

        # ── DATA COLLECTION RULE: Only insert if sensor is software-enabled (ON) ──
        is_active = sensor_active_status != 'inactive'

        if is_active:
            # Insert into water_levels & iot_readings only if ACTIVE
            cur.execute("""
                INSERT INTO water_levels (sensor_id, level, timestamp)
                VALUES (%s, %s, %s)
            """, (sensor_id, flood_level, timestamp))

            cur.execute("""
                INSERT INTO iot_readings (sensor_id, raw_distance, flood_level, status, latitude, longitude, maps_url, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (sensor_id, raw_distance, flood_level, status, latitude, longitude, maps_url, timestamp))

        if not is_active:
            db.commit()
            cur.close()
            # Broadcast to WS so UI knows it's LIVE but OFF
            _emit_sensor_update({
                "sensor_id": sensor_id,
                "flood_level": 0.0,
                "raw_distance": 0.0,
                "status": "OFF",
                "is_live": True,
                "enabled": False,
                "timestamp": timestamp
            })
            return jsonify({
                "message": "Data received and recorded, but sensor is software-disabled (OFF).",
                "status": "OFF",
                "is_live": True,
                "enabled": False
            }), 201

        # ── INTEGRATION: Recalculate status based on dynamic thresholds ──
        status = calculate_status(flood_level)

        # ── AUTOMATED ALERT STABILITY LOGIC ──────────────────────────────────
        trigger_automated = False
        if status in ["WARNING", "CRITICAL"]:
            now = get_pst_now()
            pending = _pending_alerts.get(sensor_id)
            
            if not pending or pending["level"] != status:
                # Start or reset stability timer for this level
                _pending_alerts[sensor_id] = {"level": status, "start_time": now, "triggered": False}
            else:
                # Level matches, check if 5 seconds have passed
                elapsed = (now - pending["start_time"]).total_seconds()
                if elapsed >= 5 and not pending["triggered"]:
                    trigger_automated = True
                    pending["triggered"] = True
        else:
            # Clear pending if status is NORMAL or ADVISORY
            _pending_alerts.pop(sensor_id, None)

        if trigger_automated:
            # Verify sensor metadata again for alert context
            # Prevent alert spam: check if an active alert for this level/location exists from the last 15 minutes
            cur.execute("""
                SELECT id FROM alerts 
                WHERE barangay = %s AND level = %s AND status = 'active'
                AND timestamp > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
                LIMIT 1
            """, (sensor_barangay, status.lower()))
            
            if not cur.fetchone():
                # Recommended Actions (STRICT)
                action = "Be ready for Evacuation" if status == "WARNING" else "Evacuate now"
                
                # Automated Alert Content (STRICT FORMAT)
                dt_str = get_pst_now().strftime("%B %d, %Y - %I:%M %p")
                headline = f"AUTOMATED FLOOD {status} ALERT"
                
                full_description = (
                    f"{headline}\n"
                    f"Classification: {status}\n"
                    f"Location: Brgy. {sensor_barangay}\n"
                    f"Date/Time: {dt_str}\n"
                    f"Recommended Action: {action}"
                )

                cur.execute("""
                    INSERT INTO alerts (title, description, level, barangay, recommended_action, status, timestamp)
                    VALUES (%s, %s, %s, %s, %s, 'active', NOW())
                """, (f"Automated {status} Alert: {sensor_name}", 
                      full_description, status.lower(), sensor_barangay, action))
                
                db.commit() # Commit alert before broadcasting
                alert_id = cur.lastrowid

                # ── REAL-TIME BROADCAST: Deliver auto-alert instantly ──
                try:
                    from socket_instance import socketio
                    socketio.emit("new_notification", {
                        "type": "auto_alert",
                        "id": alert_id,
                        "title": f"Automated {status} Alert: {sensor_name}",
                        "description": full_description,
                        "level": status.lower(),
                        "barangay": sensor_barangay,
                        "recommended_action": action,
                        "timestamp": get_pst_now().isoformat()
                    }, namespace="/")
                except: pass

        db.commit()
        cur.close()

        # ── Broadcast to all WebSocket clients instantly ────────────────
        ws_payload = {
            "sensor_id":    sensor_id,
            "flood_level":  float(flood_level),
            "raw_distance": float(raw_distance) if raw_distance is not None else 0.0,
            "status":       status,
            "latitude":     float(latitude) if latitude else None,
            "longitude":    float(longitude) if longitude else None,
            "maps_url":     maps_url,
            "is_live":      True,
            "enabled":      True,
            "is_offline":   False,
            "timestamp":    timestamp,
            "battery_level": int(battery_level) if battery_level is not None else 100,
            "power_supply":  power_supply if power_supply else "battery"
        }
        _emit_sensor_update(ws_payload)

        return jsonify({"message": "Reading recorded successfully", "is_live": True, "enabled": True}), 201
    except Exception as e:
        db.rollback()
        if cur: cur.close()
        return jsonify({"error": str(e)}), 500


@iot_bp.route("/latest", methods=["GET"])
def latest_sensor():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT r.sensor_id, r.raw_distance, r.flood_level, r.status,
               r.latitude, r.longitude, r.maps_url, r.created_at, 
               s.status as sensor_status, s.last_update
        FROM iot_readings r
        LEFT JOIN sensors s ON r.sensor_id = s.id
        ORDER BY r.created_at DESC LIMIT 1
    """)
    row = cur.fetchone()
    cur.close()

    if not row:
        return jsonify({"error": "No sensor data found"}), 404

    # Use last_update for physical connectivity check
    last_update = row.get("last_update")
    if isinstance(last_update, datetime):
        last_update_dt = last_update
    else:
        last_update_dt = get_pst_now()

    age_seconds = (get_pst_now() - last_update_dt).total_seconds()
    is_live = age_seconds <= 30.0
    enabled = row.get("sensor_status") != "inactive"
    
    row["is_live"] = is_live
    row["enabled"] = enabled
    row["status"] = "DISCONNECTED" if not is_live else ("OFF" if not enabled else calculate_status(row.get("flood_level") or 0))

    try:
        # Force 0cm if not live OR manually inactive
        row["flood_level"] = float(row.get("flood_level") or 0) if (is_live and enabled) else 0.0
    except Exception:
        row["flood_level"] = 0.0
    try:
        row["raw_distance"] = float(row.get("raw_distance") or 0) if (is_live and enabled) else 0.0
    except Exception:
        row["raw_distance"] = 0.0

    return jsonify(row), 200


@iot_bp.route("/latest-readings", methods=["GET"])
def latest_readings():
    # ...
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT id, sensor_id, raw_distance, flood_level, status,
               latitude, longitude, maps_url, created_at
        FROM iot_readings
        ORDER BY created_at DESC LIMIT 50
    """)
    rows = cur.fetchall()
    cur.close()
    return jsonify(rows), 200


# ── NEW: Heartbeat endpoint polled every 1 second by frontend ─────────────────
@iot_bp.route("/status", methods=["GET"])
def sensor_status():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT r.sensor_id, r.raw_distance, r.flood_level, r.status, r.created_at, 
               s.status as sensor_status, s.last_update
        FROM sensors s
        LEFT JOIN iot_readings r ON s.id = r.sensor_id
        ORDER BY r.created_at DESC
        LIMIT 1
    """)
    row = cur.fetchone()
    cur.close()

    if not row:
        return jsonify({
            "is_live": False,
            "enabled": False,
            "status": "OFFLINE",
            "flood_level": 0
        }), 200

    last_update = row.get("last_update")
    if isinstance(last_update, datetime):
        last_update_dt = last_update
    else:
        last_update_dt = get_pst_now()

    age_seconds = (get_pst_now() - last_update_dt).total_seconds()
    is_live = age_seconds <= 30.0
    enabled = row.get("sensor_status") != "inactive"

    flood_level = float(row.get("flood_level") or 0) if (is_live and enabled) else 0.0
    raw_distance = float(row.get("raw_distance") or 0) if (is_live and enabled) else 0.0
    
    return jsonify({
        "is_live": is_live,
        "enabled": enabled,
        "status": "DISCONNECTED" if not is_live else ("OFF" if not enabled else calculate_status(flood_level)),
        "flood_level": flood_level,
        "raw_distance": raw_distance,
        "sensor_id": row.get("sensor_id")
    }), 200


@iot_bp.route("/sensor-by-location", methods=["GET"])
def sensor_by_location():
    """Fetch latest sensor data - optionally filtered by location via query param"""
    location = request.args.get('location')  # Optional: barangay name or 'All'
    
    db = get_db()
    cur = db.cursor(dictionary=True)
    
    try:
        if location and location != 'All':
            # Join with sensors table to filter by barangay
            cur.execute("""
                SELECT r.id, r.sensor_id, r.raw_distance, r.flood_level, r.status,
                       r.latitude, r.longitude, r.maps_url, r.created_at,
                       s.name as sensor_name, s.barangay
                FROM iot_readings r
                JOIN sensors s ON r.sensor_id = s.id
                WHERE s.barangay = %s
                ORDER BY r.created_at DESC LIMIT 1
            """, (location,))
        else:
            cur.execute("""
                SELECT id, sensor_id, raw_distance, flood_level, status,
                       latitude, longitude, maps_url, created_at
                FROM iot_readings
                ORDER BY created_at DESC LIMIT 1
            """)
        
        row = cur.fetchone()
        cur.close()

        if not row:
            return jsonify({"error": f"No sensor data found for location: {location}" if location else "No sensor data found"}), 404

        created_at = row.get("created_at")
        if isinstance(created_at, str):
            try:
                created_at_dt = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
            except Exception:
                created_at_dt = get_pst_now()
        elif isinstance(created_at, datetime):
            created_at_dt = created_at
        else:
            created_at_dt = get_pst_now()

        # Consistent 30s threshold for offline status
        age_seconds = (get_pst_now() - created_at_dt).total_seconds()
        is_offline = age_seconds > 30.0

        row["is_offline"] = is_offline
        row["status"] = calculate_status(row.get("flood_level") or 0, is_offline)

        try:
            row["flood_level"] = float(row.get("flood_level") or 0)
        except Exception:
            row["flood_level"] = 0.0
        try:
            row["raw_distance"] = float(row.get("raw_distance") or 0)
        except Exception:
            row["raw_distance"] = 0.0

        return jsonify(row), 200
    except Exception as e:
        if cur: cur.close()
        return jsonify({"error": str(e)}), 500


# ── SENSOR MANAGEMENT ENDPOINTS ────────────────────────────────────────────────

@iot_bp.route("/sensors", methods=["GET"])
@lgu_or_admin_required
def get_all_sensors(current_user):
    """Fetch all registered sensors with details"""
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT id, name, barangay, description, lat, lng, status, battery_level, 
                   signal_strength, power_supply, last_update
            FROM sensors
            ORDER BY last_update DESC
        """)
        sensors = cur.fetchall()
        
        for sensor in sensors:
            if sensor['lat']: sensor['lat'] = float(sensor['lat'])
            if sensor['lng']: sensor['lng'] = float(sensor['lng'])
            if sensor['last_update']:
                sensor['last_update'] = sensor['last_update'].isoformat() if isinstance(sensor['last_update'], datetime) else str(sensor['last_update'])
        
        cur.close()
        return jsonify({"sensors": sensors}), 200
    except Exception as e:
        cur.close()
        return jsonify({"error": str(e)}), 500


@iot_bp.route("/sensors/status-all", methods=["GET"])
@lgu_or_admin_required
def get_all_sensors_status(current_user):
    """Fetch all sensors with their latest readings"""
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        # Get all registered sensors
        cur.execute("SELECT id, name, barangay, lat, lng, status, battery_level, signal_strength, power_supply, last_update FROM sensors")
        sensors = cur.fetchall()
        
        # DEBUG: Print number of sensors found
        print(f"[DEBUG] Found {len(sensors)} registered sensors")

        # Get latest reading for EACH sensor
        cur.execute("""
            SELECT r1.sensor_id, r1.flood_level, r1.raw_distance,
                   r1.status as reading_status, r1.created_at, r1.latitude, r1.longitude
            FROM iot_readings r1
            INNER JOIN (
                SELECT sensor_id, MAX(created_at) as max_at
                FROM iot_readings
                GROUP BY sensor_id
            ) r2 ON r1.sensor_id = r2.sensor_id AND r1.created_at = r2.max_at
        """)
        readings = cur.fetchall()
        # Use string keys for readings_map to ensure compatibility with sensor IDs
        readings_map = {str(r['sensor_id']).strip(): r for r in readings}
        
        print(f"[DEBUG] Found {len(readings)} latest readings")
        
        for s in sensors:
            # Ensure ID is a clean string
            s['id'] = str(s['id']).strip()
            s['lat'] = float(s['lat']) if s['lat'] else 0
            s['lng'] = float(s['lng']) if s['lng'] else 0

            # If sensor is disabled (inactive), force it offline regardless of readings
            is_disabled = s.get('status') == 'inactive'

            latest = readings_map.get(s['id'])
            
            # Connection check: use latest reading timestamp or fallback to sensors.last_update
            # We use a 30s threshold (more lenient for IoT reporting intervals)
            liveness_dt = None
            if latest and latest.get('created_at'):
                liveness_dt = to_pst(latest['created_at'])
            else:
                liveness_dt = to_pst(s.get('last_update'))
            
            if not liveness_dt:
                liveness_dt = get_pst_now()
            
            age_seconds = (get_pst_now() - liveness_dt).total_seconds()
            s['is_live'] = age_seconds <= 30.0
            s['enabled'] = s.get('status') != 'inactive'
            s['is_offline'] = not s['is_live'] # strictly hardware status for blinking dot

            if latest:
                s['flood_level'] = float(latest['flood_level']) if latest['flood_level'] is not None else 0.0
                s['raw_distance'] = float(latest['raw_distance']) if latest.get('raw_distance') is not None else 0.0
                s['last_seen'] = latest['created_at'].isoformat() if isinstance(latest['created_at'], datetime) else str(latest['created_at'])
                
                # ── DISPLAY LOGIC: Force 0.0 if either not live OR disabled ──
                if not s['is_live']:
                    s['flood_level'] = 0.0
                    s['raw_distance'] = 0.0
                    s['reading_status'] = 'DISCONNECTED'
                elif not s['enabled']:
                    s['flood_level'] = 0.0
                    s['raw_distance'] = 0.0
                    s['reading_status'] = 'OFF'
                else:
                    s['reading_status'] = calculate_status(s['flood_level'])
            else:
                s['flood_level'] = 0.0
                s['raw_distance'] = 0.0
                s['reading_status'] = 'DISCONNECTED'
                s['last_seen'] = None

        # Add enabled flag and fix types/serialization
        for s in sensors:
            s['enabled'] = s.get('status') != 'inactive'
            s['name'] = s.get('name') or f"Sensor {s['id']}"
            s['barangay'] = s.get('barangay') or "Active Area"
            
            # Ensure all numeric fields are float for JSON
            s['lat'] = float(s['lat']) if s['lat'] else 0.0
            s['lng'] = float(s['lng']) if s['lng'] else 0.0
            s['battery_level'] = int(s['battery_level']) if s['battery_level'] is not None else 100
            s['power_supply'] = s.get('power_supply') or 'battery'
            
            # Fix datetime serialization for jsonify
            if 'last_update' in s and hasattr(s['last_update'], 'isoformat'):
                s['last_update'] = s['last_update'].isoformat()
            elif 'last_update' in s:
                s['last_update'] = str(s['last_update'])
                
        cur.close()
        return jsonify(sensors), 200
    except Exception as e:
        if cur: cur.close()
        return jsonify({"error": str(e)}), 500




@iot_bp.route("/registers-sensor", methods=["POST"])
@admin_required
def register_sensor(current_user):
    """Register a new sensor"""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['id', 'name', 'lat', 'lng', 'barangay']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    sensor_id = data.get('id')
    name = data.get('name')
    barangay = data.get('barangay')
    description = data.get('description', '')
    lat = data.get('lat')
    lng = data.get('lng')
    status = data.get('status', 'active')
    battery_level = data.get('battery_level', 100)
    signal_strength = data.get('signal_strength', 'strong')
    
    # Validate coordinates
    try:
        lat = float(lat)
        lng = float(lng)
        if lat < -90 or lat > 90 or lng < -180 or lng > 180:
            return jsonify({"error": "Invalid coordinates"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "Coordinates must be numeric"}), 400
    
    # Validate status
    valid_statuses = ['active', 'inactive', 'maintenance']
    if status not in valid_statuses:
        return jsonify({"error": f"Status must be one of: {', '.join(valid_statuses)}"}), 400
    
    # Validate signal strength
    valid_signals = ['strong', 'medium', 'weak']
    if signal_strength not in valid_signals:
        return jsonify({"error": f"Signal strength must be one of: {', '.join(valid_signals)}"}), 400
    
    db = get_db()
    cur = db.cursor()
    
    try:
        # Check if sensor already exists
        cur.execute("SELECT id FROM sensors WHERE id = %s", (sensor_id,))
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "Sensor with this ID already exists"}), 409
        
        # Insert new sensor
        cur.execute("""
            INSERT INTO sensors (id, name, barangay, description, lat, lng, status, battery_level, signal_strength)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (sensor_id, name, barangay, description, lat, lng, status, battery_level, signal_strength))
        
        db.commit()
        cur.close()
        
        _emit_sensor_list_update()
        
        return jsonify({
            "message": "Sensor registered successfully",
            "sensor": {
                "id": sensor_id,
                "name": name,
                "barangay": barangay,
                "description": description,
                "lat": lat,
                "lng": lng,
                "status": status,
                "battery_level": battery_level,
                "signal_strength": signal_strength
            }
        }), 201
    except Exception as e:
        db.rollback()
        cur.close()
        return jsonify({"error": str(e)}), 500


@iot_bp.route("/sensors/<string:sensor_id>", methods=["PUT"])
@admin_required
def update_sensor(current_user, sensor_id):
    """Update sensor information"""
    data = request.get_json()
    
    db = get_db()
    cur = db.cursor()
    
    try:
        # Check if sensor exists
        cur.execute("SELECT id FROM sensors WHERE id = %s", (sensor_id,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Sensor not found"}), 404
        
        # Build update query dynamically
        update_fields = []
        params = []
        
        if 'name' in data:
            update_fields.append("name = %s")
            params.append(data['name'])
        
        if 'status' in data:
            valid_statuses = ['active', 'inactive', 'maintenance']
            if data['status'] not in valid_statuses:
                cur.close()
                return jsonify({"error": f"Status must be one of: {', '.join(valid_statuses)}"}), 400
            update_fields.append("status = %s")
            params.append(data['status'])
        
        if 'battery_level' in data:
            update_fields.append("battery_level = %s")
            params.append(data['battery_level'])
        
        if 'signal_strength' in data:
            valid_signals = ['strong', 'medium', 'weak']
            if data['signal_strength'] not in valid_signals:
                cur.close()
                return jsonify({"error": f"Signal strength must be one of: {', '.join(valid_signals)}"}), 400
            update_fields.append("signal_strength = %s")
            params.append(data['signal_strength'])
        
        if not update_fields:
            cur.close()
            return jsonify({"error": "No fields to update"}), 400
        
        update_fields.append("last_update = CURRENT_TIMESTAMP")
        params.append(sensor_id)
        
        query = f"UPDATE sensors SET {', '.join(update_fields)} WHERE id = %s"
        cur.execute(query, params)
        
        db.commit()
        cur.close()
        
        _emit_sensor_list_update()
        
        return jsonify({"message": "Sensor updated successfully"}), 200
    except Exception as e:
        db.rollback()
        cur.close()
        return jsonify({"error": str(e)}), 500


@iot_bp.route("/sensors/<string:sensor_id>/toggle", methods=["PATCH"])
@lgu_or_admin_required
def toggle_sensor(current_user, sensor_id):
    """Enable or disable a sensor (on/off switch).
    Body: { "enabled": true | false }
    When disabled the sensor is treated as offline everywhere.
    """
    data = request.get_json(silent=True) or {}
    enabled = data.get("enabled")
    if enabled is None:
        return jsonify({"error": "enabled (bool) is required"}), 400

    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("SELECT id FROM sensors WHERE id = %s", (sensor_id,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Sensor not found"}), 404

        new_status = "active" if enabled else "inactive"
        cur.execute(
            "UPDATE sensors SET status = %s, last_update = CURRENT_TIMESTAMP WHERE id = %s",
            (new_status, sensor_id)
        )
        db.commit()
        cur.close()

        _emit_sensor_list_update()

        return jsonify({
            "message": f"Sensor {'enabled' if enabled else 'disabled'} successfully",
            "sensor_id": sensor_id,
            "enabled": enabled,
            "status": new_status
        }), 200
    except Exception as e:
        db.rollback()
        if cur:
            cur.close()
        return jsonify({"error": str(e)}), 500


@iot_bp.route("/sensors/<string:sensor_id>", methods=["DELETE"])
@admin_required
def delete_sensor(current_user, sensor_id):
    """Delete a sensor"""
    db = get_db()
    cur = db.cursor()
    
    try:
        # Check if sensor exists
        cur.execute("SELECT id FROM sensors WHERE id = %s", (sensor_id,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Sensor not found"}), 404
        
        # Delete associated water level records first (if foreign key constraint exists)
        cur.execute("DELETE FROM water_levels WHERE sensor_id = %s", (sensor_id,))
        
        # Delete sensor
        cur.execute("DELETE FROM sensors WHERE id = %s", (sensor_id,))
        db.commit()
        cur.close()
        
        _emit_sensor_list_update()
        
        return jsonify({"message": "Sensor deleted successfully"}), 200
    except Exception as e:
        db.rollback()
        cur.close()
        return jsonify({"error": str(e)}), 500


# ── SERVER-SENT EVENTS: live flood data stream ─────────────────────────────────
@iot_bp.route("/stream", methods=["GET"])
def stream():
    """
    SSE endpoint — clients subscribe once and receive live sensor data
    every 2 seconds without polling.
    Usage (browser):
        const es = new EventSource('http://<server>/api/iot/stream');
        es.onmessage = e => { const d = JSON.parse(e.data); ... };
    """
    def generate():
        last_payload = None
        while True:
            try:
                db = get_db()
                cur = db.cursor(dictionary=True)
                cur.execute("""
                    SELECT r.sensor_id, r.flood_level, r.raw_distance,
                           r.status, r.latitude, r.longitude, r.maps_url, r.created_at, s.status as sensor_status
                    FROM iot_readings r
                    LEFT JOIN sensors s ON r.sensor_id = s.id
                    ORDER BY r.created_at DESC LIMIT 1
                """)
                row = cur.fetchone()
                cur.close()

                if row:
                    created_at = row.get("created_at")
                    if isinstance(created_at, datetime):
                        created_at_dt = created_at
                    else:
                        try:
                            created_at_dt = datetime.strptime(
                                str(created_at).replace("T", " ").split(".")[0],
                                "%Y-%m-%d %H:%M:%S"
                            )
                        except Exception:
                            created_at_dt = get_pst_now()

                    age = (get_pst_now() - created_at_dt).total_seconds()
                    is_live = age <= 30
                    enabled = row.get("sensor_status") != "inactive"

                    payload = {
                        "sensor_id":    row.get("sensor_id"),
                        "flood_level":  float(row.get("flood_level") or 0) if (is_live and enabled) else 0.0,
                        "raw_distance": float(row.get("raw_distance") or 0) if (is_live and enabled) else 0.0,
                        "status":       "DISCONNECTED" if not is_live else ("OFF" if not enabled else calculate_status(row.get("flood_level") or 0)),
                        "latitude":     float(row["latitude"]) if row.get("latitude") else None,
                        "longitude":    float(row["longitude"]) if row.get("longitude") else None,
                        "maps_url":     row.get("maps_url"),
                        "is_live":      is_live,
                        "enabled":      enabled,
                        "is_offline":   not is_live,
                        "timestamp":    str(created_at),
                        "thresholds":   dict(_thresholds),
                    }
                else:
                    payload = {
                        "sensor_id": None, "flood_level": 0,
                        "raw_distance": 0, "status": "OFFLINE",
                        "latitude": None, "longitude": None,
                        "maps_url": None, "is_offline": True,
                        "timestamp": None,
                    }

            except Exception:
                payload = {
                    "sensor_id": None, "flood_level": 0,
                    "raw_distance": 0, "status": "OFFLINE",
                    "latitude": None, "longitude": None,
                    "maps_url": None, "is_offline": True,
                    "timestamp": None,
                }

            import json
            data_str = json.dumps(payload, default=str)
            if data_str != last_payload:
                last_payload = data_str
                yield "data: {}\n\n".format(data_str)
            else:
                yield ": heartbeat\n\n"   # keep connection alive

            time.sleep(2)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


# ── COMPREHENSIVE LIVE STREAM: sensors + alerts + pending reports ───────────────
@iot_bp.route("/live", methods=["GET"])
def live_stream():
    """
    All-in-one SSE endpoint. Streams a combined snapshot every 3 seconds.
    Clients receive one JSON object with:
      sensors[]        — all sensors with latest readings
      active_alerts[]  — latest 10 active alerts
      pending_count    — number of unverified citizen reports
      thresholds       — current advisory/warning/critical thresholds
    """
    def generate():
        import json
        last_payload = None
        while True:
            try:
                db = get_db()
                cur = db.cursor(dictionary=True)

                # All sensors with latest readings
                cur.execute("""
                    SELECT s.id, s.name, s.barangay, s.lat, s.lng,
                           s.status as sensor_status, s.battery_level, s.signal_strength,
                           r.flood_level, r.raw_distance, r.status as reading_status,
                           r.latitude, r.longitude, r.maps_url, r.created_at
                    FROM sensors s
                    LEFT JOIN iot_readings r ON r.sensor_id = s.id
                        AND r.created_at = (
                            SELECT MAX(r2.created_at) FROM iot_readings r2
                            WHERE r2.sensor_id = s.id
                        )
                """)
                sensors_raw = cur.fetchall()

                sensors = []
                for s in sensors_raw:
                    created_at = s.get("created_at")
                    if isinstance(created_at, datetime):
                        age = (datetime.now() - created_at).total_seconds()
                    else:
                        age = 9999
                    enabled = s.get("sensor_status") != "inactive"
                    is_live = age <= 30
                    
                    sensors.append({
                        "id":           s["id"],
                        "name":         s["name"],
                        "barangay":     s["barangay"],
                        "lat":          float(s["lat"]) if s["lat"] else 0,
                        "lng":          float(s["lng"]) if s["lng"] else 0,
                        "flood_level":  float(s["flood_level"] or 0) if (is_live and enabled) else 0.0,
                        "raw_distance": float(s["raw_distance"] or 0) if (is_live and enabled) else 0.0,
                        "status":       "DISCONNECTED" if not is_live else ("OFF" if not enabled else (s["reading_status"] or "NORMAL")),
                        "is_live":      is_live,
                        "enabled":      enabled,
                        "is_offline":   not is_live,
                        "battery_level":   s.get("battery_level"),
                        "signal_strength": s.get("signal_strength"),
                        "latitude":     float(s["latitude"]) if s.get("latitude") else None,
                        "longitude":    float(s["longitude"]) if s.get("longitude") else None,
                        "maps_url":     s.get("maps_url"),
                        "last_seen":    created_at.isoformat() if isinstance(created_at, datetime) else None,
                    })

                # Active alerts (latest 10)
                cur.execute("""
                    SELECT id, title, description, barangay, level, status, created_at,
                           recommended_action, incident_status
                    FROM alerts
                    WHERE status = 'active'
                    ORDER BY created_at DESC LIMIT 10
                """)
                alerts_raw = cur.fetchall()
                active_alerts = []
                for a in alerts_raw:
                    a["created_at"] = a["created_at"].isoformat() if isinstance(a.get("created_at"), datetime) else str(a.get("created_at", ""))
                    active_alerts.append(a)

                # Pending citizen reports count
                cur.execute("SELECT COUNT(*) as cnt FROM reports WHERE status = 'pending'")
                row = cur.fetchone()
                pending_count = row["cnt"] if row else 0

                cur.close()

                sync_thresholds_from_db()
                payload = {
                    "sensors":       sensors,
                    "active_alerts": active_alerts,
                    "pending_count": pending_count,
                    "thresholds":    dict(_thresholds),
                }

                data_str = json.dumps(payload, default=str)
                if data_str != last_payload:
                    last_payload = data_str
                    yield "data: {}\n\n".format(data_str)
                else:
                    yield ": heartbeat\n\n"

            except Exception as e:
                yield ": error {}\n\n".format(str(e))

            time.sleep(3)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )
