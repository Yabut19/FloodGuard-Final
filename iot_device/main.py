import machine, utime, network, urequests, gc

# 1. HARDWARE FREQUENCY TUNING
machine.freq(160000000) # 160MHz for high-speed mathematical calculation

# 2. PIN CONFIGURATION
p_trig = machine.Pin(26, machine.Pin.OUT); p_trig.value(0)
p_echo = machine.Pin(27, machine.Pin.IN)
buzzer = machine.PWM(machine.Pin(4))
buzzer.freq(2000); buzzer.duty(0)
led = machine.Pin(2, machine.Pin.OUT)

# System Status variables
wlan = network.WLAN(network.STA_IF)
t_warning = 5.0
t_critical = 15.0
WIFI_SSID = "Redmi"
WIFI_PASS = "00000000"
BACKEND_URL = "http://10.199.140.238:5000/api/iot/sensor-readings"
THRESHOLD_URL = "http://10.199.140.238:5000/api/iot/thresholds"
SENSOR_ID = "Sensor-1"

# ---- PHYSICS: ACOUSTIC DISTANCE FUNCTION ----
def measure_acoustic_distance():
    p_trig.value(0); utime.sleep_us(2)
    p_trig.value(1); utime.sleep_us(15); p_trig.value(0)
    try:
        t = machine.time_pulse_us(p_echo, 1, 35000)
        if t <= 0: return None
        # Speed of sound in air is approx 343 m/s (0.0343 cm/us)
        dist = (t * 0.0343) / 2.0
        
        # Valid physics constraints for this tub/bucket scenario
        # Removed ghost zone to allow full detection range
        if 8.0 <= dist <= 150.0: return dist
    except:
        pass
    return None

# ---- INITIALIZATION ROUTINE ----
def boot_sequence():
    global t_warning, t_critical
    print("[BOOT] Boot Sequence Initialized...")
    
    # RULE: While initialization is happening, buzzer should beep and LED should turn on.
    led.value(1) # Blue LED ON
    buzzer.freq(2000)
    buzzer.duty(512) # Continuous startup beep
    
    # 1. Connect Wi-Fi
    print("-> Connecting to Wi-Fi...")
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASS)
    
    for i in range(15): # Max 7.5 seconds waiting
        if wlan.isconnected():
            print("-> Wi-Fi Connected!")
            break
        led.value(not led.value()) # Blink while connecting
        utime.sleep_ms(500)
        
    # 2. Fetch thresholds
    if wlan.isconnected():
        try:
            r = urequests.get(THRESHOLD_URL, timeout=1.5)
            d = r.json(); r.close()
            t_warning = float(d.get("warning_cm", t_warning))
            t_critical = float(d.get("critical_cm", t_critical))
        except: pass
    
    # 3. Precision Calibration (Identifying current surface vs ground)
    print("-> Calibrating absolute surface reference...")
    calibration_samples = []
    attempts = 0
    while len(calibration_samples) < 11 and attempts < 40:
        val = measure_acoustic_distance()
        if val is not None:
            calibration_samples.append(val)
        led.value(not led.value()) # Rapid blink while calibrating
        utime.sleep_ms(50)
        attempts += 1
        
    led.value(1) # Solid on finish
    
    if len(calibration_samples) < 5:
        baseline = 50.0 # Safety fallback
    else:
        calibration_samples.sort()
        # Mathematically identify if we are hitting ground or water by taking current median
        baseline = calibration_samples[len(calibration_samples)//2]
    
    print("[BOOT COMPLETE] Surface Baseline Locked at: {:.2f} cm".format(baseline))
    
    # RULE: Once initialization is complete, the buzzer should stop.
    buzzer.duty(0)
    
    return baseline

def activate_buzzer():
    # RULE: Only activate at Critical level for exactly 3 seconds.
    print("[ALERT] Critical Level - Buzzer Active (3s)")
    buzzer.freq(3500)
    buzzer.duty(900)
    utime.sleep(3) # Exact 3-second block
    buzzer.duty(0)

# ---- THE MAIN EVENT LOOP ----
def main():
    global t_warning, t_critical
    
    # Baseline is dynamically set to whatever surface is seen at boot (dry or water)
    baseline = boot_sequence()
    
    sliding_window = []
    smoothed_flood = 0.0 # Start at 0.0 for whatever surface was calibrated
    last_send = utime.ticks_ms()
    last_status = "NORMAL"
    buzzer_triggered = False # Flag to prevent repeat buzzing for 3s rule
    
    print("--- LIVE MONITORING STARTED ---")
    
    while True:
        try:
            now = utime.ticks_ms()
            raw = measure_acoustic_distance()
            
            if raw is not None:
                sliding_window.append(raw)
                if len(sliding_window) > 5:
                    sliding_window.pop(0)
                
                if len(sliding_window) == 5:
                    # BLOCK-SPLASH MEDIAN FILTER
                    sorted_window = sorted(sliding_window)
                    median_raw = sorted_window[2] 
                    
                    # Distance calculation relative to BOOT baseline
                    calculated_depth = baseline - median_raw
                    
                    # Noise Floor (Ignore sub-centimeter air ripples)
                    if abs(calculated_depth) < 0.5:
                        calculated_depth = 0.0
                        
                    # ---- THE ASYMMETRIC LOGIC ----
                    # This ensures consistency while adding/removing water
                    if calculated_depth > (smoothed_flood + 0.1):
                        # RISING: We are adding water. Update fast to track the pour.
                        smoothed_flood = (smoothed_flood * 0.3) + (calculated_depth * 0.7)
                    elif calculated_depth < (smoothed_flood - 0.5):
                        # FALLING: Only follow the drop if it is significant / sustained (Removal).
                        # Reacts slowly to ignore splashes/ripples during drain.
                        smoothed_flood = (smoothed_flood * 0.95) + (calculated_depth * 0.05)
                    # ELSE: If change is tiny, lock the value (Stability)
            
            display_val = round(smoothed_flood, 2)
            
            # evaluate Status
            if display_val >= t_critical: 
                current_status = "CRITICAL"
            elif display_val >= t_warning: 
                current_status = "RISING"
            else: 
                current_status = "NORMAL"
            
            # TRIGGER BUZZER ONLY ON TRANSITION TO CRITICAL
            if current_status == "CRITICAL" and not buzzer_triggered:
                activate_buzzer()
                buzzer_triggered = True # Mark as fired
            elif current_status != "CRITICAL":
                buzzer_triggered = False # Reset flag when back to safe levels
                
            # STREAMING TO DASHBOARD
            if utime.ticks_diff(now, last_send) >= 1000:
                print("FLOOD: {:6.2f} cm | STATUS: {}".format(display_val, current_status))
                if wlan.isconnected():
                    try:
                        urequests.post(BACKEND_URL, json={
                            "sensor_id": SENSOR_ID, 
                            "raw_distance": baseline - display_val, 
                            "flood_level": display_val, 
                            "status": current_status
                        }, timeout=1.0).close()
                    except: pass
                last_send = now
                
            utime.sleep_ms(40) # Rapid polling for real-time response
            
        except Exception as e:
            utime.sleep_ms(500)

if __name__ == "__main__":
    main()

