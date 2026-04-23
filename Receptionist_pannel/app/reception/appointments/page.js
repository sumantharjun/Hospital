"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders, HOSPITALS_PATH, apiFetch, NETWORK_ERROR_MESSAGE } from "../../lib/api";
import {
  todayStr,
  getTokenForDoctorToday,
  getDoctorTodayCount,
  isFollowUp,
  isDoctorOnLeave,
  approxWaitMinutes,
  AVG_CONSULTATION_MIN,
} from "../../lib/receptionUtils";
import SuccessModal from "../../components/SuccessModal";
import { LoadingOverlay } from "../../components/LoadingSpinner";

const APPT_TYPES = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "FOLLOW_UP", label: "Follow-up" },
];

const POLL_INTERVAL_MS = 5000;
const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
];
const DEFAULT_CONSULTATION_FEE = 300;
const REGISTRATION_FEE = 50;
const FOLLOW_UP_FEE = 150;

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookForm, setBookForm] = useState({
    hospitalId: "",
    doctorId: "",
    patientId: "",
    bookingDate: todayStr(),
    slotTime: "",
    type: "WALK_IN",
    isEmergency: false,
    issue: "",
  });
  const [slots, setSlots] = useState([]);
  const [filterQueue, setFilterQueue] = useState({ hospitalId: "", doctorId: "" });
  const [successModal, setSuccessModal] = useState({ open: false, title: "", message: "" });
  const [pendingPayment, setPendingPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    consultationFee: DEFAULT_CONSULTATION_FEE,
    registrationFee: REGISTRATION_FEE,
    followUpFee: FOLLOW_UP_FEE,
    isFollowUp: false,
    paymentMode: "CASH",
  });
  const [lastReceipt, setLastReceipt] = useState(null);

  const today = todayStr();
  const maxBookingDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().split("T")[0];
  })();

  const fetchData = useCallback(async () => {
    const headers = getAuthHeaders();
    try {
      const [aptRes, docRes, patRes, hospRes] = await Promise.all([
        apiFetch(buildApiUrl("/api/appointments"), { headers }),
        apiFetch(buildApiUrl("/api/users?role=DOCTOR"), { headers }),
        apiFetch(buildApiUrl("/api/users?role=PATIENT"), { headers }),
        apiFetch(buildApiUrl(HOSPITALS_PATH), { headers }),
      ]);
      const aptRaw = aptRes.ok ? await aptRes.json() : [];
      const docRaw = docRes.ok ? await docRes.json() : [];
      const patRaw = patRes.ok ? await patRes.json() : [];
      const hospRaw = hospRes.ok ? await hospRes.json() : [];
      const apts = Array.isArray(aptRaw) ? aptRaw : Array.isArray(aptRaw?.data) ? aptRaw.data : Array.isArray(aptRaw?.appointments) ? aptRaw.appointments : [];
      const docs = Array.isArray(docRaw) ? docRaw : Array.isArray(docRaw?.data) ? docRaw.data : Array.isArray(docRaw?.users) ? docRaw.users : [];
      const pats = Array.isArray(patRaw) ? patRaw : Array.isArray(patRaw?.data) ? patRaw.data : Array.isArray(patRaw?.users) ? patRaw.users : [];
      const hosps = Array.isArray(hospRaw) ? hospRaw : Array.isArray(hospRaw?.data) ? hospRaw.data : [];
      setAppointments(apts);
      setAllDoctors(docs);
      setPatients(pats);
      setHospitals(hosps);
    } catch (e) {
      toast.error(e?.message === "BACKEND_UNREACHABLE" ? NETWORK_ERROR_MESSAGE : (e?.message || "Failed to load data"));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const doctors = bookForm.hospitalId
    ? allDoctors.filter((d) => (d.hospitalId || d.hospital) === bookForm.hospitalId)
    : allDoctors;

  useEffect(() => {
    const start = 9;
    const end = 18;
    const s = [];
    for (let h = start; h < end; h++) {
      for (let m = 0; m < 60; m += 30) {
        s.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    setSlots(s);
  }, []);

  useEffect(() => {
    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    if (!bookForm.patientId) return;
    const followUp = isFollowUp(appointments, bookForm.patientId);
    setBookForm((f) => ({ ...f, type: followUp ? "FOLLOW_UP" : f.type }));
  }, [bookForm.patientId, appointments]);

  async function bookAppointment(e) {
    e.preventDefault();
    if (!bookForm.hospitalId || !bookForm.doctorId || !bookForm.patientId || !bookForm.bookingDate || !bookForm.slotTime) {
      toast.error("Select hospital, doctor, patient, date and time slot");
      return;
    }
    const patient = patients.find((p) => (p._id || p.id) === bookForm.patientId);
    if (!patient) {
      toast.error("Patient not found. Please select a registered patient.");
      return;
    }
    const issueText = (bookForm.issue || "").trim();
    if (!issueText) {
      toast.error("Please enter chief complaint / issue for the visit.");
      return;
    }
    const doctor = doctors.find((d) => (d._id || d.id) === bookForm.doctorId);
    const bookDate = bookForm.bookingDate;
    if (isDoctorOnLeave(doctor, bookDate)) {
      toast.error("Doctor is on leave on the selected date.");
      return;
    }
    const dateCount = getDoctorTodayCount(appointments, bookForm.doctorId, bookDate);
    const maxPerDay = doctor?.maxPatientsPerDay ?? 999;
    if (dateCount >= maxPerDay) {
      toast.error("Doctor is fully booked for the selected date.");
      return;
    }
    setSaving(true);
    try {
      const [y, mo, day] = bookForm.bookingDate.split("-").map(Number);
      const appointmentDate = new Date(y, mo - 1, day);
      const [h, m] = bookForm.slotTime.split(":").map(Number);
      appointmentDate.setHours(h, m, 0, 0);
      const tokenNum = getTokenForDoctorToday(appointments, bookForm.doctorId, bookDate);
      let rawAge = patient.age != null && patient.age !== "" ? Number(patient.age) : NaN;
      if (!Number.isFinite(rawAge) && (patient.dob || patient.dateOfBirth)) {
        try {
          const birth = new Date(patient.dob || patient.dateOfBirth);
          if (!isNaN(birth.getTime())) {
            const today = new Date();
            rawAge = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) rawAge--;
          }
        } catch (_) {}
      }
      const ageInRange = Number.isFinite(rawAge) && rawAge >= 0 && rawAge <= 150 ? Math.round(rawAge) : 1;
      const payload = {
        hospitalId: bookForm.hospitalId,
        doctorId: bookForm.doctorId,
        patientId: bookForm.patientId,
        scheduledAt: appointmentDate.toISOString(),
        channel: "PHYSICAL",
        appointmentType: bookForm.type,
        isEmergency: bookForm.isEmergency,
        tokenNumber: tokenNum,
        status: "PENDING",
        patientName: patient.name || "Patient",
        age: ageInRange,
        address: (patient.address || "").trim() || "Not provided",
        issue: issueText,
      };
      const res = await fetch(buildApiUrl("/api/appointments"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Booking failed");
      const created = data.data || data.appointment || data;
      const appointmentId = created._id || created.id || data._id || data.id;
      const doc = doctors.find((d) => (d._id || d.id) === bookForm.doctorId);
      setPendingPayment({
        appointmentId,
        tokenNumber: tokenNum,
        bookingDate: bookForm.bookingDate,
        slotTime: bookForm.slotTime,
        patientName: patient.name || "Patient",
        patientId: bookForm.patientId,
        doctorName: doc?.name || "Doctor",
        hospitalId: bookForm.hospitalId,
      });
      setPaymentForm((pf) => ({
        ...pf,
        consultationFee: DEFAULT_CONSULTATION_FEE,
        registrationFee: REGISTRATION_FEE,
        isFollowUp: bookForm.type === "FOLLOW_UP",
        followUpFee: bookForm.type === "FOLLOW_UP" ? FOLLOW_UP_FEE : 0,
      }));
      toast.success("Appointment booked. Complete payment below.");
      fetchData();
    } catch (err) {
      toast.error(err.message || "Booking failed");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(aptId, newStatus) {
    try {
      const res = await fetch(buildApiUrl(`/api/appointments/${aptId}`), {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      setSuccessModal({ open: true, title: "Status updated", message: "Appointment status has been updated successfully." });
      toast.success("Status updated");
      fetchData();
    } catch (e) {
      toast.error("Failed to update status");
    }
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
      if (!res.ok) throw new Error(data.message || "Failed to delete appointment");
      setSuccessModal({ open: true, title: "Appointment deleted", message: "Appointment has been removed successfully." });
      toast.success("Appointment deleted");
      fetchData();
    } catch (e) {
      toast.error(e.message || "Failed to delete appointment");
    }
  }

  const paymentTotal = paymentForm.consultationFee + paymentForm.registrationFee + (paymentForm.isFollowUp ? (paymentForm.followUpFee || 0) : 0);

  function collectPayment(e) {
    e.preventDefault();
    if (!pendingPayment) return;
    const receipt = {
      id: "RCP-" + Date.now(),
      date: new Date().toISOString(),
      appointmentId: pendingPayment.appointmentId,
      tokenNumber: pendingPayment.tokenNumber,
      bookingDate: pendingPayment.bookingDate,
      slotTime: pendingPayment.slotTime,
      doctorName: pendingPayment.doctorName,
      hospitalId: pendingPayment.hospitalId,
      patientName: pendingPayment.patientName,
      patientId: pendingPayment.patientId,
      consultationFee: paymentForm.consultationFee,
      registrationFee: paymentForm.registrationFee,
      followUpFee: paymentForm.isFollowUp ? (paymentForm.followUpFee || 0) : 0,
      total: paymentTotal,
      paymentMode: paymentForm.paymentMode,
    };
    setLastReceipt(receipt);
    if (typeof window !== "undefined") {
      try {
        const receipts = JSON.parse(localStorage.getItem("reception_receipts") || "[]");
        receipts.push(receipt);
        localStorage.setItem("reception_receipts", JSON.stringify(receipts));
        const payments = JSON.parse(localStorage.getItem("reception_payments") || "[]");
        payments.push({ ...receipt, patientName: receipt.patientName, paymentMode: receipt.paymentMode, total: receipt.total, date: receipt.date, hospitalId: receipt.hospitalId });
        localStorage.setItem("reception_payments", JSON.stringify(payments));
      } catch (err) {}
    }
    setSuccessModal({
      open: true,
      title: "Payment collected",
      message: `₹${paymentTotal} collected via ${paymentForm.paymentMode}. Print receipt — Patient can wait for appointment at ${pendingPayment.slotTime}. Token #${pendingPayment.tokenNumber}.`,
    });
    toast.success("Payment collected. Print receipt below. Patient can wait for appointment time.");
    setPendingPayment(null);
  }

  function printReceipt() {
    if (!lastReceipt) return;
    const w = window.open("", "_blank");
    w.document.write(`
      <!DOCTYPE html><html><head><title>Receipt ${lastReceipt.id}</title></head><body style="font-family:sans-serif;padding:24px;max-width:400px;">
        <h2>OPD Receipt</h2>
        <p><strong>Receipt:</strong> ${lastReceipt.id}</p>
        <p><strong>Date:</strong> ${new Date(lastReceipt.date).toLocaleString()}</p>
        <p><strong>Patient:</strong> ${lastReceipt.patientName}</p>
        <p><strong>Token:</strong> #${lastReceipt.tokenNumber} &nbsp; <strong>Time:</strong> ${lastReceipt.slotTime}</p>
        <p><strong>Doctor:</strong> Dr. ${lastReceipt.doctorName}</p>
        <hr/>
        <p>Consultation: ₹${lastReceipt.consultationFee}</p>
        <p>Registration: ₹${lastReceipt.registrationFee}</p>
        ${lastReceipt.followUpFee ? `<p>Follow-up: ₹${lastReceipt.followUpFee}</p>` : ""}
        <p><strong>Total: ₹${lastReceipt.total}</strong></p>
        <p>Payment: ${lastReceipt.paymentMode}</p>
        <hr/>
        <p style="font-size:12px;color:#666;">Please wait for your token. Thank you.</p>
      </body></html>
    `);
    w.document.close();
    w.print();
    w.close();
  }

  const todayApts = (appointments || [])
    .filter((a) => {
      const d = a.appointmentDate || a.scheduledAt;
      const aptDate = d ? new Date(d).toISOString().split("T")[0] : "";
      if (aptDate !== today) return false;
      if (filterQueue.hospitalId && a.hospitalId !== filterQueue.hospitalId) return false;
      if (filterQueue.doctorId && a.doctorId !== filterQueue.doctorId) return false;
      return true;
    })
    .sort((a, b) => (a.tokenNumber || 0) - (b.tokenNumber || 0));

  const currentToken = todayApts.find(
    (a) => (a.status || "").toUpperCase() === "IN_PROGRESS"
  )?.tokenNumber ?? todayApts.find((a) => (a.status || "").toUpperCase() === "CHECKED_IN")?.tokenNumber;

  const getPatient = (id) => patients.find((p) => (p._id || p.id) === id);
  const getPatientName = (apt) => {
    if (!apt) return "—";
    const fromApt = apt.patientName || apt.patient?.name;
    if (fromApt) return fromApt;
    const p = getPatient(apt.patientId);
    return p?.name || "—";
  };
  const getDoctorName = (id) => allDoctors.find((d) => (d._id || d.id) === id)?.name || "—";
  const getDoctorNameFromApt = (apt) => apt?.doctorName || apt?.doctor?.name || (apt?.doctorId ? getDoctorName(apt.doctorId) : "—");
  const allDoctorsForQueue = allDoctors.length ? allDoctors : (() => {
    const ids = [...new Set(todayApts.map((a) => a.doctorId))];
    return ids.map((id) => ({ _id: id, id, name: "Doctor " + (id || "").slice(-4) }));
  })();

  const bookingDateStr = bookForm.bookingDate || today;

  function doctorAvailability(doc) {
    if (isDoctorOnLeave(doc, bookingDateStr)) return { label: "On leave", full: true };
    const count = getDoctorTodayCount(appointments, doc._id || doc.id, bookingDateStr);
    const max = doc.maxPatientsPerDay ?? 999;
    if (count >= max) return { label: "Fully booked", full: true };
    const left = max - count;
    return { label: `${left} slot(s) left`, full: false };
  }

  // Booked time slots for selected doctor on selected booking date (so we can disable them in dropdown and show grid)
  const doctorDateAppointments = (appointments || []).filter((a) => {
    const d = a.appointmentDate || a.scheduledAt;
    const aptDate = d ? new Date(d).toISOString().split("T")[0] : "";
    return aptDate === bookingDateStr && a.doctorId === bookForm.doctorId;
  });
  const bookedSlotTimes = new Set(
    doctorDateAppointments.map((a) => {
      const d = new Date(a.scheduledAt || a.appointmentDate);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    })
  );

  return (
    <div className="space-y-6">
      <SuccessModal open={successModal.open} title={successModal.title} message={successModal.message} onClose={() => setSuccessModal({ open: false, title: "", message: "" })} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">Appointments & Queue</h1>
          <p className="mt-1 text-sm text-[#4a5568]">Today&apos;s queue. Book appointments via the button below. Queue refreshes every 5s.</p>
        </div>
        <button type="button" onClick={() => { setBookModalOpen(true); setPendingPayment(null); setLastReceipt(null); setBookForm((f) => ({ ...f, doctorId: "", patientId: "", slotTime: "", issue: "", type: "WALK_IN", isEmergency: false })); }} className="gov-btn-primary px-5 py-2.5 whitespace-nowrap">
          Book appointment
        </button>
      </div>

      <div className="gov-card p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-[#2d3748]">Hospital</label>
              <select value={filterQueue.hospitalId} onChange={(e) => setFilterQueue((f) => ({ ...f, hospitalId: e.target.value }))} className="gov-select mt-1 bg-white px-3 py-2 text-sm text-[#1a202c]">
                <option value="">All</option>
                {hospitals.map((h) => (
                  <option key={h._id || h.id} value={h._id || h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2d3748]">Doctor</label>
              <select value={filterQueue.doctorId} onChange={(e) => setFilterQueue((f) => ({ ...f, doctorId: e.target.value }))} className="gov-select mt-1 bg-white px-3 py-2 text-sm text-[#1a202c]">
                <option value="">All</option>
                {allDoctorsForQueue.map((d) => (
                  <option key={d._id || d.id} value={d._id || d.id}>Dr. {d.name}</option>
                ))}
              </select>
            </div>
            {currentToken != null && (
              <div className="text-sm text-[#4a5568]">
                Current token: <span className="font-mono font-semibold">{currentToken}</span> • Approx {AVG_CONSULTATION_MIN} min per patient
              </div>
            )}
          </div>
          <div className="gov-card overflow-hidden">
            <div className="p-4 border-b border-[#cbd5e0] bg-[#f8fafc]">
              <h2 className="font-semibold text-[#1a202c]">Real-time queue — {today}</h2>
              <p className="text-sm text-[#4a5568]">Status: Check-in → With doctor → Completed. Delete is only available for PENDING, SCHEDULED or CANCELLED (not for completed visits). Queue refreshes every 5s.</p>
            </div>
            <div className="overflow-x-auto">
              {loading && todayApts.length === 0 ? (
                <LoadingOverlay text="Loading queue…" />
              ) : todayApts.length === 0 ? (
                <div className="p-8 text-center text-[#718096]">No appointments today.</div>
              ) : (
                <table className="gov-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Patient</th>
                      <th>Doctor</th>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>~Wait</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayApts.map((a) => {
                      const status = (a.status || "PENDING").toUpperCase();
                      const waitMin = approxWaitMinutes(a.tokenNumber, currentToken);
                      const patientName = getPatientName(a);
                      const doctorName = getDoctorNameFromApt(a);
                      const patient = getPatient(a.patientId);
                      const patientPhone = a.patient?.phone || a.patient?.phoneNumber || a.patient?.mobile || patient?.phone || patient?.phoneNumber || patient?.mobile;
                      const patientDetail = patientName + (patientPhone ? ` · ${patientPhone}` : "");
                      return (
                        <tr key={a._id || a.id} className={a.isEmergency ? "bg-red-50" : ""}>
                          <td className="font-mono font-semibold text-[#1a202c]">{a.tokenNumber ?? "—"}</td>
                          <td className="text-[#1a202c]" title={patientDetail}>
                            <span className="block font-medium">{patientName}</span>
                            {patientPhone && <span className="block text-xs text-[#718096]">{patientPhone}</span>}
                          </td>
                          <td className="text-[#4a5568]">Dr. {doctorName}</td>
                          <td className="text-[#4a5568]">{a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                          <td>
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${a.isEmergency ? "bg-red-50 text-red-800 border-red-600" : "bg-[#f8fafc] text-[#2d3748] border-[#cbd5e0]"}`}>
                              {a.isEmergency ? "Emergency" : (a.appointmentType || "Walk-in")}
                            </span>
                          </td>
                          <td className="text-[#4a5568]">{status}</td>
                          <td className="text-[#718096]">{status !== "COMPLETED" ? `~${waitMin} min` : "—"}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {status !== "COMPLETED" && (
                                <>
                                  {(status === "PENDING" || status === "SCHEDULED") && (
                                    <button type="button" onClick={() => updateStatus(a._id || a.id, "CHECKED_IN")} className="text-xs px-2 py-1 border border-[#cbd5e0] bg-[#f8fafc] hover:bg-[#e2e8f0]">Check-in</button>
                                  )}
                                  {status !== "IN_PROGRESS" && status !== "COMPLETED" && (
                                    <button type="button" onClick={() => updateStatus(a._id || a.id, "IN_PROGRESS")} className="text-xs px-2 py-1 bg-[#e3f2fd] text-[#0d47a1] border border-[#0d47a1] hover:bg-[#bbdefb]">With doctor</button>
                                  )}
                                  <button type="button" onClick={() => updateStatus(a._id || a.id, "COMPLETED")} className="text-xs px-2 py-1 bg-[#e8f5e9] text-[#2e7d32] border border-[#2e7d32] hover:bg-[#c8e6c9]">Done</button>
                                </>
                              )}
                              {(status === "PENDING" || status === "SCHEDULED" || status === "CANCELLED") && (
                                <button type="button" onClick={() => deleteAppointment(a._id || a.id)} className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-300 hover:bg-red-100" title="Delete appointment (only PENDING, SCHEDULED or CANCELLED can be deleted)">Delete</button>
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

      {/* Book appointment modal */}
      {bookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => e.target === e.currentTarget && (setBookModalOpen(false), setPendingPayment(null), setLastReceipt(null))}>
          <div className="gov-card w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white border-b border-[#cbd5e0] px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-[#1a202c]">Book appointment</h2>
              <button type="button" onClick={() => { setBookModalOpen(false); setPendingPayment(null); setLastReceipt(null); }} className="text-[#718096] hover:text-[#1a202c] text-2xl leading-none">&times;</button>
            </div>
            {(() => {
              const step = pendingPayment ? 2 : (lastReceipt && !pendingPayment ? 3 : 1);
              return (
                <>
                  <div className="px-6 pt-4 pb-2 flex items-center justify-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${step >= 1 ? "text-[#0d47a1]" : "text-[#a0aec0]"}`}>1. Book</span>
                    <span className="text-[#cbd5e0]">→</span>
                    <span className={`text-sm font-medium ${step >= 2 ? "text-[#0d47a1]" : "text-[#a0aec0]"}`}>2. Payment</span>
                    <span className="text-[#cbd5e0]">→</span>
                    <span className={`text-sm font-medium ${step >= 3 ? "text-[#0d47a1]" : "text-[#a0aec0]"}`}>3. Done</span>
                    {step === 2 && <span className="ml-2 text-xs px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded">Payment pending</span>}
                    {step === 3 && <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-800 border border-green-300 rounded">Payment done</span>}
                  </div>
                  <div className="px-6 pb-6">
                    {step === 1 && (hospitals.length === 0 || patients.length === 0) && (
                      <div className="mb-4 p-3 rounded bg-amber-50 text-amber-800 border border-amber-200 text-sm">
                        {hospitals.length === 0 && "No hospitals loaded. "}
                        {patients.length === 0 && "No patients loaded. "}
                        Add patients from the Patients page first. Check that the backend is running and NEXT_PUBLIC_API_BASE is set.
                      </div>
                    )}
                    {step === 1 && (
                      <form onSubmit={bookAppointment} className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-semibold text-[#2d3748]">Booking date *</label>
              <input
                type="date"
                required
                min={today}
                max={maxBookingDate}
                value={bookForm.bookingDate}
                onChange={(e) => setBookForm((f) => ({ ...f, bookingDate: e.target.value, doctorId: "", slotTime: "" }))}
                className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]"
              />
              <p className="mt-1 text-xs text-[#718096]">Slots shown below are for this date. You can book up to 60 days ahead.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#2d3748]">Hospital *</label>
              <select required value={bookForm.hospitalId} onChange={(e) => setBookForm((f) => ({ ...f, hospitalId: e.target.value, doctorId: "" }))} className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                <option value="">Select hospital</option>
                {hospitals.map((h) => (
                  <option key={h._id || h.id} value={h._id || h.id}>{h.name} {h.branchCode ? `(${h.branchCode})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#2d3748]">Doctor *</label>
              <select required value={bookForm.doctorId} onChange={(e) => setBookForm((f) => ({ ...f, doctorId: e.target.value }))} className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                <option value="">Select doctor</option>
                {doctors.filter((d) => d.isActive !== false).map((d) => {
                  const avail = doctorAvailability(d);
                  return (
                    <option key={d._id || d.id} value={d._id || d.id} disabled={avail.full}>
                      Dr. {d.name} {d.specialization ? `(${d.specialization})` : ""} — {avail.label}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#2d3748]">Patient *</label>
              <select required value={bookForm.patientId} onChange={(e) => setBookForm((f) => ({ ...f, patientId: e.target.value }))} className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p._id || p.id} value={p._id || p.id}>{p.name} — {p.phone || p.phoneNumber || p.mobile || "—"}</option>
                ))}
              </select>
              {bookForm.patientId && isFollowUp(appointments, bookForm.patientId) && (
                <p className="mt-1 text-xs text-[#b45309]">Follow-up visit (last visit &lt; 7 days). Apply follow-up fee in Billing.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#2d3748]">Chief complaint / Issue *</label>
              <input
                type="text"
                required
                value={bookForm.issue}
                onChange={(e) => setBookForm((f) => ({ ...f, issue: e.target.value }))}
                placeholder="e.g. Fever, General check-up, Follow-up"
                className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c] placeholder:text-[#718096]"
              />
              <p className="mt-1 text-xs text-[#718096]">Reason for visit.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#2d3748]">Time slot *</label>
              <select required value={bookForm.slotTime} onChange={(e) => setBookForm((f) => ({ ...f, slotTime: e.target.value }))} className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                <option value="">Select time</option>
                {slots.map((s) => {
                  const isBooked = bookedSlotTimes.has(s);
                  return (
                    <option key={s} value={s} disabled={isBooked}>{s}{isBooked ? " (booked)" : ""}</option>
                  );
                })}
              </select>
              {bookForm.doctorId && (
                <div className="mt-2 p-3 gov-card bg-[#f8fafc]">
                  <p className="text-xs font-semibold text-[#4a5568] mb-2">Doctor&apos;s slots on {bookingDateStr} — green = available, red = booked</p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map((s) => {
                      const isBooked = bookedSlotTimes.has(s);
                      return (
                        <span
                          key={s}
                          className={`inline-flex items-center px-2 py-1 text-xs font-medium border ${isBooked ? "bg-red-50 text-red-800 border-red-600" : "bg-[#e8f5e9] text-[#2e7d32] border-[#2e7d32]"}`}
                        >
                          {s}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-sm font-semibold text-[#2d3748]">Type</label>
                <select value={bookForm.type} onChange={(e) => setBookForm((f) => ({ ...f, type: e.target.value }))} className="gov-select mt-1 bg-white px-4 py-2 text-[#1a202c]">
                  {APPT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={bookForm.isEmergency} onChange={(e) => setBookForm((f) => ({ ...f, isEmergency: e.target.checked }))} className="border-[#a0aec0] text-red-600 focus:ring-[#1565c0]" />
                  <span className="text-sm font-semibold text-[#2d3748]">Emergency</span>
                </label>
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full gov-btn-primary py-2.5 disabled:opacity-50">
              {saving ? "Booking…" : "Book & get token"}
            </button>
          </form>
                    )}
                    {step === 2 && pendingPayment && (
                      <div className="pt-4 border-t border-[#e2e8f0]">
                        <p className="text-sm text-[#4a5568] mb-4">
                          <strong>{pendingPayment.patientName}</strong> — Token #<strong>{pendingPayment.tokenNumber}</strong> at <strong>{pendingPayment.slotTime}</strong> with Dr. {pendingPayment.doctorName}. Collect fee; then patient can wait for appointment time.
                        </p>
                        <form onSubmit={collectPayment} className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-[#2d3748]">Consultation fee (₹)</label>
                            <input type="number" min="0" value={paymentForm.consultationFee} onChange={(e) => setPaymentForm((f) => ({ ...f, consultationFee: Number(e.target.value) || 0 }))} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-[#2d3748]">Registration fee (₹)</label>
                            <input type="number" min="0" value={paymentForm.registrationFee} onChange={(e) => setPaymentForm((f) => ({ ...f, registrationFee: Number(e.target.value) || 0 }))} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" />
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id="payFollowUp" checked={paymentForm.isFollowUp} onChange={(e) => setPaymentForm((f) => ({ ...f, isFollowUp: e.target.checked, followUpFee: e.target.checked ? FOLLOW_UP_FEE : 0 }))} className="border-[#a0aec0] text-[#1565c0]" />
                            <label htmlFor="payFollowUp" className="text-sm font-semibold text-[#2d3748]">Follow-up visit</label>
                          </div>
                          {paymentForm.isFollowUp && (
                            <div>
                              <label className="block text-sm font-semibold text-[#2d3748]">Follow-up fee (₹)</label>
                              <input type="number" min="0" value={paymentForm.followUpFee || FOLLOW_UP_FEE} onChange={(e) => setPaymentForm((f) => ({ ...f, followUpFee: Number(e.target.value) || 0 }))} className="gov-input mt-1 w-full bg-white px-4 py-2 text-[#1a202c]" />
                            </div>
                          )}
                          <div>
                            <label className="block text-sm font-semibold text-[#2d3748]">Payment mode</label>
                            <select value={paymentForm.paymentMode} onChange={(e) => setPaymentForm((f) => ({ ...f, paymentMode: e.target.value }))} className="gov-select mt-1 w-full bg-white px-4 py-2 text-[#1a202c]">
                              {PAYMENT_MODES.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          </div>
                          <p className="text-lg font-bold text-[#1a202c]">Total: ₹{paymentTotal}</p>
                          <button type="submit" className="w-full gov-btn-primary py-2.5">Collect payment & generate receipt</button>
                          <button type="button" onClick={() => setPendingPayment(null)} className="w-full border border-[#cbd5e0] py-2.5 text-sm font-medium text-[#2d3748] bg-white hover:bg-[#f8fafc]">Skip payment for now</button>
                        </form>
                      </div>
                    )}
                    {step === 3 && lastReceipt && (
                      <div className="pt-4 border-t border-[#e2e8f0]">
                        <div className="p-4 bg-green-50 border border-green-200 rounded mb-4">
                          <p className="font-semibold text-green-800">Payment done</p>
                          <p className="text-sm text-green-700 mt-1">{lastReceipt.patientName} — Token #{lastReceipt.tokenNumber} at {lastReceipt.slotTime} — ₹{lastReceipt.total}</p>
                          <p className="text-xs text-green-600 mt-1">Patient can wait for appointment time.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={printReceipt} className="gov-btn-primary py-2 px-4">Print receipt</button>
                          <button type="button" onClick={() => { setLastReceipt(null); setBookForm((f) => ({ ...f, doctorId: "", patientId: "", slotTime: "", issue: "", type: "WALK_IN", isEmergency: false })); }} className="border border-[#0d47a1] text-[#0d47a1] py-2 px-4 hover:bg-[#e3f2fd]">Book another</button>
                          <button type="button" onClick={() => { setBookModalOpen(false); setPendingPayment(null); setLastReceipt(null); }} className="border border-[#cbd5e0] py-2 px-4 text-[#2d3748] bg-white hover:bg-[#f8fafc]">Close</button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
