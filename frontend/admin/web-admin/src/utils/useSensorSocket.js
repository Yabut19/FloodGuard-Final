import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { io } from "socket.io-client";

export default function useSensorSocket(onUpdate) {
  const callbackRef = useRef(onUpdate);
  const [connected, setConnected] = useState(false);

  // Keep callbackRef up to date without re-running useEffect
  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

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

    return () => {
      socket.disconnect();
    };
  }, []);

  return connected;
}
