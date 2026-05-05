import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders, PHARMACIES_PATH } from "@/lib/api";
import SuccessModal from "@/components/SuccessModal";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import Layout from "@/components/Layout";

export default function PrescriptionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ patientId: "", doctorId: "", fromDate: "", toDate: "" });
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [sendToPharmacyModal, setSendToPharmacyModal] = useState<any>(null);
  const [sendingToPharmacy, setSendingToPharmacy] = useState(false);
  const [successModal, setSuccessModal] = useState({ open: false, title: "", message: "" });
  const [patientNameCache, setPatientNameCache] = useState<any>({});
  const [doctorNameCache, setDoctorNameCache] = useState<any>({});

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchData();
  }, []);

  // Pre-fill name cache from populated prescription data and fetch missing patient/doctor names by ID
  useEffect(() => {
    if (!prescriptions.length) return;
    const headers = getAuthHeaders();
    const norm = (v: any) => {
      if (v == null) return "";
      if (typeof v === "object") {
        if (v.$oid) return String(v.$oid);
        const id = v._id || v.id;
        return id != null ? String(id) : "";
      }
      return String(v);
    };
    const looksLikeIdStr = (s: any) => typeof s === "string" && /^[a-f0-9]{24}$/i.test(String(s).trim());
    const nameFromUser = (u: any) => {
      if (!u) return null;
      const name = u.name || u.patientName || u.doctorName || u.fullName || u.profile?.name || u.profile?.fullName || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}`.trim() : null) || (u.firstName || u.lastName) || null;
      return name && !looksLikeIdStr(name) ? name : null;
    };
    const patientCacheUpdates: any = {};
    const doctorCacheUpdates: any = {};
    prescriptions.forEach((p) => {
      const patient = p.patient;
      if (patient && typeof patient === "object") {
        const id = norm(patient);
        const name = nameFromUser(patient) || (patient.firstName && (patient.lastName || patient.firstName) ? [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim() : null);
        if (id && name) patientCacheUpdates[id] = name;
      }
      const doctor = p.doctor;
      if (doctor && typeof doctor === "object") {
        const id = norm(doctor);
        const name = nameFromUser(doctor) || (doctor.firstName && (doctor.lastName || doctor.firstName) ? [doctor.firstName, doctor.lastName].filter(Boolean).join(" ").trim() : null);
        if (id && name) doctorCacheUpdates[id] = name;
      }
    });
    if (Object.keys(patientCacheUpdates).length) setPatientNameCache((c: any) => ({ ...c, ...patientCacheUpdates }));
    if (Object.keys(doctorCacheUpdates).length) setDoctorNameCache((c: any) => ({ ...c, ...doctorCacheUpdates }));
    const getPatientId = (p: any) => norm(p.patientId || p.patient || p.userId || p.patient_id || p.user);
    const missingPatientIds = [...new Set(prescriptions.map((p) => getPatientId(p)).filter(Boolean))];
    const missingDoctorIds = [...new Set(prescriptions.map((p) => norm(p.doctorId || p.doctor)).filter(Boolean))];
    const patIdSet = new Set(patients.map((x) => norm(x._id || x.id)));
    const docIdSet = new Set(doctors.map((x) => norm(x._id || x.id)));
    missingPatientIds.forEach((id: any) => {
      if (patIdSet.has(id) || patientNameCache[id]) return;
      fetch(buildApiUrl(`/api/users/${id}`), { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((raw) => {
          const u = raw?.data ?? raw?.user ?? raw?.result ?? raw;
          const name = nameFromUser(u) || nameFromUser(u?.profile) || nameFromUser(raw?.data?.profile);
          if (name) {
            setPatientNameCache((c: any) => ({ ...c, [id]: name }));
            return null;
          }
          return fetch(buildApiUrl(`/api/patients/${id}`), { headers });
        })
        .then((r: any) => (r && r.ok ? r.json() : null))
        .then((raw) => {
          if (!raw) return;
          const u = raw?.patient ?? raw?.data ?? raw?.user ?? raw?.result ?? raw;
          const name = nameFromUser(u) || nameFromUser(u?.profile) || nameFromUser(raw?.data?.profile);
          if (name) setPatientNameCache((c: any) => ({ ...c, [id]: name }));
        })
        .catch(() => {});
    });
    missingDoctorIds.forEach((id: any) => {
      if (docIdSet.has(id) || doctorNameCache[id]) return;
      fetch(buildApiUrl(`/api/users/${id}`), { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((raw) => {
          const u = raw?.data ?? raw?.user ?? raw?.result ?? raw;
          const name = nameFromUser(u) || nameFromUser(u?.profile) || nameFromUser(raw?.data?.profile);
          if (name) setDoctorNameCache((c: any) => ({ ...c, [id]: name }));
        })
        .catch(() => {});
    });
  }, [prescriptions, patients, doctors, patientNameCache, doctorNameCache]);

  function normId(v: any): string {
    if (v == null) return "";
    if (typeof v === "object") {
      if (v.$oid) return String(v.$oid);
      const id = v._id || v.id;
      return id != null ? String(id) : "";
    }
    return String(v);
  }

  async function fetchData() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [preRes, patRes, docRes, aptRes, pharmRes] = await Promise.all([
        fetch(buildApiUrl("/api/prescriptions?populate=patient,doctor"), { headers }),
        fetch(buildApiUrl("/api/users?role=PATIENT"), { headers }),
        fetch(buildApiUrl("/api/users?role=DOCTOR"), { headers }),
        fetch(buildApiUrl("/api/appointments"), { headers }).catch(() => ({ ok: false } as any)),
        fetch(buildApiUrl(PHARMACIES_PATH), { headers }).catch(() => ({ ok: false } as any)),
      ]);
      const preRaw = preRes.ok ? await preRes.json() : [];
      const patRaw = patRes.ok ? await patRes.json() : [];
      const docRaw = docRes.ok ? await docRes.json() : [];
      const aptRaw = (aptRes as any).ok ? await (aptRes as any).json() : [];
      const pharmRaw = (pharmRes as any).ok ? await (pharmRes as any).json() : [];
      const toList = (raw: any, keys = ["data", "users", "prescriptions", "list"]) => {
        if (Array.isArray(raw)) return raw;
        for (const k of keys) {
          if (Array.isArray(raw?.[k])) return raw[k];
        }
        if (raw?.data && Array.isArray(raw.data?.users)) return raw.data.users;
        if (raw?.data && Array.isArray(raw.data?.list)) return raw.data.list;
        if (raw?.data && Array.isArray(raw.data?.prescriptions)) return raw.data.prescriptions;
        return [];
      };
      const preList = toList(preRaw, ["data", "prescriptions", "list"]);
      const patList = Array.isArray(patRaw) ? patRaw : Array.isArray(patRaw?.data) ? patRaw.data : Array.isArray(patRaw?.users) ? patRaw.users : Array.isArray(patRaw?.data?.users) ? patRaw.data.users : [];
      const docList = Array.isArray(docRaw) ? docRaw : Array.isArray(docRaw?.data) ? docRaw.data : Array.isArray(docRaw?.users) ? docRaw.users : Array.isArray(docRaw?.data?.users) ? docRaw.data.users : toList(docRaw, ["data", "users", "list"]);
      const aptList = Array.isArray(aptRaw) ? aptRaw : Array.isArray(aptRaw?.data) ? aptRaw.data : Array.isArray(aptRaw?.appointments) ? aptRaw.appointments : [];
      const pharmList = toList(pharmRaw, ["data", "list"]);
      setPrescriptions(preList);
      setPatients(patList);
      setDoctors(docList);
      setAppointments(aptList);
      setPharmacies(pharmList);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function applyFilter() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.patientId) params.set("patientId", filter.patientId);
      if (filter.doctorId) params.set("doctorId", filter.doctorId);
      params.set("populate", "patient,doctor");
      const url = buildApiUrl("/api/prescriptions") + (params.toString() ? `?${params}` : "");
      const res = await fetch(url, { headers: getAuthHeaders() });
      const raw = res.ok ? await res.json() : [];
      const toList = (r: any, keys = ["data", "prescriptions", "list"]) => {
        if (Array.isArray(r)) return r;
        for (const k of keys) if (Array.isArray(r?.[k])) return r[k];
        if (r?.data && Array.isArray(r.data?.list)) return r.data.list;
        return [];
      };
      let data = toList(raw, ["data", "prescriptions", "list"]);
      if (filter.fromDate || filter.toDate) {
        data = data.filter((p: any) => {
          const d = (p.createdAt || p.date || "").toString().split("T")[0];
          if (filter.fromDate && d < filter.fromDate) return false;
          if (filter.toDate && d > filter.toDate) return false;
          return true;
        });
      }
      setPrescriptions(data);
    } catch {
      toast.error("Filter failed");
    } finally {
      setLoading(false);
    }
  }

  const looksLikeId = (s: any) => typeof s === "string" && /^[a-f0-9]{24}$/i.test(String(s).trim());

  const nameFromObj = (o: any): string | null => {
    if (!o) return null;
    if (Array.isArray(o) && o[0]) return nameFromObj(o[0]);
    if (typeof o !== "object") return null;
    const name = o.name || o.patientName || o.doctorName || o.fullName || o.user?.name || o.profile?.name || o.profile?.fullName || [o.firstName, o.lastName].filter(Boolean).join(" ").trim() || null;
    if (name && !looksLikeId(name)) return name;
    return null;
  };

  const getPatientDisplayName = (idOrObj: any): string => {
    if (idOrObj == null) return "—";
    const fromObj = nameFromObj(idOrObj);
    if (fromObj) return fromObj;
    const id = normId(idOrObj);
    if (!id) return "—";
    if (patientNameCache[id]) return patientNameCache[id];
    const p = patients.find((x) => {
      const xid = normId(x._id || x.id);
      return xid === id || (xid && id && xid.length > 6 && (xid === id || xid.slice(-8) === id.slice(-8)));
    });
    const n = p?.name || p?.patientName || p?.fullName || (p?.firstName && (p?.lastName || p?.firstName) ? [p.firstName, p.lastName].filter(Boolean).join(" ").trim() : null);
    if (n && !looksLikeId(n)) return n;
    return "—";
  };

  const getDoctorDisplayName = (idOrObj: any): string => {
    if (idOrObj == null) return "—";
    const fromObj = nameFromObj(idOrObj);
    if (fromObj) return fromObj;
    const id = normId(idOrObj);
    if (!id) return "—";
    if (doctorNameCache[id]) return doctorNameCache[id];
    const d = doctors.find((x) => {
      const xid = normId(x._id || x.id);
      return xid === id || (xid && id && xid.length > 6 && (xid === id || xid.slice(-8) === id.slice(-8)));
    });
    const n = d?.name || d?.doctorName || d?.fullName || (d?.firstName && (d?.lastName || d?.firstName) ? [d.firstName, d.lastName].filter(Boolean).join(" ").trim() : null);
    if (n && !looksLikeId(n)) return n;
    return "—";
  };

  const getPatientName = getPatientDisplayName;
  const getDoctorName = getDoctorDisplayName;

  const getPatient = (idOrObj: any) => {
    if (idOrObj == null) return null;
    const id = normId(idOrObj);
    if (!id) return typeof idOrObj === "object" && (idOrObj.name || idOrObj.patientName) ? idOrObj : null;
    const byStrict = patients.find((p) => (p._id || p.id) === id || (p._id || p.id) === idOrObj);
    if (byStrict) return byStrict;
    return patients.find((p) => normId(p._id || p.id) === id) || null;
  };

  const getDoctor = (idOrObj: any) => {
    if (idOrObj == null) return null;
    const id = normId(idOrObj);
    if (!id) return typeof idOrObj === "object" && (idOrObj.name || idOrObj.doctorName) ? idOrObj : null;
    const byStrict = doctors.find((d) => (d._id || d.id) === id || (d._id || d.id) === idOrObj);
    if (byStrict) return byStrict;
    return doctors.find((d) => normId(d._id || d.id) === id) || null;
  };

  const getPatientNameFromAppointments = (patientIdOrPrescription: any) => {
    if (!appointments.length) return null;
    const isObj = patientIdOrPrescription != null && typeof patientIdOrPrescription === "object";
    const appointmentId = isObj && patientIdOrPrescription.appointmentId != null ? normId(patientIdOrPrescription.appointmentId) : null;
    const patientId = isObj ? normId(patientIdOrPrescription.patientId || patientIdOrPrescription.patient || patientIdOrPrescription.userId) : normId(patientIdOrPrescription);
    if (appointmentId) {
      const apt = appointments.find((a) => normId(a._id || a.id) === appointmentId);
      return apt ? (apt.patientName || (apt.patient && nameFromObj(apt.patient)) || null) : null;
    }
    if (!patientId) return null;
    const byPatientId = appointments.find((a) => normId(a.patientId) === patientId || String(a.patientId) === patientId);
    return byPatientId ? (byPatientId.patientName || (byPatientId.patient && nameFromObj(byPatientId.patient)) || null) : null;
  };

  const getPatientNameByPatientIdFromAppointments = (patientId: any) => {
    if (!appointments.length || !patientId) return null;
    const id = normId(patientId);
    const apt = appointments.find((a) => normId(a.patientId) === id || (a.patientId || "") === id || (typeof a.patientId === "object" && normId(a.patientId) === id));
    return apt ? (apt.patientName || (apt.patient && nameFromObj(apt.patient)) || null) : null;
  };

  async function sendPrescriptionToPharmacy(prescriptionId: string, pharmacyId: string) {
    const prescription = prescriptions.find((p) => (p._id || p.id) === prescriptionId);
    if (!prescription || !prescription.items || prescription.items.length === 0) {
      toast.error("Prescription has no items");
      return;
    }
    setSendingToPharmacy(true);
    try {
      const res = await fetch(buildApiUrl(`/api/prescriptions/${prescriptionId}`), {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ items: prescription.items, pharmacyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to send to pharmacy");
      setSuccessModal({
        open: true,
        title: "Sent to pharmacy",
        message: "Prescription has been assigned to the pharmacy. They can view and fulfill the medicine order in their panel.",
      });
      setSendToPharmacyModal(null);
      setSelectedPrescription(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to send to pharmacy");
    } finally {
      setSendingToPharmacy(false);
    }
  }

  const filteredList = prescriptions;

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <SuccessModal open={successModal.open} title={successModal.title} message={successModal.message} onClose={() => setSuccessModal({ open: false, title: "", message: "" })} />
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Doctor Prescription Report</h1>
          <p className="mt-1 text-sm text-zinc-500">View prescriptions, send to pharmacy for medicine fulfillment. Pharmacy will see it in their panel.</p>
        </div>

        {pharmacies.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900 mb-2">Pharmacy details (for sending prescriptions)</h2>
            <p className="text-xs text-zinc-500 mb-3">Use &quot;Send to pharmacy&quot; on a prescription to assign it. The pharmacy will see it in their panel and can prepare the medicine.</p>
            <div className="flex flex-wrap gap-4">
              {pharmacies.slice(0, 6).map((ph: any) => (
                <div key={ph._id || ph.id} className="min-w-[200px] p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                  <p className="font-medium text-zinc-900">{ph.name}</p>
                  {ph.address && <p className="text-xs text-zinc-600 mt-0.5">{ph.address}</p>}
                  {ph.phone && <p className="text-xs text-zinc-500 mt-0.5">Phone: {ph.phone}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {!loading && pharmacies.length === 0 && (
          <p className="text-sm text-zinc-500">Pharmacy list is loaded for hospital admin. If you don&apos;t see pharmacies, ask your admin to add pharmacies in the admin panel; then you can send prescriptions here.</p>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Filters</h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Patient</label>
              <select value={filter.patientId} onChange={(e) => setFilter((f) => ({ ...f, patientId: e.target.value }))} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 min-w-[200px]">
                <option value="">All patients</option>
                {patients.map((p: any) => (
                  <option key={normId(p._id || p.id)} value={normId(p._id || p.id)}>
                    {getPatientDisplayName(p)}{(p.phone || p.mobile) ? ` · ${p.phone || p.mobile}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Doctor</label>
              <select value={filter.doctorId} onChange={(e) => setFilter((f) => ({ ...f, doctorId: e.target.value }))} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 min-w-[200px]">
                <option value="">All doctors</option>
                {doctors.map((d: any) => (
                  <option key={normId(d._id || d.id)} value={normId(d._id || d.id)}>
                    Dr. {getDoctorDisplayName(d)}{d.specialization ? ` · ${d.specialization}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">From date</label>
              <input type="date" value={filter.fromDate} onChange={(e) => setFilter((f) => ({ ...f, fromDate: e.target.value }))} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">To date</label>
              <input type="date" value={filter.toDate} onChange={(e) => setFilter((f) => ({ ...f, toDate: e.target.value }))} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
            </div>
            <button type="button" onClick={applyFilter} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Apply
            </button>
            <button type="button" onClick={fetchData} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50">
            <h2 className="font-semibold text-zinc-900 text-lg">Prescriptions</h2>
            <p className="mt-0.5 text-sm text-zinc-500">{filteredList.length} record{filteredList.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <LoadingOverlay text="Loading prescriptions…" />
            ) : filteredList.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-zinc-500">No prescriptions found.</p>
                <p className="mt-1 text-sm text-zinc-400">Try changing filters or ensure the backend has prescription data.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Patient</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Doctor</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Items</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Pharmacy</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredList.map((p: any) => {
                    const patientRef = p.patientId || p.patient || p.userId || p.patient_id || p.user;
                    const patientIdStr = normId(patientRef);
                    const patientFromList = getPatient(patientRef);
                    const fromAppointments = getPatientNameByPatientIdFromAppointments(patientRef) || getPatientNameFromAppointments(p.appointmentId ? { appointmentId: p.appointmentId } : patientRef);
                    const fromPatientObj = patientFromList?.name || patientFromList?.patientName || patientFromList?.fullName || (patientFromList?.firstName && (patientFromList?.lastName || patientFromList?.firstName) ? [patientFromList.firstName, patientFromList.lastName].filter(Boolean).join(" ").trim() : null);
                    let patientName = (p.patientName && !looksLikeId(p.patientName) ? p.patientName : null) || (p.patient_name && !looksLikeId(p.patient_name) ? p.patient_name : null) || nameFromObj(p.patient) || nameFromObj(p.patientId) || nameFromObj(p.user) || fromPatientObj || fromAppointments || patientNameCache[patientIdStr] || getPatientName(patientRef);
                    let doctorName = nameFromObj(p.doctor) || nameFromObj(p.doctorId) || (p.doctorName && !looksLikeId(p.doctorName) ? p.doctorName : null) || getDoctorName(p.doctorId);
                    if (patientName && looksLikeId(patientName)) patientName = "—";
                    if (doctorName && looksLikeId(doctorName)) doctorName = "—";
                    if (!patientName) patientName = "—";
                    if (!doctorName) doctorName = "—";
                    const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : (p.date ? new Date(p.date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—");
                    const pharmacyName = p.pharmacyId ? (pharmacies.find((ph: any) => normId(ph._id || ph.id) === normId(p.pharmacyId))?.name || "Assigned") : "—";
                    const itemCount = (p.items && p.items.length) || 0;
                    return (
                      <tr key={p._id || p.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3.5 text-sm text-zinc-700 whitespace-nowrap">{dateStr}</td>
                        <td className="px-4 py-3.5 text-sm font-medium text-zinc-900">{patientName}</td>
                        <td className="px-4 py-3.5 text-sm text-zinc-700">Dr. {doctorName}</td>
                        <td className="px-4 py-3.5 text-sm text-zinc-600">{itemCount} {itemCount === 1 ? "item" : "items"}</td>
                        <td className="px-4 py-3.5 text-sm text-zinc-600">{pharmacyName}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setSelectedPrescription(p)} className="inline-flex items-center rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                              View
                            </button>
                            {(!p.pharmacyId || !p.pharmacyId.length) && pharmacies.length > 0 && (
                              <button type="button" onClick={() => setSendToPharmacyModal(p)} className="inline-flex items-center rounded-md border border-blue-600 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
                                Send to pharmacy
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selectedPrescription && (() => {
          const sp = selectedPrescription;
          const patientRef = sp.patientId || sp.patient || sp.userId || sp.patient_id || sp.user;
          const patientFromList = getPatient(patientRef);
          const doctorFromList = getDoctor(sp.doctorId || sp.doctor);
          const fromAppointmentsModal = getPatientNameByPatientIdFromAppointments(patientRef) || (sp.appointmentId ? getPatientNameFromAppointments({ appointmentId: sp.appointmentId }) : null);
          const fromPatientObjModal = patientFromList?.name || patientFromList?.patientName || patientFromList?.fullName || (patientFromList?.firstName && (patientFromList?.lastName || patientFromList?.firstName) ? [patientFromList.firstName, patientFromList.lastName].filter(Boolean).join(" ").trim() : null);
          let patientName = (sp.patientName && !looksLikeId(sp.patientName) ? sp.patientName : null) || (sp.patient_name && !looksLikeId(sp.patient_name) ? sp.patient_name : null) || nameFromObj(sp.patient) || nameFromObj(sp.user) || fromPatientObjModal || fromAppointmentsModal || patientNameCache[normId(patientRef)] || getPatientName(patientRef) || "—";
          let doctorName = nameFromObj(sp.doctor) || (sp.doctorName && !looksLikeId(sp.doctorName) ? sp.doctorName : null) || (doctorFromList?.name || doctorFromList?.doctorName || doctorFromList?.fullName || (doctorFromList?.firstName && (doctorFromList?.lastName || doctorFromList?.firstName) ? [doctorFromList.firstName, doctorFromList.lastName].filter(Boolean).join(" ").trim() : null)) || getDoctorName(sp.doctorId) || "—";
          if (patientName && looksLikeId(patientName)) patientName = "—";
          if (doctorName && looksLikeId(doctorName)) doctorName = "—";
          const patient = sp.patient || patientFromList;
          const doctor = sp.doctor || doctorFromList;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedPrescription(null)}>
              <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-zinc-900">Prescription details</h3>
                <div className="mt-3 p-3 rounded-lg bg-zinc-50 space-y-1 text-sm">
                  <p><strong>Patient:</strong> {patientName}{patient?.phone ? ` · ${patient.phone}` : ""}{patient?.age != null ? ` · Age ${patient.age}` : ""}</p>
                  <p><strong>Doctor:</strong> Dr. {doctorName}{doctor?.specialization ? ` (${doctor.specialization})` : ""}</p>
                  <p><strong>Date:</strong> {sp.createdAt ? new Date(sp.createdAt).toLocaleString() : (sp.date ? new Date(sp.date).toLocaleString() : "—")}</p>
                  {sp.diagnosis && <p><strong>Diagnosis:</strong> {sp.diagnosis}</p>}
                  {sp.notes && <p><strong>Notes:</strong> {sp.notes}</p>}
                </div>
                <h4 className="mt-4 font-semibold text-zinc-900">Medicines</h4>
                <div className="mt-2 space-y-2">
                  {sp.items && sp.items.length > 0 ? (
                    sp.items.map((item: any, idx: number) => {
                      const name = item.medicineName || item.name || item.medicine || "Medicine";
                      const qty = item.quantity ?? item.qty ?? "";
                      const dosage = item.dosage ?? item.dose ?? "";
                      const freq = item.frequency ?? item.frequencyInDay ?? "";
                      const duration = item.duration ?? item.days ?? "";
                      return (
                        <div key={idx} className="p-3 rounded-lg border border-zinc-200 bg-white text-sm">
                          <p className="font-semibold text-zinc-900">{name}</p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0 text-zinc-600">
                            {qty && <span>Qty: {qty}</span>}
                            {dosage && <span>Dosage: {dosage}</span>}
                            {freq && <span>Frequency: {freq}</span>}
                            {duration && <span>Duration: {duration}</span>}
                          </div>
                          {item.notes && <p className="mt-1 text-zinc-500">{item.notes}</p>}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-zinc-500 text-sm">No items.</p>
                  )}
                </div>
                {pharmacies.length > 0 && !normId(selectedPrescription.pharmacyId) && (
                  <div className="mt-4 pt-4 border-t border-zinc-200">
                    <p className="text-sm font-medium text-zinc-700 mb-2">Send to pharmacy (for medicine)</p>
                    <select
                      id="pharmacy-select-modal"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 mb-2"
                    >
                      <option value="">Select pharmacy</option>
                      {pharmacies.map((ph: any) => (
                        <option key={ph._id || ph.id} value={ph._id || ph.id}>{ph.name} {ph.address ? `— ${ph.address}` : ""}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const sel = document.getElementById("pharmacy-select-modal") as HTMLSelectElement;
                        const pharmacyId = sel?.value;
                        if (pharmacyId) sendPrescriptionToPharmacy(selectedPrescription._id || selectedPrescription.id, pharmacyId);
                        else toast.error("Select a pharmacy");
                      }}
                      disabled={sendingToPharmacy}
                      className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {sendingToPharmacy ? "Sending…" : "Send to pharmacy"}
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => setSelectedPrescription(null)} className="mt-4 w-full rounded-lg border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  Close
                </button>
              </div>
            </div>
          );
        })()}

        {sendToPharmacyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !sendingToPharmacy && setSendToPharmacyModal(null)}>
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-zinc-900">Send prescription to pharmacy</h3>
              <p className="mt-1 text-sm text-zinc-500">Patient: {getPatientName(sendToPharmacyModal.patientId || sendToPharmacyModal.patient || sendToPharmacyModal.userId)}. Select pharmacy to assign. They will see it in their panel for medicine fulfillment.</p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Pharmacy</label>
                <select id="send-pharmacy-select" className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900">
                  <option value="">Select pharmacy</option>
                  {pharmacies.map((ph: any) => (
                    <option key={ph._id || ph.id} value={ph._id || ph.id}>
                      {ph.name} {ph.phone ? ` — ${ph.phone}` : ""} {ph.address ? ` — ${ph.address}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setSendToPharmacyModal(null)} disabled={sendingToPharmacy} className="flex-1 rounded-lg border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sel = document.getElementById("send-pharmacy-select") as HTMLSelectElement;
                    const pharmacyId = sel?.value;
                    if (!pharmacyId) { toast.error("Select a pharmacy"); return; }
                    sendPrescriptionToPharmacy(sendToPharmacyModal._id || sendToPharmacyModal.id, pharmacyId);
                  }}
                  disabled={sendingToPharmacy}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {sendingToPharmacy ? "Sending…" : "Send to pharmacy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
