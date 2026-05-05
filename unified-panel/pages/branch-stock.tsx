import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import { PharmacyIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

interface BranchStock {
  pharmacyId: string;
  pharmacyName: string;
  address?: string;
  phone?: string;
  totalItems: number;
  totalStockValue: number;
  lowStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  lowStockItems: Array<{ medicineName: string; quantity: number; threshold: number }>;
  expiringSoonItems: Array<{
    medicineName: string;
    brandName?: string;
    batchNumber?: string;
    expiryDate: string;
    quantity: number;
  }>;
}

export default function BranchStockPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<BranchStock[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !token) {
      router.replace("/");
      return;
    }
    const u = JSON.parse(storedUser);
    setUser(u);
    if (u.role !== "SUPER_ADMIN") {
      setError("Access denied. Branch-wise stock is only available for Super Admin.");
      setLoading(false);
      return;
    }

    const fetchBranchStock = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/reports/pharmacy/branch-stock`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to load branch stock");
        }
        const data = await res.json();
        setBranches(data.branches || []);
        setSummary(data.summary || {});
      } catch (e: any) {
        setError(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchBranchStock();
  }, [router]);

  if (!user) return null;

  return (
    <Layout user={user} currentPage="branch-stock">
      <div className="p-4 sm:p-6 space-y-6">
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="medical-card bg-gradient-to-r from-white via-white to-cyan-50/70 border border-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-cyan-50 to-emerald-100 rounded-xl border border-emerald-100">
              <PharmacyIcon className="w-8 h-8 text-teal-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Branch-wise Stock (Super Admin)</h1>
              <p className="text-sm text-slate-600">Real-time stock levels, expiry risk, and low-stock alerts per pharmacy branch</p>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : summary && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="medical-card p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase">Total Branches</p>
                  <p className="text-2xl font-bold text-slate-900">{summary.totalBranches ?? branches.length}</p>
                </div>
                <div className="medical-card p-4">
                  <p className="text-xs font-medium text-amber-700 uppercase">Low Stock Items</p>
                  <p className="text-2xl font-bold text-amber-800">{summary.totalLowStockItems ?? 0}</p>
                </div>
                <div className="medical-card p-4">
                  <p className="text-xs font-medium text-orange-700 uppercase">Expiring Soon (30d)</p>
                  <p className="text-2xl font-bold text-orange-800">{summary.totalExpiringSoonItems ?? 0}</p>
                </div>
                <div className="medical-card p-4">
                  <p className="text-xs font-medium text-red-700 uppercase">Expired Items</p>
                  <p className="text-2xl font-bold text-red-800">{summary.totalExpiredItems ?? 0}</p>
                </div>
              </div>

              <div className="space-y-4">
                {branches.map((branch, idx) => (
                  <motion.div
                    key={branch.pharmacyId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="medical-card p-0 overflow-hidden"
                  >
                    <div className="bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-semibold text-slate-900">{branch.pharmacyName}</h2>
                        {branch.address && <p className="text-xs text-slate-600">{branch.address}</p>}
                        {branch.phone && <p className="text-xs text-slate-500">Phone: {branch.phone}</p>}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {branch.totalItems} items
                        </span>
                        <span className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-xs font-medium">
                          Value: Rs. {(branch.totalStockValue || 0).toLocaleString()}
                        </span>
                        {branch.lowStockCount > 0 && (
                          <span className="px-2 py-1 bg-amber-200 text-amber-800 rounded text-xs font-medium">
                            {branch.lowStockCount} low stock
                          </span>
                        )}
                        {branch.expiringSoonCount > 0 && (
                          <span className="px-2 py-1 bg-orange-200 text-orange-800 rounded text-xs font-medium">
                            {branch.expiringSoonCount} expiring soon
                          </span>
                        )}
                        {branch.expiredCount > 0 && (
                          <span className="px-2 py-1 bg-red-200 text-red-800 rounded text-xs font-medium">
                            {branch.expiredCount} expired
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {branch.lowStockItems?.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-2">Low stock</h3>
                          <ul className="text-xs space-y-1">
                            {branch.lowStockItems.slice(0, 5).map((item, i) => (
                              <li key={i} className="flex justify-between">
                                <span className="text-slate-700">{item.medicineName}</span>
                                <span className="text-amber-600">{item.quantity} / {item.threshold}</span>
                              </li>
                            ))}
                            {branch.lowStockItems.length > 5 && (
                              <li className="text-slate-500">+{branch.lowStockItems.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                      {branch.expiringSoonItems?.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-2">Expiring soon</h3>
                          <ul className="text-xs space-y-1">
                            {branch.expiringSoonItems.slice(0, 5).map((item, i) => (
                              <li key={i} className="flex justify-between">
                                <span className="text-slate-700">{item.medicineName} ({item.brandName || ""})</span>
                                <span className="text-orange-600">{new Date(item.expiryDate).toLocaleDateString()}</span>
                              </li>
                            ))}
                            {branch.expiringSoonItems.length > 5 && (
                              <li className="text-slate-500">+{branch.expiringSoonItems.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                      {!branch.lowStockItems?.length && !branch.expiringSoonItems?.length && (
                        <p className="text-sm text-slate-500 col-span-2">No alerts for this branch.</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
