import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, Modal, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";

const AlertManagementPage = ({ onNavigate, onLogout, userRole = "lgu" }) => {
    const [alertType, setAlertType] = useState("advisory");
    const [selectedBarangays, setSelectedBarangays] = useState([]);
    const [alertMessage, setAlertMessage] = useState("");
    const [alertTitle, setAlertTitle] = useState("");
    const [recommendedAction, setRecommendedAction] = useState("");
    const [verifications, setVerifications] = useState([]);
    const [allReports, setAllReports] = useState([]);
    const [alertHistory, setAlertHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingVerifications, setLoadingVerifications] = useState(true);
    const [loadingAllReports, setLoadingAllReports] = useState(true);
    const [loadingAlertHistory, setLoadingAlertHistory] = useState(true);

    // Escalation Control State
    const [activeAlerts, setActiveAlerts] = useState([]);
    const [loadingActiveAlerts, setLoadingActiveAlerts] = useState(true);
    const [escalatingId, setEscalatingId] = useState(null);
    const [resolvingId, setResolvingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    
    // Delete Confirmation Modal State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [alertToDelete, setAlertToDelete] = useState(null);

    // Broadcast Card Flip State
    const [isBroadcastFlipped, setIsBroadcastFlipped] = useState(false);
    const broadcastFlipAnim = useRef(new Animated.Value(0)).current;

    // Verifications Card Flip State
    const [isVerificationsFlipped, setIsVerificationsFlipped] = useState(false);
    const verificationsFlipAnim = useRef(new Animated.Value(0)).current;

    // Hover States for Flip Buttons
    const [hoverBroadcastFront, setHoverBroadcastFront] = useState(false);
    const [hoverBroadcastBack, setHoverBroadcastBack] = useState(false);
    const [hoverVerificationsFront, setHoverVerificationsFront] = useState(false);
    const [hoverVerificationsBack, setHoverVerificationsBack] = useState(false);

    const flipBroadcastCard = () => {
        Animated.spring(broadcastFlipAnim, {
            toValue: isBroadcastFlipped ? 0 : 180,
            friction: 8,
            tension: 10,
            useNativeDriver: true,
        }).start();
        setIsBroadcastFlipped(!isBroadcastFlipped);
    };

    const flipVerificationsCard = () => {
        Animated.spring(verificationsFlipAnim, {
            toValue: isVerificationsFlipped ? 0 : 180,
            friction: 8,
            tension: 10,
            useNativeDriver: true,
        }).start();
        setIsVerificationsFlipped(!isVerificationsFlipped);
    };

    // Broadcast Interpolations
    const broadcastFrontRotate = broadcastFlipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ["0deg", "180deg"],
    });
    const broadcastBackRotate = broadcastFlipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ["180deg", "360deg"],
    });
    const broadcastFrontOpacity = broadcastFlipAnim.interpolate({
        inputRange: [89, 90],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });
    const broadcastBackOpacity = broadcastFlipAnim.interpolate({
        inputRange: [89, 90],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    // Verifications Interpolations
    const verificationsFrontRotate = verificationsFlipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ["0deg", "180deg"],
    });
    const verificationsBackRotate = verificationsFlipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ["180deg", "360deg"],
    });
    const verificationsFrontOpacity = verificationsFlipAnim.interpolate({
        inputRange: [89, 90],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });
    const verificationsBackOpacity = verificationsFlipAnim.interpolate({
        inputRange: [89, 90],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    useEffect(() => {
        fetchPendingReports();
        fetchAllReports();
        fetchAlertHistory();
        fetchActiveAlerts();
        const interval = setInterval(() => {
            fetchPendingReports();
            fetchAllReports();
            fetchAlertHistory();
            fetchActiveAlerts();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchActiveAlerts = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/alerts/?status=active`);
            const data = await response.json();
            setActiveAlerts(Array.isArray(data) ? data : []);
            setLoadingActiveAlerts(false);
        } catch (error) {
            console.error("Error fetching active alerts:", error);
            setLoadingActiveAlerts(false);
        }
    };

    const handleEscalate = async (alertId) => {
        setEscalatingId(alertId);
        try {
            const response = await fetch(`${API_BASE_URL}/api/subscriptions/escalate/${alertId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ escalated_by: 'admin' })
            });
            const data = await response.json();
            if (response.ok) {
                alert(`✅ Alert escalated: ${data.from_level} → ${data.to_level}`);
                fetchActiveAlerts();
                fetchAlertHistory();
            } else {
                alert(data.error || 'Failed to escalate alert.');
            }
        } catch (err) {
            alert('Network error while escalating.');
        } finally {
            setEscalatingId(null);
        }
    };

    const handleResolveAlert = async (alertId) => {
        setResolvingId(alertId);
        try {
            const response = await fetch(`${API_BASE_URL}/api/subscriptions/resolve/${alertId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolved_by: 'admin' })
            });
            const data = await response.json();
            if (response.ok) {
                alert('✅ Alert resolved successfully.');
                fetchActiveAlerts();
                fetchAlertHistory();
            } else {
                alert(data.error || 'Failed to resolve alert.');
            }
        } catch (err) {
            alert('Network error while resolving.');
        } finally {
            setResolvingId(null);
        }
    };

    const handleDeleteAlert = async (alertId, alertTitle) => {
        console.log("Delete button clicked for alert:", alertId, alertTitle);
        setAlertToDelete({ id: alertId, title: alertTitle });
        setShowDeleteConfirm(true);
    };

    const confirmDeleteAlert = async () => {
        if (!alertToDelete) return;
        
        console.log("Delete confirmed for alert:", alertToDelete.id);
        setDeletingId(alertToDelete.id);
        setShowDeleteConfirm(false);
        
        try {
            const deleteUrl = `${API_BASE_URL}/api/alerts/${alertToDelete.id}`;
            console.log("Sending DELETE request to:", deleteUrl);
            
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log("DELETE response status:", response.status);
            const responseData = await response.json();
            console.log("DELETE response data:", responseData);
            
            if (response.ok) {
                console.log("Alert deleted successfully, refreshing data...");
                alert('✅ Alert deleted successfully.');
                fetchActiveAlerts();
                fetchAlertHistory();
            } else {
                const errorMessage = responseData.error || 'Failed to delete alert. Status: ' + response.status;
                console.error("Delete failed:", errorMessage);
                alert('❌ ' + errorMessage);
            }
        } catch (err) {
            console.error('Error deleting alert:', err);
            alert('❌ Network error while deleting: ' + err.message);
        } finally {
            setDeletingId(null);
            setAlertToDelete(null);
        }
    };

    const fetchPendingReports = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/reports?status=pending`);
            const data = await response.json();
            setVerifications(data);
            setLoadingVerifications(false);
        } catch (error) {
            console.error("Error fetching pending reports:", error);
            setLoadingVerifications(false);
        }
    };

    const fetchAllReports = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/reports`);
            const data = await response.json();
            setAllReports(data);
            setLoadingAllReports(false);
        } catch (error) {
            console.error("Error fetching all reports:", error);
            setLoadingAllReports(false);
        }
    };

    const fetchAlertHistory = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/alerts/`);
            const data = await response.json();
            setAlertHistory(data);
            setLoadingAlertHistory(false);
        } catch (error) {
            console.error("Error fetching alert history:", error);
            setLoadingAlertHistory(false);
        }
    };

    const fetchSensorDataForBarangay = async (barangay) => {
        try {
            setLoadingSensorData(true);
            const response = await fetch(`${API_BASE_URL}/api/iot/sensor-by-location?location=${encodeURIComponent(barangay)}`);
            if (!response.ok) {
                console.warn("Sensor data not found for location:", barangay);
                setSensorDataForReport(null);
                setLoadingSensorData(false);
                return;
            }
            const data = await response.json();
            setSensorDataForReport(data);
            setLoadingSensorData(false);
        } catch (error) {
            console.error("Error fetching sensor data:", error);
            setSensorDataForReport(null);
            setLoadingSensorData(false);
        }
    };

    const getSensorConsistency = (reportedLevel, sensorLevel) => {
        if (!reportedLevel || !sensorLevel) return "UNKNOWN";
        
        const reportLow = ["ankle-high", "low", "light"].includes(reportedLevel?.toLowerCase());
        const reportMed = ["waist-high", "medium"].includes(reportedLevel?.toLowerCase());
        const reportHigh = ["chest-high", "high"].includes(reportedLevel?.toLowerCase());
        
        const sensorNum = parseInt(sensorLevel);
        const sensorLow = sensorNum < 20;
        const sensorMed = sensorNum >= 20 && sensorNum < 50;
        const sensorHigh = sensorNum >= 50;

        if ((reportLow && sensorLow) || (reportMed && sensorMed) || (reportHigh && sensorHigh)) {
            return { status: "MATCHING", color: "#16a34a", icon: "✓" };
        } else if (Math.abs((reportLow ? 15 : reportMed ? 35 : 70) - sensorNum) <= 20) {
            return { status: "SIMILAR", color: "#f59e0b", icon: "≈" };
        } else {
            return { status: "DIFFERENT", color: "#ef4444", icon: "✕" };
        }
    };

    const toggleBarangay = (barangay) => {
        if (barangay === "All Barangays") {
            if (selectedBarangays.includes("All Barangays")) {
                setSelectedBarangays([]);
            } else {
                setSelectedBarangays(["All Barangays", ...barangays.filter(b => b !== "All Barangays")]);
            }
        } else {
            let newSelected;
            if (selectedBarangays.includes(barangay)) {
                newSelected = selectedBarangays.filter((b) => b !== barangay);
                // Remove "All Barangays" if we uncheck one
                if (newSelected.includes("All Barangays")) {
                    newSelected = newSelected.filter(b => b !== "All Barangays");
                }
            } else {
                newSelected = [...selectedBarangays, barangay];
                // Check if all are selected (excluding "All Barangays" from the count check)
                const allOtherBarangays = barangays.filter(b => b !== "All Barangays");
                const isAllSelected = allOtherBarangays.every(b => newSelected.includes(b));
                if (isAllSelected) {
                    newSelected.push("All Barangays");
                }
            }
            setSelectedBarangays(newSelected);
        }
    };

    const handleBroadcast = async () => {
        if (!alertMessage || selectedBarangays.length === 0 || !alertTitle) {
            alert("Please fill in all fields (Title, Message, Barangays)");
            return;
        }

        setLoading(true);
        try {
            const barangayString = selectedBarangays.includes("All Barangays") ? "All" : selectedBarangays.join(", ");

            const response = await fetch(`${API_BASE_URL}/api/alerts/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: alertTitle,
                    description: alertMessage,
                    level: alertType,
                    barangay: barangayString,
                    recommended_action: recommendedAction
                }),
            });

            if (response.ok) {
                alert("Alert broadcasted successfully!");
                setAlertMessage("");
                setAlertTitle("");
                setRecommendedAction("");
                setSelectedBarangays([]);
                fetchAlertHistory(); // Refresh history list
            } else {
                alert("Failed to broadcast alert.");
            }
        } catch (error) {
            console.error("Error broadcasting alert:", error);
            alert("An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id, report) => {
        try {
            // Update report status to verified
            await fetch(`${API_BASE_URL}/api/reports/${id}/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    verified_by: localStorage.getItem("userName") || "Admin",
                    flood_level: report.flood_level_reported || "medium"
                })
            });

            // Auto-broadcast as official alert (already done by backend)
            alert("✅ Report verified and broadcasted as official alert!");
            setVerifications(verifications.filter((v) => v.id !== id));
            setShowReportDetailsModal(false);
            fetchPendingReports();
            fetchAllReports();
            fetchActiveAlerts();
        } catch (error) {
            console.error("Error verifying report:", error);
            alert("Error verifying report");
        }
    };

    const handleReject = async (id, report) => {
        try {
            // Update report status to dismissed
            await fetch(`${API_BASE_URL}/api/reports/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    rejected_by: localStorage.getItem("userName") || "Admin",
                    rejection_reason: "Report reviewed and determined to be inaccurate or false alarm"
                })
            });

            alert("✅ Report dismissed. Notification sent to reporter.");
            setVerifications(verifications.filter((v) => v.id !== id));
            setShowReportDetailsModal(false);
            fetchPendingReports();
            fetchAllReports();
        } catch (error) {
            console.error("Error rejecting report:", error);
            alert("Error dismissing report");
        }
    };

    const barangays = [
        "All Barangays",
        "Sitio Magtalisay",
        "Sitio Regla",
        "Sitio Sinulog",
        "Sitio Laray Holy Name",
        "Sitio San Vicente",
        "Sitio San Isidro",
        "Sitio Fatima",
        "Sitio Sindulan",
        "Sitio Lahing-Lahing (Uno and Dos)",
    ];

    const [activeTab, setActiveTab] = useState("operations");
    const [selectedReportForModal, setSelectedReportForModal] = useState(null);
    const [showReportDetailsModal, setShowReportDetailsModal] = useState(false);
    const [sensorDataForReport, setSensorDataForReport] = useState(null);
    const [loadingSensorData, setLoadingSensorData] = useState(false);

    const renderTabs = () => (
        <View style={styles.ccTabContainer}>
            <TouchableOpacity
                style={[styles.ccTab, activeTab === "operations" && styles.ccTabActive]}
                onPress={() => setActiveTab("operations")}
            >
                <Feather name="activity" size={18} color={activeTab === "operations" ? "#0f172a" : "#64748b"} />
                <Text style={[styles.ccTabText, activeTab === "operations" && styles.ccTabTextActive]}>Operations</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.ccTab, activeTab === "broadcast" && styles.ccTabActive]}
                onPress={() => setActiveTab("broadcast")}
            >
                <Feather name="send" size={18} color={activeTab === "broadcast" ? "#0f172a" : "#64748b"} />
                <Text style={[styles.ccTabText, activeTab === "broadcast" && styles.ccTabTextActive]}>Broadcast Studio</Text>
            </TouchableOpacity>

            {userRole === "super_admin" && (
                <TouchableOpacity
                    style={[styles.ccTab, activeTab === "audit" && styles.ccTabActive]}
                    onPress={() => setActiveTab("audit")}
                >
                    <Feather name="clipboard" size={18} color={activeTab === "audit" ? "#0f172a" : "#64748b"} />
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.ccTabText, activeTab === "audit" && styles.ccTabTextActive]}>Audit Log</Text>
                        <View style={styles.ccAuditBadge}>
                            <Text style={styles.ccAuditBadgeText}>PRO</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            )}
        </View>
    );

    const renderOperations = () => (
        <View style={styles.ccOpsGrid}>
            {/* Mission Control: Active Alerts */}
            <View style={styles.ccOpsLeft}>
                <View style={[styles.ccPanel, { flex: 1, marginBottom: 0, overflow: 'hidden' }]}>
                    <View style={styles.ccPanelHeader}>
                        <View>
                            <Text style={styles.ccPanelTitle}>Mission Control</Text>
                            <Text style={styles.ccPanelSubtitle}>Active emergency escalations</Text>
                        </View>
                        <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16 }}>
                            <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: '#b91c1c' }}>{activeAlerts.length} LIVE</Text>
                        </View>
                    </View>

                    {loadingActiveAlerts ? (
                        <ActivityIndicator size="small" color="#0f172a" />
                    ) : activeAlerts.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 64 }}>
                            <Feather name="shield" size={48} color="#16a34a" />
                            <Text style={{ color: '#64748b', marginTop: 16, fontSize: 14 }}>All clear. No active threats detected.</Text>
                        </View>
                    ) : (
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
                            {activeAlerts.map(a => {
                                const levelMap = {
                                    advisory: { label: 'ADVISORY', color: '#3b82f6', bg: '#eff6ff', progress: 0.25 },
                                    watch: { label: 'WATCH', color: '#f59e0b', bg: '#fffbeb', progress: 0.5 },
                                    warning: { label: 'WARNING', color: '#ef4444', bg: '#fef2f2', progress: 0.75 },
                                    critical: { label: 'CRITICAL', color: '#7f1d1d', bg: '#fee2e2', progress: 1.0 },
                                };
                                const meta = levelMap[a.level] || levelMap.advisory;
                                return (
                                    <View key={a.id} style={styles.ccAlertCard}>
                                        <View style={styles.ccAlertCardHeader}>
                                            <View style={[styles.ccAlertLevelBadge, { backgroundColor: meta.bg }]}>
                                                <Text style={[styles.ccAlertLevelText, { color: meta.color }]}>{meta.label}</Text>
                                            </View>
                                            <Text style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(a.timestamp).toLocaleTimeString()}</Text>
                                        </View>

                                        <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: '#0f172a' }}>{a.title}</Text>
                                        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Area: {a.barangay}</Text>

                                        <View style={styles.ccAlertProgressContainer}>
                                            <View style={[styles.ccAlertProgressBar, { width: `${meta.progress * 100}%`, backgroundColor: meta.color }]} />
                                        </View>

                                        <View style={styles.ccAlertActionRow}>
                                            <TouchableOpacity
                                                style={[styles.ccActionButton, { backgroundColor: '#f1f5f9' }]}
                                                onPress={() => handleResolveAlert(a.id)}
                                            >
                                                <Feather name="check-circle" size={16} color="#64748b" />
                                                <Text style={[styles.ccActionButtonText, { color: '#64748b' }]}>Resolve</Text>
                                            </TouchableOpacity>

                                            {a.level !== 'critical' && (
                                                <TouchableOpacity
                                                    style={[styles.ccActionButton, { backgroundColor: '#fee2e2' }]}
                                                    onPress={() => handleEscalate(a.id)}
                                                >
                                                    <Feather name="trending-up" size={16} color="#ef4444" />
                                                    <Text style={[styles.ccActionButtonText, { color: '#ef4444' }]}>Escalate</Text>
                                                </TouchableOpacity>
                                            )}

                                            <TouchableOpacity
                                                style={[styles.ccActionButton, { backgroundColor: '#fee2e2' }]}
                                                onPress={() => handleDeleteAlert(a.id, a.title)}
                                            >
                                                <Feather name="trash-2" size={16} color="#dc2626" />
                                                <Text style={[styles.ccActionButtonText, { color: '#dc2626' }]}>Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* Pending Verifications */}
            <View style={styles.ccOpsRight}>
                <View style={[styles.ccPanel, { flex: 1, marginBottom: 0, borderLeftWidth: 4, borderLeftColor: '#3b82f6', overflow: 'hidden' }]}>
                    <View style={styles.ccPanelHeader}>
                        <View>
                            <Text style={styles.ccPanelTitle}>Citizen Reports</Text>
                            <Text style={styles.ccPanelSubtitle}>Incoming field data</Text>
                        </View>
                        <Feather name="users" size={20} color="#3b82f6" />
                    </View>

                    {loadingVerifications ? (
                        <ActivityIndicator size="small" color="#3b82f6" />
                    ) : verifications.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <Feather name="check-square" size={32} color="#cbd5e1" />
                            <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 13 }}>No reports to verify</Text>
                        </View>
                    ) : (
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
                            {verifications.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={{ padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' }}
                                    onPress={() => {
                                        setSelectedReportForModal(item);
                                        setShowReportDetailsModal(true);
                                        fetchSensorDataForBarangay(item.location);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text style={{ fontSize: 12, color: '#3b82f6', fontFamily: "Poppins_700Bold" }}>{item.type.toUpperCase()}</Text>
                                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
                                    </View>
                                    <Text style={{ fontSize: 14, fontFamily: "Poppins_700Bold", color: '#1e293b' }}>{item.location}</Text>
                                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>"{item.description}"</Text>

                                    {item.image_url && (
                                        <View style={{ marginTop: 8, height: 80, backgroundColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                                            <Image
                                                source={{ uri: `${API_BASE_URL}${item.image_url}` }}
                                                style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                                            />
                                        </View>
                                    )}

                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                        <Feather name="eye" size={14} color="#3b82f6" style={{ marginRight: 4 }} />
                                        <Text style={{ fontSize: 12, color: '#3b82f6', fontFamily: "Poppins_600SemiBold" }}>Tap to review details</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </View>
    );

    const renderBroadcastStudio = () => (
        <View style={styles.ccBroadcastGrid}>
            <View style={styles.ccFormSection}>
                <View style={[styles.ccPanel, { flex: 1, marginBottom: 0, overflow: 'hidden' }]}>
                    <Text style={[styles.ccPanelTitle, { marginBottom: 16 }]}>Broadcast Alert Studio</Text>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.alertInputLabel}>Priority Level</Text>
                        <View style={styles.ccBrgyGrid}>
                            {['advisory', 'watch', 'warning'].map(level => (
                                <TouchableOpacity
                                    key={level}
                                    style={[
                                        styles.ccBrgyChip,
                                        alertType === level && { borderColor: level === 'advisory' ? '#3b82f6' : level === 'watch' ? '#f59e0b' : '#ef4444', backgroundColor: level === 'advisory' ? '#eff6ff' : level === 'watch' ? '#fffbeb' : '#fef2f2' }
                                    ]}
                                    onPress={() => setAlertType(level)}
                                >
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: level === 'advisory' ? '#3b82f6' : level === 'watch' ? '#f59e0b' : '#ef4444' }} />
                                    <Text style={[styles.ccBrgyChipText, alertType === level && { color: level === 'advisory' ? '#1d4ed8' : level === 'watch' ? '#b45309' : '#b91c1c', fontFamily: "Poppins_700Bold" }]}>
                                        {level.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.alertInputLabel}>Alert Headline</Text>
                        <TextInput
                            style={[styles.modalInput, { backgroundColor: '#f8fafc' }]}
                            placeholder="e.g. Critical Water Level Warning"
                            value={alertTitle}
                            onChangeText={setAlertTitle}
                        />
                    </View>

                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.alertInputLabel}>Dispatch Message</Text>
                        <TextInput
                            style={[styles.alertMessageInput, { backgroundColor: '#f8fafc', height: 120 }]}
                            placeholder="Provide clear instructions for affected residents..."
                            multiline
                            value={alertMessage}
                            onChangeText={setAlertMessage}
                        />
                    </View>

                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.alertInputLabel}>Recommended Action</Text>
                        <TextInput
                            style={[styles.alertMessageInput, { backgroundColor: '#f8fafc', height: 90 }]}
                            placeholder="e.g. Evacuate to the nearest evacuation center. Avoid flood-prone roads..."
                            multiline
                            value={recommendedAction}
                            onChangeText={setRecommendedAction}
                        />
                    </View>

                    <View style={{ marginBottom: 24 }}>
                        <Text style={styles.alertInputLabel}>Target Coverage</Text>
                        <View style={styles.ccBrgyGrid}>
                            {barangays.map(b => (
                                <TouchableOpacity
                                    key={b}
                                    style={[styles.ccBrgyChip, selectedBarangays.includes(b) && styles.ccBrgyChipActive]}
                                    onPress={() => toggleBarangay(b)}
                                >
                                    {selectedBarangays.includes(b) && <Feather name="check" size={14} color="#1d4ed8" />}
                                    <Text style={[styles.ccBrgyChipText, selectedBarangays.includes(b) && styles.ccBrgyChipTextActive]}>{b}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}
                        onPress={handleBroadcast}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator size="small" color="#fff" /> : (
                            <>
                                <Feather name="zap" size={20} color="#fff" />
                                <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Launch Broadcast</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>

            <View style={styles.ccHistorySection}>
                <View style={[styles.ccPanel, { flex: 1, marginBottom: 0, overflow: 'hidden' }]}>
                    <Text style={styles.ccPanelTitle}>Operational History</Text>
                    <Text style={styles.ccPanelSubtitle}>Review past broadcasts</Text>

                    <ScrollView style={{ marginTop: 16, flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
                        {alertHistory.map(item => (
                            <View key={item.id} style={{ paddingBottom: 16, marginBottom: 16, paddingRight: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: item.level === 'warning' ? '#ef4444' : '#64748b' }}>
                                                {item.level.toUpperCase()}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(item.timestamp).toLocaleDateString()}</Text>
                                        </View>
                                        <Text style={{ fontSize: 14, fontFamily: "Poppins_600SemiBold", color: '#1e293b' }}>{item.title}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }} numberOfLines={2}>{item.description}</Text>
                                    </View>
                                </View>
                                
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#fee2e2', borderRadius: 6, alignSelf: 'flex-start', marginTop: 8 }}
                                    onPress={() => handleDeleteAlert(item.id, item.title)}
                                >
                                    <Feather name="trash-2" size={14} color="#dc2626" />
                                    <Text style={{ fontSize: 11, fontFamily: "Poppins_600SemiBold", color: '#dc2626' }}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </View>
    );

    const renderAuditLog = () => (
        <View style={[styles.ccPanel, { flex: 1 }]}>
            <View style={styles.ccPanelHeader}>
                <View>
                    <Text style={styles.ccPanelTitle}>System Audit Log</Text>
                    <Text style={styles.ccPanelSubtitle}>Tracking all escalation events</Text>
                </View>
                <TouchableOpacity style={[styles.ccActionButton, { backgroundColor: '#f1f5f9' }]}>
                    <Feather name="download" size={16} color="#64748b" />
                    <Text style={styles.ccActionButtonText}>Export CSV</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, marginTop: 16 }} showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: '#f1f5f9', backgroundColor: '#f8fafc', paddingHorizontal: 12 }}>
                    <Text style={{ flex: 1, fontFamily: "Poppins_700Bold", color: '#64748b', fontSize: 12 }}>EVENT</Text>
                    <Text style={{ flex: 1, fontFamily: "Poppins_700Bold", color: '#64748b', fontSize: 12 }}>TRANSITION</Text>
                    <Text style={{ flex: 1, fontFamily: "Poppins_700Bold", color: '#64748b', fontSize: 12 }}>ACTOR</Text>
                    <Text style={{ flex: 1, fontFamily: "Poppins_700Bold", color: '#64748b', fontSize: 12 }}>TIMESTAMP</Text>
                </View>
                {/* Audit details would go here, fetching from /api/subscriptions/escalation-log/... */}
                <View style={{ alignItems: 'center', paddingVertical: 100 }}>
                    <Feather name="lock" size={48} color="#cbd5e1" />
                    <Text style={{ color: '#94a3b8', marginTop: 16 }}>Advanced auditing data available in production</Text>
                </View>
            </ScrollView>
        </View>
    );

    return (
        <View style={styles.dashboardRoot}>
            <AdminSidebar activePage="alert-management" onNavigate={onNavigate} onLogout={onLogout} variant={userRole} />

            <View style={styles.dashboardMain}>
                <View style={styles.ccHeader}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Command Center</Text>
                    </View>
                    <View style={styles.dashboardTopRight}>
                        <View style={styles.dashboardStatusPill}>
                            <View style={[styles.dashboardStatusDot, { backgroundColor: '#16a34a' }]} />
                            <Text style={styles.dashboardStatusText}>Mission Ready</Text>
                        </View>
                        <RealTimeClock style={styles.dashboardTopDate} />
                    </View>
                </View>

                {renderTabs()}

                <View style={{ flex: 1, overflow: 'hidden' }}>
                    {activeTab === "operations" && renderOperations()}
                    {activeTab === "broadcast" && renderBroadcastStudio()}
                    {activeTab === "audit" && renderAuditLog()}
                </View>
            </View>

            {/* Image Modal */}
            {/* Report Details Modal */}
            <Modal
                visible={showReportDetailsModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowReportDetailsModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%', overflow: 'hidden' }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {selectedReportForModal && (
                                <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                                    {/* Header */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <Text style={{ fontSize: 20, fontFamily: "Poppins_700Bold", color: '#1e293b' }}>Report Details</Text>
                                        <TouchableOpacity onPress={() => setShowReportDetailsModal(false)}>
                                            <Feather name="x" size={24} color="#64748b" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Original Report Section */}
                                    <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#3b82f6' }}>
                                        <Text style={{ fontSize: 12, fontFamily: "Poppins_700Bold", color: '#3b82f6', marginBottom: 8, letterSpacing: 1 }}>CITIZEN REPORT</Text>
                                        <Text style={{ fontSize: 14, fontFamily: "Poppins_700Bold", color: '#1e293b', marginBottom: 4 }}>
                                            {selectedReportForModal.type} - {selectedReportForModal.location}
                                        </Text>
                                        <Text style={{ fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 12 }}>
                                            {selectedReportForModal.description}
                                        </Text>
                                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                            <View>
                                                <Text style={{ fontSize: 11, color: '#94a3b8' }}>Reporter</Text>
                                                <Text style={{ fontSize: 12, fontFamily: "Poppins_600SemiBold", color: '#1e293b' }}>
                                                    {selectedReportForModal.reporter_name || 'Anonymous'}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 11, color: '#94a3b8' }}>Reported Level</Text>
                                                <Text style={{ fontSize: 12, fontFamily: "Poppins_600SemiBold", color: '#0f172a' }}>
                                                    {selectedReportForModal.flood_level_reported || 'Not specified'}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 11, color: '#94a3b8' }}>Time</Text>
                                                <Text style={{ fontSize: 12, fontFamily: "Poppins_600SemiBold", color: '#1e293b' }}>
                                                    {new Date(selectedReportForModal.timestamp).toLocaleTimeString()}
                                                </Text>
                                            </View>
                                        </View>

                                        {selectedReportForModal.image_url && (
                                            <Image
                                                source={{ uri: `${API_BASE_URL}${selectedReportForModal.image_url}` }}
                                                style={{ width: '100%', aspectRatio: 16/9, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: "#e2e8f0" }}
                                                resizeMode="contain"
                                            />
                                        )}
                                    </View>

                                    {/* Sensor Data Section */}
                                    {loadingSensorData ? (
                                        <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16, alignItems: 'center', justifyContent: 'center', height: 150 }}>
                                            <ActivityIndicator size="large" color="#3b82f6" />
                                            <Text style={{ marginTop: 8, color: '#64748b' }}>Loading sensor data...</Text>
                                        </View>
                                    ) : sensorDataForReport ? (
                                        <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#f59e0b' }}>
                                            <Text style={{ fontSize: 12, fontFamily: "Poppins_700Bold", color: '#f59e0b', marginBottom: 8, letterSpacing: 1 }}>SENSOR DATA</Text>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                                <View>
                                                    <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Sensor ID</Text>
                                                    <Text style={{ fontSize: 14, fontFamily: "Poppins_700Bold", color: '#1e293b' }}>
                                                        {sensorDataForReport.sensor_id || 'N/A'}
                                                    </Text>
                                                </View>
                                                <View>
                                                    <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Flood Level</Text>
                                                    <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: '#1e293b' }}>
                                                        {sensorDataForReport.flood_level}cm
                                                    </Text>
                                                </View>
                                                <View>
                                                    <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Status</Text>
                                                    <View style={{ backgroundColor: sensorDataForReport.status === 'ALARM' ? '#fee2e2' : sensorDataForReport.status === 'WARNING' ? '#fef3c7' : '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ fontSize: 12, fontFamily: "Poppins_700Bold", color: sensorDataForReport.status === 'ALARM' ? '#991b1b' : sensorDataForReport.status === 'WARNING' ? '#92400e' : '#166534' }}>
                                                            {sensorDataForReport.status}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Consistency Comparison */}
                                            {(() => {
                                                const consistency = getSensorConsistency(selectedReportForModal.flood_level_reported, sensorDataForReport.flood_level);
                                                return (
                                                    <View style={{ backgroundColor: consistency.color + '15', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: consistency.color + '40' }}>
                                                        <Text style={{ fontSize: 12, fontFamily: "Poppins_700Bold", color: consistency.color, marginBottom: 4 }}>
                                                            {consistency.icon} {consistency.status}
                                                        </Text>
                                                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                                                            {consistency.status === 'MATCHING' && 'Citizen report matches sensor reading - High confidence'}
                                                            {consistency.status === 'SIMILAR' && 'Citizen report is similar to sensor reading - Medium confidence'}
                                                            {consistency.status === 'DIFFERENT' && 'Citizen report differs from sensor reading - Review carefully'}
                                                        </Text>
                                                    </View>
                                                );
                                            })()}
                                        </View>
                                    ) : (
                                        <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16, alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
                                            <Feather name="alert-circle" size={32} color="#ef4444" />
                                            <Text style={{ marginTop: 8, color: '#ef4444', fontFamily: "Poppins_600SemiBold" }}>No sensor data available</Text>
                                        </View>
                                    )}

                                    {/* Action Buttons */}
                                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                        <TouchableOpacity
                                            style={{ flex: 1, paddingVertical: 12, backgroundColor: '#fee2e2', borderRadius: 8, alignItems: 'center' }}
                                            onPress={() => handleReject(selectedReportForModal.id, selectedReportForModal)}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Feather name="x-circle" size={16} color="#991b1b" />
                                                <Text style={{ fontSize: 14, fontFamily: "Poppins_700Bold", color: '#991b1b' }}>Dismiss Report</Text>
                                            </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={{ flex: 1, paddingVertical: 12, backgroundColor: '#dcfce7', borderRadius: 8, alignItems: 'center' }}
                                            onPress={() => handleVerify(selectedReportForModal.id, selectedReportForModal)}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Feather name="check-circle" size={16} color="#166534" />
                                                <Text style={{ fontSize: 14, fontFamily: "Poppins_700Bold", color: '#166534' }}>Verify & Broadcast</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteConfirm}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDeleteConfirm(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 24, maxWidth: 400, width: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }}>
                        <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: '#1e293b', marginBottom: 12 }}>Delete Alert</Text>
                        <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
                            Are you sure you want to delete this alert?{'\n\n'}
                            <Text style={{ fontFamily: "Poppins_600SemiBold", color: '#1e293b' }}>{alertToDelete?.title}</Text>
                        </Text>
                        
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center' }}
                                onPress={() => setShowDeleteConfirm(false)}
                            >
                                <Text style={{ fontSize: 14, fontFamily: "Poppins_600SemiBold", color: '#64748b' }}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 12, backgroundColor: '#dc2626', borderRadius: 8, alignItems: 'center' }}
                                onPress={() => confirmDeleteAlert()}
                            >
                                <Text style={{ fontSize: 14, fontFamily: "Poppins_600SemiBold", color: '#ffffff' }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default AlertManagementPage;
