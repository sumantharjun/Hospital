import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

export default function LabDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ totalTests: 0, pending: 0, completed: 0, todayOrders: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const today = new Date().toISOString().slice(0, 10);
      const [ordersRes, testsRes] = await Promise.all([
        fetch(buildApiUrl(`/api/lab/orders?from=${today}&to=${today}`), { headers }).catch(() => ({ ok: false } as any)),
        fetch(buildApiUrl("/api/lab/tests"), { headers }).catch(() => ({ ok: false } as any)),
      ]);
      const ordersData = ordersRes.ok ? await ordersRes.json() : [];
      const testsData = testsRes.ok ? await testsRes.json() : [];
      const orders = Array.isArray(ordersData) ? ordersData : ordersData.orders || [];
      const tests = Array.isArray(testsData) ? testsData : testsData.tests || [];
      const pending = orders.filter((o: any) => (o.status || "").toUpperCase() === "PENDING").length;
      const completed = orders.filter((o: any) => (o.status || "").toUpperCase() === "COMPLETED").length;
      setStats({ totalTests: tests.length, pending, completed, todayOrders: orders.length });
      setRecentOrders(orders.slice(0, 10));
    } catch {
      toast.error("Failed to load lab dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Lab Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-500">Overview of today&apos;s lab activity and recent orders.</p>
          </div>
          <button onClick={fetchDashboard} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-zinc-500">Loading dashboard…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Today's Orders", value: stats.todayOrders, color: "border-blue-500 text-blue-700" },
                { label: "Pending", value: stats.pending, color: "border-yellow-500 text-yellow-700" },
                { label: "Completed", value: stats.completed, color: "border-green-500 text-green-700" },
                { label: "Total Tests", value: stats.totalTests, color: "border-purple-500 text-purple-700" },
              ].map((s) => (
                <div key={s.label} className={`medical-card border-l-4 p-4 ${s.color.split(" ")[0]}`}>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.color.split(" ")[1]}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="medical-card overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50">
                <h2 className="font-semibold text-zinc-900">Recent Orders Today</h2>
              </div>
              {recentOrders.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">No orders today yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        {["Order ID", "Patient", "Test", "Status", "Ordered At"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {recentOrders.map((o: any) => (
                        <tr key={o._id || o.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 font-mono text-xs text-zinc-500">{(o.orderId || o._id || "").slice(-8)}</td>
                          <td className="px-4 py-3 font-medium text-zinc-900">{o.patientName || o.patient?.name || "—"}</td>
                          <td className="px-4 py-3 text-zinc-700">{o.testName || o.test?.name || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              (o.status || "").toUpperCase() === "COMPLETED" ? "bg-green-100 text-green-700" :
                              (o.status || "").toUpperCase() === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                              "bg-zinc-100 text-zinc-700"
                            }`}>{o.status || "PENDING"}</span>
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-xs">{o.createdAt ? new Date(o.createdAt).toLocaleString("en-IN") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
