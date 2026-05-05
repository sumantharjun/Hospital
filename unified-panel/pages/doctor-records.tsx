import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function DoctorRecordsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");

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
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [doctorsRes, appointmentsRes, prescriptionsRes] = await Promise.all([
          fetch(`${API_BASE}/api/users?role=DOCTOR`, { headers }),
          fetch(`${API_BASE}/api/appointments`, { headers }),
          fetch(`${API_BASE}/api/prescriptions`, { headers }),
        ]);
        
        const doctorsData = doctorsRes.ok ? await doctorsRes.json() : [];
        const appointmentsData = appointmentsRes.ok ? await appointmentsRes.json() : [];
        const prescriptionsData = prescriptionsRes.ok ? await prescriptionsRes.json() : [];
        
        setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
        setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
        setPrescriptions(Array.isArray(prescriptionsData) ? prescriptionsData : []);
      } catch (e) {
        toast.error("Failed to fetch doctor records");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch = 
      doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.phone?.includes(searchQuery);
    
    const matchesFilter = 
      filterStatus === "all" ||
      (filterStatus === "active" && doc.isActive !== false) ||
      (filterStatus === "inactive" && doc.isActive === false);
    
    return matchesSearch && matchesFilter;
  });

  const getDoctorStats = (doctorId: string) => {
    const doctorAppointments = appointments.filter((apt) => apt.doctorId === doctorId);
    const doctorPrescriptions = prescriptions.filter((pres) => pres.doctorId === doctorId);
    
    return {
      totalAppointments: doctorAppointments.length,
      completedAppointments: doctorAppointments.filter((apt) => apt.status === "COMPLETED").length,
      pendingAppointments: doctorAppointments.filter((apt) => apt.status === "PENDING").length,
      totalPrescriptions: doctorPrescriptions.length,
    };
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="doctor-records">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-black">
              Doctor Records & Analytics
            </h2>
            <p className="text-sm text-gray-600">
              Comprehensive records and analytics for all doctors in the system
            </p>
          </div>
        </div>
      </motion.header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AnimatedCard delay={0.1}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Doctors</p>
              <p className="text-2xl font-bold text-black">{doctors.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-2xl">👨‍⚕️</span>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.2}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Doctors</p>
              <p className="text-2xl font-bold text-green-600">
                {doctors.filter((d) => d.isActive !== false).length}
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
            <div className="p-3 bg-purple-50 rounded-lg">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.4}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Prescriptions</p>
              <p className="text-2xl font-bold text-black">{prescriptions.length}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <span className="text-2xl">💊</span>
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Filters and Search */}
      <AnimatedCard delay={0.5} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search doctors by name, email, or phone..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                  ? "bg-blue-600 text-white"
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

      {/* Doctors List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredDoctors.map((doctor, idx) => {
            const stats = getDoctorStats(doctor._id || doctor.id);
            return (
              <motion.div
                key={doctor._id || doctor.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="medical-card cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setSelectedDoctor(doctor)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                      {doctor.name?.charAt(0).toUpperCase() || "D"}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-black">{doctor.name}</h3>
                      <p className="text-sm text-gray-600">{doctor.email}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      doctor.isActive === false
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {doctor.isActive === false ? "Inactive" : "Active"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Appointments</p>
                    <p className="text-lg font-bold text-black">{stats.totalAppointments}</p>
                    <p className="text-xs text-gray-500">
                      {stats.completedAppointments} completed
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Prescriptions</p>
                    <p className="text-lg font-bold text-black">{stats.totalPrescriptions}</p>
                  </div>
                </div>

                {doctor.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <span>📞</span>
                    <span>{doctor.phone}</span>
                  </div>
                )}

                {doctor.hospitalId && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>🏥</span>
                    <span>Hospital ID: {doctor.hospitalId.slice(-8)}</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {filteredDoctors.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">👨‍⚕️</div>
          <p className="text-sm text-gray-600 font-medium">No doctors found</p>
          <p className="text-xs text-gray-500 mt-1">
            {searchQuery ? "Try adjusting your search" : "No doctors match the selected filter"}
          </p>
        </div>
      )}

      {/* Doctor Detail Modal */}
      {selectedDoctor && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDoctor(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-black">Doctor Details</h3>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Name</h4>
                <p className="text-black">{selectedDoctor.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Email</h4>
                <p className="text-black">{selectedDoctor.email}</p>
              </div>
              {selectedDoctor.phone && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-1">Phone</h4>
                  <p className="text-black">{selectedDoctor.phone}</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Status</h4>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedDoctor.isActive === false
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {selectedDoctor.isActive === false ? "Inactive" : "Active"}
                </span>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-600 mb-3">Statistics</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(getDoctorStats(selectedDoctor._id || selectedDoctor.id)).map(
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

