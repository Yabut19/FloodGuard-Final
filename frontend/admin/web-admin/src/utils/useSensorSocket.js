import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { io } from "socket.io-client";

export default function useSensorSocket(onUpdate, onThresholdUpdate) {
  const callbackRef = useRef(onUpdate);
  const thresholdCallbackRef = useRef(onThresholdUpdate);
  const [connected, setConnected] = useState(false);

  // Keep refs up to date without re-running useEffect
  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    thresholdCallbackRef.current = onThresholdUpdate;
  }, [onThresholdUpdate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // DIRECT CONNECTION AS REQUESTED
    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // 🖥️ NO REFRESH LOGIC
    socket.on("sensor_update", (data) => {
      console.log("LIVE DATA:", data);
      if (callbackRef.current) {
          callbackRef.current(data); // This acts as updateUI()
      }
    });

    socket.on("threshold_update", (data) => {
      console.log("THRESHOLD UPDATE:", data);
      if (thresholdCallbackRef.current) {
        thresholdCallbackRef.current(data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return connected;
}
