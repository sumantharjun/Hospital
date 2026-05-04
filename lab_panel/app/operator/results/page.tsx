"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost, apiPatch, apiDownloadPdf } from "@/lib/api";
import type { LabOrder, LabResult, ParameterResult } from "@/lib/types";
import toast from "react-hot-toast";

function ResultsContent() {
  const searchParams = useSearchParams();
  const preOrderId = searchParams.get("orderId") ?? "";

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState(preOrderId);
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, { parameterResults: ParameterResult[]; overallRemarks: string }>>({});

  useEffect(() => {
    apiGet<{ orders: LabOrder[] }>("/api/lab/orders?status=IN_PROGRESS&limit=100")
      .then((d) => {
        setOrders(d.orders);
        if (preOrderId && !selectedOrderId) setSelectedOrderId(preOrderId);
      })
      .catch((err) => toast.error(err.message));
  }, []);

  async function loadResults(orderId: string) {
    if (!orderId) return;
    setLoading(true);
    try {
      const d = await apiGet<{ results: LabResult[] }>(`/api/lab/results/order/${orderId}`);
      setResults(d.results);
      const initial: typeof edits = {};
      d.results.forEach((r) => {
        initial[r._id] = { parameterResults: r.parameterResults.map((p) => ({ ...p })), overallRemarks: r.overallRemarks ?? "" };
      });
      setEdits(initial);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  async function initResults() {
    if (!selectedOrderId) return;
    setInitializing(true);
    try {
      await apiPost(`/api/lab/results/init/${selectedOrderId}`);
      toast.success("Result stubs created");
      loadResults(selectedOrderId);
    } catch (err: any) { toast.error(err.message); }
    finally { setInitializing(false); }
  }

  useEffect(() => { if (selectedOrderId) loadResults(selectedOrderId); }, [selectedOrderId]);

  function updateParamValue(resultId: string, paramIdx: number, value: string) {
    setEdits((prev) => ({
      ...prev,
      [resultId]: {
        ...prev[resultId],
        parameterResults: prev[resultId].parameterResults.map((p, i) => i === paramIdx ? { ...p, value } : p),
      },
    }));
  }

  async function saveResult(resultId: string) {
    setSaving(true);
    try {
      await apiPatch(`/api/lab/results/${resultId}/enter`, edits[resultId]);
      toast.success("Result saved");
      loadResults(selectedOrderId);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Result Entry</h1>

      <div className="flex gap-3 mb-6">
        <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— Select an order —</option>
          {orders.map((o) => <option key={o._id} value={o._id}>{o.orderId} · {o.patientName}</option>)}
        </select>
        {selectedOrderId && results.length === 0 && (
          <button onClick={initResults} disabled={initializing} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-400">
            {initializing ? "Initializing…" : "Initialize Results"}
          </button>
        )}
        {selectedOrderId && results.some((r) => r.status === "APPROVED") && (
          <button onClick={() => apiDownloadPdf(`/api/lab/reports/order/${selectedOrderId}/pdf`).catch((err) => toast.error(err.message))} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            Download Report PDF
          </button>
        )}
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">Loading…</div> : results.map((result) => (
        <div key={result._id} className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold">{result.testName}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              result.status === "APPROVED" ? "bg-green-100 text-green-700" :
              result.status === "ENTERED" ? "bg-blue-100 text-blue-700" :
              result.status === "REJECTED" ? "bg-red-100 text-red-600" :
              "bg-gray-100 text-gray-600"
            }`}>{result.status}</span>
          </div>

          <div className="p-5">
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="text-left py-1.5 font-medium w-1/3">Parameter</th>
                  <th className="text-left py-1.5 font-medium">Value</th>
                  <th className="text-left py-1.5 font-medium">Unit</th>
                  <th className="text-left py-1.5 font-medium">Normal Range</th>
                  <th className="text-center py-1.5 font-medium">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(edits[result._id]?.parameterResults ?? []).map((pr, i) => {
                  const num = parseFloat(pr.value);
                  const abnormal = !isNaN(num) && pr.normalMin !== undefined && pr.normalMax !== undefined && (num < pr.normalMin || num > pr.normalMax);
                  return (
                    <tr key={i} className={abnormal ? "bg-red-50" : ""}>
                      <td className="py-2 pr-3 font-medium">{pr.parameterName}</td>
                      <td className="py-2 pr-3">
                        {result.status === "APPROVED" ? (
                          <span className={abnormal ? "text-red-600 font-bold" : ""}>{pr.value}</span>
                        ) : (
                          <input value={pr.value} onChange={(e) => updateParamValue(result._id, i, e.target.value)}
                            className={`border rounded px-2 py-1 w-28 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${abnormal ? "border-red-400" : ""}`} />
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-400">{pr.unit}</td>
                      <td className="py-2 pr-3 text-gray-400 text-xs">
                        {pr.normalMin !== undefined && pr.normalMax !== undefined ? `${pr.normalMin} – ${pr.normalMax}` : "—"}
                      </td>
                      <td className="py-2 text-center">
                        {abnormal && <span className="text-xs text-red-600 font-bold">H/L</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {result.status !== "APPROVED" && (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Overall Remarks</label>
                  <textarea
                    rows={2}
                    value={edits[result._id]?.overallRemarks ?? ""}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [result._id]: { ...prev[result._id], overallRemarks: e.target.value } }))}
                    placeholder="Optional remarks or clinical notes…"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <button onClick={() => saveResult(result._id)} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-400 flex-shrink-0">
                  {saving ? "Saving…" : "Save Result"}
                </button>
              </div>
            )}
            {result.status === "REJECTED" && result.rejectionReason && (
              <div className="mt-2 text-xs text-red-600">Rejection reason: {result.rejectionReason}</div>
            )}
          </div>
        </div>
      ))}

      {selectedOrderId && !loading && results.length === 0 && (
        <div className="text-center py-10 text-gray-400">No results yet. Click &quot;Initialize Results&quot; to begin.</div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}><ResultsContent /></Suspense>;
}
