"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";
import DashboardLayout from "@/components/DashboardLayout";
import { DownloadIcon, EyeIcon, RecordsIcon } from "@/components/icons";

interface Appointment {
  _id: string;
  hospitalId: string;
  doctorId: string;
  patientId: string;
  status: string;
  patientName: string;
  age: number;
  address: string;
  issue: string;
  scheduledAt: string;
  channel: string;
  doctor?: { name: string; specialization?: string };
  hospital?: { name: string; address?: string };
  prescription?: {
    _id: string;
    items: Array<{
      medicineName: string;
      dosage: string;
      frequency: string;
      duration: string;
      notes?: string;
    }>;
    suggestions?: string;
    notes?: string;
  };
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [viewingPrescription, setViewingPrescription] = useState<{ prescription: Appointment["prescription"]; appointment: Appointment } | null>(null);
  const [prescriptionDocument, setPrescriptionDocument] = useState<string | null>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);

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
      // Socket is already initialized in SocketProvider, no need to initialize again
    }
  }, [router]);

  // Listen for real-time notifications and appointment updates
  useEffect(() => {
    if (!token || !user) return;

    const socket = getSocket();
    if (!socket) return;

    const handleNotification = (data: any) => {
      console.log("Received notification:", data);
      // Refresh appointments when notification is received
      fetchAppointments();
      
      // Show toast notification if available
      if (data.title && data.message) {
        toast.success(`${data.title}: ${data.message}`, {
          duration: 5000,
        });
      }
    };

    const handleAppointmentUpdate = () => {
      console.log("Appointment status updated, refreshing...");
      fetchAppointments();
    };

    const handlePrescriptionCreated = () => {
      console.log("Prescription created, refreshing...");
      fetchAppointments();
    };

    onSocketEvent("notification:new", handleNotification);
    onSocketEvent("appointment:statusUpdated", handleAppointmentUpdate);
    onSocketEvent("prescription:created", handlePrescriptionCreated);
    
    return () => {
      offSocketEvent("notification:new", handleNotification);
      offSocketEvent("appointment:statusUpdated", handleAppointmentUpdate);
      offSocketEvent("prescription:created", handlePrescriptionCreated);
    };
  }, [token, user]);

  const fetchAppointments = async () => {
    if (!token || !user) return;
    
    // Get patientId - try both id and _id
    const patientId = user.id || user._id;
    if (!patientId) {
      console.error("No patient ID found in user object:", user);
      setLoading(false);
      return;
    }
    
    try {
      console.log("Fetching appointments for patientId:", patientId);
      const data = await apiGet<any[]>(`/api/appointments?patientId=${patientId}`);
      console.log("Received appointments:", data);
      const appointmentsList = Array.isArray(data) ? data : [];
      
      // Fetch prescriptions for each appointment
      const enrichedAppointments: Appointment[] = await Promise.all(
        appointmentsList.map(async (apt: any): Promise<Appointment> => {
          // Ensure doctor and hospital are properly formatted
          const doctor = apt.doctor ? {
            name: String(apt.doctor.name || "Unknown Doctor"),
            specialization: apt.doctor.specialization ? String(apt.doctor.specialization) : undefined,
          } : undefined;
          
          const hospital = apt.hospital ? {
            name: String(apt.hospital.name || "Unknown Hospital"),
            address: apt.hospital.address ? String(apt.hospital.address) : undefined,
          } : undefined;
          
          // Fetch prescription for this appointment
          let prescription: Appointment["prescription"] = undefined;
          try {
            const prescriptions = await apiGet<any[]>(`/api/prescriptions?appointmentId=${apt._id}`);
            const prescriptionList = Array.isArray(prescriptions) ? prescriptions : [];
            if (prescriptionList.length > 0) {
              prescription = prescriptionList[0];
            }
          } catch (error) {
            // Prescription not found or error - continue without it
            console.log("No prescription found for appointment:", apt._id);
          }
          
          // Map to Appointment type, ensuring all required fields are present
          return {
            _id: String(apt._id ?? ""),
            hospitalId: String(apt.hospitalId ?? ""),
            doctorId: String(apt.doctorId ?? ""),
            patientId: String(apt.patientId ?? ""),
            status: String(apt.status ?? ""),
            patientName: String(apt.patientName ?? ""),
            age: Number(apt.age ?? 0),
            address: String(apt.address ?? ""),
            issue: String(apt.issue ?? ""),
            scheduledAt: String(apt.scheduledAt ?? ""),
            channel: String(apt.channel ?? ""),
            doctor,
            hospital,
            prescription,
          };
        })
      );
      
      setAppointments(enrichedAppointments);
    } catch (error: any) {
      console.error("Error fetching appointments:", error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    const patientId = user.id || user._id;
    if (!patientId) return;
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id, user?._id]);

  // Listen for real-time updates
  useEffect(() => {
    if (!token || !user?.id) return;

    const socket = getSocket();
    if (!socket) return;

    const handleAppointmentUpdate = () => {
      fetchAppointments();
    };

    const handleNotification = (data: any) => {
      console.log("Received notification:", data);
      fetchAppointments();
      
      // Show toast for important notifications
      if (data.title && data.message) {
        toast.success(`${data.title}: ${data.message}`, {
          duration: 5000,
        });
      }
    };

    onSocketEvent("appointment:statusUpdated", handleAppointmentUpdate);
    onSocketEvent("appointment:created", handleAppointmentUpdate);
    onSocketEvent("prescription:created", handleAppointmentUpdate);
    onSocketEvent("prescription:finalized", handleAppointmentUpdate);
    onSocketEvent("notification:new", handleNotification);
    onSocketEvent("message:created", handleAppointmentUpdate);
    onSocketEvent("consultation:started", handleNotification);
    
    return () => {
      offSocketEvent("appointment:statusUpdated", handleAppointmentUpdate);
      offSocketEvent("appointment:created", handleAppointmentUpdate);
      offSocketEvent("prescription:created", handleAppointmentUpdate);
      offSocketEvent("prescription:finalized", handleAppointmentUpdate);
      offSocketEvent("notification:new", handleNotification);
      offSocketEvent("message:created", handleAppointmentUpdate);
      offSocketEvent("consultation:started", handleNotification);
    };
  }, [token, user?.id]);

  const handleCancel = async (appointmentId: string) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    
    try {
      await apiPatch(`/api/appointments/${appointmentId}/cancel`, {
        cancellationReason: "Cancelled by patient",
      });
      fetchAppointments();
      toast.success("Appointment cancelled successfully");
    } catch (error: any) {
      toast.error("Failed to cancel appointment: " + (error.message || "Unknown error"));
    }
  };

  const handleMarkCompleted = async (appointmentId: string) => {
    if (!window.confirm("Mark this appointment as completed?")) return;
    
    try {
      await apiPatch(`/api/appointments/${appointmentId}/status`, {
        status: "COMPLETED",
      });
      fetchAppointments();
      toast.success("Appointment marked as completed");
    } catch (error: any) {
      toast.error("Failed to mark appointment as completed: " + (error.message || "Unknown error"));
    }
  };

  const handleOrderMedicines = (prescription: Appointment["prescription"]) => {
    if (!prescription || !prescription.items || prescription.items.length === 0) {
      toast.error("No medicines in prescription to order");
      return;
    }

    // Convert prescription items to order items
    const orderItems = prescription.items.map(item => ({
      medicineName: item.medicineName,
      quantity: 1, // Default quantity, can be adjusted
    }));

    // Store in sessionStorage and redirect to new order page
    sessionStorage.setItem("prescriptionOrder", JSON.stringify({
      items: orderItems,
      prescriptionId: prescription._id,
    }));
    
    router.push("/orders/new");
  };

  const handleViewPrescription = async (prescription: Appointment["prescription"], appointment: Appointment) => {
    if (!prescription || !token) return;
    
    setViewingPrescription({ prescription, appointment });
    setLoadingPrescription(true);
    setPrescriptionDocument(null);
    
    try {
      const hospitalId = appointment.hospitalId;
      const url = hospitalId 
        ? `/api/prescriptions/${prescription._id}/document?hospitalId=${hospitalId}`
        : `/api/prescriptions/${prescription._id}/document`;
      const data = await apiGet<{ rendered: string; template: string }>(url);
      setPrescriptionDocument(data.rendered);
    } catch (error: any) {
      console.error("Error fetching prescription document:", error);
      // If template fails, we'll show simple view
      setPrescriptionDocument(null);
    } finally {
      setLoadingPrescription(false);
    }
  };

  const handleDownloadPrescription = async (prescription: Appointment["prescription"], appointment: Appointment) => {
    if (!prescription || !token) return;
    
    try {
      const hospitalId = appointment.hospitalId;
      const url = hospitalId 
        ? `/api/prescriptions/${prescription._id}/document?hospitalId=${hospitalId}`
        : `/api/prescriptions/${prescription._id}/document`;
      const data = await apiGet<{ rendered: string; template: string }>(url);
      
      // Create a blob from HTML
      const blob = new Blob([data.rendered], { type: "text/html" });
      const url_blob = URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const a = document.createElement("a");
      a.href = url_blob;
      a.download = `prescription-${prescription._id.slice(-8)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url_blob);
      
      // Also open print dialog for PDF conversion
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(data.rendered);
        printWindow.document.close();
        // User can save as PDF from print dialog
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (error: any) {
      console.error("Error downloading prescription:", error);
      toast.error("Failed to download prescription: " + (error.message || "Unknown error"));
    }
  };

  const handleDelete = async (appointmentId: string) => {
    if (!window.confirm("Are you sure you want to delete this appointment? This action cannot be undone.")) return;
    
    try {
      await apiDelete(`/api/appointments/${appointmentId}`);
      fetchAppointments();
      toast.success("Appointment deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete appointment: " + (error.message || "Unknown error"));
    }
  };

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
        return "bg-green-100 text-green-800 border-green-300";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "COMPLETED":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="My Appointments" description="Loading your appointments...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading appointments...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My Appointments"
      description="View and manage your appointments"
      actionButton={
        <Link
          href="/appointments/book"
          className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
        >
          Book Appointment
        </Link>
      }
    >
      <div className="max-w-7xl mx-auto">
        {appointments.length === 0 ? (
          <div className="rounded-lg border border-gray-300 bg-white p-6 sm:p-12 text-center shadow-sm">
            <div className="text-4xl sm:text-6xl mb-4">📅</div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Appointments</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-6">You don't have any appointments yet.</p>
            <Link
              href="/appointments/book"
              className="inline-block rounded-lg bg-blue-900 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              Book Your First Appointment
            </Link>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {appointments.map((appointment) => (
              <div
                key={appointment._id}
                className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg sm:text-xl flex-shrink-0">
                        👨‍⚕️
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-xl font-bold text-gray-900 truncate">
                          Dr. {appointment.doctor?.name || "Doctor"}
                        </h3>
                        {appointment.doctor?.specialization && (
                          <p className="text-xs sm:text-sm text-blue-600 font-medium truncate">
                            {appointment.doctor.specialization}
                          </p>
                        )}
                      </div>
                      <span className={`rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold whitespace-nowrap ${getStatusColor(appointment.status)}`}>
                        {appointment.status === "CONFIRMED" ? "Appointment Received" : appointment.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500">🏥</span>
                        <div>
                          <p className="text-xs text-gray-500">Hospital</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {appointment.hospital?.name || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500">📅</span>
                        <div>
                          <p className="text-xs text-gray-500">Scheduled</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatDate(appointment.scheduledAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500">💬</span>
                        <div>
                          <p className="text-xs text-gray-500">Issue</p>
                          <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                            {appointment.issue}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500">📱</span>
                        <div>
                          <p className="text-xs text-gray-500">Type</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {appointment.channel === "VIDEO" ? "Online" : "Offline"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {appointment.prescription && (
                      <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 flex-shrink-0">
                              <RecordsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-700" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-green-900 mb-1">
                                ✓ Prescription Available
                              </p>
                              <p className="text-[10px] sm:text-xs text-green-700">
                                {appointment.prescription.items.length} medicine(s) prescribed
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleViewPrescription(appointment.prescription, appointment)}
                              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors"
                            >
                              <EyeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="hidden xs:inline">View</span>
                            </button>
                            <button
                              onClick={() => handleDownloadPrescription(appointment.prescription, appointment)}
                              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs sm:text-sm font-semibold hover:bg-green-700 shadow-sm transition-colors"
                            >
                              <DownloadIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="hidden xs:inline">Download</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-row sm:flex-col gap-2 sm:min-w-[140px] flex-wrap sm:flex-nowrap">
                    {appointment.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => router.push(`/appointments/reschedule/${appointment._id}`)}
                          className="rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors whitespace-nowrap"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancel(appointment._id)}
                          className="rounded-lg border border-red-300 bg-red-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-red-700 hover:bg-red-100 shadow-sm transition-colors whitespace-nowrap"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(appointment._id)}
                          className="rounded-lg border border-red-500 bg-red-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-red-700 shadow-sm transition-colors whitespace-nowrap"
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )}
                    {appointment.status === "CANCELLED" && (
                      <button
                        onClick={() => handleDelete(appointment._id)}
                        className="rounded-lg border border-red-500 bg-red-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-red-700 shadow-sm transition-colors whitespace-nowrap"
                      >
                        🗑️ Delete
                      </button>
                    )}
                    {appointment.status === "CONFIRMED" && (
                      <>
                        <Link
                          href={`/consultation/${appointment._id}`}
                          className="rounded-lg bg-purple-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-purple-700 shadow-sm transition-colors text-center whitespace-nowrap"
                        >
                          💬 Chat
                        </Link>
                        {appointment.prescription && (
                          <button
                            onClick={() => handleOrderMedicines(appointment.prescription)}
                            className="rounded-lg bg-green-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-green-700 shadow-sm transition-colors whitespace-nowrap"
                          >
                            Order
                          </button>
                        )}
                        <button
                          onClick={() => handleMarkCompleted(appointment._id)}
                          className="rounded-lg bg-blue-900 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-800 shadow-sm transition-colors whitespace-nowrap"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => handleCancel(appointment._id)}
                          className="rounded-lg border border-red-300 bg-red-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-red-700 hover:bg-red-100 shadow-sm transition-colors whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {appointment.status === "COMPLETED" && (
                      <div className="text-center space-y-2 w-full sm:w-auto">
                        <span className="text-xs sm:text-sm font-semibold text-blue-900 block">✓ Completed</span>
                        <Link
                          href={`/consultation/${appointment._id}`}
                          className="block w-full rounded-lg bg-purple-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-purple-700 shadow-sm transition-colors"
                        >
                          💬 View Chat
                        </Link>
                        {appointment.prescription && (
                          <button
                            onClick={() => handleOrderMedicines(appointment.prescription)}
                            className="w-full rounded-lg bg-green-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-green-700 shadow-sm transition-colors"
                          >
                            Order Medicines
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Prescription View Modal */}
        {viewingPrescription && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100/50">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <RecordsIcon className="w-5 h-5 sm:w-7 sm:h-7 text-blue-600 flex-shrink-0" />
                    <span className="truncate">Prescription Details</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                    Dr. {viewingPrescription.appointment.doctor?.name || "Doctor"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setViewingPrescription(null);
                    setPrescriptionDocument(null);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingPrescription ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                      <p className="mt-4 text-gray-600 font-medium">Loading prescription...</p>
                    </div>
                  </div>
                ) : prescriptionDocument ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div
                      className="prescription-template"
                      dangerouslySetInnerHTML={{ __html: prescriptionDocument }}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Simple View */}
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Prescribed Medicines</h3>
                      <div className="space-y-3">
                        {viewingPrescription.prescription?.items.map((item, index) => (
                          <div
                            key={index}
                            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-sm">
                                {index + 1}
                              </div>
                              <h4 className="font-bold text-gray-900">{item.medicineName}</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm ml-11">
                              <div>
                                <p className="text-xs text-gray-500">Dosage</p>
                                <p className="font-semibold text-gray-900">{item.dosage}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Frequency</p>
                                <p className="font-semibold text-gray-900">{item.frequency}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Duration</p>
                                <p className="font-semibold text-gray-900">{item.duration}</p>
                              </div>
                              {item.notes && (
                                <div>
                                  <p className="text-xs text-gray-500">Notes</p>
                                  <p className="font-semibold text-gray-900">{item.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {viewingPrescription.prescription?.suggestions && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="font-semibold text-blue-900 mb-2">Doctor's Suggestions</h4>
                          <p className="text-blue-800 text-sm">{viewingPrescription.prescription.suggestions}</p>
                        </div>
                      )}
                      {viewingPrescription.prescription?.notes && (
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <h4 className="font-semibold text-yellow-900 mb-2">Additional Notes</h4>
                          <p className="text-yellow-800 text-sm">{viewingPrescription.prescription.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
                {viewingPrescription.prescription && (
                  <button
                    onClick={() => handleOrderMedicines(viewingPrescription.prescription)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 shadow-sm transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Order Medicines
                  </button>
                )}
                <button
                  onClick={() => {
                    setViewingPrescription(null);
                    setPrescriptionDocument(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 shadow-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

