"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import NurseLayout from "../../components/NurseLayout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SHIFT_COLORS = {
  DAY:     { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-400", label: "Day Shift",   time: "07:00 - 15:00" },
  NIGHT:   { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-400", label: "Night Shift", time: "23:00 - 07:00" },
  EVENING: { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-400", label: "Evening",     time: "15:00 - 23:00" },
  OFF:     { bg: "bg-gray-100",   text: "text-slate-500",  dot: "bg-gray-300",   label: "Day Off",     time: "" },
};

function getWeekDates(anchor) {
  const d = new Date(anchor);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return dt;
  });
}

export default function SchedulePage() {
  const router = useRouter();
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [user, setUser] = useState(null);

  const weekDates = getWeekDates(weekAnchor);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  useEffect(() => {
    const token = localStorage.getItem("token");
    const u = localStorage.getItem("nurseUser");
    if (!token || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetchSchedule();
  }, [user, weekAnchor]);

  async function fetchSchedule() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const from = weekDates[0].toISOString().split("T")[0];
      const to = weekDates[6].toISOString().split("T")[0];
      const res = await fetch(`${API_BASE}/api/nurse/timesheets?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTimesheets(Array.isArray(data) ? data : (data.timesheets || []));
      }
    } catch (_) {}
    finally { setLoading(false); }
  }

  function getShiftForDate(date) {
    const dateStr = date.toISOString().split("T")[0];
    return timesheets.find(t => {
      const d = t.date || t.shiftDate || t.startTime;
      return d && new Date(d).toISOString().split("T")[0] === dateStr;
    });
  }

  const prevWeek = () => { const d = new Date(weekAnchor); d.setDate(d.getDate() - 7); setWeekAnchor(d); };
  const nextWeek = () => { const d = new Date(weekAnchor); d.setDate(d.getDate() + 7); setWeekAnchor(d); };

  const fmt = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const today = new Date().toISOString().split("T")[0];

  const totalShifts = timesheets.filter(t => t.shiftType !== "OFF").length;
  const dayShifts = timesheets.filter(t => t.shiftType === "DAY").length;
  const nightShifts = timesheets.filter(t => t.shiftType === "NIGHT").length;
  const emergencies = timesheets.filter(t => t.emergencyFlag).length;

  return (
    <NurseLayout>
      <div className="nurse-page space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>
          <p className="text-sm text-slate-500 mt-1">Weekly shift view and timesheet summary</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Shifts", value: totalShifts, color: "bg-emerald-50 text-green-700" },
            { label: "Day Shifts",   value: dayShifts,   color: "bg-yellow-50 text-yellow-700" },
            { label: "Night Shifts", value: nightShifts, color: "bg-indigo-50 text-indigo-700" },
            { label: "Emergencies",  value: emergencies, color: emergencies > 0 ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500" },
          ].map(s => (
            <div key={s.label} className={`nurse-kpi text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="nurse-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-slate-800">
              {fmt(weekStart)} - {fmt(weekEnd)} {weekEnd.getFullYear()}
            </span>
            <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading schedule...</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 min-w-[640px]">
              {weekDates.map((date, i) => {
                const shift = getShiftForDate(date);
                const dateStr = date.toISOString().split("T")[0];
                const isToday = dateStr === today;
                const shiftType = shift?.shiftType || null;
                const colors = shiftType ? (SHIFT_COLORS[shiftType] || SHIFT_COLORS.OFF) : null;
                return (
                  <div key={i}
                    className={`p-3 border-r last:border-r-0 border-gray-100 min-h-30 ${isToday ? "bg-emerald-50" : ""}`}>
                    <div className={`text-xs font-semibold mb-1 ${isToday ? "text-green-700" : "text-slate-500"}`}>
                      {DAYS[date.getDay()]}
                    </div>
                    <div className={`text-lg font-bold mb-2 ${isToday ? "text-green-800" : "text-slate-800"}`}>
                      {date.getDate()}
                    </div>
                    {shift ? (
                      <div className={`rounded-lg p-2 ${colors.bg}`}>
                        <div className={`text-xs font-semibold ${colors.text}`}>{colors.label}</div>
                        {colors.time && <div className={`text-xs mt-0.5 ${colors.text} opacity-75`}>{colors.time}</div>}
                        {shift.emergencyFlag && (
                          <div className="mt-1 flex items-center gap-1 text-xs font-bold text-red-600">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                            Emergency
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-300 mt-1">No shift</div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        <div className="nurse-card p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Recent Timesheets</h2>
          {timesheets.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">No timesheets found for this week.</div>
          ) : (
            <div className="space-y-2">
              {timesheets.slice(0, 5).map((t, i) => {
                const colors = SHIFT_COLORS[t.shiftType] || SHIFT_COLORS.DAY;
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          {new Date(t.date || t.startTime).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                        </div>
                        <div className="text-xs text-slate-500">{colors.label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      {t.emergencyFlag && <span className="text-xs text-red-600 font-medium">Emergency</span>}
                      <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} font-medium`}>
                        {t.status || "SUBMITTED"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => router.push("/nurse/timesheet")}
            className="mt-4 text-sm text-teal-600 hover:text-teal-700 font-medium">
            View all timesheets {"->"}
          </button>
        </div>
      </div>
    </NurseLayout>
  );
}

