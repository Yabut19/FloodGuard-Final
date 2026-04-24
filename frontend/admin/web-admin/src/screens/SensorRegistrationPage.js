import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, StyleSheet, Platform, Animated, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";
import { formatPST } from "../utils/dateUtils";
import { authFetch } from "../utils/helpers";
import useSensorSocket from "../utils/useSensorSocket";
import TopRightStatusIndicator from "../components/TopRightStatusIndicator";

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
    const [togglingId, setTogglingId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [sensorToDelete, setSensorToDelete] = useState(null);
    const healthIntervalRef = useRef(null);

    const [formData, setFormData] = useState({
        id: "", name: "", barangay: "", description: "",
        lat: "", lng: "", status: "active",
        battery_level: "100", signal_strength: "strong"
    });

    // Map state
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
                marker.bindPopup(`<b>${s.name}</b><br>Brgy. ${s.barangay || "—"}</br>Status: ${status.toUpperCase()}<br>Flood: ${s.flood_level || 0}cm<br>${s.is_offline ? '<span style="color:red">⚠️ OFFLINE</span>' : '<span style="color:green">✅ ONLINE</span>'}`);
                marker.on('click', () => setSelectedSensor(s.id));
            } catch (e) { }
        });
    }, [liveSensors, activeTab]);

    // Get auth headers for API calls
    const getAuthHeaders = () => {
        const token = localStorage.getItem("authToken");
        return {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
        };
    };

    const showErr = (msg) => {
        setErrorMessage(msg);
        setShowErrorModal(true);
    };

    const resetForm = () => {
        setFormData({
            id: "", name: "", barangay: "", description: "",
            lat: "", lng: "", status: "active",
            battery_level: "100", signal_strength: "strong"
        });
    };

    const handleInputChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleRegisterSensor = async () => {
        if (!formData.id || !formData.name || !formData.barangay || !formData.lat || !formData.lng) {
            showErr("Please fill in all required fields marked with *");
            return;
        }
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/api/iot/registers-sensor`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessMessage(`Sensor "${formData.name}" registered successfully!`);
                setShowSuccessModal(true);
                setShowRegistrationModal(false);
                resetForm();
                fetchSensors();
                fetchHealthData();
            } else {
                showErr(data.error || "Failed to register sensor");
            }
        } catch (e) {
            showErr("Network error while registering sensor");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSensor = async (id) => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/api/iot/sensors/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setSuccessMessage("Sensor deleted successfully");
                setShowSuccessModal(true);
                setShowDeleteModal(false);
                setSensorToDelete(null);
                fetchSensors();
                fetchHealthData();
            } else {
                const data = await res.json();
                showErr(data.error || "Failed to delete sensor");
            }
        } catch (e) {
            showErr("Network error while deleting sensor");
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = () => {
        if (sensorToDelete) {
            handleDeleteSensor(sensorToDelete.id);
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setSensorToDelete(null);
    };

    const fetchSensors = async () => {
    setLoading(true);
    try {
        const res = await authFetch(`${API_BASE_URL}/api/iot/sensors`);
        const data = await res.json();
        if (res.ok) setSensors(data.sensors || []);
    } catch (e) { console.warn("fetchSensors error", e); }
    finally { setLoading(false); }
};

// Fetch live health data with safe initialization
const fetchHealthData = async (preserveLiveState = false) => {
    setHealthLoading(true);
    try {
        const res = await authFetch(`${API_BASE_URL}/api/iot/sensors/status-all`);
        if (res.ok) {
            const data = await res.json();
            if (preserveLiveState) {
                // Preserve existing live/disconnected state, only update other fields
                setLiveSensors(prev => {
                    if (!Array.isArray(prev)) return [];
                    return prev.map(existingSensor => {
                        const apiSensor = Array.isArray(data) ? data.find(s => s.id === existingSensor.id) : null;
                        if (!apiSensor) return existingSensor;
                        
                        return {
                            ...existingSensor,
                            // Preserve live state and last_seen
                            is_live: existingSensor.is_live,
                            is_offline: existingSensor.is_offline,
                            last_seen: existingSensor.last_seen,
                            // Update other fields from API
                            flood_level: apiSensor.flood_level,
                            raw_distance: apiSensor.raw_distance,
                            reading_status: apiSensor.reading_status,
                            enabled: apiSensor.enabled,
                        };
                    });
                });
            } else {
                // Initial load - ensure all sensors default to Disconnected
                const initializedData = Array.isArray(data) ? data.map(sensor => ({
                    ...sensor,
                    is_live: false, // Default to Disconnected
                    is_offline: true,
                    last_seen: null, // No last_seen until real data arrives
                })) : [];
                setLiveSensors(initializedData);
            }
        }
    } catch (e) { console.warn("fetchHealthData error", e); }
    finally { setHealthLoading(false); }
};

useEffect(() => {
    // Add error boundary for data fetching
    try {
        fetchSensors();
        fetchHealthData(); // Initial load with default Disconnected state
        // Set up periodic fetching with preserveLiveState=true to maintain status
        healthIntervalRef.current = setInterval(() => fetchHealthData(true), 30000);
    } catch (error) {
        console.warn("Error in initial data loading:", error);
    }
    return () => { 
        if (healthIntervalRef.current) {
            clearInterval(healthIntervalRef.current); 
        }
    };
}, []);

// Timeout mechanism to mark sensors as Disconnected when data stops
const timeoutRef = useRef(null);
    
useEffect(() => {
    // Check for sensors that haven't sent data recently (timeout after 1 second)
    const checkSensorTimeouts = () => {
        setLiveSensors(prev => {
            if (!Array.isArray(prev)) return [];
            const now = new Date();
            const timeoutMs = 30000; // 30 seconds
            
            let changed = false;
            const updated = prev.map(s => {
                if (!s) return s;
                
                // If sensor was Live but hasn't sent data recently, mark as Disconnected
                if (s.is_live && s.last_seen) {
                    const lastSeenTime = new Date(s.last_seen);
                    const timeSinceLastData = now - lastSeenTime;
                    
                    if (timeSinceLastData > timeoutMs) {
                        changed = true;
                        return {
                            ...s,
                            is_live: false, // Mark as Disconnected
                            is_offline: true,
                            flood_level: 0,
                            raw_distance: 0,
                        };
                    }
                }
                
                return s;
            });
            
            return changed ? updated : prev;
        });
    };
    
    // Run timeout check every 500ms for "zero delay" perception
    timeoutRef.current = setInterval(checkSensorTimeouts, 500);
    
    return () => {
        if (timeoutRef.current) {
            clearInterval(timeoutRef.current);
        }
    };
}, []);

// Real-time WebSocket: instantly patch readings without polling
useSensorSocket((reading) => {
    if (!reading || !reading.sensor_id) return;
    
    try {
        setLiveSensors(prev => {
            if (!Array.isArray(prev)) return [];
            return prev.map(s => {
                if (!s || s.id !== reading.sensor_id) return s;
                // Sensor is Live only when actively sending data
                return {
                    ...s,
                    flood_level: Number(reading.flood_level ?? 0),
                    raw_distance: Number(reading.raw_distance ?? 0),
                    reading_status: reading.status || s.reading_status,
                    is_live: true, // Set to Live when receiving data
                    enabled: reading.enabled ?? true,
                    is_offline: false, // Not offline when receiving data
                    last_seen: new Date().toISOString(), // Track when data was last received
                };
            });
        });
        
        // Also auto-update the selected sensor health modal if open
        setSelectedSensorHealth(prev => {
            if (!prev || prev.id !== reading.sensor_id) return prev;
            return {
                ...prev,
                live: {
                    ...prev.live,
                    flood_level: Number(reading.flood_level ?? 0),
                    raw_distance: Number(reading.raw_distance ?? 0),
                    reading_status: reading.status,
                    is_live: true, // Set to Live when receiving data
                    enabled: reading.enabled ?? true,
                    is_offline: false, // Not offline when receiving data
                    last_seen: new Date().toISOString(), // Track when data was last received
                }
            };
        });
    } catch (error) {
        console.error("Error processing WebSocket update:", error);
    }
}, () => {
    console.log("[SensorRegistration] Thresholds changed, refreshing health data...");
    fetchHealthData(true);
});

// Animation for blinking dots
const blinkAnim = useRef(new Animated.Value(1)).current;
useEffect(() => {
    const animation = Animated.loop(
        Animated.sequence([
            Animated.timing(blinkAnim, { toValue: 0.2, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(blinkAnim, { toValue: 1, duration: 1000, useNativeDriver: Platform.OS !== 'web' })
        ])
    );
    animation.start();
    return () => animation.stop();
}, []);

const handleToggleSensor = async (sensor, enabled) => {
    setTogglingId(sensor.id);
    try {
        const res = await authFetch(`${API_BASE_URL}/api/iot/sensors/${sensor.id}/toggle`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled })
        });
        const data = await res.json();
        if (res.ok) {
            // Update enabled state and suppress data if OFF
            setLiveSensors(prev => {
                if (!Array.isArray(prev)) return [];
                return prev.map(s => {
                    if (!s || s.id !== sensor.id) return s;
                    return {
                        ...s,
                        enabled: enabled,
                        // If sensor is turned OFF, suppress all data display
                        flood_level: enabled ? s.flood_level : 0,
                        raw_distance: enabled ? s.raw_distance : 0,
                        reading_status: enabled ? s.reading_status : null,
                        // Preserve is_live and is_offline status
                    };
                });
            });
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
    const isLive = live && live.is_live;
    const isEnabled = live && live.enabled !== false;

    let matchStatus = true;
    if (statusFilter === "Live") matchStatus = isLive;
    else if (statusFilter === "Disconnected") matchStatus = !isLive;
    else if (statusFilter === "Advisory") matchStatus = isLive && isEnabled && live?.reading_status === "ADVISORY";
    else if (statusFilter === "Warning") matchStatus = isLive && isEnabled && live?.reading_status === "WARNING";
    else if (statusFilter === "Critical") matchStatus = isLive && isEnabled && (live?.reading_status === "ALARM" || live?.reading_status === "CRITICAL");
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
        ADVISORY: { bg: "#eff6ff", text: "#3b82f6", border: "#dbeafe" },
        WARNING: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
        CRITICAL: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
    };
    return map[status] || { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" };
};

const getBatteryColor = (level) => {
    if (!level || level === "No Signal") return "#94a3b8";
    const n = parseInt(level);
    if (n >= 80) return "#16a34a";
    if (n >= 40) return "#f59e0b";
    return "#dc2626";
};

// Computed health summary
const totalSensors = liveSensors.length;
const onlineSensors = liveSensors.filter(s => s.is_live).length;
const offlineSensors = liveSensors.filter(s => !s.is_live).length;
const advisorySensors = liveSensors.filter(s => s.is_live && s.enabled && s.reading_status === "ADVISORY").length;
const warningSensors = liveSensors.filter(s => s.is_live && s.enabled && s.reading_status === "WARNING").length;
const criticalSensors = liveSensors.filter(s => s.is_live && s.enabled && (s.reading_status === "ALARM" || s.reading_status === "CRITICAL")).length;



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
                        <TopRightStatusIndicator />
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

                {/* TAB 0: SENSOR MAP */}
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
                                const isLive = sel.is_live;
                                const isEnabled = sel.enabled !== false;
                                const isNormal = isLive && isEnabled && (sel.reading_status === "NORMAL" || !sel.reading_status);
                                    const isOffline = !isLive || !isEnabled;
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
                                                { alignSelf: 'flex-start', backgroundColor: isNormal ? '#DDF6D2' : !isLive ? '#f1f5f9' : '#fee2e2' }
                                            ]}>
                                                <Text style={[
                                                    styles.dashboardSensorStatusText,
                                                    { color: isNormal ? '#166534' : !isLive ? '#64748b' : '#dc2626' }
                                                ]}>{isLive ? "Live" : "Disconnected"}</Text>
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
                                                    <Text style={{ color: (!isLive || !isEnabled) ? '#94a3b8' : '#1e40af', fontSize: 22, fontFamily: 'Poppins_700Bold', marginTop: 2 }}>
                                                        {(isLive && isEnabled) ? Number(sel.flood_level || 0).toFixed(1) : "0.0"} cm
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
                                                    {s.is_live && s.enabled ? (
                                                        <Text style={{ fontSize: 10, color: "#16a34a", fontFamily: "Poppins_700Bold" }}>Live</Text>
                                                    ) : (
                                                        <Text style={{ fontSize: 10, color: "#94a3b8", fontFamily: "Poppins_700Bold" }}>Disconnected</Text>
                                                    )}
                                                    {s.is_live && s.enabled && (
                                                        <>
                                                            <Text style={{ fontSize: 12, color: "#3b82f6", marginTop: 2, fontFamily: "Poppins_600SemiBold" }}>
                                                                Flood: {Number(s.flood_level || 0).toFixed(1)} cm
                                                            </Text>
                                                            <Text style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                                                                Raw dist: {Number(s.raw_distance || 0).toFixed(1)} cm
                                                            </Text>
                                                        </>
                                                    )}
                                                </View>
                                                {!s.is_live ? (
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
                    {/* TAB 1: REGISTERED SENSORS */}
                    {activeTab === "sensors" && (
                        <View>
                            {/* Consolidated Health Summary */}
                            <View style={[pg.healthSummaryRow, { marginBottom: 16 }]}>
                                {[
                                    { icon: "check-circle", label: "Live", value: onlineSensors, color: "#16a34a", bg: "rgba(22, 163, 74, 0.1)" },
                                    { icon: "x-circle", label: "Disconnected", value: offlineSensors, color: "#64748b", bg: "rgba(100, 116, 139, 0.1)" },
                                    { icon: "info", label: "Advisory", value: advisorySensors, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
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
                                                {["All Status", "Live", "Disconnected", "Advisory", "Warning", "Critical"].map(s => (
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
                                        const isLive = live && live.is_live;
                                        const isEnabled = live && live.enabled !== false;
                                        const isWarning = isLive && isEnabled && (live?.reading_status === "WARNING" || live?.reading_status === "CRITICAL");
                                        const statusColor = isWarning ? "#ef4444" : isLive ? "#22c55e" : "#64748b";

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
                                                             <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                                                <Animated.View style={{ 
                                                                    width: 7, 
                                                                    height: 7, 
                                                                    borderRadius: 3.5, 
                                                                    backgroundColor: statusColor, 
                                                                    opacity: isLive ? blinkAnim : 1 
                                                                }} />
                                                                <Text style={{ 
                                                                    fontSize: 10, 
                                                                    color: statusColor, 
                                                                    fontFamily: "Poppins_700Bold",
                                                                    letterSpacing: 0.5
                                                                }}>
                                                                    {isLive ? "Live" : "Disconnected"}
                                                                </Text>
                                                            </View>
                                                            <Text style={[pg.sensorName, { textAlign: 'center' }]}>{sensor.name}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8 }}>
                                                            <Feather name="map-pin" size={11} color="#94a3b8" />
                                                            <Text style={pg.sensorMeta}>Brgy. {sensor.barangay || "—"}</Text>
                                                            <Text style={pg.sensorId}>• {sensor.id}</Text>
                                                        </View>
                                                    </View>
                                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                                        {isLive && (
                                                            <Switch
                                                                value={isEnabled}
                                                                onValueChange={(val) => {
                                                                    handleToggleSensor(sensor, val);
                                                                }}
                                                                disabled={togglingId === sensor.id}
                                                                trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                                                                thumbColor={isEnabled ? "#16a34a" : "#94a3b8"}
                                                            />
                                                        )}
                                                        {isSuperAdmin && (
                                                            <TouchableOpacity 
                                                                style={pg.deleteBtn} 
                                                                onPress={(e) => { 
                                                                    e.stopPropagation?.(); 
                                                                    setSensorToDelete(sensor);
                                                                    setShowDeleteModal(true);
                                                                }}
                                                            >
                                                                <Feather name="trash-2" size={15} color="#dc2626" />
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                </View>

                                                <View style={pg.cardDivider} />

                                                {/* Live Data Row - updates via SSE */}
                                                <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
                                                    <View style={{
                                                        flex: 1, backgroundColor: (isLive && isEnabled) ? "#eff6ff" : "#f8fafc",
                                                        borderRadius: 10, padding: 10, alignItems: "center",
                                                        borderWidth: 1, borderColor: (isLive && isEnabled) ? "#dbeafe" : "#e2e8f0"
                                                    }}>
                                                        <Text style={{ fontSize: 10, color: "#64748b", fontFamily: "Poppins_600SemiBold", letterSpacing: 0.5 }}>FLOOD LEVEL</Text>
                                                        <Text style={{ fontSize: 22, color: (isLive && isEnabled) ? "#1e40af" : "#94a3b8", fontFamily: "Poppins_700Bold", marginTop: 2 }}>
                                                            {(isLive && isEnabled) ? `${Number(live?.flood_level || 0).toFixed(1)}` : "0.0"}
                                                        </Text>
                                                        <Text style={{ fontSize: 10, color: "#94a3b8" }}>cm</Text>
                                                    </View>
                                                    <View style={{
                                                        flex: 1, backgroundColor: (isLive && isEnabled) ? "#f0f9ff" : "#f8fafc",
                                                        borderRadius: 10, padding: 10, alignItems: "center",
                                                        borderWidth: 1, borderColor: (isLive && isEnabled) ? "#bae6fd" : "#e2e8f0"
                                                    }}>
                                                        <Text style={{ fontSize: 10, color: "#64748b", fontFamily: "Poppins_600SemiBold", letterSpacing: 0.5 }}>RAW DISTANCE</Text>
                                                        <Text style={{ fontSize: 22, color: (isLive && isEnabled) ? "#0284c7" : "#94a3b8", fontFamily: "Poppins_700Bold", marginTop: 2 }}>
                                                            {(isLive && isEnabled) ? `${Number(live?.raw_distance || 0).toFixed(1)}` : "0.0"}
                                                        </Text>
                                                        <Text style={{ fontSize: 10, color: "#94a3b8" }}>cm</Text>
                                                    </View>
                                                </View>

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

            {/* Registration Modal */}
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

            {/* Status Details Modal */}
            <Modal visible={showStatusModal} transparent animationType="slide">
                <View style={pg.modalOverlay}>
                    <View style={[pg.modalBox, { maxWidth: 500 }]}>
                        {selectedSensorHealth && (() => {
                            const sh = selectedSensorHealth;
                            const isLive = sh.live?.is_live;
                            const isEnabled = sh.live?.enabled !== false;
                            const isDisconnected = !isLive;
                            const isSoftwareOff = !isEnabled;
                            const isSuppressed = isDisconnected || isSoftwareOff;
                            
                            const reading_st = isDisconnected ? "Disconnected" : (isSoftwareOff ? "OFF" : (sh.live?.reading_status || "NORMAL"));
                            const st = getStatusBadge(reading_st);
                            const lastSeen = sh.live?.last_seen ? formatPST(sh.live.last_seen) : "Unknown";

                            return (
                                <>
                                    <LinearGradient colors={isDisconnected ? ["#475569", "#1e293b"] : (isSoftwareOff ? ["#64748b", "#475569"] : ["#001D39", "#0A4174"])} style={pg.modalHeader}>
                                        <View>
                                            <Text style={pg.modalTitle}>{sh.name}</Text>
                                            <Text style={{ fontSize: 13, color: "#94a3b8", fontFamily: "Poppins_400Regular" }}>{sh.id} • Brgy. {sh.barangay}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                                            <Feather name="x" size={22} color="#fff" />
                                        </TouchableOpacity>
                                    </LinearGradient>

                                    <View style={pg.modalBody}>
                                        {/* Flood Level + Raw Distance - live via SSE */}
                                        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                                            <View style={{ flex: 1, backgroundColor: isSuppressed ? "#f1f5f9" : "#eff6ff", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: isSuppressed ? "#cbd5e1" : "#dbeafe" }}>
                                                <Feather name="trending-up" size={16} color={isSuppressed ? "#94a3b8" : "#3b82f6"} />
                                                <Text style={{ fontSize: 11, color: isSuppressed ? "#94a3b8" : "#3b82f6", fontFamily: "Poppins_700Bold", letterSpacing: 0.5, marginTop: 4 }}>FLOOD LEVEL</Text>
                                                <Text style={{ fontSize: 36, color: isSuppressed ? "#94a3b8" : "#1e40af", fontFamily: "Poppins_800ExtraBold", marginVertical: 2 }}>
                                                    {isSuppressed ? "0.0" : Number(sh.live?.flood_level ?? 0).toFixed(1)}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: "#94a3b8" }}>cm depth</Text>
                                            </View>
                                            <View style={{ flex: 1, backgroundColor: isSuppressed ? "#f1f5f9" : "#f0f9ff", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: isSuppressed ? "#cbd5e1" : "#bae6fd" }}>
                                                <Feather name="radio" size={16} color={isSuppressed ? "#94a3b8" : "#0284c7"} />
                                                <Text style={{ fontSize: 11, color: isSuppressed ? "#94a3b8" : "#0284c7", fontFamily: "Poppins_700Bold", letterSpacing: 0.5, marginTop: 4 }}>RAW DISTANCE</Text>
                                                <Text style={{ fontSize: 36, color: isSuppressed ? "#94a3b8" : "#0284c7", fontFamily: "Poppins_800ExtraBold", marginVertical: 2 }}>
                                                    {isSuppressed ? "0.0" : Number(sh.live?.raw_distance ?? 0).toFixed(1)}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: "#94a3b8" }}>cm to ground</Text>
                                            </View>
                                        </View>

                                         {/* Alert level badge */}
                                        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 16, paddingHorizontal: 4 }}>
                                            <View style={{ backgroundColor: st.bg, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: st.border }}>
                                                <Text style={{ fontSize: 13, fontFamily: "Poppins_700Bold", color: st.text }}>{reading_st}</Text>
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

            {/* Delete Confirmation Modal */}
            <Modal visible={showDeleteModal} transparent animationType="fade">
                <View style={pg.modalOverlay}>
                    <View style={[pg.modalBox, { maxWidth: 400, padding: 32, alignItems: "center" }]}>
                        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <Feather name="trash-2" size={32} color="#dc2626" />
                        </View>
                        <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: "#0f172a", marginBottom: 8, textAlign: "center" }}>Delete Sensor?</Text>
                        <Text style={{ fontSize: 14, fontFamily: "Poppins_400Regular", color: "#64748b", textAlign: "center", marginBottom: 24 }}>
                            Are you sure you want to delete <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#0f172a" }}>{sensorToDelete?.name}</Text>? This action cannot be undone.
                        </Text>
                        <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
                            <TouchableOpacity style={[pg.cancelBtn, { flex: 1 }]} onPress={cancelDelete}>
                                <Text style={pg.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[pg.submitBtn, { flex: 1, backgroundColor: "#dc2626" }]} 
                                onPress={confirmDelete}
                                disabled={loading}
                            >
                                {loading ? <ActivityIndicator size="small" color="#fff" /> : (
                                    <Text style={pg.submitBtnText}>Delete</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showSuccessModal} transparent animationType="fade">
                <View style={pg.modalOverlay}>
                    <View style={[pg.modalBox, { maxWidth: 400, padding: 32, alignItems: "center" }]}>
                        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <Feather name="check-circle" size={32} color="#16a34a" />
                        </View>
                        <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: "#0f172a", marginBottom: 8, textAlign: "center" }}>Success!</Text>
                        <Text style={{ fontSize: 14, fontFamily: "Poppins_400Regular", color: "#64748b", textAlign: "center", marginBottom: 24 }}>{successMessage}</Text>
                        <TouchableOpacity style={pg.submitBtn} onPress={() => setShowSuccessModal(false)}>
                            <Text style={pg.submitBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/* Error Modal */}
            <Modal visible={showErrorModal} transparent animationType="fade">
                <View style={pg.modalOverlay}>
                    <View style={[pg.modalBox, { maxWidth: 400, padding: 32, alignItems: "center" }]}>
                        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <Feather name="alert-circle" size={32} color="#dc2626" />
                        </View>
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

// Page-level styles (matching the existing system design)
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
    dropdown: { position: "absolute", top: 48, right: 0, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", zIndex: 9999, boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)", elevation: 10, minWidth: 160 },
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
        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.06)",
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
        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.06)",
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
        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.06)",
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
    modalBox: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", width: "100%", maxWidth: 680, maxHeight: "90%", boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.2)", elevation: 10 },
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