"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import type { LabBill } from "@/lib/types";
import toast from "react-hot-toast";

export default function PaymentsPage() {
  const [bills, setBills] = useState<LabBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<LabBill | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, mode: "CASH" as "CASH" | "CARD" | "UPI", referenceNumber: "", notes: "" });
  const [paying, setPaying] = useState(false);
  const [filter, setFilter] = useState("ACTIVE");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filter && filter !== "ALL") params.set("status", filter);
      const d = await apiGet<{ bills: LabBill[] }>(`/api/lab/billing?${params}`);
      setBills(d.bills);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter]);

  function openPay(bill: LabBill) {
    setSelectedBill(bill);
    setPayForm({ amount: bill.outstandingBalance, mode: "CASH", referenceNumber: "", notes: "" });
  }

  async function recordPayment() {
    if (!selectedBill) return;
    if (payForm.amount <= 0) { toast.error("Amount must be greater than 0"); return; }
    setPaying(true);
    try {
      await apiPost(`/api/lab/billing/${selectedBill._id}/payment`, payForm);
      toast.success("Payment recorded");
      setSelectedBill(null);
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setPaying(false); }
  }

  const STATUS_BADGE: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    PARTIAL: "bg-yellow-100 text-yellow-700",
    ACTIVE: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-red-100 text-red-600",
    DRAFT: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Payments</h1>

      <div className="flex gap-2 mb-5 flex-wrap">
        {["ALL", "ACTIVE", "PARTIAL", "PAID", "CANCELLED"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">Loading…</div> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Bill #</th>
                <th className="text-left px-4 py-3 font-medium">Patient</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-right px-4 py-3 font-medium">Paid</th>
                <th className="text-right px-4 py-3 font-medium">Outstanding</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.billNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{b.patientName}</div>
                    <div className="text-xs text-gray-400">{new Date(b.createdAt).toLocaleDateString("en-IN")}</div>
                  </td>
                  <td className="px-4 py-3 text-right">₹{b.grandTotal.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right text-green-600">₹{b.paidAmount.toLocaleString("en-IN")}</td>
                  <td className={`px-4 py-3 text-right font-medium ${b.outstandingBalance > 0 ? "text-red-500" : "text-gray-400"}`}>
                    ₹{b.outstandingBalance.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-700"}`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(b.status === "ACTIVE" || b.status === "PARTIAL") && (
                      <button onClick={() => openPay(b)} className="text-blue-600 hover:underline text-xs">Record Payment</button>
                    )}
                  </td>
                </tr>
              ))}
              {bills.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No bills found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-1">Record Payment</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedBill.patientName} · Outstanding: <strong>₹{selectedBill.outstandingBalance.toLocaleString("en-IN")}</strong></p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input type="number" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                  max={selectedBill.outstandingBalance} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <div className="flex gap-2">
                  {(["CASH", "CARD", "UPI"] as const).map((m) => (
                    <button key={m} onClick={() => setPayForm((f) => ({ ...f, mode: m }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${payForm.mode === m ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {(payForm.mode === "CARD" || payForm.mode === "UPI") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input value={payForm.referenceNumber} onChange={(e) => setPayForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Transaction ID / UTR" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setSelectedBill(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={recordPayment} disabled={paying} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                {paying ? "Recording…" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
