import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function UsersPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [editingUser, setEditingUser] = useState<any>(null);
  const [filterRole, setFilterRole] = useState<"DOCTOR" | "HOSPITAL_ADMIN" | "PATIENT">("DOCTOR");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "DOCTOR",
    hospitalId: "",
    pharmacyId: "",
  });

  // Blur any focused elements when modals open (fixes aria-hidden accessibility issue)
  useEffect(() => {
    if (showAddModal || showEditModal) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
    }
  }, [showAddModal, showEditModal]);

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
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [uRes, hRes, pRes] = await Promise.all([
          fetch(`${API_BASE}/api/users`, { headers }),
          fetch(`${API_BASE}/api/master/hospitals`, { headers }),
          fetch(`${API_BASE}/api/master/pharmacies`, { headers }),
        ]);
        setUsers(uRes.ok ? await uRes.json() : []);
        setHospitals(hRes.ok ? await hRes.json() : []);
        setPharmacies(pRes.ok ? await pRes.json() : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      if (editingUser) {
        // Validate that editingUser has a valid _id
        if (!editingUser._id || editingUser._id === "undefined") {
          toast.error("Invalid user ID. Please refresh and try again.");
          return;
        }

        // Update existing user
        const payload: any = {
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        };
        if (newUser.password) {
          payload.password = newUser.password;
        }
        if (newUser.role === "DOCTOR" && newUser.hospitalId) {
          payload.hospitalId = newUser.hospitalId;
        }
        if (newUser.role === "PHARMACY_STAFF" && newUser.pharmacyId) {
          payload.pharmacyId = newUser.pharmacyId;
        }

        const res = await fetch(`${API_BASE}/api/users/${editingUser._id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          // Refresh the users list to get the latest data
          const headers = { Authorization: `Bearer ${token}` };
          const uRes = await fetch(`${API_BASE}/api/users`, { headers });
          if (uRes.ok) {
            setUsers(await uRes.json());
          } else {
            // Fallback: update local state
            setUsers((prev) => prev.map((u) => (u._id === editingUser._id ? updated : u)));
          }
          setNewUser({ name: "", email: "", password: "", role: "DOCTOR", hospitalId: "", pharmacyId: "" });
          setEditingUser(null);
          setShowAddModal(false);
          setShowEditModal(false);
          toast.success("User updated successfully!");
        } else {
          const data = await res.json().catch(() => ({ message: "Failed to update user" }));
          toast.error(data.message || "Failed to update user");
        }
      } else {
        // Create new user
        const payload: any = {
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
        };
        if (newUser.role === "DOCTOR" && newUser.hospitalId) {
          payload.hospitalId = newUser.hospitalId;
        }
        if (newUser.role === "PHARMACY_STAFF" && newUser.pharmacyId) {
          payload.pharmacyId = newUser.pharmacyId;
        }

        const res = await fetch(`${API_BASE}/api/users/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          // Refresh the users list to get the latest data
          const headers = { Authorization: `Bearer ${token}` };
          const uRes = await fetch(`${API_BASE}/api/users`, { headers });
          if (uRes.ok) {
            setUsers(await uRes.json());
          } else {
            // Fallback: add to local state
            setUsers((prev) => [created, ...prev]);
          }
          setNewUser({ name: "", email: "", password: "", role: "DOCTOR", hospitalId: "", pharmacyId: "" });
          setShowAddModal(false);
          toast.success("User created successfully!");
        } else {
          const data = await res.json().catch(() => ({ message: "Failed to create user" }));
          toast.error(data.message || "Failed to create user");
        }
      }
    } catch (e) {
      toast.error(`Error ${editingUser ? "updating" : "creating"} user`);
    }
  };

  const editUser = (user: any) => {
    // Ensure user has a valid _id
    if (!user || !user._id || user._id === "undefined") {
      toast.error("Invalid user data. Please refresh and try again.");
      return;
    }
    setEditingUser(user);
    setNewUser({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "DOCTOR",
      hospitalId: user.hospitalId || "",
      pharmacyId: user.pharmacyId || "",
    });
    setShowEditModal(true);
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPassword((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const deleteUser = async (id: string) => {
    if (!token) return;
    if (!id || id === "undefined") {
      toast.error("Invalid user ID");
      return;
    }
    
    // Confirm deletion
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("User deleted successfully!");
        // Refresh the users list
        const headers = { Authorization: `Bearer ${token}` };
        const uRes = await fetch(`${API_BASE}/api/users`, { headers });
        if (uRes.ok) {
          setUsers(await uRes.json());
        } else {
          // Fallback: remove from local state
          setUsers((prev) => prev.filter((u) => u._id !== id));
        }
      } else {
        const errorData = await res.json().catch(() => ({ message: "Failed to delete user" }));
        toast.error(errorData.message || "Failed to delete user");
        console.error("Delete error:", errorData);
      }
    } catch (e: any) {
      toast.error(`Error deleting user: ${e.message || "Unknown error"}`);
      console.error("Delete exception:", e);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "HOSPITAL_ADMIN":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "DOCTOR":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "PHARMACY_STAFF":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "DISTRIBUTOR":
        return "bg-pink-500/20 text-pink-300 border-pink-500/30";
      case "PATIENT":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="users">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
              User & Role Management
            </h2>
            <p className="text-xs sm:text-sm text-indigo-300/70">
              Add, assign, and manage users across the ecosystem with role-based access control.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditingUser(null);
              setNewUser({ name: "", email: "", password: "", role: "DOCTOR", hospitalId: "", pharmacyId: "" });
              setShowAddModal(true);
            }}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/50 transition-all"
          >
            + Add User
          </motion.button>
        </div>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <>
          {/* Filter Buttons */}
          <div className="mb-6 flex gap-2 sm:gap-3 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterRole("DOCTOR")}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                filterRole === "DOCTOR"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50"
                  : "bg-slate-800 text-indigo-300 hover:bg-slate-700 border border-indigo-900/30"
              }`}
            >
              👨‍⚕️ Doctors
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterRole("HOSPITAL_ADMIN")}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                filterRole === "HOSPITAL_ADMIN"
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/50"
                  : "bg-slate-800 text-indigo-300 hover:bg-slate-700 border border-indigo-900/30"
              }`}
            >
              🏥 Receptionists
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterRole("PATIENT")}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                filterRole === "PATIENT"
                  ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/50"
                  : "bg-slate-800 text-indigo-300 hover:bg-slate-700 border border-indigo-900/30"
              }`}
            >
              👤 Patients
            </motion.button>
          </div>

          {/* Users Grid - 4 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {users
              .filter((u) => u.role === filterRole)
              .map((u, idx) => (
              <motion.div
                key={u._id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.02, y: -4 }}
                onClick={() => u.role !== "SUPER_ADMIN" && editUser(u)}
                className={`border-2 border-indigo-900/50 rounded-xl p-5 bg-slate-900/90 backdrop-blur-sm hover:border-emerald-500/60 hover:bg-slate-800/90 transition-all cursor-pointer shadow-lg ${
                  u.role === "SUPER_ADMIN" ? "cursor-default" : ""
                }`}
              >
                <div className="flex flex-col h-full">
                  {/* User Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-white mb-2">{u.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium border ${getRoleColor(u.role)}`}>
                          {u.role.replace(/_/g, " ")}
                        </span>
                        {u.isActive === false && (
                          <span className="text-xs px-2 py-1 rounded-lg font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* User Details */}
                  <div className="flex-1 space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-sm text-indigo-200">
                      <span>📧</span>
                      <span className="truncate font-medium">{u.email}</span>
                    </div>
                    {u.phone && (
                      <div className="flex items-center gap-2 text-sm text-indigo-200">
                        <span>📞</span>
                        <span className="font-medium">{u.phone}</span>
                      </div>
                    )}
                    {u.hospitalId && (
                      <div className="flex items-center gap-2 text-sm text-indigo-300/80">
                        <span>🏥</span>
                        <span className="truncate font-medium">
                          {hospitals.find((h) => h._id === u.hospitalId)?.name || u.hospitalId.slice(-8)}
                        </span>
                      </div>
                    )}
                    {u.pharmacyId && (
                      <div className="flex items-center gap-2 text-sm text-indigo-300/80">
                        <span>💊</span>
                        <span className="truncate font-medium">
                          {pharmacies.find((p) => p._id === u.pharmacyId)?.name || u.pharmacyId.slice(-8)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {u.role !== "SUPER_ADMIN" && (
                    <div className="flex gap-2 pt-3 border-t border-indigo-800/50">
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePasswordVisibility(u._id);
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-medium hover:bg-purple-500/30 transition-all flex items-center justify-center gap-1"
                        title="Show/Hide Password"
                      >
                        {showPassword[u._id] ? "🙈" : "👁️"}
                      </motion.button>
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          editUser(u);
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-medium hover:bg-blue-500/30 transition-all"
                      >
                        Edit
                      </motion.button>
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteUser(u._id);
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="px-2 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition-all"
                      >
                        🗑️
                      </motion.button>
                    </div>
                  )}

                  {/* Password Display (when eye is clicked) */}
                  {showPassword[u._id] && u.role !== "SUPER_ADMIN" && (
                    <div className="mt-2 p-2 bg-slate-900/50 rounded-lg border border-indigo-800/30">
                      <p className="text-xs text-indigo-300 font-mono">
                        Password: <span className="text-emerald-300">(Encrypted - Cannot display)</span>
                      </p>
                      <p className="text-xs text-indigo-400/60 mt-1">
                        Use "Edit" to change password
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
              ))}
          </div>
          {users.filter((u) => u.role === filterRole).length === 0 && (
            <div className="text-center py-12">
              <p className="text-lg text-indigo-300 font-medium">
                No {filterRole === "DOCTOR" ? "Doctors" : filterRole === "HOSPITAL_ADMIN" ? "Receptionists" : "Patients"} found
              </p>
            </div>
          )}
        </>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 rounded-2xl border border-indigo-900/50 p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="add-user-title" className="text-xl font-bold text-emerald-300">Add New User</h3>
              <motion.button
                onClick={() => {
                  setShowAddModal(false);
                  setNewUser({ name: "", email: "", password: "", role: "DOCTOR", hospitalId: "", pharmacyId: "" });
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </motion.button>
            </div>
            <form onSubmit={createUser} className="space-y-4">
              <input
                placeholder="Full Name"
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newUser.name}
                onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newUser.email}
                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
              <div className="relative">
                <input
                  type={showPassword["new"] ? "text" : "password"}
                  placeholder="Password"
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 pr-10 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newUser.password}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility("new")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword["new"] ? "🙈" : "👁️"}
                </button>
              </div>
              <select
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newUser.role}
                onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
                required
              >
                <option value="DOCTOR">Doctor</option>
                <option value="HOSPITAL_ADMIN">Receptionist / Hospital Admin</option>
                <option value="PHARMACY_STAFF">Pharmacy Staff</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="PATIENT">Patient</option>
              </select>
              {newUser.role === "DOCTOR" && (
                <select
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newUser.hospitalId}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, hospitalId: e.target.value }))}
                  required
                >
                  <option value="">Select Hospital</option>
                  {hospitals.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              )}
              {newUser.role === "PHARMACY_STAFF" && (
                <select
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newUser.pharmacyId}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, pharmacyId: e.target.value }))}
                  required
                >
                  <option value="">Select Pharmacy</option>
                  {pharmacies.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 text-sm transition-all"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold py-2.5 text-sm shadow-lg shadow-emerald-500/50 transition-all"
                >
                  Create User
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 rounded-2xl border border-indigo-900/50 p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="edit-user-title" className="text-xl font-bold text-emerald-300">Edit User</h3>
              <motion.button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                  setNewUser({ name: "", email: "", password: "", role: "DOCTOR", hospitalId: "", pharmacyId: "" });
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </motion.button>
            </div>
            <form onSubmit={createUser} className="space-y-4">
              <input
                placeholder="Full Name"
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newUser.name}
                onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newUser.email}
                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
              <div className="relative">
                <input
                  type={showPassword["edit"] ? "text" : "password"}
                  placeholder="Password (leave blank to keep current)"
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 pr-10 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newUser.password}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility("edit")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword["edit"] ? "🙈" : "👁️"}
                </button>
              </div>
              <select
                className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={newUser.role}
                onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
                required
              >
                <option value="DOCTOR">Doctor</option>
                <option value="HOSPITAL_ADMIN">Receptionist / Hospital Admin</option>
                <option value="PHARMACY_STAFF">Pharmacy Staff</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="PATIENT">Patient</option>
              </select>
              {newUser.role === "DOCTOR" && (
                <select
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newUser.hospitalId}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, hospitalId: e.target.value }))}
                  required
                >
                  <option value="">Select Hospital</option>
                  {hospitals.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              )}
              {newUser.role === "PHARMACY_STAFF" && (
                <select
                  className="w-full rounded-xl bg-slate-950/50 border border-indigo-800/50 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  value={newUser.pharmacyId}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, pharmacyId: e.target.value }))}
                  required
                >
                  <option value="">Select Pharmacy</option>
                  {pharmacies.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setNewUser({ name: "", email: "", password: "", role: "DOCTOR", hospitalId: "", pharmacyId: "" });
                  }}
                  className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 text-sm transition-all"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold py-2.5 text-sm shadow-lg shadow-emerald-500/50 transition-all"
                >
                  Update User
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}

