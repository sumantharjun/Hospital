import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function NurseManagementPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [nurses, setNurses] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"nurses" | "timesheets">("nurses");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", department: "", shiftEligibility: "BOTH", hospitalId: "" });
  const [tsFilters, setTsFilters] = useState({ from: "", to: "", nurseId: "", shiftType: "", department: "" });
  const [selectedSheet, setSelectedSheet] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.replace("/"); return; }
    setToken(t);
    Promise.all([
      fetch(`${API_BASE}/api/users?role=NURSE`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/master/hospitals`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.ok ? r.json() : []),
    ]).then(([n, h]) => {
      setNurses(Array.isArray(n) ? n : []);
      const hList = Array.isArray(h) ? h : [];
      setHospitals(hList);
      if (hList.length > 0) setForm(p => ({ ...p, hospitalId: hList[0]._id }));
    }).finally(() => setLoading(false));
  }, [router]);

  const fetchTimesheets = async () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (tsFilters.from) params.append("from", tsFilters.from);
    if (tsFilters.to) params.append("to", tsFilters.to);
    if (tsFilters.nurseId) params.append("nurseId", tsFilters.nurseId);
    if (tsFilters.shiftType) params.append("shiftType", tsFilters.shiftType);
    if (tsFilters.department) params.append("department", tsFilters.department);

    try {
      const res = await fetch(`${API_BASE}/api/nurse/timesheets?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      setTimesheets(res.ok ? await res.json() : []);
    } catch { toast.error("Failed to fetch timesheets"); }
  };

  useEffect(() => { if (activeTab === "timesheets") fetchTimesheets(); }, [activeTab, token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, role: "NURSE" }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const created = await res.json();
      setNurses(p => [created, ...p]);
      setShowAddModal(false);
      toast.success("Nurse account created. Share login credentials.");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      setNurses(p => p.map(n => n._id === id ? { ...n, isActive: !isActive } : n));
      toast.success("Updated");
    } catch { toast.error("Failed"); }
  };

  const approveEdit = async (sheetId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/nurse/timesheets/${sheetId}/approve-edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();
      toast.success("Edit approved");
      fetchTimesheets();
    } catch { toast.error("Failed"); }
  };

  return (
        <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6 sm:mb-8"
        >
          <div className="medical-card bg-gradient-to-r from-white via-white to-blue-50/70 border border-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase mb-2">Management</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Nurse Management</h1>
                <p className="text-sm text-slate-600">Manage nurse accounts, shifts, and timesheets.</p>
              </div>
              {activeTab === "nurses" && (
                <button onClick={() => setShowAddModal(true)} className="px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm">
                  + Add Nurse
                </button>
              )}
            </div>
          </div>
        </motion.header>

        <div className="flex flex-wrap gap-2 mb-6">
          {(["nurses", "timesheets"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-full border transition ${activeTab === tab ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
              {tab === "timesheets" ? "Timesheet Logs" : "Nurses"}
            </button>
          ))}
        </div>

                {activeTab === "nurses" ? (
          loading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : (
            <div className="medical-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Shift</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {nurses.map(n => (
                    <tr key={n._id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{n.name}</td>
                      <td className="px-4 py-3 text-slate-500">{n.email}</td>
                      <td className="px-4 py-3">{n.department || "—"}</td>
                      <td className="px-4 py-3 text-xs">{n.shiftEligibility || "BOTH"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${n.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                          {n.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleActive(n._id, n.isActive)}
                          className={`text-xs ${n.isActive ? "text-red-500" : "text-green-600"} hover:underline`}
                        >
                          {n.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {nurses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">No nurses added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <input type="date" className="medical-input" value={tsFilters.from} onChange={e => setTsFilters(p => ({ ...p, from: e.target.value }))} />
              <input type="date" className="medical-input" value={tsFilters.to} onChange={e => setTsFilters(p => ({ ...p, to: e.target.value }))} />
              <select className="medical-input" value={tsFilters.nurseId} onChange={e => setTsFilters(p => ({ ...p, nurseId: e.target.value }))}>
                <option value="">All Nurses</option>
                {nurses.map(n => <option key={n._id} value={n._id}>{n.name}</option>)}
              </select>
              <select className="medical-input" value={tsFilters.shiftType} onChange={e => setTsFilters(p => ({ ...p, shiftType: e.target.value }))}>
                <option value="">All Shifts</option>
                <option value="DAY">Day</option>
                <option value="NIGHT">Night</option>
              </select>
              <button onClick={fetchTimesheets} className="medical-btn-primary">Search</button>
            </div>

            <div className="medical-card p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium">Nurse</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Shift</th>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Emergency</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map(s => (
                    <tr key={s._id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedSheet(s)}>
                      <td className="px-4 py-3 font-medium">{s.nurseId?.name || s.nurseName}</td>
                      <td className="px-4 py-3 text-slate-500">{s.date ? new Date(s.date).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${s.shiftType === "DAY" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>{s.shiftType}</span>
                      </td>
                      <td className="px-4 py-3">{s.patientId?.name || "—"}</td>
                      <td className="px-4 py-3 text-xs">{s.patientCategory} · {s.patientCategoryId}</td>
                      <td className="px-4 py-3">
                        {s.emergencyFlag ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">YES</span> : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${s.status === "SUBMITTED" ? "bg-green-100 text-green-700" : s.status === "EDIT_REQUESTED" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 space-x-2">
                        {s.status === "SUBMITTED" && (
                          <button onClick={e => { e.stopPropagation(); approveEdit(s._id); }} className="text-xs text-orange-600 hover:underline">Allow Edit</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {timesheets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500">No timesheets found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

                {/* Timesheet detail modal */}
        {selectedSheet && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold">Timesheet Details</h2>
                <button onClick={() => setSelectedSheet(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  ["Nurse", selectedSheet.nurseId?.name || selectedSheet.nurseName],
                  ["Date", selectedSheet.date ? new Date(selectedSheet.date).toLocaleDateString() : "—"],
                  ["Shift", selectedSheet.shiftType],
                  ["Department", selectedSheet.department],
                  ["Patient Category", `${selectedSheet.patientCategory} · ${selectedSheet.patientCategoryId}`],
                  ["Check In", selectedSheet.checkIn ? new Date(selectedSheet.checkIn).toLocaleString() : "—"],
                  ["Check Out", selectedSheet.checkOut ? new Date(selectedSheet.checkOut).toLocaleString() : "Ongoing"],
                  ["Handover To", selectedSheet.handoverToName || "—"],
                  ["Emergency", selectedSheet.emergencyFlag ? "YES" : "No"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
                {selectedSheet.vitalsRecorded && (
                  <div>
                    <div className="text-slate-500 mb-1">Vitals</div>
                    <div className="bg-slate-50 rounded p-2 text-xs space-y-1">
                      {Object.entries(selectedSheet.vitalsRecorded).map(([k, v]) => v ? <div key={k}><span className="font-medium">{k}:</span> {v as string}</div> : null)}
                    </div>
                  </div>
                )}
                {selectedSheet.observations && (
                  <div>
                    <div className="text-slate-500 mb-1">Observations</div>
                    <p className="text-xs bg-slate-50 rounded p-2">{selectedSheet.observations}</p>
                  </div>
                )}
                {selectedSheet.handoverNotes && (
                  <div>
                    <div className="text-slate-500 mb-1">Handover Notes</div>
                    <p className="text-xs bg-slate-50 rounded p-2">{selectedSheet.handoverNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Nurse Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold mb-4">Add Nurse</h2>
              <form onSubmit={handleAdd} className="space-y-3">
                {[["Full Name *", "name", "text"], ["Email *", "email", "email"], ["Password *", "password", "password"], ["Phone", "phone", "text"]].map(([label, key, type]) => (
                  <div key={key as string}>
                    <label className="text-xs font-medium text-gray-600">{label}</label>
                    <input type={type as string} required={label.includes("*")} className="medical-input w-full mt-1"
                      value={(form as any)[key as string]} onChange={e => setForm(p => ({ ...p, [key as string]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-gray-600">Department</label>
                  <input type="text" className="medical-input w-full mt-1"
                    value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Shift Eligibility</label>
                  <select className="medical-input w-full mt-1"
                    value={form.shiftEligibility} onChange={e => setForm(p => ({ ...p, shiftEligibility: e.target.value }))}>
                    <option value="DAY">Day Only</option>
                    <option value="NIGHT">Night Only</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Hospital</label>
                  <select className="medical-input w-full mt-1"
                    value={form.hospitalId} onChange={e => setForm(p => ({ ...p, hospitalId: e.target.value }))}>
                    {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 medical-btn-primary text-sm">
                    {saving ? "Creating..." : "Create Nurse Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
