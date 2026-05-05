import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import { PharmacyIcon, PlusIcon, EditIcon, DeleteIcon, EyeIcon, EyeOffIcon, ReportsIcon } from "../components/Icons";
import { useUserStatus } from "../hooks/useUserStatus";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function PharmacyManagementPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Pharmacy Management State
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState<any>(null);
  const [viewingPharmacy, setViewingPharmacy] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  
  // Form states
  const [pharmacyForm, setPharmacyForm] = useState({ 
    name: "", 
    address: "", 
    phone: "",
    email: "",
    password: "",
    distributorId: ""
  });
  
  const [loading, setLoading] = useState(true);

  // Get pharmacy user IDs for status tracking
  const [pharmacyUserMap, setPharmacyUserMap] = useState<Map<string, string>>(new Map());
  
  useEffect(() => {
    // Fetch pharmacy user IDs - filter by pharmacyId on frontend
    const fetchPharmacyUserIds = async () => {
      if (!token || pharmacies.length === 0) return;
      try {
        // Fetch all pharmacy staff users once
        const userRes = await fetch(`${API_BASE}/api/users?role=PHARMACY_STAFF`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!userRes.ok) {
          console.error("Failed to fetch pharmacy users");
          return;
        }
        
        const users = await userRes.json();
        const userList = Array.isArray(users) ? users : (users.users || []);
        
        // Map each pharmacy to its user
        const map = new Map<string, string>();
        for (const pharmacy of pharmacies) {
          // Find user for THIS SPECIFIC pharmacy
          const pharmacyUser = userList.find((u: any) => 
            (u.pharmacyId === pharmacy._id) || 
            (String(u.pharmacyId) === String(pharmacy._id))
          );
          if (pharmacyUser) {
            const userId = pharmacyUser._id || pharmacyUser.id;
            map.set(pharmacy._id, userId);
          }
        }
        setPharmacyUserMap(map);
      } catch (e) {
        console.error("Failed to fetch pharmacy user IDs:", e);
      }
    };
    fetchPharmacyUserIds();
  }, [pharmacies, token]);

  const pharmacyUserIds = Array.from(pharmacyUserMap.values());
  const { getStatus } = useUserStatus(pharmacyUserIds);

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
    fetchPharmacies();
    fetchDistributors();
  }, [token]);

  const fetchDistributors = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/master/distributors`, { headers });
      setDistributors(res.ok ? await res.json() : []);
    } catch (e) {
      console.error("Failed to fetch distributors:", e);
    }
  };

  const fetchPharmacies = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/master/pharmacies`, { headers });
      setPharmacies(res.ok ? await res.json() : []);
    } catch (e) {
      toast.error("Failed to fetch pharmacies");
    } finally {
      setLoading(false);
    }
  };

  const createPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      // First create the pharmacy
      const pharmacyRes = await fetch(`${API_BASE}/api/master/pharmacies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: pharmacyForm.name,
          address: pharmacyForm.address,
          phone: pharmacyForm.phone,
          distributorId: pharmacyForm.distributorId || undefined, // Include distributorId if provided
        }),
      });
      
      if (!pharmacyRes.ok) {
        const error = await pharmacyRes.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create pharmacy");
      }

      const createdPharmacy = await pharmacyRes.json();

      // Then create login credentials if email and password are provided
      if (pharmacyForm.email && pharmacyForm.password) {
        const userRes = await fetch(`${API_BASE}/api/users/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: pharmacyForm.name,
            email: pharmacyForm.email,
            password: pharmacyForm.password,
            role: "PHARMACY_STAFF",
            pharmacyId: createdPharmacy._id,
            phone: pharmacyForm.phone ? String(pharmacyForm.phone).replace(/\D/g, "").slice(-10) : undefined,
          }),
        });

        if (!userRes.ok) {
          const error = await userRes.json().catch(() => ({}));
          // Pharmacy was created but user creation failed - still show pharmacy
          toast.error(error.message || "Pharmacy created but failed to create login credentials");
        } else {
          toast.success("Pharmacy and login credentials created successfully!");
        }
      } else {
        toast.success("Pharmacy created successfully! You can create login credentials later.");
      }

      setPharmacies((prev) => [createdPharmacy, ...prev]);
      setPharmacyForm({ name: "", address: "", phone: "", email: "", password: "", distributorId: "" });
      setShowAddModal(false);
    } catch (e: any) {
      toast.error(e.message || "Error creating pharmacy");
    }
  };

  const updatePharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingPharmacy) return;
    try {
      // Update pharmacy details
      const pharmacyRes = await fetch(`${API_BASE}/api/master/pharmacies/${editingPharmacy._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: pharmacyForm.name,
          address: pharmacyForm.address,
          phone: pharmacyForm.phone,
          distributorId: pharmacyForm.distributorId || undefined, // Include distributorId if provided
        }),
      });
      
      if (!pharmacyRes.ok) {
        const error = await pharmacyRes.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update pharmacy");
      }

      // Update login credentials if email or password are provided
      if (pharmacyForm.email || pharmacyForm.password) {
        // First, find existing user for THIS SPECIFIC pharmacy
        let existingUser = null;
        try {
          // Fetch all pharmacy staff users and filter by pharmacyId on frontend
          const userRes = await fetch(`${API_BASE}/api/users?role=PHARMACY_STAFF`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            const users = await userRes.json();
            const userList = Array.isArray(users) ? users : (users.users || []);
            // Filter to find user for THIS SPECIFIC pharmacy
            existingUser = userList.find((u: any) => 
              (u.pharmacyId === editingPharmacy._id) || 
              (String(u.pharmacyId) === String(editingPharmacy._id))
            );
          }
        } catch (e) {
          console.error("Error fetching existing user:", e);
        }

        if (existingUser) {
          // Update existing user - ensure pharmacyId is preserved
          const updatePayload: any = {
            pharmacyId: editingPharmacy._id, // Always ensure pharmacyId is set correctly
          };
          if (pharmacyForm.email) updatePayload.email = pharmacyForm.email;
          if (pharmacyForm.password && pharmacyForm.password.trim() !== "") {
            updatePayload.password = pharmacyForm.password;
          }
          if (pharmacyForm.name) updatePayload.name = pharmacyForm.name;
          if (pharmacyForm.phone !== undefined) {
            updatePayload.phone = pharmacyForm.phone ? String(pharmacyForm.phone).replace(/\D/g, "").slice(-10) : pharmacyForm.phone;
          }

          const userRes = await fetch(`${API_BASE}/api/users/${existingUser._id || existingUser.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updatePayload),
          });

          if (!userRes.ok) {
            const error = await userRes.json().catch(() => ({}));
            toast.error("Pharmacy updated but failed to update login credentials: " + (error.message || "Unknown error"));
          } else {
            toast.success("Pharmacy and login credentials updated successfully!");
          }
        } else {
          // Create new user if doesn't exist - ensure it's linked to THIS pharmacy
          if (pharmacyForm.email && pharmacyForm.password) {
            // Check if email already exists for another pharmacy
            try {
              const checkUserRes = await fetch(`${API_BASE}/api/users?role=PHARMACY_STAFF`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (checkUserRes.ok) {
                const allUsers = await checkUserRes.json();
                const userList = Array.isArray(allUsers) ? allUsers : (allUsers.users || []);
                const emailExists = userList.find((u: any) => 
                  u.email === pharmacyForm.email && 
                  u.pharmacyId && 
                  String(u.pharmacyId) !== String(editingPharmacy._id)
                );
                if (emailExists) {
                  toast.error(`This email is already used by another pharmacy. Please use a different email.`);
                  return;
                }
              }
            } catch (e) {
              console.error("Error checking existing email:", e);
            }

            const userRes = await fetch(`${API_BASE}/api/users/signup`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: pharmacyForm.name,
                email: pharmacyForm.email,
                password: pharmacyForm.password,
                role: "PHARMACY_STAFF",
                pharmacyId: editingPharmacy._id, // Ensure it's linked to THIS pharmacy
                phone: pharmacyForm.phone ? String(pharmacyForm.phone).replace(/\D/g, "").slice(-10) : undefined,
              }),
            });

            if (!userRes.ok) {
              const error = await userRes.json().catch(() => ({}));
              toast.error("Pharmacy updated but failed to create login credentials: " + (error.message || "Unknown error"));
            } else {
              toast.success("Pharmacy and login credentials created successfully!");
            }
          } else {
            toast.error("Email and password are required to create new login credentials");
          }
        }
      } else {
        toast.success("Pharmacy updated successfully!");
      }

      const updated = await pharmacyRes.json();
      setPharmacies((prev) => prev.map((p) => (p._id === editingPharmacy._id ? updated : p)));
      
      // Refresh pharmacy user IDs after updating credentials
      if (pharmacyForm.email || pharmacyForm.password) {
        // Trigger a refresh of pharmacy user map
        const map = new Map(pharmacyUserMap);
        // The useEffect will automatically refresh when pharmacies change
        setPharmacyUserMap(map);
      }
      
      setPharmacyForm({ name: "", address: "", phone: "", email: "", password: "", distributorId: "" });
      setShowEditModal(false);
      setEditingPharmacy(null);
      setShowEditPassword(false);
    } catch (e: any) {
      toast.error(e.message || "Error updating pharmacy");
    }
  };

  const deletePharmacy = async (id: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this pharmacy?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/master/pharmacies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPharmacies((prev) => prev.filter((p) => p._id !== id));
        toast.success("Pharmacy deleted successfully!");
      } else {
        toast.error("Failed to delete pharmacy");
      }
    } catch (e) {
      toast.error("Error deleting pharmacy");
    }
  };

  const openEditModal = async (pharmacy: any) => {
    setEditingPharmacy(pharmacy);
    setPharmacyForm({ 
      name: pharmacy.name || "", 
      address: pharmacy.address || "", 
      phone: pharmacy.phone || "",
      email: "",
      password: "",
      distributorId: pharmacy.distributorId || ""
    });
    setShowEditModal(true);
    setShowEditPassword(false);

    // Fetch existing user email for THIS SPECIFIC pharmacy
    if (token) {
      try {
        // Fetch all pharmacy staff users and filter by pharmacyId
        const userRes = await fetch(`${API_BASE}/api/users?role=PHARMACY_STAFF`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userRes.ok) {
          const users = await userRes.json();
          // Handle both array and object responses
          const userList = Array.isArray(users) ? users : (users.users || []);
          // Find user for THIS SPECIFIC pharmacy
          const pharmacyUser = userList.find((u: any) => 
            (u.pharmacyId === pharmacy._id) || 
            (String(u.pharmacyId) === String(pharmacy._id))
          );
          if (pharmacyUser && pharmacyUser.email) {
            setPharmacyForm(prev => ({
              ...prev,
              email: pharmacyUser.email
            }));
          }
        }
      } catch (e) {
        // Silently fail - email field will just be empty
        console.log("Could not fetch pharmacy user email:", e);
      }
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="pharmacy-management">
            <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <div className="medical-card bg-gradient-to-r from-white via-white to-cyan-50/70 border border-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase mb-2">Management</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-slate-900">
                Pharmacy Management
              </h2>
              <p className="text-sm text-slate-600">
                Manage pharmacies and create login credentials for pharmacy staff.
              </p>
            </div>
            <motion.button
              onClick={() => {
                setPharmacyForm({ name: "", address: "", phone: "", email: "", password: "", distributorId: "" });
                setShowPassword(false);
                setShowAddModal(true);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full shadow-sm transition-all flex items-center gap-2 text-sm sm:text-base"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Pharmacy</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Pharmacies Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pharmacies.map((p, idx) => {
            const userId = pharmacyUserMap.get(p._id);
            const isOnline = userId ? getStatus(userId) : false;
            return (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
                className="medical-card p-6"
              >
                  {/* Header Section */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-50 to-emerald-100 border border-emerald-100 flex items-center justify-center">
                        <PharmacyIcon className="w-6 h-6 text-teal-700" />
                      </div>
                      {/* Online Status Indicator */}
                      <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`} title={isOnline ? 'Online' : 'Offline'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base text-slate-900 mb-2">{p.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          isOnline 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isOnline ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-slate-400">#{p._id.slice(-8)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Details Section */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2">
                      
                      <p className="text-sm text-slate-600 flex-1">{p.address}</p>
                    </div>
                    {p.phone && (
                      <div className="flex items-center gap-2">
                        
                        <p className="text-sm text-slate-600">{p.phone}</p>
                      </div>
                    )}
                    {p.distributorId && (
                      <div className="flex items-center gap-2">
                        
                        <p className="text-sm text-slate-600">
                          Linked to: {distributors.find(d => d._id === p.distributorId)?.name || `Distributor ${p.distributorId.slice(-8)}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <motion.button
                      onClick={() => {
                        setViewingPharmacy(p);
                        setShowViewModal(true);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-3 py-2 rounded bg-white hover:bg-gray-50 text-slate-700 border border-slate-200 text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                    >
                      <EyeIcon className="w-4 h-4" />
                      <span>View</span>
                    </motion.button>
                    <motion.button
                      onClick={() => openEditModal(p)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-3 py-2 rounded bg-cyan-50 hover:bg-blue-100 text-teal-700 border border-emerald-100 text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                    >
                      <EditIcon className="w-4 h-4" />
                      <span>Edit</span>
                    </motion.button>
                    <motion.button
                      onClick={() => deletePharmacy(p._id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-3 py-2 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-medium transition-all flex items-center justify-center"
                    >
                      <DeleteIcon className="w-4 h-4" />
                    </motion.button>
                  </div>
              </motion.div>
            );
          })}
          
          {pharmacies.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-lg bg-cyan-50 flex items-center justify-center border border-emerald-100">
                  <PharmacyIcon className="w-10 h-10 text-slate-900" />
                </div>
              </div>
              <p className="text-lg text-slate-700 font-medium mb-2">No pharmacies found</p>
              <p className="text-sm text-slate-600">Click "Add New Pharmacy" to get started</p>
            </div>
          )}
        </div>
      )}

      {/* Add Pharmacy Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto z-[110]"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Add New Pharmacy</h2>
            <form onSubmit={createPharmacy} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Pharmacy Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={pharmacyForm.name}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                  placeholder="Enter pharmacy name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={pharmacyForm.address}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, address: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                  placeholder="Enter pharmacy address"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={pharmacyForm.phone}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Distributor
                </label>
                <select
                  value={pharmacyForm.distributorId}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, distributorId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                >
                  <option value="">Select a distributor (optional)</option>
                  {distributors.map((distributor) => (
                    <option key={distributor._id} value={distributor._id}>
                      {distributor.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Link this pharmacy to a distributor</p>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Login Credentials</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="new-password"
                      value={pharmacyForm.email}
                      onChange={(e) => setPharmacyForm({ ...pharmacyForm, email: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                      placeholder="pharmacy@example.com"
                    />
                    <p className="text-xs text-slate-500 mt-1">This will be used to login to the pharmacy panel</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        value={pharmacyForm.password}
                        onChange={(e) => setPharmacyForm({ ...pharmacyForm, password: e.target.value })}
                        className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                        placeholder="Enter new password for pharmacy"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOffIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Minimum 6 characters - Create a new password for pharmacy access</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 medical-btn-primary"
                >
                  Create Pharmacy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setPharmacyForm({ name: "", address: "", phone: "", email: "", password: "", distributorId: "" });
                    setShowPassword(false);
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

      {/* View Pharmacy Modal */}
      {showViewModal && viewingPharmacy && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto z-[110]"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Pharmacy Details</h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingPharmacy(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                <div className="w-16 h-16 rounded-lg bg-cyan-50 flex items-center justify-center border border-emerald-100 relative">
                  <PharmacyIcon className="w-8 h-8 text-slate-900" />
                  {(() => {
                    const userId = pharmacyUserMap.get(viewingPharmacy._id);
                    const isOnline = userId ? getStatus(userId) : false;
                    return (
                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`} title={isOnline ? 'Online' : 'Offline'} />
                    );
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-slate-900">{viewingPharmacy.name}</h3>
                    {(() => {
                      const userId = pharmacyUserMap.get(viewingPharmacy._id);
                      const isOnline = userId ? getStatus(userId) : false;
                      return (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          isOnline 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {isOnline ? 'Active' : 'Inactive'}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-slate-500">ID: {viewingPharmacy._id.slice(-8)}</p>
                </div>
              </div>

              {/* Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</label>
                  <div className="flex items-start gap-2">
                    
                    <p className="text-sm text-slate-900 flex-1">{viewingPharmacy.address}</p>
                  </div>
                </div>

                {viewingPharmacy.phone && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</label>
                    <div className="flex items-center gap-2">
                      
                      <p className="text-sm text-slate-900 font-medium">{viewingPharmacy.phone}</p>
                    </div>
                  </div>
                )}

                {viewingPharmacy.distributorId && (
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Linked Distributor</label>
                    <div className="flex items-center gap-2">
                      
                      <p className="text-sm text-slate-900">
                        {distributors.find(d => d._id === viewingPharmacy.distributorId)?.name || `Distributor ${viewingPharmacy.distributorId.slice(-8)}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <motion.button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingPharmacy(null);
                    openEditModal(viewingPharmacy);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <EditIcon className="w-4 h-4" />
                  <span>Edit Pharmacy</span>
                </motion.button>
                <motion.button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingPharmacy(null);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2.5 bg-white text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-all"
                >
                  Close
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Pharmacy Modal */}
      {showEditModal && editingPharmacy && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto z-[110]"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Edit Pharmacy</h2>
            <form onSubmit={updatePharmacy} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Pharmacy Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={pharmacyForm.name}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={pharmacyForm.address}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, address: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={pharmacyForm.phone}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Distributor {editingPharmacy && editingPharmacy.distributorId && (
                    <span className="text-xs font-normal text-slate-500">
                      (Current: {distributors.find(d => d._id === editingPharmacy.distributorId)?.name || editingPharmacy.distributorId.slice(-8)})
                    </span>
                  )}
                </label>
                <select
                  value={pharmacyForm.distributorId}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, distributorId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                >
                  <option value="">Select a distributor (optional)</option>
                  {distributors.map((distributor) => (
                    <option key={distributor._id} value={distributor._id}>
                      {distributor.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Link this pharmacy to a distributor. This will show in the distributor portal.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Update Login Credentials</h3>
                <p className="text-xs text-slate-600 mb-4">You can update email and/or password. Leave fields empty to keep existing values.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email (Login ID)
                    </label>
                    <input
                      type="email"
                      autoComplete="new-password"
                      value={pharmacyForm.email}
                      onChange={(e) => setPharmacyForm({ ...pharmacyForm, email: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                      placeholder="pharmacy@example.com"
                    />
                    <p className="text-xs text-slate-500 mt-1">Enter new email to update login ID. Leave empty to keep existing email.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={pharmacyForm.password || ""}
                        onChange={(e) => setPharmacyForm({ ...pharmacyForm, password: e.target.value })}
                        className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                        placeholder="Enter new password (leave empty to keep existing)"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none z-10"
                        tabIndex={-1}
                      >
                        {showEditPassword ? (
                          <EyeOffIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Minimum 6 characters. Leave empty to keep existing password.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 medical-btn-primary"
                >
                  Update Pharmacy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPharmacy(null);
                    setPharmacyForm({ name: "", address: "", phone: "", email: "", password: "", distributorId: "" });
                    setShowEditPassword(false);
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

