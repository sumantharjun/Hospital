"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";
import type { LabOrder } from "@/lib/types";
import toast from "react-hot-toast";

export default function SamplesPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewOrder, setViewOrder] = useState<LabOrder | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await apiGet<{ orders: LabOrder[] }>("/api/lab/orders?status=PENDING&limit=100");
      setOrders(d.orders);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function collectSample(orderId: string) {
    try {
      await apiPatch(`/api/lab/orders/${orderId}/sample`, {});
      toast.success("Sample collected");
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Sample Collection</h1>
      <p className="text-gray-500 text-sm mb-6">Orders pending sample collection</p>

      {loading ? <div className="text-center py-10 text-gray-400">Loading…</div> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Order ID</th>
                <th className="text-left px-4 py-3 font-medium">Patient</th>
                <th className="text-left px-4 py-3 font-medium">Tests</th>
                <th className="text-left px-4 py-3 font-medium">Ordered At</th>
                <th className="text-center px-4 py-3 font-medium">Action</th>
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
                  <td className="px-4 py-3 text-gray-500 text-xs">{[...o.tests.map((t) => t.testName), ...o.packages.map((p) => p.packageName)].join(", ")}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button onClick={(e) => { e.stopPropagation(); collectSample(o._id); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700">
                      Mark Collected
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No pending samples</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* View Order Modal */}
      {viewOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Details</h2>

            <div className="space-y-3 text-sm mb-4">
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
              <div className="flex justify-between">
                <span className="text-gray-500">Ordered At</span>
                <span className="text-xs">{new Date(viewOrder.createdAt).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {viewOrder.tests.length > 0 && (
              <div className="mb-3">
                <div className="text-sm font-semibold text-gray-700 mb-2">Tests</div>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  {viewOrder.tests.map((t, i) => (
                    <div key={i} className="px-3 py-2 text-sm">{t.testName}</div>
                  ))}
                </div>
              </div>
            )}

            {viewOrder.packages.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Packages</div>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  {viewOrder.packages.map((pkg, i) => (
                    <div key={i} className="px-3 py-2 text-sm">{pkg.packageName}</div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end mt-5">
              <button onClick={() => setViewOrder(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
