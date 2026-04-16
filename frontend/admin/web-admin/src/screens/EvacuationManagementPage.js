import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";

const EvacuationManagementPage = ({ onNavigate, onLogout, userRole = "lgu" }) => {
    const [centers, setCenters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All Status");

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCenter, setEditingCenter] = useState(null);

    const [form, setForm] = useState({
        name: "",
        location: "",
        lat: "",
        lng: "",
        capacity: "0",
        phone: "911",
        status: "open"
    });

    const [currentStep, setCurrentStep] = useState(1); // 1: Pinning, 2: Details
    const [pinnedAddress, setPinnedAddress] = useState("");
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
    const mapRef = React.useRef(null);
    const markerRef = React.useRef(null);

    const fetchCenters = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/evacuation-centers/`);
            const data = await response.json();
            if (response.ok) {
                setCenters(data);
            }
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch evacuation centers", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCenters();
    }, []);

    // Leaflet Integration
    useEffect(() => {
        if (!showAddModal && !showEditModal) return;
        if (Platform.OS !== "web") return;

        let mapInstance = null;
        let checkInterval = null;
        let timeoutId = null;

        const fetchAddress = async (lat, lng) => {
            setIsReverseGeocoding(true);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                const data = await response.json();
                if (data && data.display_name) {
                    setPinnedAddress(data.display_name);
                    setForm(prev => ({ ...prev, location: data.display_name }));
                } else {
                    const fallback = `${lat}, ${lng}`;
                    setPinnedAddress("Address not found");
                    setForm(prev => ({ ...prev, location: fallback }));
                }
            } catch (error) {
                console.error("Reverse geocoding failed", error);
                setPinnedAddress("Error fetching address");
            } finally {
                setIsReverseGeocoding(false);
            }
        };

        const initializeMap = () => {
            const container = document.getElementById("pin-map-container");
            if (!container || !window.L) return;

            container.innerHTML = "";
            const initialLat = parseFloat(form.lat) || 10.3172;
            const initialLng = parseFloat(form.lng) || 123.9181;

            mapInstance = window.L.map(container).setView([initialLat, initialLng], 16);
            mapRef.current = mapInstance;

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapInstance);

            // If editing or already pinned, show marker
            if (form.lat && form.lng) {
                markerRef.current = window.L.marker([initialLat, initialLng], { draggable: true }).addTo(mapInstance);
                fetchAddress(initialLat, initialLng);

                markerRef.current.on('dragend', (e) => {
                    const pos = e.target.getLatLng();
                    setForm(prev => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
                    fetchAddress(pos.lat, pos.lng);
                });
            }

            mapInstance.on('click', (e) => {
                const { lat, lng } = e.latlng;
                setForm(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
                fetchAddress(lat, lng);

                if (markerRef.current) {
                    markerRef.current.setLatLng(e.latlng);
                } else {
                    markerRef.current = window.L.marker(e.latlng, { draggable: true }).addTo(mapInstance);
                    markerRef.current.on('dragend', (ev) => {
                        const pos = ev.target.getLatLng();
                        setForm(prev => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
                        fetchAddress(pos.lat, pos.lng);
                    });
                }
            });

            setTimeout(() => mapInstance.invalidateSize(), 200);
        };

        const loadLeaflet = () => {
            if (window.L) {
                initializeMap();
            } else {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
                document.head.appendChild(link);

                const script = document.createElement("script");
                script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
                script.onload = initializeMap;
                document.head.appendChild(script);
            }
        };

        timeoutId = setTimeout(loadLeaflet, 300);

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (mapInstance) mapInstance.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
    }, [showAddModal, showEditModal, currentStep]);

    const handleCreateCenter = async () => {
        if (!form.name || !form.location || !form.lat || !form.lng) {
            alert("Please fill in Name, Location, Latitude, and Longitude");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/evacuation-centers/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    capacity: parseInt(form.capacity) || 0,
                    lat: parseFloat(form.lat),
                    lng: parseFloat(form.lng)
                })
            });

            if (response.ok) {
                alert("Evacuation center added successfully");
                setShowAddModal(false);
                setCurrentStep(1);
                setForm({ name: "", location: "", lat: "", lng: "", capacity: "0", phone: "911", status: "open" });
                setPinnedAddress("");
                fetchCenters();
            } else {
                const data = await response.json();
                alert(data.error || "Failed to add center");
            }
        } catch (error) {
            alert("Network error adding center");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateCenter = async () => {
        if (!editingCenter) return;
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/evacuation-centers/${editingCenter.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    capacity: parseInt(form.capacity) || 0,
                    lat: parseFloat(form.lat),
                    lng: parseFloat(form.lng)
                })
            });

            if (response.ok) {
                alert("Evacuation center updated successfully");
                setShowEditModal(false);
                fetchCenters();
            } else {
                const data = await response.json();
                alert(data.error || "Failed to update center");
            }
        } catch (error) {
            alert("Network error updating center");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCenter = async (id) => {
        if (confirm("Are you sure you want to delete this evacuation center?")) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/evacuation-centers/${id}`, {
                    method: "DELETE"
                });
                if (response.ok) {
                    alert("Center deleted successfully");
                    fetchCenters();
                } else {
                    alert("Failed to delete center");
                }
            } catch (error) {
                alert("Network error deleting center");
            }
        }
    };

    const handleEditClick = (center) => {
        setEditingCenter(center);
        setForm({
            name: center.name,
            location: center.location,
            lat: center.lat.toString(),
            lng: center.lng.toString(),
            capacity: center.capacity.toString(),
            phone: center.phone || "",
            status: center.status || "open"
        });
        setCurrentStep(2); // In edit mode, allow going straight to details if needed, but we'll still show the map
        setShowEditModal(true);
    };

    const filteredCenters = centers.filter(center => {
        const matchesSearch = center.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            center.location.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "All Status" || center.status === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
    });

    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case "open": return { bg: "#dcfce7", dot: "#16a34a", text: "#166534" };
            case "full": return { bg: "#fee2e2", dot: "#dc2626", text: "#991b1b" };
            case "closed": return { bg: "#f1f5f9", dot: "#94a3b8", text: "#475569" };
            default: return { bg: "#f1f5f9", dot: "#94a3b8", text: "#475569" };
        }
    };

    return (
        <View style={styles.dashboardRoot}>
            <AdminSidebar variant={userRole} activePage="evacuation-management" onNavigate={onNavigate} onLogout={onLogout} />

            <View style={styles.dashboardMain}>
                <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Evacuation Management</Text>
                        <Text style={styles.dashboardTopSubtitle}>
                            Add and manage community evacuation centers
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

                <ScrollView
                    style={styles.dashboardScroll}
                    contentContainerStyle={styles.dashboardScrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Stats Summary */}
                    <View style={styles.userStatsRow}>
                        <View style={styles.userStatsCard}>
                            <View style={[styles.userStatsIcon, { backgroundColor: "#eff6ff" }]}>
                                <Feather name="home" size={24} color="#2563eb" />
                            </View>
                            <Text style={styles.userStatsValue}>{centers.length}</Text>
                            <Text style={styles.userStatsLabel}>Total Centers</Text>
                        </View>
                        <View style={styles.userStatsCard}>
                            <View style={[styles.userStatsIcon, { backgroundColor: "#dcfce7" }]}>
                                <Feather name="check-circle" size={24} color="#16a34a" />
                            </View>
                            <Text style={styles.userStatsValue}>{centers.filter(c => c.status === 'open').length}</Text>
                            <Text style={styles.userStatsLabel}>Open Centers</Text>
                        </View>
                        <View style={styles.userStatsCard}>
                            <View style={[styles.userStatsIcon, { backgroundColor: "#fee2e2" }]}>
                                <Feather name="users" size={24} color="#dc2626" />
                            </View>
                            <Text style={styles.userStatsValue}>{centers.filter(c => c.status === 'full').length}</Text>
                            <Text style={styles.userStatsLabel}>Full Centers</Text>
                        </View>
                    </View>

                    {/* Filter Bar */}
                    <View style={styles.filterBar}>
                        <View style={styles.searchContainer}>
                            <Feather name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search centers by name or location..."
                                placeholderTextColor="#94a3b8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        <View style={styles.filterGroup}>
                            <TouchableOpacity style={styles.addUserButton} onPress={() => { setCurrentStep(1); setShowAddModal(true); }}>
                                <Feather name="plus" size={18} color="#ffffff" />
                                <Text style={styles.addUserButtonText}>Add Center</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Table */}
                    <View style={styles.userTableContainer}>
                        <View style={styles.userTableHeader}>
                            <Text style={[styles.userTableHeaderCell, { flex: 2 }]}>Center Name</Text>
                            <Text style={[styles.userTableHeaderCell, { flex: 1.5 }]}>Location</Text>
                            <Text style={[styles.userTableHeaderCell, { flex: 1 }]}>Capacity</Text>
                            <Text style={[styles.userTableHeaderCell, { flex: 1 }]}>Status</Text>
                            <Text style={[styles.userTableHeaderCell, { flex: 1 }]}>Actions</Text>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color="#2563eb" style={{ margin: 32 }} />
                        ) : filteredCenters.length === 0 ? (
                            <Text style={{ textAlign: "center", padding: 32, color: "#64748b" }}>No evacuation centers found.</Text>
                        ) : (
                            filteredCenters.map((center) => {
                                const statusStyle = getStatusStyle(center.status);
                                return (
                                    <View key={center.id} style={styles.userTableRow}>
                                        <View style={{ flex: 2 }}>
                                            <Text style={[styles.userName, { fontSize: 15 }]}>{center.name}</Text>
                                            <Text style={styles.userEmail}>{center.phone || "No Phone"}</Text>
                                        </View>
                                        <View style={{ flex: 1.5 }}>
                                            <Text style={styles.userCellText}>{center.location}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.userCellText}>{center.slots_filled} / {center.capacity}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={[styles.userStatusBadge, { backgroundColor: statusStyle.bg }]}>
                                                <View style={[styles.userStatusDot, { backgroundColor: statusStyle.dot }]} />
                                                <Text style={[styles.userStatusText, { color: statusStyle.text }]}>{center.status.toUpperCase()}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.userColActions, { flex: 1 }]}>
                                            <View style={styles.userActionButtons}>
                                                <TouchableOpacity style={styles.userActionButton} onPress={() => handleEditClick(center)}>
                                                    <Feather name="edit-2" size={16} color="#2563eb" />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.userActionButton} onPress={() => handleDeleteCenter(center.id)}>
                                                    <Feather name="trash-2" size={16} color="#dc2626" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </ScrollView>
            </View>

            {(showAddModal || showEditModal) && (
                <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                    <View style={{ width: 800, backgroundColor: "#fff", borderRadius: 16, overflow: 'hidden' }}>
                        <LinearGradient
                            colors={["#1d4ed8", "#3b82f6"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                        >
                            <View>
                                <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: "#fff" }}>
                                    {showAddModal ? "Add New Evacuation Center" : "Edit Evacuation Center"}
                                </Text>
                                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                                    {currentStep === 1 ? "Step 1: Pin Exact Location" : "Step 2: Enter Facility Details"}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); setCurrentStep(1); }}>
                                <Feather name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                        </LinearGradient>

                        <View style={{ padding: 24 }}>
                            {currentStep === 1 ? (
                                <View>
                                    <Text style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>
                                        Click on the map to pin the exact location of the evacuation center.
                                    </Text>
                                    <View
                                        nativeID="pin-map-container"
                                        style={{ height: 500, backgroundColor: "#f1f5f9", borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}
                                    />

                                    {form.lat ? (
                                        <View style={{ backgroundColor: "#eff6ff", padding: 16, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dbeafe' }}>
                                            <View style={{ backgroundColor: '#2563eb', padding: 8, borderRadius: 16, marginRight: 12 }}>
                                                <Feather name="map-pin" size={20} color="#fff" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: "#1e40af", fontSize: 13, fontFamily: "Poppins_700Bold", marginBottom: 2 }}>
                                                    {isReverseGeocoding ? "Fetching address..." : "Selected Location:"}
                                                </Text>
                                                <Text style={{ color: "#3b82f6", fontSize: 14, lineHeight: 20 }}>
                                                    {isReverseGeocoding ? "Identifying place..." : (pinnedAddress || `${form.lat}, ${form.lng}`)}
                                                </Text>
                                            </View>
                                        </View>
                                    ) : null}

                                    <TouchableOpacity
                                        style={[modalStyles.submitBtn, { backgroundColor: !form.lat ? "#94a3b8" : "#2563eb", marginTop: 0 }]}
                                        disabled={!form.lat}
                                        onPress={() => setCurrentStep(2)}
                                    >
                                        <Text style={modalStyles.submitBtnText}>Continue to Details</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <ScrollView style={{ maxHeight: "70vh" }}>
                                    <TouchableOpacity
                                        onPress={() => setCurrentStep(1)}
                                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, padding: 8, backgroundColor: "#f8fafc", borderRadius: 8, alignSelf: 'flex-start' }}
                                    >
                                        <Feather name="arrow-left" size={14} color="#64748b" />
                                        <Text style={{ fontSize: 13, color: "#64748b", marginLeft: 4 }}>Back to Map</Text>
                                    </TouchableOpacity>

                                    <Text style={modalStyles.label}>Center Name</Text>
                                    <TextInput
                                        style={modalStyles.input}
                                        placeholder="e.g. Barangay Hall Mabolo"
                                        value={form.name}
                                        onChangeText={(text) => setForm({ ...form, name: text })}
                                    />

                                    <Text style={modalStyles.label}>Pinned Location</Text>
                                    <View style={[modalStyles.input, { backgroundColor: "#f8fafc", flexDirection: 'row', alignItems: 'center' }]}>
                                        <Feather name="map-pin" size={16} color="#64748b" style={{ marginRight: 8 }} />
                                        <Text style={{ color: "#475569", flex: 1 }} numberOfLines={2}>
                                            {isReverseGeocoding ? "Updating location..." : (form.location || "No location pinned")}
                                        </Text>
                                    </View>

                                    <View style={{ flexDirection: "row", gap: 16 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={modalStyles.label}>Total Capacity</Text>
                                            <TextInput
                                                style={modalStyles.input}
                                                placeholder="200"
                                                keyboardType="numeric"
                                                value={form.capacity}
                                                onChangeText={(text) => setForm({ ...form, capacity: text })}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={modalStyles.label}>Phone Number</Text>
                                            <TextInput
                                                style={modalStyles.input}
                                                placeholder="911"
                                                keyboardType="numeric"
                                                value={form.phone}
                                                onChangeText={(text) => {
                                                    const numericValue = text.replace(/[^0-9]/g, '');
                                                    setForm({ ...form, phone: numericValue });
                                                }}
                                            />
                                        </View>
                                    </View>

                                    {showEditModal && (
                                        <View style={{ marginBottom: 16 }}>
                                            <Text style={modalStyles.label}>Status</Text>
                                            <View style={{ flexDirection: "row", gap: 8 }}>
                                                {["open", "full", "closed"].map(s => (
                                                    <TouchableOpacity
                                                        key={s}
                                                        style={[modalStyles.statusBtn, form.status === s && modalStyles.statusBtnActive]}
                                                        onPress={() => setForm({ ...form, status: s })}
                                                    >
                                                        <Text style={{ color: form.status === s ? "#fff" : "#64748b", textTransform: "capitalize" }}>{s}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        style={[modalStyles.submitBtn, { backgroundColor: isSubmitting ? "#94a3b8" : "#2563eb" }]}
                                        disabled={isSubmitting}
                                        onPress={showAddModal ? handleCreateCenter : handleUpdateCenter}
                                    >
                                        <Text style={modalStyles.submitBtnText}>
                                            {isSubmitting ? "Processing..." : showAddModal ? "Create Center" : "Save Changes"}
                                        </Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const modalStyles = {
    label: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8, marginTop: 12 },
    input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, fontSize: 14, color: "#0f172a", backgroundColor: "#fff" },
    submitBtn: { marginTop: 24, paddingVertical: 12, borderRadius: 16, alignItems: "center", marginBottom: 32 },
    submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Poppins_700Bold" },
    statusBtn: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center" },
    statusBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" }
};

export default EvacuationManagementPage;
