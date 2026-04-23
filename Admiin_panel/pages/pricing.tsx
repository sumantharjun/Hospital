import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function PricingPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [pricing, setPricing] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPricing, setNewPricing] = useState({
    serviceType: "CONSULTATION",
    hospitalId: "",
    pharmacyId: "",
    basePrice: 0,
    discountPercent: 0,
    discountAmount: 0,
    isActive: true,
    validFrom: "",
    validTo: "",
  });

  // Blur any focused elements when modal opens (fixes aria-hidden accessibility issue)
  useEffect(() => {
    if (showAddModal) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
    }
  }, [showAddModal]);

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
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [pRes, hRes, phRes] = await Promise.all([
          fetch(`${API_BASE}/api/pricing`, { headers }),
          fetch(`${API_BASE}/api/master/hospitals`, { headers }),
          fetch(`${API_BASE}/api/master/pharmacies`, { headers }),
        ]);
        setPricing(pRes.ok ? await pRes.json() : []);
        setHospitals(hRes.ok ? await hRes.json() : []);
        setPharmacies(phRes.ok ? await phRes.json() : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const createPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const payload: any = {
        serviceType: newPricing.serviceType,
        basePrice: Number(newPricing.basePrice),
        isActive: newPricing.isActive,
      };
      if (newPricing.hospitalId) payload.hospitalId = newPricing.hospitalId;
      if (newPricing.pharmacyId) payload.pharmacyId = newPricing.pharmacyId;
      if (newPricing.discountPercent) payload.discountPercent = Number(newPricing.discountPercent);
      if (newPricing.discountAmount) payload.discountAmount = Number(newPricing.discountAmount);
      if (newPricing.validFrom) payload.validFrom = new Date(newPricing.validFrom);
      if (newPricing.validTo) payload.validTo = new Date(newPricing.validTo);

      const res = await fetch(`${API_BASE}/api/pricing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setPricing((prev) => [created, ...prev]);
        setNewPricing({
          serviceType: "CONSULTATION",
          hospitalId: "",
          pharmacyId: "",
          basePrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          isActive: true,
          validFrom: "",
          validTo: "",
        });
        setShowAddModal(false);
        toast.success("Pricing rule created successfully!");
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to create pricing rule");
      }
    } catch (e) {
      toast.error("Error creating pricing rule");
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/pricing/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        setPricing((prev) =>
          prev.map((p) => (p._id === id ? { ...p, isActive: !currentStatus } : p))
        );
        toast.success("Pricing rule updated!");
      }
    } catch (e) {
      toast.error("Error updating pricing rule");
    }
  };

  const deletePricing = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/pricing/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPricing((prev) => prev.filter((p) => p._id !== id));
        toast.success("Pricing rule deleted successfully!");
      } else {
        toast.error("Failed to delete pricing rule");
      }
    } catch (e) {
      toast.error("Error deleting pricing rule");
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="pricing">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
              Service Pricing Control
            </h2>
            <p className="text-xs sm:text-sm text-indigo-300/70">
              Manage consultation fees, delivery charges, discounts, and subscription rules.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/50 transition-all"
          >
            + Add Pricing Rule
          </motion.button>
        </div>
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
        <AnimatedCard delay={0.1}>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {pricing.map((p, idx) => (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border border-indigo-900/30 rounded-xl p-4 bg-slate-950/30 hover:border-emerald-500/30 transition-all"
              >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <span className="text-xs px-2 py-1 rounded-lg font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {p.serviceType}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-lg font-medium ${
                          p.isActive
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-red-500/20 text-red-300 border-red-500/30"
                        }`}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                      <p className="font-semibold text-sm text-indigo-100 mb-1 break-words">
                      Base Price: ₹{p.basePrice.toLocaleString()}
                    </p>
                    {(p.discountPercent || p.discountAmount) && (
                      <p className="text-xs text-emerald-300 mb-1">
                        Discount: {p.discountPercent ? `${p.discountPercent}%` : `₹${p.discountAmount}`}
                      </p>
                    )}
                    {p.hospitalId && (
                      <p className="text-xs text-indigo-400/50">🏥 Hospital: {p.hospitalId.slice(-8)}</p>
                    )}
                    {p.pharmacyId && (
                      <p className="text-xs text-indigo-400/50">💊 Pharmacy: {p.pharmacyId.slice(-8)}</p>
                    )}
                    {p.validFrom && (
                      <p className="text-xs text-indigo-400/50">
                        Valid: {new Date(p.validFrom).toLocaleDateString()} -{" "}
                        {p.validTo ? new Date(p.validTo).toLocaleDateString() : "∞"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:ml-4 w-full sm:w-auto">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleActive(p._id, p.isActive)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        p.isActive
                          ? "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
                      }`}
                    >
                      {p.isActive ? "Deactivate" : "Activate"}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => deletePricing(p._id)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition-all"
                    >
                      Delete
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
            {pricing.length === 0 && (
              <p className="text-sm text-indigo-400/60 text-center py-8">No pricing rules found</p>
            )}
          </div>
        </AnimatedCard>
      )}

      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-pricing-title"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 rounded-2xl border border-indigo-900/50 p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 id="add-pricing-title" className="text-xl font-bold text-emerald-300 mb-4">Add Pricing Rule</h3>
            <form onSubmit={createPricing} className="space-y-4">
              <select
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newPricing.serviceType}
                onChange={(e) => setNewPricing((prev) => ({ ...prev, serviceType: e.target.value }))}
                required
              >
                <option value="CONSULTATION">Consultation Fee</option>
                <option value="DELIVERY">Delivery Charge</option>
                <option value="SUBSCRIPTION">Subscription</option>
                <option value="DISCOUNT">Discount Rule</option>
              </select>
              <input
                type="number"
                placeholder="Base Price (₹)"
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newPricing.basePrice}
                onChange={(e) => setNewPricing((prev) => ({ ...prev, basePrice: Number(e.target.value) }))}
                required
                min="0"
                step="0.01"
              />
              <select
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newPricing.hospitalId}
                onChange={(e) => setNewPricing((prev) => ({ ...prev, hospitalId: e.target.value }))}
              >
                <option value="">All Hospitals</option>
                {hospitals.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newPricing.pharmacyId}
                onChange={(e) => setNewPricing((prev) => ({ ...prev, pharmacyId: e.target.value }))}
              >
                <option value="">All Pharmacies</option>
                {pharmacies.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Discount %"
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newPricing.discountPercent}
                  onChange={(e) => setNewPricing((prev) => ({ ...prev, discountPercent: Number(e.target.value) }))}
                  min="0"
                  max="100"
                />
                <input
                  type="number"
                  placeholder="Discount Amount (₹)"
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newPricing.discountAmount}
                  onChange={(e) => setNewPricing((prev) => ({ ...prev, discountAmount: Number(e.target.value) }))}
                  min="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  placeholder="Valid From"
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newPricing.validFrom}
                  onChange={(e) => setNewPricing((prev) => ({ ...prev, validFrom: e.target.value }))}
                />
                <input
                  type="date"
                  placeholder="Valid To"
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newPricing.validTo}
                  onChange={(e) => setNewPricing((prev) => ({ ...prev, validTo: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 text-sm transition-all"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold py-2.5 text-sm shadow-lg shadow-emerald-500/50 transition-all"
                >
                  Create Rule
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}

