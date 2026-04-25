import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  StatusBar,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  useWindowDimensions,
  Linking,
  ImageBackground,
  TouchableWithoutFeedback,
  Switch,
  BackHandler,
  InteractionManager,
  AppState,
} from "react-native";
import { NavigationContainer, useFocusEffect, createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

function globalNavigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
import { createStackNavigator } from "@react-navigation/stack";
import { createDrawerNavigator, DrawerContentScrollView } from "@react-navigation/drawer";
import { LinearGradient } from "expo-linear-gradient";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { CardStyleInterpolators } from "@react-navigation/stack";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { io } from "socket.io-client";

export const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

const LocationContext = createContext(null);
const useUserLocation = () => useContext(LocationContext);

const NotificationContext = createContext(null);
const useNotifications = () => useContext(NotificationContext);

const SensorStatusContext = createContext({ isOnline: true });
const useSensorStatus = () => useContext(SensorStatusContext);

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

let globalMobileSocket = null;
let socketResetListener = null;

/**
 * disconnectMobileSocket Function
 * Manually disconnects and nullifies the global mobile socket instance.
 * Useful during logout to ensure a fresh connection on the next login.
 */
export const disconnectMobileSocket = () => {
  if (globalMobileSocket) {
    console.log("[Socket] Manually disconnecting mobile socket...");
    globalMobileSocket.disconnect();
    globalMobileSocket = null;
    // Trigger listener to re-initialize if needed
    if (socketResetListener) socketResetListener(Date.now());
  }
};

const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [reinitTicket, setReinitTicket] = useState(0);

  useEffect(() => {
    socketResetListener = setReinitTicket;
    
    if (!globalMobileSocket) {
      console.log("[Socket] Creating fresh connection...");
      globalMobileSocket = io(API_BASE, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        pingTimeout: 10000,
        pingInterval: 5000,
      });

      globalMobileSocket.on("connect", () => console.log("[Socket] Connection established"));
      globalMobileSocket.on("disconnect", (reason) => {
        console.log("[Socket] Connection lost:", reason);
      });
    }
    
    setSocket(globalMobileSocket);

    // ── FOREGROUND LIVELINESS GUARD ──
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        console.log("[Socket] App returned to foreground, checking connection...");
        if (globalMobileSocket && !globalMobileSocket.connected) {
          globalMobileSocket.connect();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      if (socketResetListener === setReinitTicket) socketResetListener = null;
      subscription.remove();
    };
  }, [reinitTicket]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

const SensorStatusProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  return (
    <SensorStatusContext.Provider value={{ isOnline, setIsOnline }}>
      {children}
    </SensorStatusContext.Provider>
  );
};

/**
 * Utility for standardized date and time formatting
 * Philippine Standard Time (UTC+8 / Asia/Manila)
 */
