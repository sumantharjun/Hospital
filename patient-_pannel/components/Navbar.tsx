"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { NewsIcon, DashboardIcon, MenuIcon, RecordsIcon } from "./icons";
import { apiGet } from "@/lib/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";

interface NavbarProps {
  user?: {
    id?: string;
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
  onMenuToggle?: () => void;
}

export default function Navbar({ user, onMenuToggle }: NavbarProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.replace("/");
    }
  };

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setNotificationCount(0);
      return;
    }

    const fetchNotificationCount = async () => {
      try {
        const notifications = await apiGet<any[]>("/api/notifications/my").catch(() => []);
        const unreadCount = Array.isArray(notifications)
          ? notifications.filter((n) => n.status !== "READ").length
          : 0;
        setNotificationCount(unreadCount);
      } catch (error: any) {
        // Silently handle errors
        setNotificationCount(0);
      }
    };

    fetchNotificationCount();

    // Listen for new notifications
    const socket = getSocket();
    if (socket && user) {
      const handleNewNotification = (data?: any) => {
        // For message:created, check if it's not from current user
        if (data && data.message && user) {
          const userId = user.id || user._id;
          if (userId && data.message.senderId === userId) {
            return; // Don't show notification for own messages
          }
        }
        fetchNotificationCount();
      };

      onSocketEvent("notification:new", handleNewNotification);
      onSocketEvent("appointment:statusUpdated", handleNewNotification);
      onSocketEvent("prescription:created", handleNewNotification);
      onSocketEvent("message:created", handleNewNotification);
      
      return () => {
        offSocketEvent("notification:new", handleNewNotification);
        offSocketEvent("appointment:statusUpdated", handleNewNotification);
        offSocketEvent("prescription:created", handleNewNotification);
        offSocketEvent("message:created", handleNewNotification);
      };
    }
  }, []);

  const getUserInitials = () => {
    if (!user?.name) return "U";
    const names = user.name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.name[0].toUpperCase();
  };

  return (
    <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
      <div className="px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left: menu + welcome */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {onMenuToggle && (
              <button
                onClick={onMenuToggle}
                className="lg:hidden p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors flex-shrink-0 shadow-sm"
                aria-label="Toggle menu"
              >
                <MenuIcon className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-xs text-gray-500 hidden sm:block">Welcome back</p>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                {user?.name ? user.name.split(" ")[0] : "Patient Portal"}
              </h1>
            </div>
          </div>

          {/* Right: Notifications + User */}
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <Link
              href="/news"
              className="relative p-2 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors"
              aria-label="Notifications"
            >
              <NewsIcon className="w-5 h-5" />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
              >
                <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-sm">
                  {getUserInitials()}
                </div>
                <div className="hidden md:block text-left min-w-0 max-w-[140px]">
                  <div className="text-sm font-semibold text-gray-900 truncate">{user?.name || "User"}</div>
                  <div className="text-xs text-gray-500 truncate">{user?.email || ""}</div>
                </div>
                <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 sm:w-64 rounded-xl bg-white border border-gray-200 shadow-xl z-20 py-2 max-w-[calc(100vw-2rem)]">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || "User"}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email || ""}</p>
                      {user?.role && <span className="inline-block mt-1.5 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{user.role}</span>}
                    </div>
                    <div className="py-1">
                      <button onClick={() => { setIsMenuOpen(false); router.push("/dashboard"); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 rounded-lg mx-1">
                        <DashboardIcon className="w-4 h-4 text-gray-500" /> Dashboard
                      </button>
                      <button onClick={() => { setIsMenuOpen(false); router.push("/records"); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 rounded-lg mx-1">
                        <RecordsIcon className="w-4 h-4 text-gray-500" /> Records
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 rounded-lg mx-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Logout
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

