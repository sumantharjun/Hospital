"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPatch } from "@/lib/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";
import DashboardLayout from "@/components/DashboardLayout";

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  doctorId?: string;
  createdAt: string;
  metadata?: any;
  status?: string;
}

export default function NewsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        router.replace("/");
        return;
      }
      
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      
      // Socket is already initialized in SocketProvider, no need to initialize again
    }
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const data = await apiGet<Notification[]>("/api/notifications/my");
      const notificationList = Array.isArray(data) ? data : [];
      setNotifications(notificationList);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchNotifications();
  }, [token, fetchNotifications]);

  // Listen for real-time updates
  useEffect(() => {
    if (!token) return;

    const socket = getSocket();
    if (!socket) return;

    const handleActivityUpdate = () => {
      fetchNotifications();
    };
    
    const handleNewNotification = () => {
      fetchNotifications();
    };

    // Listen for various socket events
    onSocketEvent("appointment:statusUpdated", handleActivityUpdate);
    onSocketEvent("appointment:booked", handleActivityUpdate);
    onSocketEvent("prescription:created", handleActivityUpdate);
    onSocketEvent("report:uploaded", handleActivityUpdate);
    onSocketEvent("notification:new", handleNewNotification);
    onSocketEvent("patient:message", handleNewNotification);
    
    return () => {
      offSocketEvent("appointment:statusUpdated", handleActivityUpdate);
      offSocketEvent("appointment:booked", handleActivityUpdate);
      offSocketEvent("prescription:created", handleActivityUpdate);
      offSocketEvent("report:uploaded", handleActivityUpdate);
      offSocketEvent("notification:new", handleNewNotification);
      offSocketEvent("patient:message", handleNewNotification);
    };
  }, [token, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!token) return;
    try {
      await apiPatch(`/api/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes("APPOINTMENT")) {
      if (type.includes("BOOKED") || type.includes("CONFIRMED")) return "✅";
      if (type.includes("CANCELLED")) return "❌";
      if (type.includes("RESCHEDULED")) return "🔄";
      return "📅";
    }
    if (type.includes("PRESCRIPTION")) return "💊";
    if (type.includes("REPORT")) return "📋";
    if (type === "PATIENT_MESSAGE") return "💬";
    if (type === "PATIENT_REQUEST") return "📝";
    return "🔔";
  };

  const getNotificationColor = (type: string) => {
    if (type.includes("APPOINTMENT_BOOKED") || type.includes("APPOINTMENT_CONFIRMED")) return "bg-green-100 text-green-800 border-green-300";
    if (type.includes("CANCELLED")) return "bg-red-100 text-red-800 border-red-300";
    if (type.includes("RESCHEDULED") || type.includes("STATUS_UPDATED")) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (type.includes("REPORT")) return "bg-blue-100 text-blue-800 border-blue-300";
    if (type === "PATIENT_MESSAGE" || type === "PATIENT_REQUEST") return "bg-purple-100 text-purple-800 border-purple-300";
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Today at ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
  };

  if (loading) {
    return (
      <DashboardLayout title="News & Notifications" description="Loading your notifications...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading notifications...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="News & Notifications"
      description="All your updates and activities"
      actionButton={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm transition-colors"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      <div className="max-w-7xl mx-auto">
        {notifications.length === 0 ? (
          <div className="rounded-lg border border-gray-300 bg-white p-12 text-center shadow-sm">
            <div className="text-6xl mb-4">🔔</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Notifications</h2>
            <p className="text-gray-600">
              You don't have any notifications yet. Updates about your appointments, patients, and activities will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const icon = getNotificationIcon(notification.type);
              const colorClasses = getNotificationColor(notification.type);
              const isUnread = notification.status !== "READ";

              return (
                <div
                  key={notification._id}
                  className={`rounded-lg border-l-4 border border-gray-300 bg-white p-6 shadow-sm transition-all hover:shadow-md ${colorClasses}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${colorClasses.replace("border-", "bg-").replace("-300", "-200")}`}>
                      {icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">{notification.title}</h3>
                            {isUnread && (
                              <span className="rounded-full bg-blue-900 px-2 py-1 text-xs font-semibold text-white">
                                New
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-gray-700 leading-[100%]">{notification.message}</p>
                          {notification.metadata?.amount && (
                            <p className="mt-2 text-sm font-semibold text-yellow-700">
                              Amount: ₹{notification.metadata.amount}
                            </p>
                          )}
                          <p className="mt-2 text-sm text-gray-600">{formatDate(notification.createdAt)}</p>
                        </div>
                        {isUnread && (
                          <button
                            onClick={() => handleMarkAsRead(notification._id)}
                            className="ml-4 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

