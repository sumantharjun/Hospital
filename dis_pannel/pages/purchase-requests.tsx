import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { distributorOrdersApi, deliveryAgentsApi, getAuthHeaders } from "@/services/api";
import { getUser, getAuthToken } from "@/utils/auth";
import { DistributorOrder, DistributorOrderStatus } from "@/types";
import { DISTRIBUTOR_ORDER_STATUSES, API_BASE } from "@/utils/constants";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<DistributorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DistributorOrderStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<DistributorOrder | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deliveryAgents, setDeliveryAgents] = useState<any[]>([]);
  const [assignForm, setAssignForm] = useState({
    agentId: "",
    agentName: "",
    agentPhone: "",
  });
  const [groupByPharmacy, setGroupByPharmacy] = useState(true);
  const [pharmacyNames, setPharmacyNames] = useState<Record<string, string>>({});
  const [selectedPharmacyFilter, setSelectedPharmacyFilter] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    console.log("Current user object:", currentUser);
    console.log("User distributorId:", currentUser.distributorId);
    console.log("User distributorId type:", typeof currentUser.distributorId);
    
    // Load distributor ID - either from user object or fetch from master distributor table
    const loadDistributorId = async () => {
      if (currentUser.distributorId) {
        console.log("Using distributorId from user object:", currentUser.distributorId);
        loadOrders(currentUser.distributorId);
      } else {
        // Try to get distributor ID from master distributor table by user email or ID
        try {
          console.log("No distributorId in user object, trying to fetch from master distributor table...");
          const response = await fetch(`${API_BASE}/api/master/distributors`, {
            headers: { Authorization: `Bearer ${getAuthToken()}` },
          });
          if (response.ok) {
            const distributors = await response.json();
            // Find distributor that might match this user
            // Note: This is a fallback - ideally distributorId should be set in user object
            console.warn("distributorId not found in user object. Please contact admin to link your account to a distributor.");
            toast.error("No distributor ID found. Please contact admin to link your account to a distributor.");
          }
        } catch (error) {
          console.error("Error fetching distributors:", error);
          toast.error("No distributor ID found. Please contact admin to link your account to a distributor.");
        }
      }
    };
    
    loadDistributorId();

    // Socket is already initialized in _app.tsx, just listen to events
    const socket = getSocket();
    if (socket && currentUser.distributorId) {
      const handleOrderCreated = (data: any) => {
        if (data.distributorId === currentUser.distributorId && currentUser.distributorId) {
          toast.success("New purchase request received!");
          loadOrders(currentUser.distributorId);
        }
      };

      const handleStatusUpdated = (data: any) => {
        if (data.distributorId === currentUser.distributorId && currentUser.distributorId) {
          loadOrders(currentUser.distributorId);
        }
      };

      onSocketEvent("distributorOrder:created", handleOrderCreated);
      onSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);

      return () => {
        offSocketEvent("distributorOrder:created", handleOrderCreated);
        offSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);
      };
    }
  }, [router]);

  // Handle pharmacy filter from query params
  useEffect(() => {
    if (router.query.pharmacyId && typeof router.query.pharmacyId === "string") {
      setSelectedPharmacyFilter(router.query.pharmacyId);
      setGroupByPharmacy(false); // Disable grouping when filtering by specific pharmacy
    } else {
      setSelectedPharmacyFilter(null);
    }
  }, [router.query.pharmacyId]);

  useEffect(() => {
    let filtered = [...orders];

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Filter by selected pharmacy if set
    if (selectedPharmacyFilter) {
      filtered = filtered.filter((order) => order.pharmacyId === selectedPharmacyFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.pharmacyId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pharmacyNames[order.pharmacyId]?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  }, [orders, statusFilter, searchTerm, pharmacyNames, selectedPharmacyFilter]);

  const groupOrdersByPharmacy = () => {
    const grouped: Record<string, DistributorOrder[]> = {};
    filteredOrders.forEach((order) => {
      if (!grouped[order.pharmacyId]) {
        grouped[order.pharmacyId] = [];
      }
      grouped[order.pharmacyId].push(order);
    });
    return grouped;
  };

  const loadOrders = async (distributorId: string) => {
    setLoading(true);
    try {
      console.log("=== LOADING ORDERS ===");
      console.log("Distributor ID:", distributorId);
      console.log("Distributor ID type:", typeof distributorId);
      console.log("Distributor ID length:", distributorId?.length);
      console.log("Distributor ID trimmed:", distributorId?.trim());
      
      const data = await distributorOrdersApi.getAll(distributorId);
      console.log("=== ORDERS FETCHED ===");
      console.log("Raw data:", data);
      console.log("Data type:", typeof data);
      console.log("Is array:", Array.isArray(data));
      console.log("Data length:", Array.isArray(data) ? data.length : "N/A");
      
      const ordersList = Array.isArray(data) ? data : [];
      setOrders(ordersList);
      
      if (ordersList.length === 0) {
        console.warn("⚠️ No orders found for distributorId:", distributorId);
        console.warn("Please check backend logs for more details");
        
        // Check if there might be a mismatch
        // Try to fetch all orders to see what distributorIds exist
        try {
          const allOrdersResponse = await fetch(`${API_BASE}/api/distributor-orders`, {
            headers: getAuthHeaders(),
          });
          if (allOrdersResponse.ok) {
            const allOrders = await allOrdersResponse.json();
            if (Array.isArray(allOrders) && allOrders.length > 0) {
              const uniqueDistributorIds = [...new Set(allOrders.map((o: any) => o.distributorId))];
              console.warn("⚠️ Found orders in database, but with different distributorIds:");
              console.warn("  Your distributorId:", distributorId);
              console.warn("  DistributorIds in orders:", uniqueDistributorIds);
              console.warn("  ⚠️ MISMATCH: Your user.distributorId doesn't match the distributorId in orders!");
              console.warn("  SOLUTION: Update your user account's distributorId to match the Distributor master table _id");
              
              // Show helpful error message
              toast.error(
                `No orders found. Your distributorId (${distributorId.slice(-8)}) doesn't match orders. ` +
                `Orders exist for other distributorIds. Please contact admin to fix your account's distributorId.`,
                { duration: 10000 }
              );
              return;
            }
          }
        } catch (error) {
          console.error("Error checking all orders:", error);
        }
        
        // Show user-friendly message
        toast.error(`No orders found for distributor ${distributorId.slice(-8)}`, {
          duration: 5000,
        });
      } else {
        console.log(`✅ Found ${ordersList.length} orders`);
        console.log("Order distributorIds:", ordersList.map((o: any) => o.distributorId));
      }
      
      // Load pharmacy names
      const uniquePharmacyIds = [...new Set(ordersList.map((o: any) => o.pharmacyId))];
      const pharmacyNamesMap: Record<string, string> = {};
      
      for (const pharmacyId of uniquePharmacyIds) {
        try {
          const response = await fetch(`${API_BASE}/api/master/pharmacies/${pharmacyId}`, {
            headers: { Authorization: `Bearer ${getAuthToken()}` },
          });
          if (response.ok) {
            const pharmacy = await response.json();
            pharmacyNamesMap[pharmacyId] = pharmacy.name || `Pharmacy ${pharmacyId.slice(-8)}`;
          }
        } catch (error) {
          pharmacyNamesMap[pharmacyId] = `Pharmacy ${pharmacyId.slice(-8)}`;
        }
      }
      
      setPharmacyNames(pharmacyNamesMap);
    } catch (error: any) {
      toast.error(error.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: DistributorOrderStatus) => {
    if (!user?.distributorId) return;

    try {
      const result = await distributorOrdersApi.update(orderId, { 
        status: newStatus,
        ...(newStatus === "DISPATCHED" && { pickedAt: new Date().toISOString() }),
      });
      
      // Emit socket event for real-time update
      const socket = getSocket();
      if (socket) {
        socket.emit("distributorOrder:statusUpdated", {
          orderId,
          status: newStatus,
          distributorId: user.distributorId,
        });
      }
      
      toast.success(`Order status updated to ${DISTRIBUTOR_ORDER_STATUSES[newStatus]?.label || newStatus}`);
      loadOrders(user.distributorId);
    } catch (error: any) {
      toast.error(error.message || "Failed to update order status");
    }
  };

  const handleAssignAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      await distributorOrdersApi.assignDeliveryAgent(
        selectedOrder._id,
        assignForm.agentId,
        assignForm.agentName,
        assignForm.agentPhone
      );
      toast.success("Delivery agent assigned successfully!");
      setShowAssignModal(false);
      setSelectedOrder(null);
      setAssignForm({ agentId: "", agentName: "", agentPhone: "" });
      if (user?.distributorId) {
        loadOrders(user.distributorId);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to assign delivery agent");
    }
  };

  const openAssignModal = async (order: DistributorOrder) => {
    setSelectedOrder(order);
    try {
      const agents = await deliveryAgentsApi.getAvailable();
      setDeliveryAgents(Array.isArray(agents) ? agents : []);
    } catch (error) {
      console.error("Failed to load delivery agents");
    }
    setShowAssignModal(true);
  };

  const getStatusColor = (status: DistributorOrderStatus) => {
    return DISTRIBUTOR_ORDER_STATUSES[status]?.color || "bg-gray-100 text-gray-800";
  };

  if (!user) return null;

  const pendingOrders = orders.filter((o) => o.status === "PENDING" || o.status === "ACCEPTED");

  return (
    <Layout user={user} currentPage="purchase-requests">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Pharmacy Purchase Requests</h1>
            <p className="text-gray-600">
              {selectedPharmacyFilter && pharmacyNames[selectedPharmacyFilter]
                ? `Orders from ${pharmacyNames[selectedPharmacyFilter]}`
                : "Process and manage orders from pharmacies"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedPharmacyFilter && (
              <button
                onClick={() => {
                  setSelectedPharmacyFilter(null);
                  router.push("/purchase-requests");
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all text-sm"
              >
                Clear Filter
              </button>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={groupByPharmacy}
                onChange={(e) => setGroupByPharmacy(e.target.checked)}
                disabled={!!selectedPharmacyFilter}
                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
              <span className="text-sm font-medium text-gray-700">Group by Pharmacy</span>
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Orders</span>
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{orders.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Pending</span>
              <span className="text-2xl">⏳</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{pendingOrders.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Dispatched</span>
              <span className="text-2xl">🚚</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {orders.filter((o) => o.status === "DISPATCHED").length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Delivered</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {orders.filter((o) => o.status === "DELIVERED").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by order ID, medicine name, or pharmacy ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === "all"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              {Object.keys(DISTRIBUTOR_ORDER_STATUSES).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status as DistributorOrderStatus)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                    statusFilter === status
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {DISTRIBUTOR_ORDER_STATUSES[status].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No orders found</p>
          </div>
        ) : groupByPharmacy ? (
          <div className="space-y-6">
            {Object.entries(groupOrdersByPharmacy()).map(([pharmacyId, pharmacyOrders]) => (
              <motion.div
                key={pharmacyId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-md border-2 border-purple-200 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 border-b-2 border-purple-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>🏥</span>
                        {pharmacyNames[pharmacyId] || `Pharmacy ${pharmacyId.slice(-8)}`}
                      </h3>
                      <p className="text-purple-100 text-sm mt-1">
                        {pharmacyOrders.length} order(s) • ID: {pharmacyId.slice(-8)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-white text-sm font-semibold">
                        {pharmacyOrders.filter((o) => o.status === "PENDING").length} Pending
                      </span>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-white text-sm font-semibold">
                        {pharmacyOrders.filter((o) => o.status === "ACCEPTED").length} Accepted
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {pharmacyOrders.map((order) => (
                    <div
                      key={order._id}
                      className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:bg-gray-100 transition-all"
                    >
                      <div className="flex flex-col lg:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="text-lg font-bold text-gray-900">
                                Order #{order._id.slice(-8)}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {order.createdAt
                                  ? new Date(order.createdAt).toLocaleString()
                                  : "Date not available"}
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                                order.status
                              )}`}
                            >
                              {DISTRIBUTOR_ORDER_STATUSES[order.status]?.label || order.status}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">Medicine:</span> {order.medicineName}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">Quantity:</span> {order.quantity} units
                            </p>
                            {order.deliveryAgentName && (
                              <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                                <p className="text-sm font-semibold text-blue-900">Delivery Agent:</p>
                                <p className="text-sm text-blue-700">{order.deliveryAgentName}</p>
                                {order.deliveryAgentPhone && (
                                  <p className="text-sm text-blue-700">Phone: {order.deliveryAgentPhone}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 lg:min-w-[200px]">
                          {order.status === "PENDING" && (
                            <button
                              onClick={() => handleStatusUpdate(order._id, "ACCEPTED")}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm"
                            >
                              ✓ Accept Order
                            </button>
                          )}
                          {order.status === "ACCEPTED" && (
                            <button
                              onClick={() => openAssignModal(order)}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all text-sm"
                            >
                              🚚 Assign Agent & Pick
                            </button>
                          )}
                          {order.status === "DISPATCHED" && order.pickedAt && !order.outForDeliveryAt && (
                            <button
                              onClick={async () => {
                                try {
                                  await distributorOrdersApi.update(order._id, {
                                    outForDeliveryAt: new Date().toISOString(),
                                  });
                                  toast.success("Order marked as Out for Delivery");
                                  loadOrders(user.distributorId);
                                } catch (error: any) {
                                  toast.error(error.message || "Failed to update status");
                                }
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
                            >
                              🚚 Out for Delivery
                            </button>
                          )}
                          {order.status === "DISPATCHED" && order.outForDeliveryAt && (
                            <button
                              onClick={() => handleStatusUpdate(order._id, "DELIVERED")}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm"
                            >
                              ✅ Mark Delivered
                            </button>
                          )}
                          {order.status === "PENDING" && (
                            <button
                              onClick={() => handleStatusUpdate(order._id, "CANCELLED")}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all text-sm"
                            >
                              ✗ Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-md border border-gray-100 p-6"
              >
                <div className="flex flex-col lg:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          Order #{order._id.slice(-8)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {pharmacyNames[order.pharmacyId] && (
                            <span className="font-semibold">Pharmacy: {pharmacyNames[order.pharmacyId]}</span>
                          )}
                          {" • "}
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString()
                            : "Date not available"}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {DISTRIBUTOR_ORDER_STATUSES[order.status]?.label || order.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Medicine:</span> {order.medicineName}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Quantity:</span> {order.quantity} units
                      </p>
                      {order.deliveryAgentName && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-semibold text-blue-900">Delivery Agent:</p>
                          <p className="text-sm text-blue-700">{order.deliveryAgentName}</p>
                          {order.deliveryAgentPhone && (
                            <p className="text-sm text-blue-700">Phone: {order.deliveryAgentPhone}</p>
                          )}
                          {order.pickedAt && (
                            <p className="text-sm text-blue-700">
                              Picked: {new Date(order.pickedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:min-w-[200px]">
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => handleStatusUpdate(order._id, "ACCEPTED")}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm"
                      >
                        ✓ Accept Order
                      </button>
                    )}
                    {order.status === "ACCEPTED" && (
                      <button
                        onClick={() => openAssignModal(order)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all text-sm"
                      >
                        🚚 Assign Delivery Agent & Mark Picked
                      </button>
                    )}
                    {order.status === "DISPATCHED" && order.pickedAt && !order.outForDeliveryAt && (
                      <button
                        onClick={async () => {
                          try {
                            await distributorOrdersApi.update(order._id, {
                              outForDeliveryAt: new Date().toISOString(),
                            });
                            toast.success("Order marked as Out for Delivery");
                            loadOrders(user.distributorId);
                          } catch (error: any) {
                            toast.error(error.message || "Failed to update status");
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
                      >
                        🚚 Mark Out for Delivery
                      </button>
                    )}
                    {order.status === "DISPATCHED" && order.outForDeliveryAt && (
                      <button
                        onClick={() => handleStatusUpdate(order._id, "DELIVERED")}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm"
                      >
                        ✅ Mark as Delivered
                      </button>
                    )}
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => handleStatusUpdate(order._id, "CANCELLED")}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all text-sm"
                      >
                        ✗ Cancel
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Assign Agent Modal */}
        {showAssignModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Assign Delivery Agent</h2>
              <form onSubmit={handleAssignAgent} className="space-y-4">
                {deliveryAgents.length > 0 ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Delivery Agent
                    </label>
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
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
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
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Agent Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={assignForm.agentName}
                        onChange={(e) => setAssignForm({ ...assignForm, agentName: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Agent Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={assignForm.agentPhone}
                        onChange={(e) => setAssignForm({ ...assignForm, agentPhone: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Assign Agent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedOrder(null);
                      setAssignForm({ agentId: "", agentName: "", agentPhone: "" });
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
      </motion.div>
    </Layout>
  );
}

