import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function DoctorPanelPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"management" | "records" | "prescriptions" | "reports" | "documents" | "pricing">("management");
  
  // Doctor Management State
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newDoctor, setNewDoctor] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    specialization: "",
    qualification: "",
    hospitalId: "",
  });
  const [hospitals, setHospitals] = useState<any[]>([]);
  
  // Doctor Records State
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  
  // Prescription Reports State
  const [prescriptionReports, setPrescriptionReports] = useState<any[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  
  // Documents State
  const [documents, setDocuments] = useState<any[]>([]);
  
  // Report Requests State
  const [reportRequests, setReportRequests] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  
  // Pricing State
  const [pricing, setPricing] = useState<any[]>([]);
  const [showAddPricingModal, setShowAddPricingModal] = useState(false);
  const [editingPricing, setEditingPricing] = useState<any>(null);
  const [newPricing, setNewPricing] = useState({
    serviceType: "CONSULTATION",
    doctorId: "",
    basePrice: 0,
    discountPercent: 0,
    discountAmount: 0,
    isActive: true,
    validFrom: "",
    validTo: "",
  });
  
  const [loading, setLoading] = useState(true);
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
    fetchDoctorData();
    fetchPrescriptionReports();
    fetchDocuments();
    fetchPricing();
    fetchHospitals();
    fetchReportRequests();
  }, [token]);

  const fetchHospitals = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/master/hospitals`, { headers });
      setHospitals(res.ok ? await res.json() : []);
    } catch (e) {
      console.error("Failed to fetch hospitals");
    }
  };

  const createDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const payload = {
        name: newDoctor.name,
        email: newDoctor.email,
        password: newDoctor.password,
        phone: newDoctor.phone,
        role: "DOCTOR",
        specialization: newDoctor.specialization,
        qualification: newDoctor.qualification,
        hospitalId: newDoctor.hospitalId || null,
      };

      const url = editingDoctor
        ? `${API_BASE}/api/users/${editingDoctor._id}`
        : `${API_BASE}/api/users`;
      const method = editingDoctor ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        if (editingDoctor) {
          setDoctors((prev) => prev.map((d) => (d._id === editingDoctor._id ? created : d)));
          toast.success("Doctor updated successfully!");
        } else {
          setDoctors((prev) => [created, ...prev]);
          toast.success(`Doctor created! Login: ${newDoctor.email}, Password: ${newDoctor.password}`);
        }
        resetDoctorForm();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to save doctor");
      }
    } catch (e) {
      toast.error("Error saving doctor");
    }
  };

  const resetDoctorForm = () => {
    setNewDoctor({
      name: "",
      email: "",
      password: "",
      phone: "",
      specialization: "",
      qualification: "",
      hospitalId: "",
    });
    setEditingDoctor(null);
    setShowAddDoctorModal(false);
  };

  const editDoctor = (doctor: any) => {
    setEditingDoctor(doctor);
    setNewDoctor({
      name: doctor.name || "",
      email: doctor.email || "",
      password: "", // Don't show password when editing
      phone: doctor.phone || "",
      specialization: doctor.specialization || "",
      qualification: doctor.qualification || "",
      hospitalId: doctor.hospitalId || "",
    });
    setShowAddDoctorModal(true);
  };

  const deleteDoctor = async (id: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this doctor?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDoctors((prev) => prev.filter((d) => d._id !== id));
        toast.success("Doctor deleted successfully!");
      } else {
        toast.error("Failed to delete doctor");
      }
    } catch (e) {
      toast.error("Error deleting doctor");
    }
  };

  const fetchDoctorData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [doctorsRes, patientsRes, appointmentsRes, prescriptionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users?role=DOCTOR`, { headers }),
        fetch(`${API_BASE}/api/users?role=PATIENT`, { headers }),
        fetch(`${API_BASE}/api/appointments`, { headers }),
        fetch(`${API_BASE}/api/prescriptions`, { headers }),
      ]);
      
      setDoctors(doctorsRes.ok ? await doctorsRes.json() : []);
      setPatients(patientsRes.ok ? await patientsRes.json() : []);
      setAppointments(appointmentsRes.ok ? await appointmentsRes.json() : []);
      setPrescriptions(prescriptionsRes.ok ? await prescriptionsRes.json() : []);
    } catch (e) {
      toast.error("Failed to fetch doctor data");
    } finally {
      setLoading(false);
    }
  };

  const fetchPrescriptionReports = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/prescriptions`, { headers });
      setPrescriptionReports(res.ok ? await res.json() : []);
    } catch (e) {
      toast.error("Failed to fetch prescription reports");
    }
  };

  const getDoctorNameForPrescription = (doctorId: any) => {
    if (!doctorId) return "N/A";
    // Handle if doctorId is already an object with name
    if (typeof doctorId === 'object' && doctorId.name) {
      return doctorId.name;
    }
    // Handle if it's a string ID
    const idString = typeof doctorId === 'string' ? doctorId : String(doctorId);
    const doctor = doctors.find(d => d._id === idString || d.id === idString);
    return doctor?.name || (idString.length > 8 ? idString.slice(-8) : idString);
  };

  const getPatientNameForPrescription = (patientId: any) => {
    if (!patientId) return "N/A";
    // Handle if patientId is already an object with name
    if (typeof patientId === 'object' && patientId.name) {
      return patientId.name;
    }
    // Handle if it's a string ID
    const idString = typeof patientId === 'string' ? patientId : String(patientId);
    const patient = patients.find(p => p._id === idString || p.id === idString);
    return patient?.name || (idString.length > 8 ? idString.slice(-8) : idString);
  };

  const fetchDocuments = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      // This would need a documents API endpoint
      setDocuments([]);
    } catch (e) {
      toast.error("Failed to fetch documents");
    }
  };

  const fetchPricing = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/pricing`, { headers });
      const data = res.ok ? await res.json() : [];
      // Filter for doctor-related pricing (consultation fees)
      setPricing(Array.isArray(data) ? data.filter((p: any) => 
        p.serviceType === "CONSULTATION" || p.serviceType === "FOLLOW_UP" || p.serviceType === "EMERGENCY" || p.doctorId
      ) : []);
    } catch (e) {
      setPricing([]);
    }
  };

  const fetchReportRequests = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/report-requests`, { headers });
      const data = res.ok ? await res.json() : [];
      setReportRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch report requests:", e);
      setReportRequests([]);
    }
  };

  const createPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const payload: any = {
        serviceType: newPricing.serviceType,
        basePrice: Number(newPricing.basePrice),
        isActive: newPricing.isActive,
      };
      if (newPricing.doctorId) payload.doctorId = newPricing.doctorId;
      if (newPricing.discountPercent) payload.discountPercent = Number(newPricing.discountPercent);
      if (newPricing.discountAmount) payload.discountAmount = Number(newPricing.discountAmount);
      if (newPricing.validFrom) payload.validFrom = new Date(newPricing.validFrom);
      if (newPricing.validTo) payload.validTo = new Date(newPricing.validTo);

      const url = editingPricing
        ? `${API_BASE}/api/pricing/${editingPricing._id}`
        : `${API_BASE}/api/pricing`;
      const method = editingPricing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(`Service charge ${editingPricing ? "updated" : "created"} successfully!`);
        setShowAddPricingModal(false);
        setEditingPricing(null);
        setNewPricing({
          serviceType: "CONSULTATION",
          doctorId: "",
          basePrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          isActive: true,
          validFrom: "",
          validTo: "",
        });
        fetchPricing();
      } else {
        toast.error(`Failed to ${editingPricing ? "update" : "create"} service charge`);
      }
    } catch (e) {
      toast.error(`Error ${editingPricing ? "updating" : "creating"} service charge`);
    }
  };

  const deletePricing = async (id: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this service charge?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/pricing/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPricing((prev) => prev.filter((p) => p._id !== id));
        toast.success("Service charge deleted successfully!");
      } else {
        toast.error("Failed to delete service charge");
      }
    } catch (e) {
      toast.error("Error deleting service charge");
    }
  };

  const getDoctorStats = (doctorId: string) => {
    const doctorAppointments = appointments.filter((apt) => apt.doctorId === doctorId);
    const doctorPrescriptions = prescriptions.filter((pres) => pres.doctorId === doctorId);
    
    return {
      totalAppointments: doctorAppointments.length,
      completedAppointments: doctorAppointments.filter((apt) => apt.status === "COMPLETED").length,
      totalPrescriptions: doctorPrescriptions.length,
    };
  };

  const filteredDoctors = doctors.filter((doc) =>
    doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) return null;

  const tabs = [
    { id: "management", label: "Doctor Management", icon: "👨‍⚕️" },
    { id: "records", label: "Doctor Records", icon: "📋" },
    { id: "prescriptions", label: "Prescription Reports", icon: "📄" },
    { id: "reports", label: "Patient Reports", icon: "📋" },
    { id: "documents", label: "Document Panel", icon: "📁" },
    { id: "pricing", label: "Service Pricing", icon: "💵" },
  ];

  return (
    <Layout user={user} currentPage="doctor-panel">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-black">
              Doctor Panel
            </h2>
            <p className="text-sm text-black">
              Add doctors, manage records, prescription reports, documents, and service pricing
            </p>
          </div>
        </div>
      </motion.header>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border-2 ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                  : "bg-white text-black border-black hover:bg-blue-50 hover:border-blue-600"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Doctor Management Tab */}
      {activeTab === "management" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Add/Edit Doctor Form */}
            <AnimatedCard delay={0.1} className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-black">
                  {editingDoctor ? "Edit Doctor" : "Add New Doctor"}
                </h3>
                {editingDoctor && (
                  <button
                    onClick={resetDoctorForm}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    + New
                  </button>
                )}
              </div>
              <form onSubmit={createDoctor} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">Doctor Name *</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter doctor name"
                    value={newDoctor.name}
                    onChange={(e) => setNewDoctor((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">Email *</label>
                  <input
                    type="email"
                    className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email (used for login)"
                    value={newDoctor.email}
                    onChange={(e) => setNewDoctor((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Password {editingDoctor ? "(leave blank to keep current)" : "*"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded-lg border-2 border-black px-4 py-2.5 pr-10 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter password"
                      value={newDoctor.password}
                      onChange={(e) => setNewDoctor((prev) => ({ ...prev, password: e.target.value }))}
                      required={!editingDoctor}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">Phone</label>
                  <input
                    type="tel"
                    className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter phone number"
                    value={newDoctor.phone}
                    onChange={(e) => setNewDoctor((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">Specialization</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Cardiology, Pediatrics"
                    value={newDoctor.specialization}
                    onChange={(e) => setNewDoctor((prev) => ({ ...prev, specialization: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">Qualification</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., MBBS, MD"
                    value={newDoctor.qualification}
                    onChange={(e) => setNewDoctor((prev) => ({ ...prev, qualification: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">Hospital (Optional)</label>
                  <select
                    className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newDoctor.hospitalId}
                    onChange={(e) => setNewDoctor((prev) => ({ ...prev, hospitalId: e.target.value }))}
                  >
                    <option value="">Select Hospital</option>
                    {hospitals.map((h) => (
                      <option key={h._id} value={h._id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  {editingDoctor && (
                    <motion.button
                      type="button"
                      onClick={resetDoctorForm}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 rounded-lg bg-white border-2 border-black text-black font-semibold py-2.5 text-sm transition-all hover:bg-black hover:text-white"
                    >
                      Cancel
                    </motion.button>
                  )}
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`${editingDoctor ? "flex-1" : "w-full"} rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 text-sm transition-all`}
                  >
                    {editingDoctor ? "Update Doctor" : "Add Doctor"}
                  </motion.button>
                </div>
              </form>
            </AnimatedCard>

            {/* Doctors List */}
            <AnimatedCard delay={0.2} className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-black">Doctors List</h3>
                <input
                  type="text"
                  placeholder="Search doctors..."
                  className="rounded-lg border-2 border-black px-4 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
                  />
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredDoctors.map((doctor, idx) => {
                    const stats = getDoctorStats(doctor._id || doctor.id);
                    return (
                      <motion.div
                        key={doctor._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="border-2 border-blue-200 rounded-lg p-4 bg-white hover:border-blue-400 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">👨‍⚕️</span>
                              <h4 className="font-bold text-lg text-black">{doctor.name}</h4>
                            </div>
                            <div className="space-y-1 mb-3">
                              <p className="text-sm text-black">
                                <span className="font-semibold">Email:</span> {doctor.email}
                              </p>
                              {doctor.phone && (
                                <p className="text-sm text-black">
                                  <span className="font-semibold">Phone:</span> {doctor.phone}
                                </p>
                              )}
                              {doctor.specialization && (
                                <p className="text-sm text-black">
                                  <span className="font-semibold">Specialization:</span> {doctor.specialization}
                                </p>
                              )}
                              {doctor.qualification && (
                                <p className="text-sm text-black">
                                  <span className="font-semibold">Qualification:</span> {doctor.qualification}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 font-medium">
                                {stats.totalAppointments} Appointments
                              </span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 border border-green-300 font-medium">
                                {stats.totalPrescriptions} Prescriptions
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <motion.button
                              onClick={() => editDoctor(doctor)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-sm font-semibold transition-all"
                            >
                              ✏️ Edit
                            </motion.button>
                            <motion.button
                              onClick={() => deleteDoctor(doctor._id)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="px-4 py-2 rounded-lg bg-white border-2 border-black text-black hover:bg-black hover:text-white text-sm font-semibold transition-all"
                            >
                              🗑️ Delete
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {filteredDoctors.length === 0 && !loading && (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-3">👨‍⚕️</div>
                      <p className="text-sm text-black font-medium">No doctors found</p>
                      <p className="text-xs text-black mt-1">
                        {searchQuery ? "Try adjusting your search" : "Add a doctor to get started"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </AnimatedCard>
          </div>
        </>
      )}

      {/* Doctor Records Tab */}
      {activeTab === "records" && (
        <>
          <AnimatedCard delay={0.1} className="mb-6">
            <input
              type="text"
              placeholder="Search doctors by name or email..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </AnimatedCard>

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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Appointments</p>
                      <p className="text-lg font-bold text-black">{stats.totalAppointments}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Prescriptions</p>
                      <p className="text-lg font-bold text-black">{stats.totalPrescriptions}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Prescription Reports Tab */}
      {activeTab === "prescriptions" && (
        <>
          <AnimatedCard delay={0.1}>
            <h3 className="text-lg font-bold text-black mb-4">Prescription Reports</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {prescriptionReports.map((pres, idx) => (
                <motion.div
                  key={pres._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  onClick={() => setSelectedPrescription(pres)}
                  className="medical-card cursor-pointer border-l-4 border-l-blue-600 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💊</span>
                      <h4 className="text-lg font-bold text-black">
                        Prescription #{pres._id.slice(-8)}
                      </h4>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">👨‍⚕️</span>
                      <span className="text-sm font-semibold text-black truncate">
                        {getDoctorNameForPrescription(pres.doctorId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">👤</span>
                      <span className="text-sm font-semibold text-black truncate">
                        {getPatientNameForPrescription(pres.patientId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">📅</span>
                      <span className="text-xs text-black">
                        {new Date(pres.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-blue-200">
                    <p className="text-xs text-black font-medium">
                      {pres.items?.length || 0} {pres.items?.length === 1 ? 'Medicine' : 'Medicines'}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Click to view details →</p>
                  </div>
                </motion.div>
              ))}
              {prescriptionReports.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-sm text-black font-medium">No prescription reports found</p>
                </div>
              )}
            </div>
          </AnimatedCard>

          {/* Prescription Detail Modal */}
          {selectedPrescription && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedPrescription(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between p-6 border-b border-blue-200 bg-blue-50">
                  <div>
                    <h3 className="text-xl font-bold text-black mb-1">
                      Prescription #{selectedPrescription._id.slice(-8)}
                    </h3>
                    <p className="text-sm text-black">
                      {getDoctorNameForPrescription(selectedPrescription.doctorId)} → {getPatientNameForPrescription(selectedPrescription.patientId)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPrescription(null)}
                    className="text-black hover:text-blue-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Basic Information */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="text-sm font-bold text-black mb-3">Basic Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs font-medium text-black">👨‍⚕️ Doctor:</span>
                        <p className="text-sm font-semibold text-black mt-1">
                          {getDoctorNameForPrescription(selectedPrescription.doctorId)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-black">👤 Patient:</span>
                        <p className="text-sm font-semibold text-black mt-1">
                          {getPatientNameForPrescription(selectedPrescription.patientId)}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-xs font-medium text-black">📅 Date & Time:</span>
                        <p className="text-sm text-black mt-1">
                          {new Date(selectedPrescription.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Prescription Items */}
                  {selectedPrescription.items && selectedPrescription.items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-black mb-3">
                        Medicines ({selectedPrescription.items.length} {selectedPrescription.items.length === 1 ? 'item' : 'items'})
                      </h4>
                      <div className="space-y-3">
                        {selectedPrescription.items.map((item: any, itemIdx: number) => (
                          <div key={itemIdx} className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <p className="font-bold text-base text-black mb-2">{item.medicineName}</p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="font-semibold text-black">Dosage:</span>
                                <p className="text-black mt-1">{item.dosage || "N/A"}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-black">Frequency:</span>
                                <p className="text-black mt-1">{item.frequency || "N/A"}</p>
                              </div>
                              <div className="col-span-2">
                                <span className="font-semibold text-black">Duration:</span>
                                <p className="text-black mt-1">{item.duration || "N/A"}</p>
                              </div>
                              {item.notes && (
                                <div className="col-span-2 bg-white rounded p-2 border border-green-200">
                                  <span className="font-semibold text-black text-xs">Notes:</span>
                                  <p className="text-sm text-black mt-1">{item.notes}</p>
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
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="text-sm font-bold text-black mb-2">Additional Notes</h4>
                      <p className="text-sm text-black bg-white rounded p-3 border border-blue-200">
                        {selectedPrescription.notes}
                      </p>
                    </div>
                  )}

                  {/* Suggestions */}
                  {selectedPrescription.suggestions && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="text-sm font-bold text-black mb-2">Suggestions</h4>
                      <p className="text-sm text-black bg-white rounded p-3 border border-green-200">
                        {selectedPrescription.suggestions}
                      </p>
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <div className="p-6 border-t border-blue-200 bg-blue-50">
                  <motion.button
                    onClick={() => setSelectedPrescription(null)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-6 py-3 bg-white border-2 border-black text-black rounded-lg font-semibold transition-colors hover:bg-black hover:text-white"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* Patient Reports Tab */}
      {activeTab === "reports" && (
        <>
          <AnimatedCard delay={0.1}>
            <h3 className="text-lg font-bold text-black mb-4">Patient Reports</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportRequests.map((report, idx) => (
                <motion.div
                  key={report._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  onClick={() => setSelectedReport(report)}
                  className="medical-card cursor-pointer border-l-4 border-l-purple-600 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📋</span>
                      <h4 className="text-lg font-bold text-black">
                        {report.reportType}
                      </h4>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        report.status === "UPLOADED"
                          ? "bg-green-100 text-green-700"
                          : report.status === "REVIEWED"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">👨‍⚕️</span>
                      <span className="text-sm font-semibold text-black truncate">
                        {getDoctorNameForPrescription(report.doctorId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">👤</span>
                      <span className="text-sm font-semibold text-black truncate">
                        {getPatientNameForPrescription(report.patientId)}
                      </span>
                    </div>
                    {report.description && (
                      <p className="text-xs text-black line-clamp-2">{report.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">📅</span>
                      <span className="text-xs text-black">
                        {new Date(report.requestedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {report.status === "UPLOADED" && (
                    <div className="pt-3 border-t border-purple-200">
                      <p className="text-xs text-purple-600 font-medium">Report uploaded - Click to view →</p>
                    </div>
                  )}
                </motion.div>
              ))}
              {reportRequests.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-sm text-black font-medium">No report requests found</p>
                </div>
              )}
            </div>
          </AnimatedCard>

          {/* Report Detail Modal */}
          {selectedReport && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedReport(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between p-6 border-b border-purple-200 bg-purple-50">
                  <div>
                    <h3 className="text-xl font-bold text-black mb-1">
                      {selectedReport.reportType}
                    </h3>
                    <p className="text-sm text-black">
                      {getDoctorNameForPrescription(selectedReport.doctorId)} → {getPatientNameForPrescription(selectedReport.patientId)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="text-black hover:text-purple-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Basic Information */}
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <h4 className="text-sm font-bold text-black mb-3">Report Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs font-medium text-black">👨‍⚕️ Doctor:</span>
                        <p className="text-sm font-semibold text-black mt-1">
                          {getDoctorNameForPrescription(selectedReport.doctorId)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-black">👤 Patient:</span>
                        <p className="text-sm font-semibold text-black mt-1">
                          {getPatientNameForPrescription(selectedReport.patientId)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-black">📋 Type:</span>
                        <p className="text-sm font-semibold text-black mt-1">
                          {selectedReport.reportType}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-black">📊 Status:</span>
                        <p className="text-sm font-semibold text-black mt-1">
                          {selectedReport.status}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-xs font-medium text-black">📅 Requested:</span>
                        <p className="text-sm text-black mt-1">
                          {new Date(selectedReport.requestedAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </p>
                      </div>
                      {selectedReport.description && (
                        <div className="sm:col-span-2">
                          <span className="text-xs font-medium text-black">📝 Description:</span>
                          <p className="text-sm text-black mt-1 bg-white rounded p-2 border border-purple-200">
                            {selectedReport.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Uploaded Report */}
                  {selectedReport.status === "UPLOADED" && selectedReport.fileUrl && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="text-sm font-bold text-black mb-3">Uploaded Report</h4>
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs font-medium text-black">📄 File Name:</span>
                          <p className="text-sm font-semibold text-black mt-1">
                            {selectedReport.fileName || "Report File"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-black">📅 Uploaded:</span>
                          <p className="text-sm text-black mt-1">
                            {selectedReport.uploadedAt
                              ? new Date(selectedReport.uploadedAt).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : "N/A"}
                          </p>
                        </div>
                        <a
                          href={`${API_BASE}${selectedReport.fileUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full rounded-lg bg-green-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-green-700 transition-all"
                        >
                          📄 View Report
                        </a>
                      </div>
                    </div>
                  )}

                  {selectedReport.status === "PENDING" && (
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <p className="text-sm text-black">
                        ⏳ Waiting for patient to upload the report...
                      </p>
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <div className="p-6 border-t border-purple-200 bg-purple-50">
                  <motion.button
                    onClick={() => setSelectedReport(null)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-6 py-3 bg-white border-2 border-black text-black rounded-lg font-semibold transition-colors hover:bg-black hover:text-white"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* Document Panel Tab */}
      {activeTab === "documents" && (
        <AnimatedCard delay={0.1}>
          <h3 className="text-lg font-bold text-black mb-4">Document Panel</h3>
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📁</div>
            <p className="text-sm text-gray-600 font-medium">Document Management</p>
            <p className="text-xs text-gray-500 mt-1">Document panel feature coming soon</p>
          </div>
        </AnimatedCard>
      )}

      {/* Service Pricing Tab */}
      {activeTab === "pricing" && (
        <>
          <AnimatedCard delay={0.1} className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-black">Doctor Service Charges</h3>
              <motion.button
                onClick={() => {
                  setShowAddPricingModal(true);
                  setEditingPricing(null);
                  setNewPricing({
                    serviceType: "CONSULTATION",
                    doctorId: "",
                    basePrice: 0,
                    discountPercent: 0,
                    discountAmount: 0,
                    isActive: true,
                    validFrom: "",
                    validTo: "",
                  });
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm shadow-lg transition-all"
              >
                + Add Service Charge
              </motion.button>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {pricing.map((p, idx) => (
                <motion.div
                  key={p._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                          {p.serviceType}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          p.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="font-semibold text-black mb-1">
                        Base Price: ₹{p.basePrice.toLocaleString()}
                      </p>
                      {p.doctorId && (
                        <p className="text-sm text-gray-600">Doctor: {doctors.find(d => d._id === p.doctorId)?.name || p.doctorId.slice(-8)}</p>
                      )}
                      {(p.discountPercent || p.discountAmount) && (
                        <p className="text-sm text-green-600">
                          Discount: {p.discountPercent ? `${p.discountPercent}%` : `₹${p.discountAmount}`}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => {
                          setEditingPricing(p);
                          setNewPricing({
                            serviceType: p.serviceType,
                            doctorId: p.doctorId || "",
                            basePrice: p.basePrice,
                            discountPercent: p.discountPercent || 0,
                            discountAmount: p.discountAmount || 0,
                            isActive: p.isActive,
                            validFrom: p.validFrom ? new Date(p.validFrom).toISOString().split('T')[0] : "",
                            validTo: p.validTo ? new Date(p.validTo).toISOString().split('T')[0] : "",
                          });
                          setShowAddPricingModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium"
                      >
                        ✏️ Edit
                      </motion.button>
                      <motion.button
                        onClick={() => deletePricing(p._id)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-medium"
                      >
                        🗑️ Delete
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
              {pricing.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">💵</div>
                  <p className="text-sm text-gray-600 font-medium">No doctor service charges found</p>
                </div>
              )}
            </div>
          </AnimatedCard>

          {/* Add/Edit Pricing Modal */}
          {showAddPricingModal && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => {
                setShowAddPricingModal(false);
                setEditingPricing(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-black">
                    {editingPricing ? "Edit" : "Add"} Doctor Service Charge
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddPricingModal(false);
                      setEditingPricing(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={createPricing} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Service Type</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      value={newPricing.serviceType}
                      onChange={(e) => setNewPricing((prev) => ({ ...prev, serviceType: e.target.value }))}
                      required
                    >
                      <option value="CONSULTATION">Consultation Fee</option>
                      <option value="FOLLOW_UP">Follow-up Consultation</option>
                      <option value="EMERGENCY">Emergency Consultation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Select Doctor (Optional)</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      value={newPricing.doctorId}
                      onChange={(e) => setNewPricing((prev) => ({ ...prev, doctorId: e.target.value }))}
                    >
                      <option value="">All Doctors</option>
                      {doctors.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Base Price (₹)</label>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      value={newPricing.basePrice}
                      onChange={(e) => setNewPricing((prev) => ({ ...prev, basePrice: Number(e.target.value) }))}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-black mb-2">Discount %</label>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        value={newPricing.discountPercent}
                        onChange={(e) => setNewPricing((prev) => ({ ...prev, discountPercent: Number(e.target.value) }))}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-black mb-2">Discount Amount (₹)</label>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        value={newPricing.discountAmount}
                        onChange={(e) => setNewPricing((prev) => ({ ...prev, discountAmount: Number(e.target.value) }))}
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <motion.button
                      type="button"
                      onClick={() => {
                        setShowAddPricingModal(false);
                        setEditingPricing(null);
                      }}
                      className="flex-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 text-sm transition-all"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      type="submit"
                      className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2.5 text-sm shadow-lg transition-all"
                    >
                      {editingPricing ? "Update" : "Create"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </>
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

