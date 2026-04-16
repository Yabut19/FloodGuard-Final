import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import LiveSensorStatus from "../components/LiveSensorStatus";
import WelcomeBanner from "../components/WelcomeBanner";
import { API_BASE_URL } from "../config/api";

const AdminDashboard = ({ onNavigate, onLogout, userRole }) => {
    const [stats, setStats] = useState({ active_sensors: 0, active_alerts: 0, registered_users: 0, avg_water_level: 0 });
    const [recentAlerts, setRecentAlerts] = useState([]);
    const [liveSensors, setLiveSensors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("Admin User");
    const refreshRef = useRef(null);

    useEffect(() => {
        if (typeof window !== "undefined" && window.localStorage) {
            const name = localStorage.getItem("userName");
            if (name) setUserName(name);
        }
        fetchAll();
        refreshRef.current = setInterval(fetchAll, 15000);
        return () => clearInterval(refreshRef.current);
    }, []);

    const fetchAll = async () => {
        await Promise.all([fetchStats(), fetchAlerts(), fetchSensors()]);
        setLoading(false);
    };

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/dashboard/stats`);
            if (res.ok) setStats(await res.json());
        } catch (e) { /* silent */ }
    };

    const fetchAlerts = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/alerts/?status=active`);
            if (res.ok) {
                const data = await res.json();
                setRecentAlerts(data.slice(0, 5)); // show latest 5
            }
        } catch (e) { /* silent */ }
    };

    const fetchSensors = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/iot/sensors/status-all`);
            if (!res.ok) return;
            const data = await res.json();
            setLiveSensors(data.map(s => ({
                id: s.id, name: s.name, location: s.barangay,
                waterLevel: s.flood_level,
                status: s.is_offline ? "OFFLINE" : (s.reading_status || "NORMAL"),
                battery: s.battery_level, signal: s.signal_strength,
            })));
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

    const onlineSensors = liveSensors.filter(s => s.status !== "OFFLINE").length;

    const statCards = [
        { label: "Active Sensors", value: stats.active_sensors, icon: "cpu", iconBg: "#dbeafe", iconColor: "#2563eb", sub: `${onlineSensors} online now` },
        { label: "Active Alerts", value: stats.active_alerts, icon: "alert-triangle", iconBg: "#fee2e2", iconColor: "#dc2626", sub: stats.active_alerts === 0 ? "All clear" : "Requires attention" },
        { label: "Registered Users", value: stats.registered_users, icon: "users", iconBg: "#dcfce7", iconColor: "#16a34a", sub: "Mobile app users" },
        { label: "Avg Water Level", value: `${Number(stats.avg_water_level || 0).toFixed(1)} cm`, icon: "trending-up", iconBg: "#f3e8ff", iconColor: "#7c3aed", sub: "Across all sensors" },
    ];

    return (
        <View style={styles.dashboardRoot}>
            <AdminSidebar activePage="overview" onNavigate={onNavigate} onLogout={onLogout} variant={userRole} />
            <View style={styles.dashboardMain}>
                <WelcomeBanner userName={userName} />
                <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Dashboard Overview</Text>
                        <Text style={styles.dashboardTopSubtitle}>Real-time monitoring and system status</Text>
                    </View>
                    <View style={styles.dashboardTopRight}>
                        <View style={styles.dashboardStatusPill}>
                            <View style={styles.dashboardStatusDot} />
                            <Text style={styles.dashboardStatusText}>{onlineSensors}/{liveSensors.length} Sensors Online</Text>
                        </View>
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
                            {statCards.map((card) => (
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
                        <LiveSensorStatus sensors={liveSensors} />

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
                                    <View style={db.emptyPanel}>
                                        <Feather name="check-circle" size={28} color="#16a34a" />
                                        <Text style={db.emptyPanelText}>No active alerts</Text>
                                        <Text style={db.emptyPanelSub}>System is clear</Text>
                                    </View>
                                ) : (
                                    recentAlerts.map(alert => (
                                        <View key={alert.id} style={styles.dashboardAlertItem}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.dashboardAlertTitle}>{alert.title || "Alert"}</Text>
                                                <Text style={styles.dashboardAlertSubtitle}>{alert.description || `Barangay ${alert.barangay || "—"}`}</Text>
                                                <Text style={styles.dashboardAlertMeta}>{timeAgo(alert.timestamp)}</Text>
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
                                    <View style={db.emptyPanel}>
                                        <Feather name="cpu" size={28} color="#cbd5e1" />
                                        <Text style={db.emptyPanelText}>No sensors registered</Text>
                                        <TouchableOpacity onPress={() => onNavigate("sensor-registration")}>
                                            <Text style={{ color: "#3b82f6", fontFamily: "Poppins_500Medium", fontSize: 13, marginTop: 4 }}>Register sensors →</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    liveSensors.map(sensor => {
                                        const isOffline = sensor.status === "OFFLINE";
                                        const isWarn = sensor.status === "WARNING" || sensor.status === "CRITICAL";
                                        const pillStyle = isOffline ? db.pillGray : isWarn ? styles.dashboardAlertBadgeWarning : styles.dashboardSensorStatusPill;
                                        const pillTextStyle = isOffline ? db.pillGrayText : isWarn ? styles.dashboardAlertBadgeText : styles.dashboardSensorStatusText;
                                        return (
                                            <View key={sensor.id} style={styles.dashboardSensorItem}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.dashboardSensorTitle}>{sensor.name}</Text>
                                                    <Text style={styles.dashboardSensorMeta}>
                                                        Brgy. {sensor.location || "—"} · {" "}
                                                        <Text style={styles.dashboardSensorMetaStrong}>
                                                            {isOffline ? "OFFLINE" : `${Number(sensor.waterLevel || 0).toFixed(1)} cm`}
                                                        </Text>
                                                        {" "}· Batt: <Text style={styles.dashboardSensorMetaStrong}>{sensor.battery ?? "—"}%</Text>
                                                    </Text>
                                                </View>
                                                <View style={pillStyle}>
                                                    <Text style={pillTextStyle}>{sensor.status}</Text>
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
        </View>
    );
};

const db = StyleSheet.create({
    emptyPanel: { alignItems: "center", paddingVertical: 32, gap: 4 },
    emptyPanelText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#64748b" },
    emptyPanelSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#94a3b8" },
    pillGray: { backgroundColor: "#e5e7eb", borderRadius: 16, paddingVertical: 4, paddingHorizontal: 8 },
    pillGrayText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#6b7280" },
});

export default AdminDashboard;