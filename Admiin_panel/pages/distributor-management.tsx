import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import { DistributorIcon, PlusIcon, EditIcon, DeleteIcon, EyeIcon, EyeOffIcon } from "../components/Icons";
import { useUserStatus } from "../hooks/useUserStatus";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function DistributorManagementPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Distributor Management State
  const [distributors, setDistributors] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingDistributor, setEditingDistributor] = useState<any>(null);
  const [viewingDistributor, setViewingDistributor] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  
  // Form states
  const [distributorForm, setDistributorForm] = useState({ 
    name: "", 
    address: "", 
    phone: "",
    email: "",
    password: ""
  });
  
  const [loading, setLoading] = useState(true);

  // Get distributor user IDs for status tracking
  const [distributorUserMap, setDistributorUserMap] = useState<Map<string, string>>(new Map());
  
  useEffect(() => {
    // Fetch distributor user IDs
    const fetchDistributorUserIds = async () => {
      if (!token || distributors.length === 0) return;
      try {
        const map = new Map<string, string>();
        for (const distributor of distributors) {
          const userRes = await fetch(`${API_BASE}/api/users?distributorId=${distributor._id}&role=DISTRIBUTOR`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            const users = await userRes.json();
            const userList = Array.isArray(users) ? users : (users.users || []);
            if (userList.length > 0) {
              const userId = userList[0]._id || userList[0].id;
              map.set(distributor._id, userId);
            }
          }
        }
        setDistributorUserMap(map);
      } catch (e) {
        console.error("Failed to fetch distributor user IDs:", e);
      }
    };
    fetchDistributorUserIds();
  }, [distributors, token]);

  const distributorUserIds = Array.from(distributorUserMap.values());
  const { getStatus } = useUserStatus(distributorUserIds);

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
    fetchDistributors();
  }, [token]);

  const fetchDistributors = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/master/distributors`, { headers });
      setDistributors(res.ok ? await res.json() : []);
    } catch (e) {
      toast.error("Failed to fetch distributors");
    } finally {
      setLoading(false);
    }
  };

  const createDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      // First create the distributor
      const distributorRes = await fetch(`${API_BASE}/api/master/distributors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: distributorForm.name,
          address: distributorForm.address,
          phone: distributorForm.phone,
        }),
      });
      
      if (!distributorRes.ok) {
        const error = await distributorRes.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create distributor");
      }

      const createdDistributor = await distributorRes.json();

      // Then create login credentials if email and password are provided
      if (distributorForm.email && distributorForm.password) {
        const userRes = await fetch(`${API_BASE}/api/users/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: distributorForm.name,
            email: distributorForm.email,
            password: distributorForm.password,
            role: "DISTRIBUTOR",
            distributorId: createdDistributor._id,
          }),
        });

        if (!userRes.ok) {
          const error = await userRes.json().catch(() => ({}));
          // Distributor was created but user creation failed - still show distributor
          toast.error(error.message || "Distributor created but failed to create login credentials");
        } else {
          toast.success("Distributor and login credentials created successfully!");
        }
      } else {
        toast.success("Distributor created successfully! You can create login credentials later.");
      }

      setDistributors((prev) => [createdDistributor, ...prev]);
      setDistributorForm({ name: "", address: "", phone: "", email: "", password: "" });
      setShowAddModal(false);
    } catch (e: any) {
      toast.error(e.message || "Error creating distributor");
    }
  };

  const updateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingDistributor) return;
    try {
      // Update distributor details
      const distributorRes = await fetch(`${API_BASE}/api/master/distributors/${editingDistributor._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: distributorForm.name,
          address: distributorForm.address,
          phone: distributorForm.phone,
        }),
      });
      
      if (!distributorRes.ok) {
        const error = await distributorRes.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update distributor");
      }

      // Update login credentials if email and/or password are provided
      if (distributorForm.email || distributorForm.password) {
        // First, check if a user already exists for this distributor
        const existingUserRes = await fetch(`${API_BASE}/api/users?distributorId=${editingDistributor._id}&role=DISTRIBUTOR`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (existingUserRes.ok) {
          const users = await existingUserRes.json();
          const userList = Array.isArray(users) ? users : (users.users || []);
          
          if (userList.length > 0) {
            // User exists - update the existing user
            const existingUser = userList[0];
            const userId = existingUser._id || existingUser.id;
            const currentEmail = (existingUser.email || "").toLowerCase().trim();
            const newEmail = distributorForm.email ? distributorForm.email.trim() : "";
            
            const updatePayload: any = {
              name: distributorForm.name,
            };
            
            // Update email if provided and different from current (case-insensitive comparison)
            // Note: Backend will check if email is already in use by another user
            if (newEmail !== "" && newEmail.toLowerCase() !== currentEmail) {
              updatePayload.email = newEmail;
            }
            
            // Only update password if provided
            if (distributorForm.password && distributorForm.password.trim() !== "") {
              updatePayload.password = distributorForm.password.trim();
            }

            // Only make the API call if there's something to update
            if (updatePayload.email || updatePayload.password) {
              const userRes = await fetch(`${API_BASE}/api/users/${userId}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updatePayload),
              });

              if (!userRes.ok) {
                const error = await userRes.json().catch(() => ({}));
                const errorMessage = error.message || "Unknown error";
                
                // Provide more helpful error message
                if (errorMessage.includes("already in use") || errorMessage.includes("duplicate")) {
                  toast.error(`Cannot update email: "${newEmail}" is already in use by another user. Please use a different email address.`, {
                    duration: 5000,
                  });
                } else {
                  toast.error("Distributor updated but failed to update login credentials: " + errorMessage);
                }
              } else {
                const successMessage = updatePayload.email && updatePayload.password
                  ? "Distributor, email, and password updated successfully!"
                  : updatePayload.email
                  ? "Distributor and email updated successfully!"
                  : "Distributor and password updated successfully!";
                toast.success(successMessage);
              }
            } else {
              // No changes to email or password
              if (newEmail === currentEmail && newEmail !== "") {
                toast.success("Distributor updated successfully! (Email unchanged)");
              } else {
                toast.success("Distributor updated successfully!");
              }
            }
          } else {
            // User doesn't exist - create a new user (requires both email and password)
            if (!distributorForm.email || !distributorForm.password) {
              toast.error("Email and password are required to create login credentials");
            } else {
              const userRes = await fetch(`${API_BASE}/api/users/signup`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  name: distributorForm.name,
                  email: distributorForm.email.trim(),
                  password: distributorForm.password.trim(),
                  role: "DISTRIBUTOR",
                  distributorId: editingDistributor._id,
                }),
              });

              if (!userRes.ok) {
                const error = await userRes.json().catch(() => ({}));
                toast.error("Distributor updated but failed to create login credentials: " + (error.message || "Unknown error"));
              } else {
                toast.success("Distributor and login credentials created successfully!");
              }
            }
          }
        } else {
          toast.error("Failed to check existing user credentials");
        }
      } else {
        toast.success("Distributor updated successfully!");
      }

      const updated = await distributorRes.json();
      setDistributors((prev) => prev.map((d) => (d._id === editingDistributor._id ? updated : d)));
      setDistributorForm({ name: "", address: "", phone: "", email: "", password: "" });
      setShowEditModal(false);
      setEditingDistributor(null);
      setShowEditPassword(false);
    } catch (e: any) {
      toast.error(e.message || "Error updating distributor");
    }
  };

  const deleteDistributor = async (id: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this distributor?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/master/distributors/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDistributors((prev) => prev.filter((d) => d._id !== id));
        toast.success("Distributor deleted successfully!");
      } else {
        toast.error("Failed to delete distributor");
      }
    } catch (e) {
      toast.error("Error deleting distributor");
    }
  };

  const openEditModal = async (distributor: any) => {
    setEditingDistributor(distributor);
    
    // Fetch existing user email for this distributor BEFORE setting form
    let existingEmail = "";
    if (token) {
      try {
        const userRes = await fetch(`${API_BASE}/api/users?distributorId=${distributor._id}&role=DISTRIBUTOR`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userRes.ok) {
          const users = await userRes.json();
          // Handle both array and object responses
          const userList = Array.isArray(users) ? users : (users.users || []);
          if (userList.length > 0) {
            const distributorUser = userList[0];
            if (distributorUser && distributorUser.email) {
              existingEmail = distributorUser.email;
            }
          }
        }
      } catch (e) {
        // Silently fail - email field will just be empty
        console.log("Could not fetch distributor user email:", e);
      }
    }
    
    // Set form with all data at once (including fetched email)
    setDistributorForm({ 
      name: distributor.name || "", 
      address: distributor.address || "", 
      phone: distributor.phone || "",
      email: existingEmail,
      password: ""
    });
    setShowEditModal(true);
    setShowEditPassword(false);
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="distributor-management">
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
                Distributor Management
              </h2>
              <p className="text-sm text-slate-600">
                Manage distributors and create login credentials for distributor staff.
              </p>
            </div>
            <motion.button
              onClick={() => {
                setDistributorForm({ name: "", address: "", phone: "", email: "", password: "" });
                setShowPassword(false);
                setShowAddModal(true);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full shadow-sm transition-all flex items-center gap-2 text-sm sm:text-base"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Distributor</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Distributors Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {distributors.map((d, idx) => {
            const userId = distributorUserMap.get(d._id);
            const isOnline = userId ? getStatus(userId) : false;
            return (
              <motion.div
                key={d._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
                className="medical-card p-6"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-50 to-emerald-100 border border-emerald-100 flex items-center justify-center">
                      <DistributorIcon className="w-6 h-6 text-teal-700" />
                    </div>
                    {/* Online Status Indicator */}
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                      isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`} title={isOnline ? 'Online' : 'Offline'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-slate-900 mb-2">{d.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        isOnline 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isOnline ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs text-slate-400">#{d._id.slice(-8)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2">
                    
                    <p className="text-sm text-slate-600 flex-1">{d.address}</p>
                  </div>
                  {d.phone && (
                    <div className="flex items-center gap-2">
                      
                      <p className="text-sm text-slate-600">{d.phone}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <motion.button
                    onClick={() => {
                      setViewingDistributor(d);
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
                    onClick={() => openEditModal(d)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-3 py-2 rounded bg-cyan-50 hover:bg-blue-100 text-teal-700 border border-emerald-100 text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                  >
                    <EditIcon className="w-4 h-4" />
                    <span>Edit</span>
                  </motion.button>
                  <motion.button
                    onClick={() => deleteDistributor(d._id)}
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
          
          {distributors.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-lg bg-cyan-50 flex items-center justify-center border border-emerald-100">
                  <DistributorIcon className="w-10 h-10 text-slate-900" />
                </div>
              </div>
              <p className="text-lg text-slate-700 font-medium mb-2">No distributors found</p>
              <p className="text-sm text-slate-600">Click "Add New Distributor" to get started</p>
            </div>
          )}
        </div>
      )}

      {/* Add Distributor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto z-[110]"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Add New Distributor</h2>
            <form onSubmit={createDistributor} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Distributor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={distributorForm.name}
                  onChange={(e) => setDistributorForm({ ...distributorForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                  placeholder="Enter distributor name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={distributorForm.address}
                  onChange={(e) => setDistributorForm({ ...distributorForm, address: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                  placeholder="Enter distributor address"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={distributorForm.phone}
                  onChange={(e) => setDistributorForm({ ...distributorForm, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                  placeholder="Enter phone number"
                />
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
                      value={distributorForm.email}
                      onChange={(e) => setDistributorForm({ ...distributorForm, email: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                      placeholder="distributor@example.com"
                    />
                    <p className="text-xs text-slate-500 mt-1">This will be used to login to the distributor panel</p>
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
                        value={distributorForm.password}
                        onChange={(e) => setDistributorForm({ ...distributorForm, password: e.target.value })}
                        className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                        placeholder="Enter new password for distributor"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
                      >
                        {showPassword ? (
                          <EyeOffIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Minimum 6 characters - Create a new password for distributor access</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 medical-btn-primary"
                >
                  Create Distributor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setDistributorForm({ name: "", address: "", phone: "", email: "", password: "" });
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

      {/* View Distributor Modal */}
      {showViewModal && viewingDistributor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto z-[110]"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Distributor Details</h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingDistributor(null);
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
                  <DistributorIcon className="w-8 h-8 text-teal-700" />
                  {(() => {
                    const userId = distributorUserMap.get(viewingDistributor._id);
                    const isOnline = userId ? getStatus(userId) : false;
                    return (
                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                    );
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-slate-900">{viewingDistributor.name}</h3>
                    {(() => {
                      const userId = distributorUserMap.get(viewingDistributor._id);
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
                  <p className="text-sm text-slate-500">ID: #{viewingDistributor._id.slice(-8)}</p>
                </div>
              </div>

              {/* Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</label>
                  <div className="flex items-start gap-2">
                    
                    <p className="text-sm text-slate-900 flex-1">{viewingDistributor.address}</p>
                  </div>
                </div>

                {viewingDistributor.phone && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</label>
                    <div className="flex items-center gap-2">
                      
                      <p className="text-sm text-slate-900 font-medium">{viewingDistributor.phone}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <motion.button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingDistributor(null);
                    openEditModal(viewingDistributor);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <EditIcon className="w-4 h-4" />
                  <span>Edit Distributor</span>
                </motion.button>
                <motion.button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingDistributor(null);
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

      {/* Edit Distributor Modal */}
      {showEditModal && editingDistributor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto z-[110]"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Edit Distributor</h2>
            <form onSubmit={updateDistributor} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Distributor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={distributorForm.name}
                  onChange={(e) => setDistributorForm({ ...distributorForm, name: e.target.value })}
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
                  value={distributorForm.address}
                  onChange={(e) => setDistributorForm({ ...distributorForm, address: e.target.value })}
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
                  value={distributorForm.phone}
                  onChange={(e) => setDistributorForm({ ...distributorForm, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                />
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Login Credentials</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      autoComplete="new-password"
                      value={distributorForm.email}
                      onChange={(e) => setDistributorForm({ ...distributorForm, email: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                      placeholder="distributor@example.com"
                    />
                    <p className="text-xs text-slate-500 mt-1">Enter new email to update, or leave empty to keep existing email</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={distributorForm.password || ""}
                        onChange={(e) => setDistributorForm({ ...distributorForm, password: e.target.value })}
                        className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                        placeholder="Enter new password (leave empty to keep existing password)"
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
                    <p className="text-xs text-slate-500 mt-1">Minimum 6 characters - Leave empty to keep existing password</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 medical-btn-primary"
                >
                  Update Distributor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDistributor(null);
                    setDistributorForm({ name: "", address: "", phone: "", email: "", password: "" });
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
