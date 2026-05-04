"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { LabBill } from "@/lib/types";
import toast from "react-hot-toast";

interface Analytics {
  stats: { totalOrders: number; totalRevenue: number; avgOrderValue: number };
  statusBreakdown: { _id: string; count: number }[];
}

export default function ReportsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [bills, setBills] = useState<LabBill[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewBill, setViewBill] = useState<LabBill | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const [ana, billData] = await Promise.all([
        apiGet<Analytics>(`/api/lab/reports/analytics?${params}`),
        apiGet<{ bills: LabBill[] }>("/api/lab/billing"),
      ]);
      setAnalytics(ana);
      setBills(billData.bills);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const outstanding = bills.filter((b) => b.status === "PARTIAL" || b.status === "ACTIVE");
  const paid = bills.filter((b) => b.status === "PAID");
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports & Analytics</h1>

      <div className="flex gap-3 mb-6">
        <input
          type="date"
          value={from}
          max={today}
          onChange={(e) => {
            const newFrom = e.target.value;
            setFrom(newFrom);
            if (to && to < newFrom) setTo(newFrom);
          }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={to}
          max={today}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={load} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Apply</button>
      </div>

      {loading ? <div className="text-gray-400">Loading…</div> : analytics && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Orders", value: analytics.stats.totalOrders, color: "text-blue-600" },
              { label: "Total Revenue", value: `₹${(analytics.stats.totalRevenue).toLocaleString("en-IN")}`, color: "text-green-600" },
              { label: "Paid Bills", value: paid.length, color: "text-green-600" },
              { label: "Outstanding", value: `₹${outstanding.reduce((s, b) => s + b.outstandingBalance, 0).toLocaleString("en-IN")}`, color: "text-red-500" },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-semibold mb-4">Order Status Breakdown</h2>
            <div className="flex flex-wrap gap-3">
              {analytics.statusBreakdown.map((s) => (
                <div key={s._id} className="bg-gray-50 rounded-lg px-4 py-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{s.count}</div>
                  <div className="text-xs text-gray-500">{s._id}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm">Outstanding Payments</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Bill #</th>
                  <th className="text-left px-4 py-3 font-medium">Patient</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Paid</th>
                  <th className="text-right px-4 py-3 font-medium">Outstanding</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {outstanding.map((b) => (
                  <tr key={b._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewBill(b)}>
                    <td className="px-4 py-3 font-mono text-xs">{b.billNumber}</td>
                    <td className="px-4 py-3">{b.patientName}</td>
                    <td className="px-4 py-3 text-right">₹{b.grandTotal.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right text-green-600">₹{b.paidAmount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right text-red-500 font-medium">₹{b.outstandingBalance.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{b.status}</span>
                    </td>
                  </tr>
                ))}
                {outstanding.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-gray-400">No outstanding bills</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {viewBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Bill Details</h2>
            <div className="space-y-3 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Bill Number</span>
                <span className="font-mono text-xs">{viewBill.billNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Patient</span>
                <span className="font-medium">{viewBill.patientName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{viewBill.status}</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Grand Total</span>
                <span className="font-semibold">₹{viewBill.grandTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span>₹{viewBill.paidAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-medium text-red-500">
                <span>Outstanding</span>
                <span>₹{viewBill.outstandingBalance.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setViewBill(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
