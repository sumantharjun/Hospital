"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";

export default function ServiceBillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const svcIdParam = searchParams.get("svcId");

  const [searchId, setSearchId] = useState(svcIdParam || "");
  const [reg, setReg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: 0, mode: "CASH", referenceNumber: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/"); return; }
    if (svcIdParam) fetchReg(svcIdParam);
  }, [svcIdParam]);

  const fetchReg = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(`/api/service-registrations/by-svc-id/${id}`), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Service registration not found");
      setReg(await res.json());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchId.trim()) fetchReg(searchId.trim());
  };

  const recordPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(buildApiUrl(`/api/service-registrations/${reg._id}/payment`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payForm),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setReg(await res.json());
      setPayModal(false);
      toast.success("Payment recorded");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const printBill = () => {
    if (!reg) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Service Bill</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#333}
        h1{text-align:center;font-size:22px;margin-bottom:4px}
        .sub{text-align:center;font-size:13px;color:#666;margin-bottom:20px}
        hr{margin:16px 0;border:none;border-top:1px solid #ddd}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        th{background:#f5f5f5;font-weight:bold}
        .total-row{font-weight:bold;background:#f9f9f9}
        .right{text-align:right}
        .section h3{font-size:12px;font-weight:bold;color:#444;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
        .row{display:flex;gap:8px;margin-bottom:4px;font-size:13px}
        .lbl{color:#666;min-width:160px}.val{font-weight:500}
        @media print{button{display:none}}
      </style></head><body>
      <h1>Service Bill</h1>
      <div class="sub">Hospital Services Receipt</div>
      <hr>
      <div class="section">
        <div class="row"><span class="lbl">Service Reg ID:</span><span class="val">${reg.serviceRegId}</span></div>
        <div class="row"><span class="lbl">Patient:</span><span class="val">${reg.patientId?.name || "Walk-in"}</span></div>
        <div class="row"><span class="lbl">Date:</span><span class="val">${new Date(reg.createdAt).toLocaleString()}</span></div>
        <div class="row"><span class="lbl">Status:</span><span class="val">${reg.status}</span></div>
      </div>
      <hr>
      <table>
        <thead><tr><th>Service</th><th>Category</th><th>Fee</th><th>Tax</th><th class="right">Total</th></tr></thead>
        <tbody>
          ${(reg.services || []).map(s => `
            <tr>
              <td>${s.serviceName || s.serviceId?.name || "—"}</td>
              <td>${s.category || s.serviceId?.category || "—"}</td>
              <td>₹${s.fee}</td>
              <td>₹${(s.taxAmount || 0).toFixed(2)}</td>
              <td class="right">₹${s.total}</td>
            </tr>`).join("")}
          <tr class="total-row"><td colspan="4" class="right">Subtotal</td><td class="right">₹${reg.subtotal || 0}</td></tr>
          <tr class="total-row"><td colspan="4" class="right">Tax</td><td class="right">₹${(reg.taxTotal || 0).toFixed(2)}</td></tr>
          ${reg.discountAmount ? `<tr class="total-row"><td colspan="4" class="right">Discount (${reg.discountPercent || 0}%)</td><td class="right">-₹${reg.discountAmount}</td></tr>` : ""}
          <tr class="total-row"><td colspan="4" class="right"><strong>Grand Total</strong></td><td class="right"><strong>₹${reg.grandTotal}</strong></td></tr>
          <tr><td colspan="4" class="right">Paid</td><td class="right">₹${reg.paidAmount || 0}</td></tr>
          <tr><td colspan="4" class="right">Outstanding</td><td class="right">₹${reg.outstandingBalance || 0}</td></tr>
        </tbody>
      </table>
      ${(reg.paymentHistory || []).length > 0 ? `
      <hr>
      <div class="section">
        <h3>Payment History</h3>
        <table>
          <thead><tr><th>Date</th><th>Mode</th><th>Ref</th><th class="right">Amount</th></tr></thead>
          <tbody>
            ${reg.paymentHistory.map(p => `<tr>
              <td>${new Date(p.date || p.paidAt).toLocaleString()}</td>
              <td>${p.mode}</td>
              <td>${p.referenceNumber || "—"}</td>
              <td class="right">₹${p.amount}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}
      <hr>
      <p style="font-size:11px;color:#999;text-align:center;margin-top:30px">Generated on ${new Date().toLocaleString()} — Hospital Management System</p>
      <script>window.print();</script>
      </body></html>`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">←</button>
        <h1 className="text-xl font-bold text-gray-900">Service Bill</h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input type="text" placeholder="Enter Service Reg ID (e.g. SVC-20240101-0001)..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={searchId} onChange={e => setSearchId(e.target.value)} />
        <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Search</button>
      </form>

      {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}

      {!loading && reg && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold text-gray-900">{reg.serviceRegId}</h2>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                reg.status === "COMPLETED" ? "bg-green-200 text-green-800" :
                reg.status === "PARTIAL" ? "bg-yellow-100 text-yellow-800" :
                "bg-orange-100 text-orange-800"
              }`}>{reg.status}</span>
            </div>
            <p className="text-sm text-gray-600">Patient: <strong>{reg.patientId?.name || "Walk-in"}</strong></p>
            <p className="text-xs text-gray-400 mt-1">{new Date(reg.createdAt).toLocaleString()}</p>
          </div>

          {/* Services Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Service</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Category</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Fee</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Tax</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {(reg.services || []).map((s, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-4 py-2">{s.serviceName || s.serviceId?.name || "—"}</td>
                    <td className="px-4 py-2 text-gray-500">{s.category || s.serviceId?.category || "—"}</td>
                    <td className="px-4 py-2 text-right">₹{s.fee}</td>
                    <td className="px-4 py-2 text-right text-gray-500">₹{(s.taxAmount || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-medium">₹{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-200 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{reg.subtotal || 0}</span></div>
              <div className="flex justify-between text-gray-500"><span>Tax</span><span>₹{(reg.taxTotal || 0).toFixed(2)}</span></div>
              {reg.discountAmount > 0 && (
                <div className="flex justify-between text-green-600"><span>Discount ({reg.discountPercent}%)</span><span>-₹{reg.discountAmount}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span><span>₹{reg.grandTotal}</span></div>
              <div className="flex justify-between text-green-700"><span>Paid</span><span>₹{reg.paidAmount || 0}</span></div>
              <div className="flex justify-between text-red-600 font-medium"><span>Outstanding</span><span>₹{reg.outstandingBalance || 0}</span></div>
            </div>
          </div>

          {/* Payment History */}
          {(reg.paymentHistory || []).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-sm text-gray-800 mb-3">Payment History</h3>
              <div className="space-y-2">
                {reg.paymentHistory.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <div>
                      <span className="font-medium">{p.mode}</span>
                      {p.referenceNumber && <span className="text-gray-400 ml-2 text-xs">Ref: {p.referenceNumber}</span>}
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-green-700">₹{p.amount}</div>
                      <div className="text-xs text-gray-400">{new Date(p.date || p.paidAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {(reg.outstandingBalance || 0) > 0 && (
              <button onClick={() => { setPayForm(p => ({ ...p, amount: reg.outstandingBalance })); setPayModal(true); }}
                className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium">Record Payment</button>
            )}
            <button onClick={printBill}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium">Print Bill</button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold mb-4">Record Payment</h3>
            <form onSubmit={recordPayment} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Amount (₹)</label>
                <input required type="number" min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: Number(e.target.value) }))} />
              </div>
              <div className="flex flex-wrap gap-2">
                {["CASH", "CARD", "UPI", "INSURANCE"].map(m => (
                  <button key={m} type="button" onClick={() => setPayForm(p => ({ ...p, mode: m }))}
                    className={`px-3 py-1.5 text-xs rounded-lg border ${payForm.mode === m ? "bg-purple-600 text-white border-purple-600" : "border-gray-300"}`}>{m}</button>
                ))}
              </div>
              {payForm.mode !== "CASH" && (
                <input type="text" placeholder="Reference No." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.referenceNumber} onChange={e => setPayForm(p => ({ ...p, referenceNumber: e.target.value }))} />
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setPayModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
