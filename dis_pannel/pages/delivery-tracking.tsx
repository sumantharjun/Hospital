import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { distributorOrdersApi } from "@/services/api";
import { getUser } from "@/utils/auth";
import { DistributorOrder } from "@/types";
import { DISTRIBUTOR_ORDER_STATUSES } from "@/utils/constants";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";

export default function DeliveryTrackingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<DistributorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    if (currentUser.distributorId) {
      loadDeliveryOrders(currentUser.distributorId);
    }

    // Socket is already initialized in _app.tsx, just listen to events
    const socket = getSocket();
    const distributorId = currentUser.distributorId;
    if (socket && distributorId) {
      const handleStatusUpdated = (data: any) => {
        if (data.distributorId === distributorId) {
          toast.success("Order status updated in real-time!");
          loadDeliveryOrders(distributorId);
        }
      };

      const handleOrderCreated = (data: any) => {
        if (data.distributorId === distributorId) {
          toast.success("New purchase request received!");
          loadDeliveryOrders(distributorId);
        }
      };

      onSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);
      onSocketEvent("distributorOrder:created", handleOrderCreated);

      return () => {
        offSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);
        offSocketEvent("distributorOrder:created", handleOrderCreated);
      };
    }
  }, [router]);

  useEffect(() => {
    let filtered = orders.filter(
      (order) => order.status === "DISPATCHED" || order.status === "DELIVERED"
    );

    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.deliveryAgentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.medicineName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm]);

  const loadDeliveryOrders = async (distributorId: string) => {
    try {
      const data = await distributorOrdersApi.getAll(distributorId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load delivery orders");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (
    orderId: string,
    status: "OUT_FOR_DELIVERY" | "DELIVERED"
  ) => {
    if (!user?.distributorId) return;

    try {
      const result = await distributorOrdersApi.updateDeliveryStatus(orderId, status);
      
      // Emit socket event for real-time update
      const socket = getSocket();
      if (socket) {
        socket.emit("distributorOrder:statusUpdated", {
          orderId,
          status: status === "OUT_FOR_DELIVERY" ? "DISPATCHED" : "DELIVERED",
          distributorId: user.distributorId,
        });
      }
      
      toast.success(`Delivery status updated to ${status === "DELIVERED" ? "Delivered" : "Out for Delivery"}`);
      loadDeliveryOrders(user.distributorId);
    } catch (error: any) {
      toast.error(error.message || "Failed to update delivery status");
    }
  };

  if (!user) return null;

  const activeDeliveries = orders.filter((o) => o.status === "DISPATCHED");
  const deliveredToday = orders.filter((o) => {
    if (o.status !== "DELIVERED" || !o.deliveredAt) return false;
    const today = new Date().toISOString().split("T")[0];
    const deliveredDate = new Date(o.deliveredAt).toISOString().split("T")[0];
    return deliveredDate === today;
  });

  return (
    <Layout user={user} currentPage="delivery-tracking">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Delivery Tracking</h1>
            <p className="text-gray-600">Track delivery agents in real-time</p>
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
              onClick={() => user?.distributorId && loadDeliveryOrders(user.distributorId)}
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
              <span className="text-gray-600 text-sm font-medium">Active Deliveries</span>
              <span className="text-2xl">🚚</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{activeDeliveries.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Delivered Today</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{deliveredToday.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Tracked</span>
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{filteredOrders.length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <input
            type="text"
            placeholder="Search by order ID, agent name, or medicine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
          />
        </div>

        {/* Delivery Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No delivery orders found</p>
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
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString()
                            : "Date not available"}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          DISTRIBUTOR_ORDER_STATUSES[order.status]?.color ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {DISTRIBUTOR_ORDER_STATUSES[order.status]?.label || order.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Medicine:</span> {order.medicineName}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Quantity:</span> {order.quantity} units
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Pharmacy ID:</span> {order.pharmacyId}
                      </p>
                      {order.deliveryAgentName && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-semibold text-blue-900 mb-1">Delivery Agent:</p>
                          <p className="text-sm text-blue-700">Name: {order.deliveryAgentName}</p>
                          {order.deliveryAgentPhone && (
                            <p className="text-sm text-blue-700">Phone: {order.deliveryAgentPhone}</p>
                          )}
                          {order.pickedAt && (
                            <p className="text-sm text-blue-700">
                              Picked: {new Date(order.pickedAt).toLocaleString()}
                            </p>
                          )}
                          {order.outForDeliveryAt && (
                            <p className="text-sm text-blue-700">
                              Out for Delivery: {new Date(order.outForDeliveryAt).toLocaleString()}
                            </p>
                          )}
                          {order.deliveredAt && (
                            <p className="text-sm text-blue-700">
                              Delivered: {new Date(order.deliveredAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:min-w-[200px]">
                    {/* Status Flow: Picked → Out For Delivery → Delivered */}
                    {order.status === "DISPATCHED" && !order.outForDeliveryAt && (
                      <button
                        onClick={() => handleStatusUpdate(order._id, "OUT_FOR_DELIVERY")}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
                      >
                        🚚 Mark Out for Delivery
                      </button>
                    )}
                    {order.status === "DISPATCHED" && order.outForDeliveryAt && !order.deliveredAt && (
                      <button
                        onClick={() => handleStatusUpdate(order._id, "DELIVERED")}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm"
                      >
                        ✅ Mark as Delivered
                      </button>
                    )}
                    {order.status === "DELIVERED" && (
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-sm font-semibold text-green-900">✓ Delivered</p>
                        {order.deliveredAt && (
                          <p className="text-xs text-green-700 mt-1">
                            {new Date(order.deliveredAt).toLocaleString()}
                          </p>
                        )}
                      </div>
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

