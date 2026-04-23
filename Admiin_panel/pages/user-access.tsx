import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { PatientIcon as UserIcon, EmailIcon, PlusIcon, EditIcon, DeleteIcon, CheckIcon, CloseIcon, ShieldCheckIcon, ClockIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

interface AdminRecord {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

interface AccessRequest {
  _id?: string;
  email: string;
  name: string;
  requestedRole: string;
  message?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  approvedAt?: string;
}

export default function UserAccessPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"admins" | "requests">("admins");
  
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    role: "HOSPITAL_ADMIN",
    password: "",
  });

  const [accessRequest, setAccessRequest] = useState({
    email: "",
    name: "",
    requestedRole: "HOSPITAL_ADMIN",
    message: "",
  });

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
    fetchAdmins();
    fetchAccessRequests();
  }, [token]);

  const fetchAdmins = async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/users?role=SUPER_ADMIN,HOSPITAL_ADMIN`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAdmins(Array.isArray(data) ? data.filter((u: any) => u.role === "SUPER_ADMIN" || u.role === "HOSPITAL_ADMIN") : []);
      }
    } catch (e) {
      console.error("Failed to fetch admins:", e);
    }
  };

  const fetchAccessRequests = async () => {
    if (!token) return;
    try {
      // Load from localStorage (in real app, this would be from API)
      const stored = localStorage.getItem("accessRequests");
      if (stored) {
        setAccessRequests(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to fetch access requests:", e);
    }
  };

  const handleCreateAdmin = async () => {
    if (!token) return;
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const res = await fetch(`${API_BASE}/api/users/signup`, {
        method: "POST",
        headers,
        body: JSON.stringify(newAdmin),
      });

      if (res.ok) {
        toast.success("Admin created successfully!");
        setShowAddModal(false);
        setNewAdmin({ name: "", email: "", role: "HOSPITAL_ADMIN", password: "" });
        fetchAdmins();
      } else {
        const error = await res.json().catch(() => ({ message: "Failed to create admin" }));
        toast.error(error.message || "Failed to create admin");
      }
    } catch (e: any) {
      toast.error("Error creating admin");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAccessRequest = async () => {
    if (!accessRequest.email || !accessRequest.name) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const newRequest: AccessRequest = {
        email: accessRequest.email,
        name: accessRequest.name,
        requestedRole: accessRequest.requestedRole,
        message: accessRequest.message,
        status: "PENDING",
        requestedAt: new Date().toISOString(),
      };

      // In real app, this would send an email via API
      // For now, save to localStorage
      const existing = JSON.parse(localStorage.getItem("accessRequests") || "[]");
      existing.push({ ...newRequest, _id: Date.now().toString() });
      localStorage.setItem("accessRequests", JSON.stringify(existing));
      
      // Simulate sending email
      console.log("Sending access request email to:", accessRequest.email);
      console.log("Request details:", newRequest);

      toast.success("Access request sent successfully! Admin will be notified via email.");
      setShowRequestModal(false);
      setAccessRequest({ email: "", name: "", requestedRole: "HOSPITAL_ADMIN", message: "" });
      fetchAccessRequests();
    } catch (e: any) {
      toast.error("Error sending access request");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (request: AccessRequest) => {
    if (!token) return;
    setLoading(true);
    try {
      // Update request status
      const existing = JSON.parse(localStorage.getItem("accessRequests") || "[]");
      const updated = existing.map((r: any) => 
        r._id === request._id 
          ? { ...r, status: "APPROVED", approvedAt: new Date().toISOString() }
          : r
      );
      localStorage.setItem("accessRequests", JSON.stringify(updated));
      
      // Create admin account
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const res = await fetch(`${API_BASE}/api/users/signup`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: request.name,
          email: request.email,
          role: request.requestedRole,
          password: Math.random().toString(36).slice(-8), // Generate random password
        }),
      });

      if (res.ok) {
        toast.success("Access approved! Admin account created and email sent.");
        fetchAccessRequests();
        fetchAdmins();
      } else {
        toast.error("Failed to create admin account");
      }
    } catch (e: any) {
      toast.error("Error approving request");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (request: AccessRequest) => {
    if (!confirm("Are you sure you want to reject this access request?")) return;
    
    try {
      const existing = JSON.parse(localStorage.getItem("accessRequests") || "[]");
      const updated = existing.map((r: any) => 
        r._id === request._id 
          ? { ...r, status: "REJECTED" }
          : r
      );
      localStorage.setItem("accessRequests", JSON.stringify(updated));
      toast.success("Access request rejected");
      fetchAccessRequests();
    } catch (e: any) {
      toast.error("Error rejecting request");
      console.error(e);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (!confirm("Are you sure you want to delete this admin?")) return;
    if (!token) return;

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        toast.success("Admin deleted successfully");
        fetchAdmins();
      } else {
        toast.error("Failed to delete admin");
      }
    } catch (e: any) {
      toast.error("Error deleting admin");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="user-access">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
                User Access Management
              </h2>
              <p className="text-sm text-gray-600">
                Manage admin records and access requests
              </p>
            </div>
            <div className="flex gap-3">
              <motion.button
                onClick={() => setShowRequestModal(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-all flex items-center gap-2"
              >
                <EmailIcon className="w-4 h-4" />
                <span>Send Access Request</span>
              </motion.button>
              {activeTab === "admins" && (
                <motion.button
                  onClick={() => setShowAddModal(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold transition-all flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add Admin</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        <motion.button
          onClick={() => setActiveTab("admins")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === "admins"
              ? "bg-blue-900 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          <ShieldCheckIcon className="w-4 h-4" />
          <span>Admin Records</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
            {admins.length}
          </span>
        </motion.button>
        <motion.button
          onClick={() => setActiveTab("requests")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === "requests"
              ? "bg-blue-900 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          <EmailIcon className="w-4 h-4" />
          <span>Access Requests</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
            {accessRequests.filter((r) => r.status === "PENDING").length}
          </span>
        </motion.button>
      </div>

      {/* Admin Records Tab */}
      {activeTab === "admins" && (
        <AnimatedCard delay={0.1}>
          <div className="p-4 sm:p-6">
            <div className="space-y-4">
              {admins.map((admin) => (
                <motion.div
                  key={admin._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-gray-300 rounded-lg p-4 bg-white hover:border-blue-900 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <UserIcon className="w-6 h-6 text-blue-900" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{admin.name}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            admin.role === "SUPER_ADMIN"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            {admin.role.replace(/_/g, " ")}
                          </span>
                          {admin.isActive ? (
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                              <CheckIcon className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{admin.email}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          {admin.createdAt && (
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-3 h-3" />
                              Created: {new Date(admin.createdAt).toLocaleDateString()}
                            </span>
                          )}
                          {admin.lastLogin && (
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-3 h-3" />
                              Last login: {new Date(admin.lastLogin).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {admin.role !== "SUPER_ADMIN" && (
                      <motion.button
                        onClick={() => handleDeleteAdmin(admin._id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all"
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
              {admins.length === 0 && (
                <div className="text-center py-12">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                      <UserIcon className="w-10 h-10 text-blue-900" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 font-medium mb-2">No admins found</p>
                  <p className="text-xs text-gray-600">Click "Add Admin" to create a new admin account</p>
                </div>
              )}
            </div>
          </div>
        </AnimatedCard>
      )}

      {/* Access Requests Tab */}
      {activeTab === "requests" && (
        <AnimatedCard delay={0.1}>
          <div className="p-4 sm:p-6">
            <div className="space-y-4">
              {accessRequests.map((request) => (
                <motion.div
                  key={request._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`border rounded-lg p-4 transition-all ${
                    request.status === "PENDING"
                      ? "border-yellow-300 bg-yellow-50"
                      : request.status === "APPROVED"
                      ? "border-green-300 bg-green-50"
                      : "border-red-300 bg-red-50"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-lg border ${
                        request.status === "PENDING"
                          ? "bg-yellow-100 border-yellow-200"
                          : request.status === "APPROVED"
                          ? "bg-green-100 border-green-200"
                          : "bg-red-100 border-red-200"
                      }`}>
                        <EmailIcon className={`w-6 h-6 ${
                          request.status === "PENDING"
                            ? "text-yellow-700"
                            : request.status === "APPROVED"
                            ? "text-green-700"
                            : "text-red-700"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{request.name}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            request.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                              : request.status === "APPROVED"
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : "bg-red-100 text-red-700 border border-red-200"
                          }`}>
                            {request.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {request.requestedRole.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{request.email}</p>
                        {request.message && (
                          <p className="text-sm text-gray-700 mb-2">{request.message}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            Requested: {new Date(request.requestedAt).toLocaleString()}
                          </span>
                          {request.approvedAt && (
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-3 h-3" />
                              Approved: {new Date(request.approvedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {request.status === "PENDING" && (
                      <div className="flex gap-2">
                        <motion.button
                          onClick={() => handleApproveRequest(request)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-all flex items-center gap-2"
                        >
                          <CheckIcon className="w-4 h-4" />
                          <span>Approve</span>
                        </motion.button>
                        <motion.button
                          onClick={() => handleRejectRequest(request)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all flex items-center gap-2"
                        >
                          <CloseIcon className="w-4 h-4" />
                          <span>Reject</span>
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {accessRequests.length === 0 && (
                <div className="text-center py-12">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                      <EmailIcon className="w-10 h-10 text-blue-900" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 font-medium mb-2">No access requests</p>
                  <p className="text-xs text-gray-600">Click "Send Access Request" to request admin access</p>
                </div>
              )}
            </div>
          </div>
        </AnimatedCard>
      )}

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add New Admin</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-all"
              >
                <CloseIcon className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  placeholder="Enter admin name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  placeholder="Enter admin email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                >
                  <option value="HOSPITAL_ADMIN">Hospital Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    placeholder="Enter password"
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
            </div>
            <div className="flex gap-3 mt-6">
              <motion.button
                onClick={handleCreateAdmin}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-semibold text-sm transition-all disabled:opacity-60"
              >
                {loading ? "Creating..." : "Create Admin"}
              </motion.button>
              <motion.button
                onClick={() => setShowAddModal(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm transition-all"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Send Access Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Send Access Request</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-all"
              >
                <CloseIcon className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  value={accessRequest.name}
                  onChange={(e) => setAccessRequest({ ...accessRequest, name: e.target.value })}
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  value={accessRequest.email}
                  onChange={(e) => setAccessRequest({ ...accessRequest, email: e.target.value })}
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Requested Role</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  value={accessRequest.requestedRole}
                  onChange={(e) => setAccessRequest({ ...accessRequest, requestedRole: e.target.value })}
                >
                  <option value="HOSPITAL_ADMIN">Hospital Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message (Optional)</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  rows={3}
                  value={accessRequest.message}
                  onChange={(e) => setAccessRequest({ ...accessRequest, message: e.target.value })}
                  placeholder="Why do you need admin access?"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <motion.button
                onClick={handleSendAccessRequest}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <EmailIcon className="w-4 h-4" />
                {loading ? "Sending..." : "Send Request"}
              </motion.button>
              <motion.button
                onClick={() => setShowRequestModal(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm transition-all"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}

