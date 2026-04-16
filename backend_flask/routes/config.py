from flask import Blueprint, request, jsonify
from utils.db import get_db

config_bp = Blueprint("config", __name__)

@config_bp.route("/thresholds", methods=["GET"])
def get_thresholds():
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT config_value FROM system_config WHERE config_key = 'advisory_level'")
        adv = cur.fetchone()
        cur.execute("SELECT config_value FROM system_config WHERE config_key = 'warning_level'")
        warn = cur.fetchone()
        cur.execute("SELECT config_value FROM system_config WHERE config_key = 'critical_level'")
        crit = cur.fetchone()

        return jsonify({
            "advisory_level": int(adv['config_value']) if adv else 15,
            "warning_level": int(warn['config_value']) if warn else 30,
            "critical_level": int(crit['config_value']) if crit else 50
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()

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
