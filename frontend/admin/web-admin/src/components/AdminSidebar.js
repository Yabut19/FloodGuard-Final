import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, TextInput, Modal, useWindowDimensions, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/globalStyles";
import { API_BASE_URL } from "../config/api";

const AdminSidebar = ({ activePage, onNavigate, onLogout, variant = "lgu" }) => {
    const isSuperAdmin = variant === "superadmin";
    const { width } = useWindowDimensions();
    const isMobileModal = width < 768;

    // Initialize state from localStorage if available, otherwise default to false (expanded)
    const [isCollapsed, setIsCollapsed] = React.useState(() => {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('sidebarCollapsed') === 'true';
        }
        return false;
    });

    // New state for profile expansion
    const [isProfileExpanded, setIsProfileExpanded] = React.useState(false);

    const toggleSidebar = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sidebarCollapsed', newState.toString());
        }
    };

    const navItems = isSuperAdmin
        ? [
            { id: "overview", label: "Overview", icon: "grid" },
            { id: "sensor-registration", label: "Sensor Management", icon: "cpu" },
            { id: "alert-management", label: "Alert Management", icon: "bell" },
            { id: "user-management", label: "User Management", icon: "users" },
            { id: "data-reports", label: "Data & Reports", icon: "file-text" },
            { id: "threshold-config", label: "Threshold Config", icon: "settings" },
        ]
        : [
            { id: "overview", label: "Overview", icon: "grid" },
            { id: "sensor-registration", label: "Sensor Management", icon: "cpu" },
            { id: "alert-management", label: "Alert Management", icon: "bell" },
            { id: "evacuation-management", label: "Evacuation Centers", icon: "home" },
            { id: "data-reports", label: "Data & Reports", icon: "file-text" },
        ];

    const roleLabel = isSuperAdmin ? "Super Admin" : "LGU Moderator";

    const [userName, setUserName] = React.useState("Admin User");
    const [avatarUrl, setAvatarUrl] = React.useState(null);
    const [isProfileModalVisible, setIsProfileModalVisible] = React.useState(false);

    // New state for avatar preview and file selection
    const [previewAvatarUrl, setPreviewAvatarUrl] = React.useState(null);
    const [selectedAvatarFile, setSelectedAvatarFile] = React.useState(null);
    const [isSaving, setIsSaving] = React.useState(false);

    const [profileForm, setProfileForm] = React.useState({
        full_name: "",
        email: "",
        phone: ""
    });

    React.useEffect(() => {
        // Check for stored name on component mount
        if (typeof localStorage !== 'undefined') {
            const storedName = localStorage.getItem("userName");
            if (storedName) {
                setUserName(storedName);
            }

            // Try to fetch user data for profile
            const userId = localStorage.getItem("userId");
            const userType = (isSuperAdmin || variant === 'lgu') ? 'admin' : 'user';

            if (userId) {
                fetch(`${API_BASE_URL}/api/users/${userId}?type=${userType}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.avatar_url) {
                            setAvatarUrl(`${API_BASE_URL}${data.avatar_url}`);
                        }
                        // Initialize form data
                        setProfileForm({
                            full_name: data.full_name || "",
                            email: data.email || "",
                            phone: data.phone || ""
                        });
                    })
                    .catch(err => console.error("Failed to fetch user profile:", err));
            }
        }
    }, []);

    const handleUpdateProfile = async () => {
        const userId = localStorage.getItem("userId");
        const userType = isSuperAdmin ? 'admin' : 'user';

        setIsSaving(true);

        try {
            // 1. Upload Avatar if selected
            if (selectedAvatarFile) {
                const formData = new FormData();
                formData.append("image", selectedAvatarFile);

                const avatarRes = await fetch(`${API_BASE_URL}/api/users/${userId}/avatar?type=${userType}`, {
                    method: "POST",
                    body: formData,
                });

                if (avatarRes.ok) {
                    const avatarData = await avatarRes.json();
                    setAvatarUrl(`${API_BASE_URL}${avatarData.avatar_url}`);
                } else {
                    const errData = await avatarRes.json();
                    console.error("Avatar upload failed:", errData);
                    alert("Failed to upload avatar, but proceeding with profile update.");
                }
            }

            // 2. Update Profile Details
            const response = await fetch(`${API_BASE_URL}/api/users/${userId}?type=${userType}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(profileForm),
            });

            const data = await response.json();
            if (response.ok) {
                alert("Profile updated successfully");
                setUserName(profileForm.full_name);
                localStorage.setItem("userName", profileForm.full_name);

                // Clear preview/selection state
                setPreviewAvatarUrl(null);
                setSelectedAvatarFile(null);
                setIsProfileModalVisible(false);
            } else {
                alert(data.error || "Failed to update profile");
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Error updating profile");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Set file for later upload
        setSelectedAvatarFile(file);

        // Create preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewAvatarUrl(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const getInitials = (name) => {
        return name
            .split(' ')
            .filter(n => n.length > 0)
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    const sidebarWidth = isCollapsed ? 80 : undefined; // Let global style handle expanded width or override inline

    return (
        <View style={[styles.dashboardSidebar, {
            backgroundColor: 'transparent',
            overflow: 'hidden',
            width: isCollapsed ? (isMobileModal ? 60 : 80) : (isMobileModal ? '80%' : styles.dashboardSidebar.width || 300),
            paddingHorizontal: isCollapsed ? 10 : 20,
            position: isMobileModal && !isCollapsed ? 'absolute' : 'relative',
            height: '100%',
            zIndex: 999,
            transition: 'all 0.3s ease' // Web transition
        }]}>
            {/* Abstract Background Design - Dark Blue */}
            <LinearGradient
                colors={["#001D39", "#0A4174"]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Abstract Lines - Hide when collapsed for cleaner look */}
            {!isCollapsed && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
                    {/* Line 1 */}
                    <View style={{
                        position: 'absolute',
                        top: -20,
                        right: -50,
                        width: 200,
                        height: 300,
                        borderWidth: 2,
                        borderColor: "rgba(123, 189, 232, 0.15)",
                        borderRadius: 150,
                        transform: [{ rotate: '-45deg' }]
                    }} />

                    {/* Line 2 */}
                    <View style={{
                        position: 'absolute',
                        top: 100,
                        right: -80,
                        width: 250,
                        height: 350,
                        borderWidth: 2,
                        borderColor: "rgba(123, 189, 232, 0.1)",
                        borderRadius: 175,
                        transform: [{ rotate: '-30deg' }]
                    }} />

                    {/* Line 3 - Bottom */}
                    <View style={{
                        position: 'absolute',
                        bottom: -50,
                        left: -50,
                        width: 300,
                        height: 300,
                        borderWidth: 2,
                        borderColor: "rgba(123, 189, 232, 0.1)",
                        borderRadius: 150,
                        transform: [{ rotate: '45deg' }]
                    }} />

                    {/* Filled Shape for emphasis */}
                    <LinearGradient
                        colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0)"]}
                        style={{
                            position: 'absolute',
                            top: 50,
                            right: -40,
                            width: 150,
                            height: 150,
                            borderRadius: 75,
                        }}
                    />
                </View>
            )}

            {/* Burger Icon Toggle */}
            <View style={{
                alignItems: 'flex-end', // Align right as requested
                marginBottom: 16,
                paddingRight: isCollapsed ? 0 : 0, // No extra padding needed for right align usually, but kept clean
                paddingLeft: 0,
                width: '100%' // Ensure container takes full width to allow flex-end to work
            }}>
                <TouchableOpacity
                    onPress={toggleSidebar}
                    style={{
                        padding: 8,
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        marginRight: isCollapsed ? 0 : 0, // Adjust if needed
                        alignSelf: isCollapsed ? 'center' : 'flex-end' // Center when collapsed (small width), right when expanded
                    }}
                >
                    <Feather name={isCollapsed ? "menu" : "chevron-left"} size={24} color="#7BBDE8" />
                </TouchableOpacity>
            </View>

            {/* Header Section */}
            {!isCollapsed && (
                <View style={[styles.dashboardSidebarHeader, { alignItems: 'center' }]}>
                    <View style={{
                        width: 80,
                        height: 80,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12
                    }}>
                        <Image
                            source={require('../../assets/logo.png')}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={[styles.dashboardSidebarTitle, { textAlign: 'center', fontSize: 26, color: '#e2e8f0' }]}>FloodGuard</Text>
                </View>
            )}

            {/* Show only Logo Icon when Collapsed */}
            {isCollapsed && (
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <Image
                        source={require('../../assets/logo.png')}
                        style={{ width: 40, height: 40 }}
                        resizeMode="contain"
                    />
                </View>
            )}

            {/* Navigation Section */}
            <ScrollView style={styles.dashboardNavSection} showsVerticalScrollIndicator={false}>
                {navItems.map((item) => {
                    const isActive = activePage === item.id;
                    const NavItemComponent = isActive ? View : TouchableOpacity;
                    const navItemStyle = isActive ? styles.dashboardNavItemActive : styles.dashboardNavItem;
                    const textStyle = isActive ? styles.dashboardNavItemActiveText : styles.dashboardNavItemText;

                    return (
                        <NavItemComponent
                            key={item.id}
                            style={[
                                navItemStyle,
                                isActive ? { backgroundColor: 'rgba(123, 189, 232, 0.15)', borderRightWidth: 3, borderRightColor: '#7BBDE8' } : null,
                                isCollapsed && { justifyContent: 'center', paddingHorizontal: 0 }
                            ]}
                            onPress={isActive ? undefined : () => {
                                onNavigate(item.id);
                                if (isMobileModal) setIsCollapsed(true); // Auto close on mobile
                            }}
                        >
                            <Feather
                                name={item.icon}
                                size={isCollapsed ? 24 : 18}
                                color={isActive ? "#BDD8E9" : "#64748b"}
                                style={[styles.dashboardNavIcon, isCollapsed && { marginRight: 0 }]}
                            />
                            {!isCollapsed && <Text style={[textStyle, { color: isActive ? "#BDD8E9" : "#94a3b8" }]}>{item.label}</Text>}
                        </NavItemComponent>
                    );
                })}
            </ScrollView>

            {/* Footer Section - User Profile & Logout - Drop-up Menu */}
            <View style={[styles.dashboardSidebarFooter, { flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0, position: 'relative', zIndex: 100 }]}>

                {/* Drop-up Menu */}
                {/* Drop-up Menu */}
                {isProfileExpanded && !isCollapsed && (
                    <View style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 10,
                        right: 10,
                        backgroundColor: '#0A4174',
                        borderRadius: 12,
                        padding: 8,
                        marginBottom: 8,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 5,
                        zIndex: 1000,
                        borderWidth: 1,
                        borderColor: 'rgba(123, 189, 232, 0.15)',
                    }}>
                        {/* Profile Settings Button */}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 4,
                            }}
                            onPress={() => {
                                setIsProfileModalVisible(true);
                                setIsProfileExpanded(false);
                                // Reset preview when opening modal
                                setPreviewAvatarUrl(null);
                                setSelectedAvatarFile(null);
                            }}
                        >
                            <Feather name="settings" size={18} color="#e2e8f0" style={{ marginRight: 12 }} />
                            <Text style={{ fontSize: 14, fontFamily: 'Poppins_500Medium', color: '#e2e8f0' }}>Profile Settings</Text>
                        </TouchableOpacity>

                        {/* Logout Button */}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 12,
                                borderRadius: 8,
                                backgroundColor: 'rgba(239, 68, 68, 0.1)', // Dark red theme bg
                            }}
                            onPress={onLogout}
                        >
                            <Feather name="log-out" size={18} color="#ef4444" style={{ marginRight: 12 }} />
                            <Text style={{ fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#ef4444' }}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Profile Settings Modal */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={isProfileModalVisible}
                    onRequestClose={() => setIsProfileModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modal, {
                            maxWidth: 1000, // Increased from 800
                            width: '95%',  // Increased from 90%
                            flexDirection: isMobileModal ? 'column' : 'row',
                            padding: 0,
                            backgroundColor: '#fff',
                            borderRadius: 24, // Slightly rounder
                            overflow: 'hidden'
                        }]}>

                            {/* Left Pane - Avatar Section */}
                            <View style={{
                                width: isMobileModal ? '100%' : 380, // Increased from 300
                                padding: 32, // Increased padding
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRightWidth: isMobileModal ? 0 : 1,
                                borderBottomWidth: isMobileModal ? 1 : 0,
                                borderColor: '#f1f5f9',
                                backgroundColor: '#ffffff'
                            }}>
                                <View style={{
                                    width: 200, // Increased from 160
                                    height: 200, // Increased from 160
                                    borderRadius: 100, // Increased from 80
                                    overflow: 'hidden',
                                    marginBottom: 24, // Increased from 16
                                    backgroundColor: '#f1f5f9',
                                    borderWidth: 5, // Increased from 4
                                    borderColor: '#f8fafc',
                                    shadowColor: "#000",
                                    shadowOffset: { width: 0, height: 6 }, // Increased shadow
                                    shadowOpacity: 0.1,
                                    shadowRadius: 15, // Increased shadow
                                    elevation: 6, // Increased elevation
                                }}>
                                    {previewAvatarUrl ? (
                                        <Image source={{ uri: previewAvatarUrl }} style={{ width: '100%', height: '100%' }} />
                                    ) : avatarUrl ? (
                                        <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 50, fontFamily: 'Poppins_700Bold', color: '#94a3b8' }}>{getInitials(userName)}</Text>
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity
                                    onPress={() => {
                                        const fileInput = document.getElementById('avatar-upload-input-modal');
                                        if (fileInput) fileInput.click();
                                    }}
                                    style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                                >
                                    <Text style={{ fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#64748b' }}>Change</Text>
                                </TouchableOpacity>

                                {/* Hidden File Input */}
                                {Platform.OS === 'web' && (
                                    <input
                                        type="file"
                                        id="avatar-upload-input-modal"
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                    />
                                )}
                            </View>

                            {/* Right Pane - Form Details */}
                            <View style={{
                                flex: 1,
                                padding: 48, // Increased from 32
                                backgroundColor: '#ffffff'
                            }}>
                                {/* Header with Close Button */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                                    <Text style={{ fontSize: 28, fontFamily: 'Poppins_700Bold', color: '#0f172a' }}>Profile</Text>
                                    <TouchableOpacity onPress={() => setIsProfileModalVisible(false)} style={{ padding: 4 }}>
                                        <Feather name="x" size={28} color="#64748b" />
                                    </TouchableOpacity>
                                </View>

                                {/* Input Grid */}
                                <View style={{ flexDirection: isMobileModal ? 'column' : 'row', gap: 24, marginBottom: 24 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#0f172a', marginBottom: 8 }}>Full Name</Text>
                                        <TextInput
                                            style={{
                                                borderWidth: 1.5,
                                                borderColor: '#e2e8f0',
                                                borderRadius: 16,
                                                paddingHorizontal: 16,
                                                paddingVertical: 16,
                                                fontSize: 16,
                                                fontFamily: 'Poppins_400Regular',
                                                color: '#0f172a'
                                            }}
                                            value={profileForm.full_name}
                                            onChangeText={(text) => setProfileForm({ ...profileForm, full_name: text })}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#0f172a', marginBottom: 8 }}>Email</Text>
                                        <TextInput
                                            style={{
                                                borderWidth: 1.5,
                                                borderColor: '#e2e8f0',
                                                borderRadius: 16,
                                                paddingHorizontal: 16,
                                                paddingVertical: 16,
                                                fontSize: 16,
                                                fontFamily: 'Poppins_400Regular',
                                                color: '#0f172a'
                                            }}
                                            value={profileForm.email}
                                            onChangeText={(text) => setProfileForm({ ...profileForm, email: text })}
                                            keyboardType="email-address"
                                        />
                                    </View>
                                </View>

                                <View style={{ flexDirection: isMobileModal ? 'column' : 'row', gap: 24, marginBottom: 32 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#0f172a', marginBottom: 8 }}>Role</Text>
                                        <View style={{
                                            borderWidth: 1.5,
                                            borderColor: '#e2e8f0',
                                            borderRadius: 16,
                                            backgroundColor: '#f8fafc',
                                            paddingHorizontal: 16,
                                            paddingVertical: 16,
                                        }}>
                                            <Text style={{
                                                fontSize: 16,
                                                fontFamily: 'Poppins_400Regular',
                                                color: '#64748b'
                                            }}>
                                                {roleLabel}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#0f172a', marginBottom: 8 }}>Phone Number</Text>
                                        <TextInput
                                            style={{
                                                borderWidth: 1.5,
                                                borderColor: '#e2e8f0',
                                                borderRadius: 16,
                                                paddingHorizontal: 16,
                                                paddingVertical: 16,
                                                fontSize: 16,
                                                fontFamily: 'Poppins_400Regular',
                                                color: '#0f172a'
                                            }}
                                            value={profileForm.phone}
                                            onChangeText={(text) => setProfileForm({ ...profileForm, phone: text })}
                                            keyboardType="phone-pad"
                                            placeholder="+63 912 345 6789"
                                        />
                                    </View>
                                </View>

                                {/* Footer Action Buttons */}
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 'auto' }}>
                                    <TouchableOpacity
                                        style={{
                                            paddingVertical: 12,
                                            paddingHorizontal: 24,
                                            borderRadius: 16,
                                            borderWidth: 1.5,
                                            borderColor: '#e2e8f0',
                                            backgroundColor: '#ffffff'
                                        }}
                                        onPress={() => setIsProfileModalVisible(false)}
                                    >
                                        <Text style={{ fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#475569' }}>Cancel</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={{
                                            paddingVertical: 12,
                                            paddingHorizontal: 32,
                                            borderRadius: 16,
                                            backgroundColor: '#3b82f6',
                                            opacity: isSaving ? 0.7 : 1,
                                            minWidth: 120,
                                            alignItems: 'center'
                                        }}
                                        disabled={isSaving}
                                        onPress={handleUpdateProfile}
                                    >
                                        <Text style={{ fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#ffffff' }}>
                                            {isSaving ? "Saving..." : "Save"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setIsProfileExpanded(!isProfileExpanded)}
                    style={{
                        flexDirection: isCollapsed ? 'column' : 'row',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        padding: 12,
                        backgroundColor: isProfileExpanded ? 'rgba(0,0,0,0.05)' : 'transparent',
                        borderRadius: 12
                    }}
                >
                    <View style={[styles.dashboardUserAvatar, { width: 40, height: 40, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(123, 189, 232, 0.1)' }]}>
                        {avatarUrl ? (
                            <Image
                                source={{ uri: avatarUrl }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                            />
                        ) : (
                            <Text style={[styles.dashboardUserAvatarText, { fontSize: 16, color: '#BDD8E9' }]}>{getInitials(userName)}</Text>
                        )}
                    </View>

                    {!isCollapsed && (
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={[styles.dashboardUserName, { color: '#e2e8f0' }]} numberOfLines={1}>{userName}</Text>
                            <Text style={[styles.dashboardUserRole, { marginTop: 2, color: '#94a3b8' }]}>{roleLabel}</Text>
                        </View>
                    )}

                    {/* Chevron to indicate expandability */}
                    {!isCollapsed && (
                        <Feather
                            name={isProfileExpanded ? "chevron-down" : "chevron-up"}
                            size={16}
                            color="#7BBDE8"
                            style={{ opacity: 0.8 }}
                        />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default AdminSidebar;
