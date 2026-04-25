import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import LiveSensorStatus from "../components/LiveSensorStatus";
import WelcomeBanner from "../components/WelcomeBanner";
import TopRightStatusIndicator from "../components/TopRightStatusIndicator";
import { API_BASE_URL } from "../config/api";
import useDataSync from "../utils/useDataSync";
import { formatPST, getSystemStatus, getSystemStatusColor } from "../utils/dateUtils";
import { authFetch } from "../utils/helpers";

const SuperAdminDashboard = ({ onNavigate, onLogout, activePage = "overview" }) => {
    const [stats, setStats] = useState({ active_sensors: 0, active_alerts: 0, registered_users: 0, avg_water_level: 0 });
    const [recentAlerts, setRecentAlerts] = useState([]);
    const [liveSensors, setLiveSensors] = useState(() => {
        if (typeof window !== "undefined") {
            const cached = localStorage.getItem("floodguard_super_sensors");
            if (cached) {
                const parsed = JSON.parse(cached);
                const now = new Date();
                // Validate cache immediately to prevent reload glitch
                return parsed.map(s => {
                    const isTimedOut = s.is_live && s.lastSeen && (now - new Date(s.lastSeen) > 30000);
                    if (isTimedOut) {
                        return { ...s, is_live: false, status: s.enabled === false ? "OFF" : "DISCONNECTED", waterLevel: 0, rawDistance: 0 };
                    }
                    return s;
                });
            }
        }
        return [];
    });
    const [thresholds, setThresholds] = useState({ advisory_level: 15, warning_level: 30, critical_level: 50 });
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("Admin");
    const refreshRef = useRef(null);
    

    useEffect(() => {
        if (typeof window !== "undefined" && window.localStorage) {
            const name = localStorage.getItem("userName");
            if (name) setUserName(name);
        }
        fetchAll();
    }, []);

    // ── Real-time Data Synchronization ──
    useDataSync({
        onSensorUpdate: (reading) => {
            setLiveSensors(prev => {
                const updated = prev.map(s =>
                    s.id === reading.sensor_id
                        ? {
                            ...s,
                            waterLevel:  reading.flood_level,
                            rawDistance: reading.raw_distance || 0,
                            is_live:     reading.is_live ?? true,
                            enabled:     reading.enabled ?? true,
                            status:      !(reading.enabled ?? true) ? "OFF" : (!(reading.is_live ?? true) ? "DISCONNECTED" : (reading.status || "NORMAL")),
                            lastSeen:    new Date().toISOString(),
                          }
                        : s
                );
                setStats(prevStats => ({
                    ...prevStats,
                    active_sensors: updated.filter(s => s.is_live && s.enabled).length,
                    avg_water_level: updated.length
                        ? updated.reduce((a, s) => a + (s.waterLevel || 0), 0) / updated.length
                        : prevStats.avg_water_level,
                }));
                if (typeof window !== "undefined") {
                    localStorage.setItem("floodguard_super_sensors", JSON.stringify(updated));
                }
                return updated;
            });
        },
        onThresholdUpdate: (newThresholds) => {
            console.log("[Admin] Thresholds updated:", newThresholds);
            setThresholds(newThresholds);
        },
        onUserUpdate: () => {
            console.log("[Admin] User list changed, refreshing...");
            fetchStats();
        },
        onAlertUpdate: () => {
            console.log("[Admin] Alerts changed, refreshing...");
            fetchStats();
            fetchAlerts();
        },
        onSensorListUpdate: () => {
            console.log("[Admin] Sensor registry changed, refreshing...");
            fetchSensors();
            fetchStats();
        }
    });

    // ── Liveness Timeout: Reset gauge if sensor stops transmitting ──
    useEffect(() => {
        const checkTimeouts = () => {
            setLiveSensors(prev => {
                const now = new Date();
                let changed = false;
                const updated = prev.map(s => {
                    // Priority logic: Software OFF wins for display if signal is lost
                    if (s.is_live && s.enabled !== false && s.lastSeen) {
                        const lastSeenTime = new Date(s.lastSeen);
                        if (now - lastSeenTime > 30000) {
                            changed = true;
                            // Priority: manually off stays 'OFF', otherwise 'DISCONNECTED'
                            const nextStatus = s.enabled === false ? "OFF" : "DISCONNECTED";
                            return {
                                ...s,
                                is_live: false,
                                status: nextStatus,
                                waterLevel: 0,
                                rawDistance: 0
                            };
                        }
                    }
                    return s;
                });

                if (changed) {
                    const onlineCount = updated.filter(s => s.is_live && s.enabled).length;
                    setStats(prevStats => ({
                        ...prevStats,
                        active_sensors: onlineCount
                    }));
                }

                return changed ? updated : prev;
            });
        };
        const timer = setInterval(checkTimeouts, 500);
        return () => clearInterval(timer);
    }, []);

    const fetchAll = async () => {
        await Promise.all([fetchStats(), fetchAlerts(), fetchSensors(), fetchThresholds()]);
        setLoading(false);
    };

    const fetchStats = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/api/dashboard/stats`);
            if (res.ok) setStats(await res.json());
        } catch (e) { /* silent */ }
    };

    const fetchAlerts = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/api/alerts/?status=active`);
            if (res.ok) {
                const data = await res.json();
                setRecentAlerts(data.slice(0, 5));
            }
        } catch (e) { /* silent */ }
    };

    const fetchSensors = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/api/iot/sensors/status-all`);
            if (!res.ok) {
                console.error("[SuperDashboard] Failed to fetch sensors:", res.status);
                return;
            }
            const data = await res.json();
            if (!Array.isArray(data)) {
                console.error("[SuperDashboard] Sensors data is not an array:", data);
                return;
            }
            const now = new Date();
            const transformed = data.map(s => {
                const serverLastSeen = s.last_update ? new Date(s.last_update) : null;
                const isTrulyLive = s.is_live && serverLastSeen && (now - serverLastSeen < 30000);
                return {
                    id: s.id, name: s.name, location: s.barangay,
                    waterLevel: s.flood_level,
                    rawDistance: s.raw_distance || 0,
                    is_live: isTrulyLive,
                    enabled: s.enabled,
                    status: !s.enabled ? "OFF" : (!isTrulyLive ? "DISCONNECTED" : (s.reading_status || "NORMAL")),
                    battery: s.battery_level, signal: s.signal_strength,
                    lastSeen: s.last_update || (isTrulyLive ? now.toISOString() : null),
                };
            });
            setLiveSensors(transformed);
            if (typeof window !== "undefined") {
                localStorage.setItem("floodguard_super_sensors", JSON.stringify(transformed));
            }
        } catch (e) {
            console.error("[SuperDashboard] fetchSensors error:", e);
        }
    };

    const fetchThresholds = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/api/config/thresholds`);
            if (res.ok) setThresholds(await res.json());
        } catch (e) { /* silent */ }
    };

    const getAlertBadge = (level) => {
        if (!level) return styles.dashboardAlertBadgeAdvisory;
        const l = level.toLowerCase();
        if (l === "critical") return styles.dashboardAlertBadgeCritical;
        if (l === "warning") return styles.dashboardAlertBadgeWarning;
        return styles.dashboardAlertBadgeAdvisory;
    };

    const timeAgo = (timestamp) => {
        if (!timestamp) return "—";
        const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    const onlineSensors = liveSensors.filter(s => s.is_live).length;
    const warningSensors = liveSensors.filter(s => s.is_live && s.enabled && (s.status === "WARNING" || s.status === "CRITICAL")).length;

    const statCards = [
        { label: "Active Sensors", value: stats.active_sensors, icon: "cpu", iconBg: "#dbeafe", iconColor: "#2563eb", sub: `${onlineSensors} online now` },
        { label: "Active Alerts", value: stats.active_alerts, icon: "alert-triangle", iconBg: "#fee2e2", iconColor: "#dc2626", sub: stats.active_alerts === 0 ? "All clear" : "Requires attention" },
        { label: "Registered Users", value: stats.registered_users.toLocaleString(), icon: "users", iconBg: "#dcfce7", iconColor: "#16a34a", sub: "Mobile app users" },
        { label: "Avg Water Level", value: `${Number(stats.avg_water_level || 0).toFixed(1)} cm`, icon: "trending-up", iconBg: "#f3e8ff", iconColor: "#7c3aed", sub: "Across all sensors" },
    ];

    return (
        <View style={styles.dashboardMain}>

                <WelcomeBanner userName={userName} />
                <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Dashboard Overview</Text>
                        <Text style={styles.dashboardTopSubtitle}>Real-time monitoring and system status</Text>
                    </View>
                    <View style={styles.dashboardTopRight}>
                        <TopRightStatusIndicator />
                        <RealTimeClock style={styles.dashboardTopDate} />
                    </View>
                </View>

                {loading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color="#2563eb" />
                        <Text style={{ marginTop: 12, color: "#64748b", fontFamily: "Poppins_400Regular" }}>Loading dashboard...</Text>
                    </View>
                ) : (
                    <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.dashboardScrollContent} showsVerticalScrollIndicator={false}>

                        {/* Stat Cards */}
                        <View style={styles.dashboardStatsRow}>
                            {statCards.map(card => (
                                <View key={card.label} style={styles.dashboardStatCard}>
                                    <View style={[styles.dashboardStatIconWrapper, { backgroundColor: card.iconBg }]}>
                                        <Feather name={card.icon} size={20} color={card.iconColor} />
                                    </View>
                                    <View style={styles.dashboardStatContent}>
                                        <Text style={styles.dashboardStatValue}>{card.value}</Text>
                                        <Text style={styles.dashboardStatLabel}>{card.label}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Live Sensor Gauges */}
                        <LiveSensorStatus sensors={liveSensors} thresholds={thresholds} />

                        {/* Two-column */}
                        <View style={styles.dashboardTwoColumn}>
                            {/* Recent Alerts */}
                            <View style={styles.dashboardPanel}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                    <Text style={styles.dashboardPanelTitle}>Recent Alerts</Text>
                                    <TouchableOpacity onPress={() => onNavigate("alert-management")}>
                                        <Text style={{ fontSize: 12, color: "#3b82f6", fontFamily: "Poppins_500Medium" }}>View all →</Text>
                                    </TouchableOpacity>
                                </View>
                                {recentAlerts.length === 0 ? (
                                    <View style={sd.emptyPanel}>
                                        <Feather name="check-circle" size={28} color="#16a34a" />
                                        <Text style={sd.emptyPanelText}>No active alerts</Text>
                                        <Text style={sd.emptyPanelSub}>System is clear</Text>
                                    </View>
                                ) : (
                                    recentAlerts.map(alert => (
                                        <View key={alert.id} style={styles.dashboardAlertItem}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.dashboardAlertTitle}>{alert.title || "Alert"}</Text>
                                                <Text style={styles.dashboardAlertSubtitle}>{alert.description || `Barangay ${alert.barangay || "—"}`}</Text>
                                                <Text style={styles.dashboardAlertMeta}>{formatPST(alert.timestamp)}</Text>
                                            </View>
                                            <View style={getAlertBadge(alert.level)}>
                                                <Text style={styles.dashboardAlertBadgeText}>{(alert.level || "ADVISORY").toUpperCase()}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>

                            {/* Sensor Status */}
                            <View style={styles.dashboardPanel}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                    <Text style={styles.dashboardPanelTitle}>Sensor Status</Text>
                                    <TouchableOpacity onPress={() => onNavigate("sensor-registration")}>
                                        <Text style={{ fontSize: 12, color: "#3b82f6", fontFamily: "Poppins_500Medium" }}>Manage →</Text>
                                    </TouchableOpacity>
                                </View>
                                {liveSensors.length === 0 ? (
                                    <View style={sd.emptyPanel}>
                                        <Feather name="cpu" size={28} color="#cbd5e1" />
                                        <Text style={sd.emptyPanelText}>No sensors registered</Text>
                                        <TouchableOpacity onPress={() => onNavigate("sensor-registration")}>
                                            <Text style={{ color: "#3b82f6", fontFamily: "Poppins_500Medium", fontSize: 13, marginTop: 4 }}>Register sensors →</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    liveSensors.map(sensor => {
                                        const isOffline = sensor.status === "DISCONNECTED";
                                        const isOff = sensor.status === "OFF";
                                        
                                        const getLiveStatus = () => {
                                            if (isOff) return "OFF";
                                            if (isOffline) return "Disconnected";
                                            const lvl = Number(sensor.waterLevel || 0);
                                            if (lvl >= thresholds.critical_level) return "CRITICAL";
                                            if (lvl >= thresholds.warning_level) return "WARNING";
                                            if (lvl >= thresholds.advisory_level) return "ADVISORY";
                                            return "NORMAL";
                                        };
                                        const liveStatus = getLiveStatus();
                                        const isWarn = liveStatus === "WARNING" || liveStatus === "CRITICAL";

                                        const pillStyle = (isOffline || isOff) ? sd.pillGray : isWarn ? styles.dashboardAlertBadgeWarning : styles.dashboardSensorStatusPill;
                                        const pillTextStyle = (isOffline || isOff) ? sd.pillGrayText : isWarn ? styles.dashboardAlertBadgeText : styles.dashboardSensorStatusText;
                                        return (
                                            <View key={sensor.id} style={styles.dashboardSensorItem}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.dashboardSensorTitle}>{sensor.name}</Text>
                                                    <Text style={styles.dashboardSensorMeta}>
                                                        Brgy. {sensor.location || "—"} ·{" "}
                                                        <Text style={styles.dashboardSensorMetaStrong}>
                                                            {(isOffline || isOff) ? "0.0 cm" : `Flood: ${Number(sensor.waterLevel || 0).toFixed(1)} cm`}
                                                        </Text>
                                                        {(!isOffline && !isOff) && (
                                                            <Text> · Raw: <Text style={styles.dashboardSensorMetaStrong}>{Number(sensor.rawDistance || 0).toFixed(1)} cm</Text></Text>
                                                        )}
                                                    </Text>
                                                </View>
                                                <View style={pillStyle}>
                                                    <Text style={pillTextStyle}>{liveStatus}</Text>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        </View>

                        <View style={{ height: 80 }} />
                    </ScrollView>
                )}
            </View>
        );
    };

const sd = StyleSheet.create({
    emptyPanel: { alignItems: "center", paddingVertical: 32, gap: 4 },
    emptyPanelText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#64748b" },
    emptyPanelSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#94a3b8" },
    pillGray: { backgroundColor: "#e5e7eb", borderRadius: 16, paddingVertical: 4, paddingHorizontal: 8 },
    pillGrayText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#6b7280" },
});

export default SuperAdminDashboard;