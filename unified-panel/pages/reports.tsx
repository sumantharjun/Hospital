import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { ReportsIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

type ReportStatus = "PENDING" | "FORMATTED" | "FINALIZED";

export default function ReportsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !t) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(storedUser));
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    fetchPrescriptions();
  }, [token, filterStatus]);

  const fetchPrescriptions = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      
      const [prescriptionsRes, doctorsRes, patientsRes] = await Promise.all([
        fetch(`${API_BASE}/api/prescriptions/admin/reports${filterStatus !== "ALL" ? `?status=${filterStatus}` : ""}`, { headers }),
        fetch(`${API_BASE}/api/users?role=DOCTOR`, { headers }),
        fetch(`${API_BASE}/api/users?role=PATIENT`, { headers }),
      ]);
      
      const prescriptionsData = prescriptionsRes.ok ? await prescriptionsRes.json() : {};
      const prescriptionsList = Array.isArray(prescriptionsData.prescriptions) 
        ? prescriptionsData.prescriptions 
        : Array.isArray(prescriptionsData) 
        ? prescriptionsData 
        : [];
      
      setPrescriptions(prescriptionsList);
      setDoctors(doctorsRes.ok ? await doctorsRes.json() : []);
      setPatients(patientsRes.ok ? await patientsRes.json() : []);
    } catch (e: any) {
      toast.error("Error fetching prescriptions");
    } finally {
      setLoading(false);
    }
  };

  const getDoctorName = (doctorId: any) => {
    if (!doctorId) return "N/A";
    if (typeof doctorId === 'object' && doctorId.name) {
      return doctorId.name;
    }
    const idString = typeof doctorId === 'string' ? doctorId : String(doctorId);
    const doctor = doctors.find(d => {
      const docId = String(d._id || d.id || "");
      return docId === idString || docId.endsWith(idString) || idString.endsWith(docId);
    });
    return doctor?.name || "Unknown Doctor";
  };

  const getPatientName = (patientId: any) => {
    if (!patientId) return "N/A";
    if (typeof patientId === 'object' && patientId.name) {
      return patientId.name;
    }
    const idString = typeof patientId === 'string' ? patientId : String(patientId);
    const patient = patients.find(p => {
      const patId = String(p._id || p.id || "");
      return patId === idString || patId.endsWith(idString) || idString.endsWith(patId);
    });
    return patient?.name || "Unknown Patient";
  };

  const generateReport = async (prescription: any) => {
    if (!token) return;
    try {
      setGenerating(true);
      
      // First, fetch available templates
      const templatesRes = await fetch(`${API_BASE}/api/templates`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      let templateId = null;
      if (templatesRes.ok) {
        const templates = await templatesRes.json();
        if (Array.isArray(templates) && templates.length > 0) {
          // Try to find a default template first
          const defaultTemplate = templates.find((t: any) => t.isDefault === true || t.hospitalId === null || t.hospitalId === undefined);
          // If no default, use the first available template
          templateId = defaultTemplate?._id || templates[0]._id;
        }
      }
      
      // Generate report with template (backend will use templateId if provided, or auto-select)
      const requestBody: any = {};
      if (templateId) {
        requestBody.templateId = templateId;
      }
      
      const res = await fetch(`${API_BASE}/api/prescriptions/${prescription._id}/generate-report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      
      if (res.ok) {
        const data = await res.json();
        setPreviewHtml(data.rendered);
        setSelectedPrescription(prescription);
        toast.success("Report generated successfully!");
        await fetchPrescriptions();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to generate report");
      }
    } catch (e: any) {
      toast.error("Error generating report: " + (e.message || "Unknown error"));
    } finally {
      setGenerating(false);
    }
  };

  const finalizeReport = async (prescription: any) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/prescriptions/${prescription._id}/finalize-report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ adminId: user?.id || user?._id }),
      });
      if (res.ok) {
        toast.success("Report finalized and sent to patient!");
        setSelectedPrescription(null);
        setPreviewHtml("");
        await fetchPrescriptions();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to finalize report");
      }
    } catch (e: any) {
      toast.error("Error finalizing report");
    }
  };

  const deletePrescription = async (prescription: any) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete this prescription?\n\nDoctor: ${getDoctorName(prescription.doctorId)}\nPatient: ${getPatientName(prescription.patientId)}\n\nThis action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/prescriptions/${prescription._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        toast.success("Prescription deleted successfully!");
        setSelectedPrescription(null);
        setPreviewHtml("");
        await fetchPrescriptions();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to delete prescription");
      }
    } catch (e: any) {
      toast.error("Error deleting prescription");
    }
  };

  // Apply filters
  let filteredPrescriptions = [...prescriptions];
  
  if (searchQuery) {
    filteredPrescriptions = filteredPrescriptions.filter((p: any) => {
      const prescriptionId = p._id?.slice(-8) || "";
      const doctorName = getDoctorName(p.doctorId) || "";
      const patientName = getPatientName(p.patientId) || "";
      const searchLower = searchQuery.toLowerCase();
      return (
        prescriptionId.toLowerCase().includes(searchLower) ||
        doctorName.toLowerCase().includes(searchLower) ||
        patientName.toLowerCase().includes(searchLower) ||
        p.items?.some((item: any) => 
          item.medicineName?.toLowerCase().includes(searchLower)
        )
      );
    });
  }

  if (!user) return null;

  return (
    <Layout user={user} currentPage="reports">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
          Prescription Reports
        </h2>
        <p className="text-sm text-gray-600">
          Generate and manage formatted prescription reports with complete details
        </p>
        </div>
      </motion.header>

      {/* Search Bar */}
      <AnimatedCard delay={0.1} className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by prescription ID, doctor name, patient name, or medicine..."
            className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 pl-10 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </AnimatedCard>

      {/* Status Filters */}
      <AnimatedCard delay={0.2} className="mb-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-2">Filter by Status:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "ALL", label: "All Reports", activeClass: "bg-gray-600" },
              { value: "PENDING", label: "Pending", activeClass: "bg-yellow-600" },
              { value: "FORMATTED", label: "Formatted", activeClass: "bg-blue-600" },
              { value: "FINALIZED", label: "Finalized", activeClass: "bg-green-600" },
            ].map((status) => (
              <motion.button
                key={status.value}
                onClick={() => setFilterStatus(status.value)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === status.value
                    ? `${status.activeClass} text-white shadow-md`
                    : "bg-white text-gray-700 border border-gray-300 hover:border-gray-400"
                }`}
              >
                {status.label}
              </motion.button>
            ))}
          </div>
        </div>
      </AnimatedCard>

      {/* Prescriptions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPrescriptions.length === 0 ? (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
              <ReportsIcon className="w-10 h-10 text-blue-900" />
            </div>
          </div>
          <p className="text-lg text-gray-600 font-medium mb-2">No prescriptions found</p>
          <p className="text-sm text-gray-500">
            {searchQuery || filterStatus !== "ALL" 
              ? "Try adjusting your search or filter" 
              : "Prescriptions will appear here when doctors create them"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrescriptions.map((prescription: any, idx: number) => (
            <AnimatedCard key={prescription._id} delay={idx * 0.1}>
              <div 
                className="border border-gray-300 rounded-lg bg-white hover:shadow-md hover:border-blue-900 transition-all cursor-pointer overflow-hidden h-full flex flex-col"
                onClick={() => setSelectedPrescription(prescription)}
              >
                {/* Header Section */}
                <div className="bg-blue-50 px-4 py-3 border-b border-gray-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                        <span className="text-xl">💊</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-gray-900 truncate">
                          {getDoctorName(prescription.doctorId)}
                        </h3>
                        <p className="text-xs text-gray-600 truncate">
                          {getPatientName(prescription.patientId)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-semibold whitespace-nowrap flex-shrink-0 ${
                        prescription.reportStatus === "PENDING"
                          ? "bg-yellow-500 text-white"
                          : prescription.reportStatus === "FORMATTED"
                          ? "bg-blue-500 text-white"
                          : "bg-green-500 text-white"
                      }`}
                    >
                      {prescription.reportStatus || "PENDING"}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="px-4 py-3 flex-1 flex flex-col">
                  <div className="space-y-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">👨‍⚕️</span>
                      <p className="text-sm text-gray-700 truncate">
                        <span className="font-medium">Dr.</span> {getDoctorName(prescription.doctorId)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">👤</span>
                      <p className="text-sm text-gray-700 truncate">
                        <span className="font-medium">Patient:</span> {getPatientName(prescription.patientId)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">📅</span>
                      <p className="text-xs text-gray-600">
                        {prescription.createdAt ? new Date(prescription.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Medicines Section */}
                  {prescription.items && prescription.items.length > 0 && (
                    <div className="mt-auto pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Medicines ({prescription.items.length})
                      </p>
                      <div className="space-y-1.5">
                        {prescription.items.slice(0, 2).map((item: any, itemIdx: number) => (
                          <div key={itemIdx} className="text-xs text-gray-700 bg-gray-50 rounded px-2.5 py-1.5 border border-gray-300 truncate">
                            {item.medicineName}
                          </div>
                        ))}
                        {prescription.items.length > 2 && (
                          <p className="text-xs text-gray-500 text-center font-medium">
                            +{prescription.items.length - 2} more medicine{prescription.items.length - 2 > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Section */}
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-300 flex items-center justify-between">
                  <p className="text-xs text-blue-600 font-medium">
                    Click to view details →
                  </p>
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePrescription(prescription);
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium transition-colors"
                    title="Delete prescription"
                  >
                    🗑️ Delete
                  </motion.button>
                </div>
              </div>
            </AnimatedCard>
          ))}
        </div>
      )}

      {/* Prescription Detail Modal */}
      {selectedPrescription && !previewHtml && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPrescription(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 mb-1 truncate">
                    {getDoctorName(selectedPrescription.doctorId)} → {getPatientName(selectedPrescription.patientId)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Prescription #{selectedPrescription._id.slice(-8)} • {new Date(selectedPrescription.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPrescription(null)}
                  className="ml-4 text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Basic Information */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <h4 className="text-sm font-bold text-gray-900">Basic Information</h4>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-400">👨‍⚕️</span>
                        <span className="text-xs font-medium text-gray-600">Doctor:</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 ml-6">
                        {getDoctorName(selectedPrescription.doctorId)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-400">👤</span>
                        <span className="text-xs font-medium text-gray-600">Patient:</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 ml-6">
                        {getPatientName(selectedPrescription.patientId)}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-400">📅</span>
                        <span className="text-xs font-medium text-gray-600">Date & Time:</span>
                      </div>
                      <p className="text-sm text-gray-900 ml-6">
                        {new Date(selectedPrescription.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-600">Status:</span>
                      </div>
                      <span
                        className={`inline-block px-3 py-1 rounded-md text-xs font-semibold ${
                          selectedPrescription.reportStatus === "PENDING"
                            ? "bg-yellow-500 text-white"
                            : selectedPrescription.reportStatus === "FORMATTED"
                            ? "bg-blue-500 text-white"
                            : "bg-green-500 text-white"
                        }`}
                      >
                        {selectedPrescription.reportStatus || "PENDING"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prescription Items */}
              {selectedPrescription.items && selectedPrescription.items.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-900">
                      Medicines ({selectedPrescription.items.length} {selectedPrescription.items.length === 1 ? 'item' : 'items'})
                    </h4>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedPrescription.items.map((item: any, itemIdx: number) => (
                      <div key={itemIdx} className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="font-bold text-base text-gray-900 mb-3">{item.medicineName}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-xs font-medium text-gray-600 block mb-1">Dosage:</span>
                            <p className="text-sm font-semibold text-gray-900">{item.dosage || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600 block mb-1">Frequency:</span>
                            <p className="text-sm font-semibold text-gray-900">{item.frequency || "N/A"}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs font-medium text-gray-600 block mb-1">Duration:</span>
                            <p className="text-sm font-semibold text-gray-900">{item.duration || "N/A"}</p>
                          </div>
                          {item.notes && (
                            <div className="col-span-2 bg-white rounded p-3 border border-green-200 mt-2">
                              <span className="text-xs font-semibold text-gray-700 block mb-1">Notes:</span>
                              <p className="text-sm text-gray-900">{item.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              {selectedPrescription.notes && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2.5 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-900">Additional Notes</h4>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-900 bg-gray-50 rounded p-3 border border-gray-200">
                      {selectedPrescription.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {selectedPrescription.suggestions && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-green-50 px-4 py-2.5 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-900">Suggestions</h4>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-900 bg-gray-50 rounded p-3 border border-gray-200">
                      {selectedPrescription.suggestions}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
              <div className="flex-1 flex gap-3">
                {selectedPrescription.reportStatus === "PENDING" && (
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      generateReport(selectedPrescription);
                    }}
                    disabled={generating}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? "Generating..." : "Generate Report"}
                  </motion.button>
                )}
                {selectedPrescription.reportStatus === "FORMATTED" && (
                  <>
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewHtml(selectedPrescription.formattedReport || "");
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
                    >
                      Preview Report
                    </motion.button>
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        finalizeReport(selectedPrescription);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors"
                    >
                      Finalize & Send
                    </motion.button>
                  </>
                )}
                {selectedPrescription.reportStatus === "FINALIZED" && (
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewHtml(selectedPrescription.formattedReport || "");
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors"
                  >
                    View Report
                  </motion.button>
                )}
              </div>
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  deletePrescription(selectedPrescription);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                🗑️ Delete
              </motion.button>
              <motion.button
                onClick={() => setSelectedPrescription(null)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold text-sm transition-colors hover:bg-gray-100"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedPrescription && previewHtml && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {getDoctorName(selectedPrescription.doctorId)} → {getPatientName(selectedPrescription.patientId)}
                </h2>
                <p className="text-sm text-gray-600">
                  Prescription Report Preview
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedPrescription(null);
                  setPreviewHtml("");
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-white">
              <div
                className="bg-white rounded-lg p-6 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
              <motion.button
                onClick={() => {
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Prescription Report</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                          </style>
                        </head>
                        <body>${previewHtml}</body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                Print / Download
              </motion.button>
              {selectedPrescription.reportStatus === "FORMATTED" && (
                <motion.button
                  onClick={() => finalizeReport(selectedPrescription)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Finalize & Send to Patient
                </motion.button>
              )}
              <motion.button
                onClick={() => {
                  setSelectedPrescription(null);
                  setPreviewHtml("");
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold transition-colors hover:bg-gray-100"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
