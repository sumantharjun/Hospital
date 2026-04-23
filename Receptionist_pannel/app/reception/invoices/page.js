"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";
import SuccessModal from "../../components/SuccessModal";
import LoadingSpinner from "../../components/LoadingSpinner";

const PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"];
const RECEIPTS_KEY = "reception_receipts";

const defaultManualInvoice = () => ({
  invoiceNumber: "INV-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-5),
  date: new Date().toISOString().slice(0, 10),
  customerName: "",
  phone: "",
  email: "",
  address: "",
  doctorName: "",
  hospitalName: "",
  prescription: "",
  items: [{ description: "Consultation / OPD", amount: "" }],
  medicines: [{ name: "", quantity: "", dosage: "", amount: "" }],
  paymentMode: "CASH",
  notes: "",
});

function loadReceipts() {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECEIPTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function InvoicesPage() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [manualInvoice, setManualInvoice] = useState(() => defaultManualInvoice());
  const [successModal, setSuccessModal] = useState({ open: false, title: "", message: "" });
  const [activeSection, setActiveSection] = useState("manual"); // receipts | order | manual (mandatory section first)

  const refreshReceipts = useCallback(() => {
    setReceipts(loadReceipts());
  }, []);

  useEffect(() => {
    refreshReceipts();
  }, [refreshReceipts]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#manual") {
      setActiveSection("manual");
      const el = document.getElementById("manual");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  async function downloadOrderInvoice() {
    if (!orderId.trim()) {
      toast.error("Enter order ID");
      return;
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast.error("Not logged in");
      return;
    }
    setLoading(true);
    toast.info("Downloading invoice PDF…");
    try {
      const res = await fetch(buildApiUrl(`/api/invoices/order/${orderId.trim()}`), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Invoice not found or access denied");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${orderId.trim()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessModal({ open: true, title: "Invoice downloaded", message: "Invoice PDF has been downloaded." });
      toast.success("Invoice downloaded.");
    } catch (e) {
      toast.error(e.message || "Download failed");
    } finally {
      setLoading(false);
    }
  }

  function printOpdReceipt(receipt) {
    if (!receipt) return;
    const w = window.open("", "_blank");
    w.document.write(`
      <!DOCTYPE html><html><head><title>Receipt ${receipt.id}</title></head><body style="font-family:sans-serif;padding:24px;max-width:400px;">
        <h2>OPD Receipt</h2>
        <p><strong>Receipt:</strong> ${receipt.id}</p>
        <p><strong>Date:</strong> ${receipt.date ? new Date(receipt.date).toLocaleString() : ""}</p>
        <p><strong>Patient:</strong> ${receipt.patientName || "—"}</p>
        ${receipt.tokenNumber != null ? `<p><strong>Token:</strong> #${receipt.tokenNumber} &nbsp; <strong>Time:</strong> ${receipt.slotTime || "—"}</p>` : ""}
        ${receipt.doctorName ? `<p><strong>Doctor:</strong> Dr. ${receipt.doctorName}</p>` : ""}
        <hr/>
        <p>Consultation: ₹${receipt.consultationFee ?? 0}</p>
        <p>Registration: ₹${receipt.registrationFee ?? 0}</p>
        ${(receipt.followUpFee || 0) > 0 ? `<p>Follow-up: ₹${receipt.followUpFee}</p>` : ""}
        <p><strong>Total: ₹${receipt.total ?? 0}</strong></p>
        <p>Payment: ${receipt.paymentMode || "—"}</p>
        <hr/>
        <p style="font-size:12px;color:#666;">Thank you.</p>
      </body></html>
    `);
    w.document.close();
    w.print();
    w.close();
  }

  function deleteReceipt(receipt) {
    const next = receipts.filter((r) => r.id !== receipt.id || r.date !== receipt.date);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(RECEIPTS_KEY, JSON.stringify(next));
      } catch (e) {}
    }
    setReceipts(next);
    toast.success("Receipt removed from list.");
  }

  function addManualItem() {
    setManualInvoice((m) => ({ ...m, items: [...m.items, { description: "", amount: "" }] }));
  }

  function updateManualItem(index, field, value) {
    setManualInvoice((m) => ({
      ...m,
      items: m.items.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  }

  function removeManualItem(index) {
    setManualInvoice((m) => ({ ...m, items: m.items.filter((_, i) => i !== index) }));
  }

  function addMedicineRow() {
    setManualInvoice((m) => ({ ...m, medicines: [...m.medicines, { name: "", quantity: "", dosage: "", amount: "" }] }));
  }

  function updateMedicineRow(index, field, value) {
    setManualInvoice((m) => ({
      ...m,
      medicines: m.medicines.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  }

  function removeMedicineRow(index) {
    setManualInvoice((m) => ({ ...m, medicines: m.medicines.filter((_, i) => i !== index) }));
  }

  function generateManualInvoice() {
    const m = manualInvoice;
    if (!m.customerName.trim()) {
      toast.error("Customer / Patient name is required");
      return;
    }
    const items = m.items.filter((row) => (row.description || "").trim() || Number(row.amount) > 0);
    const medicines = (m.medicines || []).filter((row) => (row.name || "").trim() || Number(row.quantity) > 0 || Number(row.amount) > 0);
    if (items.length === 0 && medicines.length === 0) {
      toast.error("Add at least one line item or medicine with amount");
      return;
    }
    const itemsTotal = items.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const medicinesTotal = medicines.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const total = itemsTotal + medicinesTotal;
    if (total <= 0) {
      toast.error("Total must be greater than 0");
      return;
    }

    const esc = (s) => String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const nl = (s) => esc(s).replace(/\n/g, "<br>");

    const rowsHtml = items
      .map(
        (row, i) =>
          `<tr><td style="padding:10px;border:1px solid #cbd5e0;">${i + 1}</td><td style="padding:10px;border:1px solid #cbd5e0;">${esc(row.description) || "—"}</td><td style="padding:10px;border:1px solid #cbd5e0;text-align:right;">₹${Number(row.amount || 0).toLocaleString("en-IN")}</td></tr>`
      )
      .join("");

    const medicinesRowsHtml = medicines
      .map(
        (row, i) =>
          `<tr><td style="padding:10px;border:1px solid #cbd5e0;">${i + 1}</td><td style="padding:10px;border:1px solid #cbd5e0;">${esc(row.name) || "—"}</td><td style="padding:10px;border:1px solid #cbd5e0;text-align:center;">${esc(row.quantity) || "—"}</td><td style="padding:10px;border:1px solid #cbd5e0;">${esc(row.dosage) || "—"}</td><td style="padding:10px;border:1px solid #cbd5e0;text-align:right;">₹${Number(row.amount || 0).toLocaleString("en-IN")}</td></tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(m.invoiceNumber)}</title>
<style>
  *{box-sizing:border-box;}
  body{font-family:'Segoe UI',system-ui,sans-serif;max-width:680px;margin:0 auto;padding:0;color:#1a202c;background:#f8fafc;}
  .header{background:linear-gradient(135deg,#0d47a1 0%,#1565c0 100%);color:#fff;padding:24px 28px;border-radius:0 0 12px 12px;}
  .header h1{margin:0;font-size:1.5rem;font-weight:700;}
  .header .sub{opacity:0.9;font-size:0.9rem;margin-top:4px;}
  .card{background:#fff;margin:20px 20px 0;padding:24px 28px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
  .meta{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px;padding:12px 16px;background:#e8f4fd;border-radius:8px;border-left:4px solid #0d47a1;}
  .meta span{font-size:0.9rem;color:#2d3748;}
  .section-title{font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#0d47a1;margin:20px 0 10px;}
  .bill-to{padding:14px 16px;background:#f0f9ff;border-radius:8px;margin-bottom:16px;}
  .bill-to strong{color:#0d47a1;}
  table{width:100%;border-collapse:collapse;margin:12px 0;}
  th{background:#0d47a1;color:#fff;padding:10px 12px;text-align:left;font-size:0.8rem;}
  th.text-right{text-align:right;} th.text-center{text-align:center;}
  td{padding:10px;border:1px solid #e2e8f0;}
  tr:nth-child(even){background:#f8fafc;}
  .total-row{background:#dcfce7 !important;font-weight:700;font-size:1.15rem;}
  .total-row td{border-color:#22c55e;}
  .prescription-box{padding:14px 16px;background:#fefce8;border-radius:8px;border-left:4px solid #eab308;margin:16px 0;}
  .prescription-box .label{font-size:0.75rem;font-weight:700;color:#854d0e;text-transform:uppercase;}
  .footer{margin:24px 20px 20px;padding:16px;text-align:center;font-size:0.85rem;color:#64748b;}
</style></head>
<body>
  <div class="header">
    <h1>Tax Invoice / Bill</h1>
    <div class="sub">${esc(m.hospitalName) || "Medical Centre"}</div>
  </div>
  <div class="card">
    <div class="meta">
      <span><strong>Invoice No:</strong> ${esc(m.invoiceNumber)}</span>
      <span><strong>Date:</strong> ${m.date ? new Date(m.date).toLocaleDateString("en-IN") : "—"}</span>
      ${m.doctorName ? `<span><strong>Doctor:</strong> Dr. ${esc(m.doctorName)}</span>` : ""}
      ${m.hospitalName ? `<span><strong>Hospital:</strong> ${esc(m.hospitalName)}</span>` : ""}
    </div>
    <div class="section-title">Bill To</div>
    <div class="bill-to">
      <p style="margin:0 0 6px 0;font-weight:600;">${esc(m.customerName)}</p>
      ${m.phone ? `<p style="margin:0 0 4px 0;font-size:0.9rem;">Phone: ${esc(m.phone)}</p>` : ""}
      ${m.email ? `<p style="margin:0 0 4px 0;font-size:0.9rem;">Email: ${esc(m.email)}</p>` : ""}
      ${m.address ? `<p style="margin:0;font-size:0.9rem;">${nl(m.address)}</p>` : ""}
    </div>
    ${items.length > 0 ? `
    <div class="section-title">Charges</div>
    <table>
      <thead><tr><th>#</th><th>Description</th><th class="text-right">Amount (₹)</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>` : ""}
    ${medicines.length > 0 ? `
    <div class="section-title">Medicine / Prescription</div>
    <table>
      <thead><tr><th>#</th><th>Medicine</th><th class="text-center">Qty</th><th>Dosage</th><th class="text-right">Amount (₹)</th></tr></thead>
      <tbody>${medicinesRowsHtml}</tbody>
    </table>` : ""}
    <table style="margin-top:16px;">
      <tr class="total-row"><td colspan="2">Total</td><td style="text-align:right;">₹${total.toLocaleString("en-IN")}</td></tr>
    </table>
    <p style="margin:16px 0 8px 0;"><strong>Payment:</strong> ${esc(m.paymentMode)}</p>
    ${m.prescription ? `
    <div class="prescription-box">
      <div class="label">Doctor Prescription</div>
      <p style="margin:8px 0 0 0;white-space:pre-wrap;">${nl(m.prescription)}</p>
    </div>` : ""}
    ${m.notes ? `<p style="font-size:0.9rem;color:#64748b;margin-top:12px;">${nl(m.notes)}</p>` : ""}
  </div>
  <div class="footer">Thank you for your payment. Please keep this invoice for your records.</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${(m.invoiceNumber || "inv").replace(/\s/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    w.print();
    setSuccessModal({ open: true, title: "Invoice generated", message: "Invoice downloaded automatically and opened for printing. You can also open the downloaded HTML file and print or save as PDF." });
    toast.success("Invoice downloaded automatically and opened for print.");
  }

  function resetManualForm() {
    setManualInvoice(defaultManualInvoice());
  }

  const displayReceipts = [...receipts].reverse();

  return (
    <div className="space-y-6">
      <SuccessModal
        open={successModal.open}
        title={successModal.title}
        message={successModal.message}
        onClose={() => setSuccessModal({ open: false, title: "", message: "" })}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">Invoices & Receipts</h1>
          <p className="mt-1 text-sm text-[#4a5568]">Reprint OPD receipts from booking payments, download order invoices, or generate custom invoices.</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 border-b-2 border-[#cbd5e0]">
        <button
          type="button"
          onClick={() => setActiveSection("receipts")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-colors ${activeSection === "receipts" ? "border-[#0d47a1] text-[#0d47a1]" : "border-transparent text-[#718096] hover:text-[#1a202c]"}`}
        >
          OPD receipts
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("order")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-colors ${activeSection === "order" ? "border-[#0d47a1] text-[#0d47a1]" : "border-transparent text-[#718096] hover:text-[#1a202c]"}`}
        >
          Download order PDF
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("manual")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-colors ${activeSection === "manual" ? "border-[#0d47a1] text-[#0d47a1]" : "border-transparent text-[#718096] hover:text-[#1a202c]"}`}
        >
          Generate invoice
        </button>
      </div>

      {/* OPD receipts */}
      {activeSection === "receipts" && (
        <div className="gov-card overflow-hidden">
          <div className="p-4 border-b border-[#cbd5e0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#1a202c]">OPD receipts</h2>
              <p className="text-sm text-[#4a5568]">Receipts from payments collected at appointment booking. Reprint or remove from list.</p>
            </div>
            <button type="button" onClick={refreshReceipts} className="gov-btn-primary px-4 py-2 text-sm">
              Refresh list
            </button>
          </div>
          <div className="overflow-x-auto">
            {displayReceipts.length === 0 ? (
              <div className="p-8 text-center text-[#718096]">No OPD receipts yet. Payments collected when booking appointments appear here.</div>
            ) : (
              <table className="gov-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Receipt ID</th>
                    <th>Patient</th>
                    <th>Token</th>
                    <th>Time</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayReceipts.map((r, i) => (
                    <tr key={r.id + (r.date || "") + i}>
                      <td className="text-[#4a5568] text-sm">{r.date ? new Date(r.date).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                      <td className="font-mono text-sm text-[#1a202c]">{r.id || "—"}</td>
                      <td className="text-[#1a202c]">{r.patientName || "—"}</td>
                      <td className="font-mono text-[#4a5568]">{r.tokenNumber != null ? `#${r.tokenNumber}` : "—"}</td>
                      <td className="text-[#4a5568]">{r.slotTime || "—"}</td>
                      <td className="font-semibold text-[#1a202c]">₹{r.total != null ? Number(r.total).toLocaleString("en-IN") : "0"}</td>
                      <td className="text-[#4a5568] text-sm">{r.paymentMode || "—"}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => printOpdReceipt(r)} className="text-xs px-2 py-1 bg-[#e3f2fd] text-[#0d47a1] border border-[#0d47a1] hover:bg-[#bbdefb]">
                            Reprint
                          </button>
                          <button type="button" onClick={() => deleteReceipt(r)} className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-300 hover:bg-red-100" title="Remove from list">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Download order invoice */}
      {activeSection === "order" && (
        <div className="gov-card p-6 max-w-xl">
          <h2 className="font-semibold text-[#1a202c] border-b border-[#cbd5e0] pb-2 mb-4">Download order invoice (PDF)</h2>
          <p className="text-sm text-[#4a5568] mb-4">Enter patient or order ID to download invoice PDF from backend (e.g. pharmacy or lab order).</p>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Order ID"
              className="gov-input flex-1 min-w-[200px] bg-white px-4 py-2 text-[#1a202c]"
            />
            <button type="button" onClick={downloadOrderInvoice} disabled={loading} className="gov-btn-primary px-5 py-2.5 disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {loading ? <><LoadingSpinner size="sm" /> Downloading…</> : "Download PDF"}
            </button>
          </div>
        </div>
      )}

      {/* Generate invoice (manual) */}
      {activeSection === "manual" && (
        <div id="manual" className="gov-card p-6 scroll-mt-4">
          <h2 className="font-semibold text-[#1a202c] border-b border-[#cbd5e0] pb-2 mb-4">Generate invoice manually <span className="text-red-600 text-sm font-normal">(Mandatory — auto-download)</span></h2>
          <p className="text-sm text-[#4a5568] mb-6">Fill in customer name and line items. On Generate, the invoice is downloaded automatically and opened for printing.</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Invoice number</label>
                <input
                  type="text"
                  value={manualInvoice.invoiceNumber}
                  onChange={(e) => setManualInvoice((m) => ({ ...m, invoiceNumber: e.target.value }))}
                  placeholder="INV-20240224-001"
                  className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Date</label>
                <input type="date" value={manualInvoice.date} onChange={(e) => setManualInvoice((m) => ({ ...m, date: e.target.value }))} className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Customer / Patient name *</label>
                <input
                  type="text"
                  value={manualInvoice.customerName}
                  onChange={(e) => setManualInvoice((m) => ({ ...m, customerName: e.target.value }))}
                  placeholder="Full name"
                  className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Phone</label>
                <input type="text" value={manualInvoice.phone} onChange={(e) => setManualInvoice((m) => ({ ...m, phone: e.target.value }))} placeholder="Optional" className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Email</label>
                <input type="text" value={manualInvoice.email} onChange={(e) => setManualInvoice((m) => ({ ...m, email: e.target.value }))} placeholder="Optional" className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Address</label>
                <textarea value={manualInvoice.address} onChange={(e) => setManualInvoice((m) => ({ ...m, address: e.target.value }))} placeholder="Optional" rows={2} className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Doctor name</label>
                <input type="text" value={manualInvoice.doctorName} onChange={(e) => setManualInvoice((m) => ({ ...m, doctorName: e.target.value }))} placeholder="e.g. Dr. Sharma" className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Hospital name</label>
                <input type="text" value={manualInvoice.hospitalName} onChange={(e) => setManualInvoice((m) => ({ ...m, hospitalName: e.target.value }))} placeholder="e.g. City Hospital" className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Doctor prescription</label>
                <textarea value={manualInvoice.prescription} onChange={(e) => setManualInvoice((m) => ({ ...m, prescription: e.target.value }))} placeholder="e.g. Take tablet after meals. Rest for 2 days." rows={3} className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Payment mode</label>
                <select value={manualInvoice.paymentMode} onChange={(e) => setManualInvoice((m) => ({ ...m, paymentMode: e.target.value }))} className="gov-select w-full bg-white px-4 py-2 text-[#1a202c]">
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>{mode.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748] mb-1">Notes</label>
                <textarea value={manualInvoice.notes} onChange={(e) => setManualInvoice((m) => ({ ...m, notes: e.target.value }))} placeholder="Optional remarks" rows={2} className="gov-input w-full bg-white px-4 py-2 text-[#1a202c]" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-[#2d3748]">Line items</label>
                <button type="button" onClick={addManualItem} className="text-sm text-[#0d47a1] hover:underline font-medium">
                  + Add row
                </button>
              </div>
              <div className="border border-[#cbd5e0] rounded overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#f8fafc]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-[#2d3748] w-10">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#2d3748]">Description</th>
                      <th className="px-3 py-2 text-right font-semibold text-[#2d3748] w-28">Amount (₹)</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {manualInvoice.items.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-[#4a5568]">{i + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateManualItem(i, "description", e.target.value)}
                            placeholder="e.g. Consultation"
                            className="w-full border border-[#cbd5e0] bg-white px-2 py-1.5 text-[#1a202c] text-sm rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => updateManualItem(i, "amount", e.target.value)}
                            placeholder="0"
                            className="w-full border border-[#cbd5e0] bg-white px-2 py-1.5 text-[#1a202c] text-sm text-right rounded"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeManualItem(i)} className="text-red-600 hover:text-red-700 text-xs p-1" title="Remove row">
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-sm text-[#4a5568]">
                Charges total: <strong className="text-[#1a202c]">₹{manualInvoice.items.reduce((s, r) => s + (Number(r.amount) || 0), 0).toLocaleString("en-IN")}</strong>
              </p>

              <div className="mt-6 flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-[#2d3748]">Medicine details (if doctor prescribed)</label>
                <button type="button" onClick={addMedicineRow} className="text-sm text-[#0d47a1] hover:underline font-medium">
                  + Add medicine
                </button>
              </div>
              <div className="border border-[#cbd5e0] rounded overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#f8fafc]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-[#2d3748] w-10">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#2d3748]">Medicine name</th>
                      <th className="px-3 py-2 text-center font-semibold text-[#2d3748] w-20">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold text-[#2d3748] w-24">Dosage</th>
                      <th className="px-3 py-2 text-right font-semibold text-[#2d3748] w-24">Amount (₹)</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {(manualInvoice.medicines || []).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-[#4a5568]">{i + 1}</td>
                        <td className="px-3 py-2">
                          <input type="text" value={row.name} onChange={(e) => updateMedicineRow(i, "name", e.target.value)} placeholder="Medicine name" className="w-full border border-[#cbd5e0] bg-white px-2 py-1.5 text-[#1a202c] text-sm rounded" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={row.quantity} onChange={(e) => updateMedicineRow(i, "quantity", e.target.value)} placeholder="e.g. 10" className="w-full border border-[#cbd5e0] bg-white px-2 py-1.5 text-[#1a202c] text-sm text-center rounded" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={row.dosage} onChange={(e) => updateMedicineRow(i, "dosage", e.target.value)} placeholder="e.g. 1-0-1" className="w-full border border-[#cbd5e0] bg-white px-2 py-1.5 text-[#1a202c] text-sm rounded" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={row.amount} onChange={(e) => updateMedicineRow(i, "amount", e.target.value)} placeholder="0" className="w-full border border-[#cbd5e0] bg-white px-2 py-1.5 text-[#1a202c] text-sm text-right rounded" />
                        </td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeMedicineRow(i)} className="text-red-600 hover:text-red-700 text-xs p-1" title="Remove">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-sm text-[#4a5568]">
                Grand total: <strong className="text-[#1a202c]">₹{(manualInvoice.items.reduce((s, r) => s + (Number(r.amount) || 0), 0) + (manualInvoice.medicines || []).reduce((s, r) => s + (Number(r.amount) || 0), 0)).toLocaleString("en-IN")}</strong>
              </p>
              <div className="mt-6 flex gap-3 flex-wrap">
                <button type="button" onClick={generateManualInvoice} className="gov-btn-primary px-5 py-2.5">
                  Generate invoice
                </button>
                <button type="button" onClick={resetManualForm} className="border border-[#cbd5e0] px-5 py-2.5 text-sm font-medium text-[#2d3748] bg-white hover:bg-[#f8fafc] rounded">
                  Reset form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
