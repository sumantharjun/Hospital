import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function LabResultsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [resultForm, setResultForm] = useState({ value: "", unit: "", referenceRange: "", remarks: "", status: "NORMAL" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchResults();
  }, []);

  async function fetchResults() {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(`/api/lab/orders?from=${date}&to=${date}`), { headers: getAuthHeaders() });
      const data = res.ok ? await res.json() : [];
      setResults(Array.isArray(data) ? data : data.orders || []);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  async function submitResult(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!resultForm.value.trim()) { toast.error("Result value is required"); return; }
    setSaving(true);
    try {
      const orderId = selectedOrder._id || selectedOrder.id;
      const res = await fetch(buildApiUrl(`/api/lab/orders/${orderId}/result`), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(resultForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save result");
      toast.success("Result saved successfully");
      setSelectedOrder(null);
      setResultForm({ value: "", unit: "", referenceRange: "", remarks: "", status: "NORMAL" });
      fetchResults();
    } catch (e: any) {
      toast.error(e.message || "Failed to save result");
    } finally {
      setSaving(false);
    }
  }

  const pending = results.filter((r: any) => (r.status || "").toUpperCase() !== "COMPLETED");
  const completed = results.filter((r: any) => (r.status || "").toUpperCase() === "COMPLETED");

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Lab Results</h1>
            <p className="mt-1 text-sm text-zinc-500">Enter and view results for completed tests.</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); }} className="medical-input text-sm" />
            <button onClick={fetchResults} className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">Load</button>
          </div>
        </div>

        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-zinc-900">Enter Result</h3>
              <p className="mt-1 text-sm text-zinc-500">Patient: <strong>{selectedOrder.patientName || "—"}</strong> — Test: <strong>{selectedOrder.testName || "—"}</strong></p>
              <form onSubmit={submitResult} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Result Value *</label>
                    <input type="text" value={resultForm.value} onChange={(e) => setResultForm((f) => ({ ...f, value: e.target.value }))} placeholder="e.g. 12.5" className="medical-input w-full" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Unit</label>
                    <input type="text" value={resultForm.unit} onChange={(e) => setResultForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. g/dL" className="medical-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Reference Range</label>
                    <input type="text" value={resultForm.referenceRange} onChange={(e) => setResultForm((f) => ({ ...f, referenceRange: e.target.value }))} placeholder="e.g. 11.5–16.5" className="medical-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Status</label>
                    <select value={resultForm.status} onChange={(e) => setResultForm((f) => ({ ...f, status: e.target.value }))} className="medical-input w-full">
                      <option value="NORMAL">Normal</option>
                      <option value="ABNORMAL">Abnormal</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Remarks</label>
                  <textarea value={resultForm.remarks} onChange={(e) => setResultForm((f) => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Optional remarks" className="medical-input w-full" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="medical-btn-primary px-5 py-2 disabled:opacity-50">{saving ? "Saving…" : "Save Result"}</button>
                  <button type="button" onClick={() => setSelectedOrder(null)} className="px-5 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading orders…</div>
        ) : (
          <>
            <div className="medical-card overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-yellow-50">
                <h2 className="font-semibold text-zinc-900">Pending Results ({pending.length})</h2>
              </div>
              {pending.length === 0 ? (
                <div className="p-6 text-center text-zinc-500">No pending orders on {date}.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        {["Patient", "Test", "Ordered At", "Action"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {pending.map((o: any) => (
                        <tr key={o._id || o.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 font-medium text-zinc-900">{o.patientName || o.patient?.name || "—"}</td>
                          <td className="px-4 py-3 text-zinc-700">{o.testName || o.test?.name || "—"}</td>
                          <td className="px-4 py-3 text-zinc-500 text-xs">{o.createdAt ? new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => setSelectedOrder(o)} className="px-3 py-1.5 bg-blue-700 text-white text-xs rounded hover:bg-blue-800 font-medium">
                              Enter Result
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="medical-card overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-green-50">
                <h2 className="font-semibold text-zinc-900">Completed ({completed.length})</h2>
              </div>
              {completed.length === 0 ? (
                <div className="p-6 text-center text-zinc-500">No completed results on {date}.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        {["Patient", "Test", "Result", "Status", "Completed At"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {completed.map((o: any) => (
                        <tr key={o._id || o.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 font-medium text-zinc-900">{o.patientName || o.patient?.name || "—"}</td>
                          <td className="px-4 py-3 text-zinc-700">{o.testName || o.test?.name || "—"}</td>
                          <td className="px-4 py-3 text-zinc-700">{o.result?.value || o.resultValue || "—"} {o.result?.unit || o.resultUnit || ""}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              (o.result?.status || "").toUpperCase() === "ABNORMAL" ? "bg-red-100 text-red-700" :
                              (o.result?.status || "").toUpperCase() === "CRITICAL" ? "bg-red-200 text-red-900" :
                              "bg-green-100 text-green-700"
                            }`}>{o.result?.status || "NORMAL"}</span>
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-xs">{o.completedAt ? new Date(o.completedAt).toLocaleString("en-IN") : "—"}</td>
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
