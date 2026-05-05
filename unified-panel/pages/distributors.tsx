import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import StatCard from "../components/StatCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function DistributorsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    const fetchOrders = async () => {
      try {
      const res = await fetch(`${API_BASE}/api/distributor-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(res.ok ? await res.json() : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [token]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "ACCEPTED":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "DISPATCHED":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "DELIVERED":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      default:
        return "bg-slate-700/20 text-slate-300 border-slate-700/30";
    }
  };

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!user) return null;

  return (
    <Layout user={user} currentPage="distributors">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
          Distributor Orders
        </h2>
        <p className="text-xs sm:text-sm text-indigo-300/70">
        Monitor restock orders generated when pharmacy stock falls below thresholds.
      </p>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <StatCard
              title="Total Orders"
              value={orders.length}
              gradient="bg-gradient-to-br from-slate-800 to-slate-900"
              shadowColor="shadow-emerald-500/20"
              delay={0.1}
            />
            <StatCard
              title="Pending"
              value={statusCounts["PENDING"] || 0}
              gradient="bg-gradient-to-br from-amber-500 to-orange-500"
              shadowColor="shadow-amber-500/50"
              delay={0.2}
            />
            <StatCard
              title="In Transit"
              value={(statusCounts["ACCEPTED"] || 0) + (statusCounts["DISPATCHED"] || 0)}
              gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
              shadowColor="shadow-blue-500/50"
              delay={0.3}
            />
            <StatCard
              title="Delivered"
              value={statusCounts["DELIVERED"] || 0}
              gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
              shadowColor="shadow-emerald-500/50"
              delay={0.4}
            />
          </div>

          <AnimatedCard delay={0.5}>
            <h3 className="text-lg font-semibold mb-4 text-emerald-300">All Orders</h3>
            <div className="max-h-[600px] overflow-y-auto space-y-3">
              {orders.map((o, idx) => (
                <motion.div
              key={o._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border border-indigo-900/30 rounded-xl p-4 bg-slate-950/30 hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <p className="font-semibold text-sm text-indigo-100 break-words">{o.medicineName}</p>
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium whitespace-nowrap ${getStatusColor(o.status)}`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-400/60">
                        Quantity: <span className="text-indigo-200 font-medium">{o.quantity}</span>
                      </p>
                      <p className="text-xs text-indigo-400/60 mt-1">
                        Pharmacy: <span className="text-indigo-200">{o.pharmacyId?.slice(-8)}</span>
                      </p>
                      <p className="text-xs text-indigo-400/60 mt-1">
                        Distributor: <span className="text-indigo-200">{o.distributorId?.slice(-8)}</span>
                      </p>
                      {o.createdAt && (
                        <p className="text-xs text-indigo-400/50 mt-2">
                          Created: {new Date(o.createdAt).toLocaleString()}
                </p>
                      )}
                      {o.deliveryOtp && (
                        <p className="text-xs text-emerald-300 mt-2">
                          📱 Delivery OTP: <span className="font-mono font-bold">{o.deliveryOtp}</span>
                        </p>
                      )}
                      {o.deliveryProofImageUrl && (
                        <a
                          href={o.deliveryProofImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-300 hover:text-blue-200 mt-2 inline-block underline"
                        >
                          📷 View Proof of Delivery
                        </a>
                      )}
                      {o.status === "DISPATCHED" && (
                        <p className="text-xs text-purple-300 mt-2">🚚 Out for delivery</p>
                      )}
              </div>
            </div>
                </motion.div>
          ))}
          {orders.length === 0 && (
                <p className="text-sm text-indigo-400/60 text-center py-8">
                  No distributor orders yet. They will appear automatically once inventory consumption triggers thresholds.
            </p>
          )}
        </div>
          </AnimatedCard>
        </>
      )}
    </Layout>
  );
}
