import { io, Socket } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

let socket: Socket | null = null;
let isInitializing = false;
let connectionTimeout: NodeJS.Timeout | null = null;
let connectionErrorCount = 0;

export function initializeSocket(token: string): Socket | null {
  // Only initialize on client side
  if (typeof window === "undefined") {
    return null;
  }

  // If socket is already connected with the same token, return it
  if (socket?.connected) {
    const currentToken = (socket.auth as any)?.token;
    if (currentToken === token) {
      return socket;
    }
    // Token changed, need to reconnect
    disconnectSocket();
  }

  // Prevent multiple simultaneous initializations
  if (isInitializing && socket && !socket.connected) {
    return socket;
  }

  // If socket exists but not connected, disconnect it first
  if (socket && !socket.connected) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch (e) {
      // Ignore errors
    }
    socket = null;
  }

  if (!token) {
    console.warn("Cannot initialize socket: No token provided");
    return null;
  }

  isInitializing = true;

  try {
    // Clear any existing timeout
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }

    socket = io(API_BASE, {
      transports: ["websocket", "polling"], // Prefer websocket, fallback to polling
      upgrade: true,
      rememberUpgrade: true,
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 3, // Reduced attempts
      timeout: 10000, // Increased timeout
      forceNew: false,
      autoConnect: true,
    });

    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      if (socket && !socket.connected) {
        console.warn("Socket connection timeout, disabling reconnection");
        socket.disconnect();
        isInitializing = false;
      }
    }, 15000);

    // Set up error handlers immediately to catch all errors
    socket.on("connect", () => {
      isInitializing = false;
      connectionErrorCount = 0; // Reset error count on successful connection
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      console.log("✅ Socket.IO connected (Admin)");
    });

    socket.on("disconnect", (reason) => {
      isInitializing = false;
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      // Don't auto-reconnect if server disconnected us or we manually disconnected
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        console.log("Socket.IO disconnected (Admin):", reason);
        connectionErrorCount = 0; // Reset on manual disconnect
        return;
      }
      // For other disconnects, let reconnection handle it (but limit attempts)
    });

    // Handle connection errors - stop retrying after too many failures
    socket.on("connect_error", (error) => {
      connectionErrorCount++;
      isInitializing = false;
      
      // After 3 failed attempts, stop trying
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
      
      // Only log in production
      if (process.env.NODE_ENV === "production") {
        console.warn(`Socket.IO connection error (Admin) [${connectionErrorCount}/3]:`, error.message);
      }
    });

    // Handle WebSocket transport errors - catch at the manager level
    const manager = socket.io;
    if (manager) {
      manager.on("error", (error: any) => {
        // Suppress WebSocket transport errors
        // These are expected when backend is not available
        if (process.env.NODE_ENV === "production") {
          console.error("Socket.IO transport error (Admin):", error?.message || error);
        }
        // Silently handle in development - prevent runtime errors
      });

      // Catch engine errors if engine exists
      if (manager.engine) {
        manager.engine.on("error", (error: any) => {
          // Suppress engine-level WebSocket errors
          if (process.env.NODE_ENV === "production") {
            console.error("Socket.IO engine error (Admin):", error?.message || error);
          }
          // Silently handle in development
        });
      }
    }

    // Suppress all errors from bubbling up as runtime errors
    socket.on("error", (error: any) => {
      // Catch-all error handler for any unhandled socket errors
      if (process.env.NODE_ENV === "production") {
        console.error("Socket.IO error (Admin):", error?.message || error);
      }
      // Silently handle in development
    });

    return socket;
  } catch (error) {
    // Catch any initialization errors
    console.warn("Failed to initialize Socket.IO:", error);
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

// Re-authenticate socket with a new token
export function reauthenticateSocket(newToken: string): Socket | null {
  // Disconnect existing socket
  if (socket) {
    disconnectSocket();
  }

  // Initialize with new token
  return initializeSocket(newToken);
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

