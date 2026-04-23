import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { notificationsApi } from "@/services/api";
import { getUser } from "@/utils/auth";
import { Notification } from "@/types";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";

export default function LowStockAlertsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "lowStock">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    loadNotifications();

    // Socket is already initialized in _app.tsx, just listen to events
    const socket = getSocket();
    if (socket) {
      const handleLowStock = (data: any) => {
        if (data.type === "INVENTORY_LOW_STOCK") {
          toast.error(`Low Stock Alert: ${data.message || "Pharmacy stock is low"}`);
          loadNotifications();
        }
      };

      const handleNotificationCreated = (data: any) => {
        if (data.type === "INVENTORY_LOW_STOCK") {
          toast.error(`New Low Stock Alert: ${data.message || "Pharmacy stock is low"}`);
          loadNotifications();
        }
      };

      onSocketEvent("notification:lowStock", handleLowStock);
      onSocketEvent("notification:created", handleNotificationCreated);

      return () => {
        offSocketEvent("notification:lowStock", handleLowStock);
        offSocketEvent("notification:created", handleNotificationCreated);
      };
    }

    // Auto-refresh every 30 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadNotifications();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [router, autoRefresh]);

  useEffect(() => {
    let filtered = [...notifications];

    if (filter === "unread") {
      filtered = filtered.filter((n) => n.status !== "READ");
    } else if (filter === "lowStock") {
      filtered = filtered.filter((n) => n.type === "INVENTORY_LOW_STOCK");
    }

    setFilteredNotifications(filtered);
  }, [notifications, filter]);

  const loadNotifications = async () => {
    try {
      const data = await notificationsApi.getMyNotifications();
      // Filter for low stock alerts
      const lowStockAlerts = Array.isArray(data)
        ? data.filter((n: any) => n.type === "INVENTORY_LOW_STOCK")
        : [];
      setNotifications(lowStockAlerts);
    } catch (error: any) {
      toast.error(error.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      toast.success("Notification marked as read");
      loadNotifications();
    } catch (error: any) {
      toast.error(error.message || "Failed to mark as read");
    }
  };

  if (!user) return null;

  const unreadCount = notifications.filter((n) => n.status !== "READ").length;

  return (
    <Layout user={user} currentPage="low-stock-alerts">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Low Stock Alerts</h1>
            <p className="text-gray-600">
              Auto-alerts when pharmacy stock is low (refreshes automatically)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">Auto-refresh</span>
            </label>
            <button
              onClick={loadNotifications}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Alerts</span>
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{notifications.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Unread</span>
              <span className="text-2xl">📬</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{unreadCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Read</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {notifications.length - unreadCount}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === "all"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === "unread"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setFilter("lowStock")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === "lowStock"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Low Stock
            </button>
          </div>
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No alerts found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <motion.div
                key={notification._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-xl shadow-md border border-gray-100 p-6 ${
                  notification.status !== "READ" ? "border-l-4 border-l-orange-500" : ""
                }`}
              >
                <div className="flex flex-col lg:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{notification.title}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          notification.status === "READ"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {notification.status === "READ" ? "Read" : "Unread"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                    {notification.metadata && (
                      <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                        <p className="text-xs font-semibold text-purple-900 mb-1">Details:</p>
                        <div className="text-xs text-purple-700 space-y-1">
                          {notification.metadata.medicineName && (
                            <p>Medicine: {notification.metadata.medicineName}</p>
                          )}
                          {notification.metadata.currentQuantity !== undefined && (
                            <p>Current Quantity: {notification.metadata.currentQuantity}</p>
                          )}
                          {notification.metadata.threshold && (
                            <p>Threshold: {notification.metadata.threshold}</p>
                          )}
                          {notification.metadata.orderId && (
                            <p>Order ID: {notification.metadata.orderId.slice(-8)}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {notification.createdAt
                        ? new Date(notification.createdAt).toLocaleString()
                        : "Date not available"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 lg:min-w-[150px]">
                    {notification.status !== "READ" && (
                      <button
                        onClick={() => handleMarkAsRead(notification._id)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all text-sm"
                      >
                        ✓ Mark as Read
                      </button>
                    )}
                    {notification.metadata?.orderId && (
                      <button
                        onClick={() => router.push(`/purchase-requests?id=${notification.metadata.orderId}`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
                      >
                        View Order
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

