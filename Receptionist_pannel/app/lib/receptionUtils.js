

export const todayStr = () => new Date().toISOString().split("T")[0];

/** Format: HSP001-DR02-240226-015 (HospitalCode-DoctorCode-DDMMYY-Token) */
export function formatOpdNumber(hospitalCode = "OPD", doctorCode = "00", tokenNum = 1) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const token = String(tokenNum).padStart(3, "0");
  return `${hospitalCode}-${doctorCode}-${dd}${mm}${yy}-${token}`;
}

/** Get next token number for this doctor for today (per doctor per day) */
export function getTokenForDoctorToday(appointments, doctorId, dateStr) {
  const dayApts = (appointments || []).filter((a) => {
    const d = a.appointmentDate || a.scheduledAt;
    const aptDate = d ? new Date(d).toISOString().split("T")[0] : "";
    return aptDate === dateStr && (a.doctorId === doctorId);
  });
  const maxToken = dayApts.reduce((acc, a) => Math.max(acc, a.tokenNumber || 0), 0);
  return maxToken + 1;
}

/** Today's appointment count for doctor (for "Fully Booked" check) */
export function getDoctorTodayCount(appointments, doctorId, dateStr) {
  return (appointments || []).filter((a) => {
    const d = a.appointmentDate || a.scheduledAt;
    const aptDate = d ? new Date(d).toISOString().split("T")[0] : "";
    return aptDate === dateStr && a.doctorId === doctorId && (a.status || "").toUpperCase() !== "CANCELLED";
  }).length;
}

/** Is patient follow-up? (last visit within last 7 days) */
export function isFollowUp(appointments, patientId) {
  if (!patientId || !Array.isArray(appointments)) return false;
  const patientApts = appointments
    .filter((a) => a.patientId === patientId && (a.status || "").toUpperCase() === "COMPLETED")
    .map((a) => new Date(a.scheduledAt || a.appointmentDate).getTime())
    .filter(Boolean)
    .sort((a, b) => b - a);
  if (patientApts.length === 0) return false;
  const lastVisit = patientApts[0];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return lastVisit >= sevenDaysAgo;
}

/** Is doctor on leave on given date? (leaveDates: string[] of "YYYY-MM-DD") */
export function isDoctorOnLeave(doctor, dateStr) {
  const leaveDates = doctor?.leaveDates || [];
  return leaveDates.some((d) => d === dateStr);
}

/** Average consultation minutes for queue wait estimate */
export const AVG_CONSULTATION_MIN = 10;

/** Approx wait time in minutes: (myToken - currentToken) * avgConsultation */
export function approxWaitMinutes(myToken, currentToken) {
  const diff = Math.max(0, (myToken || 0) - (currentToken || 0));
  return diff * AVG_CONSULTATION_MIN;
}
