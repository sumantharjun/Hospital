"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";
import {
  AlertIcon,
  RefreshIcon,
  CheckIcon,
  PrintIcon,
  BedIcon,
  StethoscopeIcon,
} from "../../components/ReceptionIcons";

const TRIAGE_LEVELS = [
  { key: "CRITICAL",   label: "Critical",    desc: "Life-threatening",          bg: "bg-red-600",    border: "border-red-600",    text: "text-white",        badge: "bg-red-100 text-red-800 border-red-300"  },
  { key: "URGENT",     label: "Urgent",      desc: "Could deteriorate quickly", bg: "bg-orange-500", border: "border-orange-500", text: "text-white",        badge: "bg-orange-100 text-orange-800 border-orange-300"},
  { key: "SEMI_URGENT",label: "Semi-Urgent", desc: "Needs attention soon",      bg: "bg-yellow-400", border: "border-yellow-400", text: "text-yellow-900",   badge: "bg-yellow-100 text-yellow-800 border-yellow-300"},
  { key: "NON_URGENT", label: "Non-Urgent",  desc: "Can wait safely",           bg: "bg-green-500",  border: "border-green-500",  text: "text-white",        badge: "bg-green-100 text-green-800 border-green-300"  },
];

const STEPS = ["Triage", "Patient Details", "Assign & Submit"];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                i < current
                  ? "bg-[#0d47a1] border-[#0d47a1] text-white"
                  : i === current
                  ? "bg-white border-[#0d47a1] text-[#0d47a1]"
                  : "bg-white border-[#cbd5e0] text-[#718096]"
              }`}
            >
              {i < current ? <CheckIcon className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${
                i === current ? "text-[#0d47a1]" : "text-[#718096]"
              }`}
            >
              {s}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 mx-2 ${i < current ? "bg-[#0d47a1]" : "bg-[#cbd5e0]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function EmergencyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [doctors, setDoctors] = useState([]);
  const [availableBeds, setAvailableBeds] = useState([]);
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [emergencyCount, setEmergencyCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { ipId, patientName }

  // Form state
  const [triageLevel, setTriageLevel] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [bedId, setBedId] = useState("");
  const [notes, setNotes] = useState("");

  const fetchSupportData = useCallback(async () => {
    const headers = getAuthHeaders();
    try {
      const [docRes, bedRes, emRes] = await Promise.all([
        fetch(buildApiUrl("/api/users?role=DOCTOR"), { headers }),
        fetch(buildApiUrl("/api/infrastructure/beds?status=AVAILABLE"), { headers }),
        fetch(buildApiUrl("/api/ip-admissions?emergencyFlag=true"), { headers }),
      ]);
      if (docRes.ok) {
        const d = await docRes.json();
        setDoctors(Array.isArray(d) ? d : []);
      }
      if (bedRes.ok) {
        const b = await bedRes.json();
        const bedList = Array.isArray(b) ? b : b.beds || [];
        setAvailableBeds(bedList.filter((bed) => (bed.status || "").toUpperCase() === "AVAILABLE"));
      }
      if (emRes.ok) {
        const em = await emRes.json();
        const list = Array.isArray(em) ? em : em.admissions || [];
        const sorted = [...list].sort(
          (a, b) => new Date(b.admissionDate || b.createdAt) - new Date(a.admissionDate || a.createdAt)
        );
        setActiveEmergencies(sorted.slice(0, 10));
        setEmergencyCount(list.length);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchSupportData();
  }, [fetchSupportData]);

  function resetForm() {
    setStep(0);
    setTriageLevel("");
    setChiefComplaint("");
    setPatientName("");
    setAge("");
    setGender("");
    setPhone("");
    setConditions("");
    setAllergies("");
    setDoctorId("");
    setBedId("");
    setNotes("");
    setSuccess(null);
  }

  async function handleSubmit() {
    if (!triageLevel) { toast.error("Select triage level"); return; }
    if (!patientName.trim()) { toast.error("Patient name is required"); return; }
    if (!age) { toast.error("Age is required"); return; }
    if (!gender) { toast.error("Gender is required"); return; }

    setSubmitting(true);
    try {
      const res = await fetch(buildApiUrl("/api/ip-admissions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          emergencyFlag: true,
          casualtyFlag: true,
          patientName: patientName.trim(),
          age: parseInt(age, 10),
          gender,
          phone: phone.trim() || undefined,
          chiefComplaint: chiefComplaint.trim(),
          triageLevel,
          doctorId: doctorId || undefined,
          bedId: bedId || undefined,
          notes: notes.trim() || undefined,
          admissionDate: new Date().toISOString(),
          knownConditions: conditions.trim() || undefined,
          allergies: allergies.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Submission failed");
      }
      const data = await res.json();
      const ipId =
        data.ipId ||
        data.admissionId ||
        data.admissionNumber ||
        data._id ||
        data.id ||
        "GENERATED";
      setSuccess({ ipId, patientName: patientName.trim() });
      fetchSupportData();
      toast.success("Emergency patient registered successfully");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function printConfirmation(ipId, name) {
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Emergency Admission</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto}
    h1{color:#c62828;font-size:20px}h2{font-size:14px;color:#333}.field{margin:8px 0;font-size:13px}
    .label{font-weight:600;color:#555}.badge{display:inline-block;padding:4px 12px;background:#c62828;
    color:#fff;border-radius:4px;font-size:12px;font-weight:700;letter-spacing:1px}
    .ipid{font-size:36px;font-weight:900;color:#c62828;margin:16px 0}hr{border:1px solid #eee;margin:16px 0}
    </style></head><body>
    <div class="badge">EMERGENCY ADMISSION</div>
    <div class="ipid">${ipId}</div>
    <hr/>
    <div class="field"><span class="label">Patient:</span> ${name}</div>
    <div class="field"><span class="label">Triage Level:</span> ${triageLevel}</div>
    <div class="field"><span class="label">Chief Complaint:</span> ${chiefComplaint}</div>
    <div class="field"><span class="label">Age/Gender:</span> ${age} / ${gender}</div>
    <div class="field"><span class="label">Phone:</span> ${phone || "—"}</div>
    <div class="field"><span class="label">Admitted:</span> ${new Date().toLocaleString("en-IN")}</div>
    <script>window.print();window.close();<\/script></body></html>`);
    win.document.close();
  }

  const selectedTriage = TRIAGE_LEVELS.find((t) => t.key === triageLevel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight flex items-center gap-2">
              <AlertIcon className="w-5 h-5 text-red-600" />
              Emergency Quick Intake
            </h1>
            <p className="text-sm text-[#4a5568] mt-0.5">
              Fast triage registration for emergency patients
            </p>
          </div>
          {emergencyCount > 0 && (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold shrink-0">
              {emergencyCount}
            </span>
          )}
        </div>
        <button
          onClick={fetchSupportData}
          className="flex items-center gap-1.5 border border-[#cbd5e0] bg-white text-[#2d3748] px-3 py-2 text-sm rounded-sm hover:bg-[#e2e8f0] transition-colors"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Success State */}
      {success ? (
        <div className="gov-card p-8 text-center border-t-4 border-green-500">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckIcon className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-[#1a202c] mb-1">Patient Registered</h2>
          <p className="text-sm text-[#4a5568] mb-4">
            Emergency admission created for{" "}
            <strong>{success.patientName}</strong>
          </p>
          <div className="inline-block bg-red-50 border-2 border-red-300 rounded-sm px-8 py-4 mb-6">
            <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
              IP Admission ID
            </div>
            <div className="text-3xl font-black text-red-700">{success.ipId}</div>
          </div>
          <div className="flex justify-center gap-3 flex-wrap">
            <button
              onClick={() => printConfirmation(success.ipId, success.patientName)}
              className="flex items-center gap-2 bg-[#0d47a1] text-white px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-[#0a3d91] transition-colors"
            >
              <PrintIcon className="w-4 h-4" />
              Print Admission Slip
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 border border-[#cbd5e0] bg-white text-[#2d3748] px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-[#e2e8f0] transition-colors"
            >
              New Emergency
            </button>
          </div>
        </div>
      ) : (
        /* Intake Form */
        <div className="gov-card">
          <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-semibold text-[#1a202c]">Emergency Registration</h2>
            <StepIndicator current={step} />
          </div>

          <div className="p-5 space-y-5">
            {/* Step 0: Triage */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-3">
                    Select Triage Level *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TRIAGE_LEVELS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTriageLevel(t.key)}
                        className={`rounded-sm border-2 p-4 text-center transition-all ${
                          triageLevel === t.key
                            ? `${t.bg} ${t.border} ${t.text} shadow-md scale-[1.02]`
                            : `bg-white border-[#e2e8f0] text-[#4a5568] hover:border-gray-400`
                        }`}
                      >
                        <div className="font-bold text-sm">{t.label}</div>
                        <div className="text-[11px] mt-1 opacity-80">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                    Chief Complaint *
                  </label>
                  <textarea
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    rows={3}
                    placeholder="Describe the presenting complaint..."
                    className="w-full border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm text-[#1a202c] focus:outline-none focus:ring-2 focus:ring-[#0d47a1]/30 focus:border-[#0d47a1] resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (!triageLevel) { toast.error("Please select a triage level"); return; }
                      setStep(1);
                    }}
                    className="bg-[#0d47a1] text-white px-6 py-2.5 rounded-sm text-sm font-medium hover:bg-[#0a3d91] transition-colors"
                  >
                    Next: Patient Details
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Patient Details */}
            {step === 1 && (
              <div className="space-y-5">
                {selectedTriage && (
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${selectedTriage.badge}`}>
                    <AlertIcon className="w-3.5 h-3.5" />
                    Triage: {selectedTriage.label}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                      Patient Name *
                    </label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Full name"
                      className="w-full border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm text-[#1a202c] focus:outline-none focus:ring-2 focus:ring-[#0d47a1]/30 focus:border-[#0d47a1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                      Age *
                    </label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="Age in years"
                      min="0"
                      max="150"
                      className="w-full border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm text-[#1a202c] focus:outline-none focus:ring-2 focus:ring-[#0d47a1]/30 focus:border-[#0d47a1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                      Gender *
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="gov-select w-full"
                    >
                      <option value="">Select gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Contact number"
                      className="w-full border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm text-[#1a202c] focus:outline-none focus:ring-2 focus:ring-[#0d47a1]/30 focus:border-[#0d47a1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                      Known Conditions
                    </label>
                    <input
                      type="text"
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                      placeholder="Diabetes, hypertension..."
                      className="w-full border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm text-[#1a202c] focus:outline-none focus:ring-2 focus:ring-[#0d47a1]/30 focus:border-[#0d47a1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                      Allergies
                    </label>
                    <input
                      type="text"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="Penicillin, sulfa drugs..."
                      className="w-full border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm text-[#1a202c] focus:outline-none focus:ring-2 focus:ring-[#0d47a1]/30 focus:border-[#0d47a1]"
                    />
                  </div>
                </div>
                <div className="flex justify-between gap-3">
                  <button
                    onClick={() => setStep(0)}
                    className="border border-[#cbd5e0] text-[#4a5568] px-4 py-2.5 rounded-sm text-sm hover:bg-[#f5f7fa] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!patientName.trim()) { toast.error("Patient name is required"); return; }
                      if (!age) { toast.error("Age is required"); return; }
                      if (!gender) { toast.error("Gender is required"); return; }
                      setStep(2);
                    }}
                    className="bg-[#0d47a1] text-white px-6 py-2.5 rounded-sm text-sm font-medium hover:bg-[#0a3d91] transition-colors"
                  >
                    Next: Assign
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Assign & Submit */}
            {step === 2 && (
              <div className="space-y-5">
                {selectedTriage && (
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${selectedTriage.badge}`}>
                      <AlertIcon className="w-3 h-3" />
                      {selectedTriage.label}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#cbd5e0] text-xs text-[#4a5568] bg-[#f5f7fa]">
                      {patientName} | Age {age} | {gender}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                      Assign Doctor
                    </label>
                    <select
                      value={doctorId}
                      onChange={(e) => setDoctorId(e.target.value)}
                      className="gov-select w-full"
                    >
                      <option value="">Select doctor (optional)</option>
                      {doctors.map((d) => (
                        <option key={d._id || d.id} value={d._id || d.id}>
                          Dr. {d.name}{d.specialization ? ` — ${d.specialization}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                      Assign Bed
                    </label>
                    <select
                      value={bedId}
                      onChange={(e) => setBedId(e.target.value)}
                      className="gov-select w-full"
                    >
                      <option value="">Select bed (optional)</option>
                      {availableBeds.map((b) => (
                        <option key={b._id || b.id} value={b._id || b.id}>
                          Bed {b.bedNumber || b.number}
                          {b.roomId?.roomNumber ? ` — Room ${b.roomId.roomNumber}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#4a5568] uppercase tracking-wide mb-1.5">
                      Additional Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Any additional clinical notes..."
                      className="w-full border border-[#cbd5e0] rounded-sm px-3 py-2 text-sm text-[#1a202c] focus:outline-none focus:ring-2 focus:ring-[#0d47a1]/30 focus:border-[#0d47a1] resize-none"
                    />
                  </div>
                </div>
                <div className="flex justify-between gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="border border-[#cbd5e0] text-[#4a5568] px-4 py-2.5 rounded-sm text-sm hover:bg-[#f5f7fa] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-sm text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    <AlertIcon className="w-4 h-4" />
                    {submitting ? "Registering..." : "Register Emergency Patient"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Emergencies list */}
      <div className="gov-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between bg-red-50">
          <h2 className="font-semibold text-[#1a202c] text-sm flex items-center gap-2">
            <AlertIcon className="w-4 h-4 text-red-600" />
            Active Emergencies
          </h2>
          {emergencyCount > 0 && (
            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
              {emergencyCount} active
            </span>
          )}
        </div>
        {activeEmergencies.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-2">
              <CheckIcon className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-[#718096]">No active emergencies</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f5f7fa]">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#718096] uppercase">Patient</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#718096] uppercase">Triage</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#718096] uppercase hidden sm:table-cell">Complaint</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#718096] uppercase hidden md:table-cell">Admitted</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#718096] uppercase">IP ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {activeEmergencies.map((em) => {
                  const tCfg = TRIAGE_LEVELS.find((t) => t.key === em.triageLevel);
                  return (
                    <tr key={em._id || em.id} className="hover:bg-[#f5f7fa]">
                      <td className="px-4 py-3 font-medium text-[#2d3748]">
                        {em.patientName || em.patient?.name || "—"}
                        {em.age && <div className="text-xs text-[#718096]">Age {em.age}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {tCfg ? (
                          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-semibold ${tCfg.badge}`}>
                            {tCfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-[#718096]">{em.triageLevel || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#4a5568] text-xs hidden sm:table-cell max-w-[180px] truncate">
                        {em.chiefComplaint || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#718096] hidden md:table-cell">
                        {em.admissionDate || em.createdAt
                          ? new Date(em.admissionDate || em.createdAt).toLocaleString("en-IN", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#0d47a1] font-bold">
                        {em.ipId || em.admissionNumber || em._id?.slice(-6) || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
