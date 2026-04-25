import { io } from "socket.io-client";
import { API_BASE_URL } from "../config/api";

// Singleton socket instance to maintain connection across navigation
let globalSocket = null;

/**
 * getSocket
 * Returns the current socket instance or creates a new one if it doesn't exist.
 */
export const getSocket = () => {
  if (!globalSocket && typeof window !== "undefined") {
    console.log("[SocketManager] Creating new persistent socket connection...");
    globalSocket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      reconnectionAttempts: 10
    });
    
    globalSocket.on("connect", () => {
      console.log("[SocketManager] Persistent WebSocket Connected");
    });
    
    globalSocket.on("disconnect", (reason) => {
      console.log("[SocketManager] Persistent WebSocket Disconnected:", reason);
    });
  }
  return globalSocket;
};

/**
 * disconnectSocket
 * Manually disconnects and nullifies the global socket instance.
 * Useful during logout to ensure a fresh connection on the next login.
 */
export const disconnectSocket = () => {
  if (globalSocket) {
    console.log("[SocketManager] Manually disconnecting socket...");
    globalSocket.disconnect();
    globalSocket = null;
  }
};
