import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";

const DataReportsPage = ({ onNavigate, onLogout, userRole = "lgu" }) => {
    const isSuperAdmin = userRole === "superadmin";
    
    // ── State ───────────────────────────────────────────────────
    const [reportType, setReportType] = useState("daily");
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [exportFormat, setExportFormat] = useState("pdf");
    const [selectedSensor, setSelectedSensor] = useState({ id: "All Sensors", name: "All Sensors" });
    const [isGenerating, setIsGenerating] = useState(false);
    const [showSensorDropdown, setShowSensorDropdown] = useState(false);
    
    const [analytics, setAnalytics] = useState([]);
    const [floodHistory, setFloodHistory] = useState([]);
    const [dailyReports, setDailyReports] = useState([]);
    const [sensorsList, setSensorsList] = useState([{ id: "All Sensors", name: "All Sensors" }]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [summaryRes, historyRes, listRes, sensorsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/reports/summary`),
                fetch(`${API_BASE_URL}/api/reports/history?sensor_id=${selectedSensor.id}`),
                fetch(`${API_BASE_URL}/api/reports/daily-list`),
                fetch(`${API_BASE_URL}/api/iot/sensors`)
            ]);

            const summary = await summaryRes.json();
            const history = await historyRes.json();
            const list = await listRes.json();
            const sensorsData = await sensorsRes.json();

            setAnalytics([
                { label: "Collected Data", value: summary.total_readings ?? 0, icon: "database", color: "#3b82f6", bg: "#eff6ff" },
                { label: "Peak Flood (cm)", value: summary.peak_flood_level ?? 0, icon: "trending-up", color: "#ef4444", bg: "#fef2f2" },
                { label: "Online Sensors", value: summary.active_sensors ?? 0, icon: "cpu", color: "#06b6d4", bg: "#ecfeff" },
                { label: "Events Logged", value: (summary.alerts_today ?? 0) + (summary.community_reports ?? 0), icon: "clipboard", color: "#10b981", bg: "#ecfdf5" },
            ]);
            setFloodHistory(history);
            setDailyReports(list);
            
            if (sensorsData.sensors) {
                const dynamicSensors = sensorsData.sensors.map(s => ({ 
                    id: s.id, 
                    name: s.name || s.id,
                    status: s.status // 'active', 'inactive', 'maintenance'
                }));
                // Status is not needed for 'All Sensors'
                setSensorsList([{ id: "All Sensors", name: "All Sensors" }, ...dynamicSensors]);
            }
        } catch (error) {
            console.error("Failed to fetch reports data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedSensor.id]);

    const handleGenerateReport = () => {
        setIsGenerating(true);
        setTimeout(() => setIsGenerating(false), 2000);
    };

    return (
        <View style={styles.dashboardRoot}>
            <AdminSidebar variant={userRole} activePage="data-reports" onNavigate={onNavigate} onLogout={onLogout} />

            <View style={styles.dashboardMain}>
                {/* Top Bar */}
                <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Data & Reports</Text>
                        <Text style={styles.dashboardTopSubtitle}>Archive, analysis, and historical flood telemetry</Text>
                    </View>
                    <View style={styles.dashboardTopRight}>
                        <View style={styles.dashboardStatusPill}>
                            <View style={styles.dashboardStatusDot} />
                            <Text style={styles.dashboardStatusText}>System Synced</Text>
                        </View>
                        <RealTimeClock style={styles.dashboardTopDate} />
                    </View>
                </View>

                <ScrollView
                    style={styles.dashboardScroll}
                    contentContainerStyle={[styles.dashboardScrollContent, { paddingHorizontal: 24, paddingTop: 16 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Analytics Summary Row ─────────────────────────────────── */}
                    <View style={pg.analyticsRow}>
                        {analytics.map((item, idx) => (
                            <View key={idx} style={pg.analyticsCard}>
                                <View style={[pg.analyticsIcon, { backgroundColor: item.bg }]}>
                                    <Feather name={item.icon} size={22} color={item.color} />
                                </View>
                                <Text style={pg.analyticsValue}>{item.value}</Text>
                                <Text style={pg.analyticsLabel}>{item.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* ── Main Content Grid ────────────────────────────────────────── */}
                    <View style={pg.mainGrid}>
                        {/* LEFT: Flood History Explorer */}
                        <View style={{ flex: 2, gap: 16 }}>
                            <View style={pg.sectionCard}>
                                <View style={pg.sectionHeader}>
                                    <View>
                                        <Text style={pg.sectionTitle}>View Past Flood Data</Text>
                                        <Text style={pg.sectionSubtitle}>Browse historical recordings across sensors</Text>
                                    </View>
                                    
                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                        {/* Sensor Dropdown */}
                                        <div style={{ position: "relative" }}>
                                            <TouchableOpacity 
                                                style={pg.explorerFilter} 
                                                onPress={() => setShowSensorDropdown(!showSensorDropdown)}
                                            >
                                                <Feather name="cpu" size={14} color="#64748b" />
                                                <Text style={pg.explorerFilterText}>{selectedSensor.name}</Text>
                                                <Feather name="chevron-down" size={14} color="#64748b" />
                                            </TouchableOpacity>
                                            
                                            {showSensorDropdown && (
                                                <View style={pg.dropdown}>
                                                    {sensorsList.map(s => {
                                                        const isOffline = s.status === "inactive";
                                                        const isMaintenance = s.status === "maintenance";
                                                        const labelSuffix = isOffline ? " (Offline)" : isMaintenance ? " (Maintenance)" : "";
                                                        
                                                        return (
                                                            <TouchableOpacity key={s.id} style={pg.dropdownItem} onPress={() => { setSelectedSensor(s); setShowSensorDropdown(false); }}>
                                                                <Text style={pg.dropdownItemText}>{s.name}{labelSuffix}</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            )}
                                        </div>
                                    </View>
                                </View>

                                <View style={pg.tableWrapper}>
                                    <View style={pg.tableHeader}>
                                        <Text style={[pg.tableHeadText, { flex: 1.5 }]}>TIME & DATE</Text>
                                        <Text style={[pg.tableHeadText, { flex: 1 }]}>SENSOR</Text>
                                        <Text style={[pg.tableHeadText, { flex: 1 }]}>LOCATION</Text>
                                        <Text style={[pg.tableHeadText, { flex: 0.8 }]}>LEVEL</Text>
                                        <Text style={[pg.tableHeadText, { flex: 0.8 }]}>STATUS</Text>
                                    </View>
                                    
                                    {isLoading ? (
                                        <View style={{ padding: 32, alignItems: "center" }}>
                                            <ActivityIndicator size="small" color="#3b82f6" />
                                            <Text style={{ marginTop: 12, color: "#94a3b8", fontSize: 13, fontFamily: "Poppins_400Regular" }}>Fetching history...</Text>
                                        </View>
                                    ) : floodHistory.length === 0 ? (
                                        <View style={{ padding: 32, alignItems: "center" }}>
                                            <Feather name="database" size={24} color="#cbd5e1" />
                                            <Text style={{ marginTop: 12, color: "#94a3b8", fontSize: 13, fontFamily: "Poppins_400Regular" }}>No data found for this period</Text>
                                        </View>
                                    ) : floodHistory.map((row, idx) => {
                                        const isCritical = row.status?.toLowerCase() === "critical" || row.status?.toLowerCase() === "alarm";
                                        const isWarning = row.status?.toLowerCase() === "warning";
                                        return (
                                            <View key={row.id} style={[pg.tableRow, idx === floodHistory.length - 1 && { borderBottomWidth: 0 }]}>
                                                <View style={{ flex: 1.5 }}>
                                                    <Text style={pg.tableCellBold}>{row.time}</Text>
                                                    <Text style={pg.tableCellSub}>{row.date}</Text>
                                                </View>
                                                <Text style={[pg.tableCell, { flex: 1 }]} numberOfLines={1}>{row.sensor}</Text>
                                                <Text style={[pg.tableCell, { flex: 1 }]} numberOfLines={1}>{row.location}</Text>
                                                <Text style={[pg.tableCellBold, { flex: 0.8, color: isCritical ? "#dc2626" : isWarning ? "#f59e0b" : "#0f172a" }]}>
                                                    {row.level}
                                                </Text>
                                                <View style={{ flex: 0.8 }}>
                                                    <View style={[pg.statusBadge, { 
                                                        backgroundColor: isCritical ? "#fee2e2" : isWarning ? "#fef3c7" : "#f1f5f9",
                                                        borderColor: isCritical ? "#fca5a5" : isWarning ? "#fcd34d" : "#e2e8f0"
                                                    }]}>
                                                        <Text style={[pg.statusBadgeText, { color: isCritical ? "#dc2626" : isWarning ? "#92400e" : "#64748b" }]}>
                                                            {row.status}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                                
                                <TouchableOpacity style={pg.viewAllBtn} onPress={fetchData}>
                                    <Text style={pg.viewAllText}>{isLoading ? "Refreshing..." : "Refresh Data Archive"}</Text>
                                    <Feather name="refresh-cw" size={14} color="#3b82f6" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* RIGHT: Report Studio */}
                        <View style={{ flex: 1, gap: 16 }}>
                            <View style={pg.sectionCard}>
                                <LinearGradient colors={["#001D39", "#0A4174"]} style={pg.studioHeader}>
                                    <Feather name="file-text" size={20} color="#fff" />
                                    <Text style={pg.studioHeaderTitle}>Report Studio</Text>
                                </LinearGradient>

                                <View style={pg.studioBody}>
                                    <Text style={pg.studioLabel}>SELECT RANGE</Text>
                                    <View style={pg.dateInputs}>
                                        <View style={pg.dateInputBox}>
                                            <Feather name="calendar" size={14} color="#94a3b8" />
                                            <TextInput style={pg.dateTextInput} value={startDate} placeholder="Start" nativeID="start-date" />
                                        </View>
                                        <View style={pg.dateInputBox}>
                                            <Feather name="calendar" size={14} color="#94a3b8" />
                                            <TextInput style={pg.dateTextInput} value={endDate} placeholder="End" nativeID="end-date" />
                                        </View>
                                    </View>

                                    <Text style={[pg.studioLabel, { marginTop: 16 }]}>REPORT TYPE</Text>
                                    <View style={pg.typeGrid}>
                                        {["daily", "weekly", "monthly", "incident"].map(type => (
                                            <TouchableOpacity 
                                                key={type} 
                                                style={[pg.typeBtn, reportType === type && pg.typeBtnActive]}
                                                onPress={() => setReportType(type)}
                                            >
                                                <Text style={[pg.typeBtnText, reportType === type && pg.typeBtnTextActive]}>
                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={[pg.studioLabel, { marginTop: 16 }]}>FORMAT</Text>
                                    <View style={pg.formatRow}>
                                        {["pdf", "csv", "xlsx"].map(fmt => (
                                            <TouchableOpacity 
                                                key={fmt} 
                                                style={[pg.formatPill, exportFormat === fmt && pg.formatPillActive]}
                                                onPress={() => setExportFormat(fmt)}
                                            >
                                                <Text style={[pg.formatPillText, exportFormat === fmt && pg.formatPillTextActive]}>
                                                    {fmt.toUpperCase()}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <TouchableOpacity 
                                        style={[pg.generateBtn, isGenerating && { opacity: 0.7 }]}
                                        onPress={handleGenerateReport}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (
                                            <>
                                                <Feather name="download-cloud" size={18} color="#fff" />
                                                <Text style={pg.generateBtnText}>Compile & Export</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Recent Downloads */}
                            <View style={pg.sectionCard}>
                                <View style={pg.sectionHeader}>
                                    <Text style={[pg.sectionTitle, { fontSize: 14 }]}>Recent Exports</Text>
                                </View>
                                <View style={{ padding: 12, gap: 8 }}>
                                    {isLoading ? (
                                        <ActivityIndicator size="small" color="#94a3b8" style={{ marginVertical: 16 }} />
                                    ) : dailyReports.map(rep => (
                                        <TouchableOpacity key={rep.id} style={pg.recentItem}>
                                            <View style={pg.recentIcon}>
                                                <Feather name="file-text" size={14} color="#64748b" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={pg.recentName} numberOfLines={1}>{rep.name}</Text>
                                                <Text style={pg.recentMeta}>{rep.date} • {rep.format}</Text>
                                            </View>
                                            <Feather name="download" size={14} color="#3b82f6" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </View>
        </View>
    );
};

const pg = StyleSheet.create({
    analyticsRow: { flexDirection: "row", gap: 16, marginBottom: 24, flexWrap: "wrap" },
    analyticsCard: { 
        flex: 1, 
        minWidth: 180, 
        backgroundColor: "#fff", 
        borderRadius: 16, 
        padding: 24, 
        flexDirection: "column", 
        alignItems: "center", 
        borderWidth: 1, 
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4
    },
    analyticsIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    analyticsLabel: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#64748b", textAlign: "center" },
    analyticsValue: { fontSize: 24, fontFamily: "Poppins_700Bold", color: "#0f172a", marginBottom: 4, textAlign: "center" },
    
    mainGrid: { flexDirection: "row", gap: 16 },
    sectionCard: { 
        backgroundColor: "#fff", 
        borderRadius: 16, 
        borderWidth: 1, 
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
        /* overflow visible for dropdowns */ 
    },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", zIndex: 100 },
    sectionTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: "#0f172a" },
    sectionSubtitle: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#64748b", marginTop: 2 },
    
    explorerFilter: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f8fafc", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" },
    explorerFilterText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#0f172a" },
    
    tableWrapper: { padding: 8 },
    tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", padding: 12, borderRadius: 8, marginBottom: 4 },
    tableHeadText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#94a3b8", letterSpacing: 0.5 },
    tableRow: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
    tableCellBold: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#0f172a" },
    tableCellSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#94a3b8" },
    tableCell: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#475569" },
    
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, alignSelf: "flex-start" },
    statusBadgeText: { fontSize: 11, fontFamily: "Poppins_700Bold" },
    
    viewAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
    viewAllText: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#3b82f6" },

    studioHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16 },
    studioHeaderTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#fff" },
    studioBody: { padding: 16 },
    studioLabel: { fontSize: 11, fontFamily: "Poppins_700Bold", color: "#94a3b8", letterSpacing: 1, marginBottom: 8 },
    dateInputs: { flexDirection: "row", gap: 8 },
    dateInputBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f8fafc", padding: 8, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" },
    dateTextInput: { flex: 1, fontSize: 13, fontFamily: "Poppins_400Regular", color: "#0f172a", outlineStyle: "none" },
    
    typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    typeBtn: { flex: 1, minWidth: "45%", paddingVertical: 8, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
    typeBtnActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
    typeBtnText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: "#64748b" },
    typeBtnTextActive: { color: "#3b82f6" },
    
    formatRow: { flexDirection: "row", gap: 8 },
    formatPill: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, backgroundColor: "#f1f5f9" },
    formatPillActive: { backgroundColor: "#0f172a" },
    formatPillText: { fontSize: 11, fontFamily: "Poppins_700Bold", color: "#64748b" },
    formatPillTextActive: { color: "#fff" },
    
    generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3b82f6", paddingVertical: 12, borderRadius: 12, marginTop: 16 },
    generateBtnText: { fontSize: 14, fontFamily: "Poppins_700Bold", color: "#fff" },
    
    dropdown: { 
        position: "absolute", 
        top: 40, 
        right: 0, 
        backgroundColor: "#fff", 
        borderRadius: 16, 
        borderWidth: 1, 
        borderColor: "#e2e8f0", 
        zIndex: 9999, 
        shadowColor: "#000", 
        shadowOpacity: 0.1, 
        shadowRadius: 8, 
        elevation: 10,
        width: 180 
    },
    dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
    dropdownItemText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#0f172a" },
    
    recentItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 16, backgroundColor: "#f8fafc" },
    recentIcon: { width: 28, height: 28, borderRadius: 6, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e2e8f0" },
    recentName: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#0f172a" },
    recentMeta: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#94a3b8" },
});

export default DataReportsPage;