const formatPST = (date) => {
  if (!date) return "—";
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const options = {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(d);
  const getPart = (type) => parts.find(p => p.type === type)?.value || "";

  // Requested Format: Thursday, 23 April 2026 • 6:54:12 PM
  return `${getPart('weekday')}, ${getPart('day')} ${getPart('month')} ${getPart('year')} • ${getPart('hour')}:${getPart('minute')}:${getPart('second')} ${getPart('dayPeriod')}`;
};

const formatPSTShort = (date) => {
  if (!date) return "—";
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const options = {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return new Intl.DateTimeFormat('en-US', options).format(d);
};

const SystemTime = ({ style }) => {
  const [time, setTime] = useState(formatPST(new Date()));
  useEffect(() => {
    const interval = setInterval(() => setTime(formatPST(new Date())), 1000);
    return () => clearInterval(interval);
  }, []);
  return <Text style={style}>{time}</Text>;
};

export const theme = {
  background: "#1E2A38",
  surface: "#283747",
  textPrimary: "#ffffff",
  textSecondary: "#94a3b8",
  border: "#44566A",
  primary: "#74C5E6",
  accent: "#437D8F",
  statusSafe: "#2fb864",
  statusSafeBg: "rgba(47, 184, 100, 0.15)",
  danger: "#e2463b",
  badgeBg: "#34495E",
  drawerActiveBg: "rgba(116, 197, 230, 0.1)",
  drawerActiveBorder: "#74C5E6",
  cardBlue: "rgba(10, 65, 116, 0.6)",
  mapCard: "#34495E",
  brandGradient: ["#437D8F", "#6EA2B3"]
};


const API_BASE = "http://192.168.254.160:5000"; // Updated to current machine IP (172.16.17.33)

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();
const BRAND_GRADIENT = ["#74C5E6", "#6a36f5"];
const EVAC_GRADIENT = ["#e2463b", "#f08c2e"];
const STEPS = 4;
const LANDING_IMAGE = require("./assets/flood2.jpg");
const LANDING_BG = require("./assets/flood3.jpg");
const ACCOUNT_IMAGE = require("./assets/flood.png");
const LOCATION_IMAGE = require("./assets/flood4.jpg");
const NOTIFY_IMAGE = require("./assets/flood5.jpg");
const LOGO = require("./assets/logo.png");

const safeGoBack = (navigation, fallback) => {
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  if (fallback) {
    navigation.navigate(fallback);
  }
};

const MABOLO_REGION = {
  latitude: 10.3172,
  longitude: 123.9181,
  latitudeDelta: 0.0075,
  longitudeDelta: 0.0075,
};

const MABOLO_BOUNDARY = [
  { latitude: 10.3208, longitude: 123.9133 },
  { latitude: 10.3212, longitude: 123.9217 },
  { latitude: 10.3135, longitude: 123.9222 },
  { latitude: 10.3129, longitude: 123.9142 },
];

const SENSOR_POINTS = [
  { id: "sensor-1", latitude: 10.3189, longitude: 123.9162, risk: "low" },
  { id: "sensor-2", latitude: 10.3166, longitude: 123.9194, risk: "medium" },
  { id: "sensor-3", latitude: 10.3152, longitude: 123.9169, risk: "high" },
  { id: "sensor-4", latitude: 10.3181, longitude: 123.9207, risk: "low" },
];
const IOT_SENSOR_ID = "sensor-1";

const USER_LOCATION = { latitude: 10.3165, longitude: 123.9176 };

const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return "N/A";
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d.toFixed(1) + " km";
};
const SAFE_ROUTE = [
  { latitude: 10.3165, longitude: 123.9176 },
  { latitude: 10.3178, longitude: 123.9185 },
  { latitude: 10.3192, longitude: 123.9198 },
];
const FLOOD_ZONE = [
  { latitude: 10.3142, longitude: 123.9149 },
  { latitude: 10.3152, longitude: 123.9156 },
  { latitude: 10.3141, longitude: 123.9174 },
  { latitude: 10.3134, longitude: 123.9159 },
];

const EVAC_CENTERS = [
  {
    id: "center-1",
    name: "Barangay Hall Mabolo",
    distance: "0.8 km",
    capacity: 200,
    slots: 150,
    status: "open",
    phone: "+639171234567",
    coordinate: { latitude: 10.3179, longitude: 123.9153 },
  },
  {
    id: "center-2",
    name: "Kalidhay Park Center",
    distance: "1.2 km",
    capacity: 120,
    slots: 0,
    status: "full",
    phone: "+639189876543",
    coordinate: { latitude: 10.3195, longitude: 123.9211 },
  },
  {
    id: "center-3",
    name: "Mabolo Elementary School",
    distance: "1.5 km",
    capacity: 180,
    slots: 60,
    status: "open",
    phone: "+639167777888",
    coordinate: { latitude: 10.3147, longitude: 123.9192 },
  },
];

const REPORT_TYPES = ["Flooding", "Water Level", "Road Closure", "Other"];
const RECENT_REPORTS = [
  {
    id: "report-1",
    type: "Flooding",
    location: "Sitio San Vicente",
    timestamp: "2 hours ago",
    status: "Under Review",
  },
  {
    id: "report-2",
    type: "Water Level",
    location: "Sitio Magtalisay",
    timestamp: "Yesterday",
    status: "Verified",
  },
];

const SETTINGS_ITEMS = [
  {
    id: "notifications",
    title: "Alert Preferences",
    description: "Manage notification types and frequency",
    icon: "notifications",
    section: "Notifications",
  },
  {
    id: "locations",
    title: "Location Map",
    description: "View real-time evacuation routes and centers",
    icon: "map",
    section: "Location & Map",
  },
  {
    id: "privacy",
    title: "Privacy & Security",
    description: "Manage data and permissions",
    icon: "lock-closed",
    section: "App Settings",
  },
  {
    id: "help",
    title: "Help & Documentation",
    description: "User guides and troubleshooting",
    icon: "help-circle",
    section: "Support",
  },
];

const NAV_ROUTE = [
  { latitude: 10.3165, longitude: 123.9176 },
  { latitude: 10.3172, longitude: 123.9186 },
  { latitude: 10.3183, longitude: 123.9197 },
];
const NAV_ALT_ROUTE = [
  { latitude: 10.3165, longitude: 123.9176 },
  { latitude: 10.3169, longitude: 123.9161 },
  { latitude: 10.3186, longitude: 123.9158 },
];
const NAV_STEPS = [
  { id: "step-1", text: "Turn left onto Evacuation Road", distance: "150 m" },
  { id: "step-2", text: "Destination will be on your right", distance: "50 m" },
];

const openDirections = (coordinate, label = "Destination") => {
  const { latitude, longitude } = coordinate;
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${latitude},${longitude}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`;
  Linking.openURL(url);
};

const callCenter = (phone) => {
  if (!phone) return;
  Linking.openURL(`tel:${phone}`);
};

const getStatusColor = (status) => {
  switch (status) {
    case "CRITICAL": return "#dc2626"; // Red
    case "WARNING": return "#f97316";  // Orange
    case "ADVISORY": return "#3b82f6"; // Blue
    case "NORMAL": return "#22c55e";   // Green
    case "OFFLINE": return "#64748b";
    default: return "#64748b";
  }
};

const getStatusBgColor = (status) => {
  switch (status) {
    case "CRITICAL": return "rgba(220, 38, 38, 0.1)";
    case "WARNING": return "rgba(249, 115, 22, 0.1)";
    case "ADVISORY": return "rgba(59, 130, 246, 0.1)";
    case "NORMAL": return "rgba(34, 197, 94, 0.1)";
    case "OFFLINE": return "rgba(100, 116, 139, 0.1)";
    default: return "rgba(100, 116, 139, 0.1)";
  }
};

// Animated Water Wave Component for Sensor Gauge (Mobile version)
const WaterWave = ({ color, fillPercentage }) => {
  const rotation1 = React.useRef(new Animated.Value(0)).current;
  const rotation2 = React.useRef(new Animated.Value(0)).current;
  const rotation3 = React.useRef(new Animated.Value(0)).current;

  // Realism colors: Body is always liquid blue, but the surface/shimmer represents the status.
  const LIQUID_BODY = "#0369a1"; // Deep Cyan-Blue
  const LIQUID_DEPTH = "#075985"; // Darker Navy-Blue

  React.useEffect(() => {
    const startAnimation = (val, duration) => {
      Animated.loop(
        Animated.timing(val, {
          toValue: 1,
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    };

    startAnimation(rotation1, 4500); // Slightly faster
    startAnimation(rotation2, 9000); // Slower counter-wave
    startAnimation(rotation3, 3000); // Fast shimmer
  }, []);

  const spin1 = rotation1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spin2 = rotation2.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  const spin3 = rotation3.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Calculate the base top position (0% fill is top: '100%', 100% fill is top: '0%')
  const baseTop = 100 - fillPercentage;

  return (
    <View style={{ height: '100%', width: '100%', position: 'absolute', bottom: 0, overflow: 'hidden' }}>
      {/* 
        Solid Body Base (Liquid realism color)
      */}
      <View style={{
        position: 'absolute',
        top: `${baseTop}%`,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: LIQUID_BODY,
        marginTop: 15, // Gap for wave peak transition
      }} />

      {/* Surface Depth Color Layer (Darker base) */}
      <Animated.View style={{
        position: 'absolute',
        top: `${baseTop}%`,
        marginTop: -385,
        left: -175,
        width: 450,
        height: 450,
        borderRadius: 185,
        backgroundColor: LIQUID_DEPTH,
        opacity: 0.5,
        transform: [{ rotate: spin2 }]
      }} />

      {/* STATUS WAVE LAYER (This represents the actual advisory level) */}
      <Animated.View style={{
        position: 'absolute',
        top: `${baseTop}%`,
        marginTop: -390,
        left: -175,
        width: 450,
        height: 450,
        borderRadius: 180,
        backgroundColor: color, // Shows the advisory/warning color
        opacity: 0.9,
        transform: [{ rotate: spin1 }]
      }} />

      {/* Shimmer Highlight (Using status color tinted white) */}
      <Animated.View style={{
        position: 'absolute',
        top: `${baseTop}%`,
        marginTop: -395,
        left: -165,
        width: 450,
        height: 450,
        borderRadius: 175,
        backgroundColor: color === "#fbbf24" ? 'rgba(255,255,150,0.3)' : 'rgba(255,255,255,0.3)',
        transform: [{ rotate: spin3 }]
      }} />

      {/* Subtle Bottom Realism Glow */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.2)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' }}
      />
    </View>
  );
};

const ALERTS = [
  {
    id: "alert-1",
    title: "Medium Risk Alert",
    description: "Water level rising in Sitio Magtalisay. Monitor conditions closely.",
    status: "active",
    severity: "medium",
    location: "Sitio Magtalisay",
    timestamp: "15 minutes ago",
    actions: "Stay prepared and avoid low-lying roads.",
  },
  {
    id: "alert-2",
    title: "Weather Update",
    description: "Heavy rainfall expected in the next 2 hours. Stay alert.",
    status: "active",
    severity: "low",
    location: "City-wide",
    timestamp: "1 hour ago",
    actions: "Secure loose items and keep emergency kits ready.",
  },
  {
    id: "alert-3",
    title: "All Clear",
    description: "Water levels have returned to normal in Sitio San Vicente.",
    status: "resolved",
    severity: "low",
    location: "Sitio San Vicente",
    timestamp: "3 hours ago",
    actions: "Continue monitoring updates in the app.",
  },
  {
    id: "alert-4",
    title: "High Risk - Evacuate Now",
    description: "Immediate evacuation required for low-lying areas.",
    status: "active",
    severity: "critical",
    location: "Sitio Laray Holy Name",
    timestamp: "5 hours ago",
    actions: "Proceed to designated evacuation centers immediately.",
  },
];

const PrimaryButton = ({ label, onPress, disabled, style }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={[
        disabled ? styles.buttonDisabled : null,
        { width: "100%" }
      ]}
    >
      <LinearGradient
        colors={theme.brandGradient}
        style={[
          styles.primaryButton,
          disabled && styles.primaryButtonDisabled,
          style,
          { width: "100%" }
        ]}
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );
};

const SecondaryButton = ({ label, onPress, style, textStyle }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <TouchableOpacity style={[styles.secondaryButton, style]} onPress={onPress}>
      <Text style={[styles.secondaryButtonText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
};

const Card = ({ children, style }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={[styles.card, style]}>{children}</View>
  );
};

const StepHeader = ({ step }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.stepHeader}>
      <Text style={styles.stepLabel}>Step {step} of {STEPS}</Text>
      <View style={styles.progressTrack}>
        {Array.from({ length: STEPS }).map((_, index) => (
          <View
            key={`step-${index}`}
            style={[
              styles.progressSegment,
              index < step ? styles.progressActive : styles.progressInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const ScreenLayout = ({ step, children }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const bottomInset = Platform.OS === "android" ? 36 : 12;
  const headerPaddingTop = Platform.OS === "android" ? 16 : 14;

  return (
    <SafeAreaView style={styles.safe}>
      {Platform.OS === "android" ? (
        <View style={[styles.statusBarSpacer, { height: topInset }]} />
      ) : null}
      <LinearGradient
        colors={theme.brandGradient}
        style={[styles.headerGradient, { paddingTop: headerPaddingTop }]}
      >
        <StepHeader step={step} />
      </LinearGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 40 + bottomInset },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const LoadingScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace("Landing");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.loadingContainer}>
      <View style={styles.loadingContent}>
        <Image source={LOGO} style={styles.loadingLogo} />
      </View>
    </SafeAreaView>
  );
};

// Premium Welcome Alert Modal Component
const WelcomeAlertModal = ({ visible, userName, onDismiss }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const firstName = userName?.split(' ')[0] || "User";

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.welcomeAlertCard}>
          <View style={styles.welcomeAlertIconContainer}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.welcomeAlertIconGradient}
            >
              <Ionicons name="checkmark" size={40} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.welcomeAlertTitle}>Welcome Back!</Text>
          <Text style={styles.welcomeAlertGreeting}>Great to see you, {firstName}.</Text>
          <Text style={styles.welcomeAlertMessage}>
            The system is fully operational and monitoring for your safety.
          </Text>

          <TouchableOpacity
            style={styles.welcomeAlertButton}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#74C5E6', '#3490dc']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.welcomeAlertButtonGradient}
            >
              <Text style={styles.welcomeAlertButtonText}>GET STARTED</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Premium Logout Confirmation Modal Component
const LogoutConfirmationModal = ({ visible, onConfirm, onCancel }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.logoutAlertCard}>
          <View style={styles.logoutAlertIconContainer}>
            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              style={styles.welcomeAlertIconGradient}
            >
              <Ionicons name="log-out-outline" size={40} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.welcomeAlertTitle}>Log Out?</Text>
          <Text style={styles.welcomeAlertMessage}>
            Are you sure you want to end your session? You will be redirected to the landing page.
          </Text>

          <View style={styles.logoutButtonRow}>
            <TouchableOpacity
              style={[styles.logoutActionButton, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.logoutButtonText, { color: '#94a3b8' }]}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutActionButton}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.logoutButtonGradient}
              >
                <Text style={styles.logoutButtonText}>LOG OUT</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Premium Edit Profile Modal Component
const EditProfileModal = ({ visible, userData, onSave, onCancel, onPickImage, selectedImage, avatarTimestamp }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [fullName, setFullName] = useState(userData?.full_name || "");
  const [phone, setPhone] = useState(userData?.phone || "");
  const [email, setEmail] = useState(userData?.email || "");

  useEffect(() => {
    if (visible) {
      setFullName(userData?.full_name || "");
      setPhone(userData?.phone || "");
      setEmail(userData?.email || "");
    }
  }, [visible, userData]);

  return (
    <Modal transparent visible={visible} animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={styles.modalOverlayBackground} />
        </TouchableWithoutFeedback>
        <View style={styles.editProfileCard}>
          <View style={styles.editProfileHeader}>
            <Text style={styles.editProfileTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.editProfileAvatarSection}>
            <TouchableOpacity style={styles.editProfileAvatar} onPress={onPickImage}>
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={{ width: '100%', height: '100%', borderRadius: 45 }}
                />
              ) : userData?.avatar_url ? (
                <Image
                  source={{ uri: `${API_BASE}${userData.avatar_url}?t=${avatarTimestamp}` }}
                  style={{ width: '100%', height: '100%', borderRadius: 45 }}
                />
              ) : (
                <View style={[styles.editProfileAvatarPlaceholder, { backgroundColor: theme.primary }]}>
                  <Text style={styles.editProfileAvatarInitial}>
                    {(userData?.full_name || "U")[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.editProfileCameraIcon}>
                <Ionicons name="camera" size={14} color="white" />
              </View>
            </TouchableOpacity>
            <Text style={styles.editProfileAvatarLabel}>
              {selectedImage ? "Image selected - tap to change" : "Tap to change photo"}
            </Text>
          </View>

          <View style={styles.editProfileForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={theme.textSecondary} />
                <TextInput
                  style={styles.textInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PHONE NUMBER</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={18} color={theme.textSecondary} />
                <TextInput
                  style={styles.textInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter phone number"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS (READ ONLY)</Text>
              <View style={[styles.inputContainer, { opacity: 0.6, backgroundColor: 'transparent' }]}>
                <Ionicons name="mail-outline" size={18} color={theme.textSecondary} />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  editable={false}
                  placeholder="Email"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.profileSaveButton}
            onPress={() => onSave({ full_name: fullName, phone: phone })}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#74C5E6', '#3490dc']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.profileSaveButtonGradient}
            >
              <Text style={styles.profileSaveButtonText}>SAVE CHANGES</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const LoginScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [userData, setUserData] = useState(null);

  const onLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password: password }),
      });
      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('userToken', data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));

        if (data.user.must_change_password) {
          navigation.replace("ChangePassword");
        } else {
          setUserData(data.user);
          setShowWelcome(true);
        }
      } else {
        Alert.alert("Login Failed", data.error || "Invalid credentials.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleWelcomeDismiss = () => {
    setShowWelcome(false);
    navigation.replace("MainDrawer");
  };

  return (
    <SafeAreaView style={styles.landingContainerFixed}>
      <WelcomeAlertModal
        visible={showWelcome}
        userName={userData?.full_name || userData?.name}
        onDismiss={handleWelcomeDismiss}
      />
      <FloatingParticles />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: 'center', padding: 24 }}
      >
        {/* Header Section */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Image source={LOGO} style={[styles.landingLogo, { width: 100, height: 100, marginBottom: 20 }]} />
          <Text style={[styles.landingTitle, { fontSize: 28, marginBottom: 8, letterSpacing: 0.5 }]}>Welcome Back</Text>
          <Text style={[styles.landingCaption, { textAlign: 'center', maxWidth: '85%', lineHeight: 20 }]}>
            Sign in to access real-time flood intelligence and community updates.
          </Text>
        </View>

        {/* Glassmorphism Logic Card */}
        <View style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 28,
          padding: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 12
        }}>

          {/* Email Input */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, color: "#1e293b", fontWeight: "700", fontFamily: "Poppins_600SemiBold", marginBottom: 8, letterSpacing: 0.5 }}>
              EMAIL ADDRESS
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: "#f8fafc",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e2e8f0"
            }}>
              <Ionicons name="mail-outline" size={20} color="#94a3b8" style={{ marginLeft: 16 }} />
              <TextInput
                style={{ flex: 1, padding: 16, color: "#0f172a", fontSize: 15, fontFamily: "Poppins_400Regular" }}
                placeholder="juan@example.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={{ marginBottom: 30 }}>
            <Text style={{ fontSize: 13, color: "#1e293b", fontWeight: "700", fontFamily: "Poppins_600SemiBold", marginBottom: 8, letterSpacing: 0.5 }}>
              PASSWORD
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: "#f8fafc",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e2e8f0"
            }}>
              <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={{ marginLeft: 16 }} />
              <TextInput
                style={{ flex: 1, padding: 16, color: "#0f172a", fontSize: 15, fontFamily: "Poppins_400Regular" }}
                placeholder="Enter your password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 16 }}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            onPress={onLogin}
            disabled={loading}
            style={{
              backgroundColor: "#74C5E6",
              paddingVertical: 18,
              borderRadius: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              shadowColor: "#74C5E6",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 4
            }}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={22} color="white" style={{ marginRight: 10 }} />
                <Text style={{ color: "white", fontWeight: "700", fontSize: 17, fontFamily: "Poppins_600SemiBold" }}>
                  Sign In
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ paddingVertical: 16, marginTop: 10, alignItems: 'center' }}
          >
            <Text style={{ color: "#64748b", fontWeight: "600", fontSize: 15 }}>Back to Landing</Text>
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: "Poppins_400Regular" }}>
            FloodGuard Ecosystem • Community Edition v1.2
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const ChangePasswordScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordStrong = newPassword.length >= 6;

  const onChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      const user = JSON.parse(storedUser);

      const response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          current_password: currentPassword,
          new_password: newPassword
        }),
      });
      const data = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Password changed successfully! You will now be logged out for security.", [
          {
            text: "OK",
            onPress: async () => {
              await AsyncStorage.multiRemove(['userData', 'userRole']);
              navigation.reset({
                index: 0,
                routes: [{ name: "Login" }],
              });
            }
          }
        ]);
      } else {
        Alert.alert("Error", data.error || "Failed to update password.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.landingContainerFixed}>
      <FloatingParticles />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: 'center', padding: 24 }}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{ backgroundColor: 'rgba(116, 197, 230, 0.2)', padding: 16, borderRadius: 24, marginBottom: 16 }}>
            <Ionicons name="shield-checkmark" size={40} color="#74C5E6" />
          </View>
          <Text style={[styles.landingTitle, { fontSize: 24, marginBottom: 8 }]}>Secure Your Account</Text>
          <Text style={[styles.landingCaption, { textAlign: 'center', maxWidth: '80%' }]}>
            Create a strong password to protect your personal information.
          </Text>
        </View>

        {/* Glassmorphism Card */}
        <View style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 24,
          padding: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.1,
          shadowRadius: 20,
          elevation: 10
        }}>

          {/* Current Password Input */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, color: "#1e293b", fontWeight: "700", fontFamily: "Poppins_600SemiBold", marginBottom: 8 }}>
              CURRENT PASSWORD
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: "#f1f5f9",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#e2e8f0"
            }}>
              <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={{ marginLeft: 14 }} />
              <TextInput
                style={{ flex: 1, padding: 14, color: "#0f172a", fontSize: 16, fontFamily: "Poppins_400Regular" }}
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={{ padding: 14 }}>
                <Ionicons name={showCurrentPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password Input */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: "#1e293b", fontWeight: "700", fontFamily: "Poppins_600SemiBold" }}>
                NEW PASSWORD
              </Text>
              {isPasswordStrong && <Ionicons name="checkmark-circle" size={16} color="#16a34a" />}
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: "#f8fafc",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: newPassword.length > 0 ? (isPasswordStrong ? "#16a34a" : "#cbd5e1") : "#e2e8f0"
            }}>
              <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={{ marginLeft: 14 }} />
              <TextInput
                style={{ flex: 1, padding: 14, color: "#0f172a", fontSize: 16, fontFamily: "Poppins_400Regular" }}
                placeholder="Enter at least 6 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 14 }}>
                <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: "#1e293b", fontWeight: "700", fontFamily: "Poppins_600SemiBold" }}>
                CONFIRM PASSWORD
              </Text>
              {passwordsMatch && <Ionicons name="checkmark-done-circle" size={16} color="#16a34a" />}
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: "#f8fafc",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: confirmPassword.length > 0 ? (passwordsMatch ? "#16a34a" : "#ef4444") : "#e2e8f0"
            }}>
              <Ionicons name="key-outline" size={20} color="#94a3b8" style={{ marginLeft: 14 }} />
              <TextInput
                style={{ flex: 1, padding: 14, color: "#0f172a", fontSize: 16, fontFamily: "Poppins_400Regular" }}
                placeholder="Repeat your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 14 }}>
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={{ fontSize: 12, color: "#ef4444", marginTop: 6, marginLeft: 2 }}>Passwords do not match</Text>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={onChangePassword}
            disabled={loading || !passwordsMatch || !isPasswordStrong}
            style={{
              backgroundColor: (passwordsMatch && isPasswordStrong) ? "#74C5E6" : "#cbd5e1",
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              shadowColor: "#74C5E6",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: (passwordsMatch && isPasswordStrong) ? 0.3 : 0,
              shadowRadius: 8,
            }}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16, fontFamily: "Poppins_600SemiBold" }}>
                  Update Password
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Back Link */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ paddingVertical: 16, marginTop: 8, alignItems: 'center' }}
          >
            <Text style={{ color: "#64748b", fontWeight: "600", fontSize: 14 }}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Animated Particles for Landing Background
const FloatingParticles = () => {
  const { width, height } = useWindowDimensions();
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const colors = ['#90CDF4', '#63B3ED', '#4299E1', '#E2E8F0', '#CBD5E1'];
    const newParticles = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      delay: Math.random() * 5000,
      startX: Math.random() * width,
      startY: Math.random() * height + height / 2,
      size: Math.random() * 8 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: Math.random() * 8000 + 12000,
    }));
    setParticles(newParticles);
  }, [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <Particle
          key={p.id}
          p={p}
          height={height}
        />
      ))}
    </View>
  );
};

const Particle = ({ p, height }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Stagger start
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -height * 1.5,
            duration: p.duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: Math.random() * 0.5 + 0.2, duration: p.duration * 0.2, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: Math.random() * 0.5 + 0.2, duration: p.duration * 0.6, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: p.duration * 0.2, useNativeDriver: true })
          ])
        ])
      ).start();
    }, p.delay);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: p.startX,
        top: p.startY,
        width: p.size,
        height: p.size,
        borderRadius: p.size / 2,
        backgroundColor: p.color,
        opacity: opacity,
        transform: [{ translateY }],
        shadowColor: p.color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: p.size,
        elevation: 2,
      }}
    />
  );
};

const LandingScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <SafeAreaView style={styles.landingContainerFixed}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <FloatingParticles />
        <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 10, justifyContent: 'space-between' }}>

          {/* Center Content */}
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, flex: 1 }}>
            <Image source={LOGO} style={styles.landingLogo} />

            <View style={{ alignItems: 'center', width: '100%', marginBottom: 10, flexShrink: 1 }}>
              <Text style={styles.heroText} adjustsFontSizeToFit numberOfLines={1}>Monitor.</Text>
              <Text style={styles.heroText} adjustsFontSizeToFit numberOfLines={1}>Alert.</Text>
              <Text style={[styles.heroText, { color: '#74C5E6' }]} adjustsFontSizeToFit numberOfLines={1}>StaySafe.</Text>
            </View>

            <Text style={styles.heroSubText}>
              State-of-the-art IoT monitoring system{"\n"}for real-time flood intelligence.
            </Text>
          </View>

          {/* Bottom Buttons */}
          <View style={{ width: '100%', paddingBottom: 80, marginTop: 20 }}>
            <TouchableOpacity
              style={styles.btnExplore}
              onPress={() => navigation.navigate("Welcome")}
            >
              <Text style={styles.btnExploreText}>Explore Features</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnAdmin}
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={styles.btnAdminText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const FeatureRow = ({ icon, title, text, tint }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <Card style={styles.featureCard}>
      <View style={[styles.iconBadge, { backgroundColor: tint }]}>
        {icon}
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{text}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color="#3aa655" />
    </Card>
  );
};

const InfoNote = ({ text }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <Card style={styles.infoNote}>
      <Text style={styles.infoNoteText}>{text}</Text>
    </Card>
  );
};

const WelcomeScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <ScreenLayout step={1}>
      <ImageBackground
        source={LANDING_IMAGE}
        style={styles.landingHero}
        imageStyle={styles.landingImage}
      >
        <View style={styles.landingOverlay} />
        <View style={styles.landingContent}>
          <View style={styles.heroIcon}>
            <Ionicons name="notifications" size={28} color="#ffffff" />
          </View>
          <Text style={styles.landingTitle}>Welcome to Flood Monitor</Text>
          <Text style={styles.landingSubtitle}>
            Real-time monitoring system for flood alerts, evacuation routes, and
            community reporting.
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.sectionSpacing}>
        <FeatureRow
          icon={<Ionicons name="flash" size={18} color="#74C5E6" />}
          title="Real-Time Alerts"
          text="Get instant notifications about flood risks in your area"
          tint="#34495E"
        />
        <FeatureRow
          icon={<Feather name="map" size={18} color="#7a2cf3" />}
          title="Evacuation Routes"
          text="Access safe routes and evacuation centers nearby"
          tint="#34495E"
        />
        <FeatureRow
          icon={<Ionicons name="people" size={18} color="#20b26b" />}
          title="Community Reports"
          text="Help monitor conditions by reporting what you observe"
          tint="#34495E"
        />
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="Continue" onPress={() => navigation.navigate("Account")} />
      </View>
    </ScreenLayout>
  );
};

const AccountScreen = ({ navigation, form, setForm }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [error, setError] = useState("");

  const onContinue = () => {
    // Basic presence check
    if (!form.fullName) {
      setError("Please enter your full name.");
      return;
    }
    if (!form.email) {
      setError("Please enter your email address.");
      return;
    }

    // Strict Email Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Please enter a valid email address (e.g. user@domain.com).");
      return;
    }

    // Phone Validation (must be 10 digits)
    if (!form.phone || form.phone.length !== 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    setError("");
    navigation.navigate("Location");
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(form.email || "");
  const isPhoneValid = form.phone?.length === 10;
  const isNameValid = form.fullName?.trim().length > 0;

  const isDisabled = !isNameValid || !isEmailValid || !isPhoneValid;

  return (
    <ScreenLayout step={2}>
      <ImageBackground
        source={ACCOUNT_IMAGE}
        style={styles.landingHero}
        imageStyle={styles.landingImage}
      >
        <View style={styles.landingOverlay} />
        <View style={styles.landingContent}>
          <View style={styles.heroIcon}>
            <Ionicons name="person" size={26} color="#ffffff" />
          </View>
          <Text style={styles.landingTitle}>Create Your Account</Text>
          <Text style={styles.landingSubtitle}>
            We need some basic information to get started
          </Text>
        </View>
      </ImageBackground>

      <Card style={styles.formCard}>
        <Text style={styles.inputLabel}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Juan Dela Cruz"
          placeholderTextColor="#49769F"
          value={form.fullName}
          onChangeText={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
        />

        <Text style={styles.inputLabel}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="juan@example.com"
          placeholderTextColor="#49769F"
          value={form.email}
          onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.inputLabel}>Phone Number</Text>
        <View style={styles.phoneInputRow}>
          <View style={styles.phonePrefix}>
            <Text style={styles.phonePrefixText}>+63</Text>
          </View>
          <TextInput
            style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
            placeholder="912 345 6789"
            placeholderTextColor="#49769F"
            value={form.phone}
            onChangeText={(value) => {
              const cleaned = value.replace(/[^0-9]/g, '');
              if (cleaned.length <= 10) {
                setForm((prev) => ({ ...prev, phone: cleaned }));
              }
            }}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>
      </Card>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.footerRow}>
        <SecondaryButton label="Back" onPress={() => safeGoBack(navigation, "Landing")} />
        <PrimaryButton label="Continue" onPress={onContinue} disabled={isDisabled} />
      </View>
    </ScreenLayout>
  );
};

const LocationScreen = ({
  navigation,
  selection,
  setSelection,
  area,
  setArea,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [error, setError] = useState("");
  const barangays = useMemo(() => [
    "Sitio Magtalisay",
    "Sitio Regla",
    "Sitio Sinulog",
    "Sitio Laray Holy Name",
    "Sitio San Vicente",
    "Sitio San Isidro",
    "Sitio Fatima",
    "Sitio Sindulan",
    "Sitio Lahing-Lahing (Uno and Dos)",
  ], []);

  const onContinue = () => {
    if (!selection) {
      setError("Please select your location.");
      return;
    }
    setError("");
    navigation.navigate("Notifications");
  };
  const isDisabled = !selection;

  return (
    <ScreenLayout step={3}>
      <ImageBackground
        source={LOCATION_IMAGE}
        style={styles.landingHero}
        imageStyle={styles.landingImage}
      >
        <View style={styles.landingOverlay} />
        <View style={styles.landingContent}>
          <View style={styles.heroIcon}>
            <Ionicons name="location" size={26} color="#ffffff" />
          </View>
          <Text style={styles.landingTitle}>Select Your Location</Text>
          <Text style={styles.landingSubtitle}>
            Choose your area to receive relevant alerts
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.sectionSpacing}>
        {barangays.map((item) => {
          const selected = selection === item;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.optionRow, selected && styles.optionSelected]}
              onPress={() => setSelection(item)}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={selected ? "#283747" : "#6b7a90"}
                />
              </View>
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {item}
              </Text>
              <Ionicons
                name={selected ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={selected ? "#74C5E6" : "#c7d0de"}
              />
            </TouchableOpacity>
          );
        })}
      </View>


      <InfoNote text="Note: You can change your monitored locations anytime in Settings." />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.footerRow}>
        <SecondaryButton label="Back" onPress={() => safeGoBack(navigation, "Landing")} />
        <PrimaryButton label="Continue" onPress={onContinue} disabled={isDisabled} />
      </View>
    </ScreenLayout>
  );
};

const NotificationsScreen = ({ navigation, toggles, setToggles, form, selection }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const onToggle = (key) => (value) =>
    setToggles((prev) => ({ ...prev, [key]: value }));

  const onFinish = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: form.fullName, // Passed from App.js state
          email: form.email,
          phone: form.phone,
          barangay: selection, // Passed from App.js state
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          "Account Created Successfully!",
          data.message || "We have sent your login credentials to your email.",
          [
            {
              text: "OK, Login Now",
              onPress: () => navigation.replace("Login"),
            },
          ]
        );
      } else {
        if (data.error === "Email already registered") {
          Alert.alert("Account Exists", "This email is already registered. Please log in.");
          navigation.navigate("Landing");
        } else {
          Alert.alert("Registration Failed", data.error || "Something went wrong.");
        }
      }
    } catch (error) {
      Alert.alert("Error", "Could not connect to the server. Please try again.");
      console.error(error);
    }
  };

  return (
    <ScreenLayout step={4}>
      <ImageBackground
        source={NOTIFY_IMAGE}
        style={styles.landingHero}
        imageStyle={styles.landingImage}
      >
        <View style={styles.landingOverlay} />
        <View style={styles.landingContent}>
          <View style={styles.heroIcon}>
            <Ionicons name="notifications" size={26} color="#ffffff" />
          </View>
          <Text style={styles.landingTitle}>Enable Notifications</Text>
          <Text style={styles.landingSubtitle}>
            Stay informed with real-time flood alerts
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.sectionSpacing}>
        <Card style={[styles.toggleCard, styles.toggleCritical]}>
          <View style={styles.toggleHeader}>
            <View style={[styles.iconBadge, { backgroundColor: "#ffe3e3" }]}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={18}
                color="#d63b2c"
              />
            </View>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Critical Alerts</Text>
              <Text style={styles.toggleSubtitle}>
                Immediate evacuation warnings and high-risk situations
              </Text>
              <Text style={styles.toggleNote}>Always Enabled</Text>
            </View>
            <Switch value={true} disabled />
          </View>
        </Card>

        <Card style={styles.toggleCard}>
          <View style={styles.toggleHeader}>
            <View style={[styles.iconBadge, { backgroundColor: "#34495E" }]}>
              <Ionicons name="cloud" size={18} color="#74C5E6" />
            </View>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Weather Updates</Text>
              <Text style={styles.toggleSubtitle}>
                Rainfall forecasts and water level changes
              </Text>
              <Text style={styles.toggleNote}>Recommended</Text>
            </View>
            <Switch value={toggles.weather} onValueChange={onToggle("weather")} />
          </View>
        </Card>

        <Card style={styles.toggleCard}>
          <View style={styles.toggleHeader}>
            <View style={[styles.iconBadge, { backgroundColor: "#34495E" }]}>
              <Ionicons name="people" size={18} color="#74C5E6" />
            </View>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Community Reports</Text>
              <Text style={styles.toggleSubtitle}>
                Updates from residents in your area
              </Text>
              <Text style={styles.toggleNote}>Optional</Text>
            </View>
            <Switch
              value={toggles.community}
              onValueChange={onToggle("community")}
            />
          </View>
        </Card>
      </View>

      <InfoNote text="Offline Mode: Critical alerts and evacuation maps are cached for offline access." />

      <View style={styles.footerRow}>
        <SecondaryButton label="Back" onPress={() => safeGoBack(navigation, "Landing")} />
        <PrimaryButton label="Get Started" onPress={onFinish} />
      </View>
    </ScreenLayout>
  );
};

const CustomHeader = ({ navigation, title, subtitle }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [isNotifVisible, setIsNotifVisible] = useState(false);
  const { notifications, unreadCount, loading, readIds, markAsRead, markAllAsRead, clearDropdown, hiddenIds } = useNotifications();
  const visibleNotifications = notifications.filter(n => !hiddenIds.includes(n.id)).slice(0, 5);

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  const toggleNotif = () => setIsNotifVisible(!isNotifVisible);

  return (
    <View style={[styles.dashHeaderRow, { paddingTop: Platform.OS === "android" ? topInset + 16 : 44 }]}>
      <TouchableOpacity
        style={styles.burgerButton}
        onPress={() => {
          if (navigation && navigation.openDrawer) {
            navigation.openDrawer();
          } else {
            console.warn("Drawer navigation not available");
          }
        }}
      >
        <Ionicons name="menu" size={26} color={theme.textPrimary} />
      </TouchableOpacity>
      <View style={styles.dashHeaderTexts}>
        <Text style={styles.dashHeaderTitle}>{title}</Text>
        <SystemTime style={[styles.dashHeaderSubtitle, { color: '#74C5E6', fontSize: 10, marginTop: 2 }]} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={toggleNotif}
          style={{ marginRight: 24 }}
        >
          <Ionicons name="notifications-outline" size={24} color={theme.textPrimary} />
          {unreadCount > 0 && (
            <View style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#e2463b', borderWidth: 1.5, borderColor: theme.surface }} />
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={isNotifVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsNotifVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsNotifVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View style={{
              position: 'absolute',
              top: Platform.OS === 'android' ? topInset + 60 : 100,
              right: 16,
              width: 300,
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 5,
              borderWidth: 1,
              borderColor: theme.border
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.textPrimary }}>Recent Activity</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllAsRead}>
                      <Text style={{ color: '#74C5E6', fontSize: 11, fontWeight: '700' }}>Mark all</Text>
                    </TouchableOpacity>
                  )}
                  {visibleNotifications.length > 0 && (
                    <TouchableOpacity onPress={clearDropdown}>
                      <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {loading ? (
                <ActivityIndicator size="small" color="#74C5E6" />
              ) : visibleNotifications.length === 0 ? (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginVertical: 20, fontSize: 13 }}>No new notifications</Text>
              ) : (
                visibleNotifications.map(item => {
                  const isRead = readIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.border,
                        opacity: isRead ? 0.7 : 1
                      }}
                      onPress={() => {
                        setIsNotifVisible(false);
                        markAsRead(item.id);
                        if (item.sourceType === 'announcement') {
                          navigation.navigate("AlertDetail", { alert: item });
                        } else {
                          navigation.navigate("AlertDetail", { alert: item });
                        }
                      }}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: item.accent + '20', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                        <Ionicons name={item.icon} size={15} color={item.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: isRead ? '400' : '700' }} numberOfLines={1}>{item.title}</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={1}>{item.message}</Text>
                      </View>
                      {!isRead && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#e2463b', marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}

              <TouchableOpacity
                style={{ marginTop: 12, alignItems: 'center' }}
                onPress={() => {
                  setIsNotifVisible(false);
                  navigation.navigate("Alerts");
                }}
              >
                <Text style={{ color: '#74C5E6', fontWeight: '700', fontSize: 13 }}>View All Alerts</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};



// Premium Welcome Banner Component
const WelcomeBanner = () => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('userData');
        if (stored) setUserData(JSON.parse(stored));
      } catch (e) {
        console.log("Error fetching user data", e);
      }
    };
    fetchUser();
  }, []);

  const firstName = (userData?.full_name || userData?.name)?.split(' ')[0] || "User";
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good Morning" : currentHour < 18 ? "Good Afternoon" : "Good Evening";

  const { isOnline } = useSensorStatus();

  return (
    <LinearGradient
      colors={['#1e293b', '#0f172a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.welcomeBanner}
    >
      <View style={styles.welcomeContent}>
        <View>
          <Text style={styles.welcomeGreeting}>{greeting},</Text>
          <Text style={styles.welcomeName}>{firstName}!</Text>
          <View style={styles.welcomeStatusRow}>
            <View style={[styles.welcomePulse, { backgroundColor: isOnline ? '#2fb864' : '#64748b' }]} />
            <Text style={[styles.welcomeStatusText, { color: isOnline ? '#2fb864' : '#94a3b8' }]}>
              {isOnline ? "System secure and operational" : "System offline"}
            </Text>
          </View>
        </View>
        <View style={styles.welcomeAvatarContainer}>
          <LinearGradient
            colors={['#74C5E6', '#3490dc']}
            style={styles.welcomeAvatarGradient}
          >
            <Text style={styles.welcomeAvatarText}>{firstName[0]}</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Decorative Orbs */}
      <View style={[styles.welcomeOrb, { top: -20, right: -20, opacity: 0.1 }]} />
      <View style={[styles.welcomeOrb, { bottom: -30, left: 10, width: 80, height: 80, opacity: 0.05 }]} />
    </LinearGradient>
  );
};

const DashboardScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [latestSensor, setLatestSensor] = useState(null);
  const [thresholds, setThresholds] = useState({ advisory_cm: 10, warning_cm: 15, critical_cm: 25 });
  const [loadingSensor, setLoadingSensor] = useState(true);
  const [userData, setUserData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const esRef = useRef(null);
  const fallbackRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('userData');
        if (stored) setUserData(JSON.parse(stored));
      } catch (e) {
        console.log("Error fetching user data in Dashboard", e);
      }
    };
    fetchUser();
  }, []);

  // Real-time sensor stream via WebSocket
  const socket = useSocket();

  useEffect(() => {
    const parseSensor = (data) => {
      if (data && data.sensor_id) {
        setLatestSensor({
          ...data,
          flood_level: Number(data.flood_level ?? 0),
          raw_distance: Number(data.raw_distance ?? 0),
          status: data.is_offline ? "OFFLINE" : (data.status || "UNKNOWN"),
        });
        if (data.thresholds) {
          setThresholds(data.thresholds);
        }
        setLastUpdated(new Date());
      } else {
        setLatestSensor(null);
      }
      setLoadingSensor(false);
    };

    const fetchInitial = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/iot/latest`);
        if (res.ok) parseSensor(await res.json());
        else setLoadingSensor(false);
      } catch (e) { setLoadingSensor(false); }
    };

    fetchInitial();

    if (socket) {
      socket.on("sensor_update", (data) => {
        console.log("[Mobile] Live sensor update:", data);
        parseSensor(data);
      });
      socket.on("threshold_update", (data) => {
        console.log("[Mobile] Threshold update:", data);
        fetchInitial(); // Refresh to get new thresholds
      });
    }

    return () => {
      if (socket) {
        socket.off("sensor_update");
        socket.off("threshold_update");
      }
    };
  }, [socket]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        setShowLogoutModal(true);
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [])
  );

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      disconnectMobileSocket();
    } catch (e) { console.warn("Socket disconnect failed:", e); }
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    navigation.replace("Landing");
  };

  const { setIsOnline } = useSensorStatus();
  const isOffline = !latestSensor || latestSensor.status === "OFFLINE" || latestSensor.is_offline;

  useEffect(() => {
    setIsOnline(!isOffline);
  }, [isOffline]);

  const getLiveStatus = () => {
    if (isOffline) return "OFFLINE";
    const lvl = Number(latestSensor?.flood_level ?? 0);
    if (lvl >= (thresholds?.critical_cm || 25)) return "CRITICAL";
    if (lvl >= (thresholds?.warning_cm || 15)) return "WARNING";
    if (lvl >= (thresholds?.advisory_cm || 10)) return "ADVISORY";
    return "NORMAL";
  };

  const liveStatus = getLiveStatus();
  const statusColor = getStatusColor(liveStatus);
  const floodLevel = Number(latestSensor?.flood_level ?? 0);
  const rawDistance = Number(latestSensor?.raw_distance ?? 0);
  const maxRange = thresholds?.critical_cm || 25;
  const fillPct = Math.max(0, Math.min(100, (floodLevel / maxRange) * 100));
  const formatUpdated = () => {
    if (!lastUpdated) return "Waiting for data...";
    const diff = Math.floor((Date.now() - lastUpdated) / 1000);
    if (diff < 10) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <SafeAreaView style={styles.dashboardSafe}>
      <LogoutConfirmationModal
        visible={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
      <CustomHeader navigation={navigation} title="Home" subtitle="Dashboard & status" />
      <ScrollView
        contentContainerStyle={[styles.dashboardScrollContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <WelcomeBanner />

        <View style={styles.locationCard}>
          <View style={styles.locationHeaderRow}>
            <Text style={styles.locationLabel}>CURRENT LOCATION</Text>
            <View style={[styles.safeBadge, isOffline && { backgroundColor: 'rgba(148,163,184,0.15)' }]}>
              <View style={[styles.safeBadgeDot, isOffline && { backgroundColor: '#94a3b8' }]} />
              <Text style={[styles.safeBadgeText, isOffline && { color: '#94a3b8' }]}>
                {isOffline ? "OFFLINE" : (liveStatus === "NORMAL" ? "SAFE" : liveStatus)}
              </Text>
            </View>
          </View>

          <View style={styles.locationTitleRow}>
            <Ionicons name="location-outline" size={20} color="#74C5E6" />
            <Text style={styles.locationTitle}>{userData?.barangay || "Mabolo District"}</Text>
          </View>
          <Text style={styles.locationTimeText}>
            {isOffline ? "Sensor offline" : `Updated ${formatUpdated()}`}
          </Text>

          <View style={styles.riskLevelRow}>
            <Text style={styles.riskLevelLabel}>Risk Level</Text>
            <View style={styles.riskLevelBarTrack}>
              <View style={[styles.riskLevelBarFill, { width: `${fillPct}%`, backgroundColor: statusColor }]} />
            </View>
            <Text style={[styles.riskLevelValue, { color: statusColor }]}>
              {isOffline ? "—" : liveStatus}
            </Text>
          </View>
        </View>

        <View style={styles.sensorMainCard}>
          <View style={[styles.sensorCardHeader, { alignItems: 'center' }]}>
            <View>
              <Text style={styles.sensorCardTitle}>Flood Monitoring System</Text>
              <Text style={styles.sensorCardSubtitle}>Station: {latestSensor?.sensor_id || "Main Street Bridge"}</Text>
            </View>
            {/* Live / Offline pill */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: isOffline ? 'rgba(148,163,184,0.12)' : 'rgba(34,197,94,0.12)',
              paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20,
            }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isOffline ? '#94a3b8' : '#22c55e' }} />
              <Text style={{ fontSize: 11, color: isOffline ? '#94a3b8' : '#22c55e', fontWeight: '700' }}>
                {isOffline ? "OFFLINE" : "LIVE"}
              </Text>
            </View>
          </View>

          <View style={styles.gaugeContainerOuter}>
            <View style={styles.gaugeGlassContainer}>
              <View style={styles.gaugeCapsule}>
                <WaterWave
                  color={statusColor}
                  fillPercentage={fillPct}
                />

                {/* Level Markers — Dynamic based on thresholds */}
                {[
                  Math.round(maxRange),
                  Math.round(maxRange * 0.75),
                  Math.round(maxRange * 0.5),
                  Math.round(maxRange * 0.25)
                ].map((level, i) => (
                  <React.Fragment key={`${level}-${i}`}>
                    <View style={[styles.gaugeLevelMark, { top: `${20 * (i + 1)}%` }]}>
                      <Text style={styles.gaugeMarkText}>{level}cm</Text>
                    </View>
                    <View style={[styles.gaugeLevelDivider, { top: `${20 * (i + 1)}%` }]} />
                  </React.Fragment>
                ))}
              </View>

              {/* Glass Reflection Overlays */}
              <View style={styles.gaugeGlassReflection} />
              <View style={styles.gaugeGlassShine} />
            </View>

            <View style={styles.readingContainer}>
              {/* Flood Level */}
              <View style={styles.gaugeReading}>
                <Text style={styles.gaugeReadingValue}>
                  {loadingSensor ? "--" : floodLevel.toFixed(1)}
                </Text>
                <Text style={styles.gaugeReadingUnit}>cm</Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 10, textAlign: 'center', marginBottom: 6, letterSpacing: 0.5 }}>
                FLOOD LEVEL
              </Text>
              <View style={styles.statusChip}>
                <View style={[styles.statusChipDot, { backgroundColor: statusColor }]} />
                <Text style={styles.statusChipText}>
                  {loadingSensor ? "LOADING" : (isOffline ? "OFFLINE" : liveStatus)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sensorCardFooter}>
            <View style={styles.footerInfoItem}>
              <Feather name="info" size={14} color="#64748b" />
              <Text style={styles.thresholdText}>Current Max Level: <Text style={styles.thresholdTextBold}>{Math.round(maxRange)} cm</Text></Text>
            </View>
            <Text style={styles.sensorIdText}>STATION ID: {latestSensor?.sensor_id || "—"}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const MapScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [mapType, setMapType] = useState("standard");
  const [sensorPointsState, setSensorPointsState] = useState(SENSOR_POINTS);
  const [sensorData, setSensorData] = useState([]);
  const [loadingSensors, setLoadingSensors] = useState(true);

  const activeSensorPoint = sensorPointsState.find((s) => s.id === IOT_SENSOR_ID) || sensorPointsState[0] || { id: IOT_SENSOR_ID, latitude: 10.3189, longitude: 123.9162, risk: "low" };

  const fetchSensorData = async () => {
    try {
      setLoadingSensors(true);
      const res = await fetch(`${API_BASE}/api/iot/latest`);
      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }
      const data = await res.json();
      const sensorRecord = data?.sensor_id ? [{
        ...data,
        flood_level: Number(data.flood_level ?? 0),
        raw_distance: Number(data.raw_distance ?? 0),
        status: data.is_offline ? "OFFLINE" : (data.status || "UNKNOWN"),
      }] : [];
      setSensorData(sensorRecord);
    } catch (err) {
      console.warn("Failed load sensor data", err);
      setSensorData([]);
    } finally {
      setLoadingSensors(false);
    }
  };

  const socket = useSocket();

  useEffect(() => {
    fetchSensorData();

    if (socket) {
      socket.on("sensor_update", (data) => {
        console.log("[Mobile Map] Sensor update:", data);
        const sensorRecord = data?.sensor_id ? [{
          ...data,
          flood_level: Number(data.flood_level ?? 0),
          raw_distance: Number(data.raw_distance ?? 0),
          status: data.is_offline ? "OFFLINE" : (data.status || "UNKNOWN"),
        }] : [];
        setSensorData(sensorRecord);
      });
    }

    return () => {
      if (socket) socket.off("sensor_update");
    };
  }, [socket]);

  const latestMapSensor = sensorData[0] || {};
  const mergedSensors = [
    {
      ...activeSensorPoint,
      ...latestMapSensor,
      // Use GPS coordinates from sensor data if available, otherwise fall back to static coordinates
      latitude: latestMapSensor.latitude || activeSensorPoint.latitude,
      longitude: latestMapSensor.longitude || activeSensorPoint.longitude,
      flood_level: latestMapSensor?.flood_level ?? 0,
      status: latestMapSensor?.is_offline ? "OFFLINE" : (latestMapSensor?.status || "NO DATA"),
      risk:
        (latestMapSensor?.flood_level ?? 0) >= 70 ? "high" : (latestMapSensor?.flood_level ?? 0) >= 40 ? "medium" : "low",
    },
  ];
  const mapFocusSensor = mergedSensors[0];
  const bottomInset = Platform.OS === "android" ? 32 : 16;
  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const webViewRef = useRef(null);

  const toggleMapType = () =>
    setMapType((current) => (current === "standard" ? "hybrid" : "standard"));

  useEffect(() => {
    if (!webViewRef.current) return;
    webViewRef.current.injectJavaScript(`updateSensor(${JSON.stringify({
      id: mapFocusSensor.id,
      lat: mapFocusSensor.latitude,
      lng: mapFocusSensor.longitude,
      risk: mapFocusSensor.risk || 'low',
      status: mapFocusSensor.status || 'NO DATA',
      flood_level: mapFocusSensor.flood_level ?? 0,
    })}); true;`);
  }, [sensorData]);

  return (
    <SafeAreaView style={styles.dashboardSafe}>
      {Platform.OS === "android" ? (
        <View style={[styles.statusBarSpacer, { height: topInset }]} />
      ) : null}
      <LinearGradient
        colors={theme.brandGradient}
        style={[styles.mapHeaderBar, { paddingTop: 12 }]}
      >
        <TouchableOpacity onPress={() => safeGoBack(navigation, "MainDrawer")}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.mapHeaderTitle}>Barangay Mabolo</Text>
        <TouchableOpacity onPress={toggleMapType}>
          <Ionicons name="layers" size={20} color="#ffffff" />
        </TouchableOpacity>
      </LinearGradient>
      <View style={styles.mapFull}>
        <WebView
          ref={webViewRef}
          source={{ html: buildSensorMapHTML(mapFocusSensor, MABOLO_BOUNDARY) }}
          style={styles.mapFullMap}
          javaScriptEnabled
          originWhitelist={['*']}
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.type === 'openMaps' && data.url) Linking.openURL(data.url);
            } catch (_) { }
          }}
        />
      </View>
      <View style={[styles.mapLegendBar, { paddingBottom: 18 + bottomInset }]}>
        <Text style={styles.mapLegendTitle}>Sensors</Text>
        <View style={styles.mapLegendItems}>
          <View style={styles.mapLegendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#32c26a" }]} />
            <Text style={styles.legendText}>Low risk</Text>
          </View>
          <View style={styles.mapLegendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#f5c542" }]} />
            <Text style={styles.legendText}>Medium risk</Text>
          </View>
          <View style={styles.mapLegendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#f35b5b" }]} />
            <Text style={styles.legendText}>High risk</Text>
          </View>
        </View>
        <Text style={styles.sensorCount}>
          {loadingSensors ? "Loading sensors..." : `${mergedSensors.length} sensors monitoring Barangay Mabolo`}
        </Text>
      </View>
    </SafeAreaView>
  );
};
const AlertsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const bottomInset = Platform.OS === "android" ? 32 : 16;


  const fetchAlerts = async () => {
    try {
      // Get user ID to filter out dismissed alerts
      const storedUser = await AsyncStorage.getItem("userData");
      let url = `${API_BASE}/api/alerts/`;

      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user?.id) {
          url += `?user_id=${user.id}`;
        }
      }

      console.log("Fetching alerts from:", url);
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("Alerts data received:", data);

      const mapped = data.map(a => ({
        ...a,
        severity: a.level,
        location: a.barangay,
        // format timestamp if needed
      }));
      setAlerts(mapped);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      setLoading(false);
    }
  };

  const socket = useSocket();

  useEffect(() => {
    fetchAlerts();

    if (socket) {
      socket.on("new_notification", () => {
        console.log("[WS] Alert list refreshing instantly...");
        fetchAlerts();
      });
      socket.on("alert_update", () => {
        console.log("[WS] Alerts updated, refreshing list...");
        fetchAlerts();
      });
    }

    const interval = setInterval(fetchAlerts, 15000); // Polling as fallback only
    return () => {
      if (socket) {
        socket.off("new_notification");
        socket.off("alert_update");
      }
      clearInterval(interval);
    };
  }, [socket]);

  const handleDeleteAlert = (alertId, alertTitle) => {
    Alert.alert(
      "Delete Alert",
      `Are you sure you want to delete this alert?\n\n"${alertTitle}"`,
      [
        {
          text: "Cancel",
          onPress: () => { },
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: async () => {
            try {
              // Get user ID from AsyncStorage
              const storedUser = await AsyncStorage.getItem("userData");
              if (!storedUser) {
                Alert.alert("Error", "User not found. Please log in again.");
                return;
              }

              const user = JSON.parse(storedUser);
              const userId = user?.id;

              if (!userId) {
                Alert.alert("Error", "User ID not found.");
                return;
              }

              const dismissUrl = `${API_BASE}/api/alerts/user/${userId}/dismiss/${alertId}`;
              console.log("Dismissing alert at URL:", dismissUrl);

              // Call the dismiss endpoint (user-specific deletion)
              const response = await fetch(dismissUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                }
              });

              console.log("Dismiss response status:", response.status);
              const responseData = await response.json();
              console.log("Dismiss response data:", responseData);

              if (response.ok) {
                // Remove the alert from the local list
                setAlerts(alerts.filter(a => a.id !== alertId));
                Alert.alert("Success", "Alert deleted successfully");
              } else {
                Alert.alert("Error", responseData.error || "Failed to delete alert");
              }
            } catch (error) {
              console.error("Error deleting alert:", error);
              Alert.alert("Error", "Could not delete alert. Please try again.");
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const filteredAlerts = useMemo(() => {
    if (filter === "all") {
      return alerts;
    }
    if (filter === "active") {
      return alerts.filter((alert) => alert.status === "active");
    }
    if (filter === "critical") {
      return alerts.filter((alert) => alert.severity === "critical");
    }
    return alerts;
  }, [filter, alerts]);

  const activeCount = alerts.filter((alert) => alert.status === "active").length;
  const areaStatus = "Medium Risk";
  const statusColor = "#f5c542";

  const renderAlertCard = (alert) => {
    let accent = "#32c26a";
    let statusLabel = "NORMAL MONITORING";

    if (alert.level === "evacuation") {
      accent = "#1e3a8a"; // DARK BLUE
      statusLabel = `CENTER: ${alert.evacuation_status?.toUpperCase() || 'OPEN'}`;
    } else if (alert.severity === "critical") {
      accent = "#dc2626"; // RED
      statusLabel = "CRITICAL RISK";
    } else if (alert.severity === "warning") {
      accent = "#f97316"; // ORANGE
      statusLabel = "WARNING RISK";
    } else if (alert.severity === "advisory") {
      accent = "#3b82f6"; // BLUE
      statusLabel = "ADVISORY LEVEL";
    } else {
      accent = "#22c55e"; // GREEN
      statusLabel = "NORMAL";
    }

    return (
      <TouchableOpacity
        key={alert.id}
        style={[styles.alertCard, { borderLeftColor: accent }]}
        onPress={() => navigation.navigate("AlertDetail", { alert })}
        activeOpacity={0.8}
      >
        <View style={styles.alertHeader}>
          <View style={styles.alertIcon}>
            <Ionicons
              name={
                alert.level === "evacuation"
                  ? "home"
                  : accent === "#dc2626"
                    ? "warning"
                    : accent === "#f97316"
                      ? "alert"
                      : "notifications"
              }
              size={18}
              color={accent}
            />
          </View>
          <Text style={styles.alertTitle}>{alert.title}</Text>
          <View style={[styles.alertBadge, { backgroundColor: accent + "20" }]}>
            <Text style={[styles.alertBadgeText, { color: accent }]}>
              {statusLabel}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteAlert(alert.id, alert.title)}
            style={{ padding: 4 }}
          >
            <Feather name="trash-2" size={16} color="#e2463b" />
          </TouchableOpacity>
        </View>

        {/* Level Badge (Official Flood Level) */}
        {/* Level Badge (Official Flood Level) - Only for non-evacuation */}
        {alert.level && alert.level !== 'evacuation' && (
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <View style={[
              styles.levelBadge,
              {
                backgroundColor:
                  alert.level === "critical" ? "#dc2626" :
                    alert.level === "warning" ? "#f97316" : "#3b82f6"
              }
            ]}>
              <Text style={styles.levelBadgeText}>
                {alert.level === "critical" ? "HIGH" : alert.level === "warning" ? "MEDIUM" : "LOW"} LEVEL
              </Text>
            </View>
          </View>
        )}

        {/* Evacuation Specific Info */}
        {alert.level === 'evacuation' && (
          <View style={{ marginBottom: 8, backgroundColor: 'rgba(30, 58, 138, 0.1)', padding: 10, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: '#94a3b8', fontSize: 11 }}>Location:</Text>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{alert.evacuation_location || alert.location}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#94a3b8', fontSize: 11 }}>Capacity:</Text>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{alert.evacuation_capacity || 'N/A'}</Text>
            </View>
          </View>
        )}

        <Text style={styles.alertDescription}>{alert.description}</Text>
        {(alert.recommended_action || alert.actions) && alert.level !== 'evacuation' ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 6, gap: 6 }}>
            <Ionicons name="bulb-outline" size={14} color="#16a34a" style={{ marginTop: 1 }} />
            <Text style={[styles.alertMetaText, { flex: 1, color: '#16a34a', fontWeight: '600' }]} numberOfLines={2}>
              {alert.recommended_action || alert.actions}
            </Text>
          </View>
        ) : null}
        {alert.incident_status && alert.level !== 'evacuation' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
            <Text style={[styles.alertMetaText, { color: '#f59e0b', fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }]}>
              Status: {alert.incident_status}
            </Text>
          </View>
        ) : null}
        <View style={styles.alertMeta}>
          <Text style={styles.alertMetaText}>{alert.location}</Text>
          <Text style={styles.alertMetaText}>{alert.timestamp ? formatPST(alert.timestamp) : "—"}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.dashboardSafe}>
      <CustomHeader navigation={navigation} title="Alerts" subtitle="Real-time flood and weather updates" />
      <ScrollView
        contentContainerStyle={[
          styles.alertsList,
          { paddingBottom: 140 + bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filterRow}>
          {[
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "critical", label: "Critical" },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.filterPill,
                filter === item.id && styles.filterPillActive,
              ]}
              onPress={() => setFilter(item.id)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item.id && styles.filterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ marginTop: 50 }}>
            <ActivityIndicator size="large" color="#74C5E6" />
          </View>
        ) : (
          <>
            <View style={[styles.alertSummary, { backgroundColor: statusColor }]}>
              <View>
                <Text style={styles.summaryLabel}>Active Alerts</Text>
                <Text style={styles.summaryValue}>{activeCount}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View>
                <Text style={styles.summaryLabel}>Your Area Status</Text>
                <Text style={styles.summaryValue}>{areaStatus}</Text>
              </View>
            </View>
            {filteredAlerts.length === 0 ? (
              <Text style={{ textAlign: "center", marginTop: 20, color: "#64748b" }}>No alerts found</Text>
            ) : (
              filteredAlerts.map(renderAlertCard)
            )}
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
};

