"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiGet, apiDelete } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import PrescriptionModal from "@/components/PrescriptionModal";

interface Prescription {
  _id: string;
  appointmentId: string;
  doctorId: string;
  items: Array<{
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes?: string;
  }>;
  createdAt: string;
  doctor?: { name: string; specialization?: string };
  appointment?: {
    scheduledAt: string;
    hospitalId?: string;
    hospital?: { name: string };
  };
}

interface TemplateDocument {
  rendered: string;
  template: string;
  prescriptionId: string;
}

export default function RecordsPage() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [templateDocument, setTemplateDocument] = useState<TemplateDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [modalPrescription, setModalPrescription] = useState<Prescription | null>(null);

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

  useEffect(() => {
    if (!token || !user) return;
    fetchPrescriptions();
  }, [token, user]);

  const fetchPrescriptions = async () => {
    if (!token || !user) return;
    
    const patientId = user.id || user._id;
    if (!patientId) {
      setLoading(false);
      return;
    }
    
    try {
      const data = await apiGet<Prescription[]>(`/api/prescriptions?patientId=${patientId}`);
      const prescriptionsList = Array.isArray(data) ? data : [];
      
      // Enrich with doctor and appointment data
      const enrichedPrescriptions = await Promise.all(
        prescriptionsList.map(async (prescription): Promise<Prescription> => {
          try {
            const [doctor, appointment] = await Promise.all([
              apiGet<{ name: string; specialization?: string }>(`/api/users/${prescription.doctorId}`).catch(() => null),
              apiGet<{ hospitalId?: string; scheduledAt: string }>(`/api/appointments/${prescription.appointmentId}`).catch(() => null),
            ]);
            
            let hospital: { name: string } | null = null;
            if (appointment?.hospitalId) {
              hospital = await apiGet<{ name: string }>(`/api/master/hospitals/${appointment.hospitalId}`).catch(() => null);
            }
            
            return {
              ...prescription,
              doctor: doctor || undefined,
              appointment: appointment ? { ...appointment, hospital: hospital || undefined } : undefined,
            };
          } catch {
            return prescription;
          }
        })
      );
      
      setPrescriptions(enrichedPrescriptions);
    } catch (error: any) {
      console.error("Error fetching prescriptions:", error);
      setPrescriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateDocument = async (prescription: Prescription) => {
    if (!token || !prescription) return;
    
    setLoadingTemplate(true);
    setSelectedPrescription(prescription);
    try {
      const hospitalId = prescription.appointment?.hospitalId;
      const url = hospitalId 
        ? `/api/prescriptions/${prescription._id}/document?hospitalId=${hospitalId}`
        : `/api/prescriptions/${prescription._id}/document`;
      const data = await apiGet<TemplateDocument>(url);
      setTemplateDocument(data);
    } catch (error: any) {
      console.error("Error fetching template document:", error);
      // Silently handle - template will be null and show fallback message
      setTemplateDocument(null);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handlePrint = () => {
    if (templateDocument) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(templateDocument.rendered);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleDownload = () => {
    if (templateDocument && selectedPrescription) {
      const blob = new Blob([templateDocument.rendered], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prescription-${selectedPrescription._id.slice(-8)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDelete = async (prescriptionId: string) => {
    if (!confirm("Are you sure you want to delete this prescription? This action cannot be undone.")) return;
    
    try {
      await apiDelete(`/api/prescriptions/${prescriptionId}`);
      fetchPrescriptions();
      setSelectedPrescription(null);
      setTemplateDocument(null);
      toast.success("Prescription deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete prescription: " + (error.message || "Unknown error"));
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

  if (loading) {
    return (
      <DashboardLayout title="Prescription Records" description="Loading your prescription records...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading prescription records...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Prescription Records"
      description="View all your prescription history with templates"
    >
      <div className="max-w-7xl mx-auto">
        {prescriptions.length === 0 ? (
          <div className="rounded-lg border border-gray-300 bg-white p-6 sm:p-12 text-center shadow-sm">
            <div className="text-4xl sm:text-6xl mb-4">💊</div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Prescription Records</h2>
            <p className="text-sm sm:text-base text-gray-600">You don't have any prescription records yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Prescriptions List */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">All Prescriptions</h3>
              {prescriptions.map((prescription) => (
                <div
                  key={prescription._id}
                  className={`rounded-lg border border-gray-300 bg-white p-3 sm:p-4 shadow-sm cursor-pointer transition-colors ${
                    selectedPrescription?._id === prescription._id ? "border-blue-900 bg-blue-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => fetchTemplateDocument(prescription)}
                >
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {prescription.doctor?.name ? `Dr. ${prescription.doctor.name}` : "Doctor"}
                      </h4>
                      {prescription.doctor?.specialization && (
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{prescription.doctor.specialization}</p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">{formatDate(prescription.createdAt)}</p>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        {prescription.items.length} medicine(s) prescribed
                      </p>
                      {prescription.appointment?.hospital?.name && (
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-1 truncate">
                          {prescription.appointment.hospital.name}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setModalPrescription(prescription);
                          setShowPrescriptionModal(true);
                        }}
                        className="px-2 sm:px-3 py-1 rounded-lg bg-blue-900 text-white text-[10px] sm:text-xs font-semibold hover:bg-blue-800 whitespace-nowrap"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(prescription._id)}
                        className="px-2 sm:px-3 py-1 rounded-lg bg-red-600 text-white text-[10px] sm:text-xs font-semibold hover:bg-red-700"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Template View */}
            <div className="rounded-lg border border-gray-300 bg-white p-4 sm:p-6 shadow-sm">
              {!selectedPrescription ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="text-3xl sm:text-4xl mb-2">📄</div>
                  <p className="text-sm sm:text-base text-gray-600">Select a prescription to view template</p>
                </div>
              ) : loadingTemplate ? (
                <div className="flex items-center justify-center py-8 sm:py-12">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-4 text-sm sm:text-base text-gray-600">Loading template...</p>
                  </div>
                </div>
              ) : templateDocument ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900">Template View</h3>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        Template: <span className="font-semibold">{templateDocument.template}</span>
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={handlePrint}
                        className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-[10px] sm:text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm whitespace-nowrap"
                      >
                        🖨️ Print
                      </button>
                      <button
                        onClick={handleDownload}
                        className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-[10px] sm:text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm whitespace-nowrap"
                      >
                        💾 Download
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[400px] sm:max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4 bg-white">
                    <div
                      className="prescription-template"
                      dangerouslySetInnerHTML={{ __html: templateDocument.rendered }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-2">⚠️</div>
                  <p className="text-gray-600 mb-4">Template not available for this prescription</p>
                  <button
                    onClick={() => {
                      setModalPrescription(selectedPrescription);
                      setShowPrescriptionModal(true);
                    }}
                    className="inline-block px-4 py-2 rounded-lg bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800"
                  >
                    View Simple Format
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Prescription Modal */}
      <PrescriptionModal
        prescription={modalPrescription}
        appointment={modalPrescription?.appointment ? {
          _id: modalPrescription.appointmentId,
          hospitalId: modalPrescription.appointment.hospitalId,
          doctor: modalPrescription.doctor,
          hospital: modalPrescription.appointment.hospital,
        } : null}
        isOpen={showPrescriptionModal}
        onClose={() => {
          setShowPrescriptionModal(false);
          setModalPrescription(null);
        }}
        token={token}
      />
    </DashboardLayout>
  );
}
