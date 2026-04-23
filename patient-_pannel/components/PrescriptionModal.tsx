"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiGet } from "@/lib/api";
import { RecordsIcon } from "./icons";

interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface Prescription {
  _id: string;
  items: PrescriptionItem[];
  suggestions?: string;
  notes?: string;
  doctor?: { name: string; specialization?: string };
  appointment?: {
    hospitalId?: string;
    hospital?: { name: string };
  };
}

interface Appointment {
  _id: string;
  hospitalId?: string;
  doctor?: { name: string; specialization?: string };
  hospital?: { name: string };
}

interface PrescriptionModalProps {
  prescription: Prescription | null;
  appointment?: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onOrderMedicines?: (prescription: Prescription) => void;
}

export default function PrescriptionModal({
  prescription,
  appointment,
  isOpen,
  onClose,
  token,
  onOrderMedicines,
}: PrescriptionModalProps) {
  const router = useRouter();
  const [prescriptionDocument, setPrescriptionDocument] = useState<string | null>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);

  useEffect(() => {
    if (isOpen && prescription && token) {
      fetchPrescriptionDocument();
    } else {
      setPrescriptionDocument(null);
    }
  }, [isOpen, prescription, token]);

  const fetchPrescriptionDocument = async () => {
    if (!prescription || !token) return;
    
    setLoadingPrescription(true);
    setPrescriptionDocument(null);
    
    try {
      const hospitalId = appointment?.hospitalId;
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

  const handleOrderMedicines = () => {
    if (!prescription || !prescription.items || prescription.items.length === 0) {
      toast.error("No medicines in prescription to order");
      return;
    }

    if (onOrderMedicines) {
      onOrderMedicines(prescription);
    } else {
      // Default behavior: redirect to orders page
      const orderItems = prescription.items.map(item => ({
        medicineName: item.medicineName,
        quantity: 1,
      }));

      sessionStorage.setItem("prescriptionOrder", JSON.stringify({
        items: orderItems,
        prescriptionId: prescription._id,
      }));
      
      router.push("/orders/new");
    }
  };

  const handlePrint = () => {
    if (prescriptionDocument) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(prescriptionDocument);
        printWindow.document.close();
        printWindow.print();
      }
    } else {
      window.print();
    }
  };

  const handleDownload = () => {
    if (prescriptionDocument && prescription) {
      const blob = new Blob([prescriptionDocument], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prescription-${prescription._id.slice(-8)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (!isOpen || !prescription) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <RecordsIcon className="w-7 h-7 text-blue-600" />
              Prescription Details
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {prescription.doctor?.name || appointment?.doctor?.name || "Doctor"}
              {prescription.doctor?.specialization && ` • ${prescription.doctor.specialization}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingPrescription ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p className="mt-4 text-gray-600 font-medium">Loading prescription...</p>
              </div>
            </div>
          ) : prescriptionDocument ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Template View</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
                  >
                    🖨️ Print
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
                  >
                    💾 Download
                  </button>
                </div>
              </div>
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
                  {prescription.items.map((item, index) => (
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
                {prescription.suggestions && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Doctor's Suggestions</h4>
                    <p className="text-blue-800 text-sm">{prescription.suggestions}</p>
                  </div>
                )}
                {prescription.notes && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-900 mb-2">Additional Notes</h4>
                    <p className="text-yellow-800 text-sm">{prescription.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          {prescription.items && prescription.items.length > 0 && (
            <button
              onClick={handleOrderMedicines}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 shadow-sm transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Order Medicines
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 shadow-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

