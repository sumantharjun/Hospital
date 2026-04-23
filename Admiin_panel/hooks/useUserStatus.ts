import { useState, useEffect, useCallback } from "react";
import { getSocket, onSocketEvent, offSocketEvent } from "../services/socket";

interface UserStatus {
  [userId: string]: boolean; // true = online, false = offline
}

/**
 * Hook to track real-time online/offline status of users
 * Listens to socket events for user login/logout
 */
export function useUserStatus(userIds: string[] = []) {
  const [statuses, setStatuses] = useState<UserStatus>({});
  const [allOnlineUsers, setAllOnlineUsers] = useState<Set<string>>(new Set());

  // Fetch initial online users
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        // No token - user not logged in, silently return
        return;
      }

      let res: Response | null = null;
      try {
        res = await fetch(`${API_BASE}/api/users/online-status`, {
          headers: { Authorization: `Bearer ${token}` },
          method: "GET",
        });
      } catch (fetchError: any) {
        // Network error - backend might be down or not reachable
        // Silently fail - this is expected if backend is starting up
        if (process.env.NODE_ENV === "development") {
          console.warn("Could not fetch online status (backend may be starting):", fetchError.message);
        }
        return;
      }

      if (!res) {
        // Network error - backend might be down, silently fail
        return;
      }

      if (res.ok) {
        try {
          const data = await res.json();
          const onlineUsers = Array.isArray(data.onlineUsers) ? data.onlineUsers : [];
          const onlineSet = new Set<string>(onlineUsers.filter((id: any): id is string => typeof id === 'string'));
          if (process.env.NODE_ENV === "development") {
            console.log("Fetched online users from API:", Array.from(onlineSet), "Total:", onlineSet.size);
          }
          setAllOnlineUsers(onlineSet);

          // Update statuses for provided userIds
          if (userIds.length > 0) {
            const newStatuses: UserStatus = {};
            userIds.forEach((id) => {
              newStatuses[id] = onlineSet.has(id);
            });
            if (process.env.NODE_ENV === "development") {
              console.log("Updated statuses for", userIds.length, "users:", newStatuses);
            }
            setStatuses(newStatuses);
          }
        } catch (jsonError) {
          // JSON parse error - silently fail
          if (process.env.NODE_ENV === "development") {
            console.warn("Failed to parse online status response:", jsonError);
          }
        }
      } else {
        // HTTP error - log in development only
        if (process.env.NODE_ENV === "development") {
          try {
            const errorText = await res.text();
            console.warn("Failed to fetch online status. Status:", res.status, "Error:", errorText);
          } catch {
            console.warn("Failed to fetch online status. Status:", res.status);
          }
        }
      }
    } catch (error: any) {
      // Catch any unexpected errors - silently handle
      // Backend might be starting up or temporarily unavailable
      if (process.env.NODE_ENV === "development") {
        console.warn("Error in fetchOnlineUsers (this is usually safe to ignore):", error?.message || error);
      }
    }
  }, [userIds]);

  useEffect(() => {
    // Initialize socket if not already initialized
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      // Socket is already initialized in _app.tsx, no need to initialize again
    }

    // Fetch initial status ONCE on mount (only if socket is not available)
    // We rely primarily on socket events for real-time updates
    // Only fetch if socket is not connected after a short delay
    let initialFetchTimeout: NodeJS.Timeout | null = null;
    const attemptInitialFetch = () => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        // Socket not ready, try to fetch initial status
        Promise.resolve().then(() => fetchOnlineUsers()).catch(() => {
          // Silently ignore - backend might not be ready
        });
      }
      // If socket is connected, we'll get updates via socket events
    };
    
    // Try initial fetch after a short delay (socket might connect first)
    initialFetchTimeout = setTimeout(() => {
      attemptInitialFetch();
    }, 2000); // Wait 2 seconds for socket to connect first

    // NO POLLING - We rely entirely on socket events for real-time updates

    // Define event handlers
    const handleUserOnline = (data: { userId: string }) => {
      if (process.env.NODE_ENV === "development") {
        console.log("Received user:online event for userId:", data.userId);
      }
      const userId = data.userId;
      if (!userId) return;
      
      setAllOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.add(userId);
        return newSet;
      });

      if (userIds.includes(userId)) {
        setStatuses((prev) => ({
          ...prev,
          [userId]: true,
        }));
      }
    };

    const handleUserOffline = (data: { userId: string }) => {
      if (process.env.NODE_ENV === "development") {
        console.log("Received user:offline event for userId:", data.userId);
      }
      const userId = data.userId;
      if (!userId) return;
      
      setAllOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });

      if (userIds.includes(userId)) {
        setStatuses((prev) => ({
          ...prev,
          [userId]: false,
        }));
      }
    };

    const handleStatusUpdate = (data: { onlineUsers: string[] }) => {
      const onlineUsers = Array.isArray(data.onlineUsers) ? data.onlineUsers : [];
      const onlineSet = new Set<string>(onlineUsers.filter((id: any): id is string => typeof id === 'string'));
      setAllOnlineUsers(onlineSet);

      if (userIds.length > 0) {
        const newStatuses: UserStatus = {};
        userIds.forEach((id) => {
          newStatuses[id] = onlineSet.has(id);
        });
        setStatuses(newStatuses);
      }
    };

    // Set up socket listeners immediately if socket exists, otherwise wait
    let socketCheckInterval: NodeJS.Timeout | null = null;
    const setupSocketListeners = () => {
      const socket = getSocket();
      if (socket) {
        console.log("Socket found, setting up listeners. Connected:", socket.connected);
        if (socketCheckInterval) {
          clearInterval(socketCheckInterval);
          socketCheckInterval = null;
        }
        
        // Listen to socket events
        onSocketEvent("user:online", handleUserOnline);
        onSocketEvent("user:offline", handleUserOffline);
        onSocketEvent("users:status", handleStatusUpdate);
        
        // Also listen on socket directly as backup
        socket.on("user:online", handleUserOnline);
        socket.on("user:offline", handleUserOffline);
        socket.on("users:status", handleStatusUpdate);
        
        return true;
      }
      return false;
    };
    
    // Try to set up listeners immediately
    if (!setupSocketListeners()) {
      // If socket not ready, check periodically
      socketCheckInterval = setInterval(() => {
        if (setupSocketListeners()) {
          // Successfully set up, interval will be cleared in setupSocketListeners
        }
      }, 500);
    }

    // Cleanup
    return () => {
      if (initialFetchTimeout) {
        clearTimeout(initialFetchTimeout);
      }
      if (socketCheckInterval) {
        clearInterval(socketCheckInterval);
      }
      offSocketEvent("user:online", handleUserOnline);
      offSocketEvent("user:offline", handleUserOffline);
      offSocketEvent("users:status", handleStatusUpdate);
      
      // Also remove direct socket listeners
      const socket = getSocket();
      if (socket) {
        socket.off("user:online", handleUserOnline);
        socket.off("user:offline", handleUserOffline);
        socket.off("users:status", handleStatusUpdate);
      }
    };
  }, [userIds, fetchOnlineUsers]);

  // Get status for a specific user
  const getStatus = useCallback(
    (userId: string): boolean => {
      if (!userId) return false;
      
      // Check in statuses first (for tracked userIds)
      if (userIds.length > 0 && userIds.includes(userId)) {
        return statuses[userId] ?? false;
      }
      
      // Fallback to allOnlineUsers
      return allOnlineUsers.has(userId);
    },
    [userIds, statuses, allOnlineUsers]
  );

  return {
    statuses,
    allOnlineUsers,
    getStatus,
    refreshStatus: fetchOnlineUsers,
  };
}
