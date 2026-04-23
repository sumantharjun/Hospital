import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { ordersApi, reportsApi, pharmacyReportsApi } from "@/services/api";
import { getUser } from "@/utils/auth";
import { Order } from "@/types";
import { ORDER_STATUSES, API_BASE } from "@/utils/constants";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";

interface FinanceData {
  totalRevenue: number;
  todayRevenue: number;
  monthlyRevenue: number;
  pendingPayments: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
}

export default function FinanceReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<"finance" | "reports">("finance");

  // Finance State
  const [financeData, setFinanceData] = useState<FinanceData>({
    totalRevenue: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
    totalOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    averageOrderValue: 0,
  });
  const [loadingFinance, setLoadingFinance] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setDate(1)).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  // Reports State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState<"orders" | "inventory" | "prescriptions" | "expiry" | "brand-margin" | "audit-mismatches">("orders");
  const [expiryDays, setExpiryDays] = useState(30);
  const [expiryReport, setExpiryReport] = useState<any>(null);
  const [brandMarginReport, setBrandMarginReport] = useState<any>(null);
  const [auditMismatches, setAuditMismatches] = useState<any[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    if (currentUser.pharmacyId) {
      const pharmacyId = currentUser.pharmacyId;
      loadFinanceData(pharmacyId);
      loadOrderHistory(pharmacyId);
    }

    // Socket listeners for real-time updates
    const socket = getSocket();
    const pharmacyId = currentUser.pharmacyId;
    if (socket && pharmacyId) {
      const handleStatusUpdated = (data: any) => {
        if (data.pharmacyId === pharmacyId) {
          loadFinanceData(pharmacyId);
        }
      };

      const handleOrderCreated = (data: any) => {
        if (data.pharmacyId === pharmacyId) {
          loadFinanceData(pharmacyId);
        }
      };

      onSocketEvent("order:statusUpdated", handleStatusUpdated);
      onSocketEvent("order:created", handleOrderCreated);

      return () => {
        offSocketEvent("order:statusUpdated", handleStatusUpdated);
        offSocketEvent("order:created", handleOrderCreated);
      };
    }
  }, [router]);

  useEffect(() => {
    if (user?.pharmacyId) {
      loadFinanceData(user.pharmacyId);
    }
  }, [dateRange, user?.pharmacyId]);

  useEffect(() => {
    if (user?.pharmacyId && reportType === "expiry") {
      loadExpiryReport();
    } else if (user?.pharmacyId && reportType === "brand-margin") {
      loadBrandMarginReport();
    } else if (user?.pharmacyId && reportType === "audit-mismatches") {
      loadAuditMismatches();
    }
  }, [reportType, expiryDays, startDate, endDate, user?.pharmacyId]);

  const loadFinanceData = async (pharmacyId: string) => {
    setLoadingFinance(true);
    try {
      const orders = await ordersApi.getByPharmacy(pharmacyId);
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
        ["PENDING", "ACCEPTED", "PACKED", "OUT_FOR_DELIVERY"].includes(o.status)
      );

      const totalRevenue = deliveredOrders.reduce(
        (sum: number, o: any) => sum + (o.totalAmount || 0),
        0
      );
      const todayRevenue = todayOrders
        .filter((o: any) => o.status === "DELIVERED")
        .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
      const monthlyRevenue = monthlyOrders
        .filter((o: any) => o.status === "DELIVERED")
        .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
      const pendingPayments = pendingOrders.reduce(
        (sum: number, o: any) => sum + (o.totalAmount || 0),
        0
      );

      const averageOrderValue =
        deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;

      setFinanceData({
        totalRevenue,
        todayRevenue,
        monthlyRevenue,
        pendingPayments,
        totalOrders: ordersList.length,
        deliveredOrders: deliveredOrders.length,
        cancelledOrders: ordersList.filter((o: any) => o.status === "CANCELLED").length,
        averageOrderValue,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to load finance data");
    } finally {
      setLoadingFinance(false);
    }
  };

  const loadOrderHistory = async (pharmacyId: string) => {
    setLoadingReports(true);
    try {
      const data = await reportsApi.getOrderHistory(pharmacyId, startDate, endDate);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load order history");
    } finally {
      setLoadingReports(false);
    }
  };

  const loadExpiryReport = async () => {
    if (!user?.pharmacyId) return;
    setLoadingReport(true);
    try {
      const data = await pharmacyReportsApi.getExpiryTracking(user.pharmacyId, expiryDays, false);
      setExpiryReport(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load expiry report");
    } finally {
      setLoadingReport(false);
    }
  };

  const loadBrandMarginReport = async () => {
    if (!user?.pharmacyId) return;
    setLoadingReport(true);
    try {
      const data = await pharmacyReportsApi.getBrandMargin(user.pharmacyId, startDate, endDate);
      setBrandMarginReport(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load brand margin report");
    } finally {
      setLoadingReport(false);
    }
  };

  const loadAuditMismatches = async () => {
    if (!user?.pharmacyId) return;
    setLoadingReport(true);
    try {
      const data = await pharmacyReportsApi.getAuditMismatches(user.pharmacyId, startDate, endDate);
      setAuditMismatches(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load audit mismatches");
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!user?.pharmacyId) return;

    try {
      if (["expiry", "brand-margin", "audit-mismatches"].includes(reportType)) {
        toast("Report download feature coming soon!", { icon: "ℹ️" });
        return;
      }
      if (reportType === "orders" || reportType === "inventory" || reportType === "prescriptions") {
        await reportsApi.downloadReport(user.pharmacyId, reportType, startDate, endDate);
        toast.success("Report downloaded successfully!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to download report");
    }
  };

  const handleDateFilter = () => {
    if (user?.pharmacyId) {
      loadOrderHistory(user.pharmacyId);
    }
  };

  const getReportsStats = () => {
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const deliveredOrders = orders.filter((o) => o.status === "DELIVERED").length;
    const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

    return {
      totalOrders: orders.length,
      totalRevenue,
      deliveredOrders,
      cancelledOrders,
      avgOrderValue,
    };
  };

  if (!user) return null;

  const reportsStats = getReportsStats();

  return (
    <Layout user={user} currentPage="finance">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header with Toggle */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Finance & Reports</h1>
                <p className="text-sm text-gray-600">Track revenue and generate detailed reports</p>
              </div>
              {activeSection === "reports" && (
                <button
                  onClick={handleDownloadReport}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm sm:text-base"
                >
                  📥 Download Report
                </button>
              )}
            </div>
            
            {/* Toggle Switch */}
            <div className="flex items-center gap-4 bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => setActiveSection("finance")}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                  activeSection === "finance"
                    ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                💰 Finance
              </button>
              <button
                onClick={() => setActiveSection("reports")}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                  activeSection === "reports"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                📊 Reports
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Content Based on Toggle */}
        <AnimatePresence mode="wait">
          {activeSection === "finance" ? (
            <motion.div
              key="finance"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Finance Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow border-2 border-green-200 p-4 sm:p-6"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Total Revenue</span>
                    <span className="text-xl sm:text-2xl">💰</span>
                  </div>
                  {loadingFinance ? (
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <>
                      <p className="text-xl sm:text-3xl font-bold text-green-700">₹{financeData.totalRevenue.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">All time</p>
                    </>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow border-2 border-blue-200 p-4 sm:p-6"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Today's Revenue</span>
                    <span className="text-xl sm:text-2xl">📅</span>
                  </div>
                  {loadingFinance ? (
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <>
                      <p className="text-xl sm:text-3xl font-bold text-blue-700">₹{financeData.todayRevenue.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">Today</p>
                    </>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow border-2 border-purple-200 p-4 sm:p-6"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Monthly Revenue</span>
                    <span className="text-xl sm:text-2xl">📊</span>
                  </div>
                  {loadingFinance ? (
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <>
                      <p className="text-xl sm:text-3xl font-bold text-purple-700">₹{financeData.monthlyRevenue.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">This month</p>
                    </>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow border-2 border-yellow-200 p-4 sm:p-6"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Pending Payments</span>
                    <span className="text-xl sm:text-2xl">⏳</span>
                  </div>
                  {loadingFinance ? (
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <>
                      <p className="text-xl sm:text-3xl font-bold text-yellow-700">₹{financeData.pendingPayments.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">In process</p>
                    </>
                  )}
                </motion.div>
              </div>

              {/* Additional Finance Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Total Orders</span>
                    <span className="text-xl sm:text-2xl">📋</span>
                  </div>
                  {loadingFinance ? (
                    <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <p className="text-xl sm:text-3xl font-bold text-gray-900">{financeData.totalOrders}</p>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Delivered</span>
                    <span className="text-xl sm:text-2xl">✅</span>
                  </div>
                  {loadingFinance ? (
                    <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <p className="text-xl sm:text-3xl font-bold text-green-600">{financeData.deliveredOrders}</p>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Avg Order Value</span>
                    <span className="text-xl sm:text-2xl">📈</span>
                  </div>
                  {loadingFinance ? (
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <p className="text-xl sm:text-3xl font-bold text-blue-600">₹{financeData.averageOrderValue.toFixed(2)}</p>
                  )}
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Filter by Date Range</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Reports Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Total Orders</span>
                    <span className="text-xl sm:text-2xl">📋</span>
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-gray-900">{reportsStats.totalOrders}</p>
                </div>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Total Revenue</span>
                    <span className="text-xl sm:text-2xl">💰</span>
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-green-600">₹{reportsStats.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Delivered</span>
                    <span className="text-xl sm:text-2xl">✅</span>
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-emerald-600">{reportsStats.deliveredOrders}</p>
                </div>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-xs sm:text-sm font-medium">Avg Order Value</span>
                    <span className="text-xl sm:text-2xl">📊</span>
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-blue-600">₹{reportsStats.avgOrderValue.toFixed(2)}</p>
                </div>
              </div>

              {/* Report Filters */}
              <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Generate Report</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Report Type</label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value as any)}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                    >
                      <option value="orders">Orders</option>
                      <option value="inventory">Inventory</option>
                      <option value="prescriptions">Prescriptions</option>
                      <option value="expiry">Expiry Tracking</option>
                      <option value="brand-margin">Brand Margin Analysis</option>
                      <option value="audit-mismatches">Audit Mismatches</option>
                    </select>
                  </div>
                  
                  {reportType === "expiry" && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Days Threshold</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={expiryDays}
                        onChange={(e) => setExpiryDays(parseInt(e.target.value) || 30)}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                      />
                    </div>
                  )}
                  
                  {(reportType === "brand-margin" || reportType === "audit-mismatches" || reportType === "orders") && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                        />
                      </div>
                    </>
                  )}
                  
                  {(reportType === "inventory" || reportType === "prescriptions") && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">&nbsp;</label>
                        <div className="h-10"></div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">&nbsp;</label>
                        <div className="h-10"></div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex items-end gap-2">
                    {(reportType === "orders" || reportType === "brand-margin" || reportType === "audit-mismatches") && (
                      <button
                        onClick={handleDateFilter}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
                      >
                        Filter
                      </button>
                    )}
                    <button
                      onClick={handleDownloadReport}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
                    >
                      📥 Download
                    </button>
                  </div>
                </div>
              </div>

              {/* Report Content - Same as original reports.tsx */}
              {reportType === "expiry" && (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Expiry Tracking Report</h2>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Items expiring within {expiryDays} days</p>
                  </div>
                  {loadingReport ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : expiryReport?.items?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Medicine</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Batch</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Expiry Date</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Days Until Expiry</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {expiryReport.items.map((item: any, index: number) => (
                            <tr key={index} className={item.daysUntilExpiry < 0 ? "bg-red-50" : item.daysUntilExpiry <= 7 ? "bg-orange-50" : ""}>
                              <td className="px-4 sm:px-6 py-4">
                                <div className="font-medium text-gray-900 text-sm">{item.medicineName}</div>
                                {item.brandName && <div className="text-xs text-gray-500">{item.brandName}</div>}
                              </td>
                              <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{item.batchNumber}</td>
                              <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{new Date(item.expiryDate).toLocaleDateString()}</td>
                              <td className="px-4 sm:px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  item.daysUntilExpiry < 0 
                                    ? "bg-red-100 text-red-800" 
                                    : item.daysUntilExpiry <= 7 
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  {item.daysUntilExpiry < 0 ? `Expired ${Math.abs(item.daysUntilExpiry)} days ago` : `${item.daysUntilExpiry} days`}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-4 text-sm font-medium">{item.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-gray-500">No items found</div>
                  )}
                </div>
              )}

              {reportType === "brand-margin" && (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Brand Margin Analysis</h2>
                  </div>
                  {loadingReport ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : brandMarginReport?.brands?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Brand</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Composition</th>
                            <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Avg Purchase Price</th>
                            <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Avg Selling Price</th>
                            <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Margin %</th>
                            <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Sales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {brandMarginReport.brands.map((brand: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 sm:px-6 py-4 font-medium text-gray-900 text-sm">{brand.brandName}</td>
                              <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{brand.composition}</td>
                              <td className="px-4 sm:px-6 py-4 text-right text-sm">₹{brand.avgPurchasePrice?.toFixed(2) || "0.00"}</td>
                              <td className="px-4 sm:px-6 py-4 text-right text-sm font-medium">₹{brand.avgSellingPrice?.toFixed(2) || "0.00"}</td>
                              <td className={`px-4 sm:px-6 py-4 text-right font-semibold text-sm ${
                                brand.margin > 30 ? "text-green-600" : brand.margin > 15 ? "text-blue-600" : "text-orange-600"
                              }`}>
                                {brand.margin?.toFixed(1) || "0.0"}%
                              </td>
                              <td className="px-4 sm:px-6 py-4 text-right text-sm">{brand.totalSales || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-gray-500">No data found</div>
                  )}
                </div>
              )}

              {reportType === "audit-mismatches" && (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Audit Mismatches Report</h2>
                  </div>
                  {loadingReport ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : auditMismatches.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Audit Date</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items with Variance</th>
                            <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Variance Value</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {auditMismatches.map((audit: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 sm:px-6 py-4 text-sm">{new Date(audit.auditDate).toLocaleDateString()}</td>
                              <td className="px-4 sm:px-6 py-4">
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                                  {audit.itemsWithVariance || 0} items
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-4 text-right font-medium text-red-600">
                                ₹{audit.totalVarianceValue?.toFixed(2) || "0.00"}
                              </td>
                              <td className="px-4 sm:px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  audit.status === "REVIEWED" ? "bg-green-100 text-green-800" :
                                  audit.status === "COMPLETED" ? "bg-blue-100 text-blue-800" :
                                  "bg-yellow-100 text-yellow-800"
                                }`}>
                                  {audit.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-gray-500">No audit mismatches found</div>
                  )}
                </div>
              )}

              {/* Order History Table */}
              {reportType === "orders" && (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Order History</h2>
                  </div>
                  {loadingReports ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="p-12 text-center">
                      <p className="text-gray-500 text-lg">No orders found for the selected period</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Order ID</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Delivery Type</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {orders.map((order) => (
                            <tr key={order._id} className="hover:bg-gray-50">
                              <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                #{order._id.slice(-8)}
                              </td>
                              <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {order.createdAt
                                  ? new Date(order.createdAt).toLocaleDateString()
                                  : "N/A"}
                              </td>
                              <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                                {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                              </td>
                              <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    ORDER_STATUSES[order.status]?.color || "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {ORDER_STATUSES[order.status]?.label || order.status}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                ₹{order.totalAmount?.toFixed(2) || "0.00"}
                              </td>
                              <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {order.deliveryType || "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
}

