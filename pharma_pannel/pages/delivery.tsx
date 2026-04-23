import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { getUser } from "@/utils/auth";
import { deliveryAgentApi, ordersApi } from "@/services/api";
import { Order } from "@/types";
import { ORDER_STATUSES } from "@/utils/constants";

interface DeliveryAgent {
  _id?: string;
  name: string;
  phoneNumber: string;
  email?: string;
  status: "AVAILABLE" | "BUSY" | "OFFLINE";
  pharmacyId?: string;
  createdAt?: string;
}

export default function DeliveryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<"agents" | "tracking">("agents");
  
  // Delivery Agents State
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<DeliveryAgent | null>(null);
  const [agentFormData, setAgentFormData] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });

  // Delivery Tracking State
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    if (currentUser.pharmacyId) {
      const pharmacyId = currentUser.pharmacyId;
      loadAgents(pharmacyId);
      loadDeliveryOrders(pharmacyId);
      // Auto-refresh orders every 30 seconds
      const interval = setInterval(() => {
        loadDeliveryOrders(pharmacyId);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [router]);

  useEffect(() => {
    let filtered = orders.filter(
      (order) =>
        order.status === "OUT_FOR_DELIVERY" || order.status === "PACKED" || order.status === "DELIVERED"
    );

    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.deliveryPersonName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.deliveryPersonPhone?.includes(searchTerm)
      );
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm]);

  const loadAgents = async (pharmacyId: string) => {
    setLoadingAgents(true);
    try {
      const data = await deliveryAgentApi.getByPharmacy(pharmacyId);
      setAgents(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load delivery agents");
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadDeliveryOrders = async (pharmacyId: string) => {
    try {
      const data = await ordersApi.getByPharmacy(pharmacyId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load delivery orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.pharmacyId) return;

    try {
      const email = agentFormData.email || `${agentFormData.name.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@delivery.local`;
      
      await deliveryAgentApi.create({
        name: agentFormData.name,
        phoneNumber: agentFormData.phoneNumber,
        email: email,
        pharmacyId: user.pharmacyId,
        status: "AVAILABLE",
      });
      toast.success("Delivery agent added successfully!");
      setShowAddModal(false);
      resetAgentForm();
      loadAgents(user.pharmacyId);
    } catch (error: any) {
      toast.error(error.message || "Failed to add delivery agent");
    }
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent?._id) return;

    try {
      await deliveryAgentApi.update(selectedAgent._id, agentFormData);
      toast.success("Delivery agent updated successfully!");
      setShowEditModal(false);
      setSelectedAgent(null);
      resetAgentForm();
      if (user?.pharmacyId) {
        loadAgents(user.pharmacyId);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update delivery agent");
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this delivery agent?")) return;

    try {
      await deliveryAgentApi.delete(id);
      toast.success("Delivery agent deleted successfully!");
      if (user?.pharmacyId) {
        loadAgents(user.pharmacyId);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete delivery agent");
    }
  };

  const handleToggleStatus = async (agent: DeliveryAgent) => {
    if (!agent._id) return;

    const newStatus = agent.status === "AVAILABLE" ? "BUSY" : "AVAILABLE";
    try {
      await deliveryAgentApi.update(agent._id, { status: newStatus });
      toast.success(`Agent status updated to ${newStatus}`);
      if (user?.pharmacyId) {
        loadAgents(user.pharmacyId);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update agent status");
    }
  };

  const handleEdit = (agent: DeliveryAgent) => {
    setSelectedAgent(agent);
    setAgentFormData({
      name: agent.name,
      phoneNumber: agent.phoneNumber,
      email: agent.email || "",
    });
    setShowEditModal(true);
  };

  const resetAgentForm = () => {
    setAgentFormData({
      name: "",
      phoneNumber: "",
      email: "",
    });
  };

  const handleStatusUpdate = async (orderId: string, newStatus: "DELIVERED" | "CANCELLED") => {
    if (!user?.pharmacyId) return;

    try {
      await ordersApi.updateStatus(orderId, { status: newStatus });
      toast.success(`Order status updated to ${ORDER_STATUSES[newStatus]?.label || newStatus}`);
      loadDeliveryOrders(user.pharmacyId);
    } catch (error: any) {
      toast.error(error.message || "Failed to update order status");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-100 text-green-800";
      case "BUSY":
        return "bg-orange-100 text-orange-800";
      case "OFFLINE":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!user) return null;

  const availableAgents = agents.filter((a) => a.status === "AVAILABLE");
  const busyAgents = agents.filter((a) => a.status === "BUSY");
  const activeDeliveries = orders.filter((o) => o.status === "OUT_FOR_DELIVERY");
  const deliveredToday = orders.filter((o) => {
    if (o.status !== "DELIVERED" || !o.deliveredAt) return false;
    const today = new Date().toISOString().split("T")[0];
    const deliveredDate = new Date(o.deliveredAt).toISOString().split("T")[0];
    return deliveredDate === today;
  });

  return (
    <Layout user={user} currentPage="delivery-agents">
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
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Delivery Management</h1>
                <p className="text-sm text-gray-600">Manage delivery agents and track active deliveries</p>
              </div>
              {activeSection === "agents" && (
                <button
                  onClick={() => {
                    resetAgentForm();
                    setShowAddModal(true);
                  }}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm sm:text-base"
                >
                  ➕ Add New Agent
                </button>
              )}
              {activeSection === "tracking" && (
                <button
                  onClick={() => user?.pharmacyId && loadDeliveryOrders(user.pharmacyId)}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm sm:text-base"
                >
                  🔄 Refresh Orders
                </button>
              )}
            </div>
            
            {/* Toggle Switch */}
            <div className="flex items-center gap-4 bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => setActiveSection("agents")}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                  activeSection === "agents"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                👥 Delivery Agents
              </button>
              <button
                onClick={() => setActiveSection("tracking")}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                  activeSection === "tracking"
                    ? "bg-green-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                🚚 Delivery Tracking
              </button>
            </div>
          </div>
        </div>

        {/* Stats - Dynamic based on active section */}
        {activeSection === "agents" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-gray-600 text-xs sm:text-sm font-medium">Total Agents</span>
                <span className="text-xl sm:text-2xl">👥</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{agents.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-gray-600 text-xs sm:text-sm font-medium">Available</span>
                <span className="text-xl sm:text-2xl">✅</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{availableAgents.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-gray-600 text-xs sm:text-sm font-medium">Busy</span>
                <span className="text-xl sm:text-2xl">🚚</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-orange-600">{busyAgents.length}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-gray-600 text-xs sm:text-sm font-medium">Active Deliveries</span>
                <span className="text-xl sm:text-2xl">🚚</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-orange-600">{activeDeliveries.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-gray-600 text-xs sm:text-sm font-medium">Delivered Today</span>
                <span className="text-xl sm:text-2xl">✅</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{deliveredToday.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-gray-600 text-xs sm:text-sm font-medium">Total Tracked</span>
                <span className="text-xl sm:text-2xl">📊</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
            </div>
          </div>
        )}

        {/* Main Content - Single Section Based on Toggle */}
        <AnimatePresence mode="wait">
          {activeSection === "agents" ? (
            <motion.div
              key="agents"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg shadow border border-gray-200 flex flex-col min-h-[600px]"
            >
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Delivery Agents</h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">{agents.length} agent(s) registered</p>
                </div>
                <button
                  onClick={() => user?.pharmacyId && loadAgents(user.pharmacyId)}
                  className="px-3 py-1.5 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-all text-xs sm:text-sm border border-blue-200"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {loadingAgents ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <span className="text-3xl">👥</span>
                  </div>
                  <p className="text-gray-500 font-medium mb-2">No delivery agents found</p>
                  <button
                    onClick={() => {
                      resetAgentForm();
                      setShowAddModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
                  >
                    Add Your First Agent
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <motion.div
                      key={agent._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gray-50 rounded-lg border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">{agent.name}</h3>
                          <p className="text-xs sm:text-sm text-gray-600">📞 {agent.phoneNumber}</p>
                          {agent.email && <p className="text-xs sm:text-sm text-gray-600">📧 {agent.email}</p>}
                        </div>
                        <span
                          className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            agent.status
                          )}`}
                        >
                          {agent.status}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleToggleStatus(agent)}
                          className={`flex-1 px-2 sm:px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                            agent.status === "AVAILABLE"
                              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {agent.status === "AVAILABLE" ? "Mark Busy" : "Mark Available"}
                        </button>
                        <button
                          onClick={() => handleEdit(agent)}
                          className="px-2 sm:px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium text-xs sm:text-sm hover:bg-blue-200 transition-all"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => agent._id && handleDeleteAgent(agent._id)}
                          className="px-2 sm:px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-medium text-xs sm:text-sm hover:bg-red-200 transition-all"
                        >
                          🗑️
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            </motion.div>
          ) : (
            <motion.div
              key="tracking"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg shadow border border-gray-200 flex flex-col min-h-[600px]"
            >
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Active Deliveries</h2>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">{filteredOrders.length} order(s) in transit</p>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search by order ID, agent name, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none text-sm"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingOrders ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-3xl">🚚</span>
                    </div>
                    <p className="text-gray-500 font-medium">No active deliveries</p>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">Orders will appear here when assigned for delivery</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredOrders.map((order) => (
                      <motion.div
                        key={order._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gray-50 rounded-lg border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">
                              Order #{order._id.slice(-8)}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {order.createdAt
                                ? new Date(order.createdAt).toLocaleString()
                                : "Date not available"}
                            </p>
                          </div>
                          <span
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
                              ORDER_STATUSES[order.status]?.color || "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {ORDER_STATUSES[order.status]?.label || order.status}
                          </span>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Items ({order.items.length}):</p>
                            <div className="space-y-0.5">
                              {order.items.slice(0, 2).map((item, idx) => (
                                <div key={idx} className="text-xs text-gray-600 pl-2">
                                  • {item.medicineName} (Qty: {item.quantity})
                                </div>
                              ))}
                              {order.items.length > 2 && (
                                <div className="text-xs text-gray-500 pl-2">+{order.items.length - 2} more</div>
                              )}
                            </div>
                          </div>
                          {order.deliveryPersonName && (
                            <div className="p-2 bg-green-50 rounded-lg">
                              <p className="text-xs font-semibold text-green-900 mb-1">Agent:</p>
                              <p className="text-xs text-green-700">{order.deliveryPersonName}</p>
                              {order.deliveryPersonPhone && (
                                <p className="text-xs text-green-700">📞 {order.deliveryPersonPhone}</p>
                              )}
                              {order.estimatedDeliveryTime && (
                                <p className="text-xs text-green-700">
                                  ETA: {new Date(order.estimatedDeliveryTime).toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                          )}
                          {order.deliveryAddress && (
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <p className="text-xs font-semibold text-blue-900 mb-1">Address:</p>
                              <p className="text-xs text-blue-700 line-clamp-2">{order.deliveryAddress}</p>
                            </div>
                          )}
                        </div>

                        {order.status === "OUT_FOR_DELIVERY" && (
                          <button
                            onClick={() => handleStatusUpdate(order._id, "DELIVERED")}
                            className="w-full px-3 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-xs sm:text-sm"
                          >
                            ✅ Mark as Delivered
                          </button>
                        )}
                        {order.status === "DELIVERED" && order.deliveredAt && (
                          <div className="p-2 bg-green-50 rounded-lg text-center">
                            <p className="text-xs font-semibold text-green-900">✓ Delivered</p>
                            <p className="text-xs text-green-700 mt-1">
                              {new Date(order.deliveredAt).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Agent Modal */}
        <AnimatePresence>
          {showAddModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddModal(false)}
                className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="fixed inset-0 flex items-center justify-center z-50 p-4"
              >
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Add Delivery Agent</h2>
                  <form onSubmit={handleAddAgent} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Agent Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={agentFormData.name}
                        onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={agentFormData.phoneNumber}
                        onChange={(e) => setAgentFormData({ ...agentFormData, phoneNumber: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={agentFormData.email}
                        onChange={(e) => setAgentFormData({ ...agentFormData, email: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                      >
                        Add Agent
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModal(false);
                          resetAgentForm();
                        }}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Edit Agent Modal */}
        <AnimatePresence>
          {showEditModal && selectedAgent && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedAgent(null);
                }}
                className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="fixed inset-0 flex items-center justify-center z-50 p-4"
              >
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Edit Delivery Agent</h2>
                  <form onSubmit={handleUpdateAgent} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Agent Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={agentFormData.name}
                        onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={agentFormData.phoneNumber}
                        onChange={(e) => setAgentFormData({ ...agentFormData, phoneNumber: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={agentFormData.email}
                        onChange={(e) => setAgentFormData({ ...agentFormData, email: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                      >
                        Update Agent
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditModal(false);
                          setSelectedAgent(null);
                          resetAgentForm();
                        }}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
}

