import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import OrderCheckout from "@/components/OrderCheckout";
import { ordersApi, deliveryAgentApi, inventoryApi, getAuthHeaders } from "@/services/api";
import { getUser } from "@/utils/auth";
import { Order, OrderStatus } from "@/types";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";
import { ORDER_STATUSES, API_BASE } from "@/utils/constants";

type FilterTab = "all" | "pending" | "active" | "completed" | "cancelled";

export default function OrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionImageUrl, setPrescriptionImageUrl] = useState<string | null>(null);
  const [prescriptionOrderId, setPrescriptionOrderId] = useState<string | null>(null);
  const [deliveryAgents, setDeliveryAgents] = useState<any[]>([]);
  const [assignForm, setAssignForm] = useState({
    agentId: "",
    agentName: "",
    agentPhone: "",
    estimatedTime: "",
  });

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    const pharmacyId = currentUser.pharmacyId;
    if (pharmacyId) {
      loadOrders(pharmacyId);
    }

    // Socket is already initialized in _app.tsx, just listen to events
    const socket = getSocket();
    if (socket && pharmacyId) {
      const handleOrderCreated = async (data: any) => {
        if (data.pharmacyId === pharmacyId && pharmacyId) {
          toast.success("🆕 New order received!");
          await loadOrders(pharmacyId);
        }
      };

      const handleStatusUpdated = (data: any) => {
        if (data.pharmacyId === pharmacyId && pharmacyId) {
          loadOrders(pharmacyId);
        }
      };

      onSocketEvent("order:created", handleOrderCreated);
      onSocketEvent("order:statusUpdated", handleStatusUpdated);

      return () => {
        offSocketEvent("order:created", handleOrderCreated);
        offSocketEvent("order:statusUpdated", handleStatusUpdated);
      };
    }
  }, [router]);

  const loadOrders = async (pharmacyId: string) => {
    setLoading(true);
    try {
      const data = await ordersApi.getByPharmacy(pharmacyId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredOrders = (): Order[] => {
    let filtered = [...orders];

    // Filter by tab
    switch (activeTab) {
      case "pending":
        filtered = filtered.filter((o) => o.status === "PENDING" || o.status === "ORDER_RECEIVED" || o.status === "SENT_TO_PHARMACY");
        break;
      case "active":
        filtered = filtered.filter((o) => ["ACCEPTED", "PACKED", "OUT_FOR_DELIVERY"].includes(o.status));
        break;
      case "completed":
        filtered = filtered.filter((o) => o.status === "DELIVERED");
        break;
      case "cancelled":
        filtered = filtered.filter((o) => o.status === "CANCELLED");
        break;
    }

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.items.some((item) => item.medicineName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          order.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return filtered;
  };

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    if (!user?.pharmacyId) return;

    try {
      const order = orders.find((o) => o._id === orderId);
      
      // Prevent direct acceptance without checking availability
      if (newStatus === "ACCEPTED" && order && (order.status === "PENDING" || order.status === "ORDER_RECEIVED" || order.status === "SENT_TO_PHARMACY")) {
        toast.error("⚠️ Please use 'Check Availability & Process' button to verify stock availability first");
        return;
      }

      await ordersApi.updateStatus(orderId, { status: newStatus });

      const updatedOrder = orders.find((o) => o._id === orderId);
      const socket = getSocket();
      if (socket) {
        socket.emit("order:statusUpdated", {
          orderId,
          status: newStatus,
          pharmacyId: user.pharmacyId,
          patientId: updatedOrder?.patientId,
        });
      }

      toast.success(`✅ Order ${ORDER_STATUSES[newStatus]?.label || newStatus}`);
      loadOrders(user.pharmacyId);
    } catch (error: any) {
      toast.error(error.message || "Failed to update order status");
    }
  };

  const handlePrescriptionVerification = async (orderId: string, verified: boolean) => {
    if (!user?.pharmacyId) return;

    try {
      // Update order with prescription verification status
      const response = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          prescriptionVerified: verified,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update prescription verification");
      }

      const updatedOrder = orders.find((o) => o._id === orderId);
      const socket = getSocket();
      if (socket) {
        socket.emit("order:statusUpdated", {
          orderId,
          prescriptionVerified: verified,
          pharmacyId: user.pharmacyId,
          patientId: updatedOrder?.patientId,
        });
      }

      toast.success(verified ? "✅ Prescription verified successfully!" : "❌ Prescription rejected");
      loadOrders(user.pharmacyId);
      setShowPrescriptionModal(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to verify prescription");
    }
  };

  const openPrescriptionModal = (imageUrl: string, orderId: string) => {
    setPrescriptionImageUrl(imageUrl);
    setPrescriptionOrderId(orderId);
    setShowPrescriptionModal(true);
  };

  const handleAssignDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      await deliveryAgentApi.assignToOrder(
        selectedOrder._id,
        assignForm.agentId,
        assignForm.agentName,
        assignForm.agentPhone,
        assignForm.estimatedTime
      );
      toast.success("🚚 Delivery agent assigned!");
      setShowAssignModal(false);
      setSelectedOrder(null);
      setAssignForm({ agentId: "", agentName: "", agentPhone: "", estimatedTime: "" });
      if (user?.pharmacyId) {
        loadOrders(user.pharmacyId);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to assign delivery agent");
    }
  };

  const openAssignModal = async (order: Order) => {
    setSelectedOrder(order);
    try {
      const agents = await deliveryAgentApi.getByPharmacy(user.pharmacyId);
      setDeliveryAgents(Array.isArray(agents) ? agents : []);
    } catch (error) {
      console.error("Failed to load delivery agents");
    }
    setShowAssignModal(true);
  };

  const getStatusInfo = (status: OrderStatus) => {
    const statusConfig: Record<OrderStatus, { icon: string; color: string; bgColor: string }> = {
      PENDING: { icon: "⏳", color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200" },
      ORDER_RECEIVED: { icon: "📥", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
      MEDICINE_RECEIVED: { icon: "💊", color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200" },
      SENT_TO_PHARMACY: { icon: "📤", color: "text-indigo-600", bgColor: "bg-indigo-50 border-indigo-200" },
      ACCEPTED: { icon: "✅", color: "text-green-600", bgColor: "bg-green-50 border-green-200" },
      PACKED: { icon: "📦", color: "text-teal-600", bgColor: "bg-teal-50 border-teal-200" },
      OUT_FOR_DELIVERY: { icon: "🚚", color: "text-cyan-600", bgColor: "bg-cyan-50 border-cyan-200" },
      DELIVERED: { icon: "🎉", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
      CANCELLED: { icon: "❌", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
    };

    return statusConfig[status] || { icon: "📋", color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200" };
  };

  const getQuickActions = (order: Order) => {
    const actions: Array<{ label: string; icon: string; onClick: () => void; color: string }> = [];

    if (order.status === "PENDING" || order.status === "ORDER_RECEIVED" || order.status === "SENT_TO_PHARMACY") {
      actions.push({
        label: "Check Availability & Process",
        icon: "🔍",
        onClick: () => {
          setSelectedOrder(order);
          setShowCheckoutModal(true);
        },
        color: "bg-blue-600 hover:bg-blue-700",
      });
    }

    if (order.status === "ACCEPTED") {
      actions.push({
        label: "Mark Packed",
        icon: "📦",
        onClick: () => handleStatusUpdate(order._id, "PACKED"),
        color: "bg-teal-600 hover:bg-teal-700",
      });
    }

    // PACKED orders should go to billing section to add to cart
    if (order.status === "PACKED") {
      actions.push({
        label: "Add to Cart",
        icon: "🛒",
        onClick: () => router.push("/billing"),
        color: "bg-blue-600 hover:bg-blue-700",
      });
    }

    // Mark Delivered is handled in billing section after invoice creation

    return actions;
  };

  const filteredOrders = getFilteredOrders();

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => ["PENDING", "ORDER_RECEIVED", "SENT_TO_PHARMACY"].includes(o.status)).length,
    active: orders.filter((o) => ["ACCEPTED", "PACKED", "OUT_FOR_DELIVERY"].includes(o.status)).length,
    completed: orders.filter((o) => o.status === "DELIVERED").length,
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="orders">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Orders Management</h1>
            <p className="text-gray-600">Process and manage patient orders efficiently</p>
          </div>
          <button
            onClick={() => user?.pharmacyId && loadOrders(user.pharmacyId)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <span>🔄</span> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 text-sm font-medium">Total Orders</span>
              <span className="text-3xl">📋</span>
            </div>
            <p className="text-4xl font-bold">{stats.total}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-100 text-sm font-medium">Pending</span>
              <span className="text-3xl">⏳</span>
            </div>
            <p className="text-4xl font-bold">{stats.pending}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-cyan-100 text-sm font-medium">Active</span>
              <span className="text-3xl">🔄</span>
            </div>
            <p className="text-4xl font-bold">{stats.active}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-100 text-sm font-medium">Completed</span>
              <span className="text-3xl">✅</span>
            </div>
            <p className="text-4xl font-bold">{stats.completed}</p>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search by order ID, medicine name, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 pl-12 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                />
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mt-4 border-t pt-4">
            {[
              { key: "all" as FilterTab, label: "All Orders", count: stats.total },
              { key: "pending" as FilterTab, label: "Pending", count: stats.pending },
              { key: "active" as FilterTab, label: "Active", count: stats.active },
              { key: "completed" as FilterTab, label: "Completed", count: stats.completed },
              { key: "cancelled" as FilterTab, label: "Cancelled", count: orders.filter((o) => o.status === "CANCELLED").length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Orders Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading orders...</p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-16 text-center border border-gray-200">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Orders Found</h3>
            <p className="text-gray-600">No orders match your current filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            <AnimatePresence>
              {filteredOrders.map((order) => {
                const statusInfo = getStatusInfo(order.status);
                return (
                  <motion.button
                    key={order._id}
                    type="button"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowDetailsModal(true);
                    }}
                    className={`aspect-square rounded-xl border-2 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center p-3 text-left min-w-0 ${statusInfo.bgColor} border-gray-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span className="text-2xl mb-1 flex-shrink-0">{statusInfo.icon}</span>
                    <span className="text-xs font-bold text-gray-800 truncate w-full text-center">
                      #{order._id.slice(-8).toUpperCase()}
                    </span>
                    <span className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.color} ${statusInfo.bgColor} border border-current/20 truncate max-w-full`}>
                      {ORDER_STATUSES[order.status]?.label || order.status}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </span>
                    <span className="text-[10px] text-gray-600 font-medium">💊 {order.items.length} items</span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Order Details Modal - full info when a box is clicked */}
        {showDetailsModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDetailsModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {(() => {
                const order = selectedOrder;
                const statusInfo = getStatusInfo(order.status);
                const quickActions = getQuickActions(order);
                return (
                  <>
                    <div className={`${statusInfo.bgColor} border-b-2 border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0`}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{statusInfo.icon}</span>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">Order #{order._id.slice(-8).toUpperCase()}</h2>
                          <p className="text-sm text-gray-600">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${statusInfo.color} ${statusInfo.bgColor} border border-current/20`}>
                          {ORDER_STATUSES[order.status]?.label || order.status}
                        </span>
                        <button
                          onClick={() => setShowDetailsModal(false)}
                          className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                          aria-label="Close"
                        >
                          <span className="text-xl">✕</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      <section>
                        <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">💊 Medicines ({order.items.length})</h3>
                        <div className="space-y-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-sm font-medium text-gray-900">{item.medicineName}</span>
                              <span className="text-sm text-gray-600 font-semibold">Qty: {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                      <div className="grid grid-cols-2 gap-3">
                        {order.totalAmount != null && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-0.5">Total</p>
                            <p className="text-lg font-bold text-gray-900">₹{order.totalAmount.toFixed(2)}</p>
                          </div>
                        )}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-0.5">Type</p>
                          <p className="text-sm font-semibold text-gray-900">{order.deliveryType === "DELIVERY" ? "🚚 Delivery" : "🏪 Pickup"}</p>
                        </div>
                        {order.phoneNumber && (
                          <div className="col-span-2 bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-0.5">Contact</p>
                            <p className="text-sm font-semibold text-gray-900">📞 {order.phoneNumber}</p>
                          </div>
                        )}
                      </div>
                      {order.deliveryAddress && (
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <p className="text-xs text-blue-700 font-semibold mb-1">📍 Delivery Address</p>
                          <p className="text-sm text-blue-900">{order.deliveryAddress}</p>
                        </div>
                      )}
                      {order.prescriptionImageUrl && (
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                            <p className="text-xs text-purple-700 font-semibold flex items-center gap-2">
                              📋 Prescription
                              {order.prescriptionVerified !== undefined && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${order.prescriptionVerified ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {order.prescriptionVerified ? "✅ Verified" : "❌ Rejected"}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setShowDetailsModal(false);
                                openPrescriptionModal(order.prescriptionImageUrl!, order._id);
                              }}
                              className="text-xs text-purple-700 font-semibold hover:text-purple-900 underline"
                            >
                              👁️ View Prescription
                            </button>
                            {order.prescriptionVerified === undefined && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handlePrescriptionVerification(order._id, true)}
                                  className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600"
                                >
                                  ✅ Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrescriptionVerification(order._id, false)}
                                  className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600"
                                >
                                  ❌ Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {order.deliveryPersonName && (
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                          <p className="text-xs text-green-700 font-semibold mb-1">🚚 Delivery Agent</p>
                          <p className="text-sm text-green-900 font-medium">{order.deliveryPersonName}</p>
                          {order.deliveryPersonPhone && <p className="text-xs text-green-700">📞 {order.deliveryPersonPhone}</p>}
                        </div>
                      )}
                      {quickActions.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-200">
                          {quickActions.map((action, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                action.onClick();
                                setShowDetailsModal(false);
                              }}
                              className={`flex-1 ${action.color} text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2`}
                            >
                              <span>{action.icon}</span>
                              <span>{action.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}

        {/* Order Checkout Modal */}
        {showCheckoutModal && selectedOrder && user?.pharmacyId && (
          <OrderCheckout
            order={selectedOrder}
            onClose={() => {
              setShowCheckoutModal(false);
              setSelectedOrder(null);
            }}
            onConfirm={() => {
              setShowCheckoutModal(false);
              setSelectedOrder(null);
              if (user?.pharmacyId) {
                loadOrders(user.pharmacyId);
              }
            }}
            pharmacyId={user.pharmacyId}
            userDistributorId={user.distributorId}
          />
        )}

        {/* Assign Delivery Agent Modal */}
        {showAssignModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🚚 Assign Delivery Agent</h2>
              <form onSubmit={handleAssignDelivery} className="space-y-4">
                {deliveryAgents.length > 0 ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Delivery Agent</label>
                    <select
                      value={assignForm.agentId}
                      onChange={(e) => {
                        const agent = deliveryAgents.find((a) => a._id === e.target.value);
                        setAssignForm({
                          ...assignForm,
                          agentId: e.target.value,
                          agentName: agent?.name || "",
                          agentPhone: agent?.phoneNumber || agent?.phone || "",
                        });
                      }}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      required
                    >
                      <option value="">Select an agent</option>
                      {deliveryAgents.map((agent) => (
                        <option key={agent._id} value={agent._id}>
                          {agent.name} - {agent.phoneNumber || agent.phone || "No phone"}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Agent Name *</label>
                      <input
                        type="text"
                        required
                        value={assignForm.agentName}
                        onChange={(e) => setAssignForm({ ...assignForm, agentName: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Agent Phone *</label>
                      <input
                        type="tel"
                        required
                        value={assignForm.agentPhone}
                        onChange={(e) => setAssignForm({ ...assignForm, agentPhone: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated Delivery Time</label>
                  <input
                    type="datetime-local"
                    value={assignForm.estimatedTime}
                    onChange={(e) => setAssignForm({ ...assignForm, estimatedTime: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Assign Agent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedOrder(null);
                      setAssignForm({ agentId: "", agentName: "", agentPhone: "", estimatedTime: "" });
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Prescription View Modal */}
        {showPrescriptionModal && prescriptionImageUrl && prescriptionOrderId && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPrescriptionModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold">📋 Prescription Image</h2>
                <button
                  onClick={() => setShowPrescriptionModal(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-gray-50">
                <img
                  src={`${API_BASE}${prescriptionImageUrl}`}
                  alt="Prescription"
                  className="max-w-full max-h-[calc(90vh-150px)] object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder-prescription.png";
                  }}
                />
              </div>
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handlePrescriptionVerification(prescriptionOrderId, true);
                    }}
                    className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    ✅ Verify Prescription
                  </button>
                  <button
                    onClick={() => {
                      handlePrescriptionVerification(prescriptionOrderId, false);
                    }}
                    className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                  >
                    ❌ Reject Prescription
                  </button>
                </div>
                <button
                  onClick={() => setShowPrescriptionModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}
