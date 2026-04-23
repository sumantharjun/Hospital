"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import NurseLayout from "../../../components/NurseLayout";
import { buildApiUrl, getAuthHeaders } from "../../../lib/api";

const SHIFT_SERVICES = [
  "Vital signs monitoring", "Medication administration", "Wound dressing", "IV cannula care",
  "Catheter care", "Bed bath", "Oral hygiene", "Patient repositioning", "Blood sample collection",
  "ECG monitoring", "Oxygen therapy", "Nebulization", "Patient education", "Discharge preparation",
];

export default function NewTimesheetPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeNurses, setActiveNurses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ipAdmissions, setIpAdmissions] = useState([]);
  const [opRegistrations, setOpRegistrations] = useState([]);
  const [serviceRegs, setServiceRegs] = useState([]);

  const [form, setForm] = useState({
    patientCategory: "IP",
    patientCategoryId: "",
    patientId: "",
    date: new Date().toISOString().split("T")[0],
    shiftType: "DAY",
    department: "",
    checkIn: new Date().toISOString().slice(0, 16),
    checkOut: "",
    handoverTo: "",
    handoverNotes: "",
    handoverChecklist: { vitals: false, medicationPending: false, labPending: false, observations: false, specialInstructions: false },
    servicesProvided: [],
    medicationAdministered: "",
    vitalsRecorded: { bp: "", pulse: "", temperature: "", spo2: "", notes: "" },
    observations: "",
    emergencyFlag: false,
    emergencyDetails: "",
    hospitalId: "",
  });

  useEffect(() => {
    const u = localStorage.getItem("nurseUser");
    const t = localStorage.getItem("token");
    if (!u || !t) { router.replace("/"); return; }
    const parsedUser = JSON.parse(u);
    setUser(parsedUser);
    setForm(p => ({ ...p, department: parsedUser.department || "", hospitalId: parsedUser.hospitalId || "" }));
    fetchSupportingData(parsedUser);
  }, [router]);

  const fetchSupportingData = async (u) => {
    const headers = getAuthHeaders();
    const [nursesRes, ipRes, opRes] = await Promise.all([
      fetch(buildApiUrl(`/api/nurse/active-nurses${u.hospitalId ? `?hospitalId=${u.hospitalId}` : ""}`), { headers }),
      fetch(buildApiUrl("/api/ip-admissions?status=ADMITTED"), { headers }),
      fetch(buildApiUrl("/api/op-registrations?consultationStatus=WAITING"), { headers }),
    ]);
    setActiveNurses(nursesRes.ok ? await nursesRes.json() : []);
    setIpAdmissions(ipRes.ok ? await ipRes.json() : []);
    setOpRegistrations(opRes.ok ? await opRes.json() : []);
  };

  const toggleService = (svc) => {
    setForm(p => ({
      ...p,
      servicesProvided: p.servicesProvided.includes(svc)
        ? p.servicesProvided.filter(s => s !== svc)
        : [...p.servicesProvided, svc],
    }));
  };

  const getPatientOptions = () => {
    if (form.patientCategory === "IP") return ipAdmissions;
    if (form.patientCategory === "OP") return opRegistrations;
    return serviceRegs;
  };

  const selectPatientRecord = (record) => {
    const id = form.patientCategory === "IP" ? record.ipId : form.patientCategory === "OP" ? record.opId : record.serviceRegId;
    const patientId = record.patientId?._id || record.patientId;
    setForm(p => ({ ...p, patientCategoryId: id, patientId }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patientCategoryId) { toast.error("Select a patient record"); return; }
    if (!form.shiftType) { toast.error("Select shift type"); return; }
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/nurse/timesheets"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          ...form,
          nurseName: user.name,
          checkOut: form.checkOut || null,
          handoverTo: form.handoverTo || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to submit");
      toast.success("Timesheet submitted successfully!");
      router.push("/nurse/timesheet");
    } catch (err) {
      toast.error(err.message || "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <NurseLayout>
      <div className="nurse-page space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">Back</button>
          <h1 className="text-2xl font-bold text-slate-900">New Timesheet Entry</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="nurse-card p-4 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Patient Information</h2>
            <div>
              <label className="text-xs font-medium text-slate-600">Patient Category *</label>
              <div className="flex gap-2 mt-1">
                {["IP", "OP", "SERVICES"].map(cat => (
                  <button key={cat} type="button" onClick={() => setForm(p => ({ ...p, patientCategory: cat, patientCategoryId: "", patientId: "" }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border ${form.patientCategory === cat ? "bg-teal-600 text-white border-teal-600" : "border-slate-200 text-slate-600"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Patient Record ID *</label>
              <select required className="nurse-input mt-1"
                value={form.patientCategoryId}
                onChange={e => {
                  const rec = getPatientOptions().find(r => (r.ipId || r.opId || r.serviceRegId) === e.target.value);
                  if (rec) selectPatientRecord(rec);
                }}>
                <option value="">Select {form.patientCategory} record</option>
                {getPatientOptions().map(r => {
                  const id = r.ipId || r.opId || r.serviceRegId;
                  const name = r.patientId?.name || "Unknown";
                  return <option key={id} value={id}>{id} - {name}</option>;
                })}
              </select>
              {getPatientOptions().length === 0 && (
                <p className="text-xs text-slate-400 mt-1">No active {form.patientCategory} records found.</p>
              )}
            </div>
          </div>

          <div className="nurse-card p-4 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Shift Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Date *</label>
                <input required type="date" className="nurse-input mt-1"
                  value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Shift Type *</label>
                <div className="flex gap-2 mt-1">
                  {["DAY", "NIGHT"].map(s => (
                    <button key={s} type="button" onClick={() => setForm(p => ({ ...p, shiftType: s }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border ${form.shiftType === s ? (s === "DAY" ? "bg-yellow-500 text-white border-yellow-500" : "bg-blue-600 text-white border-blue-600") : "border-slate-200 text-slate-600"}`}>
                      {s === "DAY" ? "Day" : "Night"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Check In *</label>
                <input required type="datetime-local" className="nurse-input mt-1"
                  value={form.checkIn} onChange={e => setForm(p => ({ ...p, checkIn: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Check Out</label>
                <input type="datetime-local" className="nurse-input mt-1"
                  value={form.checkOut} onChange={e => setForm(p => ({ ...p, checkOut: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Department</label>
              <input type="text" className="nurse-input mt-1"
                value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
            </div>
          </div>

          <div className="nurse-card p-4 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Vitals Recorded</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[["bp", "BP"], ["pulse", "Pulse"], ["temperature", "Temp (C)"], ["spo2", "SpO2 (%)"]].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-slate-600">{label}</label>
                  <input type="text" className="nurse-input mt-1"
                    placeholder="-"
                    value={form.vitalsRecorded[key]} onChange={e => setForm(p => ({ ...p, vitalsRecorded: { ...p.vitalsRecorded, [key]: e.target.value } }))} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Vitals Notes</label>
              <input type="text" className="nurse-input mt-1"
                value={form.vitalsRecorded.notes} onChange={e => setForm(p => ({ ...p, vitalsRecorded: { ...p.vitalsRecorded, notes: e.target.value } }))} />
            </div>
          </div>

          <div className="nurse-card p-4 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Services Provided</h2>
            <div className="flex flex-wrap gap-2">
              {SHIFT_SERVICES.map(svc => (
                <button key={svc} type="button" onClick={() => toggleService(svc)}
                  className={`px-2 py-1 rounded-lg text-xs border transition-colors ${form.servicesProvided.includes(svc) ? "bg-teal-600 text-white border-teal-600" : "border-slate-200 text-slate-600 hover:border-green-400"}`}>
                  {svc}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Medications Administered</label>
              <input type="text" className="nurse-input mt-1"
                placeholder="e.g. Tab Paracetamol 500mg, Inj Tramadol 50mg..."
                value={form.medicationAdministered} onChange={e => setForm(p => ({ ...p, medicationAdministered: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Observations & Notes</label>
              <textarea rows={3} className="nurse-input mt-1"
                placeholder="Any clinical observations, patient complaints, etc."
                value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} />
            </div>
          </div>

          <div className="nurse-card p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.emergencyFlag} onChange={e => setForm(p => ({ ...p, emergencyFlag: e.target.checked }))} />
              <span className="font-semibold text-red-600 text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Emergency / Escalation Flag
              </span>
            </label>
            {form.emergencyFlag && (
              <div>
                <label className="text-xs font-medium text-slate-600">Emergency Details *</label>
                <textarea required rows={2} className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder="Describe the emergency..."
                  value={form.emergencyDetails} onChange={e => setForm(p => ({ ...p, emergencyDetails: e.target.value }))} />
              </div>
            )}
          </div>

          <div className="nurse-card p-4 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Handover Details</h2>
            <div>
              <label className="text-xs font-medium text-slate-600">Handover To</label>
              <select className="nurse-input mt-1"
                value={form.handoverTo} onChange={e => setForm(p => ({ ...p, handoverTo: e.target.value }))}>
                <option value="">No Handover</option>
                {activeNurses.filter(n => n._id !== user?._id).map(n => (
                  <option key={n._id} value={n._id}>{n.name} ({n.department || "Nursing"})</option>
                ))}
              </select>
            </div>
            {form.handoverTo && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-600">Handover Notes</label>
                  <textarea rows={2} className="nurse-input mt-1"
                    value={form.handoverNotes} onChange={e => setForm(p => ({ ...p, handoverNotes: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">Handover Checklist</label>
                  <div className="space-y-2">
                    {[
                      ["vitals", "Vitals communicated"],
                      ["medicationPending", "Pending medications informed"],
                      ["labPending", "Pending lab results shared"],
                      ["observations", "Observations documented"],
                      ["specialInstructions", "Special instructions given"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={form.handoverChecklist[key]}
                          onChange={e => setForm(p => ({ ...p, handoverChecklist: { ...p.handoverChecklist, [key]: e.target.checked } }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button type="submit" disabled={loading} className="nurse-btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50">
            {loading ? "Submitting..." : "Submit Timesheet"}
          </button>
        </form>
      </div>
    </NurseLayout>
  );
}

