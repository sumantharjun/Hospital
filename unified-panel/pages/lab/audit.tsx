import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

function todayStr() { return new Date().toISOString().slice(0, 10); }

const ACTION_COLORS: any = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  PAYMENT: "bg-purple-100 text-purple-700",
  RESULT: "bg-teal-100 text-teal-700",
};

export default function LabAuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [actionFilter, setActionFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate, module: "lab" });
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      const res = await fetch(buildApiUrl(`/api/audit-logs?${params}`), { headers: getAuthHeaders() });
      const data = res.ok ? await res.json() : [];
      setLogs(Array.isArray(data) ? data : data.logs || []);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  const filtered = logs.filter((l: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.action || "").toLowerCase().includes(q) ||
      (l.performedBy || l.user || "").toLowerCase().includes(q) ||
      (l.description || l.message || "").toLowerCase().includes(q)
    );
  });

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Lab Audit Log</h1>
            <p className="mt-1 text-sm text-zinc-500">Track all lab module actions — orders, results, payments and changes.</p>
          </div>
          <button onClick={fetchLogs} className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">Refresh</button>
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
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Action</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="medical-input">
              <option value="ALL">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="PAYMENT">Payment</option>
              <option value="RESULT">Result</option>
            </select>
          </div>
          <button onClick={fetchLogs} className="medical-btn-primary px-4 py-2 text-sm">Apply</button>
        </div>

        <div className="medical-card p-4">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs by action, user or description…" className="medical-input w-full" />
        </div>

        <div className="medical-card overflow-hidden">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Audit Trail</h2>
            <span className="text-sm text-zinc-500">{filtered.length} log(s)</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading audit logs…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No audit logs found for the selected filters.
              {logs.length === 0 && <p className="mt-2 text-xs text-zinc-400">The backend may not have an audit log endpoint for lab at /api/audit-logs.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    {["Timestamp", "Action", "Performed By", "Resource", "Description"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map((l: any, i: number) => (
                    <tr key={l._id || l.id || i} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                        {l.createdAt ? new Date(l.createdAt).toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[(l.action || "").toUpperCase()] || "bg-zinc-100 text-zinc-700"}`}>
                          {l.action || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{l.performedBy || l.user || l.userId || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 text-xs font-mono">{l.resource || l.model || l.entity || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 max-w-xs truncate" title={l.description || l.message || ""}>{l.description || l.message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
