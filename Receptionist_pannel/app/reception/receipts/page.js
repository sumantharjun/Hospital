"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";
import { LoadingOverlay } from "../../components/LoadingSpinner";

function todayStr() { return new Date().toISOString().slice(0, 10); }

const BILL_TYPE_LABELS = { IP: "In-Patient", OP: "Out-Patient", SERVICE: "Service" };

function printBillReceipt(bill) {
  const w = window.open("", "_blank");
  const payments = (bill.paymentHistory || [])
    .map((p) => `<tr><td>${p.mode || "CASH"}</td><td>₹${Number(p.amount || 0).toLocaleString("en-IN")}</td><td>${p.receivedAt ? new Date(p.receivedAt).toLocaleString("en-IN") : "—"}</td></tr>`)
    .join("");
  const items = (bill.lineItems || [])
    .map((li) => `<tr><td>${li.description || li.type}</td><td>₹${Number(li.amount || li.unitPrice || 0).toLocaleString("en-IN")}</td></tr>`)
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Receipt — ${bill.billId || bill._id}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;max-width:480px;margin:auto}h2{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:6px 8px;text-align:left;border-bottom:1px solid #eee}th{font-weight:600;background:#f5f5f5}.total{font-weight:700;font-size:16px}</style>
    </head><body>
    <h2>Receipt</h2>
    <p style="color:#555;font-size:13px;">Bill ID: <strong>${bill.billId || bill._id}</strong> &nbsp;|&nbsp; Type: <strong>${BILL_TYPE_LABELS[bill.billType] || bill.billType}</strong></p>
    <p style="font-size:13px;">Patient: <strong>${bill.patientName || bill.patientId?.name || "—"}</strong></p>
    <p style="font-size:13px;">Ref: <strong>${bill.referenceId || "—"}</strong></p>
    <p style="font-size:13px;">Date: ${new Date(bill.createdAt || bill.updatedAt).toLocaleDateString("en-IN")}</p>
    <hr/>
    <h3>Charges</h3>
    <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>${items || "<tr><td colspan='2'>No items</td></tr>"}</tbody></table>
    <table style="margin-top:8px"><tr><td>Grand Total</td><td class="total">₹${Number(bill.grandTotal || bill.totalAmount || 0).toLocaleString("en-IN")}</td></tr><tr><td>Paid</td><td style="color:green;font-weight:600">₹${Number(bill.paidAmount || 0).toLocaleString("en-IN")}</td></tr><tr><td>Outstanding</td><td style="color:red;font-weight:600">₹${Number((bill.grandTotal || 0) - (bill.paidAmount || 0)).toLocaleString("en-IN")}</td></tr></table>
    ${payments ? `<h3>Payment History</h3><table><thead><tr><th>Mode</th><th>Amount</th><th>Date</th></tr></thead><tbody>${payments}</tbody></table>` : ""}
    <hr/><p style="font-size:11px;color:#888;text-align:center">Thank you. Please retain this receipt.</p>
    <script>window.print();window.close();</script></body></html>`);
  w.document.close();
}

export default function ReceiptsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [date, setDate] = useState(todayStr());
  const [billType, setBillType] = useState("ALL");

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: date, to: date });
      if (billType !== "ALL") params.set("billType", billType);
      const res = await fetch(buildApiUrl(`/api/bills?${params}`), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBills(Array.isArray(data) ? data : data.bills || []);
      } else {
        toast.error("Failed to fetch receipts");
      }
    } catch {
      toast.error("Could not connect to backend");
    } finally {
      setLoading(false);
    }
  }, [date, billType]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const filtered = bills.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (b.billId || "").toLowerCase().includes(q) ||
      (b.patientName || "").toLowerCase().includes(q) ||
      (b.referenceId || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a202c] uppercase tracking-tight">Receipts</h1>
          <p className="mt-1 text-sm text-[#4a5568]">View and reprint bills from IP, OP and Service registrations.</p>
        </div>
        <button onClick={fetchBills} className="flex items-center gap-2 px-4 py-2 bg-[#0d47a1] text-white rounded-sm text-sm font-medium hover:bg-[#0a3d91] transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#cbd5e0] rounded-sm p-4 flex flex-wrap gap-4 items-end shadow-sm">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold text-[#2d3748] mb-1">Search (patient / bill ID / ref ID)</label>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..."
            className="w-full border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d47a1] outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#2d3748] mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d47a1] outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#2d3748] mb-1">Bill Type</label>
          <select value={billType} onChange={(e) => setBillType(e.target.value)}
            className="border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d47a1] outline-none">
            <option value="ALL">All Types</option>
            <option value="IP">In-Patient (IP)</option>
            <option value="OP">Out-Patient (OP)</option>
            <option value="SERVICE">Service</option>
          </select>
        </div>
      </div>

      {loading ? <LoadingOverlay text="Loading receipts…" /> : (
        <div className="bg-white border border-[#e2e8f0] rounded-sm shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
            <h2 className="font-semibold text-[#1a202c]">Bills on {date}</h2>
            <span className="text-sm text-[#718096]">{filtered.length} record(s)</span>
          </div>
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-[#718096]">No bills found for {date}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <tr>
                    {["Bill ID", "Type", "Patient", "Ref ID", "Total", "Paid", "Outstanding", "Status", "Action"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#4a5568] uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {filtered.map((bill) => {
                    const outstanding = (bill.grandTotal || 0) - (bill.paidAmount || 0);
                    return (
                      <tr key={bill._id} className="hover:bg-[#f5f7fa]">
                        <td className="px-4 py-3 font-mono text-xs text-[#4a5568]">{bill.billId || bill._id?.slice(-8)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bill.billType === "IP" ? "bg-red-100 text-red-700" : bill.billType === "OP" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                            {bill.billType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#1a202c]">{bill.patientName || bill.patientId?.name || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#718096]">{bill.referenceId || "—"}</td>
                        <td className="px-4 py-3 text-[#1a202c]">₹{(bill.grandTotal || 0).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-green-700 font-semibold">₹{(bill.paidAmount || 0).toLocaleString("en-IN")}</td>
                        <td className={`px-4 py-3 font-semibold ${outstanding > 0 ? "text-red-600" : "text-green-600"}`}>
                          ₹{outstanding.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            bill.status === "PAID" ? "bg-green-100 text-green-700" :
                            bill.status === "PARTIAL" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>{bill.status || "PENDING"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => printBillReceipt(bill)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#0d47a1] text-white text-xs rounded-sm hover:bg-[#0a3d91] transition font-medium">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Print
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
