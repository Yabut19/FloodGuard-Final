import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";
import { formatPST, getSystemStatus, getSystemStatusColor } from "../utils/dateUtils";
import { authFetch } from "../utils/helpers";
import useDataSync from "../utils/useDataSync";
import dialogs from "../utils/dialogs";
import TopRightStatusIndicator from "../components/TopRightStatusIndicator";

const UserManagementPage = ({ onNavigate, onLogout, userRole = "superadmin" }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("All Roles");
    const [statusFilter, setStatusFilter] = useState("All Status");
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);

    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({
        total_users: 0,
        active_users: 0,
        lgu_moderators: 0,
        super_admins: 0
    });

    const SITIOS_MABOLO = [
        "Almendras", "Banilad (Mabolo)", "Cabantan", "Casals Village",
        "Castle Peak", "Holy Name", "M.J. Cuenco", "Panagdait",
        "San Isidro", "San Roque", "San Vicente", "Santo Niño",
        "Sindulan", "Soriano", "Tres Borces"
    ];
    const [showSitioDropdown, setShowSitioDropdown] = useState(false);

    const fetchUsers = async () => {
        try {
            const response = await authFetch(`${API_BASE_URL}/api/admin/users`);
            const data = await response.json();
            if (response.ok) {
                // Map backend roles to frontend display roles
                const mappedUsers = data.users.map(u => {
                    const rawRole = u.role?.toLowerCase();
                    const rawStatus = (u.status || 'active').toLowerCase();
                    return {
                        ...u,
                        role: (rawRole === 'lgu_admin' || rawRole === 'lgu') ? 'LGU Moderator' :
                            (rawRole === 'super_admin' || rawRole === 'admin') ? 'Admin' :
                                (rawRole === 'user') ? 'User' : u.role,
                        status: rawStatus === 'active' ? 'Active' : 'Inactive'
                    };
                });

                // Sort alphabetically by name (A-Z)
                mappedUsers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

                setUsers(mappedUsers);
                setStats(data.stats);
            }
        } catch (error) {
            console.error("Failed to fetch users", error);
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

        const fetchLocations = async () => {
            try {
                // Fetch both locations and sensors to filter out sensor names from the dropdown
                const [locRes, sensorRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/api/admin/locations`),
                    authFetch(`${API_BASE_URL}/api/iot/sensors`)
                ]);
                
                if (locRes.ok) {
                    let locations = await locRes.json();
                    
                    if (sensorRes.ok) {
                        const sensorData = await sensorRes.json();
                        const sensorsList = sensorData.sensors || [];
                        const sensorNames = sensorsList.map(s => s.name?.toLowerCase());
                        const sensorIds = sensorsList.map(s => s.id?.toLowerCase());
                        
                        // Filter out any locations that match sensor names, IDs, or contain "Sensor"
                        locations = locations.filter(loc => {
                            if (!loc) return false;
                            const lowLoc = loc.toLowerCase();
                            return !sensorNames.includes(lowLoc) && 
                                   !sensorIds.includes(lowLoc) && 
                                   !lowLoc.includes("sensor");
                        });
                    }
                    
                    setAvailableLocations(locations);
                }
            } catch (e) {
                console.error("Failed to fetch locations:", e);
            }
        };

        fetchUsers();
        fetchSystemStatus();
        fetchLocations();
        const interval = setInterval(fetchSystemStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // ── Real-time Data Synchronization ──
    useDataSync({
        onUserUpdate: () => {
            console.log("[UserManagement] User list changed, refreshing...");
            fetchUsers();
        },
        onSensorUpdate: (reading) => {
             // Optional: update the system status indicator live if readings come in
             // but we already have fetchSystemStatus polling. 
             // We can just rely on the sync event if needed.
        },
        onSensorListUpdate: () => {
            // If sensors go online/offline, update the status indicator
            // (Re-using the existing logic by calling the fetcher or just knowing there's a change)
            // But for simplicity, let's just use user_update for the list.
        }
    });

    const getRoleBadgeStyle = (role) => {
        switch (role) {
            case "Admin": return { backgroundColor: "#fee2e2", color: "#b91c1c" }; // Reddish
            case "LGU Moderator": return { backgroundColor: "#f3e8ff", color: "#7e22ce" }; // Purple
            case "User": return { backgroundColor: "#dbeafe", color: "#2563eb" }; // Blue
            default: return { backgroundColor: "#f1f5f9", color: "#64748b" };
        }
    };

    const getStatusBadgeStyle = (status) => {
        return status === "Active"
            ? { bg: "#dcfce7", dot: "#16a34a", text: "#166534" }
            : { bg: "#f1f5f9", dot: "#94a3b8", text: "#475569" };
    };

    const filteredUsers = users.filter(user => {
        const name = (user.name || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        const location = (user.location || "").toLowerCase();
        const search = searchQuery.toLowerCase();

        const matchesSearch = name.includes(search) ||
            email.includes(search) ||
            location.includes(search);
            
        const matchesRole = roleFilter === "All Roles" || user.role === roleFilter;
        const matchesStatus = statusFilter === "All Status" || user.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    });


    const [showAddLGUModal, setShowAddLGUModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdUserEmail, setCreatedUserEmail] = useState("");
    const [availableLocations, setAvailableLocations] = useState(SITIOS_MABOLO);
    const [lguForm, setLguForm] = useState({
        full_name: "",
        email: "",
        role: "lgu_admin", // Default for new accounts
        barangay: "",
        password: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit User Modal State
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [onlineSensors, setOnlineSensors] = useState(0);
    const [editingUser, setEditingUser] = useState(null);
    const [showEditSitioDropdown, setShowEditSitioDropdown] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: "",
        barangay: "",
        status: "",
        role: "",
        password: ""
    });
    const [showEditPassword, setShowEditPassword] = useState(false);

    const handleEditUserClick = (user) => {
        setEditingUser(user);
        const currentStatus = user.status?.toLowerCase() === 'active' ? 'active' : 'inactive';
        const currentRole = user.role === 'LGU Moderator' ? 'lgu_admin' :
                           user.role === 'Admin' ? 'super_admin' :
                           user.role === 'User' ? 'user' : 'user';
        
        setEditForm({
            full_name: user.name || "",
            barangay: user.location || "",
            status: currentStatus,
            role: currentRole,
            password: ""
        });
        setShowEditUserModal(true);
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;
        setIsSubmitting(true);
        try {
            // 1. Update Name, Barangay, and Password
            const detailRes = await authFetch(`${API_BASE_URL}/api/admin/users/${editingUser.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    full_name: editForm.full_name,
                    barangay: editForm.barangay,
                    password: editForm.password
                })
            });

            // 2. Update Status
            const statusRes = await authFetch(`${API_BASE_URL}/api/admin/users/${editingUser.id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: editForm.status })
            });

            // 3. Update Role
            const roleRes = await authFetch(`${API_BASE_URL}/api/admin/users/${editingUser.id}/role`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: editForm.role })
            });

            if (detailRes.ok && statusRes.ok && roleRes.ok) {
                dialogs.success("Updated", "User updated successfully");
                setShowEditUserModal(false);
                fetchUsers();
            } else {
                dialogs.error("Error", "Failed to update user. Some fields may not have saved.");
            }
        } catch (error) {
            dialogs.error("Error", "Network error updating user");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        const result = await dialogs.confirm("Delete User", "Are you sure you want to delete this user? This action cannot be undone.");
        if (result.isConfirmed) {
            try {
                const response = await authFetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
                    method: "DELETE"
                });
                if (response.ok) {
                    // Optimistically update the UI by removing the user from the local state
                    setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
                    dialogs.success("Deleted", "User deleted successfully");
                    fetchUsers(); // Refresh for full data consistency and stats update
                } else {
                    const data = await response.json();
                    dialogs.error("Error", "Failed to delete user: " + (data.error || "Unknown error"));
                }
            } catch (error) {
                dialogs.error("Error", "Network error deleting user");
            }
        }
    };

    const handleAddUserClick = () => {
        setShowAddLGUModal(true);
    };

    const handleCreateUser = async () => {
        // Enforce required validation on all form fields except password
        if (!lguForm.full_name || !lguForm.email || !lguForm.role) {
            dialogs.alert("Validation", "Please fill in all required fields: Full Name, Email, and Role.", 'warning');
            return;
        }

        // Location is required for all roles except super_admin
        if (lguForm.role !== 'super_admin' && !lguForm.barangay) {
            dialogs.alert("Validation", "Please select a Location (Sitio) for this account.", 'warning');
            return;
        }

        // Automatic temporary password generation if empty
        let finalPassword = lguForm.password;
        if (!finalPassword) {
            finalPassword = "FloodGuard" + Math.floor(1000 + Math.random() * 9000);
        }

        const payload = {
            ...lguForm,
            password: finalPassword,
            phone: ""
        };

        setIsSubmitting(true);
        try {
            const response = await authFetch(`${API_BASE_URL}/api/admin/create-user`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                setCreatedUserEmail(lguForm.email);
                setShowAddLGUModal(false);
                setShowSuccessModal(true);
                setLguForm({ full_name: "", email: "", role: "lgu_admin", barangay: "", password: "" });
                fetchUsers();
            } else {
                dialogs.error("Error", "Error: " + (data.error || "Failed to create account"));
            }
        } catch (error) {
            dialogs.error("Error", "Network error creating user");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={styles.dashboardRoot}>
            <AdminSidebar variant={userRole} activePage="user-management" onNavigate={onNavigate} onLogout={onLogout} />

            <View style={styles.dashboardMain}>
                <>
                    <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>User Management</Text>
                        <Text style={styles.dashboardTopSubtitle}>
                            Manage all user accounts and permissions
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
                    {/* Stats Cards */}
                    <View style={pg.statsRow}>
                        {[
                            { icon: "users", label: "Total Users", value: stats.total_users, color: "#2563eb", bg: "#eff6ff", filter: { r: "All Roles", s: "All Status" } },
                            { icon: "user-check", label: "Active Users", value: stats.active_users, color: "#16a34a", bg: "#dcfce7", filter: { r: "All Roles", s: "Active" } },
                            { icon: "shield", label: "LGU Moderators", value: stats.lgu_moderators, color: "#7c3aed", bg: "#f3e8ff", filter: { r: "LGU Moderator", s: "All Status" } },
                            { icon: "lock", label: "Admins", value: stats.super_admins, color: "#dc2626", bg: "#fee2e2", filter: { r: "Admin", s: "All Status" } },
                        ].map((card) => (
                            <TouchableOpacity 
                                key={card.label} 
                                style={pg.statsCard} 
                                onPress={() => { setRoleFilter(card.filter.r); setStatusFilter(card.filter.s); }}
                            >
                                <View style={[pg.statsIcon, { backgroundColor: card.bg }]}>
                                    <Feather name={card.icon} size={20} color={card.color} />
                                </View>
                                <Text style={pg.statsValue}>{card.value}</Text>
                                <Text style={pg.statsLabel}>{card.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Filter Bar */}
                    <View style={[pg.toolbar, { zIndex: 100, overflow: 'visible' }]}>
                        <View style={pg.searchBox}>
                            <Feather name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={pg.searchInput}
                                placeholder="Search users by name, email, or location..."
                                placeholderTextColor="#94a3b8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, zIndex: 110, overflow: 'visible' }}>
                            {/* Role Filter */}
                            <View style={{ zIndex: 120 }}>
                                <TouchableOpacity 
                                    style={pg.filterSelect} 
                                    onPress={() => {
                                        setShowRoleDropdown(!showRoleDropdown);
                                        setShowStatusDropdown(false);
                                    }}
                                >
                                    <Text style={pg.filterSelectText}>{roleFilter}</Text>
                                    <Feather name={showRoleDropdown ? "chevron-up" : "chevron-down"} size={16} color="#475569" />
                                </TouchableOpacity>
                                
                                {showRoleDropdown && (
                                    <View style={pg.dropdown}>
                                        {["All Roles", "Admin", "LGU Moderator", "User"].map((role) => (
                                            <TouchableOpacity 
                                                key={role} 
                                                style={pg.dropdownItem}
                                                onPress={() => {
                                                    setRoleFilter(role);
                                                    setShowRoleDropdown(false);
                                                }}
                                            >
                                                <Text style={[pg.dropdownItemText, roleFilter === role && { fontFamily: "Poppins_700Bold", color: '#2563eb' }]}>{role}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Status Filter */}
                            <View style={{ zIndex: 120 }}>
                                <TouchableOpacity 
                                    style={pg.filterSelect}
                                    onPress={() => {
                                        setShowStatusDropdown(!showStatusDropdown);
                                        setShowRoleDropdown(false);
                                    }}
                                >
                                    <Text style={pg.filterSelectText}>{statusFilter}</Text>
                                    <Feather name={showStatusDropdown ? "chevron-up" : "chevron-down"} size={16} color="#475569" />
                                </TouchableOpacity>

                                {showStatusDropdown && (
                                    <View style={pg.dropdown}>
                                        {["All Status", "Active", "Inactive"].map((status) => (
                                            <TouchableOpacity 
                                                key={status} 
                                                style={pg.dropdownItem}
                                                onPress={() => {
                                                    setStatusFilter(status);
                                                    setShowStatusDropdown(false);
                                                }}
                                            >
                                                <Text style={[pg.dropdownItemText, statusFilter === status && { fontFamily: "Poppins_700Bold", color: '#2563eb' }]}>{status}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity style={pg.addUserBtn} onPress={handleAddUserClick}>
                                <Feather name="plus" size={18} color="#ffffff" />
                                <Text style={pg.addUserBtnText}>Add User</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* User Table Card */}
                    <View style={[styles.userTableCard, { zIndex: 1 }]}>
                        <View style={styles.userTableHeader}>
                            <Text style={[styles.userTableHeaderCell, styles.userColUser]}>User</Text>
                            <Text style={[styles.userTableHeaderCell, styles.userColRole]}>Role</Text>
                            <Text style={[styles.userTableHeaderCell, styles.userColLocation]}>Location</Text>
                            <Text style={[styles.userTableHeaderCell, styles.userColStatus]}>Status</Text>
                            <Text style={[styles.userTableHeaderCell, styles.userColJoined]}>Joined</Text>
                            <Text style={[styles.userTableHeaderCell, styles.userColActions]}>Actions</Text>
                        </View>

                        {filteredUsers.map((user) => {
                            const roleStyle = getRoleBadgeStyle(user.role);
                            const statusStyle = getStatusBadgeStyle(user.status);

                            return (
                                <View key={user.id} style={styles.userTableRow}>
                                    <View style={[styles.userCellUser, styles.userColUser]}>
                                        <View style={styles.userAvatar}>
                                            {user.avatar_url ? (
                                                <Image
                                                    source={{ uri: `${API_BASE_URL}${user.avatar_url}` }}
                                                    style={{ width: "100%", height: "100%", borderRadius: 16 }}
                                                />
                                            ) : (
                                                <Text style={styles.userAvatarText}>
                                                    {user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">{user.name}</Text>
                                            <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="tail">{user.email || "No Email"}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.userColRole}>
                                        <View style={[styles.userRoleBadge, { backgroundColor: roleStyle.backgroundColor }]}>
                                            <Text style={[styles.userRoleBadgeText, { color: roleStyle.color }]}>{user.role}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.userColLocation}>
                                        <Text style={styles.userCellText}>{user.location}</Text>
                                    </View>

                                    <View style={styles.userColStatus}>
                                        <View style={[styles.userStatusBadge, { backgroundColor: statusStyle.bg }]}>
                                            <View style={[styles.userStatusDot, { backgroundColor: statusStyle.dot }]} />
                                            <Text style={[styles.userStatusText, { color: statusStyle.text }]}>{user.status.toUpperCase()}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.userColJoined}>
                                        <Text style={styles.userCellText}>{formatPST(user.joined)}</Text>
                                    </View>

                                    <View style={styles.userColActions}>
                                        <View style={styles.userActionButtons}>
                                            {user.role === 'Admin' ? (
                                                <>
                                                    <View style={[styles.userActionButton, { opacity: 0.6 }]}>
                                                        <Feather name="lock" size={16} color="#64748b" />
                                                    </View>
                                                    <TouchableOpacity
                                                        style={[styles.userActionButton, { backgroundColor: '#ffffff', borderColor: '#e2e8f0' }]}
                                                        onPress={() => handleDeleteUser(user.id)}
                                                    >
                                                        <Feather name="trash-2" size={16} color="#dc2626" />
                                                    </TouchableOpacity>
                                                </>
                                            ) : (
                                                <>
                                                    <TouchableOpacity
                                                        style={styles.userActionButton}
                                                        onPress={() => handleEditUserClick(user)}
                                                    >
                                                        <Feather name="edit-2" size={16} color="#2563eb" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.userActionButton, { backgroundColor: '#ffffff', borderColor: '#e2e8f0' }]}
                                                        onPress={() => handleDeleteUser(user.id)}
                                                    >
                                                        <Feather name="trash-2" size={16} color="#dc2626" />
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                </ScrollView>

                {/* Add LGU Modal (Redesigned) */}
                {showAddLGUModal && (
                    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                        <View style={{ width: 500, backgroundColor: "#fff", borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 }}>
                            {/* Gradient Header */}
                            <LinearGradient
                                colors={["#4c669f", "#3b5998", "#192f6a"]} 
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    padding: 16,
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    borderTopLeftRadius: 20,
                                    borderTopRightRadius: 20
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                                        <Feather name="user-plus" size={20} color="#fff" />
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: "#fff" }}>Add New User</Text>
                                        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Create a new account</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setShowAddLGUModal(false)}>
                                    <Feather name="x" size={24} color="#fff" />
                                </TouchableOpacity>
                            </LinearGradient>

                            {/* Modal Body */}
                            <View style={{ padding: 24 }}>
                                {/* Full Name */}
                                <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>Full Name <Text style={{ color: "#dc2626" }}>*</Text></Text>
                                <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, height: 44 }}>
                                    <Feather name="user" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={{ flex: 1, fontSize: 14, color: "#0f172a", outlineStyle: 'none' }}
                                        placeholder="Enter full name"
                                        placeholderTextColor="#94a3b8"
                                        value={lguForm.full_name}
                                        onChangeText={(text) => setLguForm({ ...lguForm, full_name: text })}
                                    />
                                </View>

                                {/* Email Address */}
                                <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>Email Address <Text style={{ color: "#dc2626" }}>*</Text></Text>
                                <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, height: 44 }}>
                                    <Feather name="mail" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={{ flex: 1, fontSize: 14, color: "#0f172a", outlineStyle: 'none' }}
                                        placeholder="Enter email address"
                                        placeholderTextColor="#94a3b8"
                                        value={lguForm.email}
                                        onChangeText={(text) => setLguForm({ ...lguForm, email: text })}
                                    />
                                </View>

                                {/* Role Selection */}
                                <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>Account Role <Text style={{ color: "#dc2626" }}>*</Text></Text>
                                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                                    <TouchableOpacity
                                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 8, borderWidth: 1, borderColor: lguForm.role === 'user' ? "#2563eb" : "#e2e8f0", borderRadius: 8, backgroundColor: lguForm.role === 'user' ? "#eff6ff" : "#fff" }}
                                        onPress={() => setLguForm({ ...lguForm, role: 'user' })}
                                    >
                                        <Text style={{ fontSize: 13, color: lguForm.role === 'user' ? "#1e293b" : "#64748b", fontFamily: lguForm.role === 'user' ? "Poppins_600SemiBold" : "Poppins_400Regular" }}>User</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 8, borderWidth: 1, borderColor: lguForm.role === 'lgu_admin' ? "#7c3aed" : "#e2e8f0", borderRadius: 8, backgroundColor: lguForm.role === 'lgu_admin' ? "#f3e8ff" : "#fff" }}
                                        onPress={() => setLguForm({ ...lguForm, role: 'lgu_admin' })}
                                    >
                                        <Text style={{ fontSize: 13, color: lguForm.role === 'lgu_admin' ? "#1e293b" : "#64748b", fontFamily: lguForm.role === 'lgu_admin' ? "Poppins_600SemiBold" : "Poppins_400Regular" }}>LGU</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 8, borderWidth: 1, borderColor: lguForm.role === 'super_admin' ? "#dc2626" : "#e2e8f0", borderRadius: 8, backgroundColor: lguForm.role === 'super_admin' ? "#fee2e2" : "#fff" }}
                                        onPress={() => setLguForm({ ...lguForm, role: 'super_admin' })}
                                    >
                                        <Text style={{ fontSize: 13, color: lguForm.role === 'super_admin' ? "#1e293b" : "#64748b", fontFamily: lguForm.role === 'super_admin' ? "Poppins_600SemiBold" : "Poppins_400Regular" }}>Admin</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Location (Sitio) - Only for LGUs/Users */}
                                {lguForm.role !== 'super_admin' && (
                                    <View style={{ marginBottom: 16, zIndex: 100 }}>
                                        <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>Location (Sitio) <Text style={{ color: "#dc2626" }}>*</Text></Text>
                                        <TouchableOpacity
                                            style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, height: 44, backgroundColor: "#fff" }}
                                            onPress={() => setShowSitioDropdown(!showSitioDropdown)}
                                        >
                                            <Feather name="map-pin" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                                            <Text style={{ flex: 1, fontSize: 14, color: lguForm.barangay ? "#0f172a" : "#94a3b8" }}>
                                                {lguForm.barangay || "Select Sitio"}
                                            </Text>
                                            <Feather name={showSitioDropdown ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" />
                                        </TouchableOpacity>

                                        {showSitioDropdown && (
                                            <View style={{ position: "absolute", top: 50, left: 0, right: 0, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 5, maxHeight: 150, zIndex: 5000 }}>
                                                <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150 }}>
                                                    {availableLocations.map((sitio, index) => (
                                                        <TouchableOpacity
                                                            key={index}
                                                            style={{ paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: index === availableLocations.length - 1 ? 0 : 1, borderBottomColor: "#f1f5f9" }}
                                                            onPress={() => {
                                                                setLguForm({ ...lguForm, barangay: sitio });
                                                                setShowSitioDropdown(false);
                                                            }}
                                                        >
                                                            <Text style={{ fontSize: 14, color: "#0f172a" }}>{sitio}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Password */}
                                <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>
                                    Password (Optional - auto-generated if empty)
                                </Text>
                                <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, marginBottom: 24, height: 44 }}>
                                    <Feather name="lock" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={{ flex: 1, fontSize: 14, color: "#0f172a", outlineStyle: 'none' }}
                                        placeholder="Leave blank to auto-generate"
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry={true}
                                        value={lguForm.password}
                                        onChangeText={(text) => setLguForm({ ...lguForm, password: text })}
                                    />
                                </View>

                                {/* Create Button */}
                                <TouchableOpacity
                                    onPress={handleCreateUser}
                                    disabled={isSubmitting}
                                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                                >
                                    <LinearGradient
                                        colors={["#6366f1", "#a855f7"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{ borderRadius: 16, paddingVertical: 12, alignItems: "center" }}
                                    >
                                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                                            {isSubmitting ? (
                                                <Text style={{ fontSize: 15, fontFamily: "Poppins_700Bold", color: "#fff" }}>Processing...</Text>
                                            ) : (
                                                <>
                                                    <Feather name="plus" size={18} color="#fff" style={{ marginRight: 8 }} />
                                                    <Text style={{ fontSize: 15, fontFamily: "Poppins_700Bold", color: "#fff" }}>Create Account</Text>
                                                </>
                                            )}
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Edit User Modal */}
                {showEditUserModal && (
                    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                        <View style={{ width: 450, backgroundColor: "#fff", borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 }}>
                            {/* Header */}
                            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: "#1e293b" }}>Edit User</Text>
                                <TouchableOpacity onPress={() => setShowEditUserModal(false)}>
                                    <Feather name="x" size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            {/* Body */}
                            <View style={{ padding: 24 }}>
                                {/* User Info Summary */}
                                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, padding: 12, backgroundColor: "#f8fafc", borderRadius: 12 }}>
                                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center", marginRight: 12, overflow: "hidden" }}>
                                        {editingUser?.avatar_url ? (
                                            <Image source={{ uri: `${API_BASE_URL}${editingUser.avatar_url}` }} style={{ width: "100%", height: "100%" }} />
                                        ) : (
                                            <Text style={{ fontSize: 18, fontFamily: "Poppins_700Bold", color: "#64748b" }}>{editingUser?.name?.substring(0, 2)}</Text>
                                        )}
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#334155" }}>{editingUser?.name}</Text>
                                        <Text style={{ fontSize: 13, color: "#94a3b8" }}>{editingUser?.email}</Text>
                                    </View>
                                </View>

                                {/* Full Name */}
                                <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>Full Name <Text style={{ color: "#dc2626" }}>*</Text></Text>
                                <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, height: 44 }}>
                                    <Feather name="user" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={{ flex: 1, fontSize: 14, color: "#0f172a", outlineStyle: 'none' }}
                                        placeholder="Enter full name"
                                        value={editForm.full_name}
                                        onChangeText={(text) => setEditForm({ ...editForm, full_name: text })}
                                    />
                                </View>

                                 {/* Location Dropdown (Available for LGUs and Mobile Users) */}
                                 {editingUser?.id?.startsWith('u-') && (
                                    <View style={{ marginBottom: 16, zIndex: 2000 }}>
                                        <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>
                                            Location (Sitio) <Text style={{ color: "#dc2626" }}>*</Text>
                                        </Text>
                                        <TouchableOpacity
                                            style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, height: 44, backgroundColor: "#fff" }}
                                            onPress={() => setShowEditSitioDropdown(!showEditSitioDropdown)}
                                        >
                                            <Feather name="map-pin" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                                            <Text style={{ flex: 1, fontSize: 14, color: editForm.barangay ? "#0f172a" : "#94a3b8" }}>
                                                {editForm.barangay || "Select Sitio"}
                                            </Text>
                                            <Feather name={showEditSitioDropdown ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" />
                                        </TouchableOpacity>

                                        {showEditSitioDropdown && (
                                            <View style={{ position: "absolute", top: 50, left: 0, right: 0, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 5, maxHeight: 150, zIndex: 5001 }}>
                                                <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150 }}>
                                                    {availableLocations.map((sitio, index) => (
                                                        <TouchableOpacity
                                                            key={index}
                                                            style={{ paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: index === availableLocations.length - 1 ? 0 : 1, borderBottomColor: "#f1f5f9" }}
                                                            onPress={() => {
                                                                setEditForm({ ...editForm, barangay: sitio });
                                                                setShowEditSitioDropdown(false);
                                                            }}
                                                        >
                                                            <Text style={{ fontSize: 14, color: "#0f172a" }}>{sitio}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Status Toggle */}
                                <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>
                                    Account Status <Text style={{ color: "#dc2626" }}>*</Text>
                                </Text>
                                <View style={{ flexDirection: "row", marginBottom: 24, backgroundColor: "#f1f5f9", borderRadius: 8, padding: 4 }}>
                                    <TouchableOpacity
                                        style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6, backgroundColor: editForm.status === 'active' ? "#fff" : "transparent", shadowColor: editForm.status === 'active' ? "#000" : "transparent", shadowOpacity: 0.1, shadowRadius: 2 }}
                                        onPress={() => setEditForm({ ...editForm, status: 'active' })}
                                    >
                                        <Text style={{ fontSize: 14, fontFamily: "Poppins_500Medium", color: editForm.status === 'active' ? "#16a34a" : "#64748b" }}>Active</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6, backgroundColor: editForm.status === 'inactive' ? "#fff" : "transparent", shadowColor: editForm.status === 'inactive' ? "#000" : "transparent", shadowOpacity: 0.1, shadowRadius: 2 }}
                                        onPress={() => setEditForm({ ...editForm, status: 'inactive' })}
                                    >
                                        <Text style={{ fontSize: 14, fontFamily: "Poppins_500Medium", color: editForm.status === 'inactive' ? "#dc2626" : "#64748b" }}>Inactive</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Role Selection */}
                                <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>
                                    User Role <Text style={{ color: "#dc2626" }}>*</Text>
                                </Text>
                                <View style={{ gap: 8 }}>
                                    <TouchableOpacity
                                        style={{ flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: editForm.role === 'user' ? "#2563eb" : "#e2e8f0", borderRadius: 8, backgroundColor: editForm.role === 'user' ? "#eff6ff" : "#fff" }}
                                        onPress={() => setEditForm({ ...editForm, role: 'user' })}
                                    >
                                        <Feather name="user" size={18} color={editForm.role === 'user' ? "#2563eb" : "#94a3b8"} style={{ marginRight: 12 }} />
                                        <Text style={{ fontSize: 14, color: editForm.role === 'user' ? "#1e293b" : "#64748b", fontFamily: editForm.role === 'user' ? "Poppins_600SemiBold" : "Poppins_400Regular" }}>Regular User</Text>
                                        {editForm.role === 'user' && <Feather name="check" size={18} color="#2563eb" style={{ marginLeft: "auto" }} />}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={{ flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: editForm.role === 'lgu_admin' ? "#7c3aed" : "#e2e8f0", borderRadius: 8, backgroundColor: editForm.role === 'lgu_admin' ? "#f3e8ff" : "#fff" }}
                                        onPress={() => setEditForm({ ...editForm, role: 'lgu_admin' })}
                                    >
                                        <Feather name="shield" size={18} color={editForm.role === 'lgu_admin' ? "#7c3aed" : "#94a3b8"} style={{ marginRight: 12 }} />
                                        <Text style={{ fontSize: 14, color: editForm.role === 'lgu_admin' ? "#1e293b" : "#64748b", fontFamily: editForm.role === 'lgu_admin' ? "Poppins_600SemiBold" : "Poppins_400Regular" }}>LGU Moderator</Text>
                                        {editForm.role === 'lgu_admin' && <Feather name="check" size={18} color="#7c3aed" style={{ marginLeft: "auto" }} />}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={{ flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: editForm.role === 'super_admin' ? "#dc2626" : "#e2e8f0", borderRadius: 8, backgroundColor: editForm.role === 'super_admin' ? "#fee2e2" : "#fff" }}
                                        onPress={() => setEditForm({ ...editForm, role: 'super_admin' })}
                                    >
                                        <Feather name="lock" size={18} color={editForm.role === 'super_admin' ? "#dc2626" : "#94a3b8"} style={{ marginRight: 12 }} />
                                        <Text style={{ fontSize: 14, color: editForm.role === 'super_admin' ? "#1e293b" : "#64748b", fontFamily: editForm.role === 'super_admin' ? "Poppins_600SemiBold" : "Poppins_400Regular" }}>Admin</Text>
                                        {editForm.role === 'super_admin' && <Feather name="check" size={18} color="#dc2626" style={{ marginLeft: "auto" }} />}
                                    </TouchableOpacity>
                                </View>

                                 {/* Password Change (Only for LGUs) */}
                                 {editForm.role === 'lgu_admin' && (
                                     <View style={{ marginTop: 16, marginBottom: 16 }}>
                                         <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 8 }}>Change Password</Text>
                                         <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, height: 44 }}>
                                             <Feather name="key" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                                             <TextInput
                                                 style={{ flex: 1, fontSize: 14, color: "#0f172a", outlineStyle: 'none' }}
                                                 placeholder="Enter new password"
                                                 secureTextEntry={!showEditPassword}
                                                 value={editForm.password}
                                                 onChangeText={(text) => setEditForm({ ...editForm, password: text })}
                                             />
                                             <TouchableOpacity onPress={() => setShowEditPassword(!showEditPassword)}>
                                                 <Feather name={showEditPassword ? "eye-off" : "eye"} size={18} color="#94a3b8" />
                                             </TouchableOpacity>
                                         </View>
                                         <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Leave blank to keep current password</Text>
                                     </View>
                                 )}

                                {/* Save Button */}
                                <TouchableOpacity
                                    style={{ marginTop: 32, backgroundColor: "#2563eb", paddingVertical: 12, borderRadius: 16, alignItems: "center" }}
                                    onPress={handleUpdateUser}
                                    disabled={isSubmitting}
                                >
                                    <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Poppins_700Bold" }}>
                                        {isSubmitting ? "Saving Changes..." : "Save Changes"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Email Verification / Success Modal */}
                {showSuccessModal && (
                    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                        <View style={{ width: 800, flexDirection: 'row', backgroundColor: "#fff", borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, elevation: 15, overflow: 'hidden' }}>

                            {/* Left Column - Success Message */}
                            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 32, justifyContent: 'center', position: 'relative' }}>
                                <View style={{ position: 'absolute', opacity: 0.05, right: -20, bottom: -20 }}>
                                    <Feather name="shield" size={150} color="#000" />
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                                    <Image source={require('../../assets/logo.png')} style={{ width: 40, height: 40, marginRight: 12 }} />
                                    <Text style={{ fontSize: 24, fontFamily: "Poppins_700Bold", color: '#0f172a' }}>FloodGuard</Text>
                                </View>

                                <Text style={{ fontSize: 32, fontFamily: "Poppins_700Bold", color: '#0f172a', marginBottom: 16 }}>Success!</Text>
                                <Text style={{ fontSize: 16, color: '#64748b', lineHeight: 24 }}>
                                    The new account has been successfully created. They can now log in to the system and help keep the community safe.
                                </Text>
                            </View>

                            {/* Right Column - Verification Status */}
                            <View style={{ flex: 1, backgroundColor: '#001D39', padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 28, fontFamily: "Poppins_700Bold", color: '#ffffff', marginBottom: 32 }}>Verify Email</Text>

                                {/* Envelope Icon */}
                                <View style={{ width: 100, height: 70, backgroundColor: '#ffffff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 32 }}>
                                    <Feather name="mail" size={40} color="#001D39" />
                                </View>

                                <Text style={{ fontSize: 16, color: '#e2e8f0', textAlign: 'center', marginBottom: 8 }}>
                                    Email verification has been sent to
                                </Text>
                                <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: '#ffffff', textAlign: 'center', marginBottom: 24 }}>
                                    {createdUserEmail}
                                </Text>

                                <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 32 }}>
                                    Verification link and default password have been sent to the email.
                                </Text>

                                {/* Action Buttons */}
                                <TouchableOpacity
                                    style={{ width: '100%', backgroundColor: '#BDD8E9', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                                    onPress={() => setShowSuccessModal(false)}
                                >
                                    <Text style={{ color: '#0A4174', fontSize: 15, fontFamily: "Poppins_700Bold" }}>Done</Text>
                                </TouchableOpacity>
                            </View>

                        </View>
                    </View>
                )}
            </>
        </View>
    </View>
    );
};

export default UserManagementPage;

const pg = {
    statsRow: {
        flexDirection: "row",
        gap: 16,
        marginBottom: 24,
    },
    statsCard: {
        flex: 1,
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        alignItems: "center", // Vertical layout
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    statsIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    statsValue: {
        fontSize: 24,
        fontFamily: "Poppins_700Bold",
        color: "#0f172a",
        marginBottom: 4,
        fontFamily: "Poppins_700Bold",
    },
    statsLabel: {
        fontSize: 13,
        fontFamily: "Poppins_500Medium",
        color: "#64748b",
        fontFamily: "Poppins_500Medium",
    },
    toolbar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
        backgroundColor: "#ffffff",
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 16,
        paddingHorizontal: 12,
        height: 44,
        maxWidth: 400,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#0f172a",
        outlineStyle: 'none',
    },
    filterSelect: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 44,
        minWidth: 140,
        justifyContent: "space-between",
    },
    filterSelectText: {
        fontSize: 14,
        fontFamily: "Poppins_500Medium",
        color: "#475569",
    },
    dropdown: {
        position: "absolute",
        top: 50,
        right: 0,
        width: 180,
        backgroundColor: "#ffffff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
        zIndex: 1000,
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
    },
    dropdownItemText: {
        fontSize: 14,
        color: "#475569",
    },
    addUserBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2563eb",
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 44,
        gap: 8,
    },
    addUserBtnText: {
        color: "#ffffff",
        fontSize: 14,
        fontFamily: "Poppins_600SemiBold",
    }
};
