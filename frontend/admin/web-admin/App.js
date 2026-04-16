import React, { useState, useEffect } from "react";
import { View, Platform, ActivityIndicator, Text } from "react-native";
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
import LoadingOverlay from "./src/components/LoadingOverlay";

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("lgu"); // "lgu" or "superadmin"

  const [activePage, setActivePage] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [publicPage, setPublicPage] = useState("home");
  const [openLogin, setOpenLogin] = useState(false);

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
      const token = localStorage.getItem("authToken");
      const savedRole = localStorage.getItem("userRole"); // "super_admin" or "lgu_admin"

      if (token && savedRole) {
        setIsLoggedIn(true);
        document.body.style.backgroundColor = token ? "#ECFAE5" : "#001D39";
        const roleStr = savedRole === "super_admin" ? "superadmin" : "lgu";
        setUserRole(roleStr);

        const savedPage = localStorage.getItem("activePage");
        if (savedPage) {
          setActivePage(savedPage);
        }
      }
    }
  }, []);

  const handleLoginSuccess = (role) => {
    setIsLoggedIn(true);
    setUserRole(role === "admin" ? "superadmin" : "lgu");
    setActivePage("overview");
    if (Platform.OS === "web") {
      localStorage.setItem("activePage", "overview");
    }
  };

  const handleLogout = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoggedIn(false);
      setUserRole("lgu");
      setActivePage("overview");
      if (Platform.OS === "web") {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userRole");
        localStorage.removeItem("activePage");
        sessionStorage.removeItem("welcomeBannerShown");
        document.body.style.backgroundColor = "#001D39";
      }
      setIsLoading(false);
    }, 1500);
  };

  const handleNavigate = (page) => {
    setActivePage(page);
    if (Platform.OS === "web") {
      localStorage.setItem("activePage", page);
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

  if (!fontsLoaded) {
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

  return (
    <View style={styles.root}>
      {renderPage()}
      {isLoading && <LoadingOverlay message="Logging Out..." accentColor="#ef4444" />}
    </View>
  );
}