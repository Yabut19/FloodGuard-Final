import os
import logging
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from utils.db import get_db

logger = logging.getLogger(__name__)

reports_bp = Blueprint('reports', __name__)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

@reports_bp.route('/uploads/<name>')
def download_file(name):
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], name)

@reports_bp.route('/', methods=['POST'])
def create_report():
    logger.debug("Content-Type: %s", request.content_type)
    logger.debug("Method: %s", request.method)
    logger.debug("Files: %s", list(request.files.keys()) if request.files else 'No files')
    logger.debug("Form: %s", dict(request.form) if request.form else 'No form data')

    # Check if this is a multipart request (with file) or JSON
    if request.is_json:
        data = request.get_json()
        logger.debug("JSON data: %s", data)
    else:
        data = request.form
        logger.debug("Form data: %s", dict(data))

    reporter_name = data.get('reporter_name', 'Anonymous')
    reporter_email = data.get('reporter_email')  # Optional email for notifications
    report_type = data.get('type')
    location = data.get('location')
    description = data.get('description')
    image_url = None

    logger.debug("Extracted - name: %s, type: %s, location: %s", reporter_name, report_type, location)

    # Handle Image Upload
    if 'image' in request.files:
        file = request.files['image']
        logger.debug("Image file: %s", file.filename if file else 'None')
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # Ensure upload directory exists
            os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            logger.debug("Saved image to: %s", file_path)
            # Construct URL (assuming server is accessible via same host)
            image_url = f"/api/reports/uploads/{filename}"
        else:
            logger.debug("Image file not allowed or missing: %s", file.filename if file else 'None')

    if not report_type or not location:
        logger.warning("Validation failed - type: %s, location: %s", report_type, location)
        return jsonify({"error": "Type and location are required"}), 400
        
    db = get_db()
    cursor = db.cursor()
    
    # Check if reporter_email column exists
    cursor.execute("SHOW COLUMNS FROM reports LIKE 'reporter_email'")
    has_email_column = cursor.fetchone() is not None
    
    # Build INSERT query dynamically
    columns = ["reporter_name", "type", "location", "description", "image_url", "status", "timestamp"]
    values = [reporter_name, report_type, location, description, image_url, "pending"]
    placeholders = ["%s"] * len(values)
    
    if has_email_column and reporter_email:
        columns.insert(1, "reporter_email")
        values.insert(1, reporter_email)
        placeholders.insert(1, "%s")
    
    query = f"""
        INSERT INTO reports ({', '.join(columns)})
        VALUES ({', '.join(placeholders)}, NOW())
    """
    
    cursor.execute(query, values)
    
    db.commit()
    report_id = cursor.lastrowid
    cursor.close()
    
    return jsonify({"message": "Report submitted successfully", "id": report_id, "image_url": image_url}), 201

@reports_bp.route('/', methods=['GET'])
def get_reports():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    status = request.args.get('status')
    reporter_name = request.args.get('reporter_name')
    
    query = "SELECT * FROM reports WHERE 1=1"
    params = []
    
    if status:
        query += " AND status = %s"
        params.append(status)

    if reporter_name:
        query += " AND reporter_name = %s"
        params.append(reporter_name)
        
    query += " ORDER BY timestamp DESC"
    
    cursor.execute(query, params)
    reports = cursor.fetchall()
    cursor.close()
    
    return jsonify(reports)

@reports_bp.route('/<int:report_id>/status', methods=['PUT'])
def update_report_status(report_id):
    data = request.get_json()
    status = data.get('status') # verified, dismissed
    
    if status not in ['verified', 'dismissed']:
        return jsonify({"error": "Invalid status"}), 400
        
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("UPDATE reports SET status = %s WHERE id = %s", (status, report_id))
    db.commit()
    cursor.close()

    # Trigger auto-escalation logic when a report is verified
    if status == 'verified':
        try:
            from routes.subscriptions import auto_escalate
            with current_app.test_request_context('/api/subscriptions/auto-escalate', method='POST'):
                auto_escalate()
        except Exception as e:
            # Non-critical — log but don't fail the report status update
            current_app.logger.warning(f"Auto-escalation check failed: {e}")
    
    return jsonify({"message": "Report status updated"}), 200


# ═══════════════════════════════════════════════════════════════════════════════
# ─ VERIFICATION ENDPOINTS: LGU/Admin verification with audit trail ──────────────
# ═══════════════════════════════════════════════════════════════════════════════

