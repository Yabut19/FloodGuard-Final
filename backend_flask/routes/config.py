from flask import Blueprint, request, jsonify
from utils.db import get_db

config_bp = Blueprint("config", __name__)

@config_bp.route("/thresholds", methods=["GET"])
def get_thresholds():
    try:
        from utils.thresholds import get_current_thresholds
        thresholds = get_current_thresholds()
        return jsonify({
            "advisory_level": int(thresholds["advisory_cm"]),
            "warning_level": int(thresholds["warning_cm"]),
            "critical_level": int(thresholds["critical_cm"])
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@config_bp.route("/thresholds", methods=["PUT"])
def update_thresholds():
    data = request.get_json()
    adv = data.get("advisory_level")
    warn = data.get("warning_level")
    crit = data.get("critical_level")

    if adv is None or warn is None or crit is None:
        return jsonify({"error": "Missing thresholds"}), 400

    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("INSERT INTO system_config (config_key, config_value) VALUES ('advisory_level', %s) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)", (str(adv),))
        cur.execute("INSERT INTO system_config (config_key, config_value) VALUES ('warning_level', %s) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)", (str(warn),))
        cur.execute("INSERT INTO system_config (config_key, config_value) VALUES ('critical_level', %s) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)", (str(crit),))
        db.commit()
        
        # Force refresh in-memory thresholds immediately
        from utils.thresholds import sync_thresholds_from_db
        sync_thresholds_from_db(force=True)
        
        # Broadcast threshold update to all WebSocket clients
        try:
            from socket_instance import socketio
            socketio.emit("threshold_update", {
                "advisory_level": adv,
                "warning_level": warn,
                "critical_level": crit
            }, namespace="/")
        except Exception as ws_err:
            print(f"[WS] Threshold broadcast failed: {ws_err}")

        return jsonify({
            "message": "Thresholds updated",
            "thresholds": {
                "advisory_level": adv,
                "warning_level": warn,
                "critical_level": crit
            }
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
