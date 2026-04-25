"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { LabOrder } from "@/lib/types";
import toast from "react-hot-toast";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  COLLECTED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function OperatorDashboard() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    apiGet<{ orders: LabOrder[] }>(`/api/lab/orders?date=${today}&limit=50`)
      .then((d) => setOrders(d.orders))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const pending = orders.filter((o) => o.status === "PENDING").length;
  const inProgress = orders.filter((o) => o.status === "IN_PROGRESS" || o.status === "COLLECTED").length;
  const completed = orders.filter((o) => o.status === "COMPLETED").length;
  const revenue = orders.reduce((s, o) => s + o.grandTotal, 0);

  const cards = [
    { label: "Today's Orders", value: orders.length, color: "text-blue-600" },
    { label: "Pending", value: pending, color: "text-yellow-600" },
    { label: "In Progress", value: inProgress, color: "text-purple-600" },
    { label: "Completed", value: completed, color: "text-green-600" },
    { label: "Today's Revenue", value: `₹${revenue.toLocaleString("en-IN")}`, color: "text-blue-600" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Today&apos;s Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm">Recent Orders</div>
        {loading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Order ID</th>
                <th className="text-left px-4 py-3 font-medium">Patient</th>
                <th className="text-left px-4 py-3 font-medium">Tests</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.slice(0, 15).map((o) => (
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.orderId}</td>
                  <td className="px-4 py-3 font-medium">{o.patientName}</td>
                  <td className="px-4 py-3 text-gray-500">{o.tests.length + o.packages.length} item{(o.tests.length + o.packages.length) !== 1 ? "s" : ""}</td>
                  <td className="px-4 py-3 text-right">₹{o.grandTotal.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-700"}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No orders today</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
