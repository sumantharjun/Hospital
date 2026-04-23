"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import NurseLayout from "../../components/NurseLayout";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";

export default function NurseTimesheetListPage() {
  const router = useRouter();
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "", shiftType: "" });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.replace("/"); return; }
    fetchSheets();
  }, [router]);

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.shiftType) params.append("shiftType", filters.shiftType);
      const res = await fetch(buildApiUrl(`/api/nurse/timesheets/mine?${params}`), { headers: getAuthHeaders() });
      setSheets(res.ok ? await res.json() : []);
    } catch {
      toast.error("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  };

  return (
    <NurseLayout>
      <div className="nurse-page space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">My Timesheets</h1>
          <Link href="/nurse/timesheet/new" className="nurse-btn-primary px-4 py-2 text-sm font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            New Entry
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <input type="date" className="nurse-input"
            value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
          <input type="date" className="nurse-input"
            value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
          <select className="nurse-input"
            value={filters.shiftType} onChange={e => setFilters(p => ({ ...p, shiftType: e.target.value }))}>
            <option value="">All Shifts</option>
            <option value="DAY">Day</option>
            <option value="NIGHT">Night</option>
          </select>
          <button onClick={fetchSheets} className="nurse-btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filter
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : sheets.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-sm">No timesheets found.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {sheets.map(s => (
              <div key={s._id} onClick={() => setSelected(selected?._id === s._id ? null : s)}
                className={`nurse-card p-4 cursor-pointer transition-colors ${selected?._id === s._id ? "border-green-500" : "border-slate-200 hover:border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-900 text-sm">{s.patientCategoryId}</span>
                    <span className="text-xs text-slate-400 ml-2">({s.patientCategory})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.emergencyFlag && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">EMERGENCY</span>}
                    <span className={`text-xs px-2 py-0.5 rounded ${s.shiftType === "DAY" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>{s.shiftType}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${s.status === "SUBMITTED" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{s.status}</span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500 flex gap-4">
                  <span>{s.date ? new Date(s.date).toLocaleDateString() : "-"}</span>
                  <span>In: {s.checkIn ? new Date(s.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                  <span>Out: {s.checkOut ? new Date(s.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Ongoing"}</span>
                </div>

                {selected?._id === s._id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["Department", s.department],
                        ["Handover To", s.handoverToName || "-"],
                      ].map(([k, v]) => (
                        <div key={k}><span className="text-slate-400">{k}: </span><span className="font-medium">{v}</span></div>
                      ))}
                    </div>
                    {s.vitalsRecorded && Object.values(s.vitalsRecorded).some(v => v) && (
                      <div>
                        <span className="text-slate-400">Vitals: </span>
                        <span>{["bp","pulse","temperature","spo2"].filter(k => s.vitalsRecorded[k]).map(k => `${k.toUpperCase()}: ${s.vitalsRecorded[k]}`).join(" | ")}</span>
                      </div>
                    )}
                    {s.servicesProvided?.length > 0 && (
                      <div><span className="text-slate-400">Services: </span><span>{s.servicesProvided.join(", ")}</span></div>
                    )}
                    {s.observations && <div><span className="text-slate-400">Notes: </span><span>{s.observations}</span></div>}
                    {s.emergencyDetails && <div className="text-red-600"><span className="font-medium">Emergency: </span><span>{s.emergencyDetails}</span></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </NurseLayout>
  );
}

