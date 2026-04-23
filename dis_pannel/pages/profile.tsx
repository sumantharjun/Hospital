import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { userApi, distributorApi } from "@/services/api";
import { getUser, setAuth } from "@/utils/auth";
import { Distributor } from "@/types";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
  });
  const [distributorForm, setDistributorForm] = useState({
    name: "",
    address: "",
    phoneNumber: "",
    email: "",
    licenseNumber: "",
    ownerName: "",
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
    loadProfileData(currentUser);
  }, [router]);

  const loadProfileData = async (currentUser: any) => {
    setLoading(true);
    try {
      const userData = await userApi.getProfile();
      setUser(userData);
      setUserForm({
        name: userData.name || "",
        email: userData.email || "",
      });

      if (currentUser.distributorId) {
        try {
          const distributorData = await distributorApi.getById(currentUser.distributorId);
          setDistributor(distributorData);
          setDistributorForm({
            name: distributorData.name || "",
            address: distributorData.address || "",
            phoneNumber: distributorData.phoneNumber || "",
            email: distributorData.email || "",
            licenseNumber: distributorData.licenseNumber || "",
            ownerName: distributorData.ownerName || "",
          });
        } catch (error) {
          console.error("Failed to load distributor data");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUserUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  const handleDistributorUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.distributorId) return;

    try {
      await distributorApi.update(user.distributorId, distributorForm);
      toast.success("Distributor information updated successfully!");
      loadProfileData(user);
    } catch (error: any) {
      toast.error(error.message || "Failed to update distributor information");
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="profile">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Distributor Profile</h1>
          <p className="text-gray-600">Manage your profile and distributor information</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Profile */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">User Profile</h2>
                <button
                  onClick={() => setEditing(!editing)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all text-sm"
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
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Save Changes
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Name</span>
                    <span className="font-semibold text-gray-900">{user.name || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Email</span>
                    <span className="font-semibold text-gray-900">{user.email || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Role</span>
                    <span className="font-semibold text-gray-900">{user.role || "N/A"}</span>
                  </div>
                  {user.distributorId && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Distributor ID</span>
                      <span className="font-mono text-xs text-gray-900">{user.distributorId}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Distributor Information */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Distributor Information</h2>
              {user.distributorId ? (
                <form onSubmit={handleDistributorUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Distributor Name
                    </label>
                    <input
                      type="text"
                      value={distributorForm.name}
                      onChange={(e) => setDistributorForm({ ...distributorForm, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                    <textarea
                      value={distributorForm.address}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, address: e.target.value })
                      }
                      rows={3}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={distributorForm.phoneNumber}
                        onChange={(e) =>
                          setDistributorForm({ ...distributorForm, phoneNumber: e.target.value })
                        }
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={distributorForm.email}
                        onChange={(e) =>
                          setDistributorForm({ ...distributorForm, email: e.target.value })
                        }
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
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
                        value={distributorForm.licenseNumber}
                        onChange={(e) =>
                          setDistributorForm({ ...distributorForm, licenseNumber: e.target.value })
                        }
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Owner Name
                      </label>
                      <input
                        type="text"
                        value={distributorForm.ownerName}
                        onChange={(e) =>
                          setDistributorForm({ ...distributorForm, ownerName: e.target.value })
                        }
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Update Distributor Info
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    No distributor ID associated with this account. Please contact administrator.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

