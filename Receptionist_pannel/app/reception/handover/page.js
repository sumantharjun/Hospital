"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";
import {
  RefreshIcon,
  CheckIcon,
  PrintIcon,
  ReportsIcon,
  AlertIcon,
  BillingIcon,
  IPAdmissionIcon,
  OPRegistrationIcon,
} from "../../components/ReceptionIcons";

function getShift(hour) {
  if (hour >= 6 && hour < 14) return { label: "Morning Shift", range: "06:00 – 14:00", color: "text-yellow-700 bg-yellow-50 border-yellow-200" };
  if (hour >= 14 && hour < 22) return { label: "Afternoon Shift", range: "14:00 – 22:00", color: "text-blue-700 bg-blue-50 border-blue-200" };
  return { label: "Night Shift", range: "22:00 – 06:00", color: "text-indigo-700 bg-indigo-50 border-indigo-200" };
}

export default function HandoverPage() {
  const now = new Date();
  const shift = getShift(now.getHours());
  const today = now.toISOString().split("T")[0];

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [handoverDone, setHandoverDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [data, setData] = useState({
    appointments: [],
    ipAdmissions: [],
    opRegistrations: [],
    pendingBills: [],
    collections: null,
  });

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const headers = getAuthHeaders();

    const safe = async (url) => {
      try {
        const res = await fetch(buildApiUrl(url), { headers });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    const [apts, ips, ops, bills, collections] = await Promise.all([
      safe("/api/appointments"),
      safe("/api/ip-admissions"),
      safe("/api/op-registrations"),
      safe("/api/bills?status=PENDING"),
      safe("/api/finance/summary"),
    ]);

    const aptsArr = Array.isArray(apts) ? apts : [];
    const todayApts = aptsArr.filter((a) => {
      const d = a.appointmentDate || a.scheduledAt;
      return d && new Date(d).toISOString().split("T")[0] === today;
    });

    const ipsArr = Array.isArray(ips) ? ips : ips?.admissions || [];
    const todayIPs = ipsArr.filter((ip) => {
      const d = ip.admissionDate || ip.createdAt;
      return d && new Date(d).toISOString().split("T")[0] === today;
    });

    const opsArr = Array.isArray(ops) ? ops : ops?.registrations || [];
    const todayOPs = opsArr.filter((op) => {
      const d = op.registrationDate || op.createdAt;
      return d && new Date(d).toISOString().split("T")[0] === today;
    });

    const billsArr = Array.isArray(bills) ? bills : bills?.bills || [];

    setData({
      appointments: todayApts,
      ipAdmissions: todayIPs,
      opRegistrations: todayOPs,
      pendingBills: billsArr,
      collections,
    });
    setLoading(false);
    setRefreshing(false);
  }, [today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = {
    totalOPD:    data.appointments.length,
    totalIP:     data.ipAdmissions.length,
    totalOP:     data.opRegistrations.length,
    completed:   data.appointments.filter((a) => (a.status || "").toUpperCase() === "COMPLETED").length,
    pending:     data.appointments.filter((a) => ["PENDING", "CHECKED_IN"].includes((a.status || "").toUpperCase())).length,
    emergencies: data.ipAdmissions.filter((ip) => ip.emergencyFlag || ip.casualtyFlag).length,
  };

  const waitingPatients = data.appointments.filter((a) =>
    ["PENDING", "CHECKED_IN"].includes((a.status || "").toUpperCase())
  );

  const activeIPs = data.ipAdmissions.filter((ip) => {
    const status = (ip.status || ip.admissionStatus || "").toUpperCase();
    return !["DISCHARGED", "COMPLETED"].includes(status);
  });

  const colls = data.collections;

  function handleMarkDone() {
    setHandoverDone(true);
    toast.success("Shift handover marked complete!");
  }

  function printHandover() {
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Shift Handover — ${today}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:32px;max-width:800px;margin:0 auto;font-size:13px}
      h1{font-size:18px;margin-bottom:2px}p.sub{color:#555;font-size:12px;margin-bottom:16px}
      h2{font-size:14px;font-weight:700;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:20px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ddd;padding:7px 10px;text-align:left}
      th{background:#f5f5f5;font-weight:600}
      .stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}
      .stat-box{border:1px solid #ddd;border-radius:4px;padding:10px;text-align:center}
      .stat-val{font-size:24px;font-weight:700;color:#0d47a1}
      .stat-lbl{font-size:11px;color:#666}
      .notes-box{border:1px solid #ddd;border-radius:4px;padding:12px;min-height:60px;white-space:pre-wrap}
      .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}
    </style></head><body>
    <h1>Receptionist Shift Handover Report</h1>
    <p class="sub">Date: ${today} &nbsp;|&nbsp; ${shift.label} (${shift.range}) &nbsp;|&nbsp; Printed: ${new Date().toLocaleString("en-IN")}</p>

    <h2>Today's Summary</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-val">${stats.totalOPD}</div><div class="stat-lbl">OPD Appointments</div></div>
      <div class="stat-box"><div class="stat-val">${stats.totalIP}</div><div class="stat-lbl">IP Admissions</div></div>
      <div class="stat-box"><div class="stat-val">${stats.totalOP}</div><div class="stat-lbl">OP Registrations</div></div>
      <div class="stat-box"><div class="stat-val">${stats.completed}</div><div class="stat-lbl">Completed</div></div>
      <div class="stat-box"><div class="stat-val">${stats.pending}</div><div class="stat-lbl">Pending</div></div>
      <div class="stat-box"><div class="stat-val">${stats.emergencies}</div><div class="stat-lbl">Emergencies</div></div>
    </div>

    ${waitingPatients.length > 0 ? `
    <h2>Pending — Waiting Patients (${waitingPatients.length})</h2>
    <table><thead><tr><th>#Token</th><th>Patient</th><th>Doctor</th><th>Status</th></tr></thead><tbody>
    ${waitingPatients.map(a => `<tr>
      <td>#${a.tokenNumber ?? "—"}</td>
      <td>${a.patientName || a.patient?.name || "—"}</td>
      <td>${a.doctorName || a.doctor?.name || "—"}</td>
      <td>${a.status}</td>
    </tr>`).join("")}
    </tbody></table>` : ""}

    ${data.pendingBills.length > 0 ? `
    <h2>Unpaid Bills (${data.pendingBills.length})</h2>
    <table><thead><tr><th>Bill ID</th><th>Patient</th><th>Amount</th><th>Status</th></tr></thead><tbody>
    ${data.pendingBills.slice(0, 20).map(b => `<tr>
      <td>${b.billNumber || b._id?.slice(-6) || "—"}</td>
      <td>${b.patientName || b.patient?.name || "—"}</td>
      <td>₹${b.totalAmount || b.amount || 0}</td>
      <td>${b.status}</td>
    </tr>`).join("")}
    </tbody></table>` : ""}

    ${activeIPs.length > 0 ? `
    <h2>Active IP Patients (${activeIPs.length})</h2>
    <table><thead><tr><th>Patient</th><th>Bed</th><th>Admitted</th><th>Status</th></tr></thead><tbody>
    ${activeIPs.map(ip => `<tr>
      <td>${ip.patientName || ip.patient?.name || "—"}</td>
      <td>${ip.bedNumber || ip.bed?.bedNumber || "—"}</td>
      <td>${ip.admissionDate ? new Date(ip.admissionDate).toLocaleDateString("en-IN") : "—"}</td>
      <td>${ip.status || ip.admissionStatus || "—"}</td>
    </tr>`).join("")}
    </tbody></table>` : ""}

    ${colls ? `
    <h2>Collections Today</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-val">₹${colls.cash || 0}</div><div class="stat-lbl">Cash</div></div>
      <div class="stat-box"><div class="stat-val">₹${colls.upi || 0}</div><div class="stat-lbl">UPI</div></div>
      <div class="stat-box"><div class="stat-val">₹${colls.card || 0}</div><div class="stat-lbl">Card</div></div>
    </div>` : ""}

    <h2>Handover Notes</h2>
    <div class="notes-box">${notes || "(No notes written)"}</div>

    <script>window.print();window.close();<\/script></body></html>`);
    win.document.close();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">Shift Handover</h1>
        <div className="text-center py-16 text-gray-400">Loading handover data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight flex items-center gap-2">
            <ReportsIcon className="w-5 h-5 text-[#0d47a1]" />
            Shift Handover Report
          </h1>
          <p className="text-sm text-[#4a5568] mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            &nbsp;—&nbsp;{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 border border-[#cbd5e0] bg-white text-[#2d3748] px-3 py-2 text-sm rounded-sm hover:bg-[#e2e8f0] transition-colors disabled:opacity-50"
          >
            <RefreshIcon className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={printHandover}
            className="flex items-center gap-1.5 border border-[#cbd5e0] bg-white text-[#2d3748] px-3 py-2 text-sm rounded-sm hover:bg-[#e2e8f0] transition-colors"
          >
            <PrintIcon className="w-4 h-4" />
            Print
          </button>
          {!handoverDone ? (
            <button
              onClick={handleMarkDone}
              className="flex items-center gap-1.5 bg-[#0d47a1] text-white px-4 py-2 text-sm rounded-sm hover:bg-[#0a3d91] transition-colors font-medium"
            >
              <CheckIcon className="w-4 h-4" />
              Mark Handover Complete
            </button>
          ) : (
            <span className="flex items-center gap-1.5 bg-green-100 text-green-800 border border-green-300 px-4 py-2 text-sm rounded-sm font-medium">
              <CheckIcon className="w-4 h-4" />
              Handover Completed
            </span>
          )}
        </div>
      </div>

      {/* Shift badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${shift.color}`}>
        <ReportsIcon className="w-3.5 h-3.5" />
        {shift.label} &nbsp;({shift.range})
      </div>

      {/* Section 1: Today's Summary */}
      <div className="gov-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e2e8f0] bg-[#f5f7fa]">
          <h2 className="font-semibold text-[#1a202c] text-sm">1. Today's Summary</h2>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "OPD Appointments", value: stats.totalOPD,    icon: <BillingIcon className="w-4 h-4" />,       bg: "bg-blue-50 border-blue-200",     text: "text-blue-800"  },
            { label: "IP Admissions",    value: stats.totalIP,     icon: <IPAdmissionIcon className="w-4 h-4" />,   bg: "bg-purple-50 border-purple-200", text: "text-purple-800"},
            { label: "OP Registrations", value: stats.totalOP,     icon: <OPRegistrationIcon className="w-4 h-4" />,bg: "bg-teal-50 border-teal-200",     text: "text-teal-800"  },
            { label: "Completed",        value: stats.completed,   icon: <CheckIcon className="w-4 h-4" />,         bg: "bg-green-50 border-green-200",   text: "text-green-800" },
            { label: "Pending",          value: stats.pending,     icon: <AlertIcon className="w-4 h-4" />,         bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-800"},
            { label: "Emergencies",      value: stats.emergencies, icon: <AlertIcon className="w-4 h-4" />,         bg: "bg-red-50 border-red-200",       text: "text-red-800"   },
          ].map((s) => (
            <div key={s.label} className={`rounded-sm border p-3 ${s.bg}`}>
              <div className={`flex items-center gap-1.5 ${s.text} mb-1`}>{s.icon}</div>
              <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
              <div className="text-[11px] text-[#718096] mt-0.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Pending Items */}
      <div className="gov-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e2e8f0] bg-[#f5f7fa]">
          <h2 className="font-semibold text-[#1a202c] text-sm">2. Pending Items</h2>
        </div>
        <div className="divide-y divide-[#e2e8f0]">
          {/* Waiting patients */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[#4a5568] uppercase tracking-wide">
                Patients Still Waiting ({waitingPatients.length})
              </h3>
            </div>
            {waitingPatients.length === 0 ? (
              <p className="text-xs text-[#718096]">None — all appointments resolved.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e2e8f0]">
                      <th className="py-1.5 pr-3 text-left text-[#718096] font-medium">#Token</th>
                      <th className="py-1.5 pr-3 text-left text-[#718096] font-medium">Patient</th>
                      <th className="py-1.5 pr-3 text-left text-[#718096] font-medium hidden sm:table-cell">Doctor</th>
                      <th className="py-1.5 text-left text-[#718096] font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingPatients.map((a) => (
                      <tr key={a._id || a.id} className="border-b border-[#f0f0f0] last:border-0">
                        <td className="py-1.5 pr-3 font-bold text-[#0d47a1]">#{a.tokenNumber ?? "—"}</td>
                        <td className="py-1.5 pr-3 text-[#2d3748]">{a.patientName || a.patient?.name || "—"}</td>
                        <td className="py-1.5 pr-3 text-[#4a5568] hidden sm:table-cell">{a.doctorName || a.doctor?.name ? `Dr. ${a.doctorName || a.doctor?.name}` : "—"}</td>
                        <td className="py-1.5">
                          <span className="bg-yellow-100 text-yellow-800 border border-yellow-200 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unpaid bills */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-2">
              Unpaid Bills ({data.pendingBills.length})
            </h3>
            {data.pendingBills.length === 0 ? (
              <p className="text-xs text-[#718096]">No pending bills.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e2e8f0]">
                      <th className="py-1.5 pr-3 text-left text-[#718096] font-medium">Bill ID</th>
                      <th className="py-1.5 pr-3 text-left text-[#718096] font-medium">Patient</th>
                      <th className="py-1.5 text-left text-[#718096] font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pendingBills.slice(0, 10).map((b) => (
                      <tr key={b._id || b.id} className="border-b border-[#f0f0f0] last:border-0">
                        <td className="py-1.5 pr-3 font-mono text-[#0d47a1]">{b.billNumber || b._id?.slice(-6) || "—"}</td>
                        <td className="py-1.5 pr-3 text-[#2d3748]">{b.patientName || b.patient?.name || "—"}</td>
                        <td className="py-1.5 font-semibold text-red-700">₹{b.totalAmount || b.amount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.pendingBills.length > 10 && (
                  <p className="text-[11px] text-[#718096] mt-1">+{data.pendingBills.length - 10} more bills not shown</p>
                )}
              </div>
            )}
          </div>

          {/* Active IP patients */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-2">
              Active IP Patients Not Discharged ({activeIPs.length})
            </h3>
            {activeIPs.length === 0 ? (
              <p className="text-xs text-[#718096]">All IP patients discharged.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeIPs.map((ip) => (
                  <span key={ip._id || ip.id} className="inline-flex items-center gap-1.5 bg-[#e3f2fd] text-[#0d47a1] border border-blue-200 px-2.5 py-1 rounded-full text-xs font-medium">
                    <IPAdmissionIcon className="w-3 h-3" />
                    {ip.patientName || ip.patient?.name || "Patient"}
                    {ip.bedNumber || ip.bed?.bedNumber ? ` — Bed ${ip.bedNumber || ip.bed?.bedNumber}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Collections */}
      {colls && (
        <div className="gov-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e2e8f0] bg-[#f5f7fa]">
            <h2 className="font-semibold text-[#1a202c] text-sm">3. Collections Today</h2>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Cash",  value: colls.cash || 0,  bg: "bg-green-50 border-green-200",  text: "text-green-800" },
              { label: "UPI",   value: colls.upi || 0,   bg: "bg-blue-50 border-blue-200",    text: "text-blue-800"  },
              { label: "Card",  value: colls.card || 0,  bg: "bg-purple-50 border-purple-200",text: "text-purple-800"},
              { label: "Total", value: (colls.cash || 0) + (colls.upi || 0) + (colls.card || 0), bg: "bg-[#e3f2fd] border-[#90caf9]", text: "text-[#0d47a1]" },
            ].map((s) => (
              <div key={s.label} className={`rounded-sm border p-4 ${s.bg}`}>
                <div className={`text-xl font-bold ${s.text}`}>₹{s.value.toLocaleString("en-IN")}</div>
                <div className="text-xs text-[#718096] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Notes */}
      <div className="gov-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e2e8f0] bg-[#f5f7fa]">
          <h2 className="font-semibold text-[#1a202c] text-sm">4. Handover Notes</h2>
        </div>
        <div className="p-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="Write handover notes for the incoming receptionist — pending issues, important patients, special instructions..."
            className="w-full border border-[#cbd5e0] rounded-sm px-3 py-2.5 text-sm text-[#1a202c] focus:outline-none focus:ring-2 focus:ring-[#0d47a1]/30 focus:border-[#0d47a1] resize-none"
          />
          <p className="text-xs text-[#718096] mt-1.5">
            These notes will be included in the printed handover sheet.
          </p>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex flex-wrap gap-3 justify-end">
        <button
          onClick={printHandover}
          className="flex items-center gap-2 border border-[#cbd5e0] bg-white text-[#2d3748] px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-[#e2e8f0] transition-colors"
        >
          <PrintIcon className="w-4 h-4" />
          Print Handover Sheet
        </button>
        {!handoverDone ? (
          <button
            onClick={handleMarkDone}
            className="flex items-center gap-2 bg-[#0d47a1] text-white px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-[#0a3d91] transition-colors"
          >
            <CheckIcon className="w-4 h-4" />
            Mark Handover Complete
          </button>
        ) : (
          <span className="flex items-center gap-2 bg-green-100 text-green-800 border border-green-300 px-5 py-2.5 rounded-sm text-sm font-semibold">
            <CheckIcon className="w-4 h-4" />
            Handover Marked Complete
          </span>
        )}
      </div>
    </div>
  );
}
