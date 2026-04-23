"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, HOSPITALS_PATH } from "../../lib/api";
import { LoadingOverlay } from "../../components/LoadingSpinner";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function RevenuePage() {
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(null);
  const [doctorRevenue, setDoctorRevenue] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalId, setHospitalId] = useState("");
  const [dateFrom, setDateFrom] = useState(monthStartStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetch(buildApiUrl(HOSPITALS_PATH), { headers: getAuthHeaders() })
      .then((r) => r.json()).then((d) => setHospitals(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const base = `from=${dateFrom}&to=${dateTo}${hospitalId ? `&hospitalId=${hospitalId}` : ""}`;
      const [revRes, drRes] = await Promise.all([
        fetch(buildApiUrl(`/api/reports/hospital/revenue?${base}`), { headers: getAuthHeaders() }),
        fetch(buildApiUrl(`/api/reports/hospital/doctor-revenue?${base}`), { headers: getAuthHeaders() }),
      ]);
      if (revRes.ok) setRevenue(await revRes.json());
      else toast.error("Revenue report failed");
      if (drRes.ok) setDoctorRevenue(await drRes.json());
    } catch {
      toast.error("Failed to load revenue data");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, hospitalId]);

  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);

  function downloadCSV() {
    if (!revenue) return;
    const lines = [
      "Revenue Report",
      `From: ${dateFrom}  To: ${dateTo}`,
      "",
      "Metric,Value",
      `Total Billed,${revenue.totalBilled}`,
      `Total Collected,${revenue.totalCollected}`,
      `Total Pending,${revenue.totalPending}`,
      `Total Bills,${revenue.billCount}`,
      "",
      "Type,Billed,Collected",
      ...(revenue.byType ? Object.entries(revenue.byType).map(([k, v]) => `${k},${v.billed || 0},${v.collected || 0}`) : []),
      "",
      "Payment Mode,Amount",
      ...(revenue.byMode ? Object.entries(revenue.byMode).map(([k, v]) => `${k},${v}`) : []),
      "",
      "Doctor,OP Count,IP Count,OP Revenue,IP Revenue,Total Revenue",
      ...doctorRevenue.map((d) => `${d.doctorName || d.doctorId},${d.opCount},${d.ipCount},${d.opRevenue},${d.ipRevenue},${d.totalRevenue}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `revenue-${dateFrom}-to-${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded.");
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "by-type",  label: "By Type" },
    { id: "by-mode",  label: "By Mode" },
    { id: "doctors",  label: "Doctor-wise" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">Revenue & Invoices</h1>
          <p className="mt-1 text-sm text-[#4a5568]">Real-time revenue from backend — IP, OP and Service collections.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadCSV} disabled={!revenue}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#cbd5e0] text-[#1a202c] rounded-sm text-sm font-medium hover:bg-[#f5f7fa] transition disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Download CSV
          </button>
          <button onClick={fetchRevenue} className="flex items-center gap-2 px-4 py-2 bg-[#0d47a1] text-white rounded-sm text-sm font-medium hover:bg-[#0a3d91] transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#cbd5e0] rounded-sm p-4 flex flex-wrap gap-4 items-end shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-[#2d3748] mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d47a1] outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#2d3748] mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d47a1] outline-none" />
        </div>
        {hospitals.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-[#2d3748] mb-1">Hospital</label>
            <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}
              className="border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm min-w-48 focus:ring-2 focus:ring-[#0d47a1] outline-none">
              <option value="">All hospitals</option>
              {hospitals.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? <LoadingOverlay text="Loading revenue…" /> : !revenue ? (
        <div className="bg-white border border-[#e2e8f0] rounded-sm p-10 text-center text-[#718096]">No revenue data available.</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Billed",   value: revenue.totalBilled,   border: "border-blue-500",  text: "text-blue-700" },
              { label: "Collected",      value: revenue.totalCollected, border: "border-green-500", text: "text-green-700" },
              { label: "Outstanding",    value: revenue.totalPending,   border: "border-red-500",   text: "text-red-700" },
              { label: "Total Bills",    value: revenue.billCount,      border: "border-gray-400",  text: "text-gray-700", count: true },
            ].map((s) => (
              <div key={s.label} className={`bg-white border-l-4 ${s.border} border border-[#e2e8f0] rounded-sm p-4 shadow-sm`}>
                <p className="text-xs text-[#718096] uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.text}`}>
                  {s.count ? s.value : `₹${(s.value || 0).toLocaleString("en-IN")}`}
                </p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[#e2e8f0]">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${activeTab === t.id ? "border-[#0d47a1] text-[#0d47a1]" : "border-transparent text-[#4a5568] hover:text-[#1a202c]"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-[#1a202c]">Collection Rate</h2>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div className="bg-green-500 h-4 rounded-full transition-all"
                    style={{ width: `${revenue.totalBilled > 0 ? Math.min(100, (revenue.totalCollected / revenue.totalBilled) * 100) : 0}%` }} />
                </div>
                <span className="text-sm font-semibold text-[#1a202c]">
                  {revenue.totalBilled > 0 ? ((revenue.totalCollected / revenue.totalBilled) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <p className="text-sm text-[#4a5568]">₹{(revenue.totalCollected || 0).toLocaleString("en-IN")} collected of ₹{(revenue.totalBilled || 0).toLocaleString("en-IN")} billed</p>
              <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                <div>
                  <p className="text-xs text-[#718096] uppercase mb-1">Date range</p>
                  <p className="font-medium text-[#1a202c]">{dateFrom} → {dateTo}</p>
                </div>
                <div>
                  <p className="text-xs text-[#718096] uppercase mb-1">Bills processed</p>
                  <p className="font-medium text-[#1a202c]">{revenue.billCount || 0}</p>
                </div>
              </div>
              <a href="/reception/invoices#manual"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0d47a1] text-white rounded-sm text-sm font-medium hover:bg-[#0a3d91] transition mt-2">
                Generate Invoice →
              </a>
            </div>
          )}

          {activeTab === "by-type" && (
            <div className="bg-white border border-[#e2e8f0] rounded-sm shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
                <h2 className="font-semibold text-[#1a202c]">Revenue by Bill Type (IP / OP / SERVICE)</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <tr>
                    {["Type", "Total Billed", "Collected", "Pending"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#4a5568] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {Object.entries(revenue.byType || {}).length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[#718096]">No data</td></tr>
                  ) : Object.entries(revenue.byType || {}).map(([type, v]) => (
                    <tr key={type} className="hover:bg-[#f5f7fa]">
                      <td className="px-4 py-3 font-semibold text-[#1a202c]">{type}</td>
                      <td className="px-4 py-3 text-[#1a202c]">₹{(v.billed || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-green-700">₹{(v.collected || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-red-600">₹{((v.billed || 0) - (v.collected || 0)).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "by-mode" && (
            <div className="bg-white border border-[#e2e8f0] rounded-sm shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
                <h2 className="font-semibold text-[#1a202c]">Revenue by Payment Mode</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <tr>
                    {["Mode", "Amount Collected"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#4a5568] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {Object.entries(revenue.byMode || {}).length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-[#718096]">No data</td></tr>
                  ) : Object.entries(revenue.byMode || {}).map(([mode, amt]) => (
                    <tr key={mode} className="hover:bg-[#f5f7fa]">
                      <td className="px-4 py-3 font-semibold text-[#1a202c]">{mode}</td>
                      <td className="px-4 py-3 text-green-700 font-semibold">₹{Number(amt).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "doctors" && (
            <div className="bg-white border border-[#e2e8f0] rounded-sm shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
                <h2 className="font-semibold text-[#1a202c]">Doctor-wise Revenue</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <tr>
                      {["Doctor", "OP Count", "IP Count", "OP Revenue", "IP Revenue", "Total"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#4a5568] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {doctorRevenue.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-[#718096]">No doctor revenue data</td></tr>
                    ) : doctorRevenue.map((d, i) => (
                      <tr key={i} className="hover:bg-[#f5f7fa]">
                        <td className="px-4 py-3 font-semibold text-[#1a202c]">Dr. {d.doctorName || d.doctorId}</td>
                        <td className="px-4 py-3 text-[#4a5568]">{d.opCount}</td>
                        <td className="px-4 py-3 text-[#4a5568]">{d.ipCount}</td>
                        <td className="px-4 py-3 text-blue-700">₹{(d.opRevenue || 0).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-red-700">₹{(d.ipRevenue || 0).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 font-bold text-green-700">₹{(d.totalRevenue || 0).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
