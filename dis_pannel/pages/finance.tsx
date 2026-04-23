import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";
import Layout from "@/components/Layout";
import { distributorOrdersApi } from "@/services/api";
import { getUser } from "@/utils/auth";

interface FinanceData {
  totalRevenue: number;
  todayRevenue: number;
  monthlyRevenue: number;
  pendingPayments: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalPharmacies: number;
}

export default function FinancePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [financeData, setFinanceData] = useState<FinanceData>({
    totalRevenue: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
    totalOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    totalPharmacies: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadFinanceData = useCallback(async (distributorId: string) => {
    setLoading(true);
    try {
      const orders = await distributorOrdersApi.getAll(distributorId);
      const ordersList = Array.isArray(orders) ? orders : [];

      const today = new Date().toISOString().split("T")[0];
      const startOfMonth = new Date(new Date().setDate(1)).toISOString().split("T")[0];

      const todayOrders = ordersList.filter((o: any) => {
        const orderDate = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : "";
        return orderDate === today;
      });

      const monthlyOrders = ordersList.filter((o: any) => {
        const orderDate = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : "";
        return orderDate >= startOfMonth;
      });

      const deliveredOrders = ordersList.filter((o: any) => o.status === "DELIVERED");
      const pendingOrders = ordersList.filter((o: any) =>
        ["PENDING", "ACCEPTED", "DISPATCHED"].includes(o.status)
      );

      const getOrderAmount = (order: any): number => {
        if (order.totalAmount) return order.totalAmount;
        if (order.amount) return order.amount;
        if (order.unitPrice && order.quantity) return order.unitPrice * order.quantity;
        return order.quantity * 100;
      };

      const totalRevenue = deliveredOrders.reduce((sum: number, o: any) => {
        return sum + getOrderAmount(o);
      }, 0);

      const todayRevenue = todayOrders
        .filter((o: any) => o.status === "DELIVERED")
        .reduce((sum: number, o: any) => sum + getOrderAmount(o), 0);

      const monthlyRevenue = monthlyOrders
        .filter((o: any) => o.status === "DELIVERED")
        .reduce((sum: number, o: any) => sum + getOrderAmount(o), 0);

      const pendingPayments = pendingOrders.reduce(
        (sum: number, o: any) => sum + getOrderAmount(o),
        0
      );

      const uniquePharmacies = new Set(ordersList.map((o: any) => o.pharmacyId).filter(Boolean));

      setFinanceData({
        totalRevenue,
        todayRevenue,
        monthlyRevenue,
        pendingPayments,
        totalOrders: ordersList.length,
        deliveredOrders: deliveredOrders.length,
        cancelledOrders: ordersList.filter((o: any) => o.status === "CANCELLED").length,
        totalPharmacies: uniquePharmacies.size,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to load finance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    const distributorId = currentUser.distributorId;
    if (distributorId) {
      loadFinanceData(distributorId);
    }

    const socket = getSocket();
    if (socket && distributorId) {
      const handleStatusUpdated = (data: any) => {
        if (data.distributorId === distributorId) {
          loadFinanceData(distributorId);
        }
      };

      const handleOrderCreated = (data: any) => {
        if (data.distributorId === distributorId) {
          loadFinanceData(distributorId);
        }
      };

      onSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);
      onSocketEvent("distributorOrder:created", handleOrderCreated);

      return () => {
        offSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);
        offSocketEvent("distributorOrder:created", handleOrderCreated);
      };
    }
  }, [router, loadFinanceData]);

  const formattedRevenue = useMemo(() => ({
    total: financeData.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 }),
    today: financeData.todayRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 }),
    monthly: financeData.monthlyRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 }),
    pending: financeData.pendingPayments.toLocaleString("en-IN", { maximumFractionDigits: 2 }),
  }), [financeData]);

  if (!user) return null;

  return (
    <Layout user={user} currentPage="finance">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Finance & Revenue</h1>
            <p className="text-gray-600">Track your earnings and financial data in real-time</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-md p-6 border-2 border-green-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Revenue</span>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-3xl font-bold text-green-700">₹{formattedRevenue.total}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md p-6 border-2 border-blue-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Today's Revenue</span>
              <span className="text-2xl">📅</span>
            </div>
            <p className="text-3xl font-bold text-blue-700">₹{formattedRevenue.today}</p>
            <p className="text-xs text-gray-500 mt-1">Today</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-md p-6 border-2 border-purple-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Monthly Revenue</span>
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-3xl font-bold text-purple-700">₹{formattedRevenue.monthly}</p>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl shadow-md p-6 border-2 border-yellow-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Pending Payments</span>
              <span className="text-2xl">⏳</span>
            </div>
            <p className="text-3xl font-bold text-yellow-700">₹{formattedRevenue.pending}</p>
            <p className="text-xs text-gray-500 mt-1">In process</p>
          </motion.div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Orders</span>
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{financeData.totalOrders}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Delivered</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{financeData.deliveredOrders}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Pharmacies</span>
              <span className="text-2xl">🏥</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{financeData.totalPharmacies}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Cancelled</span>
              <span className="text-2xl">❌</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{financeData.cancelledOrders}</p>
          </div>
        </div>
        </>
        )}
      </motion.div>
    </Layout>
  );
}

