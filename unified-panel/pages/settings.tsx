import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { SettingsIcon, ShieldCheckIcon, EmailIcon, PlusIcon, DeleteIcon, CheckIcon, CloseIcon, PatientIcon as UserIcon, ClockIcon, GlobeIcon, LockIcon, BellIcon, PaletteIcon, ServerIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"user-access" | "general" | "security" | "notifications" | "appearance" | "system">("user-access");
  
  const [settings, setSettings] = useState({
    // General Settings
    timezone: "Asia/Kolkata",
    language: "en",
    dateFormat: "DD/MM/YYYY",
    
    // Security Settings
    sessionTimeout: 30,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireNumbers: true,
    
    // Notification Settings
    emailNotifications: true,
    orderAlerts: true,
    inventoryAlerts: true,
    appointmentAlerts: true,
    
    // Appearance Settings
    theme: "light",
    primaryColor: "#1e40af",
    secondaryColor: "#059669",
    sidebarCollapsed: false,
    
    // System Settings
    autoBackup: true,
    backupFrequency: "daily",
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

  // Fetch settings from MongoDB
  useEffect(() => {
    if (!token) return;
    
    const fetchSettings = async () => {
      try {
        setLoading(true);
        console.log("Fetching settings from:", `${API_BASE}/api/settings`);
        const headers = { Authorization: `Bearer ${token}` };
        const res = await fetch(`${API_BASE}/api/settings`, { headers });
        
        console.log("Settings fetch response status:", res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log("Settings data received:", data);
          if (data && typeof data === 'object') {
            setSettings((prev) => ({
              timezone: data.timezone ?? prev.timezone,
              language: data.language ?? prev.language,
              dateFormat: data.dateFormat ?? prev.dateFormat,
              sessionTimeout: typeof data.sessionTimeout === 'number' ? data.sessionTimeout : prev.sessionTimeout,
              passwordMinLength: typeof data.passwordMinLength === 'number' ? data.passwordMinLength : prev.passwordMinLength,
              passwordRequireUppercase: typeof data.passwordRequireUppercase === 'boolean' ? data.passwordRequireUppercase : prev.passwordRequireUppercase,
              passwordRequireNumbers: typeof data.passwordRequireNumbers === 'boolean' ? data.passwordRequireNumbers : prev.passwordRequireNumbers,
              emailNotifications: typeof data.emailNotifications === 'boolean' ? data.emailNotifications : prev.emailNotifications,
              orderAlerts: typeof data.orderAlerts === 'boolean' ? data.orderAlerts : prev.orderAlerts,
              inventoryAlerts: typeof data.inventoryAlerts === 'boolean' ? data.inventoryAlerts : prev.inventoryAlerts,
              appointmentAlerts: typeof data.appointmentAlerts === 'boolean' ? data.appointmentAlerts : prev.appointmentAlerts,
              theme: data.theme ?? prev.theme,
              primaryColor: data.primaryColor ?? prev.primaryColor,
              secondaryColor: data.secondaryColor ?? prev.secondaryColor,
              sidebarCollapsed: typeof data.sidebarCollapsed === 'boolean' ? data.sidebarCollapsed : prev.sidebarCollapsed,
              autoBackup: typeof data.autoBackup === 'boolean' ? data.autoBackup : prev.autoBackup,
              backupFrequency: data.backupFrequency ?? prev.backupFrequency,
            }));
          }
        } else {
          const error = await res.json().catch(() => ({ message: "Failed to fetch settings" }));
          console.error("Failed to fetch settings:", res.status, error);
          toast.error(`Failed to load settings: ${error.message || "Unknown error"}`);
        }
      } catch (e: any) {
        console.error("Error fetching settings:", e);
        toast.error(`Error loading settings: ${e.message || "Network error"}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [token]);

  const handleSave = async () => {
    if (!token) {
      toast.error("Authentication required");
      return;
    }
    
    setLoading(true);
    try {
      console.log("Saving settings:", settings);
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify(settings),
      });
      
      console.log("Save response status:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log("Settings saved, response:", data);
        if (data && typeof data === 'object') {
          setSettings({
            timezone: data.timezone ?? "Asia/Kolkata",
            language: data.language ?? "en",
            dateFormat: data.dateFormat ?? "DD/MM/YYYY",
            sessionTimeout: typeof data.sessionTimeout === 'number' ? data.sessionTimeout : 30,
            passwordMinLength: typeof data.passwordMinLength === 'number' ? data.passwordMinLength : 8,
            passwordRequireUppercase: typeof data.passwordRequireUppercase === 'boolean' ? data.passwordRequireUppercase : true,
            passwordRequireNumbers: typeof data.passwordRequireNumbers === 'boolean' ? data.passwordRequireNumbers : true,
            emailNotifications: typeof data.emailNotifications === 'boolean' ? data.emailNotifications : true,
            orderAlerts: typeof data.orderAlerts === 'boolean' ? data.orderAlerts : true,
            inventoryAlerts: typeof data.inventoryAlerts === 'boolean' ? data.inventoryAlerts : true,
            appointmentAlerts: typeof data.appointmentAlerts === 'boolean' ? data.appointmentAlerts : true,
            theme: data.theme ?? "light",
            primaryColor: data.primaryColor ?? "#1e40af",
            secondaryColor: data.secondaryColor ?? "#059669",
            sidebarCollapsed: typeof data.sidebarCollapsed === 'boolean' ? data.sidebarCollapsed : false,
            autoBackup: typeof data.autoBackup === 'boolean' ? data.autoBackup : true,
            backupFrequency: data.backupFrequency ?? "daily",
          });
        }
        toast.success("Settings saved successfully!");
      } else {
        const errorText = await res.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText || "Failed to save settings" };
        }
        console.error("Save settings error:", res.status, error);
        toast.error(error.message || `Failed to save settings (${res.status})`);
      }
    } catch (e: any) {
      console.error("Error saving settings:", e);
      toast.error(`Failed to save settings: ${e.message || "Network error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all settings to default?")) return;
    if (!token) {
      toast.error("Authentication required");
      return;
    }
    
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/settings/reset`, {
        method: "POST",
        headers,
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setSettings({
            timezone: data.timezone ?? "Asia/Kolkata",
            language: data.language ?? "en",
            dateFormat: data.dateFormat ?? "DD/MM/YYYY",
            sessionTimeout: typeof data.sessionTimeout === 'number' ? data.sessionTimeout : 30,
            passwordMinLength: typeof data.passwordMinLength === 'number' ? data.passwordMinLength : 8,
            passwordRequireUppercase: typeof data.passwordRequireUppercase === 'boolean' ? data.passwordRequireUppercase : true,
            passwordRequireNumbers: typeof data.passwordRequireNumbers === 'boolean' ? data.passwordRequireNumbers : true,
            emailNotifications: typeof data.emailNotifications === 'boolean' ? data.emailNotifications : true,
            orderAlerts: typeof data.orderAlerts === 'boolean' ? data.orderAlerts : true,
            inventoryAlerts: typeof data.inventoryAlerts === 'boolean' ? data.inventoryAlerts : true,
            appointmentAlerts: typeof data.appointmentAlerts === 'boolean' ? data.appointmentAlerts : true,
            theme: data.theme ?? "light",
            primaryColor: data.primaryColor ?? "#1e40af",
            secondaryColor: data.secondaryColor ?? "#059669",
            sidebarCollapsed: typeof data.sidebarCollapsed === 'boolean' ? data.sidebarCollapsed : false,
            autoBackup: typeof data.autoBackup === 'boolean' ? data.autoBackup : true,
            backupFrequency: data.backupFrequency ?? "daily",
          });
        }
        toast.success("Settings reset to default");
      } else {
        const error = await res.json().catch(() => ({ message: "Failed to reset settings" }));
        toast.error(error.message || "Failed to reset settings");
        console.error("Reset settings error:", error);
      }
    } catch (e: any) {
      console.error("Error resetting settings:", e);
      toast.error("Failed to reset settings");
    } finally {
      setLoading(false);
    }
  };

  // User Access State
  const [admins, setAdmins] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [accessTab, setAccessTab] = useState<"admins" | "requests">("admins");
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
      const newRequest = {
        email: accessRequest.email,
        name: accessRequest.name,
        requestedRole: accessRequest.requestedRole,
        message: accessRequest.message,
        status: "PENDING",
        requestedAt: new Date().toISOString(),
        _id: Date.now().toString(),
      };

      const existing = JSON.parse(localStorage.getItem("accessRequests") || "[]");
      existing.push(newRequest);
      localStorage.setItem("accessRequests", JSON.stringify(existing));
      
      console.log("Sending access request email to:", accessRequest.email);

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

  const handleApproveRequest = async (request: any) => {
    if (!token) return;
    setLoading(true);
    try {
      const existing = JSON.parse(localStorage.getItem("accessRequests") || "[]");
      const updated = existing.map((r: any) => 
        r._id === request._id 
          ? { ...r, status: "APPROVED", approvedAt: new Date().toISOString() }
          : r
      );
      localStorage.setItem("accessRequests", JSON.stringify(updated));
      
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
          password: Math.random().toString(36).slice(-8),
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

  const handleRejectRequest = async (request: any) => {
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

  const tabs = [
    { id: "user-access", label: "User Access", icon: ShieldCheckIcon },
    { id: "general", label: "General", icon: GlobeIcon },
    { id: "security", label: "Security", icon: LockIcon },
    { id: "notifications", label: "Notifications", icon: BellIcon },
    { id: "appearance", label: "Appearance", icon: PaletteIcon },
    { id: "system", label: "System", icon: ServerIcon },
  ];

  return (
    <Layout user={user} currentPage="settings">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
            Settings
          </h2>
          <p className="text-sm text-gray-600">
            Manage your admin panel configuration and preferences
          </p>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <AnimatedCard delay={0.1} className="lg:col-span-1">
          <div className="space-y-2">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                }`}
              >
                {typeof tab.icon === 'function' ? (
                  <tab.icon className="w-5 h-5" />
                ) : (
                  <span className="text-lg">{tab.icon}</span>
                )}
                <span>{tab.label}</span>
              </motion.button>
            ))}
          </div>
        </AnimatedCard>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <AnimatedCard delay={0.2}>
            {/* User Access Tab */}
            {activeTab === "user-access" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">User Access Management</h3>
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
                    {accessTab === "admins" && (
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

                {/* Access Tabs */}
                <div className="flex gap-3 mb-4">
                  <motion.button
                    onClick={() => setAccessTab("admins")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                      accessTab === "admins"
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
                    onClick={() => setAccessTab("requests")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                      accessTab === "requests"
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

                {/* Admin Records */}
                {accessTab === "admins" && (
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
                )}

                {/* Access Requests */}
                {accessTab === "requests" && (
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
                )}
              </div>
            )}

            {/* General Settings */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">General Settings</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                      value={settings.language}
                      onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="es">Spanish</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                    value={settings.dateFormat}
                    onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Security Settings</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Session Timeout (minutes)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: Number(e.target.value) })}
                    min="5"
                    max="120"
                  />
                  <p className="text-xs text-gray-500 mt-1">User session will expire after this many minutes of inactivity</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Password Length</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                    value={settings.passwordMinLength}
                    onChange={(e) => setSettings({ ...settings, passwordMinLength: Number(e.target.value) })}
                    min="6"
                    max="20"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum number of characters required for passwords</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 rounded-lg">
                    <div>
                      <span className="block text-sm font-medium text-gray-900">Require Uppercase Letters</span>
                      <p className="text-xs text-gray-600">Passwords must contain at least one uppercase letter</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.passwordRequireUppercase}
                        onChange={(e) => setSettings({ ...settings, passwordRequireUppercase: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-900"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 rounded-lg">
                    <div>
                      <span className="block text-sm font-medium text-gray-900">Require Numbers</span>
                      <p className="text-xs text-gray-600">Passwords must contain at least one number</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.passwordRequireNumbers}
                        onChange={(e) => setSettings({ ...settings, passwordRequireNumbers: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-900"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Notification Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <span className="block text-sm font-medium text-gray-900">Email Notifications</span>
                      <p className="text-xs text-gray-600">Receive notifications via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.emailNotifications}
                        onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-900"></div>
                    </label>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Alert Types</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div>
                          <span className="block text-sm font-medium text-gray-900">Order Alerts</span>
                          <p className="text-xs text-gray-600">Get notified about new orders and order status changes</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.orderAlerts}
                            onChange={(e) => setSettings({ ...settings, orderAlerts: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-900"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                        <div>
                          <span className="block text-sm font-medium text-gray-900">Inventory Alerts</span>
                          <p className="text-xs text-gray-600">Get notified about low stock and inventory updates</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.inventoryAlerts}
                            onChange={(e) => setSettings({ ...settings, inventoryAlerts: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div>
                          <span className="block text-sm font-medium text-gray-900">Appointment Alerts</span>
                          <p className="text-xs text-gray-600">Get notified about new appointments and cancellations</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.appointmentAlerts}
                            onChange={(e) => setSettings({ ...settings, appointmentAlerts: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Settings */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Appearance Settings</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                    value={settings.theme}
                    onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Choose your preferred color theme</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                        value={settings.primaryColor}
                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                      />
                      <input
                        type="text"
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                        value={settings.primaryColor}
                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                        placeholder="#1e40af"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Main color used throughout the interface</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                        value={settings.secondaryColor}
                        onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                      />
                      <input
                        type="text"
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        value={settings.secondaryColor}
                        onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                        placeholder="#059669"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Secondary accent color</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <span className="block text-sm font-medium text-gray-900">Collapse Sidebar by Default</span>
                    <p className="text-xs text-gray-600">Start with sidebar collapsed on page load</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.sidebarCollapsed}
                      onChange={(e) => setSettings({ ...settings, sidebarCollapsed: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-900"></div>
                  </label>
                </div>
              </div>
            )}

            {/* System Settings */}
            {activeTab === "system" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">System Settings</h3>
                
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <span className="block text-sm font-medium text-gray-900">Auto Backup</span>
                    <p className="text-xs text-gray-600">Automatically backup system data</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.autoBackup}
                      onChange={(e) => setSettings({ ...settings, autoBackup: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Backup Frequency</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                    value={settings.backupFrequency}
                    onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value })}
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">How often system backups should be performed</p>
                </div>
              </div>
            )}

            {/* Action Buttons - Only show for non-user-access tabs */}
            {activeTab !== "user-access" && (
              <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
                <motion.button
                  onClick={handleSave}
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-6 py-3 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Save Settings"}
                </motion.button>
                <motion.button
                  onClick={handleReset}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm transition-all"
                >
                  Reset
                </motion.button>
              </div>
            )}
          </AnimatedCard>
        </div>
      </div>

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

