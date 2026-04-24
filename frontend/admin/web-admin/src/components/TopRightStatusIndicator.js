import React, { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { styles } from '../styles/globalStyles';
import { getSystemStatusColor } from '../utils/dateUtils';
import useDataSync from '../utils/useDataSync';
import { API_BASE_URL } from '../config/api';
import { authFetch } from '../utils/helpers';

const TopRightStatusIndicator = () => {
    const [sensors, setSensors] = useState(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('floodguard_sensors_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                const now = new Date();
                // Validate cache: if it's been > 1s since lastSeen, it's NOT live anymore
                return parsed.map(s => ({
                    ...s,
                    is_live: s.is_live && s.lastSeen && (now - new Date(s.lastSeen) < 1000)
                }));
            }
        }
        return [];
    });
    const sensorsRef = useRef(sensors);

    const fetchStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/api/iot/sensors/status-all`);
            if (res.ok) {
                const data = await res.json();
                const now = new Date();
                const transformed = data.map(s => {
                    const serverLastSeen = s.last_update ? new Date(s.last_update) : null;
                    const isTrulyLive = s.is_live && serverLastSeen && (now - serverLastSeen < 1000);
                    return {
                        id: s.id,
                        is_live: isTrulyLive,
                        enabled: s.enabled !== false,
                        lastSeen: s.last_update || (isTrulyLive ? now.toISOString() : null)
                    };
                });
                setSensors(transformed);
                sensorsRef.current = transformed;
                if (typeof window !== 'undefined') {
                    localStorage.setItem('floodguard_sensors_cache', JSON.stringify(transformed));
                }
            }
        } catch (e) {
            console.error("[StatusIndicator] Fetch error:", e);
        }
    };

    useEffect(() => {
        fetchStatus();

        // ── Real-time Liveness Monitor (Heartbeat Check) ──
        const monitor = setInterval(() => {
            const now = new Date();
            let hasChange = false;
            const updated = sensorsRef.current.map(s => {
                if (s.is_live && s.lastSeen) {
                    if (now - new Date(s.lastSeen) > 1000) {
                        hasChange = true;
                        return { ...s, is_live: false };
                    }
                }
                return s;
            });

            if (hasChange) {
                setSensors(updated);
                sensorsRef.current = updated;
                if (typeof window !== 'undefined') {
                    localStorage.setItem('floodguard_sensors_cache', JSON.stringify(updated));
                }
            }
        }, 500);

        return () => clearInterval(monitor);
    }, []);

    useDataSync({
        onSensorUpdate: (reading) => {
            const updated = sensorsRef.current.map(s => {
                if (s.id === reading.sensor_id) {
                    return {
                        ...s,
                        is_live: reading.is_live ?? true,
                        enabled: reading.enabled ?? true,
                        lastSeen: new Date().toISOString()
                    };
                }
                return s;
            });
            if (!updated.find(s => s.id === reading.sensor_id)) {
                updated.push({
                    id: reading.sensor_id,
                    is_live: true,
                    enabled: reading.enabled ?? true,
                    lastSeen: new Date().toISOString()
                });
            }
            setSensors(updated);
            sensorsRef.current = updated;
            if (typeof window !== 'undefined') {
                localStorage.setItem('floodguard_sensors_cache', JSON.stringify(updated));
            }
        },
        onSensorListUpdate: () => {
            fetchStatus();
        }
    });

    const onlineCount = sensors.filter(s => s.is_live && s.enabled).length;
    const totalCount = sensors.length;
    const statusColor = getSystemStatusColor(onlineCount);

    return (
        <View style={[styles.dashboardStatusPill, { backgroundColor: onlineCount >= 1 ? "rgba(22, 163, 74, 0.1)" : "rgba(100, 116, 139, 0.1)" }]}>
            <View style={[styles.dashboardStatusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.dashboardStatusText, { color: statusColor }]}>
                {onlineCount}/{totalCount} Live
            </Text>
        </View>
    );
};

export default TopRightStatusIndicator;
