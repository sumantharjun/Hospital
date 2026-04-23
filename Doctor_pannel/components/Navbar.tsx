"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { apiGet, apiPatch } from "@/lib/api";
import { getSocket, disconnectSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";

interface NavbarProps {
  user?: {
    name?: string;
    email?: string;
    role?: string;
    specialization?: string;
  } | null;
  onMenuToggle?: () => void;
}

export default function Navbar({ user, onMenuToggle }: NavbarProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Check if user is logged in before fetching notifications
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setNotificationCount(0);
      return;
    }

    const fetchNotificationCount = async () => {
      try {
        const notifications = await apiGet<any[]>("/api/notifications/my");
        const unreadCount = Array.isArray(notifications)
          ? notifications.filter((n) => n.status !== "READ").length
          : 0;
        setNotificationCount(unreadCount);
      } catch (error: any) {
        // Silently handle errors - don't show error if backend is not available
        // Network errors are expected if backend is down
        const isNetworkError = 
          error.message?.includes("Network error") || 
          error.message?.includes("Failed to fetch") ||
          error.name === "TypeError";
        
        if (!isNetworkError) {
          console.error("Error fetching notifications:", error);
        }
        // Set count to 0 on error (don't show badge if we can't fetch)
        setNotificationCount(0);
      }
    };

    // Only fetch if we have a token
    fetchNotificationCount();

    // Listen for new notifications
    const socket = getSocket();
    if (socket) {
      const handleNewNotification = (data?: any) => {
        // For message:created, check if it's not from current user
        if (data && data.message) {
          const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
          if (storedUser) {
            const currentUser = JSON.parse(storedUser);
            const userId = currentUser.id || currentUser._id;
            if (data.message.senderId === userId) {
              return; // Don't show notification for own messages
            }
          }
        }
        // Only refetch if we have a token
        const currentToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (currentToken) {
          fetchNotificationCount();
        }
      };

      onSocketEvent("notification:new", handleNewNotification);
      onSocketEvent("appointment:created", handleNewNotification);
      onSocketEvent("message:created", handleNewNotification);
      
      return () => {
        offSocketEvent("notification:new", handleNewNotification);
        offSocketEvent("appointment:created", handleNewNotification);
        offSocketEvent("message:created", handleNewNotification);
      };
    }
  }, []);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      // Get user ID before clearing localStorage
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?.id || user?._id;
      const token = localStorage.getItem("token");
      
      // Register user as offline with backend and update status before logout
      if (userId && token) {
        try {
          const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
          
          // Register user as offline with backend (tracks logout time)
          await fetch(`${API_BASE}/api/users/${userId}/offline`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
          
          // Update status to OFFLINE in database
          await apiPatch(`/api/users/${userId}`, { status: "OFFLINE" });
          
          // Emit offline event via socket
          const socket = getSocket();
          if (socket && socket.connected) {
            socket.emit("user:offline", { userId });
          }
        } catch (error) {
          console.error("Error updating status on logout:", error);
        }
      }
      
      // Disconnect socket
      disconnectSocket();
      
      // Clear localStorage and redirect
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.replace("/");
    }
  };

  const getUserInitials = () => {
    if (!user?.name) return "D";
    const names = user.name.trim().split(" ").filter(n => n.length > 0);
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    if (names.length === 1 && names[0].length >= 2) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return names[0]?.[0]?.toUpperCase() || "D";
  };

  return (
    <nav className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 lg:h-20">
          {/* Left side - Hamburger menu and title */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {/* Hamburger menu button - visible only on mobile */}
            {onMenuToggle && (
              <button
                onClick={onMenuToggle}
                className="lg:hidden p-2 rounded-lg bg-blue-900 text-white shadow-sm hover:bg-blue-800 transition-colors flex-shrink-0"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            {user?.name && (
              <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                Dr. {user.name}
              </h1>
            )}
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Notifications with count */}
            <Link
              href="/news"
              className="relative p-1.5 sm:p-2 rounded-lg text-yellow-500 hover:bg-yellow-50 transition-colors"
              aria-label="Notifications"
            >
              <svg 
                className="w-5 h-5 sm:w-6 sm:h-6" 
                fill="currentColor" 
                viewBox="0 0 20 20" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 h-4 w-4 sm:h-5 sm:w-5 bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10 rounded-full bg-blue-900 flex items-center justify-center text-white text-xs font-bold shadow-md flex-shrink-0">
                  <span className="leading-none">{getUserInitials()}</span>
                </div>
                <div className="hidden md:block text-left min-w-0">
                  <div className="text-sm font-bold text-gray-900 leading-[100%] truncate max-w-[120px]">
                    {user?.name || "Doctor"}
                  </div>
                  <div className="text-xs text-gray-500 leading-[100%] truncate max-w-[120px]">
                    {user?.email || ""}
                  </div>
                </div>
                <svg 
                  className="hidden sm:block w-4 h-4 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 sm:w-64 rounded-lg bg-white border border-gray-200 shadow-lg z-20 max-w-[calc(100vw-2rem)]">
                    <div className="p-4 border-b border-gray-200">
                      <div className="text-sm font-semibold text-gray-900 leading-[100%]">
                        {user?.name || "Doctor"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 leading-[100%]">
                        {user?.email || ""}
                      </div>
                      {user?.specialization && (
                        <div className="text-xs text-blue-900 mt-1 font-medium leading-[100%]">
                          {user.specialization}
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <Link
                        href="/dashboard"
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors block"
                      >
                        📊 Dashboard
                      </Link>
                      <Link
                        href="/schedule"
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors block"
                      >
                        ⏰ Schedule
                      </Link>
                      <Link
                        href="/settings/mfa"
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors block"
                      >
                        ⚙️ Settings
                      </Link>
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-700 hover:bg-red-50 transition-colors mt-2"
                      >
                        🚪 Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
