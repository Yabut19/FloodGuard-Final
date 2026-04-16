import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";

const ThresholdConfigPage = ({ onNavigate, onLogout, userRole = "superadmin" }) => {
    const [advisoryLevel, setAdvisoryLevel] = useState("15");
    const [warningLevel, setWarningLevel] = useState("30");
    const [criticalLevel, setCriticalLevel] = useState("50");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [infoMessage, setInfoMessage] = useState("");
    const [initialThresholds, setInitialThresholds] = useState({ advisory: "15", warning: "30", critical: "50" });

    useEffect(() => {
        fetchThresholds();
    }, []);

    const fetchThresholds = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/config/thresholds`);
            if (res.ok) {
                const data = await res.json();
                setAdvisoryLevel(String(data.advisory_level));
                setWarningLevel(String(data.warning_level));
                setCriticalLevel(String(data.critical_level));
                setInitialThresholds({
                    advisory: String(data.advisory_level),
                    warning: String(data.warning_level),
                    critical: String(data.critical_level)
                });
            } else {
                console.error("Failed to fetch thresholds");
            }
        } catch (err) {
            console.error("Error fetching thresholds:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setSuccessMessage("");
        setErrorMessage("");
        setInfoMessage("");

        if (advisoryLevel === initialThresholds.advisory &&
            warningLevel === initialThresholds.warning &&
            criticalLevel === initialThresholds.critical) {
            setInfoMessage("No changes detected. The configurations remain the same.");
            setTimeout(() => setInfoMessage(""), 4000);
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/config/thresholds`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    advisory_level: parseInt(advisoryLevel) || 15,
                    warning_level: parseInt(warningLevel) || 30,
                    critical_level: parseInt(criticalLevel) || 50
                })
            });

            if (res.ok) {
                setErrorMessage("");
                setSuccessMessage("Configuration saved successfully!");
                setInitialThresholds({ advisory: advisoryLevel, warning: warningLevel, critical: criticalLevel });
                setTimeout(() => setSuccessMessage(""), 4000);
            } else {
                setSuccessMessage("");
                setErrorMessage("Error: Failed to save threshold configuration.");
            }
        } catch (err) {
            console.error("Save error:", err);
            setSuccessMessage("");
            setErrorMessage("Error: Backend is offline or network issue occurred.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.dashboardRoot}>
            <AdminSidebar variant={userRole} activePage="threshold-config" onNavigate={onNavigate} onLogout={onLogout} />

            <View style={styles.dashboardMain}>
                <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Threshold Configuration</Text>
                        <Text style={styles.dashboardTopSubtitle}>
                            Set and dynamically modify risk level parameters for flood alerts
                        </Text>
                    </View>
                    <View style={styles.dashboardTopRight}>
                        <View style={styles.dashboardStatusPill}>
                            <View style={styles.dashboardStatusDot} />
                            <Text style={styles.dashboardStatusText}>System Online</Text>
                        </View>
                        <RealTimeClock style={styles.dashboardTopDate} />
                    </View>
                </View>

                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color="#B0DB9C" />
                        <Text style={{ marginTop: 16, fontFamily: "Poppins_500Medium" }}>Loading configurations...</Text>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.dashboardScroll}
                        contentContainerStyle={styles.dashboardScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.configGrid}>
                            {/* Left Column: Input Thresholds */}
                            <View style={styles.configLeftCol}>
                                <View style={styles.configCard}>
                                    <View style={styles.configCardHeader}>
                                        <Feather name="settings" size={24} color="#3b82f6" />
                                        <Text style={styles.configCardTitle}>Water Level Thresholds</Text>
                                    </View>

                                    {/* Advisory Input */}
                                    <View style={styles.thresholdRow}>
                                        <View style={styles.thresholdLabelRow}>
                                            <Text style={styles.thresholdLabel}>Advisory Level</Text>
                                            <View style={[styles.thresholdBadge, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                                                <Text style={[styles.thresholdBadgeText, { color: "#2563eb" }]}>{advisoryLevel}cm</Text>
                                            </View>
                                        </View>
                                        <TextInput
                                            style={styles.thresholdInputDisplay}
                                            value={advisoryLevel}
                                            onChangeText={setAdvisoryLevel}
                                            keyboardType="numeric"
                                        />
                                        <Text style={styles.thresholdDescription}>
                                            Water level (in cm) that triggers advisory alerts to residents
                                        </Text>
                                    </View>

                                    {/* Warning Input */}
                                    <View style={styles.thresholdRow}>
                                        <View style={styles.thresholdLabelRow}>
                                            <Text style={styles.thresholdLabel}>Warning Level</Text>
                                            <View style={[styles.thresholdBadge, { backgroundColor: "#fffbeb" }]}>
                                                <Text style={[styles.thresholdBadgeText, { color: "#d97706" }]}>{warningLevel}cm</Text>
                                            </View>
                                        </View>
                                        <TextInput
                                            style={styles.thresholdInputDisplay}
                                            value={warningLevel}
                                            onChangeText={setWarningLevel}
                                            keyboardType="numeric"
                                        />
                                        <Text style={styles.thresholdDescription}>
                                            Water level (in cm) that triggers warning alerts and preparation notices
                                        </Text>
                                    </View>

                                    {/* Critical Input */}
                                    <View style={styles.thresholdRow}>
                                        <View style={styles.thresholdLabelRow}>
                                            <Text style={styles.thresholdLabel}>Critical Level</Text>
                                            <View style={[styles.thresholdBadge, { backgroundColor: "#fef2f2" }]}>
                                                <Text style={[styles.thresholdBadgeText, { color: "#dc2626" }]}>{criticalLevel}cm</Text>
                                            </View>
                                        </View>
                                        <TextInput
                                            style={styles.thresholdInputDisplay}
                                            value={criticalLevel}
                                            onChangeText={setCriticalLevel}
                                            keyboardType="numeric"
                                        />
                                        <Text style={styles.thresholdDescription}>
                                            Water level (in cm) that triggers critical alerts and evacuation orders
                                        </Text>
                                    </View>

                                    <TouchableOpacity style={styles.saveConfigButton} onPress={handleSave} disabled={isSaving}>
                                        {isSaving ? (
                                            <ActivityIndicator size="small" color="#1a3d0a" />
                                        ) : (
                                            <Feather name="save" size={18} color="#1a3d0a" />
                                        )}
                                        <Text style={styles.saveConfigButtonText}>
                                            {isSaving ? "Saving..." : "Save Configuration"}
                                        </Text>
                                    </TouchableOpacity>
                                    {successMessage ? (
                                        <View style={{ marginTop: 16, padding: 12, backgroundColor: "#dcfce7", borderRadius: 8, flexDirection: "row", alignItems: "center" }}>
                                            <Feather name="check-circle" size={18} color="#15803d" style={{ marginRight: 8 }} />
                                            <Text style={{ color: "#166534", fontFamily: "Poppins_500Medium", fontSize: 13 }}>{successMessage}</Text>
                                        </View>
                                    ) : null}
                                    {errorMessage ? (
                                        <View style={{ marginTop: 16, padding: 12, backgroundColor: "#fee2e2", borderRadius: 8, flexDirection: "row", alignItems: "center" }}>
                                            <Feather name="alert-circle" size={18} color="#b91c1c" style={{ marginRight: 8 }} />
                                            <Text style={{ color: "#991b1b", fontFamily: "Poppins_500Medium", fontSize: 13 }}>{errorMessage}</Text>
                                        </View>
                                    ) : null}
                                    {infoMessage ? (
                                        <View style={{ marginTop: 16, padding: 12, backgroundColor: "#e0f2fe", borderRadius: 8, flexDirection: "row", alignItems: "center" }}>
                                            <Feather name="info" size={18} color="#0284c7" style={{ marginRight: 8 }} />
                                            <Text style={{ color: "#075985", fontFamily: "Poppins_500Medium", fontSize: 13 }}>{infoMessage}</Text>
                                        </View>
                                    ) : null}
                                </View>
                            </View>

                            {/* Right Column: Visual Reference */}
                            <View style={styles.configRightCol}>
                                <View style={styles.configCard}>
                                    <View style={styles.configCardHeader}>
                                        <Text style={styles.configCardTitle}>Visual Reference</Text>
                                    </View>

                                    <View style={styles.visualRefContainer}>
                                        <LinearGradient
                                            colors={['#ef4444', '#f97316', '#3b82f6']}
                                            style={styles.visualGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 0, y: 1 }}
                                        />
                                        <View style={styles.visualLabelOverlay}>
                                            <View style={styles.visualLabelItem}>
                                                <Text style={styles.visualLabelText}>CRITICAL ≥ {criticalLevel}cm</Text>
                                            </View>
                                            <View style={styles.visualLabelItem}>
                                                <Text style={styles.visualLabelText}>WARNING  {warningLevel}cm - {criticalLevel}cm</Text>
                                            </View>
                                            <View style={styles.visualLabelItem}>
                                                <Text style={styles.visualLabelText}>ADVISORY  {advisoryLevel}cm - {warningLevel}cm</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.warningNote}>
                                        <Feather name="alert-triangle" size={20} color="#b45309" style={{ marginTop: 2 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.warningNoteTitle}>Important Note</Text>
                                            <Text style={styles.warningNoteText}>
                                                Changes to threshold levels will immediately update IoT calibrations and affect all automated alert systems.
                                                Make sure to test thoroughly before applying to production.
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                )}
            </View>
        </View>
    );
};

export default ThresholdConfigPage;