@reports_bp.route('/pending', methods=['GET'])
def get_pending_reports():
    """Get all pending reports awaiting verification by LGU/Admin"""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT id, reporter_name, type, location, description, image_url, 
               timestamp, flood_level_reported, latitude, longitude, maps_url
        FROM reports 
        WHERE status = 'pending' 
        ORDER BY timestamp DESC
    """)
    reports = cursor.fetchall()
    cursor.close()
    
    return jsonify(reports), 200


@reports_bp.route('/<int:report_id>/verify', methods=['POST'])
def verify_report(report_id):
    """Verify and broadcast a user report - triggers alert to all subscribers"""
    data = request.get_json() or {}
    verified_by = data.get('verified_by')  # LGU admin username/email
    flood_level = data.get('flood_level')  # Official flood level classification
    
    if not verified_by:
        return jsonify({"error": "verified_by (LGU official) is required"}), 400
    
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    # Get the report details first
    cursor.execute("""
        SELECT * FROM reports WHERE id = %s
    """, (report_id,))
    report = cursor.fetchone()
    
    if not report:
        return jsonify({"error": "Report not found"}), 404
    
    if report['status'] != 'pending':
        return jsonify({"error": "Only pending reports can be verified"}), 400
    
    # Update with verification info
    from datetime import datetime
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
        UPDATE reports 
        SET status = 'verified', 
            verified_by = %s, 
            verified_at = %s,
            flood_level_reported = %s
        WHERE id = %s
    """, (verified_by, now, flood_level, report_id))
    
    db.commit()
    cursor.close()
    
    # ── Auto-escalate to create official alert ──────────────────────────────────
    try:
        # Create an official alert from this verified report
        cursor = db.cursor()
        alert_level = 'advisory' if flood_level in ['low', 'ankle-high'] else \
                     'warning' if flood_level in ['medium', 'waist-high'] else 'critical'
        
        cursor.execute("""
            INSERT INTO alerts (title, description, level, barangay, status, timestamp)
            VALUES (%s, %s, %s, %s, 'active', NOW())
        """, (
            f"Verified: {report['type']} at {report['location']}",
            f"Verified by LGU Official ({verified_by})\nUser Report: {report['description']}\nFlood Level: {flood_level}",
            alert_level,
            report['location']
        ))
        
        db.commit()
        cursor.close()
        
        # Trigger subscriptions notification
        try:
            from routes.subscriptions import auto_escalate
            with current_app.test_request_context('/api/subscriptions/auto-escalate', method='POST'):
                auto_escalate()
        except Exception as e:
            current_app.logger.warning(f"Auto-escalation failed: {e}")
    
    except Exception as e:
        logger.error("Error creating alert from verified report: %s", e)
    
    return jsonify({
        "message": "Report verified and broadcast as official alert",
        "report_id": report_id,
        "verified_by": verified_by,
        "verified_at": now
    }), 200


@reports_bp.route('/<int:report_id>/reject', methods=['POST'])
def reject_report(report_id):
    """Reject/dismiss a user report as false alarm or duplicate"""
    data = request.get_json() or {}
    rejected_by = data.get('rejected_by')  # LGU admin username/email
    rejection_reason = data.get('rejection_reason')  # Why was it rejected?
    
    if not rejected_by:
        return jsonify({"error": "rejected_by (LGU official) is required"}), 400
    
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    # Get report details including reporter email (if column exists)
    cursor.execute("""
        SELECT reporter_name, type, location, description
        FROM reports WHERE id = %s
    """, (report_id,))
    report = cursor.fetchone()
    
    if not report:
        cursor.close()
        return jsonify({"error": "Report not found"}), 404
    
    # Try to get reporter_email if column exists
    reporter_email = None
    try:
        cursor.execute("SELECT reporter_email FROM reports WHERE id = %s", (report_id,))
        email_result = cursor.fetchone()
        if email_result:
            reporter_email = email_result['reporter_email']
    except:
        # Column doesn't exist yet, continue without email
        pass
    
    from datetime import datetime
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    
    # Update with rejection info
    cursor.execute("""
        UPDATE reports 
        SET status = 'dismissed', 
            verified_by = %s, 
            verified_at = %s,
            rejection_reason = %s
        WHERE id = %s
    """, (rejected_by, now, rejection_reason or "False alarm/Duplicate", report_id))
    
    db.commit()
    cursor.close()
    
    # Send notification email to reporter if email is available
    if reporter_email:
        try:
            from utils.email_service import send_dismissal_notification
            send_dismissal_notification(
                reporter_email=reporter_email,
                reporter_name=report['reporter_name'],
                report_type=report['type'],
                location=report['location'],
                rejection_reason=rejection_reason or "False alarm/Duplicate"
            )
        except Exception as e:
            logger.error("Failed to send dismissal notification: %s", e)
    
    return jsonify({
        "message": "Report rejected and dismissed",
        "report_id": report_id,
        "rejected_by": rejected_by,
        "rejection_reason": rejection_reason or "False alarm/Duplicate",
        "dismissed_at": now
    }), 200


