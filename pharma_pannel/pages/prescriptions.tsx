import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { prescriptionsApi } from "@/services/api";
import { getUser } from "@/utils/auth";
import { Prescription, PrescriptionStatus } from "@/types";
import { PRESCRIPTION_STATUSES, API_BASE } from "@/utils/constants";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";

export default function PrescriptionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [filteredPrescriptions, setFilteredPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PrescriptionStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    const pharmacyId = currentUser.pharmacyId;
    if (pharmacyId) {
      loadPrescriptions(pharmacyId);
    }

    // Socket is already initialized in _app.tsx, just listen to events
    const socket = getSocket();
    if (socket && pharmacyId) {
      const handleSentToPharmacy = (data: any) => {
        if (data.pharmacyId === pharmacyId) {
          toast.success("New prescription received (auto-synced)!");
          loadPrescriptions(pharmacyId);
        }
      };

      const handleCreated = (data: any) => {
        if (data.pharmacyId === pharmacyId) {
          toast.success("New prescription received!");
          loadPrescriptions(pharmacyId);
        }
      };

      const handleStatusUpdated = (data: any) => {
        if (data.pharmacyId === pharmacyId && pharmacyId) {
          loadPrescriptions(pharmacyId);
        }
      };

      onSocketEvent("prescription:sentToPharmacy", handleSentToPharmacy);
      onSocketEvent("prescription:created", handleCreated);
      onSocketEvent("prescription:statusUpdated", handleStatusUpdated);

      return () => {
        offSocketEvent("prescription:sentToPharmacy", handleSentToPharmacy);
        offSocketEvent("prescription:created", handleCreated);
        offSocketEvent("prescription:statusUpdated", handleStatusUpdated);
      };
    }

    // Auto-refresh every 30 seconds if auto-sync is enabled
    if (autoSyncEnabled) {
      const interval = setInterval(() => {
        if (currentUser?.pharmacyId) {
          loadPrescriptions(currentUser.pharmacyId);
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [router, autoSyncEnabled]);

  useEffect(() => {
    let filtered = [...prescriptions];

    if (statusFilter !== "all") {
      filtered = filtered.filter((prescription) => prescription.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (prescription) =>
          prescription._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          prescription.items.some((item) =>
            item.medicineName.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    setFilteredPrescriptions(filtered);
  }, [prescriptions, statusFilter, searchTerm]);

  const loadPrescriptions = async (pharmacyId: string) => {
    try {
      const data = await prescriptionsApi.getByPharmacy(pharmacyId);
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (prescriptionId: string, newStatus: PrescriptionStatus) => {
    if (!user?.pharmacyId) return;

    try {
      // Update prescription status via API
      const response = await fetch(
        `${API_BASE}/api/prescriptions/${prescriptionId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update prescription status");
      }

      // Emit socket event for real-time update
      const socket = getSocket();
      if (socket) {
        socket.emit("prescription:statusUpdated", {
          prescriptionId,
          status: newStatus,
          pharmacyId: user.pharmacyId,
        });
      }

      toast.success(`Prescription status updated to ${PRESCRIPTION_STATUSES[newStatus]?.label || newStatus}`);
      loadPrescriptions(user.pharmacyId);
    } catch (error: any) {
      toast.error(error.message || "Failed to update prescription status");
    }
  };

  const getStatusColor = (status: PrescriptionStatus) => {
    return PRESCRIPTION_STATUSES[status]?.color || "bg-gray-100 text-gray-800";
  };

  if (!user) return null;

  const pendingPrescriptions = prescriptions.filter(
    (p) => p.status === "PENDING" || p.status === "SENT_TO_PHARMACY"
  );

  return (
    <Layout user={user} currentPage="prescriptions">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Prescriptions</h1>
            <p className="text-gray-600">Receive and process prescriptions from doctors (auto-sync enabled)</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Auto-sync</span>
            </label>
            <button
              onClick={() => user?.pharmacyId && loadPrescriptions(user.pharmacyId)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total</span>
              <span className="text-2xl">💊</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{prescriptions.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Pending</span>
              <span className="text-2xl">⏳</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{pendingPrescriptions.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Accepted</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {prescriptions.filter((p) => p.status === "ACCEPTED").length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Fulfilled</span>
              <span className="text-2xl">🎉</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">
              {prescriptions.filter((p) => p.status === "FULFILLED").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by prescription ID or medicine name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              {Object.keys(PRESCRIPTION_STATUSES).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status as PrescriptionStatus)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                    statusFilter === status
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {PRESCRIPTION_STATUSES[status].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Prescriptions List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No prescriptions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPrescriptions.map((prescription) => (
              <motion.div
                key={prescription._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Left: Prescription Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900">
                        Prescription #{prescription._id.slice(-8)}
                      </h3>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          prescription.status
                        )}`}
                      >
                        {PRESCRIPTION_STATUSES[prescription.status]?.label || prescription.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {prescription.createdAt
                          ? new Date(prescription.createdAt).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    
                    {/* Quick Info Row */}
                    <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                      {(prescription as any).doctor && (
                        <span className="flex items-center gap-1">
                          <span>👨‍⚕️</span>
                          <span className="font-medium">{(prescription as any).doctor.name || "Dr. Unknown"}</span>
                        </span>
                      )}
                      {(prescription as any).patient && (
                        <span className="flex items-center gap-1">
                          <span>👤</span>
                          <span className="font-medium">{(prescription as any).patient.name || "Patient Unknown"}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span>💊</span>
                        <span>{prescription.items.length} medicine(s)</span>
                      </span>
                    </div>

                    {/* Medicines Preview */}
                    <div className="flex flex-wrap gap-2">
                      {prescription.items.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
                          {item.medicineName}
                        </span>
                      ))}
                      {prescription.items.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-500">
                          +{prescription.items.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:min-w-[160px]">
                    {prescription.status === "PENDING" || prescription.status === "SENT_TO_PHARMACY" ? (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(prescription._id, "ACCEPTED")}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-xs sm:text-sm"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(prescription._id, "REJECTED")}
                          className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all text-xs sm:text-sm"
                        >
                          ✗ Reject
                        </button>
                      </>
                    ) : prescription.status === "ACCEPTED" ? (
                      <button
                        onClick={() => handleStatusUpdate(prescription._id, "FULFILLED")}
                        className="w-full px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all text-xs sm:text-sm"
                      >
                        ✅ Fulfilled
                      </button>
                    ) : null}
                    <button
                      onClick={() => {
                        setSelectedPrescription(prescription);
                        setShowDetailModal(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-xs sm:text-sm"
                    >
                      👁️ Details
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedPrescription && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowDetailModal(false); setSelectedPrescription(null); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Prescription Details #{selectedPrescription._id.slice(-8)}
                </h2>
                <button
                  onClick={() => { setShowDetailModal(false); setSelectedPrescription(null); }}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      selectedPrescription.status
                    )}`}
                  >
                    {PRESCRIPTION_STATUSES[selectedPrescription.status]?.label ||
                      selectedPrescription.status}
                  </span>
                </div>
                {/* Doctor and Patient Info in Modal */}
                {((selectedPrescription as any).doctor || (selectedPrescription as any).patient) && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {(selectedPrescription as any).doctor && (
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900 mb-2">👨‍⚕️ Doctor Information</p>
                        <p className="text-base font-medium text-blue-700">
                          {(selectedPrescription as any).doctor.name || "Dr. Unknown"}
                        </p>
                        {(selectedPrescription as any).doctor.email && (
                          <p className="text-sm text-blue-600 mt-1">📧 {(selectedPrescription as any).doctor.email}</p>
                        )}
                        {(selectedPrescription as any).doctor.phone && (
                          <p className="text-sm text-blue-600">📞 {(selectedPrescription as any).doctor.phone}</p>
                        )}
                      </div>
                    )}
                    {(selectedPrescription as any).patient && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-sm font-semibold text-green-900 mb-2">👤 Patient Information</p>
                        <p className="text-base font-medium text-green-700">
                          {(selectedPrescription as any).patient.name || "Patient Unknown"}
                        </p>
                        {(selectedPrescription as any).patient.email && (
                          <p className="text-sm text-green-600 mt-1">📧 {(selectedPrescription as any).patient.email}</p>
                        )}
                        {(selectedPrescription as any).patient.phone && (
                          <p className="text-sm text-green-600">📞 {(selectedPrescription as any).patient.phone}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Medicines</p>
                  <div className="space-y-3">
                    {selectedPrescription.items.map((item, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="font-semibold text-gray-900 mb-2">{item.medicineName}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                          {item.dosage && (
                            <div>
                              <span className="font-medium">Dosage:</span> {item.dosage}
                            </div>
                          )}
                          {item.frequency && (
                            <div>
                              <span className="font-medium">Frequency:</span> {item.frequency}
                            </div>
                          )}
                          {item.duration && (
                            <div>
                              <span className="font-medium">Duration:</span> {item.duration}
                            </div>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-sm text-gray-500 mt-2">
                            <span className="font-medium">Notes:</span> {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {selectedPrescription.notes && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Doctor's Notes</p>
                    <p className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
                      {selectedPrescription.notes}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-700 mb-1">Created</p>
                    <p className="text-gray-600">
                      {selectedPrescription.createdAt
                        ? new Date(selectedPrescription.createdAt).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700 mb-1">Last Updated</p>
                    <p className="text-gray-600">
                      {selectedPrescription.updatedAt
                        ? new Date(selectedPrescription.updatedAt).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedPrescription(null);
                }}
                className="mt-6 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

