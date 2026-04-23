"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, apiFetch } from "../../lib/api";

export default function IPRegistrationPage() {
  const router = useRouter();
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [availableBeds, setAvailableBeds] = useState([]);
  const [patients, setPatients] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [step, setStep] = useState(1); // 1: Patient, 2: Clinical, 3: Room/Bed, 4: Review

  const [form, setForm] = useState({
    hospitalId: "",
    patientId: "",
    patientName: "",
    patientContact: "",
    admissionDate: new Date().toISOString().slice(0, 16),
    expectedDays: 1,
    casualtyFlag: false,
    emergencyFlag: false,
    doctorId: "",
    roomId: "",
    bedId: "",
    roomRentPerDay: 0,
    registrationFee: 0,
    emergencyCharges: 0,
    newPatient: false,
    newPatientAge: "",
    newPatientGender: "Male",
    newPatientAddress: "",
    newPatientBloodGroup: "",
  });

  const [createdIP, setCreatedIP] = useState(null);

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
      const hid = hospData[0]._id;
      setForm(p => ({ ...p, hospitalId: hid }));
      fetchForHospital(hid);
    }
  };

  const fetchForHospital = async (hid) => {
    const headers = getAuthHeaders();
    const [docRes, roomRes, cfgRes] = await Promise.all([
      apiFetch(buildApiUrl(`/api/users?role=DOCTOR&hospitalId=${hid}`), { headers }),
      apiFetch(buildApiUrl(`/api/infrastructure/rooms?hospitalId=${hid}&status=AVAILABLE`), { headers }),
      fetch(buildApiUrl(`/api/hospital-services/config/${hid}`), { headers }),
    ]);
    setDoctors(docRes.ok ? await docRes.json() : []);
    setAvailableRooms(roomRes.ok ? await roomRes.json() : []);
    const cfgData = cfgRes.ok ? await cfgRes.json() : null;
    setConfig(cfgData);
    if (cfgData) {
      setForm(p => ({ ...p, registrationFee: cfgData.registrationFee || 0, emergencyCharges: cfgData.emergencyCharges || 0 }));
    }
  };

  const fetchBedsForRoom = async (roomId) => {
    const room = availableRooms.find(r => r._id === roomId);
    if (!room) { setAvailableBeds([]); return; }
    const res = await apiFetch(buildApiUrl(`/api/infrastructure/beds?roomId=${roomId}&status=AVAILABLE`), { headers: getAuthHeaders() });
    setAvailableBeds(res.ok ? await res.json() : []);
    setForm(p => ({ ...p, roomRentPerDay: room.rentPerDay || 0, bedId: "" }));
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
    if (!form.patientId && !form.newPatient) {
      toast.error("Please select or create a patient");
      return;
    }
    if (!form.bedId) { toast.error("Please select a bed"); return; }
    if (!form.doctorId) { toast.error("Please select a doctor"); return; }
    setLoading(true);

    try {
      let patientId = form.patientId;

      // Create patient if new
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
            bloodGroup: form.newPatientBloodGroup,
            hospitalId: form.hospitalId,
          }),
        });
        if (!pRes.ok) throw new Error((await pRes.json()).message || "Failed to create patient");
        const pData = await pRes.json();
        patientId = pData._id || pData.user?._id;
      }

      const res = await fetch(buildApiUrl("/api/ip-admissions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          ...form,
          patientId,
          admissionDate: new Date(form.admissionDate),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create IP admission");
      const data = await res.json();
      setCreatedIP(data);
      toast.success(`IP Admission created! IP ID: ${data.ipId}`);
    } catch (err) {
      toast.error(err.message || "Failed to register IP patient");
    } finally {
      setLoading(false);
    }
  };

  if (createdIP) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-green-800 mb-2">IP Admission Registered!</h2>
          <div className="text-3xl font-mono font-bold text-green-700 my-3">{createdIP.ipId}</div>
          <p className="text-sm text-green-600 mb-6">Patient has been admitted. Billing has been initiated.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => router.push(`/reception/ip-billing?ipId=${createdIP.ipId}`)}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium text-sm">View Bill</button>
            <button onClick={() => { setCreatedIP(null); setForm(p => ({ ...p, patientId: "", patientName: "", patientContact: "", doctorId: "", roomId: "", bedId: "" })); setStep(1); setSearchPatient(""); }}
              className="border border-green-500 text-green-700 px-5 py-2 rounded-lg font-medium text-sm">Register Another</button>
            <button onClick={() => router.push("/reception/dashboard")}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg font-medium text-sm">Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">←</button>
        <h1 className="text-xl font-bold text-gray-900">IP Registration — In-Patient Admission</h1>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        {["Patient", "Clinical", "Room & Bed", "Review"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${step === i + 1 ? "text-blue-600 font-medium" : "text-gray-400"}`}>{s}</span>
            {i < 3 && <div className={`h-0.5 w-8 ${step > i + 1 ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Hospital Selection */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">Hospital</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            value={form.hospitalId}
            onChange={e => { setForm(p => ({ ...p, hospitalId: e.target.value })); fetchForHospital(e.target.value); }}>
            {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
        </div>

        {/* Step 1: Patient Info */}
        {step === 1 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Patient Information</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.newPatient} onChange={e => setForm(p => ({ ...p, newPatient: e.target.checked, patientId: "", patientName: "" }))} />
                New / Walk-in Patient
              </label>
            </div>
            {!form.newPatient ? (
              <div className="relative">
                <label className="text-xs font-medium text-gray-600">Search Existing Patient</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder="Search by name or phone..."
                  value={searchPatient} onChange={e => searchPatients(e.target.value)} />
                {patientResults.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1">
                    {patientResults.map(p => (
                      <div key={p._id} onClick={() => selectPatient(p)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0">
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.phone} · {p.gender} · Age {p.age}</div>
                      </div>
                    ))}
                  </div>
                )}
                {form.patientId && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                    ✓ Patient selected: {form.patientName}
                  </div>
                )}
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
                    <label className="text-xs font-medium text-gray-600">Phone *</label>
                    <input required type="tel" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
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
                    <label className="text-xs font-medium text-gray-600">Blood Group</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={form.newPatientBloodGroup} onChange={e => setForm(p => ({ ...p, newPatientBloodGroup: e.target.value }))}>
                      <option value="">—</option>
                      {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(bg => <option key={bg}>{bg}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Address</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.newPatientAddress} onChange={e => setForm(p => ({ ...p, newPatientAddress: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => {
                if (!form.patientId && !form.newPatient) { toast.error("Select or create a patient"); return; }
                if (form.newPatient && !form.patientName) { toast.error("Enter patient name"); return; }
                setStep(2);
              }} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium text-sm">Next →</button>
            </div>
          </div>
        )}

        {/* Step 2: Clinical Info */}
        {step === 2 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Clinical Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Admission Date & Time *</label>
                <input required type="datetime-local" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={form.admissionDate} onChange={e => setForm(p => ({ ...p, admissionDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Expected Stay (days) *</label>
                <input required type="number" min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={form.expectedDays} onChange={e => setForm(p => ({ ...p, expectedDays: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Attending Doctor *</label>
              <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={form.doctorId} onChange={e => setForm(p => ({ ...p, doctorId: e.target.value }))}>
                <option value="">Select doctor</option>
                {doctors.map(d => <option key={d._id} value={d._id}>Dr. {d.name} — {d.specialization}</option>)}
              </select>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.emergencyFlag} onChange={e => setForm(p => ({ ...p, emergencyFlag: e.target.checked }))} />
                <span className="text-red-600 font-medium">Emergency</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.casualtyFlag} onChange={e => setForm(p => ({ ...p, casualtyFlag: e.target.checked }))} />
                <span className="text-orange-600 font-medium">Casualty</span>
              </label>
            </div>
            {(form.emergencyFlag || form.casualtyFlag) && config?.emergencyCharges > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                Emergency charges will be applied: ₹{config.emergencyCharges}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(1)} className="border border-gray-300 px-5 py-2 rounded-lg text-sm">← Back</button>
              <button type="button" onClick={() => { if (!form.doctorId) { toast.error("Select a doctor"); return; } setStep(3); }}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium text-sm">Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: Room & Bed */}
        {step === 3 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Room & Bed Allocation</h2>
            <div>
              <label className="text-xs font-medium text-gray-600">Select Room *</label>
              <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={form.roomId} onChange={e => { setForm(p => ({ ...p, roomId: e.target.value })); fetchBedsForRoom(e.target.value); }}>
                <option value="">Select available room</option>
                {availableRooms.map(r => (
                  <option key={r._id} value={r._id}>
                    Room {r.roomNumber} (Floor {r.floor}) — {r.roomType} — ₹{r.rentPerDay}/day
                  </option>
                ))}
              </select>
              {availableRooms.length === 0 && <p className="text-xs text-red-500 mt-1">No available rooms found.</p>}
            </div>
            {form.roomId && (
              <div>
                <label className="text-xs font-medium text-gray-600">Select Bed *</label>
                <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={form.bedId} onChange={e => setForm(p => ({ ...p, bedId: e.target.value }))}>
                  <option value="">Select available bed</option>
                  {availableBeds.map(b => <option key={b._id} value={b._id}>{b.bedNumber}</option>)}
                </select>
                {availableBeds.length === 0 && <p className="text-xs text-red-500 mt-1">No available beds in this room.</p>}
              </div>
            )}
            {form.roomRentPerDay > 0 && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                Room rent: ₹{form.roomRentPerDay}/day × {form.expectedDays} days = ₹{form.roomRentPerDay * form.expectedDays} (estimated)
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(2)} className="border border-gray-300 px-5 py-2 rounded-lg text-sm">← Back</button>
              <button type="button" onClick={() => { if (!form.bedId) { toast.error("Select a bed"); return; } setStep(4); }}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium text-sm">Review →</button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Submit */}
        {step === 4 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Review & Confirm</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Patient", form.patientName],
                ["Contact", form.patientContact || "—"],
                ["Doctor", doctors.find(d => d._id === form.doctorId)?.name || "—"],
                ["Room", availableRooms.find(r => r._id === form.roomId)?.roomNumber || "—"],
                ["Bed", availableBeds.find(b => b._id === form.bedId)?.bedNumber || "—"],
                ["Admission", form.admissionDate],
                ["Expected Days", form.expectedDays],
                ["Emergency", form.emergencyFlag ? "YES" : "No"],
                ["Reg Fee", `₹${form.registrationFee}`],
                ["Room Rent/day", `₹${form.roomRentPerDay}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-gray-50 py-1">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-right">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(3)} className="border border-gray-300 px-5 py-2 rounded-lg text-sm">← Back</button>
              <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium text-sm disabled:opacity-50">
                {loading ? "Registering..." : "Confirm Admission"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
