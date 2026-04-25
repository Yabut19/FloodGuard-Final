import React, { useState, useEffect } from "react";
import { View, Platform, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold
} from "@expo-google-fonts/poppins";
import { styles } from "./src/styles/globalStyles";
import LandingPage from "./src/screens/LandingPage";
import AdminDashboard from "./src/screens/AdminDashboard";
import SuperAdminDashboard from "./src/screens/SuperAdminDashboard";
import SensorMapPage from "./src/screens/SensorMapPage";
import AlertManagementPage from "./src/screens/AlertManagementPage";
import VerifyAlertsPage from "./src/screens/VerifyAlertsPage";
import DataReportsPage from "./src/screens/DataReportsPage";
import UserManagementPage from "./src/screens/UserManagementPage";
import EvacuationManagementPage from "./src/screens/EvacuationManagementPage";
import ThresholdConfigPage from "./src/screens/ThresholdConfigPage";
import ManageSensorsPage from "./src/screens/SensorRegistrationPage";
import AdminSidebar from "./src/components/AdminSidebar";
import LoadingOverlay from "./src/components/LoadingOverlay";

import { disconnectSocket } from "./src/utils/socketManager";

export default function App() {

  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Handle font loading error - fallback to system fonts
  if (fontError) {
    console.warn("Font loading error, falling back to system fonts:", fontError);
  }

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("lgu"); // "lgu" or "superadmin"

  const [activePage, setActivePage] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [publicPage, setPublicPage] = useState("home");
  const [openLogin, setOpenLogin] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  const handleError = (error, errorInfo) => {
    console.error('Application Error:', error, errorInfo);
    setHasError(true);
    setError(error);
  };

  const getInitialBgColor = () => {
    if (Platform.OS === "web") {
      try {
        return localStorage.getItem("authToken") ? "#ECFAE5" : "#001D39";
      } catch (e) { }
    }
    return "#001D39";
  };

  useEffect(() => {
    if (Platform.OS === "web") {
      try {
        const token = localStorage.getItem("authToken");
        const savedRole = localStorage.getItem("userRole"); // "super_admin" or "lgu_admin"

        if (token && savedRole) {
          setIsLoggedIn(true);
          if (document && document.body) {
            document.body.style.backgroundColor = token ? "#ECFAE5" : "#001D39";
          }
          const roleStr = (savedRole === "super_admin" || savedRole === "admin") ? "superadmin" : "lgu";
          setUserRole(roleStr);

          const savedPage = localStorage.getItem("activePage");
          if (savedPage) {
            setActivePage(savedPage);
          }
        }
      } catch (error) {
        console.warn("Error accessing localStorage:", error);
        // Continue with default state if localStorage fails
      }
    }
  }, []);

  const handleLoginSuccess = (role) => {
    setIsLoggedIn(true);
    setUserRole((role === "admin" || role === "super_admin") ? "superadmin" : "lgu");
    setActivePage("overview");
    if (Platform.OS === "web") {
      try {
        localStorage.setItem("activePage", "overview");
      } catch (error) {
        console.warn("Error setting localStorage on login:", error);
      }
    }
  };

  const handleLogout = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoggedIn(false);
      setUserRole("lgu");
      setActivePage("overview");
      if (Platform.OS === "web") {
        try {
          localStorage.removeItem("authToken");
          localStorage.removeItem("userRole");
          localStorage.removeItem("activePage");
          sessionStorage.removeItem("welcomeBannerShown");
          if (document && document.body) {
            document.body.style.backgroundColor = "#001D39";
          }
          // Reset real-time socket connection to prevent delays on next login
          disconnectSocket();
        } catch (error) {

          console.warn("Error clearing localStorage on logout:", error);
        }
      }
      setIsLoading(false);
    }, 1500);
  };

  const handleNavigate = (page) => {
    setActivePage(page);
    if (Platform.OS === "web") {
      try {
        localStorage.setItem("activePage", page);
      } catch (error) {
        console.warn("Error setting localStorage on navigate:", error);
      }
    }
  };

  const getCurrentUser = () => {
    if (Platform.OS === "web") {
      try {
        return {
          email: localStorage.getItem("userEmail") || "",
          username: localStorage.getItem("userName") || "",
          role: localStorage.getItem("userRole") || ""
        };
      } catch (e) {
        return { email: "", username: "", role: "" };
      }
    }
    return { email: "", username: "", role: "" };
  };

  // Add timeout for font loading to prevent infinite loading
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fontsLoaded && !fontError) {
        console.warn("Font loading timeout - proceeding with fallback fonts");
        setFontTimeout(true);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !fontTimeout) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4a7c59" />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <LandingPage
        onLoginSuccess={handleLoginSuccess}
        onNavigatePublic={setPublicPage}
        initialLoginOpen={openLogin}
        resetInitialLogin={() => setOpenLogin(false)}
      />
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case "overview":
        return userRole === "superadmin" ? (
          <SuperAdminDashboard onNavigate={handleNavigate} onLogout={handleLogout} activePage="overview" />
        ) : (
          <AdminDashboard onNavigate={handleNavigate} onLogout={handleLogout} userRole={userRole} />
        );
      case "sensor-map":
        return <SensorMapPage onNavigate={handleNavigate} onLogout={handleLogout} userRole={userRole} />;
      case "sensor-registration":
        return <ManageSensorsPage onNavigate={handleNavigate} onLogout={handleLogout} userRole={userRole} />;
      case "alert-management":
        return <AlertManagementPage onNavigate={handleNavigate} onLogout={handleLogout} userRole={userRole} />;
      case "verify-alerts":
        return <VerifyAlertsPage onNavigate={handleNavigate} onLogout={handleLogout} userRole={userRole} currentUser={getCurrentUser()} />;
      case "user-management":
        return <UserManagementPage onNavigate={handleNavigate} onLogout={handleLogout} userRole={userRole} />;
      case "threshold-config":
        return <ThresholdConfigPage onNavigate={handleNavigate} onLogout={handleLogout} userRole={userRole} />;
      case "data-reports":
        return <DataReportsPage onNavigate={handleNavigate} onLogout={handleLogout} userRole={userRole} />;
      case "evacuation-management":
        return <EvacuationManagementPage onNavigate={handleNavigate} onLogout={handleLogout} userRole={userRole} />;
      default:
        if (userRole === "superadmin") {
          return <SuperAdminDashboard onNavigate={handleNavigate} onLogout={handleLogout} activePage={activePage} />;
        }
        return <AdminDashboard onNavigate={handleNavigate} onLogout={handleLogout} />;
    }
  };


  if (hasError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626', marginBottom: 16 }}>
          Application Error
        </Text>
        <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 }}>
          Something went wrong. Please refresh the page.
        </Text>
        <TouchableOpacity 
          onPress={() => window.location.reload()}
          style={{ backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  try {
    return (
      <View style={styles.root}>
        <View style={styles.dashboardRoot}>
          {/* Persistent Sidebar for improved navigation liveliness */}
          <AdminSidebar 
            activePage={activePage} 
            onNavigate={handleNavigate} 
            onLogout={handleLogout} 
            variant={userRole} 
          />
          {renderPage()}
        </View>
        {isLoading && <LoadingOverlay message="Logging Out..." accentColor="#ef4444" />}
      </View>
    );
  } catch (error) {
    handleError(error);
    return null;
  }
}