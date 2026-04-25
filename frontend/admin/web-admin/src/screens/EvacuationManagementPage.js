import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { formatPST, getSystemStatus, getSystemStatusColor } from "../utils/dateUtils";
import { authFetch, areValuesEqual } from "../utils/helpers";
import { API_BASE_URL } from "../config/api";
import useDataSync from "../utils/useDataSync";
import TopRightStatusIndicator from "../components/TopRightStatusIndicator";

const EvacuationManagementPage = ({ onNavigate, onLogout, userRole = "lgu" }) => {
    const [centers, setCenters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All Status");

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCenter, setEditingCenter] = useState(null);
    const [onlineSensors, setOnlineSensors] = useState(0);

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [centerToDelete, setCenterToDelete] = useState(null);

    const [form, setForm] = useState({
        name: "",
        location: "",
        lat: "",
        lng: "",
        capacity: "0",
        phone: "911",
        status: "open"
    });
    const initialFormRef = React.useRef(null);

    const [currentStep, setCurrentStep] = useState(1); // 1: Pinning, 2: Details
    const [pinnedAddress, setPinnedAddress] = useState("");
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
    const mapRef = React.useRef(null);
    const markerRef = React.useRef(null);

    const fetchCenters = async () => {
        try {
            const response = await authFetch(`${API_BASE_URL}/api/evacuation-centers/`);
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

        fetchSystemStatus();
        const interval = setInterval(fetchSystemStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // ── Real-time Data Synchronization ──
    useDataSync({
        onEvacuationUpdate: () => {
            console.log("[EvacuationManagement] Centers updated, refreshing list...");
            fetchCenters();
        }
    });

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
        // Dynamic Validation
        const missingFields = [];
        if (!form.name) missingFields.push("Name");
        if (!form.capacity || form.capacity === "0") missingFields.push("Capacity");
        if (!form.status) missingFields.push("Status");

        if (missingFields.length > 0) {
            setErrorMessage("Please fill in all required fields marked with *");
            setShowErrorModal(true);
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await authFetch(`${API_BASE_URL}/api/evacuation-centers/`, {
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
                setSuccessMessage(`Successfully added evacuation center: ${form.name}`);
                setShowAddModal(false);
                setShowSuccessModal(true);
                setCurrentStep(1);
                setForm({ name: "", location: "", lat: "", lng: "", capacity: "0", phone: "911", status: "open" });
                setPinnedAddress("");
                fetchCenters();
            } else {
                const data = await response.json();
                setErrorMessage(data.error || "Failed to add center");
                setShowErrorModal(true);
            }
        } catch (error) {
            setErrorMessage("Network error adding center");
            setShowErrorModal(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateCenter = async () => {
        if (!editingCenter) return;

        // Dynamic Validation
        const missingFields = [];
        if (!form.name) missingFields.push("Name");
        if (!form.capacity || form.capacity === "0") missingFields.push("Capacity");
        if (!form.status) missingFields.push("Status");

        if (missingFields.length > 0) {
            setErrorMessage("Please fill in all required fields marked with *");
            setShowErrorModal(true);
            return;
        }

        // "No Changes" Validation
        if (initialFormRef.current && areValuesEqual(form, initialFormRef.current)) {
            setErrorMessage("No changes detected.");
            setShowErrorModal(true);
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await authFetch(`${API_BASE_URL}/api/evacuation-centers/${editingCenter.id}`, {
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
                setSuccessMessage(`Successfully updated evacuation center: ${form.name}`);
                setShowEditModal(false);
                setShowSuccessModal(true);
                fetchCenters();
            } else {
                const data = await response.json();
                setErrorMessage(data.error || "Failed to update center");
                setShowErrorModal(true);
            }
        } catch (error) {
            setErrorMessage("Network error updating center");
            setShowErrorModal(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCenter = async (center) => {
        setCenterToDelete(center);
        setShowDeleteModal(true);
    };

    const confirmDeleteCenter = async () => {
        if (!centerToDelete) return;
        setIsSubmitting(true);
        try {
            const response = await authFetch(`${API_BASE_URL}/api/evacuation-centers/${centerToDelete.id}`, {
                method: "DELETE"
            });
            if (response.ok) {
                setSuccessMessage(`Successfully deleted evacuation center: ${centerToDelete.name}`);
                setShowDeleteModal(false);
                setShowSuccessModal(true);
                setCenterToDelete(null);
                fetchCenters();
            } else {
                setErrorMessage("Failed to delete center");
                setShowErrorModal(true);
            }
        } catch (error) {
            setErrorMessage("Network error deleting center");
            setShowErrorModal(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const cancelDeleteCenter = () => {
        setShowDeleteModal(false);
        setCenterToDelete(null);
    };

    const handleEditClick = (center) => {
        setEditingCenter(center);
        const formValues = {
            name: center.name,
            location: center.location,
            lat: center.lat.toString(),
            lng: center.lng.toString(),
            capacity: center.capacity.toString(),
            phone: center.phone || "",
            status: center.status || "open"
        };
        setForm(formValues);
        initialFormRef.current = formValues;
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
        <View style={styles.dashboardMain}>

                <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Evacuation Management</Text>
                        <Text style={styles.dashboardTopSubtitle}>
                            Add and manage community evacuation centers
                        </Text>
                    </View>
                    <View style={styles.dashboardTopRight}>
                        <TopRightStatusIndicator />
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
                                            <Text style={styles.userCellText}>{center.capacity}</Text>
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
                                                <TouchableOpacity
                                                    style={[styles.userActionButton, { backgroundColor: '#ffffff', borderColor: '#e2e8f0' }]}
                                                    onPress={() => handleDeleteCenter(center)}
                                                >
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

            {(showAddModal || showEditModal) && (
                <Modal visible={true} transparent animationType="fade">
                    <View style={[pg.modalOverlay, { zIndex: 10 }]}>
                        <View style={[pg.modalBox, { maxWidth: currentStep === 1 ? 800 : 680 }]}>
                            <LinearGradient colors={["#001D39", "#0A4174"]} style={pg.modalHeader}>
                                <View>
                                    <Text style={pg.modalTitle}>
                                        {showAddModal ? "Add New Evacuation Center" : "Edit Evacuation Center"}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "Poppins_400Regular" }}>
                                        {currentStep === 1 ? "Step 1: Pin Exact Location" : "Step 2: Enter Facility Details"}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); setCurrentStep(1); }}>
                                    <Feather name="x" size={22} color="#fff" />
                                </TouchableOpacity>
                            </LinearGradient>

                            <View style={pg.modalBody}>
                                {currentStep === 1 ? (
                                    <View>
                                        <Text style={{ fontSize: 14, color: "#475569", marginBottom: 16, fontFamily: "Poppins_400Regular" }}>
                                            Click on the map to pin the exact location of the evacuation center.
                                        </Text>
                                        <View
                                            nativeID="pin-map-container"
                                            style={{ height: 450, backgroundColor: "#f8fafc", borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: "#e2e8f0" }}
                                        />

                                        {form.lat ? (
                                            <View style={{ backgroundColor: "#eff6ff", padding: 16, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dbeafe' }}>
                                                <View style={{ backgroundColor: '#3b82f6', padding: 8, borderRadius: 10, marginRight: 12 }}>
                                                    <Feather name="map-pin" size={18} color="#fff" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: "#1e40af", fontSize: 11, fontFamily: "Poppins_700Bold", letterSpacing: 0.5 }}>
                                                        {isReverseGeocoding ? "IDENTIFYING LOCATION..." : "SELECTED LOCATION"}
                                                    </Text>
                                                    <Text style={{ color: "#3b82f6", fontSize: 14, fontFamily: "Poppins_500Medium" }}>
                                                        {isReverseGeocoding ? "Fetching address..." : (pinnedAddress || `${form.lat}, ${form.lng}`)}
                                                    </Text>
                                                </View>
                                            </View>
                                        ) : null}

                                        <TouchableOpacity
                                            style={[pg.submitBtn, { backgroundColor: !form.lat ? "#94a3b8" : "#3b82f6" }]}
                                            disabled={!form.lat}
                                            onPress={() => setCurrentStep(2)}
                                        >
                                            <Text style={pg.submitBtnText}>Continue to Details</Text>
                                            <Feather name="arrow-right" size={16} color="#fff" style={{ marginLeft: 8 }} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
                                        <TouchableOpacity
                                            onPress={() => setCurrentStep(1)}
                                            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#f1f5f9", borderRadius: 8, alignSelf: 'flex-start' }}
                                        >
                                            <Feather name="arrow-left" size={14} color="#64748b" />
                                            <Text style={{ fontSize: 12, color: "#64748b", marginLeft: 4, fontFamily: "Poppins_600SemiBold" }}>Back to Map</Text>
                                        </TouchableOpacity>

                                        <View style={pg.formGroup}>
                                            <Text style={pg.formLabel}>Center Name <Text style={{ color: "#dc2626" }}>*</Text></Text>
                                            <TextInput
                                                style={pg.formInput}
                                                placeholder="e.g. Barangay Hall Mabolo"
                                                placeholderTextColor="#94a3b8"
                                                value={form.name}
                                                onChangeText={(text) => setForm({ ...form, name: text })}
                                            />
                                        </View>

                                        <View style={pg.formGroup}>
                                            <Text style={pg.formLabel}>Pinned Location</Text>
                                            <View style={[pg.formInput, { backgroundColor: "#f1f5f9", flexDirection: 'row', alignItems: 'center', opacity: 0.8 }]}>
                                                <Feather name="map-pin" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                                                <Text style={{ color: "#475569", flex: 1, fontFamily: "Poppins_400Regular" }} numberOfLines={1}>
                                                    {form.location || "No location pinned"}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={pg.formGrid}>
                                            <View style={pg.formGroup}>
                                                <Text style={pg.formLabel}>Total Capacity <Text style={{ color: "#dc2626" }}>*</Text></Text>
                                                <TextInput
                                                    style={pg.formInput}
                                                    placeholder="e.g. 200"
                                                    placeholderTextColor="#94a3b8"
                                                    keyboardType="numeric"
                                                    value={form.capacity}
                                                    onChangeText={(text) => setForm({ ...form, capacity: text })}
                                                />
                                            </View>
                                            <View style={pg.formGroup}>
                                                <Text style={pg.formLabel}>Phone Number</Text>
                                                <TextInput
                                                    style={pg.formInput}
                                                    placeholder="911"
                                                    placeholderTextColor="#94a3b8"
                                                    keyboardType="numeric"
                                                    value={form.phone}
                                                    onChangeText={(text) => {
                                                        const numericValue = text.replace(/[^0-9]/g, '');
                                                        setForm({ ...form, phone: numericValue });
                                                    }}
                                                />
                                            </View>
                                        </View>

                                        <View style={pg.formGroup}>
                                            <Text style={pg.formLabel}>Status <Text style={{ color: "#dc2626" }}>*</Text></Text>
                                            <View style={{ flexDirection: "row", gap: 8 }}>
                                                {["open", "full", "closed"].map(s => (
                                                    <TouchableOpacity
                                                        key={s}
                                                        style={{
                                                            flex: 1,
                                                            padding: 10,
                                                            borderRadius: 12,
                                                            borderWidth: 1.5,
                                                            borderColor: form.status === s ? (s === 'open' ? "#16a34a" : s === 'full' ? "#dc2626" : "#64748b") : "#e2e8f0",
                                                            backgroundColor: form.status === s ? (s === 'open' ? "#dcfce7" : s === 'full' ? "#fee2e2" : "#f1f5f9") : "#f8fafc",
                                                            alignItems: "center"
                                                        }}
                                                        onPress={() => setForm({ ...form, status: s })}
                                                    >
                                                        <Text style={{
                                                            color: form.status === s ? "#1e293b" : "#64748b",
                                                            fontFamily: form.status === s ? "Poppins_600SemiBold" : "Poppins_400Regular",
                                                            textTransform: "capitalize",
                                                            fontSize: 13
                                                        }}>{s}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    </ScrollView>
                                )}
                            </View>

                            {currentStep === 2 && (
                                <View style={pg.modalFooter}>
                                    <TouchableOpacity style={pg.cancelBtn} onPress={() => { setShowAddModal(false); setShowEditModal(false); setCurrentStep(1); }}>
                                        <Text style={pg.cancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[pg.submitBtn, { backgroundColor: isSubmitting ? "#94a3b8" : "#3b82f6" }]}
                                        disabled={isSubmitting}
                                        onPress={showAddModal ? handleCreateCenter : handleUpdateCenter}
                                    >
                                        {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                                            <>
                                                <Feather name="check" size={16} color="#fff" style={{ marginRight: 4 }} />
                                                <Text style={pg.submitBtnText}>
                                                    {showAddModal ? "Create Center" : "Save Changes"}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <Modal visible={true} transparent animationType="fade">
                    <View style={[pg.modalOverlay, { zIndex: 99999, backgroundColor: "rgba(0,0,0,0.5)" }]}>
                        <View style={[pg.modalBox, { maxWidth: 400, padding: 32, alignItems: "center", zIndex: 100000, elevation: 20 }]}>
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
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <Modal visible={true} transparent animationType="fade">
                    <View style={[pg.modalOverlay, { zIndex: 99999 }]}>
                        <View style={[pg.modalBox, { maxWidth: 400, padding: 32, alignItems: "center", zIndex: 100000, elevation: 20 }]}>
                            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                                <Feather name="trash-2" size={32} color="#dc2626" />
                            </View>
                            <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: "#0f172a", marginBottom: 8, textAlign: "center" }}>Delete Center?</Text>
                            <Text style={{ fontSize: 14, fontFamily: "Poppins_400Regular", color: "#64748b", textAlign: "center", marginBottom: 24 }}>
                                Are you sure you want to delete <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#0f172a" }}>{centerToDelete?.name}</Text>? This action cannot be undone.
                            </Text>
                            <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
                                <TouchableOpacity style={[pg.cancelBtn, { flex: 1 }]} onPress={cancelDeleteCenter}>
                                    <Text style={pg.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[pg.submitBtn, { flex: 1, backgroundColor: "#dc2626" }]}
                                    onPress={confirmDeleteCenter}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                                        <Text style={pg.submitBtnText}>Delete</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Error Modal */}
            {showErrorModal && (
                <Modal visible={true} transparent animationType="fade">
                    <View style={[pg.modalOverlay, { zIndex: 99999, backgroundColor: "rgba(0,0,0,0.5)" }]}>
                        <View style={[pg.modalBox, { maxWidth: 400, padding: 32, alignItems: "center", zIndex: 100000, elevation: 20 }]}>
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

const pg = {
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
    cancelBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, borderWidth: 1.5, borderColor: "#e2e8f0" },
    cancelBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#475569" },
    submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#3b82f6", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 24 },
    submitBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
};

export default EvacuationManagementPage;