const AlertDetailScreen = ({ route, navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const paramAlert = route?.params?.alert;
  const [alert, setAlert] = useState(paramAlert);
  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  const { markAsRead } = useNotifications();

  useEffect(() => {
    if (!paramAlert) return;

    // Mark as read immediately when viewing
    markAsRead(paramAlert.id);

    // Derive the numeric DB id from either plain id or "alert-123" prefix
    const rawId = String(paramAlert.id).replace(/^alert-/, '');
    if (!rawId || isNaN(Number(rawId))) return;
    fetch(`${API_BASE}/api/alerts/${rawId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAlert(prev => ({ ...prev, ...data })); })
      .catch(() => { });
  }, []);

  if (!alert) {
    return null;
  }


  return (
    <SafeAreaView style={styles.dashboardSafe}>
      {Platform.OS === "android" ? (
        <View style={[styles.statusBarSpacer, { height: topInset }]} />
      ) : null}
      <LinearGradient colors={theme.brandGradient} style={styles.mapHeaderBar}>
        <TouchableOpacity onPress={() => safeGoBack(navigation, "Alerts")}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.mapHeaderTitle}>Alert Details</Text>
        <View style={{ width: 22 }} />
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.alertDetailContent}>
        <Card style={styles.alertDetailCard}>
          <Text style={styles.alertDetailTitle}>{alert.title}</Text>

          {/* Detailed Level Indicator */}
          {alert.level && alert.level !== 'evacuation' && (
            <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 8, alignItems: 'center', gap: 8 }}>
              <View style={[
                styles.levelBadge,
                {
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor:
                    alert.level === "critical" ? "#dc2626" :
                      alert.level === "warning" ? "#f97316" : "#3b82f6"
                }
              ]}>
                <Text style={[styles.levelBadgeText, { fontSize: 12 }]}>
                  {alert.level === "critical" ? "HIGH" : alert.level === "warning" ? "MEDIUM" : "LOW"} LEVEL
                </Text>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>Official Flood Level</Text>
            </View>
          )}

          {alert.level === 'evacuation' && (
            <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 8, alignItems: 'center', gap: 8 }}>
              <View style={[
                styles.levelBadge,
                {
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: "#1e3a8a"
                }
              ]}>
                <Text style={[styles.levelBadgeText, { fontSize: 12 }]}>
                  {alert.evacuation_status?.toUpperCase() || 'OPEN'}
                </Text>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>Center Status</Text>
            </View>
          )}

          <Text style={styles.alertDetailDescription}>{alert.description}</Text>
          <View style={styles.alertDetailMeta}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location-outline" size={14} color="#94a3b8" />
              <Text style={styles.alertMetaText}>{alert.location}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="time-outline" size={14} color="#94a3b8" />
              <Text style={styles.alertMetaText}>{alert.timestamp ? formatPST(alert.timestamp) : "—"}</Text>
            </View>
          </View>
        </Card>

        {/* Evacuation Details */}
        {alert.level === 'evacuation' && (
          <Card style={styles.alertDetailCard}>
            <Text style={styles.alertDetailLabel}>Center Information</Text>
            <View style={{ gap: 12, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#94a3b8' }}>Location</Text>
                <Text style={{ color: '#fff', fontWeight: '600' }}>{alert.evacuation_location || alert.location}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#94a3b8' }}>Total Capacity</Text>
                <Text style={{ color: '#fff', fontWeight: '600' }}>{alert.evacuation_capacity || 'N/A'}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Official Recommendation Section - Not for evacuation */}
        {alert.level !== 'evacuation' && (
          <Card style={[styles.alertDetailCard, { borderLeftWidth: 4, borderLeftColor: '#34d399' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="shield-checkmark" size={18} color="#34d399" />
              <Text style={[styles.alertDetailLabel, { color: '#34d399', marginBottom: 0 }]}>Official Recommendation</Text>
            </View>
            <Text style={[styles.alertDetailDescription, { fontStyle: 'italic', color: '#ffffff' }]}>
              {alert.recommended_action || alert.recommendations || alert.actions || "No specific action recommended. Stay tuned for updates from local officials."}
            </Text>
          </Card>
        )}

        {/* Current Incident Status - Not for evacuation */}
        {alert.level !== 'evacuation' && (
          <Card style={styles.alertDetailCard}>
            <Text style={styles.alertDetailLabel}>Incident Status</Text>
            <View style={[
              styles.incidentBadge,
              { paddingHorizontal: 12, paddingVertical: 6 },
              styles.incidentBadgeActive
            ]}>
              <Text style={[
                styles.incidentBadgeText,
                { fontSize: 12 }
              ]}>
                {alert.incident_status || alert.report_status || "Active"}
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Leaflet map HTML builders ────────────────────────────────────────────────

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

const buildEvacPreviewHTML = (centers, userLat, userLng) => {
  const cData = JSON.stringify(centers.map(c => ({
    lat: c.coordinate.latitude, lng: c.coordinate.longitude, status: c.status, name: c.name,
  })));
  const fZone = JSON.stringify(FLOOD_ZONE.map(p => [p.latitude, p.longitude]));
  // Route from user to nearest center (first in sorted list)
  const nearest = centers[0];
  const routePoints = nearest
    ? JSON.stringify([[userLat, userLng], [nearest.coordinate.latitude, nearest.coordinate.longitude]])
    : JSON.stringify([[userLat, userLng]]);
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET_CSS}"/>
<script src="${LEAFLET_JS}"><\/script>
<style>
*{margin:0;padding:0}
html,body,#map{width:100%;height:100%;background:#1E2A38}
.leaflet-control-attribution,.leaflet-control-zoom{display:none}
</style>
</head><body><div id="map"></div><script>
var centers=${cData}, fZone=${fZone}, route=${routePoints};
var uLat=${userLat}, uLng=${userLng};

var map=L.map('map',{
  zoomControl:false,attributionControl:false,
  dragging:false,touchZoom:false,scrollWheelZoom:false,
  doubleClickZoom:false,keyboard:false
}).setView([uLat,uLng],15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Flood zone
L.polygon(fZone,{color:'#e2463b',fillColor:'#e2463b',fillOpacity:0.18,weight:1.5}).addTo(map);

// Route line to nearest center
if(route.length>1){
  L.polyline(route,{color:'#74C5E6',weight:3,dashArray:'8,5',opacity:0.9}).addTo(map);
}

// Evacuation center pins
centers.forEach(function(x){
  var icon=L.divIcon({
    html:'<div style="width:14px;height:14px;border-radius:50%;background:'+(x.status==='open'?'#2fb864':'#f59e0b')+';border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5)"></div>',
    iconSize:[14,14],iconAnchor:[7,7],className:''
  });
  L.marker([x.lat,x.lng],{icon:icon}).addTo(map);
});

// User location — pulsing blue dot
var userIcon=L.divIcon({
  html:'<div style="position:relative;width:18px;height:18px">'
     +'<div style="position:absolute;inset:0;border-radius:50%;background:rgba(116,197,230,0.3);animation:pulse 1.8s ease-out infinite"></div>'
     +'<div style="position:absolute;inset:3px;border-radius:50%;background:#74C5E6;border:2px solid #fff;box-shadow:0 0 8px rgba(116,197,230,.8)"></div>'
     +'</div>',
  iconSize:[18,18],iconAnchor:[9,9],className:''
});
L.marker([uLat,uLng],{icon:userIcon,zIndexOffset:1000}).addTo(map);

// Fit map to show user + nearest center with padding
var allPts=[[uLat,uLng]];
centers.forEach(function(x){allPts.push([x.lat,x.lng]);});
if(allPts.length>1){
  map.fitBounds(allPts,{padding:[28,28],maxZoom:16});
} else {
  map.setView([uLat,uLng],15);
}

// Pulse animation via injected style
var style=document.createElement('style');
style.textContent='@keyframes pulse{0%{transform:scale(1);opacity:0.8}70%{transform:scale(2.4);opacity:0}100%{transform:scale(2.4);opacity:0}}';
document.head.appendChild(style);
<\/script></body></html>`;
};

const buildEvacMapHTML = (centers, userLat, userLng) => {
  const cData = JSON.stringify(centers.map((c, i) => ({
    id: c.id, name: c.name, status: c.status,
    lat: c.coordinate.latitude, lng: c.coordinate.longitude,
    distance: c.distance || '', num: i + 1,
    slots: c.slots != null ? c.slots : Math.max(0, (c.capacity || 0) - (c.slots_filled || 0)),
  })));
  const fZone = JSON.stringify(FLOOD_ZONE.map(p => [p.latitude, p.longitude]));
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET_CSS}"/>
<script src="${LEAFLET_JS}"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%;background:#1E2A38}
.leaflet-control-attribution{display:none}
.evac-tip{background:#283747!important;color:#fff!important;border:1px solid #44566A!important;border-radius:8px!important;font-size:12px!important;font-family:sans-serif!important;padding:6px 10px!important;white-space:nowrap!important;box-shadow:0 2px 8px rgba(0,0,0,.4)!important}
.evac-tip::before{display:none!important}
</style>
</head><body><div id="map"></div><script>
var centers=${cData};
var uLat=${userLat},uLng=${userLng};
var fZone=${fZone};
var map=L.map('map',{zoomControl:true}).setView([uLat,uLng],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
L.polygon(fZone,{color:'#e2463b',fillColor:'#e2463b',fillOpacity:0.2,weight:2}).addTo(map);
var routeLine=null;
var markerMap={};
function drawRoute(c){
  if(routeLine)map.removeLayer(routeLine);
  routeLine=L.polyline([[uLat,uLng],[c.lat,c.lng]],{color:'#74C5E6',weight:4,dashArray:'10,5'}).addTo(map);
  map.fitBounds([[uLat,uLng],[c.lat,c.lng]],{padding:[60,60]});
}
centers.forEach(function(c){
  var open=c.status==='open';
  var icon=L.divIcon({
    html:'<div style="width:28px;height:28px;border-radius:50%;background:'+(open?'#2fb864':'#f59e0b')+';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:11px;font-weight:bold;color:#fff">'+c.num+'</div>',
    iconSize:[28,28],iconAnchor:[14,14],className:''
  });
  var m=L.marker([c.lat,c.lng],{icon:icon}).addTo(map);
  m.bindTooltip('<b>'+c.name+'</b><br>'+(open?'<span style="color:#2fb864">OPEN</span>':'<span style="color:#f59e0b">FULL</span>')+(c.distance?' \u00b7 '+c.distance+' away':''),{
    className:'evac-tip',direction:'top',offset:[0,-16]
  });
  m.on('click',function(){
    drawRoute(c);
    try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'select',id:c.id}));}catch(e){}
  });
  markerMap[c.id]=c;
});
var uIcon=L.divIcon({html:'<div style="width:20px;height:20px;border-radius:50%;background:#74C5E6;border:3px solid #fff;box-shadow:0 0 12px rgba(116,197,230,.8)"></div>',iconSize:[20,20],iconAnchor:[10,10],className:''});
var userMarker=L.marker([uLat,uLng],{icon:uIcon,zIndexOffset:1000}).addTo(map).bindTooltip('You are here',{className:'evac-tip',direction:'top',offset:[0,-12]});
var activeCenterId=centers.length>0?centers[0].id:null;

// Initial view: Fit map to show user + ALL evacuation centers
setTimeout(function(){
  var allPoints = [[uLat, uLng]];
  centers.forEach(function(c){ allPoints.push([c.lat, c.lng]); });
  if(allPoints.length > 1) {
    map.fitBounds(allPoints, {padding: [70, 70], animate: true});
  }
  if(centers.length > 0) drawRoute(centers[0]);
}, 500);

function handleRNMessage(id){activeCenterId=id;var c=markerMap[id];if(c)drawRoute(c);}
function updateUserLocation(lat,lng){uLat=lat;uLng=lng;userMarker.setLatLng([lat,lng]);if(activeCenterId){var c=markerMap[activeCenterId];if(c)drawRoute(c);}}
function onMsg(e){try{var d=JSON.parse(e.data);if(d.type==='select')handleRNMessage(d.id);else if(d.type==='location')updateUserLocation(d.lat,d.lng);}catch(ex){}}
document.addEventListener('message',onMsg);
window.addEventListener('message',onMsg);
<\/script></body></html>`;
};

const buildSensorMapHTML = (sensor, boundary) => {
  const bnd = JSON.stringify(boundary.map(p => [p.latitude, p.longitude]));
  const sLat = sensor.latitude || MABOLO_REGION.latitude;
  const sLng = sensor.longitude || MABOLO_REGION.longitude;
  const sRisk = sensor.risk || 'low';
  const sStatus = (sensor.status || 'NO DATA').replace(/'/g, "\\'");
  const sFlood = sensor.flood_level ?? 0;
  const sId = (sensor.id || '').replace(/'/g, "\\'");
  const sMapsUrl = (sensor.maps_url || '').replace(/'/g, "\\'");
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET_CSS}"/>
<script src="${LEAFLET_JS}"><\/script>
<style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%}.leaflet-control-attribution{display:none}
.s-tip{background:#283747!important;color:#fff!important;border:1px solid #44566A!important;border-radius:8px!important;font-size:12px!important;font-family:sans-serif!important;padding:6px 10px!important;white-space:nowrap!important}
.s-tip::before{display:none!important}</style>
</head><body><div id="map"></div><script>
var bnd=${bnd};
var map=L.map('map',{zoomControl:true}).setView([${MABOLO_REGION.latitude},${MABOLO_REGION.longitude}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
L.polygon(bnd,{color:'#74C5E6',fillColor:'#74C5E6',fillOpacity:0.08,weight:2}).addTo(map);
function riskColor(r){return r==='high'?'#f35b5b':r==='medium'?'#f5c542':'#32c26a';}
var sensorMarker=L.marker([${sLat},${sLng}],{icon:L.divIcon({
  html:'<div style="width:24px;height:24px;border-radius:50%;background:'+riskColor('${sRisk}')+';border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.5)"></div>',
  iconSize:[24,24],iconAnchor:[12,12],className:''
})}).addTo(map);
sensorMarker.bindTooltip('<b>${sId}</b><br>${sStatus} \u00b7 ${sFlood}cm',{className:'s-tip',direction:'top',offset:[0,-14]});
sensorMarker.on('click',function(){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'openMaps',url:'${sMapsUrl}'}));}catch(e){}});
function updateSensor(d){
  var icon=L.divIcon({html:'<div style="width:24px;height:24px;border-radius:50%;background:'+riskColor(d.risk)+';border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.5)"></div>',iconSize:[24,24],iconAnchor:[12,12],className:''});
  if(d.lat&&d.lng)sensorMarker.setLatLng([d.lat,d.lng]);
  sensorMarker.setIcon(icon);
  sensorMarker.setTooltipContent('<b>'+d.id+'</b><br>'+d.status+' \u00b7 '+d.flood_level+'cm');
}
document.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.type==='updateSensor')updateSensor(d.sensor);}catch(ex){}});
window.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.type==='updateSensor')updateSensor(d.sensor);}catch(ex){}});
<\/script></body></html>`;
};

const buildNavMapHTML = (center, userLat, userLng) => {
  const cLat = center.coordinate.latitude;
  const cLng = center.coordinate.longitude;
  const centerName = (center.name || 'Evacuation Center').replace(/'/g, "\\'");
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET_CSS}"/>
<script src="${LEAFLET_JS}"><\/script>
<style>
*{margin:0;padding:0}html,body,#map{width:100%;height:100%;background:#1E2A38}
.leaflet-control-attribution,.leaflet-control-zoom{display:none}
.nav-tip{background:#283747!important;color:#fff!important;border:1px solid #44566A!important;border-radius:8px!important;font-size:12px!important;font-family:sans-serif!important;padding:5px 9px!important;white-space:nowrap!important}
.nav-tip::before{display:none!important}
</style>
</head><body><div id="map"></div><script>
var uLat=${userLat},uLng=${userLng},cLat=${cLat},cLng=${cLng};
var map=L.map('map',{zoomControl:false}).setView([uLat,uLng],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Destination marker
var dIcon=L.divIcon({
  html:'<div style="width:28px;height:28px;border-radius:50%;background:#e2463b;border:3px solid #fff;box-shadow:0 2px 12px rgba(226,70,59,.6);display:flex;align-items:center;justify-content:center">'
    +'<div style="width:8px;height:8px;border-radius:50%;background:#fff"></div></div>',
  iconSize:[28,28],iconAnchor:[14,14],className:''
});
L.marker([cLat,cLng],{icon:dIcon,zIndexOffset:500}).addTo(map)
  .bindTooltip('${centerName}',{className:'nav-tip',direction:'top',offset:[0,-16],permanent:false});

// User marker — pulsing blue dot
var uHtml='<div style="position:relative;width:26px;height:26px">'
  +'<div style="position:absolute;inset:0;border-radius:50%;background:rgba(116,197,230,0.3);animation:pulse 1.6s ease-out infinite"></div>'
  +'<div style="position:absolute;inset:4px;border-radius:50%;background:#74C5E6;border:2.5px solid #fff;box-shadow:0 0 12px rgba(116,197,230,.8)"></div>'
  +'</div>';
var uIcon=L.divIcon({html:uHtml,iconSize:[26,26],iconAnchor:[13,13],className:''});
var userMarker=L.marker([uLat,uLng],{icon:uIcon,zIndexOffset:1000}).addTo(map);

// Straight-line placeholder until OSRM responds
var straight=L.polyline([[uLat,uLng],[cLat,cLng]],{color:'#74C5E6',weight:4,dashArray:'10,7',opacity:0.45}).addTo(map);

// Fit map to show both markers immediately (with a small delay to ensure parent sizing)
setTimeout(function(){
  map.fitBounds([[uLat,uLng],[cLat,cLng]],{padding:[70,70],animate:true});
}, 400);

// OSRM route (replaces straight line)
var shadowLine=null,routeLine=null;
function setRoute(coords){
  if(straight){map.removeLayer(straight);straight=null;}
  if(shadowLine)map.removeLayer(shadowLine);
  if(routeLine)map.removeLayer(routeLine);
  shadowLine=L.polyline(coords,{color:'rgba(0,0,0,0.25)',weight:12,lineJoin:'round',lineCap:'round'}).addTo(map);
  routeLine=L.polyline(coords,{color:'#74C5E6',weight:7,opacity:0.95,lineJoin:'round',lineCap:'round'}).addTo(map);
  userMarker.bringToFront();
  map.fitBounds(routeLine.getBounds(),{padding:[70,70],animate:true});
}

// Live position update — re-centers map on user
function updateNavigation(lat,lng){
  uLat=lat;uLng=lng;
  userMarker.setLatLng([lat,lng]);
  map.panTo([lat,lng],{animate:true,duration:0.7,easeLinearity:0.4});
}

var s=document.createElement('style');
s.textContent='@keyframes pulse{0%{transform:scale(1);opacity:0.7}70%{transform:scale(2.8);opacity:0}100%{transform:scale(2.8);opacity:0}}';
document.head.appendChild(s);

function onMsg(e){
  try{
    var d=JSON.parse(e.data);
    if(d.type==='route')setRoute(d.coords);
    else if(d.type==='move')updateNavigation(d.lat,d.lng);
  }catch(ex){}
}
document.addEventListener('message',onMsg);
window.addEventListener('message',onMsg);
<\/script></body></html>`;
};

// ──────────────────────────────────────────────────────────────────────────────

const EvacuationScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { userLocation } = useUserLocation();

  const effLat = userLocation?.latitude ?? USER_LOCATION.latitude;
  const effLng = userLocation?.longitude ?? USER_LOCATION.longitude;

  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return `${distance.toFixed(1)} km away`;
  };

  const fetchCenters = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/evacuation-centers/`);
      const data = await response.json();
      const mapped = data.map(c => {
        const lat = parseFloat(c.lat);
        const lng = parseFloat(c.lng);
        return {
          ...c,
          id: c.id.toString(),
          coordinate: { latitude: lat, longitude: lng },
          slots: Math.max(0, parseInt(c.capacity) - parseInt(c.slots_filled)),
          distanceVal: Math.sqrt(Math.pow(lat - effLat, 2) + Math.pow(lng - effLng, 2)),
          distance: getDistance(effLat, effLng, lat, lng),
        };
      });

      // Sort by proximity
      mapped.sort((a, b) => a.distanceVal - b.distanceVal);

      setCenters(mapped);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching evacuation centers:", error);
      setLoading(false);
    }
  };

  const socket = useSocket();

  useFocusEffect(
    React.useCallback(() => {
      fetchCenters();
    }, [])
  );

  useEffect(() => {
    if (socket) {
      socket.on("evacuation_update", (data) => {
        console.log("[Mobile Evac] Update received:", data);
        fetchCenters();
      });
    }
    return () => {
      if (socket) socket.off("evacuation_update");
    };
  }, [socket]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchCenters().then(() => setRefreshing(false));
  }, []);

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const bottomInset = Platform.OS === "android" ? 32 : 16;

  const nearestCenter = centers.length > 0 ? centers[0] : null;

  return (
    <SafeAreaView style={styles.dashboardSafe}>
      <CustomHeader navigation={navigation} title="Evacuation" subtitle="Safe routes and evacuation centers" />
      <ScrollView
        contentContainerStyle={[
          styles.evacContent,
          { paddingBottom: 140 + bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#74C5E6" />
        }
      >
        {loading && centers.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
            <ActivityIndicator size="large" color="#74C5E6" />
            <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Loading evacuation centers...</Text>
          </View>
        ) : (
          <>
            <Card style={styles.routeCard}>
              <View style={styles.routeHeader}>
                <Text style={styles.routeTitle}>Nearest Safe Route</Text>
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeText}>Safe</Text>
                </View>
              </View>
              <Text style={styles.routeDistance}>0.8 km away</Text>
              <PrimaryButton
                label="Start Navigation"
                onPress={() => navigation.navigate("ActiveNavigation", { center: nearestCenter })}
                style={styles.routeButton}
              />
            </Card>

            <Card style={styles.mapCard}>
              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={styles.evacMapTitle}>Evacuation Route Map</Text>
                <View style={{ backgroundColor: "rgba(47,184,100,0.15)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#2fb864" }}>Safe Route Available</Text>
                </View>
              </View>

              {/* Map area — fixed height so WebView has room to render */}
              <View style={{ height: 210, borderRadius: 14, overflow: "hidden" }}>
                <WebView
                  source={{ html: buildEvacPreviewHTML(centers, effLat, effLng) }}
                  style={{ flex: 1 }}
                  javaScriptEnabled
                  originWhitelist={['*']}
                  scrollEnabled={false}
                />

                {/* Transparent overlay — catches all touches so WebView doesn't steal them */}
                <TouchableOpacity
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                  activeOpacity={0.88}
                  onPress={() => navigation.navigate("EvacuationMap", { centers })}
                >
                  {/* "You are here" label */}
                  <View style={{
                    position: "absolute", top: 10, left: 10,
                    backgroundColor: "rgba(40,55,71,0.88)",
                    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
                    flexDirection: "row", alignItems: "center", gap: 5,
                    borderWidth: 1, borderColor: "#74C5E6",
                  }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#74C5E6" }} />
                    <Text style={{ color: "#74C5E6", fontSize: 11, fontWeight: "600" }}>You are here</Text>
                  </View>

                  {/* Bottom expand bar */}
                  <View style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    backgroundColor: "rgba(40,55,71,0.88)",
                    flexDirection: "row", alignItems: "center", justifyContent: "center",
                    paddingVertical: 9, gap: 6,
                  }}>
                    <Feather name="maximize-2" size={13} color="#74C5E6" />
                    <Text style={{ color: "#74C5E6", fontSize: 12, fontWeight: "600" }}>Tap to view full route map</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Card>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Evacuation Centers</Text>
              <Text style={styles.sectionHint}>{centers.length} centers nearby</Text>
            </View>

            {centers.map((center) => (
              <Card key={center.id} style={styles.centerCard}>
                <View style={styles.centerHeader}>
                  <View style={styles.centerTitleWrapper}>
                    <Text style={styles.centerTitle}>{center.name}</Text>
                    <View style={styles.centerMetaRow}>
                      <View style={styles.centerMetaItem}>
                        <Feather name="navigation" size={12} color={theme.textSecondary} />
                        <Text style={styles.centerDistanceText}>{center.distance} away</Text>
                      </View>
                      <View style={styles.centerMetaItem}>
                        <Feather name="users" size={12} color={theme.textSecondary} />
                        <Text style={styles.centerCapacityText}>Cap: {center.capacity}</Text>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.centerStatus,
                      center.status === "open" ? styles.centerOpen : styles.centerFull,
                    ]}
                  >
                    <Text
                      style={[
                        styles.centerStatusText,
                        { color: center.status === "open" ? "#2fb864" : "#f59e0b" },
                      ]}
                    >
                      {center.status === "open" ? "OPEN" : "FULL"}
                    </Text>
                  </View>
                </View>

                <View style={styles.centerActionsRow}>
                  <TouchableOpacity
                    style={styles.centerActionBtnSecondary}
                    onPress={() => callCenter(center.phone)}
                  >
                    <Feather name="phone" size={16} color={theme.primary} />
                    <Text style={styles.centerActionBtnTextSecondary}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.centerActionBtnPrimary,
                      center.status !== "open" && styles.centerActionBtnDisabled
                    ]}
                    onPress={() => navigation.navigate("ActiveNavigation", { center })}
                    disabled={center.status !== "open"}
                  >
                    <LinearGradient
                      colors={center.status === "open" ? theme.brandGradient : ["#4b5563", "#4b5563"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.centerActionBtnGradient}
                    >
                      <Feather name="map-pin" size={16} color="#fff" />
                      <Text style={styles.centerActionBtnTextPrimary}>Navigate</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {center.status !== "open" && (
                  <View style={styles.centerFullNotice}>
                    <Feather name="alert-circle" size={12} color="#ef4444" />
                    <Text style={styles.centerFullNoticeText}>
                      Center is full. Please use another nearby center.
                    </Text>
                  </View>
                )}
              </Card>
            ))}

          </>
        )}
        <Card style={styles.offlineNotice}>
          <Text style={styles.offlineText}>
            Offline Mode: Evacuation routes are cached and available without
            internet connection.
          </Text>
        </Card>
      </ScrollView>

    </SafeAreaView>
  );
};

const ActiveNavigationScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { userLocation } = useUserLocation();

  const center = route?.params?.center ?? EVAC_CENTERS[0];
  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const bottomInset = Platform.OS === "android" ? 32 : 16;
  const effLat = userLocation?.latitude ?? USER_LOCATION.latitude;
  const effLng = userLocation?.longitude ?? USER_LOCATION.longitude;

  const cLat = center.coordinate.latitude;
  const cLng = center.coordinate.longitude;

  const webViewRef = useRef(null);
  const [routeSteps, setRouteSteps] = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [distToNext, setDistToNext] = useState(null);
  const [totalDist, setTotalDist] = useState(null);
  const [eta, setEta] = useState(null);
  const [arrived, setArrived] = useState(false);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeError, setRouteError] = useState(null);

  const haversine = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fmtDist = (m) => {
    if (m == null) return "—";
    return m >= 1000 ? (m / 1000).toFixed(1) + " km" : Math.round(m) + " m";
  };

  const buildInstruction = (step) => {
    const type = step.maneuver ? step.maneuver.type : "";
    const mod = step.maneuver ? (step.maneuver.modifier || "") : "";
    const road = step.name ? " onto " + step.name : "";
    if (type === "depart") return "Head " + (mod || "forward") + road;
    if (type === "arrive") return "Arrive at destination";
    if (type === "turn") return "Turn " + mod + road;
    if (type === "new name") return "Continue" + road;
    if (type === "continue") return "Continue " + (mod || "straight") + road;
    if (type === "fork") return "Take the " + mod + " fork" + road;
    if (type === "merge") return "Merge " + mod + road;
    if (type === "on ramp") return "Take the on-ramp" + road;
    if (type === "off ramp") return "Take the off-ramp" + road;
    if (type === "end of road") return "Turn " + mod + " at end of road" + road;
    if (type === "roundabout") return "Enter the roundabout";
    if (type === "rotary") return "Enter the rotary";
    if (type === "roundabout turn") return "At the roundabout, turn " + mod;
    return "Continue" + road;
  };

  const stepIcon = (type, mod) => {
    if (type === "arrive") return "checkmark-circle";
    if (type === "depart") return "navigate-outline";
    if (!mod) return "arrow-forward";
    if (mod === "uturn") return "return-down-back";
    if (mod.includes("sharp left")) return "arrow-back";
    if (mod.includes("sharp right")) return "arrow-forward";
    if (mod.includes("slight left")) return "return-up-back";
    if (mod.includes("slight right")) return "return-up-forward";
    if (mod.includes("left")) return "arrow-back";
    if (mod.includes("right")) return "arrow-forward";
    return "arrow-forward";
  };

  const fetchRoute = async (startLat, startLng) => {
    try {
      setRouteLoading(true);
      setRouteError(null);
      const url = "https://router.project-osrm.org/route/v1/driving/"
        + startLng + "," + startLat + ";" + cLng + "," + cLat
        + "?steps=true&geometries=geojson&overview=full";
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes || !data.routes.length) throw new Error("No route");
      const osrmRoute = data.routes[0];
      const coords = osrmRoute.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
      const steps = osrmRoute.legs[0].steps.map(function (s, i) {
        return {
          id: i,
          instruction: buildInstruction(s),
          distance: s.distance,
          type: s.maneuver ? s.maneuver.type : "",
          modifier: s.maneuver ? (s.maneuver.modifier || "") : "",
          location: s.maneuver ? s.maneuver.location : null,
        };
      });
      setRouteSteps(steps);
      setTotalDist(Math.round(osrmRoute.distance));
      setEta(Math.ceil(osrmRoute.duration / 60));
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript("setRoute(" + JSON.stringify(coords) + "); true;");
      }
    } catch (err) {
      setRouteError("Could not load route — showing straight path");
    } finally {
      setRouteLoading(false);
    }
  };

  useEffect(function () { fetchRoute(effLat, effLng); }, []);

  useEffect(function () {
    if (!userLocation) return;
    var lat = userLocation.latitude;
    var lng = userLocation.longitude;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript("updateNavigation(" + lat + "," + lng + "); true;");
    }
    var distToDest = haversine(lat, lng, cLat, cLng);
    if (distToDest < 50 && !arrived) { setArrived(true); return; }
    setTotalDist(Math.round(distToDest));
    setEta(Math.ceil(distToDest / 1000 / 5 * 60));
    if (routeSteps.length > 0 && currentStepIdx < routeSteps.length - 1) {
      var nextStep = routeSteps[currentStepIdx + 1];
      if (nextStep && nextStep.location) {
        var wLng = nextStep.location[0];
        var wLat = nextStep.location[1];
        var distToWp = haversine(lat, lng, wLat, wLng);
        setDistToNext(Math.round(distToWp));
        if (distToWp < 30) setCurrentStepIdx(function (prev) { return prev + 1; });
      }
    }
  }, [userLocation]);

  var currentStep = routeSteps[currentStepIdx];
  var upcomingSteps = routeSteps.slice(currentStepIdx + 1, currentStepIdx + 4);

  return (
    <SafeAreaView style={styles.dashboardSafe}>
      {Platform.OS === "android" ? (
        <View style={[styles.statusBarSpacer, { height: topInset }]} />
      ) : null}

      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.navHeaderText}>
          <Text style={styles.navTitle}>{center.name}</Text>
          <Text style={styles.navSubtitle}>{center.slots} slots available</Text>
        </View>
        <TouchableOpacity onPress={() => callCenter(center.phone)}>
          <Ionicons name="call" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.navScrollContent, { paddingBottom: 32 + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {arrived && (
          <View style={{
            margin: 18, borderRadius: 18, backgroundColor: "rgba(47,184,100,0.12)",
            borderWidth: 1, borderColor: "#2fb864",
            alignItems: "center", padding: 24, gap: 10,
          }}>
            <Ionicons name="checkmark-circle" size={48} color="#2fb864" />
            <Text style={{ color: "#2fb864", fontSize: 20, fontWeight: "800", textAlign: "center" }}>
              You have arrived!
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 13, textAlign: "center" }}>{center.name}</Text>
            <TouchableOpacity
              style={{ marginTop: 8, backgroundColor: "#2fb864", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32 }}
              onPress={() => navigation.navigate("MainDrawer", { screen: "Evacuate" })}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Check In & End Navigation</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.navStats}>
          <View style={styles.navStatItem}>
            <Ionicons name="time-outline" size={16} color="#74C5E6" />
            <Text style={styles.navStatText}>{eta != null ? eta + " min" : "—"}</Text>
          </View>
          <View style={styles.navStatDivider} />
          <View style={styles.navStatItem}>
            <Ionicons name="navigate-outline" size={16} color="#74C5E6" />
            <Text style={styles.navStatText}>{fmtDist(totalDist)}</Text>
          </View>
          <View style={styles.navStatDivider} />
          <View style={styles.navStatItem}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: routeLoading ? "#f59e0b" : routeError ? "#ef4444" : "#2fb864" }} />
            <Text style={[styles.navStatText, { fontSize: 11 }]}>
              {routeLoading ? "Routing…" : routeError ? "Fallback" : "Live route"}
            </Text>
          </View>
        </View>

        <View style={styles.navMapContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: buildNavMapHTML(center, effLat, effLng) }}
            style={styles.mapFullMap}
            javaScriptEnabled
            originWhitelist={["*"]}
          />
          <View style={[styles.navMapOverlay, { backgroundColor: "rgba(40,55,71,0.88)", borderWidth: 1, borderColor: "#44566A" }]}>
            <Text style={[styles.navOverlayTitle, { color: "#74C5E6" }]}>
              {arrived ? "Arrived" : routeLoading ? "Routing…" : "Navigating"}
            </Text>
            {!arrived && !routeLoading && (
              <Text style={styles.navOverlaySubtitle}>Following route</Text>
            )}
          </View>
        </View>

        {!arrived && currentStep && !routeLoading && (
          <View style={{
            marginHorizontal: 18, marginTop: 12, borderRadius: 16,
            backgroundColor: "#437D8F", padding: 16,
            flexDirection: "row", alignItems: "center", gap: 14,
          }}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={stepIcon(currentStep.type, currentStep.modifier)} size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, lineHeight: 20 }}>
                {currentStep.instruction}
              </Text>
              {distToNext != null && (
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 3 }}>
                  {"In " + fmtDist(distToNext)}
                </Text>
              )}
            </View>
          </View>
        )}

        {routeLoading && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 18, marginTop: 12 }}>
            <ActivityIndicator size="small" color="#74C5E6" />
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>Calculating road route…</Text>
          </View>
        )}
        {routeError && !routeLoading && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 18, marginTop: 12 }}>
            <Feather name="alert-triangle" size={14} color="#f59e0b" />
            <Text style={{ color: "#f59e0b", fontSize: 12 }}>{routeError}</Text>
          </View>
        )}

        {!arrived && upcomingSteps.length > 0 && (
          <View style={styles.navDirections}>
            <Text style={[styles.navSectionTitle, { marginBottom: 6 }]}>Upcoming Turns</Text>
            {upcomingSteps.map(function (step) {
              return (
                <Card key={step.id} style={styles.navDirectionCard}>
                  <View style={styles.navDirectionRow}>
                    <Ionicons name={stepIcon(step.type, step.modifier)} size={18} color="#74C5E6" />
                    <Text style={styles.navDirectionText}>{step.instruction}</Text>
                  </View>
                  <Text style={styles.navDirectionMeta}>{fmtDist(step.distance)}</Text>
                </Card>
              );
            })}
          </View>
        )}

        <Card style={styles.navSafetyCard}>
          <Ionicons name="alert-circle" size={18} color="#e09b2f" />
          <Text style={styles.navSafetyText}>
            Stay alert and follow evacuation protocols. If conditions worsen, seek immediate shelter.
          </Text>
        </Card>

        <View style={styles.navActions}>
          <TouchableOpacity style={styles.navEndButton} onPress={() => navigation.navigate("MainDrawer", { screen: "Evacuate" })}>
            <Text style={styles.navEndText}>End Navigation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navReportButton}>
            <Text style={styles.navReportText}>Report Issue</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const ReportScreen = ({ navigation, userName }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const bottomInset = Platform.OS === "android" ? 32 : 16;
  const [selectedType, setSelectedType] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [userData, setUserData] = useState(null);
  const locationLabel = userData?.barangay || "Mabolo District";

  const reporterName = userName || "Anonymous";

  // Load user data from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          setUserData(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    loadUserData();
  }, []);



  // ... (in ReportScreen)

  useFocusEffect(
    React.useCallback(() => {
      fetchReports();
    }, [userName])
  );

  const fetchReports = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/reports/?reporter_name=${encodeURIComponent(reporterName)}`);
      if (response.ok) {
        const data = await response.json();
        setRecentReports(data);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    }
  };

  const canSubmit = selectedType && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reporter_name", reporterName);
      formData.append("reporter_email", userData?.email || "");
      formData.append("type", selectedType);
      formData.append("location", locationLabel);
      formData.append("description", description);

      if (photos.length > 0) {
        const localUri = photos[0];
        const filename = localUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;

        formData.append("image", {
          uri: localUri,
          name: filename,
          type: type,
        });
      }

      const response = await fetch(`${API_BASE}/api/reports/`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
        },
        body: formData,
      });

      if (response.ok) {
        Alert.alert(
          "Report submitted",
          "Your report has been sent to LGU moderators for review."
        );
        setSelectedType("");
        setDescription("");
        setPhotos([]);
        fetchReports(); // Refresh list
        // navigation.replace("Dashboard"); // Stay on screen to see report
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.error || "Failed to submit report.");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", `Network error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = async (source) => {
    if (photos.length >= 3) {
      Alert.alert("Limit reached", "You can upload up to 3 photos.");
      return;
    }

    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow access to continue.");
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
          quality: 0.7,
          allowsEditing: true,
        })
        : await ImagePicker.launchImageLibraryAsync({
          quality: 0.7,
          allowsEditing: true,
          selectionLimit: 1,
        });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    setPhotos((prev) => [...prev, result.assets[0].uri]);
  };

  return (
    <SafeAreaView style={styles.dashboardSafe}>
      <CustomHeader navigation={navigation} title="Report" subtitle="Help us monitor ground conditions" />
      <ScrollView
        contentContainerStyle={[
          styles.reportContent,
          { paddingBottom: 140 + bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.reportInfoCard}>
          <View style={styles.reportInfoHeader}>
            <Ionicons name="information-circle" size={18} color="#74C5E6" />
            <Text style={styles.reportInfoTitle}>Community Reporting</Text>
          </View>
          <Text style={styles.reportInfoText}>
            Your reports help us verify conditions and improve our flood
            monitoring system. All reports are reviewed by LGU moderators.
          </Text>
        </Card>

        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>Report Type</Text>
          <View style={styles.reportTypeGrid}>
            {REPORT_TYPES.map((type) => {
              const active = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.reportTypeChip,
                    active && styles.reportTypeChipActive,
                  ]}
                  onPress={() => setSelectedType(type)}
                >
                  <Text
                    style={[
                      styles.reportTypeText,
                      active && styles.reportTypeTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Card style={styles.reportLocationCard}>
            <Ionicons name="location" size={18} color="#74C5E6" />
            <View style={styles.reportLocationText}>
              <Text style={styles.reportLocationTitle}>Use Current Location</Text>
              <Text style={styles.reportLocationSubtitle}>{locationLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Card>
        </View>

        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={styles.reportInput}
            multiline
            placeholder="Describe what you are observing..."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>Add Photos (Optional)</Text>
          <View style={styles.reportPhotoRow}>
            <TouchableOpacity
              style={styles.reportPhotoButton}
              onPress={() => pickImage("camera")}
            >
              <Ionicons name="camera" size={20} color="#74C5E6" />
              <Text style={styles.reportPhotoText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reportPhotoButton}
              onPress={() => pickImage("gallery")}
            >
              <Ionicons name="image" size={20} color="#74C5E6" />
              <Text style={styles.reportPhotoText}>Gallery</Text>
            </TouchableOpacity>
          </View>
          {photos.length ? (
            <>
              <Text style={styles.reportPhotoCount}>
                {photos.length} photo{photos.length > 1 ? "s" : ""} selected
              </Text>
              <View style={styles.reportPreviewRow}>
                {photos.map((uri, index) => (
                  <Image
                    key={`${uri}-${index}`}
                    source={{ uri }}
                    style={styles.reportPreviewImage}
                  />
                ))}
              </View>
            </>
          ) : null}
        </View>

        {submitting ? (
          <ActivityIndicator size="large" color="#74C5E6" style={{ marginVertical: 20 }} />
        ) : (
          <PrimaryButton
            label="Submit Report"
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={styles.reportSubmit}
          />
        )}

        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>Your Recent Reports</Text>
          <View style={styles.reportsList}>
            {recentReports.map((report) => (
              <Card key={report.id} style={styles.reportItem}>
                <View style={styles.reportItemHeader}>
                  <Text style={styles.reportItemTitle}>{report.type} Report</Text>
                  <View
                    style={[
                      styles.reportStatus,
                      report.status?.toLowerCase() === "verified"
                        ? styles.reportStatusVerified
                        : styles.reportStatusReview,
                    ]}
                  >
                    <Text style={styles.reportStatusText}>
                      {report.status ? report.status.charAt(0).toUpperCase() + report.status.slice(1) : ""}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reportItemLocation}>{report.location}</Text>
                <Text style={styles.reportItemTime}>{report.timestamp ? formatPST(report.timestamp) : "—"}</Text>

                {/* Official Verification Details */}
                {report.status.toLowerCase() === "verified" && (
                  <View style={styles.verificationSection}>
                    <View style={styles.verificationHeader}>
                      <Ionicons name="shield-checkmark" size={14} color="#74C5E6" />
                      <Text style={styles.verificationTitle}>Official Verification</Text>
                    </View>

                    <View style={styles.verificationGrid}>
                      <View style={styles.verificationItem}>
                        <Text style={styles.verificationLabel}>Flood Level</Text>
                        <View style={[
                          styles.levelBadge,
                          {
                            backgroundColor:
                              report.flood_level_reported === "High" ? "#e2463b" :
                                report.flood_level_reported === "Medium" ? "#f29339" : "#f5c542"
                          }
                        ]}>
                          <Text style={styles.levelBadgeText}>{report.flood_level_reported || "Low"}</Text>
                        </View>
                      </View>

                      <View style={styles.verificationItem}>
                        <Text style={styles.verificationLabel}>Status</Text>
                        <View style={[
                          styles.incidentBadge,
                          report.report_status === "Resolved" ? styles.incidentBadgeResolved : styles.incidentBadgeActive
                        ]}>
                          <Text style={[
                            styles.incidentBadgeText,
                            report.report_status === "Resolved" && styles.incidentBadgeTextResolved
                          ]}>
                            {report.report_status || "Active"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {report.recommendations && (
                      <View style={styles.recommendationBlock}>
                        <Text style={styles.recommendationLabel}>Official Recommendation</Text>
                        <Text style={styles.recommendationText}>
                          "{report.recommendations}"
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const SettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const bottomInset = Platform.OS === "android" ? 32 : 16;
  const [offlineReady] = useState(true);
  const [userData, setUserData] = useState({
    full_name: "Loading...",
    email: "Loading...",
    barangay: "Loading...",
    phone: "",
    avatar_url: null
  });
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now());

  // Subscription State
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [userSubscriptions, setUserSubscriptions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);

  // List of hardcoded barangays for now
  const BARANGAYS = [
    "Sitio San Vicente",
    "Sitio Magtalisay",
    "Sitio Laray Holy Name",
    "Sitio Lahing-Lahing (Uno and Dos)"
  ];

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        // Fetch fresh data from API
        const response = await fetch(`${API_BASE}/api/users/${user.id}`);
        if (response.ok) {
          const freshData = await response.json();
          setUserData(freshData);
          // Update stored data
          await AsyncStorage.setItem('userData', JSON.stringify(freshData));
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const fetchSubscriptions = async (userId) => {
    try {
      setSubsLoading(true);
      const response = await fetch(`${API_BASE}/api/subscriptions/user/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserSubscriptions(data.map(sub => sub.barangay));
      }
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    } finally {
      setSubsLoading(false);
    }
  };

  const toggleSubscription = async (barangay, isSubscribed) => {
    const userId = userData?.id;
    if (!userId) return;

    // Optimistic UI update
    if (isSubscribed) {
      setUserSubscriptions(prev => prev.filter(b => b !== barangay));
    } else {
      setUserSubscriptions(prev => [...prev, barangay]);
    }

    try {
      if (isSubscribed) {
        // Unsubscribe
        const res = await fetch(`${API_BASE}/api/subscriptions/user/${userId}/barangay`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barangay })
        });
        if (!res.ok) throw new Error("Unsubscribe failed");
      } else {
        // Subscribe
        const res = await fetch(`${API_BASE}/api/subscriptions/user/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barangay })
        });
        if (!res.ok) throw new Error("Subscribe failed");
      }
    } catch (error) {
      console.error("Subscription toggle error:", error);
      Alert.alert("Error", "Could not update subscription. Please try again.");
      fetchSubscriptions(userId); // revert on failure
    }
  };


  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
    }
  };

  const uploadAvatar = async (asset) => {
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (!storedUser) return;
      const user = JSON.parse(storedUser);

      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(`${API_BASE}/api/users/${user.id}/avatar`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "Profile picture updated!");
        fetchUserProfile(); // Refresh data
      } else {
        Alert.alert("Upload Failed", data.error || "Could not upload image.");
      }

    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload image.");
    }
  };

  const handleUpdateProfile = async (updatedData) => {
    setIsUpdating(true);
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (!storedUser) return;
      const user = JSON.parse(storedUser);

      // 1. Upload image first if one was selected
      if (selectedImage) {
        const formData = new FormData();
        formData.append('image', {
          uri: selectedImage.uri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        });

        const avatarResponse = await fetch(`${API_BASE}/api/users/${user.id}/avatar`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (!avatarResponse.ok) {
          const errData = await avatarResponse.json();
          Alert.alert("Upload Failed", errData.error || "Could not upload image.");
          setIsUpdating(false);
          return;
        }
      }

      // 2. Update profile details
      const response = await fetch(`${API_BASE}/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updatedData,
          email: userData.email
        }),
      });

      if (response.ok) {
        Alert.alert("Success", "Profile updated successfully!");
        setShowEditProfile(false);
        setSelectedImage(null);
        setAvatarTimestamp(Date.now()); // Update timestamp to force image refresh
        fetchUserProfile();
      } else {
        const errorData = await response.json();
        Alert.alert("Update Failed", errorData.error || "Could not update profile.");
      }
    } catch (error) {
      console.error("Update profile error:", error);
      Alert.alert("Error", "Failed to connect to the server.");
    } finally {
      setIsUpdating(false);
    }
  };

  const renderItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.settingsItem}
      onPress={() => {
        if (item.id === "notifications") {
          if (userData?.id) {
            fetchSubscriptions(userData.id);
          }
          setShowSubscriptions(true);
        } else if (item.id === "locations") {
          navigation.navigate("EvacuationMap");
        } else if (item.id === "privacy") {
          Alert.alert(
            "Privacy & Security",
            "• Data Encryption: All your personal data is encrypted in transit and at rest.\n\n• Location Usage: Your location is only used to send relevant proximity alerts and is never shared with 3rd parties.\n\n• Account Security: We recommend changing your password every 90 days.",
            [
              { text: "Change Password", onPress: () => navigation.navigate("ChangePassword") },
              { text: "Close", style: "cancel" }
            ]
          );
        } else if (item.id === "help") {
          Alert.alert(
            "Help & Documentation",
            "• How it works: Sensors detect water levels and alert the LGU. Verified reports are then broadcasted to you.\n\n• Alerts: Red indicates Critical (Evacuate), Orange is Warning (Prepare), Blue is Advisory (Monitor).\n\n• Contact Support: admin@floodguard.gov",
            [{ text: "Close", style: "cancel" }]
          );
        } else if (item.type !== "toggle") {
          console.log(`Navigate to ${item.id}`);
        }
      }}
      disabled={item.type === "toggle"}
    >
      <Ionicons name={item.icon} size={18} color="#74C5E6" />
      <View style={styles.settingsItemText}>
        <Text style={styles.settingsItemTitle}>{item.title}</Text>
        <Text style={styles.settingsItemSubtitle}>{item.description}</Text>
      </View>
      {item.type === "toggle" ? (
        <Switch
          value={false}
          onValueChange={null}
          trackColor={{ false: "#767577", true: "#74C5E6" }}
          thumbColor={theme.textPrimary}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.dashboardSafe}>
      <CustomHeader navigation={navigation} title="Settings" subtitle="Manage your account preferences" />
      <ScrollView
        contentContainerStyle={[
          styles.settingsContent,
          { paddingBottom: 140 + bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
      >

        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => {
            setSelectedImage(null); // Clear any old selection
            setShowEditProfile(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.profileAvatar}>
            {userData.avatar_url ? (
              <Image
                source={{ uri: `${API_BASE}${userData.avatar_url}?t=${avatarTimestamp}` }}
                style={{ width: '100%', height: '100%', borderRadius: 40 }}
              />
            ) : (
              <Ionicons name="person" size={22} color="#ffffff" />
            )}
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#74C5E6', borderRadius: 10, padding: 4 }}>
              <Ionicons name="camera" size={12} color="white" />
            </View>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{userData.full_name || userData.username || "User"}</Text>
            <Text style={styles.profileEmail}>{userData.email}</Text>
            <Text style={styles.profileLocation}>{userData.barangay || "Location not set"}</Text>
            {userData.phone && <Text style={styles.profilePhone}>{userData.phone}</Text>}
          </View>
          <Ionicons name="create-outline" size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Notifications</Text>
          {SETTINGS_ITEMS.filter((item) => item.section === "Notifications").map(
            renderItem
          )}
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Location & Map</Text>
          {SETTINGS_ITEMS.filter((item) => item.section === "Location & Map").map(
            renderItem
          )}
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>App Settings</Text>
          {SETTINGS_ITEMS.filter((item) => item.section === "App Settings").map(
            renderItem
          )}
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Support</Text>
          {SETTINGS_ITEMS.filter((item) => item.section === "Support").map(
            renderItem
          )}
        </View>

        <Card style={styles.offlineCard}>
          <View style={styles.offlineHeader}>
            <View
              style={[
                styles.offlineDot,
                { backgroundColor: offlineReady ? "#2fb864" : "#f5c542" },
              ]}
            />
            <Text style={styles.offlineTitle}>
              {offlineReady ? "Offline Mode Available" : "Offline Mode Unavailable"}
            </Text>
          </View>
          <Text style={styles.offlineMessage}>
            Critical data cached for offline access
          </Text>
        </Card>


        <View style={styles.settingsFooter}>
          <Text style={styles.settingsFooterText}>Flood Monitor v1.0.0</Text>
          <Text style={styles.settingsFooterText}>Capstone Project 2025</Text>
        </View>
        <EditProfileModal
          visible={showEditProfile}
          userData={userData}
          onSave={handleUpdateProfile}
          onCancel={() => {
            setShowEditProfile(false);
            setSelectedImage(null);
          }}
          onPickImage={pickImage}
          selectedImage={selectedImage}
          avatarTimestamp={avatarTimestamp}
        />

        {/* Subscription Modal */}
        <Modal transparent visible={showSubscriptions} animationType="slide">
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setShowSubscriptions(false)}>
              <View style={styles.modalOverlayBackground} />
            </TouchableWithoutFeedback>
            <View style={[styles.editProfileCard, { height: '60%' }]}>
              <View style={styles.editProfileHeader}>
                <Text style={styles.editProfileTitle}>Alert Subscriptions</Text>
                <TouchableOpacity onPress={() => setShowSubscriptions(false)}>
                  <Ionicons name="close" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={{ color: theme.textSecondary, marginBottom: 15, paddingHorizontal: 5 }}>
                Subscribe to receive instant flood alerts for specific areas.
              </Text>

              {subsLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {BARANGAYS.map((barangay) => {
                    const isSubscribed = userSubscriptions.includes(barangay);
                    return (
                      <View key={barangay} style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: theme.surface,
                        padding: 16,
                        borderRadius: 12,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: theme.border
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Ionicons name="location" size={20} color={isSubscribed ? theme.primary : theme.textSecondary} />
                          <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '500' }}>{barangay}</Text>
                        </View>
                        <Switch
                          value={isSubscribed}
                          onValueChange={() => toggleSubscription(barangay, isSubscribed)}
                          trackColor={{ false: "#767577", true: theme.primary }}
                          thumbColor={Platform.OS === 'ios' ? '#ffffff' : (isSubscribed ? '#ffffff' : '#f4f3f4')}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>

    </SafeAreaView >
  );
};

const EvacuationMapScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { userLocation } = useUserLocation();

  const centers = route?.params?.centers ?? EVAC_CENTERS;
  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const bottomInset = Platform.OS === "android" ? 32 : 16;

  // Effective location — real GPS if available, hardcoded fallback
  const effLat = userLocation?.latitude ?? USER_LOCATION.latitude;
  const effLng = userLocation?.longitude ?? USER_LOCATION.longitude;

  // Auto-select the nearest center (centers are pre-sorted by proximity)
  const [selectedCenter, setSelectedCenter] = useState(centers.length > 0 ? centers[0] : null);
  const slideAnim = useRef(new Animated.Value(1)).current;
  const webViewRef = useRef(null);

  // Push live GPS updates into the Leaflet map
  useEffect(() => {
    if (!webViewRef.current || !userLocation) return;
    webViewRef.current.injectJavaScript(
      `updateUserLocation(${userLocation.latitude}, ${userLocation.longitude}); true;`
    );
  }, [userLocation]);

  const tellMapSelect = (center) => {
    if (!webViewRef.current || !center) return;
    webViewRef.current.injectJavaScript(`handleRNMessage('${center.id}'); true;`);
  };

  const selectCenter = (center) => {
    setSelectedCenter(center);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    tellMapSelect(center);
  };

  const panelTranslate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [240, 0] });

  const nearestCenter = centers[0];
  const slots = selectedCenter
    ? (selectedCenter.slots != null
      ? selectedCenter.slots
      : Math.max(0, (selectedCenter.capacity ?? 0) - (selectedCenter.slots_filled ?? 0)))
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1E2A38" }}>
      {Platform.OS === "android" ? (
        <View style={{ height: topInset }} />
      ) : null}

      <LinearGradient colors={EVAC_GRADIENT} style={{
        paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Evacuation Route Map</Text>
        <View style={{ width: 22 }} />
      </LinearGradient>

      {/* Map fills remaining space */}
      <View style={{ flex: 1, position: "relative" }}>
        <WebView
          ref={webViewRef}
          source={{ html: buildEvacMapHTML(centers, effLat, effLng) }}
          style={StyleSheet.absoluteFillObject}
          javaScriptEnabled
          originWhitelist={['*']}
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.type === 'select') {
                const found = centers.find(c => c.id === data.id);
                if (found) {
                  setSelectedCenter(found);
                  Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
                }
              }
            } catch (_) { }
          }}
        />

        {/* Nearest center badge — top left */}
        {nearestCenter && (
          <TouchableOpacity
            style={{
              position: "absolute", top: 12, left: 12,
              backgroundColor: "rgba(40,55,71,0.92)", borderRadius: 12,
              paddingHorizontal: 10, paddingVertical: 6,
              flexDirection: "row", alignItems: "center", gap: 6,
              borderWidth: 1, borderColor: "#74C5E6",
            }}
            onPress={() => selectCenter(nearestCenter)}
          >
            <Feather name="navigation" size={12} color="#74C5E6" />
            <Text style={{ color: "#74C5E6", fontSize: 12, fontWeight: "700" }}>
              Nearest: {nearestCenter.name}
            </Text>
          </TouchableOpacity>
        )}

        {/* Map legend — top right */}
        <View style={{
          position: "absolute", top: 12, right: 12,
          backgroundColor: "rgba(40,55,71,0.92)", borderRadius: 12,
          padding: 10, gap: 6, borderWidth: 1, borderColor: "#44566A",
        }}>
          {[
            { color: "#74C5E6", label: "Route" },
            { color: "#2fb864", label: "Open" },
            { color: "#f59e0b", label: "Full" },
            { color: "#e2463b", label: "Flood zone" },
          ].map(({ color, label }) => (
            <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
              <Text style={{ color: "#94a3b8", fontSize: 11 }}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Bottom info panel — slides up when a center is selected */}
        {selectedCenter && (
          <Animated.View style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            transform: [{ translateY: panelTranslate }],
            backgroundColor: "#283747",
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            padding: 18, paddingBottom: 18 + bottomInset,
            shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.25, shadowRadius: 10, elevation: 12,
          }}>
            {/* Drag handle */}
            <View style={{ width: 40, height: 4, backgroundColor: "#44566A", borderRadius: 2, alignSelf: "center", marginBottom: 14 }} />

            {/* Center info */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  {selectedCenter.id === nearestCenter?.id && (
                    <View style={{ backgroundColor: "rgba(116,197,230,0.18)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: "#74C5E6", fontSize: 10, fontWeight: "700" }}>NEAREST</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: "#ffffff", fontSize: 17, fontWeight: "700", marginBottom: 6 }}>
                  {selectedCenter.name}
                </Text>
                <View style={{ flexDirection: "row", gap: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="navigation" size={12} color="#94a3b8" />
                    <Text style={{ color: "#94a3b8", fontSize: 12 }}>{selectedCenter.distance ?? "—"} away</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="users" size={12} color="#94a3b8" />
                    <Text style={{ color: "#94a3b8", fontSize: 12 }}>{slots} slots open</Text>
                  </View>
                  {selectedCenter.capacity ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="home" size={12} color="#94a3b8" />
                      <Text style={{ color: "#94a3b8", fontSize: 12 }}>Cap: {selectedCenter.capacity}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{
                backgroundColor: selectedCenter.status === "open" ? "rgba(47,184,100,0.15)" : "rgba(245,158,11,0.15)",
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5,
              }}>
                <Text style={{
                  color: selectedCenter.status === "open" ? "#2fb864" : "#f59e0b",
                  fontSize: 13, fontWeight: "700",
                }}>
                  {selectedCenter.status === "open" ? "OPEN" : "FULL"}
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 13,
                  borderWidth: 1, borderColor: "#44566A",
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                }}
                onPress={() => callCenter(selectedCenter.phone)}
              >
                <Feather name="phone" size={16} color="#74C5E6" />
                <Text style={{ color: "#74C5E6", fontWeight: "600", fontSize: 14 }}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 2, borderRadius: 13, overflow: "hidden", opacity: selectedCenter.status !== "open" ? 0.45 : 1 }}
                onPress={() => selectedCenter.status === "open" && navigation.navigate("ActiveNavigation", { center: selectedCenter })}
                disabled={selectedCenter.status !== "open"}
              >
                <LinearGradient
                  colors={["#437D8F", "#6EA2B3"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Feather name="map-pin" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Navigate Here</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {selectedCenter.status !== "open" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                <Feather name="alert-circle" size={12} color="#ef4444" />
                <Text style={{ color: "#ef4444", fontSize: 12 }}>This center is full — tap another pin to see alternatives.</Text>
              </View>
            )}
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
};

const CustomDrawerContent = (props) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      disconnectMobileSocket();
    } catch (e) { console.warn("Socket disconnect failed:", e); }
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    props.navigation.replace("Landing");
  };

  const { unreadCount } = useNotifications();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        {/* Drawer Header */}
        <View style={{ padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Image source={LOGO} style={{ width: 40, height: 40, resizeMode: "contain" }} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: theme.textPrimary }} numberOfLines={1}>Flood Monitor</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: -2 }} numberOfLines={1}>Stay safe, stay informed</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => props.navigation.closeDrawer()} style={{ padding: 8, backgroundColor: theme.badgeBg, borderRadius: 100, marginLeft: 8 }}>
              <Ionicons name="close" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingVertical: 16 }}>
          {[
            { label: "Home", icon: "home", route: "Dashboard" },
            { label: "Alerts", icon: "notifications", route: "Alerts", badge: unreadCount > 0 },
            { label: "Evacuate", icon: "map", route: "Evacuate" },
            { label: "Report", icon: "chatbubble", route: "Report" },
            { label: "Settings", icon: "settings", route: "Settings" },
          ].map((item) => {
            const activeRouteIndex = props.state?.index ?? 0;
            const activeRouteName = props.state?.routeNames[activeRouteIndex] ?? "Dashboard";
            const isActive = item.route === activeRouteName;

            return (
              <TouchableOpacity
                key={item.label}
                onPress={() => props.navigation.navigate(item.route)}
                style={{ paddingVertical: 14, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", backgroundColor: isActive ? "rgba(116, 197, 230, 0.1)" : "transparent", borderRightWidth: isActive ? 3 : 0, borderRightColor: "#74C5E6" }}
              >
                <Ionicons name={item.icon} size={22} color={isActive ? "#74C5E6" : theme.textPrimary} />
                <Text style={{ marginLeft: 16, fontSize: 16, fontWeight: isActive ? "700" : "500", color: isActive ? "#74C5E6" : theme.textPrimary }}>{item.label}</Text>
                {item.badge && (
                  <View style={{ marginLeft: "auto", backgroundColor: "#e2463b", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Emergency Footer Block */}
        <View style={{ marginHorizontal: 24, marginTop: 40, padding: 18, backgroundColor: "rgba(226, 70, 59, 0.1)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(226, 70, 59, 0.2)" }}>
          <Ionicons name="warning" size={24} color="#e2463b" />
          <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700", marginTop: 8 }}>Emergency</Text>
          <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>Need immediate assistance?</Text>
          <TouchableOpacity
            style={{ backgroundColor: "#e2463b", paddingVertical: 10, borderRadius: 8, alignItems: "center", marginTop: 12 }}
            onPress={() => Linking.openURL('tel:911')}
          >
            <Text style={{ color: "#ffffff", fontWeight: "700" }}>Call 911 / 143</Text>
          </TouchableOpacity>
        </View>

      </DrawerContentScrollView>

      {/* Sticky Bottom Logout Section */}
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: theme.border, marginBottom: Platform.OS === 'ios' ? 40 : 30 }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: theme.badgeBg, borderRadius: 12 }}
          onPress={() => setShowLogoutModal(true)}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          <Text style={{ color: theme.textPrimary, fontWeight: "700", fontSize: 15, marginLeft: 10 }}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <LogoutConfirmationModal
        visible={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </View>
  );
};

const MainDrawer = () => {
  const { theme } = useTheme();
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('userData');
        if (stored) {
          const user = JSON.parse(stored);
          setUserName(user.full_name || user.name || "User");
        }
      } catch (e) {
        console.log("Error loading user in Drawer", e);
      }
    };
    fetchUser();
  }, []);

  return (
    <Drawer.Navigator
      useLegacyImplementation={false}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: theme.background,
          width: 300,
        },
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Alerts" component={AlertsScreen} />
      <Drawer.Screen name="Evacuate" component={EvacuationScreen} />
      <Drawer.Screen name="Report">
        {(props) => <ReportScreen {...props} userName={userName} />}
      </Drawer.Screen>
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
};

function LocationProvider({ children }) {
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    let subscription = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission denied');
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      );
    })();
    return () => { subscription?.remove(); };
  }, []);

  return (
    <LocationContext.Provider value={{ userLocation, locationError }}>
      {children}
    </LocationContext.Provider>
  );
}

function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState([]);

  const shownIds = useRef(new Set());
  const readIdsRef = useRef(readIds);

  useEffect(() => {
    readIdsRef.current = readIds;
  }, [readIds]);

  // ── REAL-TIME BROADCAST: delivering sub-2-second latency ──
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;

    socket.on("new_notification", async (data) => {
      console.log("[WS] Received raw notification data:", data);
      console.log("[WS] Current Socket Connected:", socket.connected);
      // ── NAVIGATION GUARD: Don't show popups on auth-related screens ──
      if (navigationRef.isReady()) {
        const route = navigationRef.getCurrentRoute();
        const authScreens = ['Landing', 'Login', 'Loading', 'ChangePassword'];
        if (route && authScreens.includes(route.name)) {
          console.log(`[WS] Notification suppressed on screen: ${route.name}`);
          return;
        }
      }

      // Secondary check for data persistence
      const storedUser = await AsyncStorage.getItem("userData");
      if (!storedUser) return;

      console.log("[WS] Instant alert received:", data);
      
      // ── STANDARDIZED ID GENERATION (Must match fetchNotifications exactly) ──
      const isReport = data.type === 'verified_report' || data.type === 'report' || data.type === 'dismissed_report';
      const normalizedId = isReport ? `report-${data.id}` : `alert-${data.id || 'new'}`;

      // 1. EXACTLY-ONCE CHECK
      if (shownIds.current.has(normalizedId)) return;
      if (readIdsRef.current.includes(normalizedId)) return;

      shownIds.current.add(normalizedId);

      // ── PRIORITY 1: SHOW DIALOG IMMEDIATELY ──
      const isActiveBroadcast = data.status ? data.status === 'active' : true;
      if (isActiveBroadcast && (
        data.level === 'critical' || 
        data.level === 'warning' || 
        data.level === 'evacuation' || 
        data.type === 'alert' || 
        data.type === 'auto_alert' ||
        data.type === 'verified_report' ||
        data.type === 'evacuation_center'
      )) {
        // ── CONTENT FORMATTING ──
        let message = "";
        if (data.type === 'verified_report') {
           message = `📍 Location: ${data.barangay}\n🔍 Incident: ${data.description}\n🤝 Response: ${data.recommendations || 'LGU is monitoring and responding'}`;
        } else if (data.level === 'evacuation' || data.type === 'evacuation_center') {
           const location = data.location || data.evacuation_location || 'Not Specified';
           const capacity = data.capacity || data.evacuation_capacity || 'N/A';
           const status = data.evacuation_status || data.status || 'OPEN';
           message = `📍 Pinned Location: ${location}\n👥 Total Capacity: ${capacity}\n🔄 Status: ${status.toUpperCase()}`;
        } else {
           const levelLabel = data.level ? data.level.toUpperCase() : 'ADVISORY';
           message = `📍 Location: ${data.barangay || 'All Areas'}\n⚠️ Risk: ${levelLabel}\n💡 Action: ${data.recommended_action || 'Follow safety protocols'}\n\n${data.description}`;
        }

        const isEvacuation = data.level === 'evacuation' || data.type === 'evacuation_center';
        const alertTitle = isEvacuation 
          ? (data.name || data.title?.replace('New Evacuation Center: ', '') || 'Evacuation Center')
          : data.title;

        Alert.alert(
          `📢 ${alertTitle}`,
          message,
          [
            {
              text: "Dismiss",
              style: "cancel",
              onPress: () => markAsRead(normalizedId)
            },
            {
              text: "View Details",
              style: "default",
              onPress: () => {
                markAsRead(normalizedId);
                const alertObj = { ...data, id: normalizedId };
                globalNavigate("AlertDetail", { alert: alertObj });
              }
            }
          ]
        );
      }

      // ── PRIORITY 2: REFRESH LIST IN BACKGROUND ──
      // Delay this slightly so it doesn't compete with the system alert's appearance
      setTimeout(() => {
        fetchNotifications(true);
      }, 800);
    });

    return () => {
      if (socket) socket.off("new_notification");
    };
  }, [socket]); // Empty dependency array ensures we only have ONE socket listener

  useEffect(() => {
    loadReadIds();
    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 45000); // Polling as a secondary fallback only

    return () => clearInterval(interval);
  }, []);

  const loadReadIds = async () => {
    try {
      const stored = await AsyncStorage.getItem("notif_read_ids");
      if (stored) setReadIds(JSON.parse(stored));
    } catch (e) {
      console.error("Error loading read ids:", e);
    }
  };

  const saveReadIds = async (ids) => {
    try {
      await AsyncStorage.setItem("notif_read_ids", JSON.stringify(ids));
    } catch (e) {
      console.error("Error saving read ids:", e);
    }
  };

  const [hiddenIds, setHiddenIds] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("notif_hidden_ids");
        if (stored) setHiddenIds(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading hidden ids:", e);
      }
    })();
  }, []);

  const markAsRead = (id) => {
    if (!readIds.includes(id)) {
      const newReadIds = [...readIds, id];
      setReadIds(newReadIds);
      saveReadIds(newReadIds);
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    const newReadIds = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(newReadIds);
    saveReadIds(newReadIds);
  };

  const clearDropdown = async () => {
    const allCurrentIds = notifications.map(n => n.id);
    const newHidden = Array.from(new Set([...hiddenIds, ...allCurrentIds]));
    setHiddenIds(newHidden);
    try {
      await AsyncStorage.setItem("notif_hidden_ids", JSON.stringify(newHidden));
    } catch (e) {
      console.error("Error saving hidden ids:", e);
    }
  };

  const fetchNotifications = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const storedUser = await AsyncStorage.getItem("userData");
      let alertsUrl = `${API_BASE}/api/alerts/`;
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user?.id) {
          alertsUrl = `${API_BASE}/api/subscriptions/user/${user.id}/alerts`;
        }
      }

      const [alertsRes, reportsRes] = await Promise.all([
        fetch(alertsUrl),
        fetch(`${API_BASE}/api/reports/?status=verified`)
      ]);

      let alerts = [];
      let reports = [];

      if (alertsRes.ok) alerts = await alertsRes.json();
      if (reportsRes.ok) reports = await reportsRes.json();

      const normalizedAlerts = (alerts || []).map(a => ({
        ...a,
        id: `alert-${a.id}`,
        title: a.title,
        message: a.message,
        sourceType: 'announcement',
        icon: ' megaphone-outline',
        accent: a.level === 'critical' ? '#e2463b' : a.level === 'warning' ? '#f29339' : '#f5c542',
        displayType: 'ANNOUNCEMENT',
        time: formatPSTShort(a.created_at)
      }));

      const normalizedReports = (reports || []).map(r => ({
        ...r,
        id: `report-${r.id}`,
        title: r.type,
        description: r.description,
        message: `Verified report at ${r.location}`,
        sourceType: 'community_report',
        icon: r.icon || 'people-outline',
        accent: '#74C5E6',
        displayType: 'COMMUNITY REPORT',
        time: formatPSTShort(r.created_at)
      }));

      const combined = [...normalizedAlerts, ...normalizedReports].sort((a, b) =>
        new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp)
      );

      const latestItems = combined.slice(0, 5);

      // Pop-up logic for new alerts (Fallback/Polling)
      // Only show if user is logged in AND not on an auth screen
      let shouldShowFallback = latestItems.length > 0 && isBackground && storedUser;
      if (shouldShowFallback && navigationRef.isReady()) {
        const route = navigationRef.getCurrentRoute();
        const authScreens = ['Landing', 'Login', 'Loading', 'ChangePassword'];
        if (route && authScreens.includes(route.name)) {
          shouldShowFallback = false;
        }
      }

      if (shouldShowFallback) {
        const newItem = latestItems[0];

        // 1. DEDUPLICATION GUARD: Suppress popups for verified community reports
        const isVerifiedReportEntry = newItem.sourceType === 'community_report' && (newItem.status === 'verified' || newItem.report_status === 'Active');

        // 2. RECENCY CHECK: Only trigger popups for items created in the last 5 minutes
        // This prevents old alerts from popping up if a newer one is deleted.
        const itemTime = new Date(newItem.timestamp || newItem.created_at).getTime();
        const now = Date.now();
        const isRecent = (now - itemTime) < (5 * 60 * 1000); // 5 minutes

        // Suppress pop-up if the user has already read/dismissed, if already shown, or if the broadcast is NOT active
        const isActive = newItem.status ? newItem.status === 'active' : true;
        if (!readIds.includes(newItem.id) && !shownIds.current.has(newItem.id) && isActive && !isVerifiedReportEntry && isRecent) {
          // Mark as shown to prevent duplicate triggers
          shownIds.current.add(newItem.id);

          // ── CONTENT FORMATTING (Consistent with Socket listener) ──
          let message = "";
          if (newItem.sourceType === 'community_report') {
             message = `📍 Location: ${newItem.location}\n🔍 Incident: ${newItem.description}\n🤝 Response: ${newItem.recommendations || 'LGU is responding'}`;
          } else if (newItem.level === 'evacuation' || newItem.type === 'evacuation_center') {
             const location = newItem.location || newItem.evacuation_location || 'Not Specified';
             const capacity = newItem.capacity || newItem.evacuation_capacity || 'N/A';
             const status = newItem.status || newItem.evacuation_status || 'OPEN';
             message = `📍 Pinned Location: ${location}\n👥 Total Capacity: ${capacity}\n🔄 Status: ${status.toUpperCase()}`;
          } else {
             const levelLabel = newItem.level ? newItem.level.toUpperCase() : 'ADVISORY';
             message = `📍 Location: ${newItem.barangay || 'All Areas'}\n⚠️ Risk: ${levelLabel}\n💡 Action: ${newItem.recommended_action || 'Follow safety protocols'}\n\n${newItem.description || newItem.message}`;
          }

          const isEvacItem = newItem.level === 'evacuation' || newItem.type === 'evacuation_center';
          const alertTitleFallback = isEvacItem
            ? (newItem.name || newItem.title?.replace('New Evacuation Center: ', '') || 'Evacuation Center')
            : (newItem.title || newItem.message);

          Alert.alert(
            `📢 ${alertTitleFallback}`,
            message,
            [
              {
                text: "Dismiss",
                style: "cancel",
                onPress: () => markAsRead(newItem.id)
              },
              {
                text: "View",
                style: "default",
                onPress: () => {
                  markAsRead(newItem.id);
                  globalNavigate("AlertDetail", { alert: newItem });
                }
              }
            ]
          );
          // Also save as last seen
          await AsyncStorage.setItem("last_notif_id", newItem.id);
        }
      }

      setNotifications(combined);
    } catch (e) {
      console.error("Error fetching notifications:", e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, loading, readIds, hiddenIds,
      markAsRead, markAllAsRead, clearDropdown, refresh: fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export default function App() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
  const [selection, setSelection] = useState("");
  const [area, setArea] = useState("");
  const [toggles, setToggles] = useState({ weather: true, community: false });

  return (
    <SocketProvider>
      <SensorStatusProvider>
        <LocationProvider>
          <NotificationProvider>
            <ThemeContext.Provider value={{ theme }}>
              <StatusBar
                barStyle="light-content"
                backgroundColor={theme.background}
              />
              <NavigationContainer ref={navigationRef}>
                <Stack.Navigator
                  initialRouteName="Loading"
                  screenOptions={{
                    headerShown: false,
                    animationEnabled: false,
                    cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
                  }}
                >
                  <Stack.Screen name="Loading" component={LoadingScreen} />
                  <Stack.Screen name="Landing" component={LandingScreen} />
                  <Stack.Screen name="Login" component={LoginScreen} />
                  <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                  <Stack.Screen name="Welcome" component={WelcomeScreen} />
                  <Stack.Screen name="Account">
                    {(props) => (
                      <AccountScreen {...props} form={form} setForm={setForm} />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Location">
                    {(props) => (
                      <LocationScreen
                        {...props}
                        selection={selection}
                        setSelection={setSelection}
                        area={area}
                        setArea={setArea}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Notifications">
                    {(props) => (
                      <NotificationsScreen
                        {...props}
                        toggles={toggles}
                        setToggles={setToggles}
                        form={form}
                        selection={selection}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="MainDrawer" component={MainDrawer} />
                  <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
                  <Stack.Screen name="EvacuationMap" component={EvacuationMapScreen} />
                  <Stack.Screen name="ActiveNavigation" component={ActiveNavigationScreen} />
                  <Stack.Screen name="Map" component={MapScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </ThemeContext.Provider>
          </NotificationProvider>
        </LocationProvider>
      </SensorStatusProvider>
    </SocketProvider>
  );
}

const getStyles = (theme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },
  dashboardSafe: {
    flex: 1,
    backgroundColor: theme.background,
  },
  dashHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 12,
    zIndex: 10,
    backgroundColor: theme.background,
  },
  burgerButton: {
    padding: 8,
    marginLeft: -8,
  },
  dashHeaderTexts: {
    flex: 1,
    marginLeft: 8,
  },
  dashHeaderTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.textPrimary,
  },
  dashHeaderSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(226, 70, 59, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 70, 59, 0.4)",
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.danger,
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.danger,
  },
  landingPage: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: theme.background,
  },
  landingPageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 29, 57, 0.4)",
  },
  landingCard: {
    marginHorizontal: 18,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: theme.cardBlue,
    borderWidth: 1,
    borderColor: "rgba(123, 189, 232, 0.15)",
    alignItems: "center",
  },
  liveBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginBottom: 24,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6EA2B3',
    marginRight: 6,
  },
  liveBadgeText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLogo: {
    width: 280,
    height: 280,
    resizeMode: "contain",
  },
  landingLogo: {
    width: 120,
    height: 120,
    resizeMode: "contain",
    marginBottom: 16,
  },
  landingTitle: {
    fontSize: 80,
    fontWeight: "900",
    color: theme.textPrimary,
    letterSpacing: -2,
    lineHeight: 85,
    textAlign: "center",
  },
  landingCaption: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    color: theme.textSecondary,
    marginBottom: 32,
  },
  landingPrimary: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    marginBottom: 12,
  },
  landingPrimaryText: {
    color: theme.textPrimary,
    fontWeight: "600",
    fontSize: 15,
  },
  landingSecondary: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6EA2B3",
    backgroundColor: "#6EA2B3",
    alignItems: "center",
  },
  landingSecondaryText: {
    color: theme.textPrimary,
    fontWeight: "700",
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cyanDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D2FF',
    marginRight: 8,
  },
  pillBadgeText: {
    color: theme.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroText: {
    fontSize: 60,
    fontWeight: '900',
    color: theme.textPrimary,
    letterSpacing: -2,
    lineHeight: 64,
    textAlign: 'center',
  },
  heroSubText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 24,
    color: theme.textSecondary,
  },
  btnExplore: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: "#303D4D",
    alignItems: 'center',
    marginBottom: 16,
  },
  btnExploreText: {
    color: theme.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  btnAdmin: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  btnAdminText: {
    color: "#fff",
    fontWeight: '700',
    fontSize: 16,
  },
  landingContainerFixed: {
    flex: 1,
    backgroundColor: theme.background,
  },
  headerGradient: {
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  dashboardHeader: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  alertsHeaderCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    marginTop: 0,
  },
  dashboardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  dashboardSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textPrimary,
  },
  dashboardContent: {
    padding: 18,
    gap: 14,
  },
  statusCard: {
    borderRadius: 16,
    padding: 16,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  statusPill: {
    backgroundColor: "#dff5e6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.statusSafe,
  },
  statusMessage: {
    marginTop: 8,
    fontSize: 13,
    color: theme.textSecondary,
  },
  statusUpdateRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.statusSafe,
  },
  statusUpdateText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  mapCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: theme.badgeBg,
  },
  mapHeaderBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapHeaderTitle: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  mapFull: {
    flex: 1,
    margin: 16,
    borderRadius: 18,
    overflow: "hidden",
  },
  mapFullMap: {
    flex: 1,
  },
  mapHighlight: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "rgba(42,106,227,0.35)",
    backgroundColor: "rgba(42,106,227,0.08)",
  },
  mapLegendBar: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 8,
  },
  mapLegendTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  mapLegendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  mapLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapHeader: {
    alignItems: "flex-start",
  },
  mapLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: theme.textSecondary,
    marginRight: 6,
  },
  mapPreview: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
    minHeight: 150,
  },
  mapPreviewMap: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPreviewOverlay: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.7)",
    width: "100%",
  },
  mapTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  mapSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  sensorCount: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  sectionHeader: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  sensorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sensorCard: {
    width: "48%",
    padding: 14,
    borderRadius: 14,
    gap: 6,
  },
  sensorLabel: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  sensorValue: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  sensorStatus: {
    fontSize: 11,
    fontWeight: "600",
  },
  dashboardPrimary: {
    marginTop: 4,
  },
  dashboardSecondary: {
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  dashboardSecondaryText: {
    color: theme.primary,
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.surface,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  navItem: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  navItemActive: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  navText: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: "center",
    color: theme.textSecondary,
  },
  navTextActive: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: "center",
    color: theme.primary,
    fontWeight: "600",
  },
  alertsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 2,
    gap: 12,
  },
  headerTextGroup: {
    flex: 1,
  },
  alertsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: theme.badgeBg,
  },
  filterPillActive: {
    backgroundColor: theme.primary,
  },
  filterText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  filterTextActive: {
    fontSize: 12,
    color: theme.textPrimary,
    fontWeight: "600",
  },
  alertSummary: {
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.textPrimary,
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  summaryDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "rgba(123, 189, 232, 0.15)",
    marginHorizontal: 12,
  },
  alertsList: {
    padding: 18,
    gap: 12,
  },
  alertCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.badgeBg,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.badgeBg,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.textSecondary,
  },
  alertDescription: {
    marginTop: 8,
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
  },
  alertMeta: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  alertMetaText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  alertDetailContent: {
    padding: 18,
    gap: 12,
  },
  alertDetailCard: {
    borderRadius: 16,
    padding: 16,
  },
  alertDetailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  alertDetailLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textPrimary,
    marginBottom: 6,
  },
  alertDetailDescription: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  alertDetailMeta: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  evacHeader: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
  },
  evacTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  evacSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: theme.textPrimary,
  },
  evacContent: {
    padding: 18,
    gap: 14,
  },
  routeCard: {
    borderRadius: 16,
    padding: 16,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  routeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.border,
  },
  routeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  routeDistance: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textSecondary,
  },
  routeButton: {
    marginTop: 12,
  },
  routeStatusPill: {
    backgroundColor: "#ffe5d9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  routeStatusText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.danger,
  },
  evacMapTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  sectionHint: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 4,
  },
  centerCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    backgroundColor: theme.surface,
  },
  centerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  centerTitleWrapper: {
    flex: 1,
    marginRight: 12,
  },
  centerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.textPrimary,
    marginBottom: 6,
  },
  centerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  centerMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  centerDistanceText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: "500",
  },
  centerCapacityText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: "500",
  },
  centerStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  centerOpen: {
    backgroundColor: "rgba(47, 184, 100, 0.1)",
    borderColor: "rgba(47, 184, 100, 0.2)",
  },
  centerFull: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  centerStatusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  centerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  centerActionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(116, 197, 230, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(116, 197, 230, 0.2)",
  },
  centerActionBtnTextSecondary: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.primary,
  },
  centerActionBtnPrimary: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  centerActionBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  centerActionBtnTextPrimary: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  centerActionBtnDisabled: {
    opacity: 0.5,
  },
  centerFullNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    padding: 10,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderRadius: 8,
  },
  centerFullNoticeText: {
    fontSize: 11,
    color: "#ef4444",
    fontWeight: "500",
  },
  offlineNotice: {
    backgroundColor: "#fff5eb",
  },
  offlineText: {
    fontSize: 12,
    color: "#9b4a2f",
    lineHeight: 16,
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  navHeaderText: {
    flex: 1,
  },
  navTitle: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  navSubtitle: {
    color: theme.textPrimary,
    fontSize: 12,
    marginTop: 2,
  },
  navStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  navStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  navStatText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textPrimary,
  },
  navStatDivider: {
    width: 1,
    height: "100%",
    backgroundColor: theme.border,
  },
  navMapContainer: {
    marginTop: 12,
    marginHorizontal: 18,
    borderRadius: 18,
    overflow: "hidden",
    flex: 1,
    minHeight: 280,
  },
  navMapOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: theme.textPrimary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navOverlayTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  navOverlaySubtitle: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  navDirections: {
    marginTop: 12,
    paddingHorizontal: 18,
    gap: 8,
  },
  navScrollContent: {
    paddingBottom: 24,
  },
  navSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  locationCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 12,
  },
  navDirectionCard: {
    borderRadius: 14,
    padding: 12,
  },
  navDirectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navDirectionText: {
    flex: 1,
    fontSize: 12,
    color: theme.textPrimary,
  },
  navDirectionMeta: {
    marginTop: 6,
    fontSize: 11,
    color: theme.textSecondary,
  },
  navSafetyCard: {
    marginHorizontal: 18,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: theme.badgeBg,
  },
  navSafetyText: {
    flex: 1,
    fontSize: 12,
    color: "#7a4a1f",
    lineHeight: 16,
  },
  navActions: {
    marginTop: 12,
    paddingHorizontal: 18,
    gap: 12,
    paddingBottom: 18,
  },
  navEndButton: {
    backgroundColor: theme.danger,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  navEndText: {
    color: theme.textPrimary,
    fontWeight: "700",
  },
  navReportButton: {
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    backgroundColor: theme.surface,
  },
  navReportText: {
    color: theme.textPrimary,
    fontWeight: "600",
  },
  reportContent: {
    padding: 18,
    gap: 14,
  },
  reportInfoCard: {
    backgroundColor: theme.badgeBg,
  },
  reportInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  reportInfoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  reportInfoText: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
  },
  reportSection: {
    gap: 8,
  },
  reportTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  reportTypeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  reportTypeChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  reportTypeText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: "600",
  },
  reportTypeTextActive: {
    color: theme.textPrimary,
  },
  reportLocationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reportLocationText: {
    flex: 1,
  },
  reportLocationTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textPrimary,
  },
  reportLocationSubtitle: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  reportInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: "top",
    backgroundColor: theme.surface,
    color: "#FFFFFF",
  },
  reportPhotoRow: {
    flexDirection: "row",
    gap: 12,
  },
  reportPhotoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.surface,
  },
  reportPhotoText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  reportPhotoCount: {
    marginTop: 6,
    fontSize: 11,
    color: theme.textSecondary,
  },
  reportPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  reportPreviewImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#e6ebf3",
  },
  reportSubmit: {
    marginTop: 4,
  },
  reportsList: {
    gap: 10,
  },
  reportItem: {
    padding: 14,
  },
  reportItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reportItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  reportStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reportStatusReview: {
    backgroundColor: theme.badgeBg,
  },
  reportStatusVerified: {
    backgroundColor: theme.surface,
  },
  reportStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.primary,
  },
  reportItemLocation: {
    marginTop: 6,
    fontSize: 11,
    color: theme.textSecondary,
  },
  reportItemTime: {
    marginTop: 2,
    fontSize: 10,
    color: theme.textSecondary,
  },

  // Official Verification UI Enhancement
  verificationSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(116, 197, 230, 0.1)',
    backgroundColor: 'rgba(116, 197, 230, 0.04)',
    borderRadius: 16,
    padding: 12,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  verificationTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#74C5E6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  verificationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  verificationItem: {
    flex: 1,
    minWidth: '40%',
  },
  verificationLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textTertiary || '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  verificationValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  recommendationBlock: {
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#34d399',
  },
  recommendationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34d399',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  recommendationText: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  incidentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  incidentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  settingsHeader: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  settingsSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textPrimary,
  },
  settingsContent: {
    padding: 18,
    gap: 14,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#6a36f5",
    alignItems: "center",
    justifyContent: "center",
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  profileEmail: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  profileLocation: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 4,
  },
  profilePhone: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  settingsSection: {
    gap: 8,
  },
  settingsSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  settingsItemText: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  settingsItemSubtitle: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  offlineCard: {
    backgroundColor: theme.badgeBg,
  },
  offlineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  offlineTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  offlineMessage: {
    marginTop: 6,
    fontSize: 11,
    color: theme.textSecondary,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.danger,
  },
  settingsFooter: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
  },
  settingsFooterText: {
    fontSize: 10,
    color: theme.textSecondary,
  },
  statusBarSpacer: {
    backgroundColor: theme.primary,
  },
  stepHeader: {
    gap: 10,
  },
  stepLabel: {
    color: "#e7ecff",
    fontWeight: "600",
    fontSize: 12,
    letterSpacing: 0.4,
  },
  progressTrack: {
    flexDirection: "row",
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  progressActive: {
    backgroundColor: theme.surface,
  },
  progressInactive: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  heroCard: {
    alignItems: "center",
    gap: 8,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  landingHero: {
    borderRadius: 22,
    overflow: "hidden",
    minHeight: 220,
    justifyContent: "flex-end",
  },
  landingImage: {
    borderRadius: 22,
  },
  landingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18, 32, 64, 0.58)",
  },
  landingContent: {
    padding: 18,
    gap: 8,
  },
  landingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  landingSubtitle: {
    fontSize: 13,
    color: theme.textPrimary,
    lineHeight: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  sectionSpacing: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textSecondary,
    marginLeft: 4,
  },
  card: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  featureSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  footer: {
    marginTop: 6,
  },
  footerRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 160,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: theme.textPrimary,
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    backgroundColor: theme.surface,
  },
  secondaryButtonText: {
    fontWeight: "600",
    color: theme.textSecondary,
  },
  formCard: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(123, 189, 232, 0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#283747",
    fontSize: 14,
    color: "#ffffff",
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phonePrefix: {
    backgroundColor: "#1E2A38",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: "rgba(123, 189, 232, 0.15)",
    justifyContent: 'center',
    height: 52,
  },
  phonePrefixText: {
    color: "#7BBDE8",
    fontWeight: "700",
    fontSize: 14,
  },
  errorText: {
    color: "#c53228",
    fontSize: 12,
    textAlign: "center",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  optionSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.border,
  },
  optionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: theme.textPrimary,
    fontWeight: "600",
  },
  optionTextSelected: {
    color: theme.textPrimary,
  },
  infoNote: {
    backgroundColor: theme.badgeBg,
  },
  infoNoteText: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
  },
  toggleCard: {
    padding: 16,
  },
  toggleCritical: {
    borderWidth: 1,
    borderColor: "#ffd0d0",
    backgroundColor: "#fff5f5",
  },
  toggleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  toggleNote: {
    fontSize: 11,
    color: "#a14d4d",
    marginTop: 6,
    fontWeight: "600",
  },

  // Dashboard Header & Title
  dashboardScrollContent: {
    padding: 16,
    gap: 16,
  },
  dashHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  burgerButton: {
    padding: 8,
    marginRight: 12,
  },
  dashHeaderTexts: {
    flex: 1,
  },
  dashHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  dashHeaderSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  liveBadgeText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Location Card
  locationCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
  },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  safeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 4,
  },
  safeBadgeText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '700',
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationTitle: {
    marginLeft: 8,
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  locationTimeText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
    marginLeft: 28,
  },
  riskLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riskLevelLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginRight: 12,
  },
  riskLevelBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginRight: 12,
  },
  riskLevelBarFill: {
    width: '20%',
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 3,
  },
  riskLevelValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#22c55e',
  },

  // Welcome Banner Styles
  welcomeBanner: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  welcomeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  welcomeGreeting: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  welcomeName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  welcomeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  welcomePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  welcomeStatusText: {
    fontSize: 11,
    color: '#34d399',
    fontWeight: '700',
  },
  welcomeAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  welcomeAvatarGradient: {
    flex: 1,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeAvatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  welcomeOrb: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#74C5E6',
  },

  // Sensor Card (Gauge) Redesigned
  sensorMainCard: {
    backgroundColor: '#0f172a',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  sensorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  sensorCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7BBDE8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sensorCardSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  onlineBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Custom Gauge Redesign
  gaugeContainerOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 20,
  },
  gaugeGlassContainer: {
    width: 110,
    height: 280,
    position: 'relative',
    borderRadius: 55,
    backgroundColor: '#020617',
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  gaugeCapsule: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 50,
    overflow: 'hidden',
    position: 'relative',
  },
  gaugeLevelMark: {
    position: 'absolute',
    left: -35,
    width: 30,
    alignItems: 'flex-end',
    zIndex: 15,
  },
  gaugeMarkText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
  },
  gaugeLevelDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
  },
  gaugeGlassReflection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.05)',
    pointerEvents: 'none',
  },
  gaugeGlassShine: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 30,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    transform: [{ skewX: '-10deg' }],
    pointerEvents: 'none',
  },

  readingContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  gaugeReading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  gaugeReadingValue: {
    fontSize: 64,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -2,
  },
  gaugeReadingUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: '#74C5E6',
    marginLeft: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  statusChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusChipText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  sensorCardFooter: {
    flexDirection: 'column',
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  footerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thresholdText: {
    fontSize: 13,
    color: '#64748b',
  },
  thresholdTextBold: {
    fontWeight: '700',
    color: '#94a3b8',
  },
  sensorIdText: {
    fontSize: 11,
    color: 'rgba(100, 116, 139, 0.6)',
    fontWeight: '600',
    marginTop: 4,
  },

  // Welcome Alert Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeAlertCard: {
    width: '90%',
    backgroundColor: '#0f172a',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  welcomeAlertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 24,
    padding: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  welcomeAlertIconGradient: {
    flex: 1,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeAlertTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeAlertGreeting: {
    fontSize: 18,
    fontWeight: '600',
    color: '#74C5E6',
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeAlertMessage: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  welcomeAlertButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  welcomeAlertButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  welcomeAlertButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Logout Alert specific styles
  logoutAlertCard: {
    width: '90%',
    backgroundColor: '#0f172a',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  logoutAlertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 24,
    padding: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoutButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  logoutActionButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalOverlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  editProfileCard: {
    width: '95%',
    backgroundColor: theme.surface,
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  editProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  editProfileTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.textPrimary,
  },
  editProfileAvatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  editProfileAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 3,
    borderColor: theme.primary,
  },
  editProfileAvatarInitial: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
  },
  editProfileAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileCameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.surface,
  },
  editProfileAvatarLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 8,
    fontWeight: '600',
  },
  editProfileForm: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.badgeBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: theme.border,
  },
  textInput: {
    flex: 1,
    marginLeft: 12,
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  profileSaveButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  profileSaveButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
