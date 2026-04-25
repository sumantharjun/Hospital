"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
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
  PENDING: "COLLECTED",
  COLLECTED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

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
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await apiPatch(`/api/lab/orders/${order._id}/status`, { status: next });
      toast.success(`Status → ${next}`);
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
                <tr key={o._id} className="hover:bg-gray-50">
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
                      <button onClick={() => advance(o)} className="text-blue-600 hover:underline">→ {NEXT_STATUS[o.status]}</button>
                    )}
                    {o.status === "IN_PROGRESS" && (
                      <button onClick={() => router.push(`/operator/results?orderId=${o._id}`)} className="text-purple-600 hover:underline">Results</button>
                    )}
                    {!o.billId && o.status !== "CANCELLED" && (
                      <button onClick={() => router.push(`/operator/billing?orderId=${o._id}`)} className="text-blue-600 hover:underline">Bill</button>
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
    </div>
  );
}
