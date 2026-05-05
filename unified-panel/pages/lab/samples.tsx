import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

const STATUS_COLORS: any = {
  COLLECTED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function LabSamplesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchSamples();
  }, []);

  async function fetchSamples() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: date, to: date });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(buildApiUrl(`/api/lab/samples?${params}`), { headers: getAuthHeaders() });
      const data = res.ok ? await res.json() : [];
      setSamples(Array.isArray(data) ? data : data.samples || []);
    } catch {
      toast.error("Failed to load samples");
    } finally {
      setLoading(false);
    }
  }

  async function updateSampleStatus(sampleId: string, status: string) {
    setUpdating(sampleId);
    try {
      const res = await fetch(buildApiUrl(`/api/lab/samples/${sampleId}`), {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update");
      toast.success("Sample status updated");
      fetchSamples();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setUpdating(null);
    }
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Sample Tracking</h1>
            <p className="mt-1 text-sm text-zinc-500">Track collection and processing status of lab samples.</p>
          </div>
          <button onClick={fetchSamples} className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">Refresh</button>
        </div>

        <div className="medical-card p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="medical-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="medical-input">
              <option value="ALL">All</option>
              <option value="COLLECTED">Collected</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <button onClick={fetchSamples} className="medical-btn-primary px-4 py-2 text-sm">Apply</button>
        </div>

        <div className="medical-card overflow-hidden">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Samples on {date}</h2>
            <span className="text-sm text-zinc-500">{samples.length} sample(s)</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading samples…</div>
          ) : samples.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No samples found for the selected date/status.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    {["Sample ID", "Patient", "Test", "Sample Type", "Status", "Collected At", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {samples.map((s: any) => (
                    <tr key={s._id || s.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{(s.sampleId || s._id || "").slice(-8)}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{s.patientName || s.patient?.name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-700">{s.testName || s.test?.name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{s.sampleType || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[(s.status || "").toUpperCase()] || "bg-zinc-100 text-zinc-700"}`}>
                          {s.status || "COLLECTED"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{s.collectedAt ? new Date(s.collectedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-4 py-3">
                        <select
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) updateSampleStatus(s._id || s.id, e.target.value); e.target.value = ""; }}
                          disabled={!!updating}
                          className="text-xs border border-zinc-300 rounded px-2 py-1 bg-white text-zinc-700"
                        >
                          <option value="">Update status</option>
                          <option value="COLLECTED">Mark Collected</option>
                          <option value="PROCESSING">Mark Processing</option>
                          <option value="COMPLETED">Mark Completed</option>
                          <option value="REJECTED">Mark Rejected</option>
                        </select>
                      </td>
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
