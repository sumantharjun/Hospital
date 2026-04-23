"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";
import { RefreshIcon, CheckIcon, AlertIcon, PrintIcon } from "../../components/ReceptionIcons";

const STATUS_CONFIG = {
  PENDING:    { label: "Waiting",       color: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400" },
  CHECKED_IN: { label: "Checked In",   color: "bg-blue-100 text-blue-800 border-blue-200",       dot: "bg-blue-400"   },
  IN_PROGRESS:{ label: "With Doctor",  color: "bg-green-100 text-green-800 border-green-200",    dot: "bg-green-500"  },
  COMPLETED:  { label: "Completed",    color: "bg-gray-100 text-gray-600 border-gray-200",       dot: "bg-gray-400"   },
  CANCELLED:  { label: "Cancelled",    color: "bg-red-100 text-red-600 border-red-200",          dot: "bg-red-400"    },
};

const NEXT_STATUS = {
  PENDING:    "CHECKED_IN",
  CHECKED_IN: "IN_PROGRESS",
  IN_PROGRESS:"COMPLETED",
};

const ACTION_LABEL = {
  PENDING:    "Check In",
  CHECKED_IN: "Call to Doctor",
  IN_PROGRESS:"Mark Done",
};

export default function TokenQueuePage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const headers = getAuthHeaders();
      const [aptRes, docRes] = await Promise.all([
        fetch(buildApiUrl("/api/appointments"), { headers }),
        fetch(buildApiUrl("/api/users?role=DOCTOR"), { headers }),
      ]);
      const apts = aptRes.ok ? await aptRes.json() : [];
      const docs = docRes.ok ? await docRes.json() : [];
      const todayApts = Array.isArray(apts) ? apts.filter(a => {
        const d = a.appointmentDate || a.scheduledAt;
        return d && new Date(d).toISOString().split("T")[0] === today;
      }) : [];
      setAppointments(todayApts.sort((a, b) => (a.tokenNumber || 0) - (b.tokenNumber || 0)));
      setDoctors(Array.isArray(docs) ? docs : []);
    } catch {
      if (!silent) toast.error("Failed to load queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function updateStatus(apt) {
    const next = NEXT_STATUS[apt.status];
    if (!next) return;
    setUpdatingId(apt._id || apt.id);
    try {
      const res = await fetch(buildApiUrl(`/api/appointments/${apt._id || apt.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Update failed");
      toast.success(`Token #${apt.tokenNumber} — ${ACTION_LABEL[apt.status]}`);
      fetchData(true);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function cancelAppointment(apt) {
    if (!confirm(`Cancel Token #${apt.tokenNumber}?`)) return;
    setUpdatingId(apt._id || apt.id);
    try {
      const res = await fetch(buildApiUrl(`/api/appointments/${apt._id || apt.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Cancel failed");
      toast.success("Appointment cancelled");
      fetchData(true);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUpdatingId(null);
    }
  }

  function printQueue() {
    const filtered = displayApts;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Token Queue — ${today}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px;margin-bottom:4px}
    p{font-size:12px;color:#666;margin-bottom:16px}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:13px}
    th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}
    .status{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}
    </style></head><body>
    <h1>OPD Token Queue</h1><p>Date: ${today} &nbsp;|&nbsp; Printed: ${new Date().toLocaleString("en-IN")}</p>
    <table><thead><tr><th>#Token</th><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th></tr></thead><tbody>
    ${filtered.map(a => `<tr>
      <td><b>#${a.tokenNumber ?? "—"}</b></td>
      <td>${a.patientName || a.patient?.name || "—"}</td>
      <td>${a.doctorName || a.doctor?.name || "—"}</td>
      <td>${a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
      <td>${a.status || "—"}</td>
    </tr>`).join("")}
    </tbody></table>
    <script>window.print();window.close();<\/script></body></html>`);
    win.document.close();
  }

  const filtered = appointments.filter(a => {
    const docMatch = !selectedDoctor || (a.doctorId || a.doctor?._id || a.doctor) === selectedDoctor;
    const statusMatch = filter === "ALL" || (a.status || "").toUpperCase() === filter;
    return docMatch && statusMatch;
  });

  const displayApts = filtered;

  function waitingMinutes(apt) {
    const ref = apt.createdAt || apt.scheduledAt || apt.appointmentDate;
    if (!ref) return 0;
    return Math.floor((Date.now() - new Date(ref).getTime()) / 60000);
  }

  const stats = {
    total:        appointments.length,
    waiting:      appointments.filter(a => ["PENDING","CHECKED_IN"].includes((a.status||"").toUpperCase())).length,
    withDoctor:   appointments.filter(a => (a.status||"").toUpperCase() === "IN_PROGRESS").length,
    done:         appointments.filter(a => (a.status||"").toUpperCase() === "COMPLETED").length,
    longWait:     appointments.filter(a => ["PENDING","CHECKED_IN"].includes((a.status||"").toUpperCase()) && waitingMinutes(a) > 30).length,
  };

  const currentToken = appointments.find(a => (a.status||"").toUpperCase() === "IN_PROGRESS");
  const nextToken    = appointments.find(a => (a.status||"").toUpperCase() === "CHECKED_IN");

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">Token Queue</h1>
        <div className="text-center py-16 text-gray-400">Loading queue...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">Token Queue</h1>
          <p className="text-sm text-[#4a5568] mt-0.5">
            Live OPD queue — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="flex items-center gap-1.5 border border-[#cbd5e0] bg-white text-[#2d3748] px-3 py-2 text-sm rounded-sm hover:bg-[#e2e8f0] transition-colors disabled:opacity-50">
            <RefreshIcon className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button onClick={printQueue}
            className="flex items-center gap-1.5 border border-[#cbd5e0] bg-white text-[#2d3748] px-3 py-2 text-sm rounded-sm hover:bg-[#e2e8f0] transition-colors">
            <PrintIcon className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Now Serving Banner */}
      {currentToken && (
        <div className="gov-card p-4 border-l-4 border-[#0d47a1] bg-[#e3f2fd]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#0d47a1] rounded-sm flex items-center justify-center text-white font-bold text-xl">
                {currentToken.tokenNumber ?? "—"}
              </div>
              <div>
                <div className="text-xs font-semibold text-[#0d47a1] uppercase tracking-wide">Now Serving</div>
                <div className="font-bold text-[#1a202c]">{currentToken.patientName || currentToken.patient?.name || "Patient"}</div>
                <div className="text-sm text-[#4a5568]">{currentToken.doctorName || "Doctor"}</div>
              </div>
            </div>
            {nextToken && (
              <div className="text-right">
                <div className="text-xs text-[#718096]">Next</div>
                <div className="text-2xl font-bold text-[#2d3748]">#{nextToken.tokenNumber}</div>
                <div className="text-xs text-[#4a5568]">{nextToken.patientName || nextToken.patient?.name || ""}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Today",    value: stats.total,      bg: "bg-white border border-[#e2e8f0]",      text: "text-[#1a202c]" },
          { label: "Waiting",        value: stats.waiting,    bg: "bg-yellow-50 border border-yellow-200",  text: "text-yellow-800" },
          { label: "With Doctor",    value: stats.withDoctor, bg: "bg-green-50 border border-green-200",    text: "text-green-800"  },
          { label: "Completed",      value: stats.done,       bg: "bg-gray-50 border border-gray-200",      text: "text-gray-600"   },
          { label: "Waiting > 30m",  value: stats.longWait,   bg: "bg-red-50 border border-red-200",        text: "text-red-700"    },
        ].map(s => (
          <div key={s.label} className={`rounded-sm p-4 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
            <div className="text-xs text-[#718096] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}
          className="gov-select bg-white px-3 py-2 text-sm text-[#1a202c] min-w-[160px]">
          <option value="">All Doctors</option>
          {doctors.map(d => <option key={d._id || d.id} value={d._id || d.id}>Dr. {d.name}</option>)}
        </select>
        <div className="flex rounded-sm overflow-hidden border border-[#cbd5e0]">
          {["ALL","PENDING","CHECKED_IN","IN_PROGRESS","COMPLETED"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${filter === s ? "bg-[#0d47a1] text-white" : "bg-white text-[#4a5568] hover:bg-[#f5f7fa]"}`}>
              {s === "ALL" ? "All" : s === "CHECKED_IN" ? "Checked In" : s === "IN_PROGRESS" ? "With Dr." : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Queue Table */}
      {displayApts.length === 0 ? (
        <div className="gov-card p-12 text-center">
          <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="8" y1="6" x2="21" y2="6" strokeWidth="2" /><line x1="8" y1="12" x2="21" y2="12" strokeWidth="2" />
              <line x1="8" y1="18" x2="21" y2="18" strokeWidth="2" />
              <circle cx="3" cy="6" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><circle cx="3" cy="18" r="1" fill="currentColor" />
            </svg>
          </div>
          <p className="text-sm text-[#718096]">No appointments in queue for today.</p>
        </div>
      ) : (
        <div className="gov-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f5f7fa]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#718096] uppercase">#Token</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#718096] uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#718096] uppercase hidden sm:table-cell">Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#718096] uppercase hidden md:table-cell">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#718096] uppercase hidden md:table-cell">Wait</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#718096] uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#718096] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {displayApts.map(apt => {
                const status = (apt.status || "PENDING").toUpperCase();
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
                const isUpdating = updatingId === (apt._id || apt.id);
                const isWaiting = ["PENDING","CHECKED_IN"].includes(status);
                const waitMins = isWaiting ? waitingMinutes(apt) : 0;
                const isLongWait = isWaiting && waitMins > 30;
                const isMedWait  = isWaiting && waitMins > 15 && !isLongWait;
                const rowBg = isLongWait
                  ? "bg-red-50"
                  : isMedWait
                  ? "bg-yellow-50/40"
                  : status === "IN_PROGRESS"
                  ? "bg-blue-50/50"
                  : "";
                return (
                  <tr key={apt._id || apt.id}
                    className={`transition-colors hover:brightness-95 ${rowBg}`}>
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#1a202c] text-base">#{apt.tokenNumber ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#2d3748]">
                      <div className="flex items-center gap-2 flex-wrap">
                        {apt.patientName || apt.patient?.name || "—"}
                        {isLongWait && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-full font-bold">
                            <AlertIcon className="w-2.5 h-2.5" />
                            Long Wait
                          </span>
                        )}
                      </div>
                      {apt.phone && <div className="text-xs text-[#718096]">{apt.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-[#4a5568] hidden sm:table-cell">
                      {apt.doctorName || apt.doctor?.name ? `Dr. ${apt.doctorName || apt.doctor?.name}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#4a5568] hidden md:table-cell">
                      {apt.scheduledAt ? new Date(apt.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {isWaiting ? (
                        <span className={`text-xs font-semibold ${isLongWait ? "text-red-600" : isMedWait ? "text-yellow-700" : "text-[#4a5568]"}`}>
                          {waitMins}m
                        </span>
                      ) : (
                        <span className="text-xs text-[#718096]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border font-medium ${cfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {NEXT_STATUS[status] && (
                          <button onClick={() => updateStatus(apt)} disabled={isUpdating}
                            className="text-xs bg-[#0d47a1] text-white px-3 py-1.5 rounded-sm hover:bg-[#0a3d91] disabled:opacity-50 transition-colors font-medium">
                            {isUpdating ? "…" : ACTION_LABEL[status]}
                          </button>
                        )}
                        {(status === "PENDING" || status === "CHECKED_IN") && (
                          <button onClick={() => cancelAppointment(apt)} disabled={isUpdating}
                            className="text-xs border border-[#cbd5e0] text-[#718096] px-2 py-1.5 rounded-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors">
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
