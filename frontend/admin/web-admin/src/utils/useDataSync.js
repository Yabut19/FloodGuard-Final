import { useEffect, useRef } from "react";
import { getSocket } from "./socketManager";

/**
 * useDataSync Hook
 * Unified hook to listen for various real-time update events from the backend.
 * Uses a singleton WebSocket connection to prevent flickering/glitching during page navigation.
 * 
 * @param {Object} callbacks - Map of event names to callback functions
 */
export default function useDataSync(callbacks = {}) {
  // Get or initialize the singleton socket
  const globalSocket = getSocket();

  // Keep callback refs stable to avoid re-initializing listeners on every render
  const handlers = useRef(callbacks);
  useEffect(() => {
    handlers.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!globalSocket) return;

    // Define wrapper functions that call the current handlers from refs
    // This allows handlers to change without re-binding listeners
    const onSensorUpdate = (data) => handlers.current.onSensorUpdate?.(data);
    const onUserUpdate = (data) => handlers.current.onUserUpdate?.(data);
    const onReportUpdate = (data) => handlers.current.onReportUpdate?.(data);
    const onAlertUpdate = (data) => handlers.current.onAlertUpdate?.(data);
    const onEvacuationUpdate = (data) => handlers.current.onEvacuationUpdate?.(data);
    const onThresholdUpdate = (data) => handlers.current.onThresholdUpdate?.(data);
    const onNewNotification = (data) => handlers.current.onNewNotification?.(data);
    const onSensorListUpdate = (data) => handlers.current.onSensorListUpdate?.(data);

    // Attach listeners
    globalSocket.on("sensor_update", onSensorUpdate);
    globalSocket.on("user_update", onUserUpdate);
    globalSocket.on("report_update", onReportUpdate);
    globalSocket.on("alert_update", onAlertUpdate);
    globalSocket.on("evacuation_update", onEvacuationUpdate);
    globalSocket.on("threshold_update", onThresholdUpdate);
    globalSocket.on("new_notification", onNewNotification);
    globalSocket.on("sensor_list_update", onSensorListUpdate);

    return () => {
      // Detach listeners on unmount to prevent memory leaks and multiple triggers
      globalSocket.off("sensor_update", onSensorUpdate);
      globalSocket.off("user_update", onUserUpdate);
      globalSocket.off("report_update", onReportUpdate);
      globalSocket.off("alert_update", onAlertUpdate);
      globalSocket.off("evacuation_update", onEvacuationUpdate);
      globalSocket.off("threshold_update", onThresholdUpdate);
      globalSocket.off("new_notification", onNewNotification);
      globalSocket.off("sensor_list_update", onSensorListUpdate);
    };
  }, []);

  return globalSocket;
}

