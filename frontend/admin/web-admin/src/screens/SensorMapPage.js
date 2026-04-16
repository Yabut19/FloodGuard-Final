import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Platform, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { MABOLO_REGION } from "../config/constants";
import { API_BASE_URL } from "../config/api";

const SensorMapPage = ({ onNavigate, onLogout, userRole = "lgu" }) => {
    const [selectedSensor, setSelectedSensor] = useState(null);
    const [sensorData, setSensorData] = useState([]);
    const [loading, setLoading] = useState(true);

    // API base URL
    const API_BASE = API_BASE_URL;

    // Fetch sensor data from backend
    const fetchSensorData = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/iot/sensors/status-all`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Transform the data to match our expected format
            const transformedData = data.map(s => ({
                sensor_id: s.id,
                name: s.name,
                barangay: s.barangay || "Active Area",
                latitude: s.lat || MABOLO_REGION.latitude,
                longitude: s.lng || MABOLO_REGION.longitude,
                status: s.reading_status?.toLowerCase() || s.status.toLowerCase(),
                risk_level: (s.reading_status || "").toLowerCase() === "normal" ? "low" :
                    (s.reading_status || "").toLowerCase() === "warning" ? "elevated" : "high",
                flood_level: s.flood_level || 0,
                last_updated: s.last_seen ? new Date(s.last_seen).toLocaleString() : "No data",
                is_offline: s.is_offline
            }));

            setSensorData(transformedData);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch sensor data:", error);
            setLoading(false);
        }
    };

    // Fetch data on component mount and set up polling
    useEffect(() => {
        fetchSensorData();
        const interval = setInterval(fetchSensorData, 5000); // Update every 5 seconds
        return () => clearInterval(interval);
    }, []);

    // ── Animation for blinking dots ───────────────────────────────
    const blinkAnim = React.useRef(new Animated.Value(1)).current;
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

    // Setup Leaflet.js for fully interactive map with anchored markers (free, no API key needed)
    useEffect(() => {
        if (Platform.OS !== "web" || typeof document === "undefined" || typeof window === "undefined") {
            return;
        }

        let mapInstance = null;
        let checkInterval = null;
        let timeoutId = null;

        const getStatusColorLocal = (status, is_offline) => {
            if (is_offline) return "#64748b";
            switch (status?.toLowerCase()) {
                case "normal": return "#16a34a";
                case "warning": return "#f59e0b";
                case "alarm":
                case "critical": return "#dc2626";
                default: return "#64748b";
            }
        };

        const initializeMap = () => {
            try {
                const container = document.getElementById("google-map-container");
                if (!container) {
                    console.warn("Map container not found");
                    return;
                }

                if (!window.L) {
                    console.warn("Leaflet not loaded yet");
                    return;
                }

                container.innerHTML = "";

                // Ensure container has proper dimensions for Leaflet
                if (container.offsetHeight === 0) {
                    container.style.height = "600px";
                }

                // Create Leaflet map
                mapInstance = window.L.map(container, {
                    center: [MABOLO_REGION.latitude, MABOLO_REGION.longitude],
                    zoom: 16,
                    zoomControl: true,
                });

                // Invalidate size to ensure proper rendering
                setTimeout(() => {
                    if (mapInstance) {
                        mapInstance.invalidateSize();
                    }
                }, 100);

                // Add OpenStreetMap tile layer
                window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19,
                }).addTo(mapInstance);

                // Store mapInstance in window for access from marker update effect
                window.sensorMapInstance = mapInstance;
            } catch (error) {
                console.error("Map initialization error:", error);
            }
        };

        const loadLeaflet = () => {
            try {
                // Check if Leaflet is already loaded
                if (window.L && window.L.map) {
                    initializeMap();
                    return;
                }

                // Check if scripts are already in DOM
                const existingCSS = document.querySelector('link[href*="leaflet.css"]');
                const existingJS = document.querySelector('script[src*="leaflet.js"]');

                if (existingCSS && existingJS) {
                    // Wait for it to load
                    let attempts = 0;
                    checkInterval = setInterval(() => {
                        attempts++;
                        if (window.L && window.L.map) {
                            clearInterval(checkInterval);
                            initializeMap();
                        } else if (attempts > 30) {
                            clearInterval(checkInterval);
                            console.error("Leaflet failed to load");
                        }
                    }, 200);
                    return;
                }

                // Load Leaflet CSS
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
                link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
                link.crossOrigin = "";
                document.head.appendChild(link);

                // Load Leaflet JS
                const script = document.createElement("script");
                script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
                script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
                script.crossOrigin = "";
                script.async = true;
                script.defer = true;

                script.onload = () => {
                    setTimeout(() => {
                        if (window.L && window.L.map) {
                            initializeMap();
                        } else {
                            console.error("Leaflet loaded but not available");
                        }
                    }, 100);
                };

                script.onerror = () => {
                    console.error("Failed to load Leaflet");
                };

                document.head.appendChild(script);
            } catch (error) {
                console.error("Error loading Leaflet:", error);
            }
        };

        timeoutId = setTimeout(loadLeaflet, 200);

        return () => {
            try {
                if (timeoutId) clearTimeout(timeoutId);
                if (checkInterval) clearInterval(checkInterval);
                if (mapInstance) {
                    mapInstance.remove();
                    window.sensorMapInstance = null;
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    }, []);

    // Update markers when sensor data changes
    useEffect(() => {
        if (Platform.OS !== "web" || typeof document === "undefined" || typeof window === "undefined") {
            return;
        }

        const mapInstance = window.sensorMapInstance;
        if (!mapInstance || !window.L) {
            return;
        }

        const getStatusColorLocal = (status) => {
            switch (status?.toLowerCase()) {
                case "normal":
                    return "#16a34a";
                case "warning":
                    return "#f59e0b";
                case "alarm":
                case "critical":
                    return "#dc2626";
                case "error":
                    return "#64748b";
                default:
                    return "#64748b";
            }
        };

        // Remove all existing layers that are circles or popups
        mapInstance.eachLayer((layer) => {
            if (layer instanceof window.L.CircleMarker || layer instanceof window.L.Marker) {
                mapInstance.removeLayer(layer);
            }
        });

        // Add new markers from sensorData
        sensorData.forEach((sensor) => {
            try {
                const color = getStatusColorLocal(sensor.status);
                const marker = window.L.circleMarker([sensor.latitude, sensor.longitude], {
                    radius: 12,
                    fillColor: color,
                    color: "#ffffff",
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1,
                }).addTo(mapInstance);

                const popupContent = `
                    <div style="font-family: sans-serif; padding: 4px;">
                        <b style="font-size: 14px;">Sensor ${sensor.sensor_id}</b><br>
                        <span style="color: #64748b; font-size: 12px;">Barangay Mabolo</span><hr style="border:0; border-top:1px solid #eee; margin: 8px 0;">
                        <div style="margin-bottom: 4px;">Status: <span style="font-weight: 600; color: ${color};">${sensor.status.charAt(0).toUpperCase() + sensor.status.slice(1).toLowerCase()}</span></div>
                        <div style="margin-bottom: 4px;">Flood Level: <b>${sensor.flood_level}cm</b></div>
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">Last Updated: ${sensor.last_updated}</div>
                        ${sensor.is_offline ? '<span style="color: #64748b;">🔘 Offline</span>' : '<span>● Online</span>'}
                    </div>
                `;

                marker.bindPopup(popupContent);

                marker.on('click', () => {
                    setSelectedSensor(sensor.sensor_id);
                    mapInstance.setView([sensor.latitude, sensor.longitude], 17);
                });
            } catch (markerError) {
                console.error("Error creating marker:", markerError);
            }
        });
    }, [sensorData]);



    // Helper function to get status color
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case "normal":
                return "#16a34a"; // Green
            case "warning":
                return "#f59e0b"; // Yellow/Orange
            case "alarm":
            case "critical":
                return "#dc2626"; // Red
            case "error":
                return "#64748b"; // Gray
            default:
                return "#64748b"; // Gray
        }
    };

    // Sample sensor data - Barangay Mabolo sensors (positioned within Mabolo area)
    const sensors = sensorData.length > 0 ? sensorData : [
        {
            sensor_id: "sensor-1",
            barangay: "Barangay Mabolo",
            latitude: MABOLO_REGION.latitude,
            longitude: MABOLO_REGION.longitude,
            status: "unknown",
            risk_level: "unknown",
            last_updated: "Loading...",
        }
    ];

    const getStatusDotColor = (status) => {
        switch (status?.toLowerCase()) {
            case "normal":
                return "#16a34a";
            case "warning":
                return "#f59e0b";
            case "alarm":
            case "critical":
                return "#dc2626";
            case "error":
                return "#64748b";
            default:
                return "#64748b";
        }
    };

    try {
        return (
            <View style={styles.dashboardRoot}>
                {/* Sidebar */}
                <AdminSidebar variant={userRole} activePage="sensor-registration" onNavigate={onNavigate} onLogout={onLogout} />

                {/* Main content */}
                <View style={styles.dashboardMain}>
                    {/* Top bar */}
                    <View style={styles.dashboardTopBar}>
                        <View>
                            <Text style={styles.dashboardTopTitle}>Real-Time Sensor Map</Text>
                            <Text style={styles.dashboardTopSubtitle}>
                                Interactive map showing LGU-monitored sensors with live status
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

                    {/* Map and Sensor List Container */}
                    <View style={styles.sensorMapContainer}>
                        {/* Interactive Map Panel */}
                        <View style={styles.mapPanel}>
                            {Platform.OS === "web" ? (
                                // Fully interactive Leaflet map with real markers
                                <View style={styles.mapView}>
                                    <View
                                        nativeID="google-map-container"
                                        style={styles.googleMapContainer}
                                    />
                                </View>
                            ) : (
                                // Placeholder map (react-native-maps is native-only, not supported on web)
                                <View style={styles.mapView}>
                                    <View style={styles.mapPlaceholder}>
                                        <Text style={styles.mapPlaceholderTitle}>Interactive Map</Text>
                                        <Text style={styles.mapPlaceholderSubtitle}>Barangay Mabolo, Cebu City</Text>
                                        <Text style={styles.mapPlaceholderSubtitle}>Real-time sensor locations</Text>
                                        <View style={styles.mapMarkersContainer}>
                                            {sensors.map((sensor, index) => (
                                                <TouchableOpacity
                                                    key={sensor.sensor_id}
                                                    style={[
                                                        styles.sensorMarker,
                                                        {
                                                            backgroundColor: getStatusColor(sensor.status),
                                                            left: `${20 + index * 25}%`,
                                                            top: `${30 + index * 20}%`,
                                                        },
                                                        selectedSensor === sensor.sensor_id && styles.sensorMarkerSelected,
                                                    ]}
                                                    onPress={() => setSelectedSensor(sensor.sensor_id)}
                                                >
                                                    <Feather name="activity" size={16} color="#ffffff" />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Selected Sensor Info Overlay */}
                            {selectedSensor && (
                                <View style={styles.sensorInfoOverlay}>
                                    <TouchableOpacity
                                        style={styles.sensorInfoClose}
                                        onPress={() => setSelectedSensor(null)}
                                    >
                                        <Feather name="x" size={16} color="#64748b" />
                                    </TouchableOpacity>
                                    <View style={{ gap: 12 }}>
                                        <View>
                                            <Text style={styles.sensorInfoTitle}>Sensor {selectedSensor}</Text>
                                            <Text style={styles.sensorInfoText}>Barangay Mabolo, Cebu City</Text>
                                        </View>

                                        {/* Status Badge */}
                                        <View style={styles.sensorInfoStatusRow}>
                                            <View
                                                style={[
                                                    styles.sensorInfoStatusDot,
                                                    {
                                                        backgroundColor: getStatusColor(
                                                            sensors.find((s) => s.sensor_id === selectedSensor)?.status
                                                        ),
                                                    },
                                                ]}
                                            />
                                            <Text style={styles.sensorInfoStatusText}>
                                                {sensors
                                                    .find((s) => s.sensor_id === selectedSensor)
                                                    ?.status.toUpperCase()}
                                            </Text>
                                        </View>

                                        {/* Flood Level */}
                                        {sensors.find((s) => s.sensor_id === selectedSensor)?.flood_level !== undefined && (
                                            <View style={{ backgroundColor: '#f1f5f9', padding: 8, borderRadius: 8 }}>
                                                <Text style={{ color: '#64748b', fontSize: 12, fontFamily: "Poppins_600SemiBold" }}>
                                                    Flood Level
                                                </Text>
                                                <Text style={{ color: '#0f172a', fontSize: 18, fontFamily: "Poppins_700Bold", marginTop: 4 }}>
                                                    {sensors.find((s) => s.sensor_id === selectedSensor)?.flood_level} cm
                                                </Text>
                                                <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                                                    Raw Distance: {sensors.find((s) => s.sensor_id === selectedSensor)?.raw_distance} cm
                                                </Text>
                                            </View>
                                        )}

                                        {/* GPS Coordinates */}
                                        {sensors.find((s) => s.sensor_id === selectedSensor)?.latitude !== undefined && (
                                            <View style={{ backgroundColor: '#eff6ff', padding: 8, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#3b82f6' }}>
                                                <Text style={{ color: '#1e40af', fontSize: 12, fontFamily: "Poppins_600SemiBold" }}>
                                                    📍 GPS Coordinates
                                                </Text>
                                                <Text style={{ color: '#0f172a', fontSize: 13, marginTop: 4, fontFamily: 'monospace' }}>
                                                    Latitude: {sensors.find((s) => s.sensor_id === selectedSensor)?.latitude.toFixed(6)}°
                                                </Text>
                                                <Text style={{ color: '#0f172a', fontSize: 13, marginTop: 2, fontFamily: 'monospace' }}>
                                                    Longitude: {sensors.find((s) => s.sensor_id === selectedSensor)?.longitude.toFixed(6)}°
                                                </Text>
                                                {sensors.find((s) => s.sensor_id === selectedSensor)?.maps_url && (
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            const mapsUrl = sensors.find((s) => s.sensor_id === selectedSensor)?.maps_url;
                                                            if (mapsUrl) {
                                                                window.open(mapsUrl, '_blank');
                                                            }
                                                        }}
                                                        style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#bfdbfe' }}
                                                    >
                                                        <Text style={{ color: '#2563eb', fontSize: 12, fontFamily: "Poppins_600SemiBold" }}>
                                                            🗺️ View on Google Maps →
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        )}

                                        {/* Timestamp */}
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.sensorInfoTime}>
                                                🕐 {sensors.find((s) => s.sensor_id === selectedSensor)?.last_updated}
                                            </Text>
                                        </View>

                                        {/* Status */}
                                        {sensors.find((s) => s.sensor_id === selectedSensor)?.is_offline && (
                                            <Text style={[styles.sensorInfoTime, { color: '#dc2626', fontFamily: "Poppins_600SemiBold" }]}>
                                                ⚠️ Sensor is OFFLINE
                                            </Text>
                                        )}
                                        {!sensors.find((s) => s.sensor_id === selectedSensor)?.is_offline && (
                                            <Text style={[styles.sensorInfoTime, { color: '#16a34a', fontFamily: "Poppins_600SemiBold" }]}>
                                                ✓ Sensor is ONLINE
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Sensor List Sidebar */}
                        <View style={styles.sensorListPanel}>
                            <Text style={styles.sensorListTitle}>Monitored Sensors</Text>
                            <View style={styles.sensorListScroll}>
                                <View style={styles.sensorListContent}>
                                    {loading ? (
                                        <View style={{ padding: 16, alignItems: 'center' }}>
                                            <Text style={{ color: '#64748b' }}>Loading sensor data...</Text>
                                        </View>
                                    ) : sensors.length === 0 ? (
                                        <View style={{ padding: 16, alignItems: 'center' }}>
                                            <Text style={{ color: '#64748b' }}>No sensor data available</Text>
                                        </View>
                                    ) : (
                                        sensors.map((sensor) => (
                                            <TouchableOpacity
                                                key={sensor.sensor_id}
                                                style={[
                                                    styles.sensorListItem,
                                                    selectedSensor === sensor.sensor_id && styles.sensorListItemSelected,
                                                ]}
                                                onPress={() => setSelectedSensor(sensor.sensor_id)}
                                            >
                                                <View style={styles.sensorListItemContent}>
                                                    <Text style={styles.sensorListItemName}>
                                                        {sensor.name || `Sensor ${sensor.sensor_id}`}
                                                    </Text>
                                                    <Text style={styles.sensorListItemBarangay}>
                                                        {sensor.barangay}
                                                    </Text>
                                                    <Text style={styles.sensorListItemStatus}>
                                                        Flood: {sensor.flood_level}cm • {sensor.is_offline ? "Offline" : sensor.status.charAt(0).toUpperCase() + sensor.status.slice(1).toLowerCase()}
                                                    </Text>
                                                </View>
                                                {sensor.is_offline ? (
                                                    <View style={[styles.sensorListItemDot, { backgroundColor: getStatusDotColor(sensor.status, sensor.is_offline) }]} />
                                                ) : (
                                                    <Animated.View style={[styles.sensorListItemDot, { backgroundColor: getStatusDotColor(sensor.status, sensor.is_offline), opacity: blinkAnim }]} />
                                                )}
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        );
    } catch (error) {
        console.error("Error rendering SensorMapPage:", error);
        return (
            <View style={styles.container}>
                <Text>Error loading Sensor Map</Text>
            </View>
        );
    }
};

export default SensorMapPage;
