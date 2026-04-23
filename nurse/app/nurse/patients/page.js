"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import NurseLayout from "../../components/NurseLayout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const statusColor = {
  ACTIVE: "bg-blue-100 text-blue-700",
  DISCHARGED: "bg-gray-100 text-slate-500",
  CRITICAL: "bg-red-100 text-red-700",
  STABLE: "bg-green-100 text-green-700",
};

export default function MyPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/"); return; }
    fetchPatients(token);
  }, [router]);

  async function fetchPatients(token) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ip-admissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load patients");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.admissions || data.records || []);
      setPatients(list);
    } catch (e) {
      toast.error(e.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }

  const filtered = patients.filter((p) => {
    const name = p.patientId?.name || p.patient?.name || "";
    const ipId = p.ipId || "";
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || ipId.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "ALL" || (p.status || "").toUpperCase() === filter;
    return matchSearch && matchFilter;
  });

  return (
    <NurseLayout>
      <div className="nurse-page space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Patients</h1>
          <p className="text-sm text-slate-500 mt-1">Current IP admissions and patient status</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by name or IP ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="nurse-input flex-1"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="nurse-input"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="DISCHARGED">Discharged</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading patients...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 nurse-card border border-slate-200">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">No patients found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const patient = p.patientId || p.patient || {};
              const doctor = p.doctorId || p.doctor || {};
              const room = p.roomId || p.room || {};
              const bed = p.bedId || p.bed || {};
              const statusKey = (p.status || "ACTIVE").toUpperCase();
              return (
                <div key={p._id || p.ipId} className="nurse-card p-4 hover:border-green-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm shrink-0">
                        {patient.name?.charAt(0)?.toUpperCase() || "P"}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{patient.name || "Unknown"}</div>
                        <div className="text-xs text-slate-500 font-mono">{p.ipId || "-"}</div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[statusKey] || "bg-gray-100 text-slate-600"}`}>
                      {p.status || "ACTIVE"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <div className="text-xs text-slate-400">Phone</div>
                      <div className="text-sm font-medium text-slate-700">{patient.phone || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Doctor</div>
                      <div className="text-sm font-medium text-slate-700">{doctor.name ? `Dr. ${doctor.name}` : "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Room / Bed</div>
                      <div className="text-sm font-medium text-slate-700">
                        {room.roomNumber ? `${room.roomNumber} / Bed ${bed.bedNumber || "-"}` : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Admitted</div>
                      <div className="text-sm font-medium text-slate-700">
                        {p.admissionDate ? new Date(p.admissionDate).toLocaleDateString("en-IN") : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={() => router.push(`/nurse/vitals?ipId=${p.ipId || p._id}`)}
                      className="nurse-btn-primary text-xs px-3 py-1.5 font-medium"
                    >
                      Record Vitals
                    </button>
                    <button
                      onClick={() => router.push(`/nurse/medications?ipId=${p.ipId || p._id}`)}
                      className="text-xs border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                      Medications
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </NurseLayout>
  );
}

