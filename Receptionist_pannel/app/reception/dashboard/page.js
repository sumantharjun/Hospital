"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, HOSPITALS_PATH, apiFetch, NETWORK_ERROR_MESSAGE } from "../../lib/api";

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right hidden sm:block">
      <p className="text-2xl font-bold text-white tabular-nums">
        {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="text-sm text-teal-100 mt-0.5">
        {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-xl border border-gray-100 shadow-sm p-4 overflow-hidden ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
    >
      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${accent}`} />
      <div className="pl-2">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-4">{label}</p>
          <span className="text-lg">{icon}</span>
        </div>
        <p className="mt-2 text-2xl font-bold text-gray-800">{value}</p>
        <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [hospitals, setHospitals] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);
  const [recentIP, setRecentIP] = useState([]);
  const [recentOP, setRecentOP] = useState([]);
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState({
    todayPatients: 0,
    waiting: 0,
    withDoctor: 0,
    completed: 0,
    todayIP: 0,
    todayIPEmergency: 0,
    todayOP: 0,
    todaySvc: 0,
    bedOccupied: 0,
    bedTotal: 0,
    bedOccupancyRate: 0,
    totalBilled: 0,
    totalCollected: 0,
    totalPending: 0,
    byMode: {},
    doctorsToday: [],
  });

  const fetchAll = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const headers = getAuthHeaders();
      const today = new Date().toISOString().split("T")[0];
      const [aptsRes, doctorsRes, hospRes, ipRes, opRes, svcRes, bedRes, revenueRes, billsRes, patientsRes] =
        await Promise.all([
          apiFetch(buildApiUrl("/api/appointments"), { headers }).catch(() => null),
          fetch(buildApiUrl("/api/users?role=DOCTOR"), { headers }).catch(() => null),
          fetch(buildApiUrl(HOSPITALS_PATH), { headers }).catch(() => null),
          fetch(buildApiUrl(`/api/reports/hospital/daily-ip?date=${today}`), { headers }).catch(() => null),
          fetch(buildApiUrl(`/api/reports/hospital/daily-op?date=${today}`), { headers }).catch(() => null),
          fetch(buildApiUrl("/api/service-registrations"), { headers }).catch(() => null),
          fetch(buildApiUrl("/api/reports/hospital/bed-occupancy"), { headers }).catch(() => null),
          fetch(buildApiUrl(`/api/reports/hospital/revenue?from=${today}&to=${today}`), { headers }).catch(() => null),
          fetch(buildApiUrl(`/api/bills?from=${today}&to=${today}`), { headers }).catch(() => null),
          fetch(buildApiUrl("/api/users?role=PATIENT"), { headers }).catch(() => null),
        ]);

      const apts = aptsRes?.ok ? await aptsRes.json() : [];
      const doctors = doctorsRes?.ok ? await doctorsRes.json() : [];
      const hosps = hospRes?.ok ? await hospRes.json() : [];
      const ipData = ipRes?.ok ? await ipRes.json() : null;
      const opData = opRes?.ok ? await opRes.json() : null;
      const svcRaw = svcRes?.ok ? await svcRes.json() : [];
      const bedData = bedRes?.ok ? await bedRes.json() : null;
      const revenue = revenueRes?.ok ? await revenueRes.json() : null;
      const billsRaw = billsRes?.ok ? await billsRes.json() : [];
      const patientsRaw = patientsRes?.ok ? await patientsRes.json() : [];

      setHospitals(Array.isArray(hosps) ? hosps : []);

      // Bills
      const billArr = Array.isArray(billsRaw) ? billsRaw : billsRaw?.bills || [];
      setBills(billArr);

      // Recent patients (last 6)
      const patList = Array.isArray(patientsRaw) ? patientsRaw : [];
      setRecentPatients(patList.slice(0, 6));

      // Recent IP admissions (last 5) — from ip-admissions API
      const ipListRes = await fetch(buildApiUrl(`/api/ip-admissions?status=ACTIVE`), { headers }).catch(() => null);
      const ipList = ipListRes?.ok ? await ipListRes.json() : [];
      setRecentIP(Array.isArray(ipList) ? ipList.slice(0, 5) : []);

      // Recent OP registrations (last 5)
      const opListRes = await fetch(buildApiUrl(`/api/op-registrations`), { headers }).catch(() => null);
      const opList = opListRes?.ok ? await opListRes.json() : [];
      const opArr = Array.isArray(opList) ? opList : opList?.data || [];
      const todayOPs = opArr.filter((o) => {
        const d = o.registrationDate || o.createdAt;
        return d && new Date(d).toISOString().split("T")[0] === today;
      });
      setRecentOP(todayOPs.slice(0, 5));

      const todaySvc = Array.isArray(svcRaw) ? svcRaw.filter((s) => {
        const d = s.registrationDate || s.createdAt;
        return d && new Date(d).toISOString().split("T")[0] === today;
      }).length : 0;

      let todayApts = Array.isArray(apts) ? apts.filter((a) => {
        const d = a.appointmentDate || a.scheduledAt;
        return d && new Date(d).toISOString().split("T")[0] === today;
      }) : [];

      setStats({
        todayPatients: todayApts.length,
        waiting: todayApts.filter((a) => ["PENDING", "CHECKED_IN"].includes((a.status || "").toUpperCase())).length,
        withDoctor: todayApts.filter((a) => (a.status || "").toUpperCase() === "IN_PROGRESS").length,
        completed: todayApts.filter((a) => (a.status || "").toUpperCase() === "COMPLETED").length,
        todayIP: ipData?.count ?? 0,
        todayIPEmergency: ipData?.emergency ?? 0,
        todayOP: opData?.count ?? 0,
        todaySvc,
        bedOccupied: bedData?.occupied ?? 0,
        bedTotal: bedData?.total ?? 0,
        bedOccupancyRate: bedData?.occupancyRate ?? 0,
        totalBilled: revenue?.totalBilled ?? 0,
        totalCollected: revenue?.totalCollected ?? 0,
        totalPending: revenue?.totalPending ?? 0,
        byMode: revenue?.byMode ?? {},
        doctorsToday: (Array.isArray(doctors) ? doctors : []).slice(0, 10),
      });
    } catch (e) {
      toast.error(e?.message === "BACKEND_UNREACHABLE" ? NETWORK_ERROR_MESSAGE : (e?.message || "Failed to load data"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    fetchAll();
    const interval = setInterval(() => fetchAll(), 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchAll]);

  const grandCollected = bills.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const byMode = bills.reduce((acc, b) => {
    (b.paymentHistory || []).forEach((p) => {
      const m = p.mode || "CASH";
      acc[m] = (acc[m] || 0) + Number(p.amount || 0);
    });
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500 text-sm font-medium">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 shadow-lg p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Reception Dashboard</h1>
            <p className="mt-1 text-teal-100 text-sm">Hospital management at a glance</p>
            {hospitals.length > 0 && (
              <div className="mt-3">
                <select
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  className="bg-white/20 backdrop-blur text-white border border-white/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 min-w-[180px]"
                >
                  <option value="" className="text-gray-800">All hospitals</option>
                  {hospitals.map((h) => (
                    <option key={h._id || h.id} value={h._id || h.id} className="text-gray-800">{h.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-3">
            <Clock />
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm px-4 py-2 rounded-lg transition font-medium disabled:opacity-60"
            >
              <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "New IP Admission", icon: "🏥", path: "/reception/ip-registration", bg: "bg-blue-500" },
          { label: "New OP Visit", icon: "👨‍⚕️", path: "/reception/op-registration", bg: "bg-emerald-500" },
          { label: "Service Billing", icon: "💊", path: "/reception/services-registration", bg: "bg-violet-500" },
          { label: "IP Billing", icon: "🧾", path: "/reception/ip-billing", bg: "bg-orange-500" },
          { label: "Discharge", icon: "🚪", path: "/reception/discharge", bg: "bg-rose-500" },
          { label: "Add Patient", icon: "➕", path: "/reception/patients", bg: "bg-teal-600" },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={() => router.push(btn.path)}
            className={`${btn.bg} text-white rounded-xl px-3 py-3 text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm flex flex-col items-center gap-1.5`}
          >
            <span className="text-xl">{btn.icon}</span>
            <span>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="IP Admissions" value={stats.todayIP} sub="In-patients today" icon="🏥" accent="bg-blue-500" onClick={() => router.push("/reception/ip-billing")} />
        <StatCard label="Emergencies" value={stats.todayIPEmergency} sub="Urgent cases" icon="🚨" accent={stats.todayIPEmergency > 0 ? "bg-red-500" : "bg-gray-300"} onClick={() => router.push("/reception/ip-billing")} />
        <StatCard label="OP Visits" value={stats.todayOP} sub="Out-patients today" icon="🩺" accent="bg-emerald-500" onClick={() => router.push("/reception/op-registration")} />
        <StatCard label="Services" value={stats.todaySvc} sub="Billed today" icon="💊" accent="bg-violet-500" onClick={() => router.push("/reception/services-registration")} />
        <StatCard label="Beds Occupied" value={`${stats.bedOccupied}/${stats.bedTotal}`} sub="Active occupancy" icon="🛏️" accent={stats.bedOccupancyRate > 80 ? "bg-red-500" : "bg-teal-500"} onClick={() => router.push("/reception/ip-registration")} />
        <StatCard label="Occupancy Rate" value={`${stats.bedOccupancyRate}%`} sub="Bed utilisation" icon="📊" accent={stats.bedOccupancyRate > 80 ? "bg-red-500" : "bg-green-500"} />
      </div>

      {/* Revenue + Bed Occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Today */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 text-base">Revenue — Today</h2>
            <button onClick={() => router.push("/reception/revenue")} className="text-xs text-teal-600 font-semibold hover:underline">Full report →</button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Billed", value: stats.totalBilled, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
              { label: "Collected", value: grandCollected || stats.totalCollected, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
              { label: "Pending", value: stats.totalPending, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-lg p-3 text-center`}>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className={`text-lg font-bold mt-1 ${s.color}`}>₹{Number(s.value || 0).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">By Payment Mode</p>
          <div className="space-y-2">
            {[
              { mode: "CASH", icon: "💵", color: "bg-amber-400" },
              { mode: "UPI", icon: "📱", color: "bg-blue-400" },
              { mode: "CARD", icon: "💳", color: "bg-violet-400" },
              { mode: "INSURANCE", icon: "🏦", color: "bg-green-400" },
            ].map(({ mode, icon, color }) => {
              const val = byMode[mode] || stats.byMode?.[mode] || 0;
              const total = grandCollected || stats.totalCollected || 1;
              return (
                <div key={mode} className="flex items-center gap-3">
                  <span className="text-sm w-5">{icon}</span>
                  <span className="text-xs text-gray-500 w-16">{mode}</span>
                  <div className="flex-1">
                    <ProgressBar value={val} max={total} color={color} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-20 text-right">₹{Number(val).toLocaleString("en-IN")}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bed Occupancy */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 text-base">Bed Occupancy</h2>
            <button onClick={() => router.push("/reception/ip-registration")} className="text-xs text-teal-600 font-semibold hover:underline">Manage beds →</button>
          </div>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 36 36" className="w-36 h-36 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={stats.bedOccupancyRate > 80 ? "#ef4444" : "#14b8a6"}
                  strokeWidth="3"
                  strokeDasharray={`${stats.bedOccupancyRate} ${100 - stats.bedOccupancyRate}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-800">{stats.bedOccupancyRate}%</span>
                <span className="text-xs text-gray-400 mt-0.5">Occupancy</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: "Total Beds", value: stats.bedTotal, color: "text-gray-700" },
              { label: "Occupied", value: stats.bedOccupied, color: "text-teal-600" },
              { label: "Available", value: Math.max(0, stats.bedTotal - stats.bedOccupied), color: "text-emerald-600" },
            ].map((b) => (
              <div key={b.label} className="text-center bg-gray-50 rounded-lg py-3">
                <p className={`text-xl font-bold ${b.color}`}>{b.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{b.label}</p>
              </div>
            ))}
          </div>
          {stats.bedOccupancyRate > 80 && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-red-500 text-sm">⚠️</span>
              <p className="text-xs text-red-600 font-medium">High occupancy — consider opening more wards</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity — IP + OP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent IP Admissions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-base">Active IP Admissions</h2>
            <button onClick={() => router.push("/reception/ip-billing")} className="text-xs text-teal-600 font-semibold hover:underline">View all →</button>
          </div>
          {recentIP.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No active admissions</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentIP.map((ip, i) => (
                <div key={ip._id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {(ip.patientName || ip.patientId?.name || "P")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{ip.patientName || ip.patientId?.name || "—"}</p>
                    <p className="text-xs text-gray-400 truncate">Ward: {ip.wardType || ip.ward || "—"} · Dr. {ip.doctorName || ip.doctorId?.name || "—"}</p>
                  </div>
                  {ip.isEmergency && (
                    <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full flex-shrink-0">URGENT</span>
                  )}
                  <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                    {ip.status || "ACTIVE"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's OP Registrations */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-base">Today&apos;s OP Visits</h2>
            <button onClick={() => router.push("/reception/op-registration")} className="text-xs text-teal-600 font-semibold hover:underline">View all →</button>
          </div>
          {recentOP.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No OP visits today</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentOP.map((op, i) => (
                <div key={op._id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                    {(op.patientName || op.patientId?.name || "P")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{op.patientName || op.patientId?.name || "—"}</p>
                    <p className="text-xs text-gray-400 truncate">
                      Token: {op.token || op.tokenNumber || "—"} · Dr. {op.doctorName || op.doctorId?.name || "—"}
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                    {op.status || "REGISTERED"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Patients + Doctors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recently Registered Patients */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-base">Recent Patients</h2>
            <button onClick={() => router.push("/reception/patients")} className="text-xs text-teal-600 font-semibold hover:underline">All patients →</button>
          </div>
          {recentPatients.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No patients registered yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentPatients.map((p, i) => (
                <div key={p._id || p.id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
                    {(p.name || "P")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name || "—"}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {p.phone || p.mobile || "No phone"} · {p.age ? `${p.age}y` : ""} {p.gender ? `· ${p.gender}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 font-mono">{p.opdNumber ? `OPD: ${p.opdNumber}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Doctors on Duty */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-base">Doctors on Duty</h2>
            <span className="text-xs bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-full">{stats.doctorsToday.length} active</span>
          </div>
          {stats.doctorsToday.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No doctors found. Check backend connection.</div>
          ) : (
            <div className="p-4 flex flex-wrap gap-2">
              {stats.doctorsToday.map((d) => (
                <div key={d._id || d.id}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-colors rounded-lg px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {(d.name || "D")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Dr. {d.name || "—"}</p>
                    {d.specialization && <p className="text-[10px] text-gray-400">{d.specialization}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's Bills Summary */}
      {bills.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-base">Today&apos;s Bills</h2>
            <button onClick={() => router.push("/reception/receipts")} className="text-xs text-teal-600 font-semibold hover:underline">View receipts →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Bill ID", "Patient", "Type", "Total", "Paid", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bills.slice(0, 8).map((bill) => (
                  <tr key={bill._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{bill.billId || bill._id?.slice(-8)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{bill.patientName || bill.patientId?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        bill.billType === "IP" ? "bg-blue-100 text-blue-700" :
                        bill.billType === "OP" ? "bg-emerald-100 text-emerald-700" :
                        "bg-violet-100 text-violet-700"
                      }`}>{bill.billType || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-800">₹{(bill.grandTotal || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-emerald-700 font-semibold">₹{(bill.paidAmount || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        bill.status === "PAID" ? "bg-green-100 text-green-700" :
                        bill.status === "PARTIAL" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-600"
                      }`}>{bill.status || "PENDING"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
