"use client";

import { io, Socket } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

let socket: Socket | null = null;
let isInitializing = false;
let connectionTimeout: NodeJS.Timeout | null = null;
let connectionErrorCount = 0;

export function initializeSocket(token: string): Socket | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!token) {
    console.warn("Cannot initialize socket: No token provided");
    return null;
  }

  if (socket?.connected) {
    const currentToken = (socket.auth as any)?.token;
    if (currentToken === token) {
      return socket;
    }
    disconnectSocket();
  }

  if (isInitializing && socket && !socket.connected) {
    return socket;
  }

  if (socket && !socket.connected) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch (e) {
      // Ignore errors
    }
    socket = null;
  }

  if (!API_BASE) {
    console.warn("Cannot initialize socket: API_BASE is not configured");
    isInitializing = false;
    return null;
  }

  isInitializing = true;

  try {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }

    socket = io(API_BASE, {
      transports: ["websocket", "polling"],
      upgrade: true,
      rememberUpgrade: true,
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 3,
      timeout: 10000,
      forceNew: false,
      autoConnect: true,
    });

    connectionTimeout = setTimeout(() => {
      if (socket && !socket.connected) {
        console.warn("Socket connection timeout, disabling reconnection");
        socket.disconnect();
        isInitializing = false;
      }
    }, 15000);

    socket.on("connect", () => {
      isInitializing = false;
      connectionErrorCount = 0;
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      console.log("✅ Socket.IO connected (Patient)");
    });

    socket.on("disconnect", (reason) => {
      isInitializing = false;
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        console.log("Socket.IO disconnected (Patient):", reason);
        connectionErrorCount = 0;
        return;
      }
    });

    socket.on("connect_error", (error) => {
      connectionErrorCount++;
      isInitializing = false;
      
      if (connectionErrorCount >= 3) {
        console.warn("Socket.IO: Too many connection errors, stopping reconnection attempts");
        if (socket) {
          socket.disconnect();
          socket = null;
        }
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        return;
      }
      
      if (process.env.NODE_ENV === "production") {
        console.warn(`Socket.IO connection error (Patient) [${connectionErrorCount}/3]:`, error.message);
      }
    });

    socket.on("error", (error) => {
      if (process.env.NODE_ENV === "production") {
        console.error("Socket.IO error (Patient):", error);
      }
    });

    return socket;
  } catch (error) {
    console.error("Failed to initialize socket:", error);
    isInitializing = false;
    return null;
  }
}

export function disconnectSocket() {
  if (typeof window === "undefined") {
    return;
  }

  isInitializing = false;
  connectionErrorCount = 0;
  
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }

  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch (error) {
      // Ignore errors during disconnect
    } finally {
      socket = null;
    }
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// Event listeners helper
export function onSocketEvent(event: string, callback: (data: any) => void) {
  if (socket) {
    socket.on(event, callback);
  }
}

export function offSocketEvent(event: string, callback?: (data: any) => void) {
  if (socket) {
    if (callback) {
      socket.off(event, callback);
    } else {
      socket.off(event);
    }
  }
}


