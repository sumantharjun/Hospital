"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPatch } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";

interface Patient {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

interface PatientRecord {
  _id: string;
  patientId: string;
  diagnosis?: string[];
  allergies?: string[];
  currentMedications?: string[];
  pastSurgeries?: string[];
  hospitalizationHistory?: Array<{
    date: string;
    reason: string;
    duration?: string;
  }>;
  labReports?: Array<{
    date: string;
    testName: string;
    results: string;
    fileUrl?: string;
  }>;
  notes?: string;
}

interface Appointment {
  _id: string;
  scheduledAt: string;
  status: string;
  issue: string;
  channel: string;
  hospitalId?: string;
  hospital?: { name: string };
}

interface Prescription {
  _id: string;
  items: Array<{
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes?: string;
  }>;
  createdAt: string;
  notes?: string;
  suggestions?: string;
}

export default function PatientHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "appointments" | "prescriptions" | "records">("overview");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        router.replace("/");
        return;
      }
      
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
  }, [router]);

  const fetchData = async () => {
    if (!token || !patientId) return;
    
    try {
      const [patientData, recordData, appointmentsData, prescriptionsData] = await Promise.all([
        apiGet<Patient>(`/api/users/${patientId}`).catch(() => null),
        apiGet<PatientRecord>(`/api/patient-records/${patientId}`).catch(() => null),
        apiGet<Appointment[]>(`/api/appointments?patientId=${patientId}`).catch(() => []),
        apiGet<Prescription[]>(`/api/prescriptions?patientId=${patientId}`).catch(() => []),
      ]);

      setPatient(patientData);
      setRecord(recordData);
      
      // Enrich appointments with hospital data
      const enrichedAppointments = await Promise.all(
        (Array.isArray(appointmentsData) ? appointmentsData : []).map(async (apt): Promise<Appointment> => {
          try {
            const hospital = apt.hospitalId 
              ? await apiGet<{ name: string }>(`/api/master/hospitals/${apt.hospitalId}`).catch(() => null)
              : null;
            return { ...apt, hospital: hospital || undefined };
          } catch {
            return apt;
          }
        })
      );
      
      setAppointments(enrichedAppointments);
      setPrescriptions(Array.isArray(prescriptionsData) ? prescriptionsData : []);
    } catch (error: any) {
      console.error("Error fetching patient data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !patientId) return;
    fetchData();
  }, [token, patientId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "COMPLETED":
        return "bg-blue-100 text-blue-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Patient History" description="Loading patient history...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading patient history...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!patient) {
    return (
      <DashboardLayout title="Patient History" description="Patient not found">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Patient Not Found</h2>
            <Link href="/appointments" className="text-blue-900 hover:text-blue-800">
              Back to Appointments
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Patient Medical History"
      description={`Complete medical history for ${patient.name}`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Patient Info Card */}
        <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{patient.name}</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <span className="text-sm text-gray-600">Email:</span>
                  <p className="font-semibold text-gray-900">{patient.email}</p>
                </div>
                {patient.phone && (
                  <div>
                    <span className="text-sm text-gray-600">Phone:</span>
                    <p className="font-semibold text-gray-900">
                      <a href={`tel:${patient.phone}`} className="text-blue-900 hover:text-blue-800">
                        {patient.phone}
                      </a>
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-600">Total Appointments:</span>
                  <p className="font-semibold text-gray-900">{appointments.length}</p>
                </div>
              </div>
            </div>
            <Link
              href="/appointments"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {[
              { id: "overview", label: "📋 Overview", icon: "📋" },
              { id: "appointments", label: "📅 Appointments", icon: "📅" },
              { id: "prescriptions", label: "💊 Prescriptions", icon: "💊" },
              { id: "records", label: "🏥 Medical Records", icon: "🏥" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-900 text-blue-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Quick Stats */}
            <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-gray-700">Total Appointments</span>
                  <span className="text-2xl font-bold text-blue-900">{appointments.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-700">Completed</span>
                  <span className="text-2xl font-bold text-green-900">
                    {appointments.filter((apt) => apt.status === "COMPLETED").length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="text-gray-700">Prescriptions</span>
                  <span className="text-2xl font-bold text-purple-900">{prescriptions.length}</span>
                </div>
              </div>
            </div>

            {/* Medical Summary */}
            {record && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Medical Summary</h3>
                <div className="space-y-4">
                  {record.diagnosis && record.diagnosis.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Diagnosis</h4>
                      <div className="flex flex-wrap gap-2">
                        {record.diagnosis.map((diag, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800"
                          >
                            {diag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {record.allergies && record.allergies.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-700 mb-2">⚠️ Allergies</h4>
                      <div className="flex flex-wrap gap-2">
                        {record.allergies.map((allergy, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                          >
                            {allergy}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {record.currentMedications && record.currentMedications.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Current Medications</h4>
                      <ul className="space-y-1">
                        {record.currentMedications.map((med, idx) => (
                          <li key={idx} className="text-sm text-gray-700">• {med}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "appointments" && (
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Appointment History</h3>
            {appointments.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📅</div>
                <p className="text-gray-600">No appointments found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments
                  .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                  .map((apt) => (
                    <div
                      key={apt._id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-gray-900">{formatDate(apt.scheduledAt)}</p>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(apt.status)}`}>
                              {apt.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-1">
                            <strong>Issue:</strong> {apt.issue}
                          </p>
                          <p className="text-sm text-gray-600">
                            {apt.channel === "VIDEO" ? "🖥️ Online" : "🏥 Offline"}
                            {apt.hospital && ` | ${apt.hospital.name}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "prescriptions" && (
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Prescription History</h3>
            {prescriptions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">💊</div>
                <p className="text-gray-600">No prescriptions found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {prescriptions
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((prescription) => (
                    <div
                      key={prescription._id}
                      className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-gray-900">
                          {formatDate(prescription.createdAt)}
                        </p>
                        <span className="text-xs text-gray-500">
                          {prescription.items.length} {prescription.items.length === 1 ? "medicine" : "medicines"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {prescription.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-900"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">{item.medicineName}</p>
                                <p className="text-sm text-gray-700 mt-1">
                                  <span className="font-medium">Dosage:</span> {item.dosage} |{" "}
                                  <span className="font-medium">Frequency:</span> {item.frequency} |{" "}
                                  <span className="font-medium">Duration:</span> {item.duration}
                                </p>
                                {item.notes && (
                                  <p className="text-xs text-gray-600 mt-1 italic">{item.notes}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {prescription.notes && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Notes:</strong> {prescription.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "records" && record && (
          <div className="space-y-6">
            {/* Diagnosis */}
            <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Diagnosis History</h3>
              {record.diagnosis && record.diagnosis.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {record.diagnosis.map((diag, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800"
                    >
                      {diag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No diagnosis recorded.</p>
              )}
            </div>

            {/* Allergies */}
            <div className="rounded-lg border border-red-300 bg-red-50 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-red-900 mb-4">⚠️ Allergies</h3>
              {record.allergies && record.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {record.allergies.map((allergy, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-red-200 px-4 py-2 text-sm font-semibold text-red-900"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No allergies recorded.</p>
              )}
            </div>

            {/* Current Medications */}
            <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Current Medications</h3>
              {record.currentMedications && record.currentMedications.length > 0 ? (
                <ul className="space-y-2">
                  {record.currentMedications.map((med, idx) => (
                    <li key={idx} className="p-3 bg-gray-50 rounded-lg text-gray-700">
                      • {med}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">No current medications.</p>
              )}
            </div>

            {/* Past Surgeries */}
            {record.pastSurgeries && record.pastSurgeries.length > 0 && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Past Surgeries</h3>
                <ul className="space-y-2">
                  {record.pastSurgeries.map((surgery, idx) => (
                    <li key={idx} className="p-3 bg-gray-50 rounded-lg text-gray-700">
                      • {surgery}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lab Reports */}
            {record.labReports && record.labReports.length > 0 && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Lab Reports</h3>
                <div className="space-y-3">
                  {record.labReports.map((report, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-900">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{report.testName}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {new Date(report.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-700 mt-2">{report.results}</p>
                        </div>
                        {report.fileUrl && (
                          <a
                            href={report.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-blue-900 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800"
                          >
                            View File
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hospitalization History */}
            {record.hospitalizationHistory && record.hospitalizationHistory.length > 0 && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Hospitalization History</h3>
                <div className="space-y-3">
                  {record.hospitalizationHistory.map((hosp, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-semibold text-gray-900">{hosp.reason}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(hosp.date).toLocaleDateString()}
                        {hosp.duration && ` | Duration: ${hosp.duration}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {record.notes && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Additional Notes</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{record.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
