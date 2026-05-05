import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { PatientIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function PatientPanelPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Patient Records State
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

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
    fetchPatientData();
  }, [token]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [patientsRes, appointmentsRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/api/users?role=PATIENT`, { headers }),
        fetch(`${API_BASE}/api/appointments`, { headers }),
        fetch(`${API_BASE}/api/orders`, { headers }),
      ]);
      
      setPatients(patientsRes.ok ? await patientsRes.json() : []);
      setAppointments(appointmentsRes.ok ? await appointmentsRes.json() : []);
      setOrders(ordersRes.ok ? await ordersRes.json() : []);
    } catch (e) {
      toast.error("Failed to fetch patient data");
    } finally {
      setLoading(false);
    }
  };

  const getPatientStats = (patientId: string) => {
    const patientAppointments = appointments.filter((apt) => apt.patientId === patientId);
    const patientOrders = orders.filter((order) => order.patientId === patientId);
    
    return {
      totalAppointments: patientAppointments.length,
      completedAppointments: patientAppointments.filter((apt) => apt.status === "COMPLETED").length,
      totalOrders: patientOrders.length,
      completedOrders: patientOrders.filter((order) => order.status === "DELIVERED").length,
    };
  };

  const filteredPatients = patients.filter((patient) => {
    const matchesSearch = 
      patient.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.phone?.includes(searchQuery);
    
    const matchesFilter = 
      filterStatus === "all" ||
      (filterStatus === "active" && patient.isActive !== false) ||
      (filterStatus === "inactive" && patient.isActive === false);
    
    return matchesSearch && matchesFilter;
  });

  if (!user) return null;

  return (
    <Layout user={user} currentPage="patient-panel">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
                Patient Panel
              </h2>
              <p className="text-sm text-gray-600">
                Manage patient records and related information
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AnimatedCard delay={0.1}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Patients</p>
              <p className="text-2xl font-bold text-black">{patients.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <PatientIcon className="w-6 h-6 text-blue-900" />
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.2}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Patients</p>
              <p className="text-2xl font-bold text-green-600">
                {patients.filter((p) => p.isActive !== false).length}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <span className="text-2xl">✓</span>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.3}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Appointments</p>
              <p className="text-2xl font-bold text-black">{appointments.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.4}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-black">{orders.length}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <span className="text-2xl">📦</span>
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Filters and Search */}
      <AnimatedCard delay={0.5} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search patients by name, email, or phone..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex gap-2">
            <motion.button
              onClick={() => setFilterStatus("all")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === "all"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </motion.button>
            <motion.button
              onClick={() => setFilterStatus("active")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === "active"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Active
            </motion.button>
            <motion.button
              onClick={() => setFilterStatus("inactive")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === "inactive"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Inactive
            </motion.button>
          </div>
        </div>
      </AnimatedCard>

      {/* Patients List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredPatients.map((patient, idx) => {
            const stats = getPatientStats(patient._id || patient.id);
            return (
              <motion.div
                key={patient._id || patient.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="medical-card cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setSelectedPatient(patient)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-lg">
                      {patient.name?.charAt(0).toUpperCase() || "P"}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-black">{patient.name}</h3>
                      <p className="text-sm text-gray-600">{patient.email}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      patient.isActive === false
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {patient.isActive === false ? "Inactive" : "Active"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Appointments</p>
                    <p className="text-lg font-bold text-black">{stats.totalAppointments}</p>
                    <p className="text-xs text-gray-500">{stats.completedAppointments} completed</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Orders</p>
                    <p className="text-lg font-bold text-black">{stats.totalOrders}</p>
                    <p className="text-xs text-gray-500">{stats.completedOrders} delivered</p>
                  </div>
                </div>

                {patient.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-3">
                    <span>📞</span>
                    <span>{patient.phone}</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {filteredPatients.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
              <PatientIcon className="w-10 h-10 text-blue-900" />
            </div>
          </div>
          <p className="text-sm text-gray-600 font-medium">No patients found</p>
          <p className="text-xs text-gray-500 mt-1">
            {searchQuery ? "Try adjusting your search" : "No patients match the selected filter"}
          </p>
        </div>
      )}

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPatient(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-black">Patient Details</h3>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Name</h4>
                <p className="text-black">{selectedPatient.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Email</h4>
                <p className="text-black">{selectedPatient.email}</p>
              </div>
              {selectedPatient.phone && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-1">Phone</h4>
                  <p className="text-black">{selectedPatient.phone}</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Status</h4>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedPatient.isActive === false
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {selectedPatient.isActive === false ? "Inactive" : "Active"}
                </span>
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-600 mb-3">Statistics</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(getPatientStats(selectedPatient._id || selectedPatient.id)).map(
                    ([key, value]) => (
                      <div key={key} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">
                          {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                        </p>
                        <p className="text-lg font-bold text-black">{value}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}

