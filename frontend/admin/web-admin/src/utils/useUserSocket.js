/**
 * useUserSocket.js
 * Listens for "user_update" events from the backend to refresh the user list.
 */
import { useEffect, useRef } from "react";
import { API_BASE_URL } from "../config/api";

const WS_URL = API_BASE_URL;

export default function useUserSocket(onUpdate) {
  const socketRef = useRef(null);
  const callbackRef = useRef(onUpdate);

  // Update effect for callback to always have the latest version without triggering socket re-init
  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let socket = null;
    let destroyed = false;

    const connect = () => {
      import("socket.io-client")
        .then(({ io }) => {
          if (destroyed) return;
          socket = io(WS_URL, {
            transports: ["websocket", "polling"],
          });

          socketRef.current = socket;

          socket.on("user_update", (data) => {
            if (callbackRef.current) callbackRef.current(data);
          });
        })
        .catch(() => {
          // Fallback or silent fail
        });
    };

    connect();

    return () => {
      destroyed = true;
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, []);
}
