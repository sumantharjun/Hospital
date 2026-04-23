import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { getUser, setAuth } from "@/utils/auth";
import { SettingsIcon } from "@/components/Icons";
import { userApi, pharmacyApi } from "@/services/api";
import { Pharmacy } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "general" | "pharmacy" | "notifications" | "security">("profile");
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [editing, setEditing] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
  });
  const [pharmacyForm, setPharmacyForm] = useState({
    name: "",
    address: "",
    phoneNumber: "",
    email: "",
    licenseNumber: "",
    ownerName: "",
  });
  
  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    language: "en",
    dateFormat: "DD/MM/YYYY",
    timezone: "Asia/Kolkata",
    currency: "INR",
    itemsPerPage: 20,
  });

  // Pharmacy Settings
  const [pharmacySettings, setPharmacySettings] = useState({
    lowStockThreshold: 10,
    expiryWarningDays: 30,
    autoBackup: true,
    taxRate: 18,
    discountAllowed: true,
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    lowStockAlerts: true,
    expiryAlerts: true,
    orderNotifications: true,
    invoiceNotifications: true,
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
  });

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    setUserForm({
      name: currentUser.name || "",
      email: currentUser.email || "",
    });
    // Load saved settings from localStorage or API
    loadSettings();
    loadProfileData(currentUser);
  }, [router]);

  const loadProfileData = async (currentUser: any) => {
    setLoadingProfile(true);
    try {
      // Load user profile
      const userData = await userApi.getProfile();
      setUser(userData);
      setUserForm({
        name: userData.name || "",
        email: userData.email || "",
      });

      // Load pharmacy data if pharmacyId exists
      if (currentUser.pharmacyId) {
        try {
          const pharmacyData = await pharmacyApi.getById(currentUser.pharmacyId);
          setPharmacy(pharmacyData);
          setPharmacyForm({
            name: pharmacyData.name || "",
            address: pharmacyData.address || "",
            phoneNumber: pharmacyData.phoneNumber || "",
            email: pharmacyData.email || "",
            licenseNumber: pharmacyData.licenseNumber || "",
            ownerName: pharmacyData.ownerName || "",
          });
        } catch (error) {
          console.error("Failed to load pharmacy data");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUserUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatedUser = await userApi.updateProfile(userForm);
      setUser(updatedUser);
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
      setAuth(localStorage.getItem("token") || "", updatedUser);
      toast.success("Profile updated successfully!");
      setEditing(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePharmacyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.pharmacyId) return;
    setLoading(true);

    try {
      await pharmacyApi.update(user.pharmacyId, pharmacyForm);
      toast.success("Pharmacy information updated successfully!");
      loadProfileData(user);
    } catch (error: any) {
      toast.error(error.message || "Failed to update pharmacy information");
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = () => {
    // Load from localStorage (you can replace this with API call)
    const savedGeneral = localStorage.getItem("pharma_general_settings");
    const savedPharmacy = localStorage.getItem("pharma_pharmacy_settings");
    const savedNotifications = localStorage.getItem("pharma_notification_settings");
    const savedSecurity = localStorage.getItem("pharma_security_settings");

    if (savedGeneral) setGeneralSettings(JSON.parse(savedGeneral));
    if (savedPharmacy) setPharmacySettings(JSON.parse(savedPharmacy));
    if (savedNotifications) setNotificationSettings(JSON.parse(savedNotifications));
    if (savedSecurity) setSecuritySettings(JSON.parse(savedSecurity));
  };

  const saveSettings = async (settingsType: string, settings: any) => {
    setLoading(true);
    try {
      // Save to localStorage (you can replace this with API call)
      localStorage.setItem(`pharma_${settingsType}_settings`, JSON.stringify(settings));
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success("Settings saved successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneralSave = () => {
    saveSettings("general", generalSettings);
  };

  const handlePharmacySave = () => {
    saveSettings("pharmacy", pharmacySettings);
  };

  const handleNotificationSave = () => {
    saveSettings("notification", notificationSettings);
  };

  const handleSecuritySave = () => {
    saveSettings("security", securitySettings);
  };

  if (!user) return null;

  const tabs = [
    { id: "profile" as const, name: "Profile", icon: "👤" },
    { id: "general" as const, name: "General", icon: "⚙️" },
    { id: "pharmacy" as const, name: "Pharmacy", icon: "🏥" },
    { id: "notifications" as const, name: "Notifications", icon: "🔔" },
    { id: "security" as const, name: "Security", icon: "🔒" },
  ];

  return (
    <Layout user={user} currentPage="settings">
      <div className="min-h-[calc(100vh-120px)] flex flex-col gap-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-600">Manage your pharmacy settings and preferences</p>
            </div>
          </div>
        </div>

        {/* Tabs and Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-blue-50 text-blue-900 border-l-4 border-blue-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6"
            >
              {/* Profile Settings */}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  {loadingProfile ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* User Profile */}
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-xl font-bold text-gray-900">User Profile</h2>
                          <button
                            onClick={() => setEditing(!editing)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
                          >
                            {editing ? "Cancel" : "✏️ Edit"}
                          </button>
                        </div>
                        {editing ? (
                          <form onSubmit={handleUserUpdate} className="space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                              <input
                                type="text"
                                required
                                value={userForm.name}
                                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                              <input
                                type="email"
                                required
                                value={userForm.email}
                                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading ? "Saving..." : "Save Changes"}
                            </button>
                          </form>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-200">
                              <span className="text-gray-600">Name</span>
                              <span className="font-semibold text-gray-900">{user?.name || "N/A"}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-200">
                              <span className="text-gray-600">Email</span>
                              <span className="font-semibold text-gray-900">{user?.email || "N/A"}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-200">
                              <span className="text-gray-600">Role</span>
                              <span className="font-semibold text-gray-900">{user?.role || "N/A"}</span>
                            </div>
                            {user?.pharmacyId && (
                              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                                <span className="text-gray-600">Pharmacy ID</span>
                                <span className="font-mono text-xs text-gray-900">{user.pharmacyId}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Pharmacy Information */}
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Pharmacy Information</h2>
                        {user?.pharmacyId ? (
                          <form onSubmit={handlePharmacyUpdate} className="space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Pharmacy Name
                              </label>
                              <input
                                type="text"
                                value={pharmacyForm.name}
                                onChange={(e) => setPharmacyForm({ ...pharmacyForm, name: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                              <textarea
                                value={pharmacyForm.address}
                                onChange={(e) =>
                                  setPharmacyForm({ ...pharmacyForm, address: e.target.value })
                                }
                                rows={3}
                                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                                <input
                                  type="tel"
                                  value={pharmacyForm.phoneNumber}
                                  onChange={(e) =>
                                    setPharmacyForm({ ...pharmacyForm, phoneNumber: e.target.value })
                                  }
                                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                                <input
                                  type="email"
                                  value={pharmacyForm.email}
                                  onChange={(e) =>
                                    setPharmacyForm({ ...pharmacyForm, email: e.target.value })
                                  }
                                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  License Number
                                </label>
                                <input
                                  type="text"
                                  value={pharmacyForm.licenseNumber}
                                  onChange={(e) =>
                                    setPharmacyForm({ ...pharmacyForm, licenseNumber: e.target.value })
                                  }
                                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Owner Name
                                </label>
                                <input
                                  type="text"
                                  value={pharmacyForm.ownerName}
                                  onChange={(e) =>
                                    setPharmacyForm({ ...pharmacyForm, ownerName: e.target.value })
                                  }
                                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                />
                              </div>
                            </div>
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading ? "Updating..." : "Update Pharmacy Info"}
                            </button>
                          </form>
                        ) : (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              No pharmacy ID associated with this account. Please contact administrator.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* General Settings */}
              {activeTab === "general" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">General Settings</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Language
                        </label>
                        <select
                          value={generalSettings.language}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        >
                          <option value="en">English</option>
                          <option value="hi">Hindi</option>
                          <option value="mr">Marathi</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Date Format
                        </label>
                        <select
                          value={generalSettings.dateFormat}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, dateFormat: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        >
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Timezone
                        </label>
                        <select
                          value={generalSettings.timezone}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        >
                          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">America/New_York (EST)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Currency
                        </label>
                        <select
                          value={generalSettings.currency}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        >
                          <option value="INR">₹ INR (Indian Rupee)</option>
                          <option value="USD">$ USD (US Dollar)</option>
                          <option value="EUR">€ EUR (Euro)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Items Per Page
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="100"
                          value={generalSettings.itemsPerPage}
                          onChange={(e) => setGeneralSettings({ ...generalSettings, itemsPerPage: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handleGeneralSave}
                        disabled={loading}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pharmacy Settings */}
              {activeTab === "pharmacy" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Pharmacy Settings</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Low Stock Threshold
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pharmacySettings.lowStockThreshold}
                          onChange={(e) => setPharmacySettings({ ...pharmacySettings, lowStockThreshold: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">Items below this quantity will trigger low stock alerts</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Expiry Warning Days
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={pharmacySettings.expiryWarningDays}
                          onChange={(e) => setPharmacySettings({ ...pharmacySettings, expiryWarningDays: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">Items expiring within these days will show warnings</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Default Tax Rate (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={pharmacySettings.taxRate}
                          onChange={(e) => setPharmacySettings({ ...pharmacySettings, taxRate: parseFloat(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Enable Auto Backup
                          </label>
                          <p className="text-xs text-gray-500">Automatically backup inventory data daily</p>
                        </div>
                        <button
                          onClick={() => setPharmacySettings({ ...pharmacySettings, autoBackup: !pharmacySettings.autoBackup })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            pharmacySettings.autoBackup ? "bg-blue-600" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              pharmacySettings.autoBackup ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Allow Discounts
                          </label>
                          <p className="text-xs text-gray-500">Enable discount options in billing</p>
                        </div>
                        <button
                          onClick={() => setPharmacySettings({ ...pharmacySettings, discountAllowed: !pharmacySettings.discountAllowed })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            pharmacySettings.discountAllowed ? "bg-blue-600" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              pharmacySettings.discountAllowed ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handlePharmacySave}
                        disabled={loading}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Notification Settings</h2>
                    <div className="space-y-4">
                      {[
                        { key: "emailNotifications", label: "Email Notifications", desc: "Receive notifications via email" },
                        { key: "lowStockAlerts", label: "Low Stock Alerts", desc: "Get notified when stock levels are low" },
                        { key: "expiryAlerts", label: "Expiry Alerts", desc: "Receive alerts for items nearing expiry" },
                        { key: "orderNotifications", label: "Order Notifications", desc: "Notify when new orders are received" },
                        { key: "invoiceNotifications", label: "Invoice Notifications", desc: "Get notified about invoice generation" },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                              {item.label}
                            </label>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                          </div>
                          <button
                            onClick={() => setNotificationSettings({ ...notificationSettings, [item.key]: !notificationSettings[item.key as keyof typeof notificationSettings] })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              notificationSettings[item.key as keyof typeof notificationSettings] ? "bg-blue-600" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                notificationSettings[item.key as keyof typeof notificationSettings] ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handleNotificationSave}
                        disabled={loading}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === "security" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Security Settings</h2>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Two-Factor Authentication
                          </label>
                          <p className="text-xs text-gray-500">Add an extra layer of security to your account</p>
                        </div>
                        <button
                          onClick={() => setSecuritySettings({ ...securitySettings, twoFactorAuth: !securitySettings.twoFactorAuth })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            securitySettings.twoFactorAuth ? "bg-blue-600" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              securitySettings.twoFactorAuth ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Session Timeout (minutes)
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="480"
                          value={securitySettings.sessionTimeout}
                          onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">Automatically log out after inactivity</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Password Expiry (days)
                        </label>
                        <input
                          type="number"
                          min="30"
                          max="365"
                          value={securitySettings.passwordExpiry}
                          onChange={(e) => setSecuritySettings({ ...securitySettings, passwordExpiry: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">Require password change after this many days</p>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handleSecuritySave}
                        disabled={loading}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
