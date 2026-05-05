import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

type OrderStatus = "PENDING" | "ORDER_RECEIVED" | "MEDICINE_RECEIVED" | "SENT_TO_PHARMACY" | "ACCEPTED" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

export default function PharmacyPanelPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [pharmacyId, setPharmacyId] = useState("");
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"prescriptions" | "orders">("prescriptions");
  const [loading, setLoading] = useState(false);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<any | null>(null);
  const [deliveryPersonName, setDeliveryPersonName] = useState("");
  const [deliveryPersonPhone, setDeliveryPersonPhone] = useState("");
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState("");

  // Blur any focused elements when modal opens (fixes aria-hidden accessibility issue)
  useEffect(() => {
    if (selectedOrderForDelivery) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
    }
  }, [selectedOrderForDelivery]);

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

  // Helper function to validate MongoDB ObjectId format
  const isValidObjectId = (id: string): boolean => {
    return /^[0-9a-fA-F]{24}$/.test(id.trim());
  };

  const loadData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pharmacyId) return;
    
    // Validate pharmacy ID format
    const trimmedId = pharmacyId.trim();
    if (!isValidObjectId(trimmedId)) {
      toast.error("Invalid Pharmacy ID format. Please enter a valid 24-character MongoDB ObjectId.");
      return;
    }
    
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [pRes, oRes] = await Promise.all([
        fetch(`${API_BASE}/api/prescriptions/by-pharmacy/${trimmedId}`, { headers }),
        fetch(`${API_BASE}/api/orders/by-pharmacy/${trimmedId}`, { headers }),
      ]);
      
      // Handle prescriptions response
      let prescriptionsData: any[] = [];
      if (!pRes.ok) {
        const errorData = await pRes.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Failed to fetch prescriptions (${pRes.status})`;
        console.error("Failed to fetch prescriptions:", pRes.status, errorData);
        toast.error(errorMessage);
        setPrescriptions([]);
      } else {
        prescriptionsData = await pRes.json().catch(() => []);
        setPrescriptions(Array.isArray(prescriptionsData) ? prescriptionsData : []);
      }
      
      // Handle orders response
      let ordersData: any[] = [];
      if (!oRes.ok) {
        const errorData = await oRes.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Failed to fetch orders (${oRes.status})`;
        console.error("Failed to fetch orders:", oRes.status, errorData);
        toast.error(errorMessage);
        setOrders([]);
      } else {
        ordersData = await oRes.json().catch(() => []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      }
      
      // Show success message only if both requests succeeded
      if (pRes.ok && oRes.ok) {
        const presCount = Array.isArray(prescriptionsData) ? prescriptionsData.length : 0;
        const orderCount = Array.isArray(ordersData) ? ordersData.length : 0;
        toast.success(`Loaded ${presCount} prescriptions and ${orderCount} orders`);
      }
    } catch (e: any) {
      console.error("Error loading data:", e);
      toast.error(`Failed to load data: ${e.message || "Unknown error"}`);
      setPrescriptions([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllOrders = async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/orders`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAllOrders(Array.isArray(data) ? data : []);
        console.log(`Fetched ${data.length} total orders`);
      } else {
        console.error("Failed to fetch all orders:", res.status);
      }
    } catch (e) {
      console.error("Error fetching all orders:", e);
    }
  };

  const updateOrderStatus = async (id: string, status: OrderStatus, deliveryData?: any) => {
    if (!token) return;
    try {
      const body: any = { status };
      if (deliveryData) {
        if (deliveryData.deliveryPersonName) body.deliveryPersonName = deliveryData.deliveryPersonName;
        if (deliveryData.deliveryPersonPhone) body.deliveryPersonPhone = deliveryData.deliveryPersonPhone;
        if (deliveryData.estimatedDeliveryTime) body.estimatedDeliveryTime = deliveryData.estimatedDeliveryTime;
        if (deliveryData.deliveryNotes) body.deliveryNotes = deliveryData.deliveryNotes;
      }
      
    const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
        body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
        toast.success(`Order status updated to ${status}`);
        setSelectedOrderForDelivery(null);
        setDeliveryPersonName("");
        setDeliveryPersonPhone("");
        setEstimatedDeliveryTime("");
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.message || "Failed to update order status");
      }
    } catch (e: any) {
      toast.error(`Error updating order: ${e.message || "Unknown error"}`);
    }
  };

  const handleStatusUpdate = (order: any, status: OrderStatus) => {
    if (status === "OUT_FOR_DELIVERY" && order.deliveryType === "DELIVERY") {
      // Show delivery assignment modal
      setSelectedOrderForDelivery(order);
    } else {
      // Direct status update
      updateOrderStatus(order._id, status);
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="pharmacy">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
          Pharmacy Panel
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        View prescriptions assigned to a pharmacy and manage medicine orders & delivery status.
      </p>
      </motion.header>

      {/* Pharmacy ID Input Section */}
      <AnimatedCard delay={0.1} className="mb-6">
        <form onSubmit={loadData} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
            placeholder="Enter Pharmacy ID"
            className="flex-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
          value={pharmacyId}
          onChange={(e) => setPharmacyId(e.target.value)}
          required
        />
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              "Load Data"
            )}
          </motion.button>
      </form>
      </AnimatedCard>

      {/* Debug Section - Show all orders */}
      <AnimatedCard delay={0.15} className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <span>🔍</span>
            <span>Debug: All Orders</span>
          </h3>
          <motion.button
            onClick={() => {
              setShowDebug(!showDebug);
              if (!showDebug && token) {
                fetchAllOrders();
              }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition-all"
          >
            {showDebug ? "Hide" : "Show"} All Orders
          </motion.button>
        </div>
        {showDebug && (
          <div className="mt-4 max-h-[400px] overflow-y-auto space-y-3 rounded-lg border border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-900/50">
            {allOrders.length > 0 ? (
              <>
                <div className="mb-3 pb-2 border-b border-gray-300 dark:border-slate-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total Orders: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{allOrders.length}</span>
                  </p>
                </div>
                {Object.entries(
                  allOrders.reduce((acc: any, order: any) => {
                    const phId = order.pharmacyId || "NO_PHARMACY";
                    if (!acc[phId]) acc[phId] = [];
                    acc[phId].push(order);
                    return acc;
                  }, {})
                ).map(([phId, ordersList]: [string, any]) => (
                  <div key={phId} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                    <p className="text-sm font-semibold text-gray-900 dark:text-emerald-400 mb-2">
                      Pharmacy: <span className="text-gray-700 dark:text-gray-300 font-normal">{phId}</span> 
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({ordersList.length} orders)</span>
                    </p>
                    <div className="space-y-1">
                      {ordersList.slice(0, 3).map((o: any) => (
                        <p key={o._id} className="text-xs text-gray-600 dark:text-gray-400">
                          Order #{o._id.slice(-8)} - Status: <span className="font-medium">{o.status}</span> - Patient: {o.patientId?.slice(-8)}
                        </p>
                      ))}
                      {ordersList.length > 3 && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">... and {ordersList.length - 3} more</p>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No orders found in system</p>
            )}
          </div>
        )}
      </AnimatedCard>

      {pharmacyId && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 sm:gap-3 mb-6 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
            {(["prescriptions", "orders"] as const).map((tab) => (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-4 sm:px-6 py-2 sm:py-3 font-semibold text-xs sm:text-sm transition-all relative whitespace-nowrap ${
                  activeTab === tab
                    ? "text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500"
                    : "text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                }`}
              >
                {tab === "prescriptions" ? "💊 Prescriptions" : "📦 Orders"}
              </motion.button>
            ))}
          </div>

          {activeTab === "prescriptions" ? (
            <AnimatedCard delay={0.2}>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-emerald-400">
                Prescriptions for Pharmacy {pharmacyId}
              </h3>
              <div className="max-h-[600px] overflow-y-auto space-y-3">
                {prescriptions.map((p, idx) => (
                  <motion.div
                    key={p._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white break-words">
                          Prescription #{p._id.slice(-8)}
                    </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">
                          Patient: {p.patientId?.slice(-8)} · Doctor: {p.doctorId?.slice(-8)}
                    </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                        Active
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {p.items?.map((it: any, idx: number) => (
                        <div key={idx} className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-900/50 rounded-md p-2 border border-gray-200 dark:border-slate-700">
                          <span className="font-medium">{it.medicineName}</span>
                          <span className="text-gray-500 dark:text-gray-500 ml-2">
                            · {it.dosage} · {it.frequency} · {it.duration}
                          </span>
                        </div>
                      ))}
                  </div>
                  </motion.div>
                ))}
                {prescriptions.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No prescriptions assigned to this pharmacy yet.
                  </p>
                )}
              </div>
            </AnimatedCard>
          ) : (
            <AnimatedCard delay={0.2}>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-emerald-400">
                Orders for Pharmacy {pharmacyId}
              </h3>
              <div className="max-h-[600px] overflow-y-auto space-y-3">
                {orders.map((o, idx) => (
                  <motion.div
                    key={o._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white break-words">
                          Order #{o._id.slice(-8)}
                      </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">
                          Patient: {o.patientId?.slice(-8)} · Delivery: {o.deliveryType}
                        </p>
                        <div className="mt-2 space-y-1">
                        {o.items?.map((it: any, idx: number) => (
                            <div key={idx} className="text-xs text-gray-700 dark:text-gray-300">
                            {it.medicineName} × {it.quantity}
                            </div>
                        ))}
                        </div>
                      </div>
                      <div className="sm:ml-4 flex flex-col gap-2 flex-shrink-0">
                        <span className={`text-xs px-3 py-1 rounded-md font-medium whitespace-nowrap ${
                          o.status === "DELIVERED" ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30" :
                          o.status === "OUT_FOR_DELIVERY" ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-500/30" :
                          o.status === "PACKED" ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30" :
                          o.status === "ACCEPTED" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-500/30" :
                          o.status === "SENT_TO_PHARMACY" ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-500/30" :
                          o.status === "MEDICINE_RECEIVED" ? "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/30" :
                          o.status === "ORDER_RECEIVED" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30" :
                          "bg-gray-100 dark:bg-slate-700/20 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700/30"
                        }`}>
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    {/* Delivery Info Display */}
                    {o.deliveryType === "DELIVERY" && o.address && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-slate-900/50 rounded-md border border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400">📍 Delivery Address:</p>
                        <p className="text-xs text-gray-900 dark:text-white mt-1">{o.address}</p>
                        {o.deliveryPersonName && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            🚚 Delivery Person: {o.deliveryPersonName}
                            {o.deliveryPersonPhone && ` (${o.deliveryPersonPhone})`}
                          </p>
                        )}
                        {o.estimatedDeliveryTime && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            ⏰ ETA: {new Date(o.estimatedDeliveryTime).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {/* Pharmacy can only update orders that are SENT_TO_PHARMACY or later */}
                      {o.status === "SENT_TO_PHARMACY" && (
                        <motion.button
                          onClick={() => handleStatusUpdate(o, "ACCEPTED")}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-3 py-1.5 rounded-md bg-green-100 dark:bg-green-500/20 hover:bg-green-200 dark:hover:bg-green-500/30 border border-green-300 dark:border-green-500/30 text-xs font-medium text-green-700 dark:text-green-400 transition-all"
                        >
                          ✅ ACCEPT
                        </motion.button>
                      )}
                      {["ACCEPTED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"].map((st) => {
                        // Only show status buttons if order is at appropriate stage
                        if (o.status === "SENT_TO_PHARMACY" && st === "ACCEPTED") {
                          return null; // Already shown above
                        }
                        if (o.status === "PENDING" || o.status === "ORDER_RECEIVED" || o.status === "MEDICINE_RECEIVED") {
                          return null; // Pharmacy can't update these
                        }
                        const canUpdate = 
                          (o.status === "ACCEPTED" && st === "PACKED") ||
                          (o.status === "PACKED" && st === "OUT_FOR_DELIVERY") ||
                          (o.status === "OUT_FOR_DELIVERY" && st === "DELIVERED");
                        
                        if (!canUpdate && o.status !== st) return null;
                        
                        return (
                          <motion.button
                            key={st}
                            onClick={() => handleStatusUpdate(o, st as OrderStatus)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-slate-700/50 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-gray-300 dark:border-slate-600 hover:border-emerald-500 dark:hover:border-emerald-500/30 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
                          >
                          {st.replace(/_/g, " ")}
                        </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
                {orders.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No orders for this pharmacy yet.
                  </p>
                )}
              </div>
            </AnimatedCard>
          )}
        </>
      )}

      {/* Delivery Assignment Modal */}
      {selectedOrderForDelivery && (
        <div 
          className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-assignment-title"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 max-w-md w-full border border-gray-200 dark:border-slate-700 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h3 id="delivery-assignment-title" className="text-lg font-semibold text-gray-900 dark:text-emerald-400 mb-4">
              🚚 Assign Delivery Person
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Order #{selectedOrderForDelivery._id.slice(-8)} - {selectedOrderForDelivery.deliveryType}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Delivery Person Name *</label>
                <input
                  type="text"
                  value={deliveryPersonName}
                  onChange={(e) => setDeliveryPersonName(e.target.value)}
                  placeholder="Enter delivery person name"
                  className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Contact Phone *</label>
                <input
                  type="tel"
                  value={deliveryPersonPhone}
                  onChange={(e) => setDeliveryPersonPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Estimated Delivery Time</label>
                <input
                  type="datetime-local"
                  value={estimatedDeliveryTime}
                  onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <motion.button
                onClick={() => {
                  setSelectedOrderForDelivery(null);
                  setDeliveryPersonName("");
                  setDeliveryPersonPhone("");
                  setEstimatedDeliveryTime("");
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={() => {
                  if (!deliveryPersonName || !deliveryPersonPhone) {
                    toast.error("Please fill all required fields");
                    return;
                  }
                  updateOrderStatus(selectedOrderForDelivery._id, "OUT_FOR_DELIVERY", {
                    deliveryPersonName,
                    deliveryPersonPhone,
                    estimatedDeliveryTime: estimatedDeliveryTime || undefined,
                  });
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-semibold shadow-md transition-all"
              >
                Assign & Dispatch
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
