"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, apiFetch, NETWORK_ERROR_MESSAGE } from "../../lib/api";
import { LoadingOverlay } from "../../components/LoadingSpinner";

export default function HistoryPage() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [patRes, aptRes, docRes] = await Promise.all([
        apiFetch(buildApiUrl("/api/users?role=PATIENT"), { headers }),
        apiFetch(buildApiUrl("/api/appointments"), { headers }),
        apiFetch(buildApiUrl("/api/users?role=DOCTOR"), { headers }),
      ]);
      const pats = patRes.ok ? await patRes.json() : [];
      const apts = aptRes.ok ? await aptRes.json() : [];
      const docs = docRes.ok ? await docRes.json() : [];
      setPatients(Array.isArray(pats) ? pats : []);
      setAppointments(Array.isArray(apts) ? apts : []);
      setDoctors(Array.isArray(docs) ? docs : []);
    } catch (e) {
      toast.error(e?.message === "BACKEND_UNREACHABLE" ? NETWORK_ERROR_MESSAGE : (e?.message || "Failed to load data"));
    } finally {
      setLoading(false);
    }
  }

  const getDoctorName = (id) => doctors.find((d) => (d._id || d.id) === id)?.name || "—";

  const patientVisits = selectedPatient
    ? (appointments || [])
        .filter((a) => a.patientId === (selectedPatient._id || selectedPatient.id))
        .sort((a, b) => new Date(b.scheduledAt || b.appointmentDate) - new Date(a.scheduledAt || a.appointmentDate))
    : [];

  function doSearch() {
    const q = searchId.trim().toLowerCase();
    if (!q) {
      setSelectedPatient(null);
      return;
    }
    const byPhone = patients.find((p) => (p.phone || p.mobile || "").toString().replace(/\D/g, "").includes(q.replace(/\D/g, "")));
    const byName = patients.find((p) => (p.name || "").toLowerCase().includes(q));
    const byId = patients.find((p) => (p._id || p.id || "").toString().toLowerCase().includes(q));
    const found = byPhone || byName || byId || null;
    setSelectedPatient(found);
    found ? toast.success(`Found: ${found.name}`) : toast.error("No patient found.");
  }

  async function deleteAppointment(aptId) {
    if (!aptId) return;
    if (!confirm("Are you sure you want to delete this appointment? This cannot be undone.")) return;
    try {
      const res = await fetch(buildApiUrl(`/api/appointments/${aptId}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete");
      toast.success("Appointment deleted.");
      fetchData();
    } catch (e) {
      toast.error(e.message || "Failed to delete appointment");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">Patient history</h1>
          <p className="mt-1 text-sm text-[#4a5568]">Search by mobile, name or patient ID to view visit history.</p>
        </div>
      </div>

      <div className="gov-card p-4">
        <label className="block text-sm font-semibold text-[#2d3748] mb-2">Search by mobile, name or patient ID</label>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="e.g. 9876543210 or patient name"
            className="gov-input flex-1 min-w-[200px] bg-white px-4 py-2 text-[#1a202c]"
          />
          <button type="button" onClick={doSearch} className="gov-btn-primary px-5 py-2.5">
            Search
          </button>
        </div>
      </div>

      {loading && (
        <LoadingOverlay text="Loading history…" />
      )}

      {!loading && searchId && !selectedPatient && (
        <div className="gov-card p-6 text-center text-[#718096]">Enter a search term and click Search to find a patient.</div>
      )}

      {!loading && selectedPatient && (
        <div className="space-y-4">
          <div className="gov-card p-4 border-l-4 border-[#0d47a1] flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#1a202c] text-lg">{selectedPatient.name}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#4a5568]">
                <span>{selectedPatient.phone || selectedPatient.mobile || "—"} (phone)</span>
                {selectedPatient.age != null && selectedPatient.age !== "" && <span>Age: {selectedPatient.age} yrs</span>}
                {selectedPatient.gender && <span>{selectedPatient.gender}</span>}
                {selectedPatient.bloodGroup && <span>Blood: {selectedPatient.bloodGroup}</span>}
                <span className="text-[#718096]">ID: {(selectedPatient._id || selectedPatient.id || "").slice(-8)}</span>
                <span className="text-[#0d47a1] font-medium">{patientVisits.length} visit(s)</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedPatient(null); setSearchId(""); setMessage({ type: "", text: "" }); }}
              className="border border-[#cbd5e0] px-3 py-1.5 text-sm font-medium text-[#2d3748] bg-white hover:bg-[#f8fafc] rounded"
            >
              Clear & search another
            </button>
          </div>

          <div className="gov-card overflow-hidden">
            <div className="p-4 border-b border-[#cbd5e0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#1a202c]">Visit history</h3>
                <p className="text-sm text-[#4a5568]">Past and upcoming appointments. Delete only PENDING, SCHEDULED or CANCELLED.</p>
              </div>
              <button type="button" onClick={() => fetchData()} className="border border-[#0d47a1] text-[#0d47a1] px-3 py-1.5 text-sm font-medium hover:bg-[#e3f2fd] rounded">
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              {patientVisits.length === 0 ? (
                <div className="p-8 text-center text-[#718096]">No visits found for this patient.</div>
              ) : (
                <table className="gov-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Doctor</th>
                      <th>Token</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Issue</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientVisits.slice(0, 50).map((a) => {
                      const status = (a.status || "").toUpperCase();
                      const canDelete = status === "PENDING" || status === "SCHEDULED" || status === "CANCELLED";
                      const d = a.scheduledAt || a.appointmentDate;
                      const dateStr = d ? new Date(d).toLocaleDateString("en-IN") : "—";
                      const timeStr = d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
                      return (
                        <tr key={a._id || a.id} className={a.isEmergency ? "bg-red-50" : ""}>
                          <td className="text-[#4a5568]">{dateStr}</td>
                          <td className="text-[#4a5568]">{timeStr}</td>
                          <td className="text-[#1a202c]">Dr. {getDoctorName(a.doctorId)}</td>
                          <td className="font-mono text-[#4a5568]">{a.tokenNumber != null ? `#${a.tokenNumber}` : "—"}</td>
                          <td>
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${a.isEmergency ? "bg-red-50 text-red-800 border-red-600" : "bg-[#f8fafc] text-[#2d3748] border-[#cbd5e0]"}`}>
                              {a.isEmergency ? "Emergency" : (a.appointmentType || "Walk-in")}
                            </span>
                          </td>
                          <td className="text-[#4a5568]">{status || "—"}</td>
                          <td className="text-[#4a5568] text-sm max-w-[140px] truncate" title={a.issue || ""}>{a.issue || "—"}</td>
                          <td>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => deleteAppointment(a._id || a.id)}
                                className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-300 hover:bg-red-100"
                                title="Delete appointment"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {patientVisits.length > 50 && (
              <div className="p-2 text-center text-sm text-[#718096] border-t border-[#e2e8f0]">Showing latest 50 visits.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
