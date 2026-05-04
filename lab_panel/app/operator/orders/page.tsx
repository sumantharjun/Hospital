"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiDownloadPdf } from "@/lib/api";
import type { LabOrder } from "@/lib/types";
import toast from "react-hot-toast";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  COLLECTED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const NEXT_STATUS: Record<string, string> = {
  PENDING: "IN_PROGRESS",
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewOrder, setViewOrder] = useState<LabOrder | null>(null);

  async function load(p = 1, s = "") {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (s) params.set("status", s);
      const d = await apiGet<{ orders: LabOrder[]; total: number }>(`/api/lab/orders?${params}`);
      setOrders(d.orders);
      setTotal(d.total);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(page, status); }, [page, status]);

  async function advance(order: LabOrder) {
    if (!NEXT_STATUS[order.status]) return;
    try {
      // PENDING → collect sample (sets IN_PROGRESS + generates sampleId)
      await apiPatch(`/api/lab/orders/${order._id}/sample`, {});
      toast.success("Sample collected → IN_PROGRESS");
      load(page, status);
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <button onClick={() => router.push("/operator/orders/new")} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ New Order</button>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {["", "PENDING", "COLLECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${status === s ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">Loading…</div> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Order ID</th>
                <th className="text-left px-4 py-3 font-medium">Patient</th>
                <th className="text-left px-4 py-3 font-medium">Sample ID</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewOrder(o)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.orderId}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.patientName}</div>
                    <div className="text-xs text-gray-400">{o.patientPhone}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{o.sampleId ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">₹{o.grandTotal.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[o.status]}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2 text-xs">
                    {NEXT_STATUS[o.status] && (
                      <button onClick={(e) => { e.stopPropagation(); advance(o); }} className="text-blue-600 hover:underline">→ {NEXT_STATUS[o.status]}</button>
                    )}
                    {o.status === "IN_PROGRESS" && (
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/operator/results?orderId=${o._id}`); }} className="text-purple-600 hover:underline">Results</button>
                    )}
                    {o.status === "COMPLETED" && (
                      <button onClick={(e) => { e.stopPropagation(); apiDownloadPdf(`/api/lab/reports/order/${o._id}/pdf`).catch((err) => toast.error(err.message)); }} className="text-green-600 hover:underline">Download Report</button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No orders found</td></tr>}
            </tbody>
          </table>
          {total > 20 && (
            <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
              <span>{total} total</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">Prev</button>
                <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Order Modal */}
      {viewOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Details</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Order ID</span>
                <span className="font-mono text-xs">{viewOrder.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Patient Name</span>
                <span className="font-medium">{viewOrder.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span>{viewOrder.patientPhone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[viewOrder.status]}`}>{viewOrder.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sample ID</span>
                <span className="font-mono text-xs">{viewOrder.sampleId ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created At</span>
                <span className="text-xs">{new Date(viewOrder.createdAt).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {viewOrder.tests.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Tests</div>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  {viewOrder.tests.map((t, i) => (
                    <div key={i} className="flex justify-between px-3 py-2 text-sm">
                      <span>{t.testName}</span>
                      <span className="text-gray-500">₹{t.price.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewOrder.packages.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Packages</div>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  {viewOrder.packages.map((pkg, i) => (
                    <div key={i} className="flex justify-between px-3 py-2 text-sm">
                      <span>{pkg.packageName}</span>
                      <span className="text-gray-500">₹{pkg.price.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>₹{viewOrder.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Discount</span>
                <span>₹{viewOrder.discountAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-gray-200 pt-1.5 mt-1">
                <span>Grand Total</span>
                <span>₹{viewOrder.grandTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setViewOrder(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
