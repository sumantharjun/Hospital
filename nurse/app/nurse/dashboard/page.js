"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import NurseLayout from "../../components/NurseLayout";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";

const IcClipboard = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const IcClock = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
  </svg>
);
const IcAlert = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);
const IcCalendar = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const IcPlus = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
);
const IcHandshake = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
  </svg>
);
const IcPatients = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IcVitals = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);
const IcBell = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

export default function NurseDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mySheets, setMySheets] = useState([]);

  useEffect(() => {
    const u = localStorage.getItem("nurseUser");
    const t = localStorage.getItem("token");
    if (!u || !t) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchDashboard(JSON.parse(u));
  }, [router]);

  const fetchDashboard = async (u) => {
    try {
      const [dashRes, sheetsRes] = await Promise.all([
        fetch(buildApiUrl(`/api/nurse/dashboard${u.hospitalId ? `?hospitalId=${u.hospitalId}` : ""}`), { headers: getAuthHeaders() }),
        fetch(buildApiUrl("/api/nurse/timesheets/mine?"), { headers: getAuthHeaders() }),
      ]);
      setDashData(dashRes.ok ? await dashRes.json() : null);
      setMySheets(sheetsRes.ok ? await sheetsRes.json() : []);
    } catch (err) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <NurseLayout><div className="text-center py-16 text-slate-400">Loading...</div></NurseLayout>;

  const today = new Date().toLocaleDateString();
  const todaySheets = mySheets.filter(s => {
    const d = s.date ? new Date(s.date).toLocaleDateString() : "";
    return d === today;
  });
  const pendingHandovers = todaySheets.filter(s => !s.checkOut);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const stats = [
    { label: "Today's Shifts",    value: todaySheets.length,           iconColor: "text-teal-600",  Icon: IcClipboard },
    { label: "Pending Handover",  value: pendingHandovers.length,      iconColor: "text-yellow-600", Icon: IcClock },
    { label: "Emergencies",       value: dashData?.emergencies || 0,   iconColor: "text-red-600",    Icon: IcAlert },
    { label: "Total This Month",  value: mySheets.length,              iconColor: "text-blue-600",   Icon: IcCalendar },
  ];

  const quickActions = [
    { href: "/nurse/timesheet/new", label: "New Timesheet",  sub: "Log today's shift",  Icon: IcPlus,      bg: "bg-teal-600 hover:bg-teal-700", text: "text-white", subText: "text-teal-100" },
    { href: "/nurse/patients",      label: "My Patients",    sub: "View IP patients",   Icon: IcPatients,  bg: "bg-white hover:bg-slate-50 border border-slate-200", text: "text-slate-800", subText: "text-slate-500" },
    { href: "/nurse/vitals",        label: "Record Vitals",  sub: "Document vitals",    Icon: IcVitals,    bg: "bg-white hover:bg-slate-50 border border-slate-200", text: "text-slate-800", subText: "text-slate-500" },
    { href: "/nurse/medications",   label: "Medications",    sub: "Administer & track", Icon: IcCalendar,  bg: "bg-white hover:bg-slate-50 border border-slate-200", text: "text-slate-800", subText: "text-slate-500" },
    { href: "/nurse/handover",      label: "Handover",       sub: "Transfer patients",  Icon: IcHandshake, bg: "bg-white hover:bg-slate-50 border border-slate-200", text: "text-slate-800", subText: "text-slate-500" },
    { href: "/nurse/alerts",        label: "Alerts",         sub: "Notifications",      Icon: IcBell,      bg: "bg-white hover:bg-slate-50 border border-slate-200", text: "text-slate-800", subText: "text-slate-500" },
  ];

  return (
    <NurseLayout>
      <div className="nurse-page space-y-6">
        {/* Header */}
        <div className="nurse-card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Shift Overview</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">{greeting}, {user?.name?.split(" ")[0]}!</h1>
            <p className="text-slate-500 text-sm mt-2">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="nurse-badge bg-emerald-50 text-emerald-700">Today: {todaySheets.length} shifts</span>
              <span className="nurse-badge bg-amber-50 text-amber-700">Pending: {pendingHandovers.length}</span>
              <span className="nurse-badge bg-slate-100 text-slate-600">Monthly: {mySheets.length}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/nurse/timesheet/new" className="nurse-btn-primary text-sm font-semibold">New Timesheet</Link>
            <Link href="/nurse/schedule" className="text-sm font-semibold border border-slate-200 rounded-2xl px-4 py-2 hover:bg-slate-50 transition-colors">View Schedule</Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, iconColor, Icon }) => (
            <div key={label} className="nurse-kpi">
              <div className={`mb-2 ${iconColor}`}><Icon className="w-6 h-6" /></div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-xs text-slate-600 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map(({ href, label, sub, Icon, bg, text, subText }) => (
            <Link key={href} href={href}
              className={`rounded-2xl p-4 flex items-center gap-3 transition-colors ${bg} ${text === "text-white" ? "" : "nurse-card"}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${text === "text-white" ? "bg-white/20" : "bg-emerald-50"}`}>
                <Icon className={`w-5 h-5 ${text === "text-white" ? "text-white" : "text-teal-600"}`} />
              </div>
              <div>
                <div className={`font-semibold text-sm ${text}`}>{label}</div>
                <div className={`text-xs ${subText}`}>{sub}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Today's Activity */}
        <div className="nurse-card p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <IcClipboard className="w-4 h-4 text-teal-600" />
              Today's Activity
            </h2>
            <Link href="/nurse/timesheet" className="text-xs text-teal-600 hover:text-teal-700 font-medium">View All {"->"}</Link>
          </div>

          {todaySheets.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <IcClipboard className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-sm text-slate-500">No timesheets logged today.</div>
              <Link href="/nurse/timesheet/new" className="text-teal-600 text-xs hover:underline mt-1 inline-block font-medium">
                Log your first shift {"->"}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {todaySheets.map(s => (
                <div key={s._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.checkOut ? "bg-green-400" : "bg-yellow-400"}`} />
                    <div>
                      <span className="font-medium text-slate-900">{s.patientCategoryId}</span>
                      <span className="text-slate-400 text-xs ml-2">({s.patientCategory})</span>
                    </div>
                    {s.emergencyFlag && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">EMERGENCY</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.shiftType === "DAY" ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-700"}`}>
                      {s.shiftType}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.checkOut ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {s.checkOut ? "Completed" : "Ongoing"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </NurseLayout>
  );
}

