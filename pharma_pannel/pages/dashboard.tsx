import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { inventoryApi, ordersApi, prescriptionsApi, distributorOrdersApi, pharmacyReportsApi, inventorySearchApi } from "@/services/api";
import { getUser } from "@/utils/auth";
import { InventoryIcon, OrdersIcon, PrescriptionIcon, AlertIcon, CalendarIcon, RefreshIcon, FileIcon } from "@/components/Icons";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [pharmacyId, setPharmacyId] = useState<string>("");
  const [stats, setStats] = useState({
    totalInventory: 0,
    lowStockItems: 0,
    pendingOrders: 0,
    activePrescriptions: 0,
    todayOrders: 0,
    pendingDistributorOrders: 0,
    expiringSoonItems: 0,
    expiredItems: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expiryItems, setExpiryItems] = useState<any[]>([]);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    setPharmacyId(currentUser.pharmacyId || "");
    
    if (currentUser.pharmacyId) {
      loadDashboardData(currentUser.pharmacyId);
    } else {
      // If no pharmacyId, still show dashboard but with empty stats
      setLoading(false);
      console.warn("No pharmacyId found for user. Please contact admin to link your account to a pharmacy.");
    }
  }, [router]);

  const loadDashboardData = async (phId: string) => {
    setLoading(true);
    try {
      const [inventory, lowStock, orders, prescriptions, distributorOrders, expiryData] = await Promise.all([
        inventoryApi.getAll(phId).catch(() => []),
        inventoryApi.getLowStock(phId).catch(() => []),
        ordersApi.getByPharmacy(phId).catch(() => []),
        prescriptionsApi.getByPharmacy(phId).catch(() => []),
        distributorOrdersApi.getAll(phId).catch(() => []),
        pharmacyReportsApi.getExpiryTracking(phId, 30, false).catch(() => ({ items: [] })),
      ]);

      const today = new Date().toISOString().split("T")[0];
      const todayOrders = Array.isArray(orders) ? orders.filter((o: any) => {
        const orderDate = new Date(o.createdAt || o.updatedAt).toISOString().split("T")[0];
        return orderDate === today;
      }) : [];

      const expiryItems = expiryData?.items || [];
      const expiredItems = expiryItems.filter((item: any) => item.daysUntilExpiry < 0);
      const expiringSoonItems = expiryItems.filter((item: any) => item.daysUntilExpiry >= 0 && item.daysUntilExpiry <= 30);

      setExpiryItems(expiryItems.slice(0, 5)); // Show top 5 expiring items
      setStats({
        totalInventory: Array.isArray(inventory) ? inventory.length : 0,
        lowStockItems: Array.isArray(lowStock) ? lowStock.length : 0,
        pendingOrders: Array.isArray(orders) ? orders.filter((o: any) => 
          ["PENDING", "SENT_TO_PHARMACY", "ACCEPTED", "PACKED"].includes(o.status)
        ).length : 0,
        activePrescriptions: Array.isArray(prescriptions) ? prescriptions.length : 0,
        todayOrders: todayOrders.length,
        pendingDistributorOrders: Array.isArray(distributorOrders) ? distributorOrders.filter((o: any) => 
          ["PENDING", "ACCEPTED", "DISPATCHED"].includes(o.status)
        ).length : 0,
        expiringSoonItems: expiringSoonItems.length,
        expiredItems: expiredItems.length,
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
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Inventory Items",
      value: stats.totalInventory,
      icon: InventoryIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/inventory"),
    },
    {
      label: "Low Stock Alerts",
      value: stats.lowStockItems,
      icon: AlertIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/inventory?filter=lowStock"),
    },
    {
      label: "Pending Orders",
      value: stats.pendingOrders,
      icon: OrdersIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/orders"),
    },
    {
      label: "Active Prescriptions",
      value: stats.activePrescriptions,
      icon: PrescriptionIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/prescriptions"),
    },
    {
      label: "Today's Orders",
      value: stats.todayOrders,
      icon: CalendarIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/orders"),
    },
    {
      label: "Pending Distributor Orders",
      value: stats.pendingDistributorOrders,
      icon: RefreshIcon,
      color: "from-blue-500 to-blue-600",
      onClick: () => router.push("/distributor"),
    },
    {
      label: "Expiring Soon (30 days)",
      value: stats.expiringSoonItems,
      icon: AlertIcon,
      color: "from-orange-500 to-orange-600",
      onClick: () => router.push("/inventory?filter=expiring"),
    },
    {
      label: "Expired Items",
      value: stats.expiredItems,
      icon: AlertIcon,
      color: "from-red-500 to-red-600",
      onClick: () => router.push("/inventory?filter=expiring"),
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
              {pharmacyId && (
                <p className="text-xs text-gray-500 mt-1">Pharmacy ID: {pharmacyId.slice(-8)}</p>
              )}
            </div>
          </div>
          {!pharmacyId && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">
              ⚠️ Your account is not linked to a pharmacy.
              </p>
              <p className="text-xs text-yellow-700">
              Please try logging out and logging back in. If the issue persists, contact the administrator to link your account to a pharmacy.
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

            {/* Expiry Warnings */}
            {expiryItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-lg p-6"
                  >
                <div className="flex items-center gap-3 mb-4">
                  <AlertIcon className="w-6 h-6 text-orange-600" />
                  <h2 className="text-xl font-bold text-orange-900">Expiry Alerts</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {expiryItems.map((item: any, index: number) => {
                    const isExpired = item.daysUntilExpiry < 0;
                    return (
              <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-lg border-2 ${
                          isExpired
                            ? "bg-red-100 border-red-300"
                            : "bg-orange-100 border-orange-300"
                        }`}
              >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{item.medicineName}</p>
                            {item.brandName && (
                              <p className="text-xs text-gray-600">{item.brandName}</p>
                            )}
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              isExpired
                                ? "bg-red-600 text-white"
                                : "bg-orange-600 text-white"
                            }`}
                          >
                            {isExpired
                              ? "EXPIRED"
                              : `${item.daysUntilExpiry} days`}
                          </span>
                  </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>Batch: {item.batchNumber}</div>
                          <div>Qty: {item.quantity}</div>
                          <div>
                            Expiry: {new Date(item.expiryDate).toLocaleDateString()}
                  </div>
                  </div>
                      </motion.div>
                    );
                  })}
                </div>
                <button
                  onClick={() => router.push("/inventory?filter=expiring")}
                  className="mt-4 text-sm font-medium text-orange-900 hover:text-orange-700 underline"
                >
                  View All Expiring Items →
                </button>
              </motion.div>
            )}

          </>
        )}
      </motion.div>
    </Layout>
  );
}

