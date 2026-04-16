import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, StyleSheet, Platform, Animated, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";

const ManageSensorsPage = ({ onNavigate, onLogout, userRole = "lgu" }) => {
    const isSuperAdmin = userRole === "superadmin";
    const [activeTab, setActiveTab] = useState(isSuperAdmin ? "sensors" : "map"); // "map" | "sensors"
    const [sensors, setSensors] = useState([]);
    const [liveSensors, setLiveSensors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [healthLoading, setHealthLoading] = useState(false);
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedSensorHealth, setSelectedSensorHealth] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All Status");
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const healthIntervalRef = useRef(null);

    const [formData, setFormData] = useState({
        id: "", name: "", barangay: "", description: "",
        lat: "", lng: "", status: "active",
        battery_level: "100", signal_strength: "strong"
    });

    // ── Map state ─────────────────────────────────────────────────
    const [selectedSensor, setSelectedSensor] = useState(null);
    const mapInitRef = useRef(false);

    const getMapStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case "normal": return "#16a34a";
            case "warning": return "#f59e0b";
            case "alarm": case "critical": return "#dc2626";
            default: return "#64748b";
        }
    };

    // Initialize Leaflet map
    useEffect(() => {
        if (Platform.OS !== "web" || typeof document === "undefined") return;
        if (activeTab !== "map") return;

        let mapInstance = null;
        let checkInterval = null;

        const initializeMap = () => {
            try {
                const container = document.getElementById("sensor-mgmt-map");
                if (!container || !window.L) return;
                if (container._leaflet_id) return; // already initialized
                container.innerHTML = "";
                if (container.offsetHeight === 0) container.style.height = "480px";
                mapInstance = window.L.map(container, { center: [10.3157, 123.9054], zoom: 15, zoomControl: true });
                setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 100);
                window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors', maxZoom: 19,
                }).addTo(mapInstance);

                // Add map click listener to close info overlay
                mapInstance.on('click', () => {
                    setSelectedSensor(null);
                });

                window.sensorMgmtMapInstance = mapInstance;
                mapInitRef.current = true;
            } catch (e) { console.error("Map init error:", e); }
        };

        const loadLeaflet = () => {
            if (window.L && window.L.map) { setTimeout(initializeMap, 50); return; }
            const existingCSS = document.querySelector('link[href*="leaflet.css"]');
            const existingJS = document.querySelector('script[src*="leaflet.js"]');
            if (existingCSS && existingJS) {
                let attempts = 0;
                checkInterval = setInterval(() => {
                    attempts++;
                    if (window.L && window.L.map) { clearInterval(checkInterval); initializeMap(); }
                    else if (attempts > 30) clearInterval(checkInterval);
                }, 200);
                return;
            }
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            link.crossOrigin = "";
            document.head.appendChild(link);
            const script = document.createElement("script");
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.crossOrigin = "";
            script.async = true;
            script.onload = () => setTimeout(() => { if (window.L && window.L.map) initializeMap(); }, 100);
            document.head.appendChild(script);
        };

        const timer = setTimeout(loadLeaflet, 150);
        return () => {
            clearTimeout(timer);
            if (checkInterval) clearInterval(checkInterval);
            if (mapInstance) { try { mapInstance.remove(); window.sensorMgmtMapInstance = null; mapInitRef.current = false; } catch (e) { } }
        };
    }, [activeTab]);

    // Update map markers when liveSensors changes
    useEffect(() => {
        if (Platform.OS !== "web" || typeof window === "undefined") return;
        const mapInstance = window.sensorMgmtMapInstance;
        if (!mapInstance || !window.L) return;
        mapInstance.eachLayer((layer) => {
            if (layer instanceof window.L.CircleMarker || layer instanceof window.L.Marker) mapInstance.removeLayer(layer);
        });
        liveSensors.forEach((s) => {
            try {
                const status = s.is_offline ? "offline" : (s.reading_status || "normal");
                const color = getMapStatusColor(status);
                const lat = s.lat || 10.3157;
                const lng = s.lng || 123.9054;
                const marker = window.L.circleMarker([lat, lng], {
                    radius: 11, fillColor: color, color: "#fff", weight: 3, opacity: 1, fillOpacity: 1,
                }).addTo(mapInstance);
                marker.bindPopup(`<b>${s.name}</b><br>Brgy. ${s.barangay || "—"}<br>Status: ${status.toUpperCase()}<br>Flood: ${s.flood_level || 0}cm<br>${s.is_offline ? '<span style="color:red">⚠ OFFLINE</span>' : '<span style="color:green">● ONLINE</span>'}`);
                marker.on('click', () => setSelectedSensor(s.id));
            } catch (e) { }
        });
    }, [liveSensors, activeTab]);

    // ── Fetch registered sensors ──────────────────────────────────
    const fetchSensors = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/iot/sensors`);
            const data = await res.json();
            if (res.ok) setSensors(data.sensors || []);
        } catch (e) { console.warn("fetchSensors error", e); }
        finally { setLoading(false); }
    };

    // ── Fetch live health data ────────────────────────────────────
    const fetchHealthData = async () => {
        setHealthLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/iot/sensors/status-all`);
            if (res.ok) {
                const data = await res.json();
                setLiveSensors(data);
            }
        } catch (e) { console.warn("fetchHealthData error", e); }
        finally { setHealthLoading(false); }
    };

    useEffect(() => {
        fetchSensors();
        fetchHealthData();
        healthIntervalRef.current = setInterval(fetchHealthData, 10000);
        return () => clearInterval(healthIntervalRef.current);
    }, []);

    // ── Animation for blinking dots ───────────────────────────────
    const blinkAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(blinkAnim, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
                Animated.timing(blinkAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const handleInputChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const resetForm = () => {
        setFormData({ id: "", name: "", barangay: "", description: "", lat: "", lng: "", status: "active", battery_level: "100", signal_strength: "strong" });
        setErrorMessage("");
    };

    const handleRegisterSensor = async () => {
        if (!formData.id.trim()) return showErr("Sensor ID is required");
        if (!formData.name.trim()) return showErr("Sensor Name is required");
        if (!formData.barangay.trim()) return showErr("Barangay is required");
        if (!formData.lat || !formData.lng) return showErr("Latitude and Longitude are required");
        const lat = parseFloat(formData.lat), lng = parseFloat(formData.lng);
        if (isNaN(lat) || isNaN(lng)) return showErr("Coordinates must be valid numbers");
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return showErr("Invalid coordinates");

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/iot/registers-sensor`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: formData.id, name: formData.name, barangay: formData.barangay,
                    description: formData.description, lat, lng, status: formData.status,
                    battery_level: parseInt(formData.battery_level),
                    signal_strength: formData.signal_strength
                })
            });
            const data = await res.json();
            if (res.ok) {
                setShowRegistrationModal(false);
                setSuccessMessage(`Sensor "${formData.name}" registered successfully!`);
                setShowSuccessModal(true);
                resetForm();
                fetchSensors();
                fetchHealthData();
            } else {
                showErr(data.error || "Registration failed");
            }
        } catch (e) {
            showErr("Network error during registration");
        }
        setLoading(false);
    };

    const handleDeleteSensor = async (sensorId) => {
        if (!window.confirm(`Are you sure you want to delete sensor "${sensorId}"?`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/iot/sensors/${sensorId}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok) {
                setSuccessMessage(data.message || "Sensor deleted successfully");
                setShowSuccessModal(true);
                fetchSensors();
                fetchHealthData();
            } else {
                showErr(data.error || "Failed to delete sensor");
            }
        } catch (e) {
            showErr("Network error while deleting sensor");
        }
    };

    const showErr = (msg) => { setErrorMessage(msg); setShowErrorModal(true); };

    // ── Toggle sensor on/off ──────────────────────────────────────
    const [togglingId, setTogglingId] = useState(null);

    const handleToggleSensor = async (sensor, enabled) => {
        setTogglingId(sensor.id);
        try {
            const res = await fetch(`${API_BASE_URL}/api/iot/sensors/${sensor.id}/toggle`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled })
            });
            const data = await res.json();
            if (res.ok) {
                // Re-fetch live data so card grid updates
                await fetchHealthData();
                setSuccessMessage(`Sensor "${sensor.name}" turned ${enabled ? "ON" : "OFF"} successfully!`);
                setShowSuccessModal(true);
            } else {
                showErr(data.error || "Failed to toggle sensor");
            }
        } catch (e) {
            showErr("Network error while toggling sensor");
        } finally {
            setTogglingId(null);
        }
    };

    const filteredSensors = sensors.filter(s => {
        const q = searchQuery.toLowerCase();
        const matchSearch = s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q) || s.barangay?.toLowerCase().includes(q);

        const live = liveSensors.find(ls => ls.id === s.id);
        const isOnline = live && !live.is_offline;

        let matchStatus = true;
        if (statusFilter === "Online") matchStatus = isOnline;
        else if (statusFilter === "Offline") matchStatus = !isOnline;
        else if (statusFilter === "Warning") matchStatus = isOnline && live?.reading_status === "WARNING";
        else if (statusFilter === "Critical") matchStatus = isOnline && (live?.reading_status === "WARNING" || live?.reading_status === "CRITICAL");
        else if (statusFilter !== "All Status") matchStatus = s.status === statusFilter;

        return matchSearch && matchStatus;
    });

    const getStatusBadge = (status) => {
        const map = {
            active: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
            inactive: { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" },
            maintenance: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
            OFFLINE: { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" },
            NORMAL: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
            WARNING: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
            CRITICAL: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
        };
        return map[status] || { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" };
    };

    const getBatteryColor = (level) => {
        if (!level || level === "No Signal") return "#94a3b8";
        const n = parseInt(level);
        if (n >= 70) return "#16a34a";
        if (n >= 40) return "#f59e0b";
        return "#dc2626";
    };

    // ── Computed health summary ─────────────────────────────────
    const totalSensors = liveSensors.length;
    const onlineSensors = liveSensors.filter(s => !s.is_offline).length;
    const offlineSensors = liveSensors.filter(s => s.is_offline).length;
    const warningSensors = liveSensors.filter(s => !s.is_offline && s.reading_status === "WARNING").length;
    const criticalSensors = liveSensors.filter(s => !s.is_offline && (s.reading_status === "ALARM" || s.reading_status === "CRITICAL")).length;

    return (
        <View style={styles.dashboardRoot}>
            <AdminSidebar variant={userRole} activePage="sensor-registration" onNavigate={onNavigate} onLogout={onLogout} />

            <View style={styles.dashboardMain}>
                {/* Top Bar */}
                <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Manage Sensors</Text>
                        <Text style={styles.dashboardTopSubtitle}>Register, monitor, and manage your sensor network</Text>
                    </View>
                    <View style={styles.dashboardTopRight}>
                        <View style={styles.dashboardStatusPill}>
                            <View style={styles.dashboardStatusDot} />
                            <Text style={styles.dashboardStatusText}>
                                {onlineSensors}/{totalSensors} Online
                            </Text>
                        </View>
                        <RealTimeClock style={styles.dashboardTopDate} />
                    </View>
                </View>

                {/* Tab Bar */}
                <View style={pg.tabBar}>
                    <TouchableOpacity
                        style={[pg.tabItem, activeTab === "map" && pg.tabItemActive]}
                        onPress={() => setActiveTab("map")}
                    >
                        <Feather name="map" size={16} color={activeTab === "map" ? "#3b82f6" : "#64748b"} />
                        <Text style={[pg.tabText, activeTab === "map" && pg.tabTextActive]}>Sensor Map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[pg.tabItem, activeTab === "sensors" && pg.tabItemActive]}
                        onPress={() => setActiveTab("sensors")}
                    >
                        <Feather name="cpu" size={16} color={activeTab === "sensors" ? "#3b82f6" : "#64748b"} />
                        <Text style={[pg.tabText, activeTab === "sensors" && pg.tabTextActive]}>Registered Sensors</Text>
                    </TouchableOpacity>
                </View>

                {/* ══════════════════════════════════════════════════ */}
                {/* TAB 0: SENSOR MAP                                  */}
                {/* ══════════════════════════════════════════════════ */}
                {activeTab === "map" && (
                    <View style={styles.sensorMapContainer}>
                        {/* Interactive Map Panel */}
                        <View style={styles.mapPanel}>
                            {Platform.OS === "web" ? (
                                <View style={styles.mapView}>
                                    <View
                                        nativeID="sensor-mgmt-map"
                                        style={styles.googleMapContainer}
                                    />
                                </View>
                            ) : (
                                <View style={styles.mapView}>
                                    <View style={styles.mapPlaceholder}>
                                        <Text style={styles.mapPlaceholderTitle}>Interactive Map</Text>
                                        <Text style={styles.mapPlaceholderSubtitle}>Live sensor locations</Text>
                                    </View>
                                </View>
                            )}

                            {/* Selected Sensor Info Overlay */}
                            {selectedSensor && (() => {
                                const sel = liveSensors.find(s => s.id === selectedSensor);
                                if (!sel) return null;
                                const status = sel.is_offline ? "offline" : (sel.reading_status || "normal");
                                const isNormal = status === "normal";
                                const isOffline = status === "offline";

                                return (
                                    <View style={styles.sensorInfoOverlay}>
                                        <TouchableOpacity style={styles.sensorInfoClose} onPress={() => setSelectedSensor(null)}>
                                            <Feather name="x" size={16} color="#64748b" />
                                        </TouchableOpacity>
                                        <View style={{ gap: 8 }}>
                                            <View>
                                                <Text style={styles.sensorInfoTitle}>{sel.name}</Text>
                                                <Text style={styles.sensorInfoText}>Brgy. {sel.barangay || "—"}</Text>
                                            </View>

                                            <View style={[
                                                styles.dashboardSensorStatusPill,
                                                { alignSelf: 'flex-start', backgroundColor: isNormal ? '#DDF6D2' : isOffline ? '#f1f5f9' : '#fee2e2' }
                                            ]}>
                                                <Text style={[
                                                    styles.dashboardSensorStatusText,
                                                    { color: isNormal ? '#166534' : isOffline ? '#64748b' : '#dc2626' }
                                                ]}>{status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}</Text>
                                            </View>

                                            {sel.flood_level !== undefined && (
                                                <View style={{
                                                    backgroundColor: isOffline ? '#f8fafc' : '#eff6ff',
                                                    padding: 12,
                                                    borderRadius: 12,
                                                    marginTop: 4,
                                                    borderWidth: 1,
                                                    borderColor: isOffline ? '#f1f5f9' : '#dbeafe'
                                                }}>
                                                    <Text style={{ color: '#64748b', fontSize: 11, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.5 }}>FLOOD LEVEL</Text>
                                                    <Text style={{ color: isOffline ? '#94a3b8' : '#1e40af', fontSize: 22, fontFamily: 'Poppins_700Bold', marginTop: 2 }}>
                                                        {Number(sel.flood_level || 0).toFixed(1)} cm
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })()}
                        </View>

                        {/* Sensor List Panel */}
                        <View style={styles.sensorListPanel}>
                            <Text style={styles.sensorListTitle}>Monitored Sensors</Text>
                            <View style={styles.sensorListScroll}>
                                <View style={styles.sensorListContent}>
                                    {liveSensors.length === 0 ? (
                                        <View style={{ alignItems: "center", paddingVertical: 32 }}>
                                            <Feather name="cpu" size={28} color="#cbd5e1" />
                                            <Text style={{ fontSize: 13, fontFamily: "Poppins_400Regular", color: "#94a3b8", marginTop: 8, textAlign: "center" }}>No sensor data yet</Text>
                                        </View>
                                    ) : liveSensors.map((s) => {
                                        const status = s.is_offline ? "offline" : (s.reading_status || "normal");
                                        const dotColor = getMapStatusColor(status);
                                        const isSelected = selectedSensor === s.id;
                                        return (
                                            <TouchableOpacity
                                                key={s.id}
                                                style={[styles.sensorListItem, isSelected && styles.sensorListItemSelected]}
                                                onPress={() => {
                                                    setSelectedSensor(s.id);
                                                    const map = window.sensorMgmtMapInstance;
                                                    if (map && s.lat && s.lng) map.setView([s.lat, s.lng], 17);
                                                }}
                                            >
                                                <View style={styles.sensorListItemContent}>
                                                    <Text style={styles.sensorListItemName}>{s.name}</Text>
                                                    <Text style={styles.sensorListItemBarangay}>
                                                        Brgy. {s.barangay || "—"}
                                                    </Text>
                                                    <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                                        {s.is_offline ? "Offline" : `${Number(s.flood_level || 0).toFixed(1)} cm · ${status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}`}
                                                    </Text>
                                                </View>
                                                {s.is_offline ? (
                                                    <View style={[styles.sensorListItemDot, { backgroundColor: dotColor }]} />
                                                ) : (
                                                    <Animated.View style={[styles.sensorListItemDot, { backgroundColor: dotColor, opacity: blinkAnim }]} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                <ScrollView
                    style={[styles.dashboardScroll, activeTab === "map" && { display: "none" }]}
                    contentContainerStyle={[styles.dashboardScrollContent, { paddingHorizontal: 24, paddingTop: 16 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ══════════════════════════════════════════════════ */}
                    {/* TAB 1: REGISTERED SENSORS                         */}
                    {/* ══════════════════════════════════════════════════ */}
                    {activeTab === "sensors" && (
                        <View>
                            {/* Consolidated Health Summary */}
                            <View style={[pg.healthSummaryRow, { marginBottom: 16 }]}>
                                {[
                                    { icon: "check-circle", label: "Online", value: onlineSensors, color: "#16a34a", bg: "rgba(22, 163, 74, 0.1)" },
                                    { icon: "x-circle", label: "Offline", value: offlineSensors, color: "#64748b", bg: "rgba(100, 116, 139, 0.1)" },
                                    { icon: "alert-triangle", label: "Warning", value: warningSensors, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
                                    { icon: "alert-octagon", label: "Critical", value: criticalSensors, color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" },
                                ].map((card) => (
                                    <View key={card.label} style={pg.healthCard}>
                                        <View style={[pg.healthCardIcon, { backgroundColor: card.bg }]}>
                                            <Feather name={card.icon} size={20} color={card.color} />
                                        </View>
                                        <Text style={pg.healthCardValue}>{card.value}</Text>
                                        <Text style={pg.healthCardLabel}>{card.label}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Toolbar */}
                            <View style={pg.toolbar}>
                                <View style={pg.searchBox}>
                                    <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={pg.searchInput}
                                        placeholder="Search by name, ID, or barangay..."
                                        placeholderTextColor="#94a3b8"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                </View>
                                
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                    <View style={{ position: "relative", zIndex: 1000 }}>
                                        <TouchableOpacity style={pg.filterBtn} onPress={() => setShowStatusDropdown(!showStatusDropdown)}>
                                            <Feather name="filter" size={14} color="#64748b" style={{ marginRight: 4 }} />
                                            <Text style={pg.filterBtnText}>{statusFilter}</Text>
                                            <Feather name={showStatusDropdown ? "chevron-up" : "chevron-down"} size={14} color="#64748b" style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                        {showStatusDropdown && (
                                            <View style={pg.dropdown}>
                                                {["All Status", "Online", "Offline", "Warning", "Critical"].map(s => (
                                                    <TouchableOpacity key={s} style={pg.dropdownItem} onPress={() => { setStatusFilter(s); setShowStatusDropdown(false); }}>
                                                        <Text style={pg.dropdownItemText}>{s}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                    
                                    {isSuperAdmin && (
                                        <TouchableOpacity style={pg.registerBtn} onPress={() => { resetForm(); setShowRegistrationModal(true); }}>
                                            <Feather name="plus" size={16} color="#fff" style={{ marginRight: 4 }} />
                                            <Text style={pg.registerBtnText}>Register Sensor</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Sensor count chip */}
                            <Text style={pg.resultsCount}>{filteredSensors.length} sensor{filteredSensors.length !== 1 ? "s" : ""} found</Text>

                            {loading && !showRegistrationModal ? (
                                <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 64 }} />
                            ) : filteredSensors.length === 0 ? (
                                <View style={pg.emptyState}>
                                    <View style={pg.emptyIcon}>
                                        <Feather name="cpu" size={40} color="#cbd5e1" />
                                    </View>
                                    <Text style={pg.emptyTitle}>No sensors found</Text>
                                    <Text style={pg.emptySubtitle}>
                                        {sensors.length === 0 ? "Register your first sensor to get started" : "Try adjusting your search filters"}
                                    </Text>
                                </View>
                            ) : (
                                <View style={pg.cardGrid}>
                                    {filteredSensors.map(sensor => {
                                        const live = liveSensors.find(ls => ls.id === sensor.id);
                                        const isOnline = live && !live.is_offline;
                                        const isWarning = isOnline && (live?.reading_status === "WARNING" || live?.reading_status === "CRITICAL");
                                        const statusColor = isWarning ? "#ef4444" : isOnline ? "#22c55e" : "#64748b";

                                        return (
                                            <TouchableOpacity
                                                key={sensor.id}
                                                style={pg.sensorCard}
                                                activeOpacity={0.7}
                                                onPress={() => {
                                                    const live = liveSensors.find(ls => ls.id === sensor.id);
                                                    setSelectedSensorHealth({ ...sensor, enabled: live?.enabled ?? true, live });
                                                    setShowStatusModal(true);
                                                }}
                                            >
                                                {/* Card top accent line */}
                                                <View style={[pg.cardAccent, { backgroundColor: statusColor }]} />

                                                <View style={pg.cardHead}>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                                            {isOnline ? (
                                                                <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor, opacity: blinkAnim }} />
                                                            ) : (
                                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
                                                            )}
                                                            <Text style={pg.sensorName}>{sensor.name}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8 }}>
                                                            <Feather name="map-pin" size={11} color="#94a3b8" />
                                                            <Text style={pg.sensorMeta}>Brgy. {sensor.barangay || "—"}</Text>
                                                            <Text style={pg.sensorId}>• {sensor.id}</Text>
                                                        </View>
                                                    </View>
                                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                                        <Switch
                                                            value={live?.enabled !== false}
                                                            onValueChange={(val) => {
                                                                handleToggleSensor(sensor, val);
                                                            }}
                                                            disabled={togglingId === sensor.id}
                                                            trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                                                            thumbColor={live?.enabled === false ? "#94a3b8" : "#16a34a"}
                                                        />
                                                        {isSuperAdmin && (
                                                            <TouchableOpacity style={pg.deleteBtn} onPress={(e) => { e.stopPropagation?.(); handleDeleteSensor(sensor.id); }}>
                                                                <Feather name="trash-2" size={15} color="#dc2626" />
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                </View>

                                                <View style={pg.cardDivider} />

                                                <View style={pg.cardStats}>
                                                    <View style={pg.statItem}>
                                                        <Feather name="navigation" size={13} color="#64748b" />
                                                        <Text style={pg.statLabel}>Coordinates</Text>
                                                        <Text style={pg.statValue}>{sensor.lat?.toFixed(6)}, {sensor.lng?.toFixed(6)}</Text>
                                                    </View>
                                                </View>

                                                {sensor.description ? (
                                                    <View style={{ padding: 16, paddingTop: 0 }}>
                                                        <Text style={pg.cardDesc} numberOfLines={3}>{sensor.description}</Text>
                                                    </View>
                                                ) : <View style={{ height: 16 }} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}

                    <View style={{ height: 120 }} />
                </ScrollView>
            </View>

            {/* ── Registration Modal ─────────────────────────────────────── */}
            <Modal visible={showRegistrationModal} transparent animationType="fade">
                <View style={pg.modalOverlay}>
                    <View style={pg.modalBox}>
                        <LinearGradient colors={["#001D39", "#0A4174"]} style={pg.modalHeader}>
                            <Text style={pg.modalTitle}>Register New Sensor</Text>
                            <TouchableOpacity onPress={() => setShowRegistrationModal(false)}>
                                <Feather name="x" size={22} color="#94a3b8" />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView style={pg.modalBody} showsVerticalScrollIndicator={false}>
                            <View style={pg.formGrid}>
                                <View style={pg.formGroup}>
                                    <Text style={pg.formLabel}>Sensor ID *</Text>
                                    <TextInput style={pg.formInput} placeholder="e.g., SENSOR-001" placeholderTextColor="#94a3b8"
                                        value={formData.id} onChangeText={v => handleInputChange("id", v)} />
                                </View>
                                <View style={pg.formGroup}>
                                    <Text style={pg.formLabel}>Sensor Name *</Text>
                                    <TextInput style={pg.formInput} placeholder="e.g., Main Canal Sensor" placeholderTextColor="#94a3b8"
                                        value={formData.name} onChangeText={v => handleInputChange("name", v)} />
                                </View>
                            </View>

                            <View style={pg.formGroup}>
                                <Text style={pg.formLabel}>Barangay *</Text>
                                <TextInput style={pg.formInput} placeholder="e.g., San Jose, Mabolo" placeholderTextColor="#94a3b8"
                                    value={formData.barangay} onChangeText={v => handleInputChange("barangay", v)} />
                            </View>

                            <View style={pg.formGroup}>
                                <Text style={pg.formLabel}>Description</Text>
                                <TextInput style={[pg.formInput, { height: 72, textAlignVertical: "top" }]}
                                    placeholder="Additional notes about the sensor location or setup..."
                                    placeholderTextColor="#94a3b8" multiline numberOfLines={3}
                                    value={formData.description} onChangeText={v => handleInputChange("description", v)} />
                            </View>

                            <View style={pg.formGrid}>
                                <View style={pg.formGroup}>
                                    <Text style={pg.formLabel}>Latitude *</Text>
                                    <TextInput style={pg.formInput} placeholder="e.g., 10.3157" placeholderTextColor="#94a3b8"
                                        keyboardType="numeric" value={formData.lat} onChangeText={v => handleInputChange("lat", v)} />
                                </View>
                                <View style={pg.formGroup}>
                                    <Text style={pg.formLabel}>Longitude *</Text>
                                    <TextInput style={pg.formInput} placeholder="e.g., 123.8854" placeholderTextColor="#94a3b8"
                                        keyboardType="numeric" value={formData.lng} onChangeText={v => handleInputChange("lng", v)} />
                                </View>
                            </View>

                            <View style={pg.formGrid}>
                                <View style={pg.formGroup}>
                                    <Text style={pg.formLabel}>Initial Battery (%)</Text>
                                    <TextInput style={pg.formInput} placeholder="100" placeholderTextColor="#94a3b8"
                                        keyboardType="numeric" value={formData.battery_level} onChangeText={v => handleInputChange("battery_level", v)} />
                                </View>
                                <View style={pg.formGroup}>
                                    <Text style={pg.formLabel}>Signal Strength</Text>
                                    <View style={pg.segmentRow}>
                                        {["strong", "medium", "weak"].map(s => (
                                            <TouchableOpacity key={s} style={[pg.segment, formData.signal_strength === s && pg.segmentActive]}
                                                onPress={() => handleInputChange("signal_strength", s)}>
                                                <Text style={[pg.segmentText, formData.signal_strength === s && pg.segmentTextActive]}>
                                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={pg.modalFooter}>
                            <TouchableOpacity style={pg.cancelBtn} onPress={() => setShowRegistrationModal(false)}>
                                <Text style={pg.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={pg.submitBtn} onPress={handleRegisterSensor} disabled={loading}>
                                {loading ? <ActivityIndicator size="small" color="#fff" /> : (
                                    <>
                                        <Feather name="check" size={16} color="#fff" style={{ marginRight: 4 }} />
                                        <Text style={pg.submitBtnText}>Register Sensor</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Status Details Modal ─────────────────────────────────────────── */}
            <Modal visible={showStatusModal} transparent animationType="slide">
                <View style={pg.modalOverlay}>
                    <View style={[pg.modalBox, { maxWidth: 500 }]}>
                        {selectedSensorHealth && (() => {
                            const sh = selectedSensorHealth;
                            const isOff = sh.live?.is_offline;
                            const reading_st = isOff ? "OFFLINE" : (sh.live?.reading_status || "NORMAL");
                            const st = getStatusBadge(reading_st);
                            const lastSeen = sh.live?.last_seen ? new Date(sh.live.last_seen).toLocaleString() : "Unknown";

                            return (
                                <>
                                    <LinearGradient colors={isOff ? ["#475569", "#1e293b"] : ["#001D39", "#0A4174"]} style={pg.modalHeader}>
                                        <View>
                                            <Text style={pg.modalTitle}>{sh.name}</Text>
                                            <Text style={{ fontSize: 13, color: "#94a3b8", fontFamily: "Poppins_400Regular" }}>{sh.id} • Brgy. {sh.barangay}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                                            <Feather name="x" size={22} color="#fff" />
                                        </TouchableOpacity>
                                    </LinearGradient>

                                    <View style={pg.modalBody}>
                                        <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
                                            <View style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" }}>
                                                <Feather name="battery-charging" size={18} color={getBatteryColor(sh.live?.battery_level || sh.battery_level)} />
                                                <Text style={{ fontSize: 11, color: "#64748b", fontFamily: "Poppins_600SemiBold", marginTop: 4 }}>BATTERY</Text>
                                                <Text style={{ fontSize: 20, color: "#0f172a", fontFamily: "Poppins_700Bold" }}>{sh.live?.battery_level || sh.battery_level || 0}%</Text>
                                            </View>
                                            <View style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" }}>
                                                <Feather name="wifi" size={18} color="#3b82f6" />
                                                <Text style={{ fontSize: 11, color: "#64748b", fontFamily: "Poppins_600SemiBold", marginTop: 4 }}>SIGNAL</Text>
                                                <Text style={{ fontSize: 20, color: "#0f172a", fontFamily: "Poppins_700Bold" }}>{sh.live?.signal_strength || sh.signal_strength || "Strong"}</Text>
                                            </View>
                                        </View>

                                        <View style={{ backgroundColor: isOff ? "#f1f5f9" : "#eff6ff", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: isOff ? "#cbd5e1" : "#dbeafe", marginBottom: 16 }}>
                                            <Text style={{ fontSize: 12, color: isOff ? "#64748b" : "#3b82f6", fontFamily: "Poppins_700Bold", letterSpacing: 1 }}>CURRENT FLOOD LEVEL</Text>
                                            <Text style={{ fontSize: 44, color: isOff ? "#94a3b8" : "#1e40af", fontFamily: "Poppins_800ExtraBold", marginVertical: 4 }}>
                                                {isOff ? "—" : `${Number(sh.live?.flood_level || 0).toFixed(1)} cm`}
                                            </Text>
                                            <View style={{ backgroundColor: st.bg, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: st.border }}>
                                                <Text style={{ fontSize: 12, fontFamily: "Poppins_700Bold", color: st.text }}>{reading_st.charAt(0).toUpperCase() + reading_st.slice(1).toLowerCase()}</Text>
                                            </View>
                                        </View>

                                        <View style={{ gap: 12 }}>
                                            <View style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 8 }}>
                                                <Text style={{ fontSize: 13, color: "#64748b", fontFamily: "Poppins_400Regular" }}>Last Seen</Text>
                                                <Text style={{ fontSize: 13, color: "#0f172a", fontFamily: "Poppins_600SemiBold" }}>{lastSeen}</Text>
                                            </View>
                                            <View style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 8 }}>
                                                <Text style={{ fontSize: 13, color: "#64748b", fontFamily: "Poppins_400Regular" }}>Coordinates</Text>
                                                <Text style={{ fontSize: 13, color: "#0f172a", fontFamily: "Poppins_600SemiBold" }}>{sh.lat?.toFixed(6)}, {sh.lng?.toFixed(6)}</Text>
                                            </View>


                                            {sh.description && (
                                                <View style={{ gap: 4 }}>
                                                    <Text style={{ fontSize: 13, color: "#64748b", fontFamily: "Poppins_400Regular" }}>Description</Text>
                                                    <Text style={{ fontSize: 13, color: "#0f172a", fontFamily: "Poppins_400Regular" }}>{sh.description}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <View style={pg.modalFooter}>
                                        <TouchableOpacity style={[pg.submitBtn, { backgroundColor: "#64748b" }]} onPress={() => setShowStatusModal(false)}>
                                            <Text style={pg.submitBtnText}>Done</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={pg.submitBtn} onPress={fetchHealthData}>
                                            <Feather name="refresh-cw" size={16} color="#fff" style={{ marginRight: 4 }} />
                                            <Text style={pg.submitBtnText}>Refresh Data</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            );
                        })()}
                    </View>
                </View>
            </Modal>

            {/* ── Success Modal ────────────────────────────────────────────── */}
            <Modal visible={showSuccessModal} transparent animationType="fade">
                <View style={pg.modalOverlay}>
                    <View style={[pg.modalBox, { maxWidth: 400, padding: 32, alignItems: "center" }]}>
                        <div style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <Feather name="check-circle" size={32} color="#16a34a" />
                        </div>
                        <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: "#0f172a", marginBottom: 8, textAlign: "center" }}>Success!</Text>
                        <Text style={{ fontSize: 14, fontFamily: "Poppins_400Regular", color: "#64748b", textAlign: "center", marginBottom: 24 }}>{successMessage}</Text>
                        <TouchableOpacity style={pg.submitBtn} onPress={() => setShowSuccessModal(false)}>
                            <Text style={pg.submitBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Error Modal ──────────────────────────────────────────────── */}
            <Modal visible={showErrorModal} transparent animationType="fade">
                <View style={pg.modalOverlay}>
                    <View style={[pg.modalBox, { maxWidth: 400, padding: 32, alignItems: "center" }]}>
                        <div style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <Feather name="alert-circle" size={32} color="#dc2626" />
                        </div>
                        <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: "#0f172a", marginBottom: 8 }}>Error</Text>
                        <Text style={{ fontSize: 14, fontFamily: "Poppins_400Regular", color: "#64748b", textAlign: "center", marginBottom: 24 }}>{errorMessage}</Text>
                        <TouchableOpacity style={[pg.submitBtn, { backgroundColor: "#dc2626" }]} onPress={() => setShowErrorModal(false)}>
                            <Text style={pg.submitBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ── Page-level styles (matching the existing system design) ────────────────
const pg = StyleSheet.create({
    // Tabs
    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: "#fff", paddingHorizontal: 24 },
    tabItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, gap: 4, borderBottomWidth: 2, borderBottomColor: "transparent", marginRight: 4 },
    tabItemActive: { borderBottomColor: "#3b82f6" },
    tabText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: "#64748b" },
    tabTextActive: { color: "#3b82f6" },
    tabBadge: { backgroundColor: "#f59e0b", borderRadius: 16, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    tabBadgeText: { fontSize: 10, fontFamily: "Poppins_700Bold", color: "#fff" },
    // Toolbar
    toolbar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap", zIndex: 1000 },
    searchBox: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 8, minWidth: 200 },
    searchInput: { flex: 1, fontSize: 14, fontFamily: "Poppins_400Regular", color: "#0f172a", outlineStyle: "none" },
    filterBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 8 },
    filterBtnText: { fontSize: 14, fontFamily: "Poppins_400Regular", color: "#64748b" },
    dropdown: { position: "absolute", top: 48, right: 0, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", zIndex: 9999, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, minWidth: 160 },
    dropdownItem: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
    dropdownItemText: { fontSize: 14, fontFamily: "Poppins_400Regular", color: "#0f172a" },
    registerBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#3b82f6", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8 },
    registerBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
    resultsCount: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#94a3b8", marginBottom: 16 },
    // Sensor Card Grid
    cardGrid: { flexDirection: "column", gap: 16 },
    sensorCard: { 
        backgroundColor: "#fff", 
        borderRadius: 16, 
        borderWidth: 1, 
        borderColor: "#e2e8f0", 
        overflow: "hidden", 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06, 
        shadowRadius: 12, 
        elevation: 4 
    },
    cardAccent: { height: 3, width: "100%" },
    cardHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16, paddingBottom: 12 },
    sensorName: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#0f172a" },
    sensorMeta: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#94a3b8" },
    sensorId: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#94a3b8" },
    cardDivider: { height: 1, backgroundColor: "#f1f5f9" },
    cardStats: { flexDirection: "row", padding: 12, gap: 0 },
    statItem: { flex: 1, alignItems: "center", gap: 4 },
    statDivider: { width: 1, backgroundColor: "#f1f5f9" },
    statLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#94a3b8" },
    statValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#0f172a" },
    cardDesc: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748b" },
    cardFooter: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingBottom: 12 },
    cardFooterText: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#94a3b8" },
    // Shared badge
    badge: { borderRadius: 16, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8, alignSelf: "flex-start" },
    badgeText: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },
    deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center" },
    // Empty state
    emptyState: { alignItems: "center", paddingVertical: 64 },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", marginBottom: 16 },
    emptyTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#475569", marginBottom: 4 },
    emptySubtitle: { fontSize: 14, fontFamily: "Poppins_400Regular", color: "#94a3b8", textAlign: "center" },
    // Health Tab
    healthSummaryRow: { flexDirection: "row", gap: 16, marginBottom: 24, flexWrap: "wrap" },
    healthCard: { 
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
    healthCardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    healthCardValue: { fontSize: 24, fontFamily: "Poppins_700Bold", color: "#0f172a", marginBottom: 4, textAlign: "center" },
    healthCardLabel: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#64748b", textAlign: "center" },
    panelCard: { 
        backgroundColor: "#fff", 
        borderRadius: 16, 
        borderWidth: 1, 
        borderColor: "#e2e8f0", 
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4
    },
    panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
    panelTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#0f172a" },
    refreshBtn: { flexDirection: "row", alignItems: "center", padding: 8 },
    refreshBtnText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#64748b" },
    tableHead: { flexDirection: "row", backgroundColor: "#f8fafc", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
    tableHeadCell: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
    tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 0 },
    tableRowStripe: { backgroundColor: "#f8fafc" },
    tableCell: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#475569" },
    tableCellBold: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#0f172a" },
    tableCellSub: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#94a3b8" },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
    modalBox: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", width: "100%", maxWidth: 680, maxHeight: "90%", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, elevation: 10 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24 },
    modalTitle: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#fff" },
    modalBody: { padding: 24 },
    modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
    // Form
    formGrid: { flexDirection: "row", gap: 16 },
    formGroup: { flex: 1, marginBottom: 16 },
    formLabel: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#374151", marginBottom: 4 },
    formInput: { borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, fontFamily: "Poppins_400Regular", color: "#0f172a", backgroundColor: "#f8fafc", outlineStyle: "none" },
    segmentRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    segment: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    segmentActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
    segmentText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#64748b" },
    segmentTextActive: { color: "#3b82f6" },
    cancelBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, borderWidth: 1.5, borderColor: "#e2e8f0" },
    cancelBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#475569" },
    submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#3b82f6", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 24 },
    submitBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
});

export default ManageSensorsPage;
