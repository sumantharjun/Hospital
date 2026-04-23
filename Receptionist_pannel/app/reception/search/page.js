"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";
import { SearchIcon, PrintIcon } from "../../components/ReceptionIcons";

const fmtCur = n => `₹${(n || 0).toLocaleString("en-IN")}`;

const TYPE_STYLE = {
  IP:      "bg-blue-100 text-blue-800",
  OP:      "bg-green-100 text-green-800",
  SERVICE: "bg-purple-100 text-purple-800",
};

const STATUS_STYLE = {
  ACTIVE:     "bg-blue-50 text-blue-700",
  PARTIAL:    "bg-yellow-50 text-yellow-700",
  COMPLETED:  "bg-green-50 text-green-700",
  PAID:       "bg-green-50 text-green-700",
  DISCHARGED: "bg-gray-100 text-gray-600",
  CANCELLED:  "bg-red-50 text-red-600",
  DRAFT:      "bg-gray-100 text-gray-500",
};

export default function PatientSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);

  async function doSearch(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(
        buildApiUrl(`/api/reports/hospital/patient-consolidated?q=${encodeURIComponent(query)}`),
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error((await res.json()).message || "Search failed");
      setData(await res.json());
    } catch (err) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function printPatientReport() {
    if (!data) return;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Patient Report — ${query}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px}
    h1{font-size:18px;margin-bottom:4px}p.sub{font-size:12px;color:#666;margin-bottom:16px}
    .summary{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px}
    .stat{background:#f5f5f5;padding:8px 16px;border-radius:6px;text-align:center}
    .stat-val{font-size:18px;font-weight:700}.stat-lbl{font-size:11px;color:#666}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th,td{border:1px solid #ddd;padding:7px 10px;text-align:left}th{background:#f5f5f5;font-weight:600}
    .badge{padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}
    .due{color:#c00;font-weight:700}</style></head><body>
    <h1>Patient Consolidated Report</h1>
    <p class="sub">Search: "${query}" &nbsp;|&nbsp; Printed: ${new Date().toLocaleString("en-IN")}</p>
    <div class="summary">
      <div class="stat"><div class="stat-val">${data.summary.ipCount}</div><div class="stat-lbl">IP Records</div></div>
      <div class="stat"><div class="stat-val">${data.summary.opCount}</div><div class="stat-lbl">OP Records</div></div>
      <div class="stat"><div class="stat-val">${data.summary.svcCount}</div><div class="stat-lbl">Services</div></div>
      <div class="stat"><div class="stat-val">${fmtCur(data.summary.totalBilled)}</div><div class="stat-lbl">Total Billed</div></div>
      <div class="stat"><div class="stat-val">${fmtCur(data.summary.totalPaid)}</div><div class="stat-lbl">Total Paid</div></div>
      <div class="stat"><div class="stat-val">${fmtCur(data.summary.totalOutstanding)}</div><div class="stat-lbl">Outstanding</div></div>
    </div>
    <table><thead><tr><th>Type</th><th>ID</th><th>Patient</th><th>Date</th><th>Status</th><th>Billed</th><th>Paid</th><th>Due</th></tr></thead>
    <tbody>${data.results.map(r => `<tr>
      <td>${r.type}</td><td>${r.id}</td>
      <td>${r.patient?.name || "—"}</td>
      <td>${new Date(r.admissionDate || r.registrationDate).toLocaleDateString("en-IN")}</td>
      <td>${r.bill?.status || r.status || "—"}</td>
      <td>${fmtCur(r.bill?.grandTotal ?? r.grandTotal)}</td>
      <td>${fmtCur(r.bill?.paidAmount ?? r.paidAmount)}</td>
      <td class="${(r.bill?.outstandingBalance ?? r.outstandingBalance) > 0 ? "due" : ""}">${fmtCur(r.bill?.outstandingBalance ?? r.outstandingBalance)}</td>
    </tr>`).join("")}</tbody></table>
    <script>window.print();window.close();<\/script></body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">Patient Search</h1>
          <p className="text-sm text-[#4a5568] mt-0.5">
            Search across IP admissions, OP visits, and services by name, phone, or record ID
          </p>
        </div>
        {data && (
          <button onClick={printPatientReport}
            className="flex items-center gap-1.5 border border-[#cbd5e0] bg-white text-[#2d3748] px-3 py-2 text-sm rounded-sm hover:bg-[#e2e8f0] transition-colors">
            <PrintIcon className="w-4 h-4" />
            Print Report
          </button>
        )}
      </div>

      {/* Search Bar */}
      <form onSubmit={doSearch} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#718096]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Patient name, phone, IP ID (IP-20240101-0001), OP ID, SVC ID..."
            className="w-full pl-10 pr-4 py-2.5 border border-[#cbd5e0] rounded-sm text-sm text-[#1a202c] focus:outline-none focus:ring-2 focus:ring-[#0d47a1] focus:border-[#0d47a1]"
          />
        </div>
        <button type="submit" disabled={loading}
          className="bg-[#0d47a1] text-white px-6 py-2.5 rounded-sm text-sm font-medium hover:bg-[#0a3d91] disabled:opacity-60 transition-colors">
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {loading && (
        <div className="text-center py-12 text-[#718096] text-sm">Searching patient records…</div>
      )}

      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "IP Records",   value: data.summary.ipCount,           style: "bg-blue-50 text-blue-700" },
              { label: "OP Records",   value: data.summary.opCount,           style: "bg-green-50 text-green-700" },
              { label: "Services",     value: data.summary.svcCount,          style: "bg-purple-50 text-purple-700" },
              { label: "Total Billed", value: fmtCur(data.summary.totalBilled), style: "bg-gray-50 text-gray-800" },
              { label: "Total Paid",   value: fmtCur(data.summary.totalPaid),   style: "bg-green-50 text-green-800" },
              { label: "Outstanding",  value: fmtCur(data.summary.totalOutstanding),
                style: data.summary.totalOutstanding > 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-500" },
            ].map(s => (
              <div key={s.label} className={`rounded-sm p-4 text-center ${s.style}`}>
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Results */}
          {data.results.length === 0 ? (
            <div className="gov-card p-12 text-center">
              <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <SearchIcon className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-sm text-[#718096]">No records found for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.results.map((r, i) => {
                const rid = r.id;
                const isOpen = expanded === rid;
                const outstanding = r.bill?.outstandingBalance ?? r.outstandingBalance ?? 0;
                const grandTotal = r.bill?.grandTotal ?? r.grandTotal ?? 0;
                const paidAmt = r.bill?.paidAmount ?? r.paidAmount ?? 0;
                const status = r.bill?.status || r.status || "—";

                return (
                  <div key={i} className="gov-card overflow-hidden">
                    {/* Row header */}
                    <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#f5f7fa] transition-colors"
                      onClick={() => setExpanded(isOpen ? null : rid)}>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-sm font-semibold ${TYPE_STYLE[r.type] || "bg-gray-100 text-gray-700"}`}>
                          {r.type}
                        </span>
                        <div>
                          <div className="font-mono text-sm font-semibold text-[#1a202c]">{r.id}</div>
                          <div className="text-xs text-[#718096]">
                            {r.patient?.name || "Walk-in"}
                            {r.doctor ? ` · Dr. ${r.doctor.name}` : r.type === "SERVICE" ? " · Services" : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-[#1a202c]">{fmtCur(grandTotal)}</div>
                          {outstanding > 0 && <div className="text-xs text-red-600 font-medium">Due: {fmtCur(outstanding)}</div>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-sm font-medium ${STATUS_STYLE[status] || "bg-gray-100 text-gray-600"}`}>
                          {status}
                        </span>
                        <svg className={`w-4 h-4 text-[#718096] transition-transform ${isOpen ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded */}
                    {isOpen && (
                      <div className="border-t border-[#e2e8f0] px-4 py-4 bg-[#f5f7fa] space-y-4">
                        {/* Patient details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div><div className="text-xs text-[#718096]">Patient</div><div className="font-medium text-[#1a202c]">{r.patient?.name || "—"}</div></div>
                          <div><div className="text-xs text-[#718096]">Phone</div><div className="text-[#2d3748]">{r.patient?.phone || "—"}</div></div>
                          {r.doctor && <div><div className="text-xs text-[#718096]">Doctor</div><div className="text-[#2d3748]">Dr. {r.doctor.name}</div></div>}
                          {r.room && <div><div className="text-xs text-[#718096]">Room / Bed</div><div className="text-[#2d3748]">{r.room.roomNumber} / Bed {r.bed?.bedNumber}</div></div>}
                          <div><div className="text-xs text-[#718096]">Date</div><div className="text-[#2d3748]">{new Date(r.admissionDate || r.registrationDate).toLocaleDateString("en-IN")}</div></div>
                          <div><div className="text-xs text-[#718096]">Record Status</div><div className="text-[#2d3748]">{r.status}</div></div>
                        </div>

                        {/* Line items */}
                        {r.bill?.lineItems?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-[#718096] uppercase mb-2">Charges</div>
                            <div className="bg-white border border-[#e2e8f0] rounded-sm overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-[#f5f7fa] border-b border-[#e2e8f0]">
                                    <th className="px-3 py-2 text-left font-semibold text-[#718096]">Description</th>
                                    <th className="px-3 py-2 text-left font-semibold text-[#718096]">Category</th>
                                    <th className="px-3 py-2 text-right font-semibold text-[#718096]">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.bill.lineItems.map((li, j) => (
                                    <tr key={j} className="border-t border-[#e2e8f0]">
                                      <td className="px-3 py-2 text-[#2d3748]">{li.description}</td>
                                      <td className="px-3 py-2 text-[#718096]">{li.category || "—"}</td>
                                      <td className="px-3 py-2 text-right font-medium text-[#1a202c]">{fmtCur(li.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Payment history */}
                        {r.bill?.paymentHistory?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-[#718096] uppercase mb-2">Payment History</div>
                            <div className="space-y-1">
                              {r.bill.paymentHistory.map((p, j) => (
                                <div key={j} className="flex justify-between text-xs bg-white border border-[#e2e8f0] px-3 py-2 rounded-sm">
                                  <span className="text-[#718096]">
                                    {new Date(p.date || p.paidAt).toLocaleString("en-IN")} · {p.mode}
                                    {p.referenceNumber ? ` (${p.referenceNumber})` : ""}
                                  </span>
                                  <span className="font-semibold text-green-700">{fmtCur(p.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Summary + Quick Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e2e8f0]">
                          <div className="flex gap-4 text-sm">
                            <span className="text-[#718096]">Billed: <span className="font-semibold text-[#1a202c]">{fmtCur(grandTotal)}</span></span>
                            <span className="text-[#718096]">Paid: <span className="font-semibold text-green-700">{fmtCur(paidAmt)}</span></span>
                            <span className="text-[#718096]">Due: <span className={`font-semibold ${outstanding > 0 ? "text-red-600" : "text-[#718096]"}`}>{fmtCur(outstanding)}</span></span>
                          </div>
                          <div className="flex gap-2">
                            {r.type === "IP" && (
                              <button onClick={() => router.push(`/reception/ip-billing?ref=${r.id}`)}
                                className="text-xs bg-[#0d47a1] text-white px-3 py-1.5 rounded-sm hover:bg-[#0a3d91] transition-colors font-medium">
                                View IP Bill
                              </button>
                            )}
                            {r.type === "SERVICE" && (
                              <button onClick={() => router.push(`/reception/service-billing?svcId=${r.id}`)}
                                className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-sm hover:bg-purple-700 transition-colors font-medium">
                                View Service Bill
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
