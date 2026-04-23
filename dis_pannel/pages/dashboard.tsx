import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { distributorOrdersApi, warehouseInventoryApi, notificationsApi } from "@/services/api";
import { getUser } from "@/utils/auth";
import { InventoryIcon, OrdersIcon, TruckIcon, AlertIcon, FileIcon, CheckIcon, PlusIcon, UserIcon } from "@/components/Icons";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalInventory: 0,
    pendingOrders: 0,
    activeDeliveries: 0,
    unreadAlerts: 0,
    totalOrders: 0,
    deliveredToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    if (currentUser.distributorId) {
      loadDashboardData(currentUser.distributorId);
    } else {
      // If no distributorId, still show dashboard but with empty stats
      setLoading(false);
      console.warn("No distributorId found for user. Please contact admin to link your account to a distributor.");
    }
  }, [router]);

  const loadDashboardData = async (distributorId: string) => {
    setLoading(true);
    try {
      const [inventory, orders, notifications] = await Promise.all([
        warehouseInventoryApi.getAll(distributorId).catch(() => []),
        distributorOrdersApi.getAll(distributorId).catch(() => []),
        notificationsApi.getMyNotifications().catch(() => []),
      ]);

      const today = new Date().toISOString().split("T")[0];
      const deliveredToday = Array.isArray(orders)
        ? orders.filter((o: any) => {
            if (o.status !== "DELIVERED" || !o.deliveredAt) return false;
            const deliveredDate = new Date(o.deliveredAt).toISOString().split("T")[0];
            return deliveredDate === today;
          })
        : [];

      setStats({
        totalInventory: Array.isArray(inventory) ? inventory.length : 0,
        pendingOrders: Array.isArray(orders)
          ? orders.filter((o: any) => ["PENDING", "ACCEPTED"].includes(o.status)).length
          : 0,
        activeDeliveries: Array.isArray(orders)
          ? orders.filter((o: any) => o.status === "DISPATCHED").length
          : 0,
        unreadAlerts: Array.isArray(notifications)
          ? notifications.filter((n: any) => n.status !== "READ").length
          : 0,
        totalOrders: Array.isArray(orders) ? orders.length : 0,
        deliveredToday: deliveredToday.length,
      });
    } catch (error: any) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Warehouse Inventory",
      value: stats.totalInventory,
      icon: InventoryIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/warehouse-inventory"),
    },
    {
      label: "Pending Orders",
      value: stats.pendingOrders,
      icon: OrdersIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/purchase-requests"),
    },
    {
      label: "Active Deliveries",
      value: stats.activeDeliveries,
      icon: TruckIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/delivery-tracking"),
    },
    {
      label: "Unread Alerts",
      value: stats.unreadAlerts,
      icon: AlertIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/low-stock-alerts"),
    },
    {
      label: "Total Orders",
      value: stats.totalOrders,
      icon: OrdersIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/purchase-requests"),
    },
    {
      label: "Delivered Today",
      value: stats.deliveredToday,
      icon: CheckIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/delivery-tracking"),
    },
  ];

  return (
    <Layout user={user} currentPage="dashboard">
      {/* Fixed Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                Dashboard Overview
              </h1>
              <p className="text-sm text-gray-600">
                Welcome back, {user.name}!
              </p>
              {user.distributorId && (
                <p className="text-xs text-gray-500 mt-1">Distributor ID: {user.distributorId.slice(-8)}</p>
              )}
            </div>
          </div>
          {!user.distributorId && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">
              ⚠️ Your account is not linked to a distributor.
              </p>
              <p className="text-xs text-yellow-700">
              Please try logging out and logging back in. If the issue persists, contact the administrator to link your account to a distributor.
              </p>
            </div>
          )}
        </div>
      </motion.header>

      {/* Content Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={stat.onClick}
                  className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6 cursor-pointer hover:shadow-md transition-all border-l-4 border-l-blue-900"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-1">{stat.label}</h3>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push("/warehouse-inventory?action=add")}
                    className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-all text-blue-900 font-medium flex items-center gap-2"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Add Warehouse Stock
                  </button>
                  <button
                    onClick={() => router.push("/purchase-requests")}
                    className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-all text-blue-900 font-medium flex items-center gap-2"
                  >
                    <OrdersIcon className="w-5 h-5" />
                    Process Purchase Requests
                  </button>
                  <button
                    onClick={() => router.push("/delivery-agents")}
                    className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-all text-blue-900 font-medium flex items-center gap-2"
                  >
                    <TruckIcon className="w-5 h-5" />
                    Manage Delivery Agents
                  </button>
                  <button
                    onClick={() => router.push("/invoices")}
                    className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-all text-blue-900 font-medium flex items-center gap-2"
                  >
                    <FileIcon className="w-5 h-5" />
                    View Invoices
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-4">System Information</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Distributor ID</span>
                    <span className="font-mono text-xs text-gray-900">
                      {user.distributorId || "Not set"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">User Role</span>
                    <span className="font-semibold text-gray-900">{user.role || "DISTRIBUTOR"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Email</span>
                    <span className="text-gray-900">{user.email}</span>
                  </div>
                  <button
                    onClick={() => router.push("/profile")}
                    className="w-full mt-4 px-4 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <UserIcon className="w-5 h-5" />
                    Manage Profile
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </motion.div>
    </Layout>
  );
}

