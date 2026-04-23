"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";
import {
  RefreshIcon,
  StethoscopeIcon,
  AppointmentsIcon,
  CheckIcon,
  AlertIcon,
} from "../../components/ReceptionIcons";

const AVAILABILITY_CONFIG = {
  AVAILABLE: { label: "Available", bg: "bg-green-100 text-green-800 border-green-300", dot: "bg-green-500" },
  BUSY:      { label: "Busy",      bg: "bg-orange-100 text-orange-800 border-orange-300", dot: "bg-orange-500" },
  BREAK:     { label: "On Break",  bg: "bg-gray-100 text-gray-600 border-gray-300",  dot: "bg-gray-400"   },
  UNAVAILABLE:{ label: "Unavailable", bg: "bg-red-100 text-red-700 border-red-300",  dot: "bg-red-400"    },
};

function deriveStatus(stats, manualStatus) {
  if (manualStatus === "BREAK" || manualStatus === "UNAVAILABLE") return manualStatus;
  if (stats.inProgress > 0) return "BUSY";
  return "AVAILABLE";
}

export default function DoctorDutyBoardPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualStatus, setManualStatus] = useState({}); // doctorId -> "BREAK"|"UNAVAILABLE"|null
  const today = new Date().toISOString().split("T")[0];

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const headers = getAuthHeaders();
      const [docRes, aptRes] = await Promise.all([
        fetch(buildApiUrl("/api/users?role=DOCTOR"), { headers }),
        fetch(buildApiUrl("/api/appointments"), { headers }),
      ]);
      const docs = docRes.ok ? await docRes.json() : [];
      const apts = aptRes.ok ? await aptRes.json() : [];
      const todayApts = Array.isArray(apts)
        ? apts.filter((a) => {
            const d = a.appointmentDate || a.scheduledAt;
            return d && new Date(d).toISOString().split("T")[0] === today;
          })
        : [];
      setDoctors(Array.isArray(docs) ? docs : []);
      setAppointments(todayApts);
    } catch {
      if (!silent) toast.error("Failed to load doctor data");
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

  function getDoctorStats(doctor) {
    const id = doctor._id || doctor.id;
    const docApts = appointments.filter((a) => {
      const dId = a.doctorId || a.doctor?._id || a.doctor;
      return dId === id;
    });
    const total = docApts.length;
    const waiting = docApts.filter((a) =>
      ["PENDING", "CHECKED_IN"].includes((a.status || "").toUpperCase())
    ).length;
    const inProgress = docApts.filter(
      (a) => (a.status || "").toUpperCase() === "IN_PROGRESS"
    ).length;
    const completed = docApts.filter(
      (a) => (a.status || "").toUpperCase() === "COMPLETED"
    ).length;
    const waitTime = waiting * 10;
    return { total, waiting, inProgress, completed, waitTime };
  }

  function toggleManualStatus(id, current) {
    setManualStatus((prev) => {
      const next = { ...prev };
      if (current === "BREAK") next[id] = "UNAVAILABLE";
      else if (current === "UNAVAILABLE") next[id] = null;
      else next[id] = "BREAK";
      return next;
    });
  }

  const doctorsWithStats = doctors.map((doc) => {
    const id = doc._id || doc.id;
    const stats = getDoctorStats(doc);
    const manual = manualStatus[id] || null;
    const status = deriveStatus(stats, manual);
    return { ...doc, stats, status, manual };
  });

  // Sort: BUSY first, then AVAILABLE, then BREAK/UNAVAILABLE
  const sortOrder = { BUSY: 0, AVAILABLE: 1, BREAK: 2, UNAVAILABLE: 3 };
  const sorted = [...doctorsWithStats].sort(
    (a, b) => (sortOrder[a.status] ?? 4) - (sortOrder[b.status] ?? 4)
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">
          Doctor Duty Board
        </h1>
        <div className="text-center py-16 text-gray-400">Loading doctors...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">
            Doctor Duty Board
          </h1>
          <p className="text-sm text-[#4a5568] mt-0.5">
            Live doctor availability &amp; queue depth —{" "}
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 border border-[#cbd5e0] bg-white text-[#2d3748] px-3 py-2 text-sm rounded-sm hover:bg-[#e2e8f0] transition-colors disabled:opacity-50"
        >
          <RefreshIcon className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Doctors", value: sorted.length,                                    bg: "bg-white border border-[#e2e8f0]",    text: "text-[#1a202c]" },
          { label: "Available",     value: sorted.filter(d => d.status === "AVAILABLE").length, bg: "bg-green-50 border border-green-200",  text: "text-green-800" },
          { label: "Busy",          value: sorted.filter(d => d.status === "BUSY").length,      bg: "bg-orange-50 border border-orange-200",text: "text-orange-800"},
          { label: "Away / Break",  value: sorted.filter(d => ["BREAK","UNAVAILABLE"].includes(d.status)).length, bg: "bg-gray-50 border border-gray-200", text: "text-gray-600" },
        ].map((s) => (
          <div key={s.label} className={`rounded-sm p-4 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
            <div className="text-xs text-[#718096] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Doctor cards */}
      {sorted.length === 0 ? (
        <div className="gov-card p-12 text-center">
          <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <StethoscopeIcon className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm text-[#718096]">No doctors found in the system.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((doc) => {
            const id = doc._id || doc.id;
            const cfg = AVAILABILITY_CONFIG[doc.status] || AVAILABILITY_CONFIG.AVAILABLE;
            const manualCurrent = doc.status === "BREAK" || doc.status === "UNAVAILABLE"
              ? doc.status
              : null;

            return (
              <div
                key={id}
                className={`gov-card p-5 flex flex-col gap-4 border-t-4 ${
                  doc.status === "BUSY"
                    ? "border-orange-400"
                    : doc.status === "AVAILABLE"
                    ? "border-green-400"
                    : "border-gray-300"
                }`}
              >
                {/* Doctor info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-sm bg-[#e3f2fd] flex items-center justify-center text-[#0d47a1] font-bold text-lg shrink-0">
                      {(doc.name || "D").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-[#1a202c]">
                        Dr. {doc.name || "Unknown"}
                      </div>
                      <div className="text-xs text-[#718096]">
                        {doc.specialization || doc.department || "General"}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-semibold shrink-0 ${cfg.bg}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Today",   value: doc.stats.total,      color: "text-[#1a202c]" },
                    { label: "Waiting", value: doc.stats.waiting,    color: "text-yellow-700" },
                    { label: "With Dr", value: doc.stats.inProgress, color: "text-blue-700" },
                    { label: "Done",    value: doc.stats.completed,  color: "text-green-700" },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#f5f7fa] rounded-sm py-2">
                      <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-[#718096]">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Wait time */}
                <div className="flex items-center gap-2 text-sm">
                  {doc.stats.total === 0 ? (
                    <span className="text-[#718096] text-xs">No patients today</span>
                  ) : (
                    <>
                      <span className="text-[#718096] text-xs">Est. wait:</span>
                      <span
                        className={`text-xs font-semibold ${
                          doc.stats.waitTime > 30
                            ? "text-red-600"
                            : doc.stats.waitTime > 15
                            ? "text-orange-600"
                            : "text-green-700"
                        }`}
                      >
                        {doc.stats.waitTime} min
                      </span>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-[#e2e8f0]">
                  <button
                    onClick={() => router.push(`/reception/appointments?doctorId=${id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-[#0d47a1] text-white px-3 py-2 rounded-sm hover:bg-[#0a3d91] transition-colors font-medium"
                  >
                    <AppointmentsIcon className="w-3.5 h-3.5" />
                    Book Appointment
                  </button>
                  <button
                    onClick={() => toggleManualStatus(id, manualCurrent)}
                    title={
                      manualCurrent === "BREAK"
                        ? "Mark Unavailable"
                        : manualCurrent === "UNAVAILABLE"
                        ? "Mark Available"
                        : "Mark on Break"
                    }
                    className="flex items-center justify-center border border-[#cbd5e0] text-[#718096] px-2.5 py-2 rounded-sm hover:bg-[#f5f7fa] transition-colors"
                  >
                    <AlertIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[#718096] text-center">
        Auto-refreshes every 30 seconds. Availability toggle is local UI only.
      </p>
    </div>
  );
}
