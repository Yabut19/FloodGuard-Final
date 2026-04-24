from utils.db import get_db

_thresholds = {
    "advisory_cm": 10.0,
    "warning_cm": 15.0,
    "critical_cm": 25.0,
}
_last_sync_time = 0

def sync_thresholds_from_db(force=False):
    """Read admin-saved thresholds from system_config and update _thresholds in memory."""
    global _last_sync_time
    import time
    
    # Only sync if forced or if it's been more than 60 seconds since last sync
    now = time.time()
    if not force and (now - _last_sync_time < 60):
        return

    try:
        db = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute(
            "SELECT config_key, config_value FROM system_config "
            "WHERE config_key IN ('advisory_level','warning_level','critical_level')"
        )
        rows = cur.fetchall()
        cur.close()
        mapping = {r["config_key"]: float(r["config_value"]) for r in rows}
        if "advisory_level" in mapping:
            _thresholds["advisory_cm"] = mapping["advisory_level"]
        if "warning_level" in mapping:
            _thresholds["warning_cm"] = mapping["warning_level"]
        if "critical_level" in mapping:
            _thresholds["critical_cm"] = mapping["critical_level"]
        _last_sync_time = now
    except Exception:
        pass  # fall back to in-memory defaults

def calculate_status(level, is_offline=False):
    """Calculate status based on level and current thresholds."""
    if is_offline:
        return "OFFLINE"
    
    # Use cached thresholds
    sync_thresholds_from_db()
    lvl = float(level)
    if lvl >= _thresholds.get("critical_cm", 25.0):
        return "CRITICAL"
    elif lvl >= _thresholds.get("warning_cm", 15.0):
        return "WARNING"
    elif lvl >= _thresholds.get("advisory_cm", 10.0):
        return "ADVISORY"
    return "NORMAL"

def get_current_thresholds():
    sync_thresholds_from_db(force=True)
    return dict(_thresholds)
