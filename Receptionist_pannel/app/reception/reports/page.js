"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, HOSPITALS_PATH } from "../../lib/api";
import { todayStr } from "../../lib/receptionUtils";
import { LoadingOverlay } from "../../components/LoadingSpinner";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [date, setDate] = useState(todayStr());
  const [reportType, setReportType] = useState("today"); // today | doctor | hospital

  async function fetchData() {
    setLoading(true);
    const headers = getAuthHeaders();
    try {
      const [a, d, h] = await Promise.all([
        fetch(buildApiUrl("/api/appointments"), { headers }),
        fetch(buildApiUrl("/api/users?role=DOCTOR"), { headers }),
        fetch(buildApiUrl(HOSPITALS_PATH), { headers }),
      ]);
      const [apts, docs, hosps] = await Promise.all([a.json(), d.json(), h.json()]);
      setAppointments(Array.isArray(apts) ? apts : []);
      setDoctors(Array.isArray(docs) ? docs : []);
      setHospitals(Array.isArray(hosps) ? hosps : []);
    } catch (e) {
      toast.error("Failed to load reports");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    fetchData();
  }, []);

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
      fetchData();
    } catch (e) {
      toast.error(e?.message || "Failed to delete");
    }
  }

  const dateApts = (appointments || []).filter((a) => {
    const d = a.appointmentDate || a.scheduledAt;
    const aptDate = d ? new Date(d).toISOString().split("T")[0] : "";
    return aptDate === date;
  });

  const byDoctor = dateApts.reduce((acc, a) => {
    const id = a.doctorId || "unknown";
    if (!acc[id]) acc[id] = { count: 0, completed: 0 };
    acc[id].count++;
    if ((a.status || "").toUpperCase() === "COMPLETED") acc[id].completed++;
    return acc;
  }, {});

  const byHospital = dateApts.reduce((acc, a) => {
    const id = a.hospitalId || a.hospital || "unknown";
    if (!acc[id]) acc[id] = { count: 0 };
    acc[id].count++;
    return acc;
  }, {});

  const getDoctorName = (id) => doctors.find((d) => (d._id || d.id) === id)?.name || id;
  const getHospitalName = (id) => hospitals.find((h) => (h._id || h.id) === id)?.name || id;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Reports</h1>
        <LoadingOverlay text="Loading reports…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Reports</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Today&apos;s patient list, doctor-wise and hospital-wise collection</p>
        </div>
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">View</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50">
              <option value="today">Today&apos;s patient list</option>
              <option value="doctor">Doctor-wise</option>
              <option value="hospital">Hospital-wise</option>
            </select>
          </div>
        </div>
      </div>

      {reportType === "today" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50 border-b border-zinc-200 dark:border-zinc-700">Patient list — {date}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Token</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {dateApts.sort((a, b) => (a.tokenNumber || 0) - (b.tokenNumber || 0)).map((a) => {
                  const status = (a.status || "").toUpperCase();
                  const canDelete = status === "PENDING" || status === "SCHEDULED" || status === "CANCELLED";
                  return (
                    <tr key={a._id || a.id}>
                      <td className="px-4 py-3 font-mono text-sm text-zinc-900 dark:text-zinc-50">{a.tokenNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString() : "—"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{a.status || "—"}</td>
                      <td className="px-4 py-3">
                        {canDelete && (
                          <button type="button" onClick={() => deleteAppointment(a._id || a.id)} className="text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 hover:bg-red-100" title="Delete appointment">Delete</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {dateApts.length === 0 && <p className="p-6 text-zinc-500 text-sm">No appointments for this date.</p>}
        </div>
      )}

      {reportType === "doctor" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50 border-b border-zinc-200 dark:border-zinc-700">Doctor-wise — {date}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Doctor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {Object.entries(byDoctor).map(([id, v]) => (
                  <tr key={id}>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">Dr. {getDoctorName(id)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{v.count}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{v.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.keys(byDoctor).length === 0 && <p className="p-6 text-zinc-500 text-sm">No data for this date.</p>}
        </div>
      )}

      {reportType === "hospital" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50 border-b border-zinc-200 dark:border-zinc-700">Hospital-wise — {date}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Hospital</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Patients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {Object.entries(byHospital).map(([id, v]) => (
                  <tr key={id}>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">{getHospitalName(id)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{v.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.keys(byHospital).length === 0 && <p className="p-6 text-zinc-500 text-sm">No data for this date.</p>}
        </div>
      )}
    </div>
  );
}
