"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";
import type { LabOrder } from "@/lib/types";
import toast from "react-hot-toast";

export default function SamplesPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);

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
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.orderId}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.patientName}</div>
                    <div className="text-xs text-gray-400">{o.patientPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{[...o.tests.map((t) => t.testName), ...o.packages.map((p) => p.packageName)].join(", ")}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => collectSample(o._id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700">
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
    </div>
  );
}
