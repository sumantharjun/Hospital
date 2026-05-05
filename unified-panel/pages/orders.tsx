import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { OrdersIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

type OrderStatus = "PENDING" | "ORDER_RECEIVED" | "MEDICINE_RECEIVED" | "SENT_TO_PHARMACY" | "ACCEPTED" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

export default function OrdersPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const connectionErrorShownRef = useRef(false);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !t) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(storedUser));
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    fetchAllData();
  }, [token, filterStatus]);

  // Poll for order updates every 10 seconds (less frequent to reduce errors)
  useEffect(() => {
    if (!token) return;

    const pollInterval = setInterval(() => {
      fetchOrders(true); // Pass true to indicate it's a poll (silent)
    }, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [token]);

  const fetchAllData = async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ordersRes, pharmaciesRes, patientsRes] = await Promise.all([
        fetch(`${API_BASE}/api/orders`, { headers }),
        fetch(`${API_BASE}/api/master/pharmacies`, { headers }),
        fetch(`${API_BASE}/api/users?role=PATIENT`, { headers }),
      ]);
      
      setOrders(ordersRes.ok ? await ordersRes.json() : []);
      setPharmacies(pharmaciesRes.ok ? await pharmaciesRes.json() : []);
      setPatients(patientsRes.ok ? await patientsRes.json() : []);
    } catch (e) {
      if (!connectionErrorShownRef.current) {
        toast.error(
          <div>
            <div className="font-semibold">Cannot connect to backend server</div>
            <div className="text-sm text-gray-600 mt-1">Please make sure the backend server is running on port 4000</div>
          </div>,
          {
            duration: 5000,
          }
        );
        connectionErrorShownRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async (isPolling = false) => {
    if (!token) return;
    try {
      if (!isPolling) {
        setLoading(true);
      }
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/orders`, { headers });
      
      if (res.ok) {
        connectionErrorShownRef.current = false; // Reset error flag on success
        const data = await res.json();
        let filtered = Array.isArray(data) ? data : [];
        
        // Detect new orders (PENDING status) that weren't in previous list
        const currentOrderIds = new Set(filtered.map((o: any) => o._id));
        const newPendingOrders = filtered.filter((o: any) => 
          o.status === "PENDING" && !previousOrderIdsRef.current.has(o._id)
        );
        
        // Show toast for new pending orders (only if not initial load and not polling)
        if (!isPolling && previousOrderIdsRef.current.size > 0 && newPendingOrders.length > 0) {
          newPendingOrders.forEach((order: any) => {
            toast.success(
              <div>
                <div className="font-semibold">📦 New Order Received!</div>
                <div className="text-sm text-gray-600 mt-1">Order #{order._id.slice(-8)} is waiting for approval</div>
              </div>,
              {
                duration: 5000,
              }
            );
          });
        }
        
        // Update previous order IDs
        previousOrderIdsRef.current = currentOrderIds;
        
        setOrders(filtered);
      } else {
        if (!isPolling && !connectionErrorShownRef.current) {
          toast.error("Failed to fetch orders");
        }
      }
    } catch (e: any) {
      // Only show error on initial load, not during polling
      if (!isPolling && !connectionErrorShownRef.current) {
        if (e.message?.includes("Failed to fetch") || e.message?.includes("ERR_CONNECTION_REFUSED")) {
          toast.error(
            <div>
              <div className="font-semibold">Cannot connect to backend server</div>
              <div className="text-sm text-gray-600 mt-1">Please make sure the backend server is running on port 4000</div>
            </div>,
            {
              duration: 5000,
            }
          );
          connectionErrorShownRef.current = true;
        } else {
          toast.error("Failed to load orders");
        }
      }
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  };

  const getPatientName = (patientId: string) => {
    if (!patientId) return "";
    const patient = patients.find(p => p._id === patientId || p.id === patientId);
    return patient?.name || "";
  };

  const getPharmacyName = (pharmacyId: string) => {
    if (!pharmacyId) return "";
    const pharmacy = pharmacies.find(p => p._id === pharmacyId || p.id === pharmacyId);
    return pharmacy?.name || "";
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "ORDER_RECEIVED":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "MEDICINE_RECEIVED":
        return "bg-cyan-100 text-cyan-700 border-cyan-300";
      case "SENT_TO_PHARMACY":
        return "bg-purple-100 text-purple-700 border-purple-300";
      case "ACCEPTED":
        return "bg-green-100 text-green-700 border-green-300";
      case "PACKED":
        return "bg-amber-100 text-amber-700 border-amber-300";
      case "OUT_FOR_DELIVERY":
        return "bg-indigo-100 text-indigo-700 border-indigo-300";
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-700 border-emerald-300";
      case "CANCELLED":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return "⏳ Pending";
      case "ORDER_RECEIVED":
        return "📋 Order Received";
      case "MEDICINE_RECEIVED":
        return "📦 Medicine Received";
      case "SENT_TO_PHARMACY":
        return "🚚 Sent to Pharmacy";
      case "ACCEPTED":
        return "✅ Accepted";
      case "PACKED":
        return "📦 Packed";
      case "OUT_FOR_DELIVERY":
        return "🚗 Out for Delivery";
      case "DELIVERED":
        return "✓ Delivered";
      case "CANCELLED":
        return "❌ Cancelled";
      default:
        return status.replace(/_/g, " ");
    }
  };

  if (!user) return null;

  // Apply filters
  let filteredOrders = [...orders];
  
  // Filter by status
  if (filterStatus !== "ALL") {
    filteredOrders = filteredOrders.filter((o: any) => o.status === filterStatus);
  }
  
  // Filter by search query
  if (searchQuery) {
    filteredOrders = filteredOrders.filter((o: any) => {
      const orderId = o._id?.slice(-8) || "";
      const patientName = getPatientName(o.patientId) || "";
      const pharmacyName = getPharmacyName(o.pharmacyId) || "";
      const searchLower = searchQuery.toLowerCase();
      return (
        orderId.toLowerCase().includes(searchLower) ||
        patientName.toLowerCase().includes(searchLower) ||
        pharmacyName.toLowerCase().includes(searchLower) ||
        o.items?.some((item: any) => 
          item.medicineName?.toLowerCase().includes(searchLower)
        )
      );
    });
  }

  return (
    <Layout user={user} currentPage="orders">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
              Order Management
            </h2>
            <p className="text-sm text-gray-600">
              Real-time monitoring of all patient orders across pharmacies and distributors
            </p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Search Bar */}
      <AnimatedCard delay={0.1} className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by order ID, patient name, pharmacy, or medicine..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 pl-10 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-900 transition-all bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </AnimatedCard>

      {/* Status Filters */}
      <AnimatedCard delay={0.2} className="mb-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-2">Filter by Status:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "ALL", label: "All Orders", activeClass: "bg-gray-600" },
              { value: "PENDING", label: "Pending", activeClass: "bg-gray-600" },
              { value: "ORDER_RECEIVED", label: "Order Received", activeClass: "bg-blue-600" },
              { value: "MEDICINE_RECEIVED", label: "Medicine Received", activeClass: "bg-cyan-600" },
              { value: "SENT_TO_PHARMACY", label: "Sent to Pharmacy", activeClass: "bg-purple-600" },
              { value: "ACCEPTED", label: "Accepted", activeClass: "bg-green-600" },
              { value: "PACKED", label: "Packed", activeClass: "bg-amber-600" },
              { value: "OUT_FOR_DELIVERY", label: "Out for Delivery", activeClass: "bg-indigo-600" },
              { value: "DELIVERED", label: "Delivered", activeClass: "bg-emerald-600" },
              { value: "CANCELLED", label: "Cancelled", activeClass: "bg-red-600" },
            ].map((status) => (
              <motion.button
                key={status.value}
                onClick={() => setFilterStatus(status.value)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === status.value
                    ? `${status.activeClass} text-white shadow-md`
                    : "bg-white text-gray-700 border border-gray-300 hover:border-gray-400"
                }`}
              >
                {status.label}
              </motion.button>
            ))}
          </div>
        </div>
      </AnimatedCard>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredOrders.map((o, idx) => (
            <AnimatedCard key={o._id} delay={idx * 0.1}>
              <div className="p-6 border border-gray-300 rounded-lg bg-white hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <span className="text-2xl">📦</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">Order #{o._id.slice(-8)}</h3>
                      <p className="text-xs text-gray-500">
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : "N/A"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-lg font-medium border ${getStatusColor(o.status)}`}>
                    {getStatusBadge(o.status)}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  {getPatientName(o.patientId) && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">👤</span>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Patient:</span> {getPatientName(o.patientId)}
                      </p>
                    </div>
                  )}
                  {getPharmacyName(o.pharmacyId) && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">💊</span>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Pharmacy:</span> {getPharmacyName(o.pharmacyId)}
                      </p>
                    </div>
                  )}
                  {o.items && o.items.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Medicines:</p>
                      <div className="space-y-1">
                        {o.items.map((it: any, itemIdx: number) => (
                          <div key={itemIdx} className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                            {it.medicineName} <span className="text-gray-400">× {it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {o.deliveryType && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">🚚</span>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Delivery:</span> {o.deliveryType}
                      </p>
                    </div>
                  )}
                  {o.address && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400">📍</span>
                      <p className="text-sm text-gray-600 flex-1">{o.address}</p>
                    </div>
                  )}
                  {o.totalAmount && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">💰</span>
                      <p className="text-sm text-gray-600 font-semibold">
                        Total: ₹{o.totalAmount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status Timeline */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        o.status === "DELIVERED" ? "bg-green-500" :
                        o.status === "CANCELLED" ? "bg-red-500" :
                        o.status === "OUT_FOR_DELIVERY" || o.status === "PACKED" ? "bg-blue-500" :
                        o.status === "ACCEPTED" || o.status === "SENT_TO_PHARMACY" ? "bg-purple-500" :
                        o.status === "MEDICINE_RECEIVED" ? "bg-cyan-500" :
                        o.status === "ORDER_RECEIVED" ? "bg-blue-500" :
                        "bg-gray-400"
                      } animate-pulse`} />
                      <span className="text-xs text-gray-500">
                        {o.status === "PENDING" && "Waiting for admin approval"}
                        {o.status === "ORDER_RECEIVED" && "Order received by admin"}
                        {o.status === "MEDICINE_RECEIVED" && "Medicine received from supplier"}
                        {o.status === "SENT_TO_PHARMACY" && "Sent to pharmacy for processing"}
                        {o.status === "ACCEPTED" && "Pharmacy accepted order"}
                        {o.status === "PACKED" && "Order packed and ready"}
                        {o.status === "OUT_FOR_DELIVERY" && "Out for delivery"}
                        {o.status === "DELIVERED" && "Successfully delivered"}
                        {o.status === "CANCELLED" && "Order cancelled"}
                      </span>
                    </div>
                    {o.updatedAt && (
                      <span className="text-xs text-gray-400">
                        Updated: {new Date(o.updatedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </AnimatedCard>
          ))}
          
          {filteredOrders.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-lg text-gray-600 font-medium mb-2">No orders found</p>
              <p className="text-sm text-gray-500">
                {searchQuery || filterStatus !== "ALL" 
                  ? "Try adjusting your search or filter" 
                  : "Orders will appear here when patients place them"}
              </p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
