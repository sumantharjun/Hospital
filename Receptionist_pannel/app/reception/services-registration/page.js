"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, apiFetch } from "../../lib/api";

export default function ServicesRegistrationPage() {
  const router = useRouter();
  const [hospitals, setHospitals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [createdReg, setCreatedReg] = useState(null);
  const [paymentMode, setPaymentMode] = useState("PENDING");
  const [serviceCategory, setServiceCategory] = useState("");

  const [form, setForm] = useState({
    hospitalId: "",
    patientId: "",
    patientName: "",
    patientContact: "",
    newPatient: false,
    newPatientAge: "",
    newPatientGender: "Male",
    notes: "",
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
      setForm(p => ({ ...p, hospitalId: hospData[0]._id }));
      fetchServicesForHospital(hospData[0]._id);
    }
  };

  const fetchServicesForHospital = async (hid) => {
    const headers = getAuthHeaders();
    const [svcRes, cfgRes] = await Promise.all([
      apiFetch(buildApiUrl(`/api/hospital-services/services?hospitalId=${hid}`), { headers }),
      fetch(buildApiUrl(`/api/hospital-services/config/${hid}`), { headers }),
    ]);
    setServices(svcRes.ok ? await svcRes.json() : []);
    setConfig(cfgRes.ok ? await cfgRes.json() : null);
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

  const addService = (svc) => {
    if (selectedServices.find(s => s.serviceId === svc._id)) {
      toast("Service already added");
      return;
    }
    const taxAmount = Math.round((svc.fee * (svc.taxPercent || 0)) / 100);
    setSelectedServices(p => [...p, {
      serviceId: svc._id,
      serviceName: svc.name,
      category: svc.category,
      fee: svc.fee,
      taxPercent: svc.taxPercent || 0,
      taxAmount,
      total: svc.fee + taxAmount,
    }]);
  };

  const removeService = (serviceId) => setSelectedServices(p => p.filter(s => s.serviceId !== serviceId));

  const subtotal = selectedServices.reduce((s, i) => s + i.fee, 0);
  const taxTotal = selectedServices.reduce((s, i) => s + i.taxAmount, 0);
  const grandTotal = subtotal + taxTotal;

  const filteredServices = services.filter(s => !serviceCategory || s.category === serviceCategory);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedServices.length === 0) { toast.error("Select at least one service"); return; }
    if (!form.patientId && !form.newPatient) { toast.error("Select or create a patient"); return; }
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
            hospitalId: form.hospitalId,
          }),
        });
        if (!pRes.ok) throw new Error((await pRes.json()).message);
        const pData = await pRes.json();
        patientId = pData._id || pData.user?._id;
      }

      const res = await fetch(buildApiUrl("/api/service-registrations"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          hospitalId: form.hospitalId,
          patientId,
          services: selectedServices,
          subtotal,
          taxTotal,
          discountPercent: 0,
          discountAmount: 0,
          grandTotal,
          paidAmount: paymentMode !== "PENDING" ? grandTotal : 0,
          outstandingBalance: paymentMode !== "PENDING" ? 0 : grandTotal,
          paymentMode,
          notes: form.notes,
          status: paymentMode !== "PENDING" ? "COMPLETED" : "ACTIVE",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      setCreatedReg(data);
      toast.success(`Services registered! ID: ${data.serviceRegId}`);
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (createdReg) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Services Registered!</h2>
          <div className="text-2xl font-mono font-bold text-green-700 my-2">{createdReg.serviceRegId}</div>
          <div className="text-lg font-bold mb-1">Total: ₹{grandTotal}</div>
          <div className={`text-sm mb-4 ${paymentMode !== "PENDING" ? "text-green-600" : "text-orange-600"}`}>
            {paymentMode !== "PENDING" ? "Payment Collected" : "Payment Pending"}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => router.push(`/reception/service-billing?svcId=${createdReg.serviceRegId}`)}
              className="bg-green-600 text-white px-5 py-2 rounded-lg font-medium text-sm">View & Print Bill</button>
            <button onClick={() => { setCreatedReg(null); setSelectedServices([]); setSearchPatient(""); setForm(p => ({ ...p, patientId: "", patientName: "" })); }}
              className="border border-green-500 text-green-700 px-5 py-2 rounded-lg font-medium text-sm">Register Another</button>
            <button onClick={() => router.push("/reception/dashboard")}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg font-medium text-sm">Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">←</button>
        <h1 className="text-xl font-bold text-gray-900">Services Registration</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hospital */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="text-xs font-medium text-gray-600">Hospital</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            value={form.hospitalId} onChange={e => { setForm(p => ({ ...p, hospitalId: e.target.value })); fetchServicesForHospital(e.target.value); }}>
            {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
        </div>

        {/* Patient */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Patient</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.newPatient} onChange={e => setForm(p => ({ ...p, newPatient: e.target.checked, patientId: "", patientName: "" }))} />
            New / Walk-in Patient
          </label>
          {!form.newPatient ? (
            <div className="relative">
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Search patient..."
                value={searchPatient} onChange={e => searchPatients(e.target.value)} />
              {patientResults.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1">
                  {patientResults.map(p => (
                    <div key={p._id} onClick={() => selectPatient(p)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.phone} · {p.gender}</div>
                    </div>
                  ))}
                </div>
              )}
              {form.patientId && <div className="mt-2 text-xs text-green-700 bg-green-50 rounded p-2">✓ {form.patientName}</div>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Name *</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={form.patientName} onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))} />
              </div>
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
              <div>
                <label className="text-xs font-medium text-gray-600">Gender</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={form.newPatientGender} onChange={e => setForm(p => ({ ...p, newPatientGender: e.target.value }))}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Services Selection */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-800 text-sm">Select Services</h2>
            <select className="border border-gray-200 rounded px-2 py-1 text-xs" value={serviceCategory} onChange={e => setServiceCategory(e.target.value)}>
              <option value="">All Categories</option>
              {["LAB","SCAN","PROCEDURE","CONSULTATION","OTHER"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {filteredServices.map(s => {
              const isSelected = selectedServices.find(ss => ss.serviceId === s._id);
              return (
                <button key={s._id} type="button" onClick={() => isSelected ? removeService(s._id) : addService(s)}
                  className={`text-left p-2 rounded-lg border text-xs transition-colors ${isSelected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-blue-300"}`}>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-gray-500">{s.category} · ₹{s.fee}</div>
                </button>
              );
            })}
            {filteredServices.length === 0 && <div className="col-span-2 text-center py-4 text-gray-400 text-xs">No services found</div>}
          </div>
        </div>

        {/* Selected Services Cart */}
        {selectedServices.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="font-semibold text-gray-800 text-sm mb-3">Bill Preview</h2>
            {selectedServices.map(s => (
              <div key={s.serviceId} className="flex justify-between items-center py-1.5 border-b border-gray-50 text-sm">
                <div>
                  <span className="font-medium">{s.serviceName}</span>
                  <span className="text-xs text-gray-400 ml-1">({s.category})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>₹{s.total}</span>
                  <button type="button" onClick={() => removeService(s.serviceId)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              </div>
            ))}
            <div className="mt-3 pt-2 border-t border-gray-200 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal}</span></div>
              {taxTotal > 0 && <div className="flex justify-between text-gray-500"><span>Tax</span><span>₹{taxTotal}</span></div>}
              <div className="flex justify-between font-bold text-base"><span>Total</span><span>₹{grandTotal}</span></div>
            </div>
          </div>
        )}

        {/* Payment & Submit */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Payment</h2>
          <div className="flex flex-wrap gap-2">
            {["CASH","CARD","UPI","INSURANCE","PENDING"].map(m => (
              <button key={m} type="button" onClick={() => setPaymentMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${paymentMode === m ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
                {m}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Notes (optional)</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <button type="submit" disabled={loading || selectedServices.length === 0}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
            {loading ? "Processing..." : `Register Services · ₹${grandTotal}`}
          </button>
        </div>
      </form>
    </div>
  );
}
