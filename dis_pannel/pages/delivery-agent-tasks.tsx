import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";
import Layout from "@/components/Layout";
import { distributorOrdersApi, getAuthHeaders } from "@/services/api";
import { getUser } from "@/utils/auth";
import { DistributorOrder } from "@/types";
import { DISTRIBUTOR_ORDER_STATUSES, API_BASE } from "@/utils/constants";

export default function DeliveryAgentTasksPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<DistributorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "ASSIGNED" | "DISPATCHED" | "DELIVERED">("all");
  const [selectedOrder, setSelectedOrder] = useState<DistributorOrder | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofImage, setProofImage] = useState<string>("");

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    
    // Load orders assigned to this delivery agent
    const agentId = (currentUser as any).deliveryAgentId || (currentUser as any)._id || currentUser.id;
    if (agentId) {
      loadAgentOrders(agentId);
    }

    // Socket is already initialized in _app.tsx, just listen to events
    const socket = getSocket();
    if (socket) {
      const handleStatusUpdated = (data: any) => {
        const agentId = (currentUser as any).deliveryAgentId || (currentUser as any)._id || currentUser.id;
        if (data.deliveryAgentId === agentId && agentId) {
          loadAgentOrders(agentId);
        }
      };

      onSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);

      return () => {
        offSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);
      };
    }
  }, [router]);

  useEffect(() => {
    let filtered = [...orders];

    if (statusFilter !== "all") {
      if (statusFilter === "ASSIGNED") {
        filtered = filtered.filter((o) => o.status === "ACCEPTED" && o.deliveryAgentId);
      } else {
        filtered = filtered.filter((o) => o.status === statusFilter);
      }
    }

    setFilteredOrders(filtered);
  }, [orders, statusFilter]);

  const loadAgentOrders = async (agentId: string) => {
    setLoading(true);
    try {
      // Fetch all distributor orders and filter by deliveryAgentId
      // Note: You may need to create a specific API endpoint for this
      // For now, we'll fetch without distributorId filter and filter client-side
      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(authHeaders.Authorization && { Authorization: authHeaders.Authorization }),
      };
      
      const response = await fetch(`${API_BASE}/api/distributor-orders`, {
        headers,
      });
      
      if (response.ok) {
        const allOrders = await response.json();
        const agentOrders = Array.isArray(allOrders)
          ? allOrders.filter((order: any) => order.deliveryAgentId === agentId)
          : [];
        setOrders(agentOrders);
      } else {
        throw new Error("Failed to fetch orders");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load assigned orders");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTask = async (orderId: string) => {
    try {
      await distributorOrdersApi.update(orderId, {
        status: "ACCEPTED",
      });
      toast.success("Task accepted!");
      const agentId = (user as any)?.deliveryAgentId || (user as any)?._id || user?.id || "";
      if (agentId) loadAgentOrders(agentId);
    } catch (error: any) {
      toast.error(error.message || "Failed to accept task");
    }
  };

  const handleMarkPicked = async (orderId: string) => {
    try {
      await distributorOrdersApi.update(orderId, {
        status: "DISPATCHED",
        pickedAt: new Date().toISOString(),
      });
      toast.success("Order marked as picked up!");
      const agentId = (user as any)?.deliveryAgentId || (user as any)?._id || user?.id || "";
      if (agentId) loadAgentOrders(agentId);
    } catch (error: any) {
      toast.error(error.message || "Failed to mark as picked");
    }
  };

  const handleStartDelivery = async (orderId: string) => {
    try {
      // Get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setCurrentLocation(location);

            await distributorOrdersApi.update(orderId, {
              outForDeliveryAt: new Date().toISOString(),
              deliveryLocation: {
                latitude: location.lat,
                longitude: location.lng,
                timestamp: new Date().toISOString(),
              },
            });

            toast.success("Delivery started! Location tracking activated.");
            const agentId = (user as any)?.deliveryAgentId || (user as any)?._id || user?.id || "";
            if (agentId) loadAgentOrders(agentId);
            
            // Start continuous location tracking
            startLocationTracking(orderId);
          },
          (error) => {
            toast.error("Failed to get location. Please enable GPS.");
          }
        );
      } else {
        toast.error("Geolocation is not supported by your browser.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start delivery");
    }
  };

  const startLocationTracking = (orderId: string) => {
    // Update location every 30 seconds
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            try {
              await distributorOrdersApi.update(orderId, {
                deliveryLocation: {
                  latitude: location.lat,
                  longitude: location.lng,
                  timestamp: new Date().toISOString(),
                  accuracy: position.coords.accuracy,
                },
              });
            } catch (error) {
              console.error("Failed to update location:", error);
            }
          },
          (error) => {
            console.error("Location error:", error);
            clearInterval(interval);
          }
        );
      }
    }, 30000); // Update every 30 seconds

    // Store interval ID to clear it later
    return interval;
  };

  const handleMarkDelivered = async (orderId: string) => {
    if (!proofImage) {
      toast.error("Please upload proof of delivery image");
      return;
    }

    try {
      await distributorOrdersApi.update(orderId, {
        status: "DELIVERED",
        deliveredAt: new Date().toISOString(),
        deliveryProofImageUrl: proofImage,
      });
      toast.success("Order marked as delivered!");
      setShowProofModal(false);
      setProofImage("");
      setSelectedOrder(null);
      const agentId = (user as any)?.deliveryAgentId || (user as any)?._id || user?.id || "";
      if (agentId) loadAgentOrders(agentId);
    } catch (error: any) {
      toast.error(error.message || "Failed to mark as delivered");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getStatusColor = (status: string) => {
    return DISTRIBUTOR_ORDER_STATUSES[status as keyof typeof DISTRIBUTOR_ORDER_STATUSES]?.color || "bg-gray-100 text-gray-800";
  };

  if (!user) return null;

  const assignedCount = orders.filter((o) => o.status === "ACCEPTED" && o.deliveryAgentId).length;
  const dispatchedCount = orders.filter((o) => o.status === "DISPATCHED").length;
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length;

  return (
    <Layout user={user} currentPage="delivery-agent-tasks">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Delivery Tasks</h1>
            <p className="text-gray-600">View and manage your assigned delivery orders</p>
          </div>
          <button
            onClick={() => {
              const agentId = (user as any)?.deliveryAgentId || (user as any)?._id || user?.id || "";
              if (agentId) loadAgentOrders(agentId);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Assigned</span>
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{assignedCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">In Transit</span>
              <span className="text-2xl">🚚</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{dispatchedCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Delivered</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{deliveredCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <div className="flex gap-2">
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
            <button
              onClick={() => setStatusFilter("ASSIGNED")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                statusFilter === "ASSIGNED"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Assigned
            </button>
            <button
              onClick={() => setStatusFilter("DISPATCHED")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                statusFilter === "DISPATCHED"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              In Transit
            </button>
            <button
              onClick={() => setStatusFilter("DELIVERED")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                statusFilter === "DELIVERED"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Delivered
            </button>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No assigned tasks found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
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
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Pharmacy ID:</span> {order.pharmacyId.slice(-8)}
                      </p>
                      {order.pickedAt && (
                        <p className="text-sm text-gray-500">
                          Picked at: {new Date(order.pickedAt).toLocaleString()}
                        </p>
                      )}
                      {order.outForDeliveryAt && (
                        <p className="text-sm text-green-600">
                          Out for delivery: {new Date(order.outForDeliveryAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:min-w-[200px]">
                    {order.status === "ACCEPTED" && order.deliveryAgentId && (
                      <>
                        <button
                          onClick={() => handleMarkPicked(order._id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
                        >
                          ✓ Mark Picked Up
                        </button>
                      </>
                    )}
                    {order.status === "DISPATCHED" && !order.outForDeliveryAt && (
                      <button
                        onClick={() => handleStartDelivery(order._id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm"
                      >
                        🚀 Start Delivery
                      </button>
                    )}
                    {order.status === "DISPATCHED" && order.outForDeliveryAt && (
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowProofModal(true);
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all text-sm"
                      >
                        ✓ Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Proof of Delivery Modal */}
        {showProofModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Mark as Delivered</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Upload Proof of Delivery
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                  {proofImage && (
                    <img
                      src={proofImage}
                      alt="Proof of delivery"
                      className="mt-2 w-full h-48 object-cover rounded-lg"
                    />
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleMarkDelivered(selectedOrder._id)}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
                    disabled={!proofImage}
                  >
                    Confirm Delivery
                  </button>
                  <button
                    onClick={() => {
                      setShowProofModal(false);
                      setProofImage("");
                      setSelectedOrder(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

