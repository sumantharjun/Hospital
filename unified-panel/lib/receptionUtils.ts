export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function formatOpdNumber(hospitalCode: string, doctorCode: string, tokenNum: number): string {
  const hCode = (hospitalCode || "HOS").toUpperCase().slice(0, 3);
  const dCode = (doctorCode || "DOC").toUpperCase().slice(0, 3);
  const token = String(tokenNum).padStart(3, "0");
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `${hCode}-${dCode}-${dateStr}-${token}`;
}

export function getTokenForDoctorToday(
  appointments: any[],
  doctorId: string,
  dateStr: string
): number {
  return (appointments || []).filter((a) => {
    const d = a.appointmentDate || a.scheduledAt;
    return (
      (a.doctorId === doctorId || a.doctor === doctorId) &&
      d &&
      new Date(d).toISOString().split("T")[0] === dateStr
    );
  }).length + 1;
}

export function getDoctorTodayCount(
  appointments: any[],
  doctorId: string,
  dateStr: string
): number {
  return (appointments || []).filter((a) => {
    const d = a.appointmentDate || a.scheduledAt;
    return (
      (a.doctorId === doctorId || a.doctor === doctorId) &&
      d &&
      new Date(d).toISOString().split("T")[0] === dateStr
    );
  }).length;
}

export function isFollowUp(appointments: any[], patientId: string): boolean {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return (appointments || []).some((a) => {
    const d = a.appointmentDate || a.scheduledAt;
    return (
      (a.patientId === patientId || a.patient === patientId) &&
      d &&
      new Date(d) >= sevenDaysAgo
    );
  });
}

export function isDoctorOnLeave(doctor: any, dateStr: string): boolean {
  if (!doctor?.leaves) return false;
  return doctor.leaves.some((l: any) => {
    const from = l.from || l.startDate;
    const to = l.to || l.endDate;
    if (!from || !to) return false;
    return dateStr >= from.slice(0, 10) && dateStr <= to.slice(0, 10);
  });
}

export const AVG_CONSULTATION_MIN = 10;

export function approxWaitMinutes(myToken: number, currentToken: number): number {
  const behind = Math.max(0, myToken - currentToken);
  return behind * AVG_CONSULTATION_MIN;
}
