"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, HOSPITALS_PATH } from "../../lib/api";
import { LoadingOverlay } from "../../components/LoadingSpinner";

const BILL_TYPE_COLORS = {
  IP:      "bg-red-100 text-red-700",
  OP:      "bg-blue-100 text-blue-700",
  SERVICE: "bg-purple-100 text-purple-700",
};

const MODE_COLORS = {
  CASH:      "bg-amber-100 text-amber-800",
  UPI:       "bg-blue-100 text-blue-800",
  CARD:      "bg-violet-100 text-violet-800",
  INSURANCE: "bg-green-100 text-green-800",
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function PaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ totalBilled: 0, totalCollected: 0, totalPending: 0, byMode: {} });
  const [hospitals, setHospitals] = useState([]);
  const [hospitalId, setHospitalId] = useState("");
  const [date, setDate] = useState(todayStr());

  useEffect(() => {
    fetch(buildApiUrl(HOSPITALS_PATH), { headers: getAuthHeaders() })
      .then((r) => r.json()).then((d) => setHospitals(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: date, to: date });
      if (hospitalId) params.set("hospitalId", hospitalId);

      const [billsRes, revenueRes] = await Promise.all([
        fetch(buildApiUrl(`/api/bills?${params}`), { headers: getAuthHeaders() }),
        fetch(buildApiUrl(`/api/reports/hospital/revenue?from=${date}&to=${date}${hospitalId ? `&hospitalId=${hospitalId}` : ""}`), { headers: getAuthHeaders() }),
      ]);

      if (billsRes.ok) {
        const bills = await billsRes.json();
        const arr = Array.isArray(bills) ? bills : bills.bills || [];
        const txns = [];
        arr.forEach((bill) => {
          (bill.paymentHistory || []).forEach((pay) => {
            const payDate = (pay.receivedAt || pay.paidAt || "").slice(0, 10);
            if (payDate === date) {
              txns.push({
                billId: bill._id,
                billType: bill.billType,
                patientName: bill.patientName || bill.patientId?.name || "—",
                refId: bill.referenceId || "—",
                mode: pay.mode || "CASH",
                amount: pay.amount || 0,
                paidAt: pay.receivedAt || pay.paidAt,
              });
            }
          });
        });
        setTransactions(txns);
      }

      if (revenueRes.ok) {
        const rev = await revenueRes.json();
        setSummary({ totalBilled: rev.totalBilled || 0, totalCollected: rev.totalCollected || 0, totalPending: rev.totalPending || 0, byMode: rev.byMode || {} });
      }
    } catch {
      toast.error("Failed to load payment data");
    } finally {
      setLoading(false);
    }
  }, [date, hospitalId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const grandTotal = transactions.reduce((s, p) => s + Number(p.amount || 0), 0);
  const byMode = transactions.reduce((acc, p) => {
    const m = p.mode || "OTHER";
    if (!acc[m]) acc[m] = { count: 0, total: 0 };
    acc[m].count++;
    acc[m].total += Number(p.amount || 0);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a202c] uppercase tracking-tight">Payment Summary</h1>
          <p className="mt-1 text-sm text-[#4a5568]">Daily collections from IP, OP and Service bills — live from backend.</p>
        </div>
        <button onClick={fetchPayments} className="flex items-center gap-2 px-4 py-2 bg-[#0d47a1] text-white rounded-sm text-sm font-medium hover:bg-[#0a3d91] transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#cbd5e0] rounded-sm p-4 flex flex-wrap gap-4 items-end shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-[#2d3748] mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm text-[#1a202c] focus:ring-2 focus:ring-[#0d47a1] outline-none" />
        </div>
        {hospitals.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-[#2d3748] mb-1">Hospital</label>
            <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}
              className="border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm text-[#1a202c] focus:ring-2 focus:ring-[#0d47a1] outline-none min-w-48">
              <option value="">All hospitals</option>
              {hospitals.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? <LoadingOverlay text="Loading payments…" /> : (
        <>
          {/* Revenue KPIs from reports API */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Billed", value: summary.totalBilled, border: "border-blue-500", text: "text-blue-700" },
              { label: "Collected",    value: summary.totalCollected, border: "border-green-500", text: "text-green-700" },
              { label: "Outstanding",  value: summary.totalPending,   border: "border-red-500",   text: "text-red-700" },
            ].map((s) => (
              <div key={s.label} className={`bg-white border-l-4 ${s.border} border border-[#e2e8f0] rounded-sm p-4 shadow-sm`}>
                <p className="text-xs text-[#718096] uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.text}`}>₹{(s.value || 0).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>

          {/* By mode */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {["CASH", "UPI", "CARD", "INSURANCE"].map((mode) => (
              <div key={mode} className="bg-white border border-[#e2e8f0] rounded-sm p-4 shadow-sm">
                <p className="text-xs text-[#718096] uppercase">{mode}</p>
                <p className="text-xl font-bold text-[#1a202c] mt-1">
                  ₹{(byMode[mode]?.total || summary.byMode?.[mode] || 0).toLocaleString("en-IN")}
                </p>
                {byMode[mode] && <p className="text-xs text-[#718096] mt-0.5">{byMode[mode].count} txn(s)</p>}
              </div>
            ))}
          </div>

          {/* Grand total */}
          <div className="bg-[#e3f2fd] border-2 border-[#0d47a1] rounded-sm p-5">
            <p className="text-sm text-[#0d47a1] font-semibold uppercase">Total Collected on {date}</p>
            <p className="text-4xl font-bold text-[#1a202c] mt-1">₹{grandTotal.toLocaleString("en-IN")}</p>
            <p className="text-sm text-[#4a5568] mt-1">{transactions.length} transaction(s)</p>
          </div>

          {/* Transactions table */}
          <div className="bg-white border border-[#e2e8f0] rounded-sm shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
              <h2 className="font-semibold text-[#1a202c]">Payment Transactions</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="p-10 text-center text-[#718096]">No payments recorded for {date}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <tr>
                      {["Time", "Patient", "Bill Type", "Ref ID", "Mode", "Amount"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#4a5568] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {transactions.map((p, i) => (
                      <tr key={i} className="hover:bg-[#f5f7fa]">
                        <td className="px-4 py-3 text-[#718096]">
                          {p.paidAt ? new Date(p.paidAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#1a202c]">{p.patientName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BILL_TYPE_COLORS[p.billType] || "bg-gray-100 text-gray-700"}`}>{p.billType || "—"}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#4a5568]">{p.refId}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${MODE_COLORS[p.mode] || "bg-gray-100 text-gray-700"}`}>{p.mode}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#1a202c]">₹{Number(p.amount).toLocaleString("en-IN")}</td>
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
  );
}
