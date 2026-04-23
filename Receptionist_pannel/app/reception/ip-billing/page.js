"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";

export default function IPBillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ipId = searchParams.get("ipId");

  const [bill, setBill] = useState(null);
  const [admission, setAdmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, mode: "CASH", referenceNumber: "", notes: "" });
  const [savingPayment, setSavingPayment] = useState(false);
  const [chargeModal, setChargeModal] = useState(false);
  const [chargeForm, setChargeForm] = useState({ description: "", category: "OTHER", unitPrice: 0, quantity: 1 });
  const [savingCharge, setSavingCharge] = useState(false);
  const [searchIpId, setSearchIpId] = useState(ipId || "");

  const fetchData = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(`/api/ip-admissions/by-ip-id/${id}`), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("IP not found");
      const data = await res.json();
      setAdmission(data.admission);
      setBill(data.bill);
    } catch (err) {
      toast.error(err.message || "Failed to load bill");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/"); return; }
    if (ipId) fetchData(ipId);
    else setLoading(false);
  }, [ipId]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchIpId) router.push(`/reception/ip-billing?ipId=${searchIpId}`);
  };

  const addPayment = async (e) => {
    e.preventDefault();
    if (!bill) return;
    setSavingPayment(true);
    try {
      const res = await fetch(buildApiUrl(`/api/bills/${bill._id}/payment`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(paymentForm),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setBill(await res.json());
      setPaymentModal(false);
      setPaymentForm({ amount: 0, mode: "CASH", referenceNumber: "", notes: "" });
      toast.success("Payment recorded");
    } catch (err) { toast.error(err.message); }
    finally { setSavingPayment(false); }
  };

  const addCharge = async (e) => {
    e.preventDefault();
    if (!bill) return;
    setSavingCharge(true);
    try {
      const total = chargeForm.unitPrice * chargeForm.quantity;
      const res = await fetch(buildApiUrl(`/api/bills/${bill._id}/line-items`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ lineItems: [{ ...chargeForm, taxPercent: 0, taxAmount: 0, total }] }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setBill(await res.json());
      setChargeModal(false);
      setChargeForm({ description: "", category: "OTHER", unitPrice: 0, quantity: 1 });
      toast.success("Charge added");
    } catch (err) { toast.error(err.message); }
    finally { setSavingCharge(false); }
  };

  const printBill = () => {
    if (!bill) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>IP Bill</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .total { font-weight: bold; font-size: 16px; }
        .header { text-align: center; margin-bottom: 20px; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <div class="header"><h2>In-Patient Bill</h2><p>IP ID: ${bill.referenceId} | Bill No: ${bill.billNumber}</p></div>
        <p><strong>Patient:</strong> ${bill.patientName} | <strong>Phone:</strong> ${bill.patientContact || "—"}</p>
        <table>
          <thead><tr><th>Description</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
          <tbody>
            ${bill.lineItems?.map(li => `<tr><td>${li.description}</td><td>${li.category}</td><td>${li.quantity}</td><td>₹${li.unitPrice}</td><td>₹${li.total}</td></tr>`).join("")}
          </tbody>
        </table>
        <br>
        <p>Subtotal: ₹${bill.subtotal}</p>
        <p>Tax: ₹${bill.taxTotal}</p>
        ${bill.discountAmount > 0 ? `<p>Discount: -₹${bill.discountAmount}</p>` : ""}
        <p class="total">Grand Total: ₹${bill.grandTotal}</p>
        <p>Paid: ₹${bill.paidAmount}</p>
        <p>Outstanding: ₹${bill.outstandingBalance}</p>
        <p>Status: ${bill.status} ${bill.isFrozen ? "(FROZEN)" : ""}</p>
        <script>window.print();</script>
      </body></html>
    `);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">←</button>
        <h1 className="text-xl font-bold text-gray-900">IP Billing</h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input type="text" placeholder="Enter IP ID (e.g. IP-20250101-0001)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={searchIpId} onChange={e => setSearchIpId(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Search</button>
      </form>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !bill ? (
        <div className="text-center py-12 text-gray-300">Enter an IP ID to view billing details.</div>
      ) : (
        <div className="space-y-4">
          {/* Patient & Admission Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between border-b border-gray-50 py-1"><span className="text-gray-500">IP ID</span><span className="font-mono font-bold">{bill.referenceId}</span></div>
              <div className="flex justify-between border-b border-gray-50 py-1"><span className="text-gray-500">Bill No.</span><span className="font-mono text-xs">{bill.billNumber}</span></div>
              <div className="flex justify-between border-b border-gray-50 py-1"><span className="text-gray-500">Patient</span><span className="font-medium">{bill.patientName}</span></div>
              <div className="flex justify-between border-b border-gray-50 py-1"><span className="text-gray-500">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${bill.status === "PAID" ? "bg-green-100 text-green-700" : bill.isFrozen ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {bill.isFrozen ? "FROZEN" : bill.status}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">Charges</h3>
              {!bill.isFrozen && (
                <button onClick={() => setChargeModal(true)} className="text-xs text-blue-600 hover:underline">+ Add Charge</button>
              )}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Unit</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.lineItems?.map((li, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-2">{li.description}</td>
                    <td className="p-2 text-gray-500">{li.category?.replace(/_/g, " ")}</td>
                    <td className="p-2 text-right">{li.quantity}</td>
                    <td className="p-2 text-right">₹{li.unitPrice}</td>
                    <td className="p-2 text-right font-medium">₹{li.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{bill.subtotal}</span></div>
              {bill.taxTotal > 0 && <div className="flex justify-between text-gray-500"><span>Tax</span><span>₹{bill.taxTotal}</span></div>}
              {bill.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount ({bill.discountPercent}%)</span><span>-₹{bill.discountAmount}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span><span>₹{bill.grandTotal}</span></div>
              <div className="flex justify-between text-green-600"><span>Paid</span><span>₹{bill.paidAmount}</span></div>
              <div className="flex justify-between font-bold text-red-600"><span>Outstanding</span><span>₹{bill.outstandingBalance}</span></div>
            </div>
          </div>

          {/* Payment History */}
          {bill.paymentHistory?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 text-sm mb-3">Payment History</h3>
              <div className="space-y-2">
                {bill.paymentHistory.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs border-b border-gray-50 pb-2">
                    <div>
                      <span className="font-medium">{p.mode}</span>
                      {p.referenceNumber && <span className="text-gray-500 ml-1">#{p.referenceNumber}</span>}
                      <span className="text-gray-400 ml-2">{new Date(p.receivedAt).toLocaleString()}</span>
                    </div>
                    <span className="font-semibold text-green-600">₹{p.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            {!bill.isFrozen && bill.outstandingBalance > 0 && (
              <button onClick={() => { setPaymentForm(p => ({ ...p, amount: bill.outstandingBalance })); setPaymentModal(true); }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Record Payment</button>
            )}
            <button onClick={printBill} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">Print Bill</button>
            {admission && (
              <button onClick={() => router.push(`/reception/discharge?ipId=${bill.referenceId}`)}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Initiate Discharge</button>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">Record Payment</h2>
            <form onSubmit={addPayment} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Amount (₹)</label>
                <input required type="number" min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Payment Mode</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {["CASH","CARD","UPI","INSURANCE"].map(m => (
                    <button key={m} type="button" onClick={() => setPaymentForm(p => ({ ...p, mode: m }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${paymentForm.mode === m ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"}`}>{m}</button>
                  ))}
                </div>
              </div>
              {paymentForm.mode !== "CASH" && (
                <div>
                  <label className="text-xs font-medium text-gray-600">Reference Number</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={paymentForm.referenceNumber} onChange={e => setPaymentForm(p => ({ ...p, referenceNumber: e.target.value }))} />
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setPaymentModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
                <button type="submit" disabled={savingPayment} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium">
                  {savingPayment ? "Saving..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Charge Modal */}
      {chargeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">Add Charge</h2>
            <form onSubmit={addCharge} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Description *</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={chargeForm.description} onChange={e => setChargeForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Category</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={chargeForm.category} onChange={e => setChargeForm(p => ({ ...p, category: e.target.value }))}>
                  {["DOCTOR_CONSULTATION","ROOM_RENT","BED_CHARGE","LAB","PHARMACY","PROCEDURE","SERVICE","EMERGENCY","OTHER"].map(c => (
                    <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Unit Price (₹)</label>
                  <input type="number" min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={chargeForm.unitPrice} onChange={e => setChargeForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Quantity</label>
                  <input type="number" min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={chargeForm.quantity} onChange={e => setChargeForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setChargeModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
                <button type="submit" disabled={savingCharge} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
