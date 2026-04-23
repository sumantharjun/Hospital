"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, apiFetch } from "../../lib/api";

export default function OPRegistrationPage() {
  const router = useRouter();
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [createdOP, setCreatedOP] = useState(null);

  const [form, setForm] = useState({
    hospitalId: "",
    patientId: "",
    patientName: "",
    patientContact: "",
    doctorId: "",
    consultationFee: 0,
    registrationFee: 0,
    newPatient: false,
    newPatientAge: "",
    newPatientGender: "Male",
    newPatientAddress: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/"); return; }
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const headers = getAuthHeaders();
    const [hospRes, patRes] = await Promise.all([
      apiFetch(buildApiUrl("/api/master/hospitals"), { headers }),
      apiFetch(buildApiUrl("/api/users?role=PATIENT"), { headers }),
    ]);
    const hospData = hospRes.ok ? await hospRes.json() : [];
    const patData = patRes.ok ? await patRes.json() : [];
    setHospitals(Array.isArray(hospData) ? hospData : []);
    setPatients(Array.isArray(patData) ? patData : []);
    if (hospData.length > 0) {
      fetchForHospital(hospData[0]._id);
      setForm(p => ({ ...p, hospitalId: hospData[0]._id }));
    }
  };

  const fetchForHospital = async (hid) => {
    const headers = getAuthHeaders();
    const [docRes, cfgRes] = await Promise.all([
      apiFetch(buildApiUrl(`/api/users?role=DOCTOR&hospitalId=${hid}`), { headers }),
      fetch(buildApiUrl(`/api/hospital-services/config/${hid}`), { headers }),
    ]);
    const docData = docRes.ok ? await docRes.json() : [];
    setDoctors(Array.isArray(docData) ? docData : []);
    const cfgData = cfgRes.ok ? await cfgRes.json() : null;
    setConfig(cfgData);
    if (cfgData) setForm(p => ({ ...p, registrationFee: cfgData.registrationFee || 0, consultationFee: cfgData.defaultConsultationFee || 0 }));
  };

  const selectDoctor = (doctorId) => {
    const doc = doctors.find(d => d._id === doctorId);
    setForm(p => ({
      ...p,
      doctorId,
      consultationFee: doc?.serviceCharge || config?.defaultConsultationFee || 0,
    }));
  };

  const searchPatients = (q) => {
    setSearchPatient(q);
    if (!q) { setPatientResults([]); return; }
    const lower = q.toLowerCase();
    setPatientResults(patients.filter(p => p.name?.toLowerCase().includes(lower) || p.phone?.includes(q)).slice(0, 6));
  };

  const selectPatient = (p) => {
    setForm(f => ({ ...f, patientId: p._id, patientName: p.name, patientContact: p.phone || "" }));
    setSearchPatient(p.name);
    setPatientResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patientId && !form.newPatient) { toast.error("Select or create a patient"); return; }
    if (!form.doctorId) { toast.error("Select a doctor"); return; }
    setLoading(true);
    try {
      let patientId = form.patientId;
      if (form.newPatient) {
        const pRes = await fetch(buildApiUrl("/api/users/signup"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            name: form.patientName,
            email: `patient_${Date.now()}@hsp.local`,
            password: "Patient@123",
            role: "PATIENT",
            phone: form.patientContact,
            age: form.newPatientAge,
            gender: form.newPatientGender,
            address: form.newPatientAddress,
            hospitalId: form.hospitalId,
          }),
        });
        if (!pRes.ok) throw new Error((await pRes.json()).message);
        const pData = await pRes.json();
        patientId = pData._id || pData.user?._id;
      }

      const res = await fetch(buildApiUrl("/api/op-registrations"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ...form, patientId }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      setCreatedOP(data);
      toast.success(`OP Registration created! OP ID: ${data.opId}`);
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (createdOP) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-green-800 mb-2">OP Registration Successful!</h2>
          <div className="text-2xl font-mono font-bold text-green-700 my-2">{createdOP.opId}</div>
          <div className="text-lg font-bold text-blue-700 mb-1">Token: {createdOP.tokenNumber}</div>
          <div className="text-sm text-gray-600 mb-1">Consultation Fee: ₹{createdOP.bill?.grandTotal}</div>
          <p className="text-sm text-green-600 mb-6">Patient is in the queue. Token has been assigned.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => router.push(`/reception/billing?ref=${createdOP.opId}`)}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium text-sm">View Bill</button>
            <button onClick={() => { setCreatedOP(null); setForm(p => ({ ...p, patientId: "", patientName: "", patientContact: "", doctorId: "" })); setSearchPatient(""); }}
              className="border border-green-500 text-green-700 px-5 py-2 rounded-lg font-medium text-sm">Register Another</button>
            <button onClick={() => router.push("/reception/dashboard")}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg font-medium text-sm">Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">←</button>
        <h1 className="text-xl font-bold text-gray-900">OP Registration — Out-Patient</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Hospital & Doctor</h2>
          <div>
            <label className="text-xs font-medium text-gray-600">Hospital</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
              value={form.hospitalId} onChange={e => { setForm(p => ({ ...p, hospitalId: e.target.value })); fetchForHospital(e.target.value); }}>
              {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Doctor *</label>
            <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
              value={form.doctorId} onChange={e => selectDoctor(e.target.value)}>
              <option value="">Select doctor</option>
              {doctors.map(d => <option key={d._id} value={d._id}>Dr. {d.name} — {d.specialization} (₹{d.serviceCharge || 0})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Consultation Fee (₹)</label>
              <input type="number" min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={form.consultationFee} onChange={e => setForm(p => ({ ...p, consultationFee: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Registration Fee (₹)</label>
              <input type="number" min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={form.registrationFee} onChange={e => setForm(p => ({ ...p, registrationFee: Number(e.target.value) }))} />
            </div>
          </div>
          {form.doctorId && (
            <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
              Total Bill: ₹{Number(form.consultationFee) + Number(form.registrationFee)}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Patient</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.newPatient} onChange={e => setForm(p => ({ ...p, newPatient: e.target.checked, patientId: "", patientName: "" }))} />
            New / Walk-in Patient
          </label>
          {!form.newPatient ? (
            <div className="relative">
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Search patient by name or phone..."
                value={searchPatient} onChange={e => searchPatients(e.target.value)} />
              {patientResults.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1">
                  {patientResults.map(p => (
                    <div key={p._id} onClick={() => selectPatient(p)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.phone} · {p.gender} · Age {p.age}</div>
                    </div>
                  ))}
                </div>
              )}
              {form.patientId && <div className="mt-2 text-xs text-green-700 bg-green-50 rounded p-2">✓ {form.patientName}</div>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Full Name *</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={form.patientName} onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Phone</label>
                  <input type="tel" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.patientContact} onChange={e => setForm(p => ({ ...p, patientContact: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Age</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.newPatientAge} onChange={e => setForm(p => ({ ...p, newPatientAge: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Gender</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.newPatientGender} onChange={e => setForm(p => ({ ...p, newPatientGender: e.target.value }))}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Address</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.newPatientAddress} onChange={e => setForm(p => ({ ...p, newPatientAddress: e.target.value }))} />
                </div>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
          {loading ? "Registering..." : "Register OP Patient"}
        </button>
      </form>
    </div>
  );
}
