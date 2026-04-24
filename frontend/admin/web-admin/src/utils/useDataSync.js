import { useEffect, useRef } from "react";
import { API_BASE_URL } from "../config/api";
import { io } from "socket.io-client";

/**
 * useDataSync Hook
 * Unified hook to listen for various real-time update events from the backend.
 * 
 * @param {Object} callbacks - Map of event names to callback functions
 * Example: { onSensorUpdate: (data) => {}, onUserUpdate: () => {}, ... }
 */
export default function useDataSync(callbacks = {}) {
  const socketRef = useRef(null);

  // Keep callback refs stable to avoid re-initializing socket on every render
  const handlers = useRef(callbacks);
  useEffect(() => {
    handlers.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      reconnectionAttempts: 10
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[DataSync] Connected to WebSocket");
    });
    socket.on("connect_error", (err) => {
      console.error("[DataSync] Connection error:", err.message);
    });

    // 🌡️ Live Sensor Reading Updates
    socket.on("sensor_update", (data) => {
      if (handlers.current.onSensorUpdate) handlers.current.onSensorUpdate(data);
    });

    // 👥 User Management Updates
    socket.on("user_update", (data) => {
      if (handlers.current.onUserUpdate) handlers.current.onUserUpdate(data);
    });

    // 📋 Community Report Updates
    socket.on("report_update", (data) => {
      if (handlers.current.onReportUpdate) handlers.current.onReportUpdate(data);
    });

    // 🚨 Official Alert Updates
    socket.on("alert_update", (data) => {
      if (handlers.current.onAlertUpdate) handlers.current.onAlertUpdate(data);
    });

    // 🏠 Evacuation Center Updates
    socket.on("evacuation_update", (data) => {
      if (handlers.current.onEvacuationUpdate) handlers.current.onEvacuationUpdate(data);
    });

    // ⚙️ Threshold Configuration Updates
    socket.on("threshold_update", (data) => {
      if (handlers.current.onThresholdUpdate) handlers.current.onThresholdUpdate(data);
    });

    // 🔔 Generic Notifications
    socket.on("new_notification", (data) => {
      if (handlers.current.onNewNotification) handlers.current.onNewNotification(data);
    });

    socket.on("disconnect", () => {
      console.log("[DataSync] Disconnected from WebSocket");
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return socketRef.current;
}
