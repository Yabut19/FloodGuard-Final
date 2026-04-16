import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Alert, TextInput, Image, Animated, Dimensions } from "react-native";
import { Feather, MaterialCommunityIcons, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";

const { width } = Dimensions.get("window");
const SIDEBAR_WIDTH = width > 1024 ? 360 : 300;

const VerifyAlertsPage = ({ onNavigate, onLogout, userRole = "lgu", currentUser = {} }) => {
    const [pendingReports, setPendingReports] = useState([]);
    const [sensorData, setSensorData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [showConfirmBroadcast, setShowConfirmBroadcast] = useState(false);
    const [verifyFloodLevel, setVerifyFloodLevel] = useState("medium");
    const [verifyNotes, setVerifyNotes] = useState("");
    const [submittingVerify, setSubmittingVerify] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [submittingReject, setSubmittingReject] = useState(false);

    const API_BASE = API_BASE_URL;

    // Fetch pending reports and sensor data
    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/reports/pending/with-sensor-data`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            setPendingReports(data.pending_reports || []);
            setSensorData(data.latest_sensor_data);
        } catch (error) {
            console.error("Failed to fetch reports:", error);
            Alert.alert("Error", "Failed to fetch pending reports");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const handleVerify = async () => {
        if (!selectedReport) return;

        try {
            setSubmittingVerify(true);
            const response = await fetch(`${API_BASE}/api/reports/${selectedReport.id}/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    verified_by: currentUser.email || currentUser.username || "Admin",
                    flood_level: verifyFloodLevel
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Verification failed");
            }

            Alert.alert("Success", "Report verified and broadcasted to all subscribers!");
            setShowVerifyModal(false);
            fetchData(); // Refresh the list
        } catch (error) {
            console.error("Verification error:", error);
            Alert.alert("Error", error.message);
        } finally {
            setSubmittingVerify(false);
        }
    };

    const handleReject = async () => {
        if (!selectedReport) return;

        try {
            setSubmittingReject(true);
            const response = await fetch(`${API_BASE}/api/reports/${selectedReport.id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rejected_by: currentUser.email || currentUser.username || "Admin",
                    rejection_reason: rejectReason || "False alarm/Duplicate"
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Rejection failed");
            }

            Alert.alert("Success", "Report dismissed from queue");
            setShowVerifyModal(false);
            fetchData(); // Refresh the list
        } catch (error) {
            console.error("Rejection error:", error);
            Alert.alert("Error", error.message);
        } finally {
            setSubmittingReject(false);
        }
    };

    const getFloodLevelColor = (level) => {
        switch (level?.toLowerCase()) {
            case "ankle-high":
            case "low":
                return "#16a34a";
            case "waist-high":
            case "medium":
                return "#f59e0b";
            case "chest-high":
            case "high":
                return "#ef4444";
            default:
                return "#64748b";
        }
    };

    const getSensorStatusColor = (status) => {
        switch (status?.toUpperCase()) {
            case "NORMAL":
                return "#16a34a";
            case "WARNING":
                return "#f59e0b";
            case "ALARM":
                return "#ef4444";
            default:
                return "#64748b";
        }
    };

    const calculateSimilarity = () => {
        if (!selectedReport || !sensorData) return null;

        const latDiff = Math.abs((selectedReport.latitude || 0) - (sensorData.latitude || 0));
        const lonDiff = Math.abs((selectedReport.longitude || 0) - (sensorData.longitude || 0));
        const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111;

        if (distance < 0.5 && selectedReport.type?.toLowerCase().includes("flood")) {
            return { text: "✓ MATCHING", color: "#16a34a", desc: "Report aligns with sensor data" };
        } else if (distance < 2) {
            return { text: "≈ NEARBY", color: "#f59e0b", desc: "Report location is near sensor" };
        } else {
            return { text: "∝ DISTANT", color: "#ef4444", desc: "Report location is far from sensor" };
        }
    };

    return (
        <View style={styles.dashboardRoot}>
            <AdminSidebar variant={userRole} activePage="verify-alerts" onNavigate={onNavigate} onLogout={onLogout} />

            <View style={styles.dashboardMain}>
                {/* ════════════════ TOP BAR ════════════════ */}
                <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Verify User Reports</Text>
                        <Text style={styles.dashboardTopSubtitle}>
                            Review & authorize community reports before public broadcast
                        </Text>
                    </View>
                    <View style={styles.dashboardTopRight}>
                        <View style={[styles.dashboardStatusPill, { backgroundColor: "rgba(249, 115, 22, 0.15)" }]}>
                            <View style={[styles.dashboardStatusDot, { backgroundColor: "#f59e0b" }]} />
                            <Text style={[styles.dashboardStatusText, { color: "#f59e0b" }]}>
                                {pendingReports.length} Pending
                            </Text>
                        </View>
                        <RealTimeClock style={styles.dashboardTopDate} />
                    </View>
                </View>

                {/* ════════════════ MAIN CONTENT ════════════════ */}
                <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                    {/* SECTION 1: Live Sensor Status Card */}
                    {sensorData ? (
                        <View
                            style={[
                                styles.dashboardPanel,
                                {
                                    marginBottom: 24,
                                    borderLeftWidth: 6,
                                    borderLeftColor: getSensorStatusColor(sensorData.status),
                                },
                            ]}
                        >
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 12, color: "#94a3b8", fontFamily: "Poppins_600SemiBold", letterSpacing: 1 }}>
                                        📡 LIVE SENSOR STATUS
                                    </Text>
                                    <Text style={{ fontSize: 18, color: "#0f172a", fontFamily: "Poppins_700Bold", marginTop: 4 }}>
                                        Sensor {sensorData.sensor_id}
                                    </Text>
                                </View>
                                <View
                                    style={{
                                        backgroundColor: getSensorStatusColor(sensorData.status) + "25",
                                        paddingHorizontal: 12,
                                        paddingVertical: 4,
                                        borderRadius: 16,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: getSensorStatusColor(sensorData.status),
                                            fontFamily: "Poppins_700Bold",
                                            fontSize: 11,
                                            letterSpacing: 0.5,
                                        }}
                                    >
                                        ● {sensorData.status?.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>Flood Level</Text>
                                    <Text style={{ color: "#0f172a", fontSize: 20, fontFamily: "Poppins_700Bold" }}>
                                        {sensorData.flood_level}
                                        <Text style={{ fontSize: 14 }}>cm</Text>
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>Raw Distance</Text>
                                    <Text style={{ color: "#0f172a", fontSize: 20, fontFamily: "Poppins_700Bold" }}>
                                        {sensorData.raw_distance}
                                        <Text style={{ fontSize: 14 }}>cm</Text>
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>Updated</Text>
                                    <Text style={{ color: "#0f172a", fontSize: 14, fontFamily: "Poppins_600SemiBold" }}>
                                        {new Date(sensorData.created_at).toLocaleTimeString()}
                                    </Text>
                                </View>
                            </View>

                            {sensorData.latitude && sensorData.longitude && (
                                <View style={{ backgroundColor: "#DDF6D2", padding: 8, borderRadius: 6, marginTop: 12 }}>
                                    <Text style={{ color: "#1a3d0a", fontSize: 12 }}>
                                        📍 {sensorData.latitude.toFixed(4)}°, {sensorData.longitude.toFixed(4)}°
                                    </Text>
                                </View>
                            )}
                        </View>
                    ) : null}

                    {/* SECTION 2: Verification Table Header */}
                    <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 16, color: "#0f172a", fontFamily: "Poppins_700Bold", marginBottom: 12 }}>
                            Pending Reports Queue
                        </Text>
                    </View>

                    {/* SECTION 3: Reports List or Empty State */}
                    {loading ? (
                        <View style={[styles.dashboardPanel, { alignItems: "center", paddingVertical: 64 }]}>
                            <ActivityIndicator size="large" color="#B0DB9C" />
                            <Text style={{ color: "#94a3b8", marginTop: 12, fontSize: 14 }}>Loading reports...</Text>
                        </View>
                    ) : pendingReports.length === 0 ? (
                        <View style={[styles.dashboardPanel, { alignItems: "center", paddingVertical: 64 }]}>
                            <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
                            <Text style={{ color: "#0f172a", marginTop: 12, fontSize: 16, fontFamily: "Poppins_600SemiBold" }}>
                                All reports verified! ✓
                            </Text>
                            <Text style={{ color: "#94a3b8", marginTop: 4, fontSize: 13 }}>
                                No pending reports at this moment.
                            </Text>
                        </View>
                    ) : (
                        <View>
                            {pendingReports.map((report, index) => (
                                <TouchableOpacity
                                    key={report.id}
                                    style={[
                                        styles.dashboardPanel,
                                        {
                                            marginBottom: 12,
                                            borderLeftWidth: 6,
                                            borderLeftColor: "#f59e0b",
                                            flexDirection: width > 1024 ? "row" : "column",
                                        },
                                    ]}
                                    onPress={() => {
                                        setSelectedReport(report);
                                        setShowVerifyModal(true);
                                        setVerifyFloodLevel("medium");
                                        setVerifyNotes("");
                                    }}
                                >
                                    {/* Left: Report Details */}
                                    <View style={{ flex: width > 1024 ? 2 : 1, marginRight: width > 1024 ? 16 : 0, marginBottom: width > 1024 ? 0 : 12 }}>
                                        {/* Row 1: Type & Location */}
                                        <View style={{ marginBottom: 12 }}>
                                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                                <View>
                                                    <Text style={{ fontSize: 11, color: "#f59e0b", fontFamily: "Poppins_700Bold", letterSpacing: 0.5 }}>
                                                        {report.type?.toUpperCase()}
                                                    </Text>
                                                    <Text style={{ fontSize: 16, color: "#0f172a", fontFamily: "Poppins_700Bold", marginTop: 4 }}>
                                                        {report.location}
                                                    </Text>
                                                </View>
                                                <View
                                                    style={{
                                                        backgroundColor: "#fef3c7",
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 4,
                                                        borderRadius: 999,
                                                    }}
                                                >
                                                    <Text style={{ color: "#92400e", fontFamily: "Poppins_700Bold", fontSize: 10, letterSpacing: 0.4 }}>
                                                        PENDING
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Row 2: Description */}
                                        <Text
                                            style={{ color: "#64748b", fontSize: 13, lineHeight: 18, marginBottom: 12 }}
                                            numberOfLines={2}
                                        >
                                            {report.description}
                                        </Text>

                                        {/* Row 3: Meta Info */}
                                        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                                            <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                <Text style={{ color: "#94a3b8", fontSize: 10 }}>Reporter</Text>
                                                <Text style={{ color: "#0f172a", fontSize: 12, fontFamily: "Poppins_600SemiBold" }}>
                                                    {report.reporter_name || "Anonymous"}
                                                </Text>
                                            </View>

                                            {report.flood_level_reported && (
                                                <View
                                                    style={{
                                                        backgroundColor: getFloodLevelColor(report.flood_level_reported) + "15",
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 4,
                                                        borderRadius: 6,
                                                    }}
                                                >
                                                    <Text style={{ color: "#94a3b8", fontSize: 10 }}>Reported Level</Text>
                                                    <Text
                                                        style={{
                                                            color: getFloodLevelColor(report.flood_level_reported),
                                                            fontSize: 12,
                                                            fontFamily: "Poppins_700Bold",
                                                            textTransform: "uppercase",
                                                        }}
                                                    >
                                                        {report.flood_level_reported}
                                                    </Text>
                                                </View>
                                            )}

                                            <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                <Text style={{ color: "#94a3b8", fontSize: 10 }}>Submitted</Text>
                                                <Text style={{ color: "#0f172a", fontSize: 12, fontFamily: "Poppins_600SemiBold" }}>
                                                    {new Date(report.timestamp).toLocaleTimeString()}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Image Preview */}
                                        {report.image_url && (
                                            <Image
                                                source={{ uri: `${API_BASE}${report.image_url}` }}
                                                style={{ width: "100%", aspectRatio: 16/9, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: "#e2e8f0" }}
                                                resizeMode="contain"
                                            />
                                        )}
                                    </View>

                                    {/* Right: Action Buttons (Vertical Stack) */}
                                    <View
                                        style={{
                                            flex: width > 1024 ? 1 : 1,
                                            justifyContent: "space-between",
                                            gap: width > 1024 ? 8 : 12,
                                        }}
                                    >
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: "#16a34a",
                                                paddingVertical: 12,
                                                paddingHorizontal: 16,
                                                borderRadius: 8,
                                                alignItems: "center",
                                                flex: 1,
                                            }}
                                            onPress={() => {
                                                setSelectedReport(report);
                                                setShowVerifyModal(true);
                                                setVerifyFloodLevel("medium");
                                                setVerifyNotes("");
                                            }}
                                        >
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                                <Feather name="check" size={16} color="#ffffff" />
                                                <Text style={{ color: "#ffffff", fontFamily: "Poppins_700Bold", fontSize: 12 }}>Verify</Text>
                                            </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: "#ef444420",
                                                paddingVertical: 12,
                                                paddingHorizontal: 16,
                                                borderRadius: 8,
                                                alignItems: "center",
                                                flex: 1,
                                                borderWidth: 1,
                                                borderColor: "#ef4444",
                                            }}
                                            onPress={() => {
                                                setSelectedReport(report);
                                                setRejectReason("");
                                                Alert.alert(
                                                    "Dismiss Report?",
                                                    `Are you sure you want to dismiss this report from ${report.reporter_name}?`,
                                                    [
                                                        { text: "Cancel", onPress: () => {} },
                                                        { text: "Dismiss", onPress: handleReject, style: "destructive" },
                                                    ]
                                                );
                                            }}
                                        >
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                                <Feather name="x" size={16} color="#ef4444" />
                                                <Text style={{ color: "#ef4444", fontFamily: "Poppins_700Bold", fontSize: 12 }}>Dismiss</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* ════════════════ VERIFICATION MODAL ════════════════ */}
            <Modal visible={showVerifyModal} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", paddingHorizontal: 24 }}>
                    <View
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 16,
                            maxHeight: "90%",
                            overflow: "hidden",
                        }}
                    >
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Modal Header */}
                            <View
                                style={{
                                    backgroundColor: "#B0DB9C",
                                    paddingHorizontal: 24,
                                    paddingVertical: 16,
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <Text style={{ fontSize: 20, color: "#1a3d0a", fontFamily: "Poppins_700Bold" }}>
                                    Verify Report
                                </Text>
                                <TouchableOpacity onPress={() => setShowVerifyModal(false)}>
                                    <Feather name="x" size={24} color="#1a3d0a" />
                                </TouchableOpacity>
                            </View>

                            {selectedReport && (
                                <View style={{ padding: 24 }}>
                                    {/* SECTION A: User's Original Report */}
                                    <View style={{ marginBottom: 24 }}>
                                        <Text style={{ fontSize: 12, color: "#94a3b8", fontFamily: "Poppins_700Bold", letterSpacing: 1, marginBottom: 12 }}>
                                            📝 USER REPORT
                                        </Text>
                                        <View style={[styles.dashboardPanel, { marginTop: 0, borderLeftWidth: 6, borderLeftColor: "#f59e0b" }]}>
                                            <Text style={{ fontSize: 14, color: "#0f172a", fontFamily: "Poppins_700Bold", marginBottom: 4 }}>
                                                {selectedReport.type} at {selectedReport.location}
                                            </Text>
                                            <Text style={{ color: "#64748b", fontSize: 13, lineHeight: 18, marginBottom: 8 }}>
                                                {selectedReport.description}
                                            </Text>
                                            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                                                <View>
                                                    <Text style={{ color: "#94a3b8", fontSize: 11 }}>Reporter</Text>
                                                    <Text style={{ color: "#0f172a", fontFamily: "Poppins_600SemiBold" }}>
                                                        {selectedReport.reporter_name}
                                                    </Text>
                                                    {selectedReport.reporter_email && (
                                                        <Text style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>
                                                            {selectedReport.reporter_email}
                                                        </Text>
                                                    )}
                                                </View>
                                                <View>
                                                    <Text style={{ color: "#94a3b8", fontSize: 11 }}>Submitted</Text>
                                                    <Text style={{ color: "#0f172a", fontFamily: "Poppins_600SemiBold" }}>
                                                        {new Date(selectedReport.timestamp).toLocaleTimeString()}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Image Display */}
                                            {selectedReport.image_url && (
                                                <View style={{ marginTop: 12 }}>
                                                    <Text style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>📷 ATTACHED IMAGE</Text>
                                                    <Image
                                                        source={{ uri: `${API_BASE}${selectedReport.image_url}` }}
                                                        style={{
                                                            width: "100%",
                                                            aspectRatio: 16/9,
                                                            borderRadius: 8,
                                                            borderWidth: 1,
                                                            borderColor: "#e2e8f0",
                                                            backgroundColor: "#f8fafc"
                                                        }}
                                                        resizeMode="contain"
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* SECTION B: Sensor Comparison */}
                                    {sensorData && (
                                        <View style={{ marginBottom: 24 }}>
                                            <Text style={{ fontSize: 12, color: "#94a3b8", fontFamily: "Poppins_700Bold", letterSpacing: 1, marginBottom: 12 }}>
                                                📡 SENSOR COMPARISON
                                            </Text>
                                            <View style={[styles.dashboardPanel, { marginTop: 0, borderLeftWidth: 6, borderLeftColor: getSensorStatusColor(sensorData.status) }]}>
                                                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                                                    <View>
                                                        <Text style={{ color: "#94a3b8", fontSize: 11 }}>Sensor Status</Text>
                                                        <Text
                                                            style={{
                                                                color: getSensorStatusColor(sensorData.status),
                                                                fontSize: 16,
                                                                fontFamily: "Poppins_700Bold",
                                                                textTransform: "uppercase",
                                                            }}
                                                        >
                                                            {sensorData.status}
                                                        </Text>
                                                    </View>
                                                    <View>
                                                        <Text style={{ color: "#94a3b8", fontSize: 11, textAlign: "right" }}>Flood Level</Text>
                                                        <Text style={{ color: "#0f172a", fontSize: 20, fontFamily: "Poppins_700Bold", textAlign: "right" }}>
                                                            {sensorData.flood_level}cm
                                                        </Text>
                                                    </View>
                                                </View>

                                                {(() => {
                                                    const similarity = calculateSimilarity();
                                                    return similarity ? (
                                                        <View
                                                            style={{
                                                                backgroundColor: similarity.color + "15",
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 8,
                                                                borderRadius: 8,
                                                                borderWidth: 1,
                                                                borderColor: similarity.color + "40",
                                                            }}
                                                        >
                                                            <Text style={{ color: similarity.color, fontFamily: "Poppins_700Bold", fontSize: 12 }}>
                                                                {similarity.text}
                                                            </Text>
                                                            <Text style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
                                                                {similarity.desc}
                                                            </Text>
                                                        </View>
                                                    ) : null;
                                                })()}
                                            </View>
                                        </View>
                                    )}

                                    {/* SECTION C: Official Verification */}
                                    <View style={{ marginBottom: 24 }}>
                                        <Text style={{ fontSize: 12, color: "#94a3b8", fontFamily: "Poppins_700Bold", letterSpacing: 1, marginBottom: 12 }}>
                                            ✓ OFFICIAL VERIFICATION
                                        </Text>

                                        {/* Flood Level Selection */}
                                        <View style={{ marginBottom: 16 }}>
                                            <Text style={{ color: "#0f172a", fontFamily: "Poppins_600SemiBold", marginBottom: 8 }}>
                                                Declare Official Flood Level:
                                            </Text>
                                            <View style={{ flexDirection: "row", gap: 8 }}>
                                                {[
                                                    { level: "low", label: "Low", color: "#16a34a" },
                                                    { level: "medium", label: "Medium", color: "#f59e0b" },
                                                    { level: "high", label: "High", color: "#ef4444" },
                                                ].map(({ level, label, color }) => (
                                                    <TouchableOpacity
                                                        key={level}
                                                        onPress={() => setVerifyFloodLevel(level)}
                                                        style={{
                                                            flex: 1,
                                                            paddingVertical: 12,
                                                            borderRadius: 8,
                                                            alignItems: "center",
                                                            backgroundColor: verifyFloodLevel === level ? color + "20" : "#f1f5f9",
                                                            borderWidth: verifyFloodLevel === level ? 2 : 1,
                                                            borderColor: verifyFloodLevel === level ? color : "#DDF6D2",
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: verifyFloodLevel === level ? color : "#94a3b8",
                                                                fontFamily: verifyFloodLevel === level ? "Poppins_700Bold" : "Poppins_600SemiBold",
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            {label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>

                                        {/* Notes */}
                                        <View>
                                            <Text style={{ color: "#0f172a", fontFamily: "Poppins_600SemiBold", marginBottom: 8 }}>
                                                Verification Notes (Optional):
                                            </Text>
                                            <TextInput
                                                style={{
                                                    backgroundColor: "#f1f5f9",
                                                    color: "#0f172a",
                                                    borderRadius: 8,
                                                    padding: 12,
                                                    borderWidth: 1,
                                                    borderColor: "#DDF6D2",
                                                    minHeight: 80,
                                                    textAlignVertical: "top",
                                                    fontFamily: "Poppins_400Regular",
                                                }}
                                                placeholder="Why are you verifying this? Any cross-checks done?"
                                                placeholderTextColor="#94a3b8"
                                                value={verifyNotes}
                                                onChangeText={setVerifyNotes}
                                                multiline
                                            />
                                        </View>
                                    </View>

                                    {/* SECTION D: Audit Info */}
                                    <View style={[styles.dashboardPanel, { marginBottom: 24, backgroundColor: "#EFF9E8" }]}>
                                        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                                            <Feather name="info" size={16} color="#1a3d0a" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: "#1a3d0a", fontFamily: "Poppins_700Bold", marginBottom: 4 }}>
                                                    Audit Information
                                                </Text>
                                                <Text style={{ color: "#365314", fontSize: 13 }}>
                                                    This verification will be logged and attributed to{" "}
                                                    <Text style={{ fontFamily: "Poppins_600SemiBold" }}>
                                                        {currentUser.email || currentUser.username || "Admin"}
                                                    </Text>
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* ACTION BUTTONS */}
                                    <View style={{ flexDirection: "row", gap: 12 }}>
                                        <TouchableOpacity
                                            style={{
                                                flex: 1,
                                                backgroundColor: "#ef444420",
                                                paddingVertical: 12,
                                                borderRadius: 8,
                                                alignItems: "center",
                                                borderWidth: 1,
                                                borderColor: "#ef4444",
                                            }}
                                            onPress={() => {
                                                setShowVerifyModal(false);
                                                Alert.alert(
                                                    "Dismiss Report?",
                                                    "This report will be removed from the verification queue and marked as dismissed.",
                                                    [
                                                        { text: "Cancel", onPress: () => {} },
                                                        {
                                                            text: "Dismiss",
                                                            onPress: handleReject,
                                                            style: "destructive",
                                                        },
                                                    ]
                                                );
                                            }}
                                            disabled={submittingReject}
                                        >
                                            <Text style={{ color: "#ef4444", fontFamily: "Poppins_700Bold", fontSize: 14 }}>
                                                {submittingReject ? "Dismissing..." : "Dismiss"}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={{
                                                flex: 1,
                                                backgroundColor: "#16a34a",
                                                paddingVertical: 12,
                                                borderRadius: 8,
                                                alignItems: "center",
                                            }}
                                            onPress={() => {
                                                setShowVerifyModal(false);
                                                setShowConfirmBroadcast(true);
                                            }}
                                            disabled={submittingVerify}
                                        >
                                            <Text style={{ color: "#ffffff", fontFamily: "Poppins_700Bold", fontSize: 14 }}>
                                                {submittingVerify ? "Broadcasting..." : "Verify & Broadcast"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ════════════════ CONFIRMATION MODAL ════════════════ */}
            <Modal visible={showConfirmBroadcast} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", paddingHorizontal: 24 }}>
                    <View style={{ backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden" }}>
                        {/* Confirmation Header */}
                        <View style={{ backgroundColor: "#16a34a", paddingHorizontal: 24, paddingVertical: 16 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                <MaterialIcons name="check-circle" size={32} color="#ffffff" />
                                <Text style={{ fontSize: 18, color: "#ffffff", fontFamily: "Poppins_700Bold", flex: 1 }}>
                                    Broadcast Alert?
                                </Text>
                            </View>
                        </View>

                        {/* Confirmation Body */}
                        <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                            <Text style={{ color: "#0f172a", fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                                You are about to broadcast this alert to{" "}
                                <Text style={{ fontFamily: "Poppins_700Bold" }}>all subscribers</Text> in the{" "}
                                <Text style={{ fontFamily: "Poppins_700Bold" }}>{selectedReport?.location}</Text> area.
                            </Text>
                            <View
                                style={{
                                    backgroundColor: "#EFF9E8",
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    marginBottom: 16,
                                }}
                            >
                                <Text style={{ color: "#1a3d0a", fontSize: 12 }}>
                                    <Text style={{ fontFamily: "Poppins_700Bold" }}>Alert Level:</Text> {verifyFloodLevel.toUpperCase()}
                                </Text>
                                <Text style={{ color: "#365314", fontSize: 12, marginTop: 4 }}>
                                    Subscribers will receive notifications immediately.
                                </Text>
                            </View>

                            {/* Confirmation Buttons */}
                            <View style={{ flexDirection: "row", gap: 12 }}>
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        paddingVertical: 12,
                                        borderRadius: 8,
                                        alignItems: "center",
                                        backgroundColor: "#f1f5f9",
                                    }}
                                    onPress={() => setShowConfirmBroadcast(false)}
                                >
                                    <Text style={{ color: "#0f172a", fontFamily: "Poppins_600SemiBold" }}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        paddingVertical: 12,
                                        borderRadius: 8,
                                        alignItems: "center",
                                        backgroundColor: "#16a34a",
                                    }}
                                    onPress={() => {
                                        setShowConfirmBroadcast(false);
                                        handleVerify();
                                    }}
                                    disabled={submittingVerify}
                                >
                                    <Text style={{ color: "#ffffff", fontFamily: "Poppins_700Bold" }}>
                                        {submittingVerify ? "Broadcasting..." : "Yes, Broadcast"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default VerifyAlertsPage;