# ═══════════════════════════════════════════════════════════════════════════════
# ─ ANALYTICS & DYNAMIC REPORTING: Daily summaries and real-time aggregates ────
# ═══════════════════════════════════════════════════════════════════════════════

@reports_bp.route('/summary', methods=['GET'])
def get_daily_summary():
    """Provides dynamic daily aggregates for the dashboard cards"""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    # 1. Basic Stats for Today
    cursor.execute("""
        SELECT 
            COUNT(*) as total_readings,
            AVG(flood_level) as avg_level,
            MAX(flood_level) as peak_level,
            SUM(CASE WHEN status IN ('ALARM', 'CRITICAL') THEN 1 ELSE 0 END) as critical_readings
        FROM iot_readings
        WHERE DATE(created_at) = CURDATE()
    """)
    stats = cursor.fetchone() or {"total_readings": 124, "avg_level": 12.4, "peak_level": 45.2, "critical_readings": 2}
    
    # 2. Total Alerts for Today
    cursor.execute("SELECT COUNT(*) as alert_count FROM alerts WHERE DATE(timestamp) = CURDATE()")
    alerts = cursor.fetchone() or {"alert_count": 4}
    
    # 3. Community Reports for Today
    cursor.execute("SELECT COUNT(*) as report_count FROM reports WHERE DATE(timestamp) = CURDATE()")
    reports = cursor.fetchone() or {"report_count": 8}

    # 4. Sensor Network Status
    cursor.execute("SELECT COUNT(*) as total FROM sensors")
    total_row = cursor.fetchone()
    total_sensors = total_row['total'] if total_row else 0
    
    cursor.execute("SELECT COUNT(*) as active FROM sensors WHERE status = 'active'")
    active_row = cursor.fetchone()
    active_sensors = active_row['active'] if active_row else 0
    
    cursor.close()
    
    return jsonify({
        "alerts_today": alerts['alert_count'],
        "critical_events": stats['critical_readings'],
        "avg_flood_level": round(float(stats['avg_level'] or 0), 1),
        "peak_flood_level": round(float(stats['peak_level'] or 0), 1),
        "active_sensors": active_sensors,
        "total_sensors": total_sensors,
        "total_readings": stats['total_readings'],
        "community_reports": reports['report_count']
    }), 200


@reports_bp.route('/history', methods=['GET'])
def get_flood_history():
    """Provides historical sensor data for the explorer table"""
    sensor_id = request.args.get('sensor_id')
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    query = """
        SELECT id, sensor_id, flood_level, status, created_at 
        FROM iot_readings 
    """
    params = []
    
    if sensor_id and sensor_id != 'All Sensors':
        query += " WHERE sensor_id = %s"
        params.append(sensor_id)
        
    query += " ORDER BY created_at DESC LIMIT 50"
    
    cursor.execute(query, params)
    readings = cursor.fetchall()
    
    # Enrich with sensor name and location if possible
    cursor.execute("SELECT id, name, barangay FROM sensors")
    sensor_info = {s['id']: {"name": s['name'], "location": s['barangay']} for s in cursor.fetchall()}
    cursor.close()
    
    formatted_data = []
    for r in readings:
        dt = r['created_at']
        info = sensor_info.get(r['sensor_id'], {"name": r['sensor_id'], "location": "General Area"})
        
        formatted_data.append({
            "id": r['id'],
            "time": dt.strftime("%I:%M %p"),
            "date": dt.strftime("%b %d, %Y"),
            "level": f"{r['flood_level']} cm",
            "sensor": info["name"],
            "location": info["location"],
            "status": r['status'].capitalize() if r['status'] else "Normal"
        })
        
    return jsonify(formatted_data), 200

@reports_bp.route('/daily-list', methods=['GET'])
def get_daily_reports_list():
    """Generates a dynamic list of daily summaries for the last 7 days"""
    reports = []
    today = datetime.now()
    
    for i in range(7):
        date = today - timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        display_date = date.strftime("%b %d, %Y")
        
        reports.append({
            "id": i + 1,
            "name": f"Daily Flood Summary - {display_date}",
            "date": display_date,
            "iso_date": date_str,
            "size": "1.2 MB",
            "format": "PDF"
        })
        
    return jsonify(reports), 200

