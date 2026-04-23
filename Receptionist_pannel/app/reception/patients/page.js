"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, HOSPITALS_PATH } from "../../lib/api";
import { formatOpdNumber } from "../../lib/receptionUtils";
import SuccessModal from "../../components/SuccessModal";
import LoadingSpinner from "../../components/LoadingSpinner";

/** Normalize patient from API (supports age, gender, bloodGroup or blood_group, dob/dateOfBirth for age). */
function normalizePatient(p) {
  if (!p) return p;
  const dob = p.dob || p.dateOfBirth;
  let age = p.age;
  if (age == null && dob) {
    try {
      const birth = new Date(dob);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      }
    } catch (_) {}
  }
  return {
    ...p,
    age: age != null ? age : p.age,
    gender: p.gender,
    bloodGroup: p.bloodGroup || p.blood_group || "",
  };
}

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchMobile, setSearchMobile] = useState("");
  const [foundPatient, setFoundPatient] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editPatient, setEditPatient] = useState(null); // patient being edited
  const [editForm, setEditForm] = useState({ name: "", age: "", gender: "", bloodGroup: "", address: "", phone: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState({ open: false, title: "", message: "" });
  const [localDetails, setLocalDetails] = useState({});
  const [form, setForm] = useState({
    hospitalId: "",
    name: "",
    email: "",
    age: "",
    dob: "",
    gender: "",
    mobile: "",
    aadhaar: "",
    address: "",
    bloodGroup: "",
  });

  useEffect(() => {
    fetchPatients();
    fetchHospitals();
    setLocalDetails(getLocalPatientDetails());
  }, []);

  async function fetchHospitals() {
    try {
      const res = await fetch(buildApiUrl(HOSPITALS_PATH), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHospitals(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  }

  const PATIENT_DETAILS_KEY = "reception_patient_details";

  function getLocalPatientDetails() {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(PATIENT_DETAILS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function setLocalPatientDetails(id, details) {
    if (!id) return;
    const prev = getLocalPatientDetails();
    const next = { ...prev, [id]: { ...prev[id], ...details } };
    try {
      localStorage.setItem(PATIENT_DETAILS_KEY, JSON.stringify(next));
      setLocalDetails(next);
    } catch (_) {}
  }

  async function fetchPatients() {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/users?role=PATIENT"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.users)
            ? data.users
            : Array.isArray(data?.data)
              ? data.data
              : [];
        setPatients(list.map(normalizePatient));
      }
    } catch (e) {
      toast.error("Failed to load patients");
    } finally {
      setLoading(false);
    }
  }

  async function searchByMobile() {
    if (!searchMobile.trim()) return;
    setSearching(true);
    setFoundPatient(null);
    try {
      const normalized = searchMobile.replace(/\D/g, "");
      const aadhaarNorm = (form.aadhaar || "").replace(/\D/g, "");
      const match = patients.find((p) => {
        const ph = (p.phone || p.phoneNumber || p.mobile || "").replace(/\D/g, "");
        return (ph && (ph.slice(-10) === normalized.slice(-10) || ph.includes(normalized))) || (aadhaarNorm.length >= 4 && (p.aadhaar || "").replace(/\D/g, "").slice(-4) === aadhaarNorm.slice(-4));
      });
      setFoundPatient(match || null);
      match ? toast.success("Returning patient found.") : toast.info("No patient with this mobile/Aadhaar. You can add new.");
    } catch (e) {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function addPatient(e) {
    e.preventDefault();
    setSaving(true);
    const mobileNorm = (form.mobile || "").replace(/\D/g, "").slice(-10);
    const existingByMobile = patients.find((p) => (p.phone || p.mobile || "").replace(/\D/g, "").slice(-10) === mobileNorm);
    if (existingByMobile) {
      toast.error("Patient with this mobile already exists.");
      setSaving(false);
      return;
    }
    if (form.aadhaar && form.aadhaar.replace(/\D/g, "").length >= 4) {
      const aadhaarNorm = form.aadhaar.replace(/\D/g, "").slice(-4);
      if (patients.find((p) => (p.aadhaar || "").replace(/\D/g, "").slice(-4) === aadhaarNorm)) {
        toast.error("Patient with this Aadhaar already exists.");
        setSaving(false);
        return;
      }
    }
    try {
      const hospital = hospitals.find((h) => (h._id || h.id) === form.hospitalId);
      const hospitalCode = hospital?.branchCode || hospital?.name?.slice(0, 6).toUpperCase().replace(/\s/g, "") || "OPD";
      const tokenPart = String(patients.length + 1).padStart(3, "0");
      const opdNumber = formatOpdNumber(hospitalCode, "00", tokenPart);
      const customerEmail = (form.email || "").trim();
      const payload = {
        name: form.name.trim(),
        email: customerEmail || form.mobile.trim() + "@walkin.patient",
        password: form.mobile.trim().slice(-6) || "123456",
        role: "PATIENT",
        phone: form.mobile.trim(),
        age: form.age ? parseInt(form.age, 10) : undefined,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        address: form.address || undefined,
        bloodGroup: form.bloodGroup || undefined,
        aadhaar: form.aadhaar?.replace(/\D/g, "").slice(-4) ? form.aadhaar.replace(/\D/g, "").slice(0, 12) : undefined,
        hospitalId: form.hospitalId || undefined,
        opdNumber,
      };
      const res = await fetch(buildApiUrl("/api/users/signup"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to add patient");
      const createdId = data.user?._id || data.user?.id || data._id || data.id;
      if (createdId) {
        // Backend now saves and returns these fields; keep localStorage as fallback for older records
        const details = {
          age: data.user?.age ?? data.age ?? (form.age ? parseInt(form.age, 10) : undefined),
          gender: (data.user?.gender ?? data.gender ?? form.gender) || undefined,
          bloodGroup: (data.user?.bloodGroup ?? data.bloodGroup ?? data.user?.blood_group ?? form.bloodGroup) || undefined,
        };
        if (details.age != null || details.gender || details.bloodGroup) {
          setLocalPatientDetails(createdId, details);
        }
      }
      // Wait briefly so fetchPatients returns the freshly created record
      await new Promise((r) => setTimeout(r, 300));
      setSuccessModal({ open: true, title: "Patient added", message: `Patient registered successfully. OPD: ${opdNumber}` });
      toast.success(`Patient added. OPD: ${opdNumber}`);
      setShowAddModal(false);
      setForm({ hospitalId: "", name: "", email: "", age: "", dob: "", gender: "", mobile: "", aadhaar: "", address: "", bloodGroup: "" });
      fetchPatients();
    } catch (err) {
      toast.error(err.message || "Failed to add patient");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(p) {
    const id = p._id || p.id;
    const merged = { ...p, ...localDetails[id] };
    const np = normalizePatient(merged);
    setEditPatient(np);
    setEditForm({
      name: np.name || "",
      age: np.age != null ? String(np.age) : "",
      gender: np.gender || "",
      bloodGroup: np.bloodGroup || "",
      address: np.address || "",
      phone: np.phone || np.mobile || "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editPatient) return;
    const id = editPatient._id || editPatient.id;
    setEditSaving(true);
    try {
      const res = await fetch(buildApiUrl(`/api/users/${id}`), {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name || undefined,
          phone: editForm.phone || undefined,
          age: editForm.age ? parseInt(editForm.age, 10) : undefined,
          gender: editForm.gender || undefined,
          bloodGroup: editForm.bloodGroup || undefined,
          address: editForm.address || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update patient");
      // Also update localStorage as backup
      setLocalPatientDetails(id, {
        age: editForm.age ? parseInt(editForm.age, 10) : undefined,
        gender: editForm.gender || undefined,
        bloodGroup: editForm.bloodGroup || undefined,
      });
      toast.success("Patient updated successfully");
      setEditPatient(null);
      await new Promise((r) => setTimeout(r, 200));
      fetchPatients();
    } catch (err) {
      toast.error(err.message || "Failed to update patient");
    } finally {
      setEditSaving(false);
    }
  }

  async function deletePatient(id) {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this patient? This cannot be undone.")) return;
    try {
      const res = await fetch(buildApiUrl(`/api/users/${id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete patient");
      setSuccessModal({ open: true, title: "Patient deleted", message: "Patient has been removed successfully." });
      toast.success("Patient deleted");
      fetchPatients();
    } catch (err) {
      toast.error(err.message || "Failed to delete patient");
    }
  }

  const filteredList = searchMobile.trim()
    ? patients.filter((p) => (p.phone || p.phoneNumber || p.mobile || "").includes(searchMobile) || (p.name || "").toLowerCase().includes(searchMobile.toLowerCase()) || (p.email || "").toLowerCase().includes(searchMobile.toLowerCase()) || (p.aadhaar || "").includes(searchMobile))
    : patients;

  return (
    <div className="space-y-6">
      <SuccessModal open={successModal.open} title={successModal.title} message={successModal.message} onClose={() => setSuccessModal({ open: false, title: "", message: "" })} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">Patients</h1>
          <p className="mt-1 text-sm text-[#4a5568]">Register walk-in patients. Search by mobile or Aadhaar.</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} className="gov-btn-primary inline-flex items-center justify-center px-4 py-2.5">
          + Add patient
        </button>
      </div>
      <div className="gov-card p-4">
        <label className="block text-sm font-semibold text-[#2d3748]">Search by name, email, mobile or Aadhaar</label>
        <div className="mt-2 flex gap-2">
          <input type="text" value={searchMobile} onChange={(e) => setSearchMobile(e.target.value)} placeholder="e.g. 9876543210" className="gov-input flex-1 bg-white px-4 py-2 text-[#1a202c]" />
          <button type="button" onClick={searchByMobile} disabled={searching} className="border border-[#cbd5e0] bg-[#f8fafc] px-4 py-2 text-sm font-medium text-[#2d3748] hover:bg-[#e2e8f0] disabled:opacity-50">{searching ? "Searching…" : "Search"}</button>
        </div>
        {foundPatient && (
          <div className="mt-4 p-4 border border-[#0d47a1] bg-[#e3f2fd]">
            <p className="text-sm font-semibold text-[#0d47a1]">Returning patient</p>
            <p className="mt-1 text-[#2d3748]">{foundPatient.name} • {foundPatient.phone || foundPatient.mobile} • OPD: {foundPatient.opdNumber || foundPatient._id || foundPatient.id}</p>
          </div>
        )}
      </div>
      <div className="gov-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Blood group</th>
                <th>Address</th>
                <th>OPD / ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="text-center py-8"><div className="flex justify-center"><LoadingSpinner /></div><p className="mt-2 text-sm text-[#718096]">Loading patients…</p></td></tr> : filteredList.length === 0 ? <tr><td colSpan={9} className="text-center text-[#718096] py-8">No patients found.</td></tr> : filteredList.map((p) => {
                const id = p._id || p.id;
                const merged = { ...p, ...localDetails[id] };
                const np = normalizePatient(merged);
                return (
                <tr key={p._id || p.id}>
                  <td className="font-medium text-[#1a202c]">{np.name || "—"}</td>
                  <td className="text-[#4a5568] text-sm">{np.email || "—"}</td>
                  <td className="text-[#4a5568]">{np.phone || np.phoneNumber || np.mobile || "—"}</td>
                  <td className="text-[#4a5568]">{np.age != null && np.age !== "" ? np.age : "—"}</td>
                  <td className="text-[#4a5568]">{np.gender || "—"}</td>
                  <td className="text-[#4a5568]">{np.bloodGroup || "—"}</td>
                  <td className="text-[#4a5568] max-w-[160px] truncate" title={np.address || ""}>{np.address || "—"}</td>
                  <td className="text-[#718096] font-mono">{np.opdNumber || np._id || np.id}</td>
                  <td className="flex gap-1.5 items-center">
                    <button type="button" onClick={() => openEdit(p)} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100" title="Edit patient">Edit</button>
                    <button type="button" onClick={() => deletePatient(p._id || p.id)} className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-300 hover:bg-red-100" title="Delete patient">Delete</button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !saving && setShowAddModal(false)}>
          <div className="w-full max-w-md gov-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-[#1a202c] border-b border-[#cbd5e0] pb-2">Add new patient</h2>
            <form onSubmit={addPatient} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Hospital *</label>
                <select value={form.hospitalId} onChange={(e) => setForm((f) => ({ ...f, hospitalId: e.target.value }))} className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                  <option value="">Select hospital</option>
                  {hospitals.map((h) => <option key={h._id || h.id} value={h._id || h.id}>{h.name} {h.branchCode ? `(${h.branchCode})` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Full name *</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Customer email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="e.g. patient@example.com" />
                <p className="mt-1 text-xs text-[#718096]">Leave blank to use auto-generated email from mobile.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#2d3748]">Age</label>
                  <input type="number" min="1" max="120" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="25" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#2d3748]">Gender</label>
                  <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Mobile *</label>
                <input required type="tel" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="9876543210" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Aadhaar (optional)</label>
                <input type="text" maxLength={12} value={form.aadhaar} onChange={(e) => setForm((f) => ({ ...f, aadhaar: e.target.value.replace(/\D/g, "").slice(0, 12) }))} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="Last 4 or full" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Address</label>
                <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="Address" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Blood group (optional)</label>
                <select value={form.bloodGroup} onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))} className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                  <option value="">—</option>
                  {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} disabled={saving} className="flex-1 border border-[#cbd5e0] py-2.5 text-sm font-medium text-[#2d3748] bg-white hover:bg-[#f8fafc]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 gov-btn-primary py-2.5 disabled:opacity-50">{saving ? "Saving…" : "Add patient"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {editPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !editSaving && setEditPatient(null)}>
          <div className="w-full max-w-md gov-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-[#1a202c] border-b border-[#cbd5e0] pb-2">
              Edit Patient — {editPatient.name}
            </h2>
            <p className="text-xs text-[#718096] mt-1 mb-4">OPD: {editPatient.opdNumber || editPatient._id}</p>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Full name</label>
                <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Mobile</label>
                <input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="9876543210" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#2d3748]">Age</label>
                  <input type="number" min="1" max="120" value={editForm.age}
                    onChange={(e) => setEditForm((f) => ({ ...f, age: e.target.value }))}
                    className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="25" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#2d3748]">Gender</label>
                  <select value={editForm.gender} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                    className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Blood group</label>
                <select value={editForm.bloodGroup} onChange={(e) => setEditForm((f) => ({ ...f, bloodGroup: e.target.value }))}
                  className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                  <option value="">—</option>
                  {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Address</label>
                <textarea value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" placeholder="Address" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditPatient(null)} disabled={editSaving}
                  className="flex-1 border border-[#cbd5e0] py-2.5 text-sm font-medium text-[#2d3748] bg-white hover:bg-[#f8fafc]">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving} className="flex-1 gov-btn-primary py-2.5 disabled:opacity-50">
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
