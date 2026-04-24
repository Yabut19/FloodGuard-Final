import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, Modal, Animated } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";
import { formatPST, getSystemStatus, getSystemStatusColor } from "../utils/dateUtils";
import { authFetch } from "../utils/helpers";
import useDataSync from "../utils/useDataSync";
import dialogs from "../utils/dialogs";
import TopRightStatusIndicator from "../components/TopRightStatusIndicator";

const AlertManagementPage = ({ onNavigate, onLogout, userRole = "lgu" }) => {
    const [alertType, setAlertType] = useState("advisory");
    const [selectedBarangays, setSelectedBarangays] = useState([]);
    const [alertTitle, setAlertTitle] = useState("");
    const [recommendedAction, setRecommendedAction] = useState("");
    
    // Verification state
    const [verifyFloodLevel, setVerifyFloodLevel] = useState("medium");
    const [incidentStatus, setIncidentStatus] = useState("");
    const [statusError, setStatusError] = useState(false);
    const [verifications, setVerifications] = useState([]);
    const [filterType, setFilterType] = useState('All Alerts');
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [evacuationStatus, setEvacuationStatus] = useState('open');
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
    const [deletingId, setDeletingId] = useState(null);
    
    // Alert Details Modal State
    const [showAlertDetailsModal, setShowAlertDetailsModal] = useState(false);
    const [selectedAlertForModal, setSelectedAlertForModal] = useState(null);
    const [onlineSensors, setOnlineSensors] = useState(0);
    

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
        fetchActiveAlerts();
        fetchPendingReports();
        fetchAllReports();
        fetchAlertHistory();
        fetchSystemStatus();

        const interval = setInterval(fetchSystemStatus, 30000);

        return () => clearInterval(interval);
    }, []);

    // ── Real-time Data Synchronization ──
    useDataSync({
        onAlertUpdate: () => {
            console.log("[AlertManagement] Alerts changed, refreshing...");
            fetchActiveAlerts();
            fetchAlertHistory();
        },
        onReportUpdate: () => {
            console.log("[AlertManagement] Reports changed, refreshing...");
            fetchPendingReports();
            fetchAllReports();
        },
        onSensorUpdate: (reading) => {
            // Optional: update status if needed
        }
    });

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
            const response = await authFetch(`${API_BASE_URL}/api/subscriptions/escalate/${alertId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ escalated_by: 'admin' })
            });
            const data = await response.json();
            if (response.ok) {
                dialogs.success('Escalated', `✅ Alert escalated: ${data.from_level} → ${data.to_level}`);
                fetchActiveAlerts();
                fetchAlertHistory();
            } else {
                dialogs.error('Error', data.error || 'Failed to escalate alert.');
            }
        } catch (err) {
            dialogs.error('Network Error', 'Network error while escalating.');
        } finally {
            setEscalatingId(null);
        }
    };



    const handleDeleteAlert = async (alertId, alertTitle) => {
        const result = await dialogs.confirm(
            "Delete Alert", 
            `Are you sure you want to delete this alert?<br/><br/><b style="color: #0f172a; font-size: 18px;">${alertTitle}</b>`
        );
        
        if (result.isConfirmed) {
            setDeletingId(alertId);
            try {
                const deleteUrl = `${API_BASE_URL}/api/alerts/${alertId}`;
                const response = await authFetch(deleteUrl, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const responseData = await response.json();
                if (response.ok) {
                    dialogs.success('Deleted', 'Alert deleted successfully.');
                    fetchActiveAlerts();
                    fetchAlertHistory();
                } else {
                    dialogs.error('Error', responseData.error || 'Failed to delete alert.');
                }
            } catch (err) {
                dialogs.error('Network Error', 'Network error while deleting: ' + err.message);
            } finally {
                setDeletingId(null);
            }
        }
    };

    const fetchPendingReports = async () => {
        try {
            const response = await authFetch(`${API_BASE_URL}/api/reports/?status=pending`);
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
            const response = await authFetch(`${API_BASE_URL}/api/reports/`);
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
            const response = await authFetch(`${API_BASE_URL}/api/alerts/`);
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
            const response = await authFetch(`${API_BASE_URL}/api/iot/sensor-by-location?location=${encodeURIComponent(barangay)}`);
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
            setSensorDataForReport(null);
            setLoadingSensorData(false);
        }
    };

    const fetchSystemStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/api/iot/sensors/status-all`);
            if (res.ok) {
                const data = await res.json();
                const online = data.filter(s => !s.is_offline).length;
                setOnlineSensors(online);
            }
        } catch (e) {
            console.error("Status fetch error:", e);
        }
    };

    const getSensorConsistency = (reportedLevel, sensorLevel) => {
        if (!reportedLevel || !sensorLevel) return "UNKNOWN";
        
        const reportAdv = ["ankle-high", "low", "light", "advisory"].includes(reportedLevel?.toLowerCase());
        const reportWarn = ["waist-high", "medium", "warning"].includes(reportedLevel?.toLowerCase());
        const reportCrit = ["chest-high", "high", "critical", "alarm"].includes(reportedLevel?.toLowerCase());
        
        const sensorNum = parseInt(sensorLevel);
        const sensorAdv = sensorNum < 20;
        const sensorWarn = sensorNum >= 20 && sensorNum < 50;
        const sensorCrit = sensorNum >= 50;

        if ((reportAdv && sensorAdv) || (reportWarn && sensorWarn) || (reportCrit && sensorCrit)) {
            return { status: "MATCHING", color: "#16a34a", icon: "✓" };
        } else if (Math.abs((reportAdv ? 15 : reportWarn ? 35 : 70) - sensorNum) <= 20) {
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
        if (selectedBarangays.length === 0 || !alertTitle) {
            dialogs.alert("Validation", "Please fill in all fields (Title, Barangays)", 'warning');
            return;
        }

        setLoading(true);
        try {
            const barangayString = selectedBarangays.includes("All Barangays") ? "All" : selectedBarangays.join(", ");

            const response = await authFetch(`${API_BASE_URL}/api/alerts/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: alertTitle,
                    description: "", // Removed Dispatch Message
                    level: alertType,
                    barangay: barangayString,
                    recommended_action: recommendedAction,
                    source: 'manual',
                    evacuation_status: evacuationStatus
                }),
            });

            if (response.ok) {
                dialogs.success("Success", "Alert broadcasted successfully!");
                setAlertTitle("");
                setSelectedBarangays([]);
                fetchAlertHistory(); // Refresh history list
                fetchActiveAlerts(); // Refresh Mission Control active alerts
            } else {
                dialogs.error("Failed", "Failed to broadcast alert.");
            }
        } catch (error) {
            console.error("Error broadcasting alert:", error);
            dialogs.error("Error", "An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id, report) => {
        let hasError = false;
        
        if (!recommendedAction || !recommendedAction.trim()) {
            setRecError(true);
            hasError = true;
        } else {
            setRecError(false);
        }
        
        if (!incidentStatus) {
            setStatusError(true);
            hasError = true;
        } else {
            setStatusError(false);
        }

        if (hasError) return;
        
        try {
            // Update report status to verified
            const response = await authFetch(`${API_BASE_URL}/api/reports/${id}/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    verified_by: localStorage.getItem("userName") || "Admin",
                    flood_level: verifyFloodLevel,
                    recommendations: recommendedAction,
                    recommended_action: recommendedAction,
                    report_status: incidentStatus,
                    source: 'report'
                })
            });

            if (!response.ok) {
                const err = await response.json();
                dialogs.error("Error", (err.error || "Verification failed"));
                return;
            }

            // Auto-broadcast as official alert (already done by backend)
            dialogs.success("Verified", "✅ Report verified and broadcasted as official alert!");
            setVerifications(verifications.filter((v) => v.id !== id));
            setShowReportDetailsModal(false);
            setRecommendedAction("");
            fetchPendingReports();
            fetchAllReports();
            fetchActiveAlerts();
        } catch (error) {
            console.error("Error verifying report:", error);
            dialogs.error("Error", "Error verifying report");
        }
    };

    const handleReject = async (id, report) => {
        try {
            // Update report status to dismissed
            await authFetch(`${API_BASE_URL}/api/reports/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    rejected_by: localStorage.getItem("userName") || "Admin",
                    rejection_reason: "Report reviewed and determined to be inaccurate or false alarm"
                })
            });

            dialogs.success("Dismissed", "✅ Report dismissed. Notification sent to reporter.");
            setVerifications(verifications.filter((v) => v.id !== id));
            setShowReportDetailsModal(false);
            fetchPendingReports();
            fetchAllReports();
        } catch (error) {
            console.error("Error rejecting report:", error);
            dialogs.error("Error", "Error dismissing report");
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
    const [recError, setRecError] = useState(false);

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
                <View style={[styles.ccPanel, { flex: 1, marginBottom: 0, overflow: 'visible' }]}>
                    <View style={[styles.ccPanelHeader, { zIndex: 1001 }]}>
                        <View>
                            <Text style={styles.ccPanelTitle}>Mission Control</Text>
                            <Text style={styles.ccPanelSubtitle}>Active emergency escalations</Text>
                        </View>
                        <View style={{ position: 'relative', zIndex: 1000 }}>
                            <TouchableOpacity 
                                style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    gap: 8, 
                                    backgroundColor: '#f1f5f9', 
                                    paddingHorizontal: 12, 
                                    paddingVertical: 6, 
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: '#e2e8f0'
                                }}
                                onPress={() => setShowFilterDropdown(!showFilterDropdown)}
                            >
                                <Feather name="filter" size={14} color="#475569" />
                                <Text style={{ fontSize: 12, fontFamily: "Poppins_600SemiBold", color: '#475569' }}>{filterType}</Text>
                                <Feather name={showFilterDropdown ? "chevron-up" : "chevron-down"} size={14} color="#475569" />
                            </TouchableOpacity>

                            {showFilterDropdown && (
                                <View style={{ 
                                    position: 'absolute', 
                                    top: 38, 
                                    right: 0, 
                                    backgroundColor: '#ffffff', 
                                    borderRadius: 12, 
                                    width: 160, 
                                    shadowColor: '#000', 
                                    shadowOffset: { width: 0, height: 4 }, 
                                    shadowOpacity: 0.1, 
                                    shadowRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#f1f5f9',
                                    zIndex: 1000,
                                    padding: 4
                                }}>
                                    {['All Alerts', 'Advisory', 'Warning', 'Critical', 'Reports', 'Evacuation'].map((type) => (
                                        <TouchableOpacity
                                            key={type}
                                            style={{ 
                                                paddingVertical: 8, 
                                                paddingHorizontal: 12, 
                                                borderRadius: 8,
                                                backgroundColor: filterType === type ? '#f8fafc' : 'transparent'
                                            }}
                                            onPress={() => {
                                                setFilterType(type);
                                                setShowFilterDropdown(false);
                                            }}
                                        >
                                            <Text style={{ 
                                                fontSize: 12, 
                                                fontFamily: filterType === type ? "Poppins_700Bold" : "Poppins_400Regular",
                                                color: filterType === type ? '#0f172a' : '#64748b'
                                            }}>{type}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>

                    {loadingActiveAlerts ? (
                        <ActivityIndicator size="small" color="#0f172a" />
                    ) : activeAlerts.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 64 }}>
                            <Feather name="shield" size={48} color="#16a34a" />
                            <Text style={{ color: '#64748b', marginTop: 16, fontSize: 14 }}>All clear. No active threats detected.</Text>
                        </View>
                    ) : (() => {
                        const filteredAlerts = activeAlerts.filter(a => {
                            if (!a) return false;
                            const lvl = a.level?.toLowerCase();
                            if (filterType === 'All Alerts') return true;
                            if (filterType === 'Advisory') return lvl === 'advisory';
                            if (filterType === 'Warning') return lvl === 'warning';
                            if (filterType === 'Critical') return lvl === 'critical';
                            if (filterType === 'Evacuation') return lvl === 'evacuation';
                            if (filterType === 'Reports') return a.source === 'report';
                            return true;
                        });

                        return (
                            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
                                {filteredAlerts.length > 0 ? (
                                    filteredAlerts.map((a, idx) => {
                                        const levelMap = {
                                            advisory: { label: 'ADVISORY', color: '#3b82f6', bg: '#eff6ff', progress: 0.33 },
                                            warning: { label: 'WARNING', color: '#f97316', bg: '#fff7ed', progress: 0.66 },
                                            critical: { label: 'CRITICAL', color: '#dc2626', bg: '#fef2f2', progress: 1.0 },
                                            evacuation: { label: 'EVACUATION', color: '#1e3a8a', bg: '#dbeafe', progress: 0.5 },
                                        };
                                        const meta = levelMap[a.level?.toLowerCase()] || levelMap.advisory;
                                        const isEvac = a.level?.toLowerCase() === 'evacuation';
                                        
                                        return (
                                            <TouchableOpacity 
                                                key={a.id || `alert-${idx}`} 
                                                style={[styles.ccAlertCard, { borderLeftWidth: 8, borderLeftColor: meta.color }]}
                                                onPress={() => {
                                                    if (a) {
                                                        setSelectedAlertForModal(a);
                                                        setShowAlertDetailsModal(true);
                                                    }
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.ccAlertCardHeader}>
                                                    <View style={[styles.ccAlertLevelBadge, { backgroundColor: meta.bg }]}>
                                                        <Text style={[styles.ccAlertLevelText, { color: meta.color }]}>{meta.label}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                                                        {a.timestamp ? formatPST(a.timestamp) : '--:--'}
                                                    </Text>
                                                </View>

                                                <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: '#0f172a' }}>{a.title || 'Untitled Alert'}</Text>
                                                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Area: {a.barangay || 'All'}</Text>

                                                {!isEvac && (
                                                    <View style={styles.ccAlertProgressContainer}>
                                                        <View style={[styles.ccAlertProgressBar, { width: `${(meta.progress || 0.1) * 100}%`, backgroundColor: meta.color }]} />
                                                    </View>
                                                )}

                                                {isEvac && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' }}>
                                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: a.evacuation_status === 'closed' ? '#ef4444' : a.evacuation_status === 'full' ? '#f59e0b' : '#10b981' }} />
                                                        <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: '#1e3a8a' }}>
                                                            STATUS: {a.evacuation_status?.toUpperCase() || 'OPEN'}
                                                        </Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                ) : (
                                    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                                        <Feather name="search" size={32} color="#cbd5e1" />
                                        <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 14 }}>No {filterType} found in active alerts.</Text>
                                    </View>
                                )}
                            </ScrollView>
                        );
                    })()}
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
                                        setVerifyFloodLevel(item.flood_level_reported || "medium");
                                        setIncidentStatus("");
                                        setRecommendedAction("");
                                        setRecError(false);
                                        setStatusError(false);
                                        fetchSensorDataForBarangay(item.location);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text style={{ fontSize: 12, color: '#3b82f6', fontFamily: "Poppins_700Bold" }}>{item.type.toUpperCase()}</Text>
                                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>{formatPST(item.timestamp)}</Text>
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
                            {['advisory', 'warning', 'critical'].map(level => (
                                <TouchableOpacity
                                    key={level}
                                    style={[
                                        styles.ccBrgyChip,
                                        alertType === level && { 
                                            borderColor: level === 'advisory' ? '#3b82f6' : level === 'warning' ? '#f97316' : '#dc2626', 
                                            backgroundColor: level === 'advisory' ? '#eff6ff' : level === 'warning' ? '#fff7ed' : '#fef2f2' 
                                        }
                                     ]}
                                    onPress={() => setAlertType(level)}
                                >
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: level === 'advisory' ? '#3b82f6' : level === 'warning' ? '#f97316' : '#dc2626' }} />
                                    <Text style={[styles.ccBrgyChipText, alertType === level && { color: level === 'advisory' ? '#1d4ed8' : level === 'warning' ? '#ea580c' : '#dc2626', fontFamily: "Poppins_700Bold" }]}>
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
                            <View key={item.id} style={{ position: 'relative', paddingBottom: 16, marginBottom: 16, paddingRight: 40, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: item.level === 'critical' ? '#dc2626' : item.level === 'warning' ? '#f97316' : item.level === 'evacuation' ? '#1e3a8a' : '#3b82f6' }}>
                                                {item.level.toUpperCase()}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>{formatPST(item.timestamp)}</Text>
                                        </View>
                                        <Text style={{ fontSize: 14, fontFamily: "Poppins_600SemiBold", color: '#1e293b' }}>{item.title}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }} numberOfLines={2}>{item.description}</Text>
                                    </View>
                                </View>
                                
                                <TouchableOpacity
                                    style={{ 
                                        position: 'absolute',
                                        bottom: 16,
                                        right: 0,
                                        width: 32,
                                        height: 32,
                                        backgroundColor: '#ffffff',
                                        borderWidth: 1,
                                        borderColor: '#e2e8f0',
                                        borderRadius: 8,
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onPress={() => handleDeleteAlert(item.id, item.title)}
                                >
                                    <Feather name="trash-2" size={16} color="#dc2626" />
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
                        <TopRightStatusIndicator />
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
                animationType="fade"
                onRequestClose={() => setShowReportDetailsModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 900, height: '90%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 40 }}>
                        {selectedReportForModal && (
                            <>
                                {/* Modal Header */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center' }}>
                                            <Feather name="clipboard" size={20} color="#0284c7" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 17, fontFamily: "Poppins_700Bold", color: '#0f172a' }}>Review Citizen Report</Text>
                                            <Text style={{ fontSize: 12, color: '#94a3b8', fontFamily: "Poppins_400Regular" }}>
                                                Submitted {formatPST(selectedReportForModal.timestamp)}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setShowReportDetailsModal(false)}
                                        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}
                                    >
                                        <Feather name="x" size={16} color="#64748b" />
                                    </TouchableOpacity>
                                </View>

                                {/* Two-column body */}
                                <View style={{ flexDirection: 'row', flex: 1, minHeight: 0 }}>

                                    {/* LEFT — Incident Details */}
                                    <ScrollView style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#f1f5f9' }} contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>

                                        {/* Report Summary */}
                                        <View style={{ marginBottom: 20 }}>
                                            <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: '#94a3b8', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>Incident Details</Text>

                                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                                                <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                                                    <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: '#1d4ed8' }}>{selectedReportForModal.type?.toUpperCase()}</Text>
                                                </View>
                                                {selectedReportForModal.flood_level_reported && (
                                                    <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                                                        <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: '#b45309' }}>{selectedReportForModal.flood_level_reported.toUpperCase()}</Text>
                                                    </View>
                                                )}
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                <Feather name="map-pin" size={14} color="#64748b" />
                                                <Text style={{ fontSize: 15, fontFamily: "Poppins_700Bold", color: '#0f172a' }}>{selectedReportForModal.location}</Text>
                                            </View>

                                            <Text style={{ fontSize: 13, color: '#475569', lineHeight: 22, marginBottom: 16, backgroundColor: '#f8fafc', padding: 12, borderRadius: 10 }}>
                                                "{selectedReportForModal.description}"
                                            </Text>

                                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                                <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 12 }}>
                                                    <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reporter</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Feather name="user" size={11} color="#4f46e5" />
                                                        </View>
                                                        <Text style={{ fontSize: 12, fontFamily: "Poppins_600SemiBold", color: '#1e293b' }}>
                                                            {selectedReportForModal.reporter_name || 'Anonymous'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 12 }}>
                                                    <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Time</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Feather name="clock" size={12} color="#64748b" />
                                                        <Text style={{ fontSize: 12, fontFamily: "Poppins_600SemiBold", color: '#1e293b' }}>
                                                            {formatPST(selectedReportForModal.timestamp)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Photo */}
                                        {selectedReportForModal.image_url && (
                                            <View style={{ marginBottom: 20 }}>
                                                <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: '#94a3b8', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>Photo Evidence</Text>
                                                <Image
                                                    source={{ uri: `${API_BASE_URL}${selectedReportForModal.image_url}` }}
                                                    style={{ width: '100%', aspectRatio: 16/9, borderRadius: 12, backgroundColor: '#f1f5f9' }}
                                                    resizeMode="cover"
                                                />
                                            </View>
                                        )}

                                        {/* Sensor Data */}
                                        <View>
                                            <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: '#94a3b8', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>Sensor Reading</Text>
                                            {loadingSensorData ? (
                                                <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 20, alignItems: 'center', justifyContent: 'center', height: 80 }}>
                                                    <ActivityIndicator size="small" color="#f59e0b" />
                                                    <Text style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>Fetching sensor data...</Text>
                                                </View>
                                            ) : sensorDataForReport ? (
                                                <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 16 }}>
                                                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                                                        <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
                                                            <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>SENSOR ID</Text>
                                                            <Text style={{ fontSize: 13, fontFamily: "Poppins_700Bold", color: '#1e293b' }}>{sensorDataForReport.sensor_id || 'N/A'}</Text>
                                                        </View>
                                                        <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
                                                            <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>LEVEL</Text>
                                                            <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: '#0f172a' }}>{sensorDataForReport.flood_level}<Text style={{ fontSize: 10 }}>cm</Text></Text>
                                                        </View>
                                                        <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
                                                            <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>STATUS</Text>
                                                            <View style={{ backgroundColor: sensorDataForReport.status === 'ALARM' ? '#fee2e2' : sensorDataForReport.status === 'WARNING' ? '#fef3c7' : '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                                <Text style={{ fontSize: 10, fontFamily: "Poppins_700Bold", color: sensorDataForReport.status === 'ALARM' ? '#991b1b' : sensorDataForReport.status === 'WARNING' ? '#92400e' : '#166534' }}>{sensorDataForReport.status}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                    {(() => {
                                                        const c = getSensorConsistency(selectedReportForModal.flood_level_reported, sensorDataForReport.flood_level);
                                                        return (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.color + '15', padding: 10, borderRadius: 8 }}>
                                                                <Feather name={c.status === 'MATCHING' ? 'check-circle' : c.status === 'SIMILAR' ? 'minus-circle' : 'alert-circle'} size={14} color={c.color} />
                                                                <Text style={{ fontSize: 12, color: c.color, fontFamily: "Poppins_600SemiBold", flex: 1 }}>
                                                                    {c.status === 'MATCHING' && 'Matches sensor reading — High confidence'}
                                                                    {c.status === 'SIMILAR' && 'Similar to sensor reading — Medium confidence'}
                                                                    {c.status === 'DIFFERENT' && 'Differs from sensor reading — Review carefully'}
                                                                </Text>
                                                            </View>
                                                        );
                                                    })()}
                                                </View>
                                            ) : (
                                                <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <Feather name="wifi-off" size={16} color="#94a3b8" />
                                                    <Text style={{ fontSize: 12, color: '#94a3b8', fontFamily: "Poppins_400Regular" }}>No sensor data available for this location.</Text>
                                                </View>
                                            )}
                                        </View>

                                    </ScrollView>

                                    {/* RIGHT — Official Response */}
                                    <View style={{ flex: 1.2, backgroundColor: '#fcfcfc', borderLeftWidth: 1, borderLeftColor: '#f1f5f9' }}>
                                        <ScrollView contentContainerStyle={{ padding: 28 }} showsVerticalScrollIndicator={false}>
                                            <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: '#94a3b8', letterSpacing: 1, marginBottom: 20, textTransform: 'uppercase' }}>Official Response</Text>

                                            {/* Flood Level */}
                                            <View style={{ marginBottom: 20 }}>
                                                <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: '#374151', marginBottom: 10 }}>Official Flood Level</Text>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {[
                                                        { level: "advisory", label: "Advisory", color: "#3b82f6", bg: "#eff6ff", dot: "#3b82f6" },
                                                        { level: "warning",  label: "Warning",  color: "#f97316", bg: "#fff7ed", dot: "#f97316" },
                                                        { level: "critical", label: "Critical", color: "#dc2626", bg: "#fef2f2", dot: "#dc2626" },
                                                    ].map(({ level, label, color, bg }) => (
                                                        <TouchableOpacity
                                                            key={level}
                                                            onPress={() => setVerifyFloodLevel(level)}
                                                            style={{
                                                                flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
                                                                backgroundColor: verifyFloodLevel === level ? bg : '#f8fafc',
                                                                borderWidth: 1.5,
                                                                borderColor: verifyFloodLevel === level ? color : '#e2e8f0',
                                                            }}
                                                        >
                                                            <Text style={{ fontSize: 12, fontFamily: verifyFloodLevel === level ? "Poppins_700Bold" : "Poppins_400Regular", color: verifyFloodLevel === level ? color : '#94a3b8' }}>{label}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                            {/* Incident Status */}
                                            <View style={{ marginBottom: 20 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                    <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: '#374151' }}>Incident Status <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                                    {statusError && <Text style={{ fontSize: 11, color: '#ef4444', fontFamily: "Poppins_400Regular" }}>Required</Text>}
                                                </View>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {[
                                                        { value: "Active",   icon: "zap",          color: "#d97706", bg: "#fffbeb" },
                                                    ].map(({ value, icon, color, bg }) => (
                                                        <TouchableOpacity
                                                            key={value}
                                                            onPress={() => { setIncidentStatus(value); setStatusError(false); }}
                                                            style={{
                                                                flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
                                                                flexDirection: 'row', justifyContent: 'center', gap: 6,
                                                                backgroundColor: incidentStatus === value ? bg : '#f8fafc',
                                                                borderWidth: 1.5,
                                                                borderColor: incidentStatus === value ? color : statusError ? '#fca5a5' : '#e2e8f0',
                                                            }}
                                                        >
                                                            <Feather name={icon} size={13} color={incidentStatus === value ? color : '#94a3b8'} />
                                                            <Text style={{ fontSize: 12, fontFamily: incidentStatus === value ? "Poppins_700Bold" : "Poppins_400Regular", color: incidentStatus === value ? color : '#94a3b8' }}>{value}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                            {/* Official Recommendation */}
                                            <View style={{ marginBottom: 8 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                    <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: '#374151' }}>Official Recommendation <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                                    {recError && <Text style={{ fontSize: 11, color: '#ef4444', fontFamily: "Poppins_400Regular" }}>Required</Text>}
                                                </View>
                                                <TextInput
                                                    style={{
                                                        backgroundColor: recError ? '#fef2f2' : '#f8fafc',
                                                        borderWidth: 1.5,
                                                        borderColor: recError ? '#fca5a5' : '#e2e8f0',
                                                        borderRadius: 10,
                                                        padding: 14,
                                                        minHeight: 110,
                                                        textAlignVertical: 'top',
                                                        fontFamily: "Poppins_400Regular",
                                                        fontSize: 13,
                                                        color: '#1e293b',
                                                        lineHeight: 22,
                                                    }}
                                                    placeholder="e.g., Evacuate to higher ground, avoid flood-prone roads, proceed to the nearest evacuation center..."
                                                    placeholderTextColor="#cbd5e1"
                                                    value={recommendedAction}
                                                    onChangeText={(v) => { setRecommendedAction(v); if (v.trim()) setRecError(false); }}
                                                    multiline
                                                />
                                            </View>
                                        </ScrollView>

                                        {/* Action Buttons — pinned to bottom of right column */}
                                        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', gap: 10 }}>
                                            <TouchableOpacity
                                                onPress={() => handleReject(selectedReportForModal.id, selectedReportForModal)}
                                                style={{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#ffffff' }}
                                            >
                                                <Feather name="slash" size={14} color="#64748b" />
                                                <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: '#64748b' }}>Dismiss</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleVerify(selectedReportForModal.id, selectedReportForModal)}
                                                style={{ flex: 2, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: '#0f172a' }}
                                            >
                                                <Feather name="send" size={14} color="#ffffff" />
                                                <Text style={{ fontSize: 13, fontFamily: "Poppins_700Bold", color: '#ffffff' }}>Verify & Broadcast</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Alert Details Modal */}
            <Modal
                visible={showAlertDetailsModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowAlertDetailsModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#ffffff', borderRadius: 24, width: '100%', maxWidth: 650, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 25 }}>
                        {selectedAlertForModal && (
                            <>
                                {/* Modal Header (Dark Themed) */}
                                <View style={{ backgroundColor: '#20293a', paddingHorizontal: 28, paddingVertical: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <View>
                                            <Text style={{ fontSize: 22, fontFamily: "Poppins_700Bold", color: '#ffffff' }}>{selectedAlertForModal.title}</Text>
                                            <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 2 }}>
                                                {selectedAlertForModal.level === 'evacuation' ? 'Evacuation Update' : 'Flood Alert'} • {selectedAlertForModal.barangay === 'All' ? 'Community Wide' : `Barangay ${selectedAlertForModal.barangay}`}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setShowAlertDetailsModal(false)}
                                            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Feather name="x" size={24} color="#ffffff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <ScrollView style={{ padding: 28, maxHeight: 600 }} showsVerticalScrollIndicator={false}>
                                    {/* Metrics Row (Two Boxes) */}
                                    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 28 }}>
                                        <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 10 }}>
                                            <MaterialCommunityIcons name={selectedAlertForModal.level === 'evacuation' ? "home-city-outline" : "alert-decagram-outline"} size={22} color="#94a3b8" />
                                            <Text style={{ fontSize: 10, fontFamily: "Poppins_700Bold", color: '#94a3b8', letterSpacing: 0.5, marginTop: 8, textTransform: 'uppercase' }}>
                                                {selectedAlertForModal.level === 'evacuation' ? 'Facility Status' : 'Priority Level'}
                                            </Text>
                                            <View style={{ width: 30, height: 1, backgroundColor: '#cbd5e1', marginVertical: 12 }} />
                                            <Text style={{ fontSize: 14, fontFamily: "Poppins_700Bold", color: '#1e293b', textAlign: 'center' }}>
                                                {selectedAlertForModal.level === 'evacuation' ? (selectedAlertForModal.evacuation_status?.toUpperCase() || 'OPEN') : selectedAlertForModal.level?.toUpperCase()}
                                            </Text>
                                        </View>

                                        <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 10 }}>
                                            <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color="#94a3b8" />
                                            <Text style={{ fontSize: 10, fontFamily: "Poppins_700Bold", color: '#94a3b8', letterSpacing: 0.5, marginTop: 8, textTransform: 'uppercase' }}>Scope / Area</Text>
                                            <View style={{ width: 30, height: 1, backgroundColor: '#cbd5e1', marginVertical: 12 }} />
                                            <Text style={{ fontSize: 14, fontFamily: "Poppins_700Bold", color: '#1e293b', textAlign: 'center' }}>
                                                {selectedAlertForModal.barangay === 'All' ? 'COMMUNITY' : selectedAlertForModal.barangay?.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Centered Status Pill */}
                                    <View style={{ alignItems: 'center', marginBottom: 32 }}>
                                        <View style={{ 
                                            backgroundColor: '#ffffff', 
                                            borderWidth: 1.5,
                                            borderColor: selectedAlertForModal.level === 'critical' ? '#dc2626' : selectedAlertForModal.level === 'warning' ? '#f97316' : selectedAlertForModal.level === 'advisory' ? '#3b82f6' : '#1e3a8a',
                                            paddingHorizontal: 28, 
                                            paddingVertical: 8, 
                                            borderRadius: 24,
                                        }}>
                                            <Text style={{ fontSize: 11, fontFamily: "Poppins_700Bold", color: selectedAlertForModal.level === 'critical' ? '#dc2626' : selectedAlertForModal.level === 'warning' ? '#f97316' : selectedAlertForModal.level === 'advisory' ? '#3b82f6' : '#1e3a8a', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                                                {selectedAlertForModal.level === 'evacuation' ? 'Evacuation Alert' : 'Active Alert'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Detail List with Dashed Lines (Simplified with solid thin lines) */}
                                    <View style={{ marginBottom: 28 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                            <Text style={{ fontSize: 13, color: '#64748b', fontFamily: "Poppins_600SemiBold" }}>Timestamp</Text>
                                            <Text style={{ fontSize: 13, color: '#1e293b', fontFamily: "Poppins_700Bold" }}>
                                                {selectedAlertForModal.timestamp ? formatPST(selectedAlertForModal.timestamp) : 'N/A'}
                                            </Text>
                                        </View>

                                        {selectedAlertForModal.level === 'evacuation' ? (
                                            <>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                                    <Text style={{ fontSize: 13, color: '#64748b', fontFamily: "Poppins_600SemiBold" }}>Facility Location</Text>
                                                    <Text style={{ fontSize: 13, color: '#1e293b', fontFamily: "Poppins_700Bold" }}>{selectedAlertForModal.evacuation_location || 'N/A'}</Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                                    <Text style={{ fontSize: 13, color: '#64748b', fontFamily: "Poppins_600SemiBold" }}>Facility Capacity</Text>
                                                    <Text style={{ fontSize: 13, color: '#1e293b', fontFamily: "Poppins_700Bold" }}>{selectedAlertForModal.evacuation_capacity || 'N/A'}</Text>
                                                </View>
                                            </>
                                        ) : (
                                            <>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                                    <Text style={{ fontSize: 13, color: '#64748b', fontFamily: "Poppins_600SemiBold" }}>Incident Status</Text>
                                                    <Text style={{ fontSize: 13, color: '#1e293b', fontFamily: "Poppins_700Bold" }}>Active</Text>
                                                </View>
                                                {selectedAlertForModal.recommended_action && (
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                                        <Text style={{ fontSize: 13, color: '#64748b', fontFamily: "Poppins_600SemiBold" }}>Rec. Action</Text>
                                                        <Text style={{ fontSize: 13, color: '#1e293b', fontFamily: "Poppins_700Bold", flex: 1, textAlign: 'right', marginLeft: 20 }}>{selectedAlertForModal.recommended_action}</Text>
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </View>

                                    {/* Removed Description Section */}
                                </ScrollView>

                                <View style={{ padding: 28, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                                    {selectedAlertForModal.level !== 'critical' && selectedAlertForModal.level !== 'evacuation' && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowAlertDetailsModal(false);
                                                handleEscalate(selectedAlertForModal.id);
                                            }}
                                            style={{ 
                                                borderWidth: 2,
                                                borderColor: '#20293a',
                                                paddingHorizontal: 20, 
                                                paddingVertical: 10, 
                                                borderRadius: 12,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 8,
                                                opacity: 0.9,
                                                backgroundColor: '#ffffff'
                                            }}
                                        >
                                            <Feather name="trending-up" size={16} color="#20293a" />
                                            <Text style={{ fontSize: 14, fontFamily: "Poppins_700Bold", color: '#20293a' }}>Escalate</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => {
                                            setShowAlertDetailsModal(false);
                                            handleDeleteAlert(selectedAlertForModal.id, selectedAlertForModal.title);
                                        }}
                                        style={{ 
                                            borderWidth: 2,
                                            borderColor: '#dc2626',
                                            paddingHorizontal: 20, 
                                            paddingVertical: 10, 
                                            borderRadius: 12,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                            opacity: 0.9,
                                            backgroundColor: 'rgba(255,255,255,0.05)'
                                        }}
                                    >
                                        <Feather name="trash-2" size={16} color="#dc2626" />
                                        <Text style={{ fontSize: 14, fontFamily: "Poppins_700Bold", color: '#dc2626' }}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

        </View>
    );
};

export default AlertManagementPage;
