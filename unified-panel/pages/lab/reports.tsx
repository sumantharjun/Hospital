import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStartStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function LabReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(monthStartStr());
  const [toDate, setToDate] = useState(todayStr());
  const [reportData, setReportData] = useState<any>({ totalOrders: 0, completed: 0, pending: 0, revenue: 0, byTest: [], byStatus: [] });

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchReport();
  }, []);

  async function fetchReport() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [ordersRes, billsRes] = await Promise.all([
        fetch(buildApiUrl(`/api/lab/orders?from=${fromDate}&to=${toDate}`), { headers }),
        fetch(buildApiUrl(`/api/lab/bills?from=${fromDate}&to=${toDate}`), { headers }).catch(() => ({ ok: false } as any)),
      ]);
      const ordersData = ordersRes.ok ? await ordersRes.json() : [];
      const billsData = (billsRes as any).ok ? await (billsRes as any).json() : [];
      const orders = Array.isArray(ordersData) ? ordersData : ordersData.orders || [];
      const bills = Array.isArray(billsData) ? billsData : billsData.bills || [];

      const completed = orders.filter((o: any) => (o.status || "").toUpperCase() === "COMPLETED").length;
      const pending = orders.filter((o: any) => (o.status || "").toUpperCase() === "PENDING").length;
      const revenue = bills.reduce((s: number, b: any) => s + (b.paidAmount || 0), 0);

      const byTestMap: any = {};
      orders.forEach((o: any) => {
        const name = o.testName || o.test?.name || "Unknown";
        if (!byTestMap[name]) byTestMap[name] = { count: 0, completed: 0 };
        byTestMap[name].count++;
        if ((o.status || "").toUpperCase() === "COMPLETED") byTestMap[name].completed++;
      });
      const byTest = Object.entries(byTestMap).map(([name, v]: any) => ({ name, ...v })).sort((a, b) => b.count - a.count);

      const statusMap: any = {};
      orders.forEach((o: any) => {
        const s = o.status || "PENDING";
        if (!statusMap[s]) statusMap[s] = 0;
        statusMap[s]++;
      });
      const byStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      setReportData({ totalOrders: orders.length, completed, pending, revenue, byTest, byStatus });
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    const rows = [
      ["Test Name", "Total Orders", "Completed"],
      ...reportData.byTest.map((t: any) => [t.name, t.count, t.completed]),
    ];
    const csv = rows.map((r) => r.map((c: any) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-report-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Lab Reports</h1>
            <p className="mt-1 text-sm text-zinc-500">Analytics and summary reports for lab operations.</p>
          </div>
          <button onClick={downloadCsv} className="px-4 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Download CSV
          </button>
        </div>

        <div className="medical-card p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="medical-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="medical-input" />
          </div>
          <button onClick={fetchReport} className="medical-btn-primary px-4 py-2 text-sm">Generate</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-500">Generating report…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Orders", value: reportData.totalOrders, color: "text-blue-700" },
                { label: "Completed", value: reportData.completed, color: "text-green-700" },
                { label: "Pending", value: reportData.pending, color: "text-yellow-700" },
                { label: "Revenue", value: `₹${reportData.revenue.toLocaleString("en-IN")}`, color: "text-purple-700" },
              ].map((s) => (
                <div key={s.label} className="medical-card p-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="medical-card overflow-hidden">
                <div className="p-4 border-b border-zinc-200 bg-zinc-50">
                  <h2 className="font-semibold text-zinc-900">Tests by Volume</h2>
                </div>
                {reportData.byTest.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500">No data for selected period.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Test</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Orders</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {reportData.byTest.map((t: any) => (
                          <tr key={t.name} className="hover:bg-zinc-50">
                            <td className="px-4 py-3 font-medium text-zinc-900">{t.name}</td>
                            <td className="px-4 py-3 text-zinc-600">{t.count}</td>
                            <td className="px-4 py-3 text-green-700">{t.completed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="medical-card overflow-hidden">
                <div className="p-4 border-b border-zinc-200 bg-zinc-50">
                  <h2 className="font-semibold text-zinc-900">Orders by Status</h2>
                </div>
                {reportData.byStatus.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500">No data for selected period.</div>
                ) : (
                  <div className="p-4 space-y-3">
                    {reportData.byStatus.map((s: any) => (
                      <div key={s.status} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-700">{s.status}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-zinc-100 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${reportData.totalOrders ? Math.round((s.count / reportData.totalOrders) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-sm text-zinc-600 w-8 text-right">{s.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
