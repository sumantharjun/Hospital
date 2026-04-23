import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { HospitalIcon, PlusIcon, EditIcon, DeleteIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function HospitalManagementPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Hospital Management State
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHospital, setEditingHospital] = useState<any>(null);
  
  // Form states
  const [hospitalForm, setHospitalForm] = useState({ 
    name: "", 
    address: "", 
    phone: "",
    registrationNumber: "",
    type: "Clinic" as "Clinic" | "Multi-Speciality" | "Diagnostic" | "Government" | "Private",
    establishedYear: "",
    description: "",
    registrationCharge: ""
  });
  
  const [loading, setLoading] = useState(true);

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
    fetchHospitals();
  }, [token]);

  const fetchHospitals = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/master/hospitals`, { headers });
      setHospitals(res.ok ? await res.json() : []);
    } catch (e) {
      toast.error("Failed to fetch hospitals");
    } finally {
      setLoading(false);
    }
  };

  const createHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/master/hospitals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: hospitalForm.name,
          address: hospitalForm.address,
          contactNumber: hospitalForm.phone,
          registrationNumber: hospitalForm.registrationNumber,
          type: hospitalForm.type,
          establishedYear: hospitalForm.establishedYear ? parseInt(hospitalForm.establishedYear) : undefined,
          description: hospitalForm.description,
          registrationCharge: hospitalForm.registrationCharge ? parseFloat(hospitalForm.registrationCharge) : undefined,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create hospital");
      }

      const createdHospital = await res.json();
      setHospitals((prev) => [createdHospital, ...prev]);
      setHospitalForm({ 
        name: "", 
        address: "", 
        phone: "", 
        registrationNumber: "",
        type: "Clinic",
        establishedYear: "",
        description: "",
        registrationCharge: ""
      });
      setShowAddModal(false);
      toast.success("Hospital created successfully!");
    } catch (e: any) {
      toast.error(e.message || "Error creating hospital");
    }
  };

  const updateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingHospital) return;
    try {
      const res = await fetch(`${API_BASE}/api/master/hospitals/${editingHospital._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: hospitalForm.name,
          address: hospitalForm.address,
          contactNumber: hospitalForm.phone,
          registrationNumber: hospitalForm.registrationNumber,
          type: hospitalForm.type,
          establishedYear: hospitalForm.establishedYear ? parseInt(hospitalForm.establishedYear) : undefined,
          description: hospitalForm.description,
          registrationCharge: hospitalForm.registrationCharge ? parseFloat(hospitalForm.registrationCharge) : undefined,
        }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setHospitals((prev) => prev.map((h) => (h._id === editingHospital._id ? updated : h)));
        setHospitalForm({ 
          name: "", 
          address: "", 
          phone: "", 
          registrationNumber: "",
          type: "Clinic",
          establishedYear: "",
          description: "",
          registrationCharge: ""
        });
        setShowEditModal(false);
        setEditingHospital(null);
        toast.success("Hospital updated successfully!");
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.message || "Failed to update hospital");
      }
    } catch (e) {
      toast.error("Error updating hospital");
    }
  };

  const deleteHospital = async (id: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this hospital?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/master/hospitals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setHospitals((prev) => prev.filter((h) => h._id !== id));
        toast.success("Hospital deleted successfully!");
      } else {
        toast.error("Failed to delete hospital");
      }
    } catch (e) {
      toast.error("Error deleting hospital");
    }
  };

  const openEditModal = (hospital: any) => {
    setEditingHospital(hospital);
    setHospitalForm({ 
      name: hospital.name || "", 
      address: hospital.address || "", 
      phone: hospital.contactNumber || hospital.phone || "",
      registrationNumber: hospital.registrationNumber || "",
      type: hospital.type || "Clinic",
      establishedYear: hospital.establishedYear ? String(hospital.establishedYear) : "",
      description: hospital.description || "",
      registrationCharge: hospital.registrationCharge ? String(hospital.registrationCharge) : ""
    });
    setShowEditModal(true);
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="hospital-management">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <div className="medical-card bg-gradient-to-r from-white via-white to-emerald-50/70 border border-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase mb-2">Management</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-slate-900">
                Hospital Management
              </h2>
              <p className="text-sm text-slate-600">
                Manage hospitals, registrations, and key operational details.
              </p>
            </div>
            <motion.button
              onClick={() => {
                setHospitalForm({ 
                  name: "", 
                  address: "", 
                  phone: "", 
                  registrationNumber: "",
                  type: "Clinic",
                  establishedYear: "",
                  description: "",
                  registrationCharge: ""
                });
                setShowAddModal(true);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full shadow-sm transition-all flex items-center gap-2 text-sm sm:text-base"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Hospital</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Hospitals Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hospitals.map((h, idx) => (
            <AnimatedCard key={h._id} delay={idx * 0.1} className="p-0">
              <div className="p-6 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-50 to-emerald-100 border border-emerald-100 flex items-center justify-center">
                      <HospitalIcon className="w-6 h-6 text-teal-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{h.name}</h3>
                      <p className="text-xs text-slate-500">ID: {h._id.slice(-8)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
                    {h.type || "Hospital"}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mt-1">Address</span>
                    <p className="flex-1">{h.address || "—"}</p>
                  </div>
                  {h.contactNumber && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">Phone</span>
                      <p>{h.contactNumber}</p>
                    </div>
                  )}
                  {h.registrationNumber && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">Reg</span>
                      <p>{h.registrationNumber}</p>
                    </div>
                  )}
                  {h.establishedYear && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">Est</span>
                      <p>{h.establishedYear}</p>
                    </div>
                  )}
                  {h.registrationCharge && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">Charge</span>
                      <p className="font-semibold text-slate-900">Rs. {Number(h.registrationCharge).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-100 mt-auto">
                  <motion.button
                    type="button"
                    onClick={() => openEditModal(h)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 px-3 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <EditIcon className="w-4 h-4" />
                    <span>Edit</span>
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => deleteHospital(h._id)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-2 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-semibold transition-all flex items-center justify-center"
                  >
                    <DeleteIcon className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </AnimatedCard>
          ))}
          {hospitals.length === 0 && (
            <div className="col-span-full">
              <div className="medical-card flex flex-col items-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-50 to-emerald-100 border border-emerald-100 flex items-center justify-center mb-4">
                  <HospitalIcon className="w-8 h-8 text-teal-700" />
                </div>
                <p className="text-lg text-slate-700 font-semibold mb-2">No hospitals found</p>
                <p className="text-sm text-slate-500">Click "Add Hospital" to create your first entry.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Hospital Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto z-[110]"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Add New Hospital</h2>
            <form onSubmit={createHospital} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Hospital Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={hospitalForm.name}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                  className="medical-input w-full"
                  placeholder="Enter hospital name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Registration Number / License Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={hospitalForm.registrationNumber}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, registrationNumber: e.target.value })}
                  className="medical-input w-full"
                  placeholder="Enter registration number"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Hospital Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={hospitalForm.type}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, type: e.target.value as any })}
                  className="medical-input w-full"
                >
                  <option value="Clinic">Clinic</option>
                  <option value="Multi-Speciality">Multi-Speciality</option>
                  <option value="Diagnostic">Diagnostic Center</option>
                  <option value="Government">Government</option>
                  <option value="Private">Private</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={hospitalForm.address}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
                  className="medical-input w-full"
                  placeholder="Enter hospital address"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={hospitalForm.phone}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, phone: e.target.value })}
                  className="medical-input w-full"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Established Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1900"
                  max={new Date().getFullYear()}
                  value={hospitalForm.establishedYear}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, establishedYear: e.target.value })}
                  className="medical-input w-full"
                  placeholder="Enter established year"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={hospitalForm.description}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, description: e.target.value })}
                  className="medical-input w-full"
                  placeholder="Enter hospital description"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  First Time Registration Charge (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={hospitalForm.registrationCharge}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, registrationCharge: e.target.value })}
                  className="medical-input w-full"
                  placeholder="Enter registration charge"
                />
                <p className="text-xs text-slate-500 mt-1">Charge for first time registration/number booking</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 medical-btn-primary"
                >
                  Create Hospital
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setHospitalForm({ 
                      name: "", 
                      address: "", 
                      phone: "", 
                      registrationNumber: "",
                      type: "Clinic",
                      establishedYear: "",
                      description: "",
                      registrationCharge: ""
                    });
                  }}
                  className="flex-1 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Hospital Modal */}
      {showEditModal && editingHospital && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto z-[110]"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Edit Hospital</h2>
            <form onSubmit={updateHospital} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Hospital Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={hospitalForm.name}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                  className="medical-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Registration Number / License Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={hospitalForm.registrationNumber}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, registrationNumber: e.target.value })}
                  className="medical-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Hospital Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={hospitalForm.type}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, type: e.target.value as any })}
                  className="medical-input w-full"
                >
                  <option value="Clinic">Clinic</option>
                  <option value="Multi-Speciality">Multi-Speciality</option>
                  <option value="Diagnostic">Diagnostic Center</option>
                  <option value="Government">Government</option>
                  <option value="Private">Private</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={hospitalForm.address}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
                  className="medical-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={hospitalForm.phone}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, phone: e.target.value })}
                  className="medical-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Established Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1900"
                  max={new Date().getFullYear()}
                  value={hospitalForm.establishedYear}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, establishedYear: e.target.value })}
                  className="medical-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={hospitalForm.description}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, description: e.target.value })}
                  className="medical-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  First Time Registration Charge (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={hospitalForm.registrationCharge}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, registrationCharge: e.target.value })}
                  className="medical-input w-full"
                  placeholder="Enter registration charge"
                />
                <p className="text-xs text-slate-500 mt-1">Charge for first time registration/number booking</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 medical-btn-primary"
                >
                  Update Hospital
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingHospital(null);
                    setHospitalForm({ 
                      name: "", 
                      address: "", 
                      phone: "", 
                      registrationNumber: "",
                      type: "Clinic",
                      establishedYear: "",
                      description: "",
                      registrationCharge: ""
                    });
                  }}
                  className="flex-1 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}




