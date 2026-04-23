"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, HOSPITALS_PATH } from "../../lib/api";
import SuccessModal from "../../components/SuccessModal";
import { LoadingOverlay } from "../../components/LoadingSpinner";

// ─── Backend Bill Panel (for OP registrations created via new flow) ───────────
function BackendBillPanel({ refId }) {
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: 0, mode: "CASH", referenceNumber: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(buildApiUrl(`/api/bills/by-ref/${refId}`), { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(setBill)
      .finally(() => setLoading(false));
  }, [refId]);

  const recordPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(buildApiUrl(`/api/bills/${bill._id}/payment`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payForm),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setBill(await res.json());
      setPayModal(false);
      toast.success("Payment recorded");
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const printBill = () => {
    if (!bill) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>OP Bill</title>
      <style>body{font-family:Arial,sans-serif;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f5f5f5}.header{text-align:center;margin-bottom:20px}@media print{button{display:none}}</style>
      </head><body>
      <div class="header"><h2>Out-Patient Bill</h2><p>OP ID: ${bill.referenceId} | Bill No: ${bill.billNumber}</p></div>
      <p><strong>Patient:</strong> ${bill.patientName} | <strong>Contact:</strong> ${bill.patientContact || "—"}</p>
      <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>
      ${bill.lineItems?.map(li => `<tr><td>${li.description}</td><td>₹${li.total}</td></tr>`).join("")}
      </tbody></table><br>
      <p><strong>Total: ₹${bill.grandTotal}</strong> | Paid: ₹${bill.paidAmount} | Outstanding: ₹${bill.outstandingBalance}</p>
      <p>Status: ${bill.status}</p>
      <script>window.print();</script></body></html>`);
  };

  if (loading) return <div className="text-center py-8 text-gray-400">Loading bill...</div>;
  if (!bill) return <div className="text-center py-8 text-gray-400">No bill found for ref: {refId}</div>;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-gray-900">OP Bill — {bill.referenceId}</h2>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${bill.status === "PAID" ? "bg-green-200 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{bill.status}</span>
        </div>
        <p className="text-sm text-gray-600 mb-3">Patient: <strong>{bill.patientName}</strong></p>
        <div className="space-y-1 text-sm">
          {bill.lineItems?.map((li, i) => (
            <div key={i} className="flex justify-between border-b border-green-100 py-1">
              <span>{li.description}</span><span className="font-medium">₹{li.total}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-green-200 space-y-1 text-sm">
          <div className="flex justify-between font-bold"><span>Grand Total</span><span>₹{bill.grandTotal}</span></div>
          <div className="flex justify-between text-green-700"><span>Paid</span><span>₹{bill.paidAmount}</span></div>
          <div className="flex justify-between text-red-600 font-medium"><span>Outstanding</span><span>₹{bill.outstandingBalance}</span></div>
        </div>
      </div>
      <div className="flex gap-3">
        {bill.outstandingBalance > 0 && (
          <button onClick={() => { setPayForm(p => ({ ...p, amount: bill.outstandingBalance })); setPayModal(true); }}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium">Record Payment</button>
        )}
        <button onClick={printBill} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">Print Bill</button>
      </div>
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
                {["CASH","CARD","UPI","INSURANCE"].map(m => (
                  <button key={m} type="button" onClick={() => setPayForm(p => ({ ...p, mode: m }))}
                    className={`px-3 py-1.5 text-xs rounded-lg border ${payForm.mode === m ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"}`}>{m}</button>
                ))}
              </div>
              {payForm.mode !== "CASH" && (
                <input type="text" placeholder="Reference No." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.referenceNumber} onChange={e => setPayForm(p => ({ ...p, referenceNumber: e.target.value }))} />
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setPayModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
];

const DEFAULT_CONSULTATION_FEE = 300;
const REGISTRATION_FEE = 50;
const FOLLOW_UP_FEE = 150;

export default function BillingPage() {
  const searchParams = useSearchParams();
  const refId = searchParams.get("ref");

  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    hospitalId: "",
    patientId: "",
    appointmentId: "",
    consultationFee: DEFAULT_CONSULTATION_FEE,
    registrationFee: REGISTRATION_FEE,
    followUpFee: 0,
    paymentMode: "CASH",
    isFollowUp: false,
  });
  const [saving, setSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [successModal, setSuccessModal] = useState({ open: false, title: "", message: "" });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [patRes, aptRes, docRes, hospRes] = await Promise.all([
        fetch(buildApiUrl("/api/users?role=PATIENT"), { headers }),
        fetch(buildApiUrl("/api/appointments"), { headers }),
        fetch(buildApiUrl("/api/users?role=DOCTOR"), { headers }),
        fetch(buildApiUrl(HOSPITALS_PATH), { headers }).catch(() => null),
      ]);
      setPatients(patRes.ok ? await patRes.json() : []);
      setAppointments(aptRes.ok ? await aptRes.json() : []);
      setDoctors(docRes.ok ? await docRes.json() : []);
      setHospitals(hospRes?.ok ? await hospRes.json() : []);
    } catch (e) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const total = form.consultationFee + form.registrationFee + (form.isFollowUp ? form.followUpFee : 0);

  function handleCollectPayment(e) {
    e.preventDefault();
    setSaving(true);
    const patient = patients.find((p) => (p._id || p.id) === form.patientId);
    const apt = appointments.find((a) => (a._id || a.id) === form.appointmentId);
    const receipt = {
      id: "RCP-" + Date.now(),
      date: new Date().toISOString(),
      hospitalId: form.hospitalId,
      patientName: patient?.name || "—",
      patientId: form.patientId,
      consultationFee: form.consultationFee,
      registrationFee: form.registrationFee,
      followUpFee: form.isFollowUp ? form.followUpFee : 0,
      total,
      paymentMode: form.paymentMode,
    };
    setLastReceipt(receipt);
    setSuccessModal({ open: true, title: "Payment collected", message: `Receipt ${receipt.id} — ₹${total} collected via ${form.paymentMode}. You can print the receipt below.` });
    if (typeof window !== "undefined") {
      try {
        const receipts = JSON.parse(localStorage.getItem("reception_receipts") || "[]");
        receipts.push(receipt);
        localStorage.setItem("reception_receipts", JSON.stringify(receipts));
        const payments = JSON.parse(localStorage.getItem("reception_payments") || "[]");
        payments.push({ ...receipt, patientName: receipt.patientName, paymentMode: receipt.paymentMode, total: receipt.total, date: receipt.date, hospitalId: receipt.hospitalId });
        localStorage.setItem("reception_payments", JSON.stringify(payments));
      } catch (e) {}
    }
    toast.success(`Receipt ${receipt.id} — ₹${total} collected via ${form.paymentMode}. Print below.`);
    setForm((f) => ({ ...f, appointmentId: "", patientId: "", followUpFee: 0, isFollowUp: false }));
    setSaving(false);
  }

  function printReceipt() {
    if (!lastReceipt) return;
    const w = window.open("", "_blank");
    w.document.write(`
      <!DOCTYPE html><html><head><title>Receipt ${lastReceipt.id}</title></head><body style="font-family:sans-serif;padding:24px;max-width:400px;">
        <h2>OPD Receipt</h2>
        <p><strong>Receipt:</strong> ${lastReceipt.id}</p>
        <p><strong>Date:</strong> ${new Date(lastReceipt.date).toLocaleString()}</p>
        <p><strong>Patient:</strong> ${lastReceipt.patientName}</p>
        <hr/>
        <p>Consultation: ₹${lastReceipt.consultationFee}</p>
        <p>Registration: ₹${lastReceipt.registrationFee}</p>
        ${lastReceipt.followUpFee ? `<p>Follow-up: ₹${lastReceipt.followUpFee}</p>` : ""}
        <p><strong>Total: ₹${lastReceipt.total}</strong></p>
        <p>Payment: ${lastReceipt.paymentMode}</p>
        <hr/>
        <p style="font-size:12px;color:#666;">Thank you.</p>
      </body></html>
    `);
    w.document.close();
    w.print();
    w.close();
  }

  // If ?ref= is present, show the backend bill (OP/IP/Services registration flow)
  if (refId) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Bill Details</h1>
        <BackendBillPanel refId={refId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SuccessModal open={successModal.open} title={successModal.title} message={successModal.message} onClose={() => setSuccessModal({ open: false, title: "", message: "" })} />
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">OPD & Billing</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Collect consultation fee, registration fee; print receipt</p>
      </div>

      {loading ? (
        <LoadingOverlay text="Loading billing…" />
      ) : (
      <>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm max-w-xl">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Fee collection</h2>
        <form onSubmit={handleCollectPayment} className="space-y-4">
          {hospitals.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Hospital</label>
              <select value={form.hospitalId} onChange={(e) => setForm((f) => ({ ...f, hospitalId: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50">
                <option value="">Select hospital</option>
                {hospitals.map((h) => (
                  <option key={h._id || h.id} value={h._id || h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Patient *</label>
            <select
              required
              value={form.patientId}
              onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50"
            >
              <option value="">Select patient</option>
              {patients.map((p) => (
                <option key={p._id || p.id} value={p._id || p.id}>{p.name} — {p.phone || p.mobile || "—"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Consultation fee (₹)</label>
            <input type="number" min="0" value={form.consultationFee} onChange={(e) => setForm((f) => ({ ...f, consultationFee: Number(e.target.value) || 0 }))} className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Registration fee (₹)</label>
            <input type="number" min="0" value={form.registrationFee} onChange={(e) => setForm((f) => ({ ...f, registrationFee: Number(e.target.value) || 0 }))} className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="followUp" checked={form.isFollowUp} onChange={(e) => setForm((f) => ({ ...f, isFollowUp: e.target.checked }))} className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
            <label htmlFor="followUp" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Follow-up visit</label>
          </div>
          {form.isFollowUp && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Follow-up fee (₹)</label>
              <input type="number" min="0" value={form.followUpFee || FOLLOW_UP_FEE} onChange={(e) => setForm((f) => ({ ...f, followUpFee: Number(e.target.value) || 0 }))} className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Payment mode *</label>
            <select value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50">
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Total: ₹{total}</p>
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? "Processing…" : "Collect & generate receipt"}
          </button>
        </form>
      </div>

      {lastReceipt && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm max-w-md">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Last receipt</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{lastReceipt.id} — {lastReceipt.patientName} — ₹{lastReceipt.total}</p>
          <button type="button" onClick={printReceipt} className="mt-3 rounded-lg bg-zinc-200 dark:bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600">
            Print receipt
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}
