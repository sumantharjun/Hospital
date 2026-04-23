import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { getUser } from "@/utils/auth";
import { API_BASE } from "@/utils/constants";
import { getAuthHeaders } from "@/services/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";

interface Pharmacy {
  _id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  distributorId?: string;
  isActive?: boolean;
  createdAt?: string;
  totalOrders?: number;
  pendingOrders?: number;
  deliveredOrders?: number;
}

export default function PharmaciesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [filteredPharmacies, setFilteredPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [pharmacyStats, setPharmacyStats] = useState<Record<string, any>>({});


  const loadPharmacyStats = useCallback(async (pharmaciesList: Pharmacy[], distributorId: string) => {
    try {
      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = {
        ...(authHeaders.Authorization && { Authorization: authHeaders.Authorization }),
      };

      // Get all orders for this distributor
      const ordersResponse = await fetch(`${API_BASE}/api/distributor-orders?distributorId=${distributorId}`, {
        headers,
      });

      if (ordersResponse.ok) {
        const orders = await ordersResponse.json();
        const ordersList = Array.isArray(orders) ? orders : [];

        // Calculate stats for each pharmacy
        const stats: Record<string, any> = {};
        pharmaciesList.forEach((pharmacy) => {
          const pharmacyOrders = ordersList.filter((o: any) => o.pharmacyId === pharmacy._id);
          stats[pharmacy._id] = {
            totalOrders: pharmacyOrders.length,
            pendingOrders: pharmacyOrders.filter((o: any) => ["PENDING", "ACCEPTED"].includes(o.status)).length,
            deliveredOrders: pharmacyOrders.filter((o: any) => o.status === "DELIVERED").length,
            dispatchedOrders: pharmacyOrders.filter((o: any) => o.status === "DISPATCHED").length,
          };
        });

        setPharmacyStats(stats);
      }
    } catch (error) {
      console.error("Error loading pharmacy stats:", error);
    }
  }, []);

  // Load pharmacies - backend automatically filters by distributorId from user record
  const loadPharmaciesFromBackend = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = getUser();
      
      if (!currentUser) {
        toast.error("User not found. Please login again.");
        router.replace("/");
        return;
      }

      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(authHeaders.Authorization && { Authorization: authHeaders.Authorization }),
      };

      // Verify API_BASE is set
      if (!API_BASE || API_BASE === "undefined") {
        throw new Error("API_BASE is not configured. Please check environment variables.");
      }

      // Backend will automatically filter by distributorId from the authenticated user's record
      // No need to pass distributorId in query - backend gets it from req.user
      const apiUrl = `${API_BASE}/api/master/pharmacies`;
      console.log("Fetching pharmacies from:", apiUrl);
      console.log("User role:", currentUser.role);
      console.log("User distributorId (from localStorage):", currentUser.distributorId);

      const response = await fetch(apiUrl, {
        method: "GET",
        headers,
        mode: "cors",
      });

      console.log("Response status:", response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        const pharmaciesList = Array.isArray(data) ? data : [];
        
        console.log("Loaded pharmacies:", pharmaciesList.length);
        if (pharmaciesList.length > 0) {
          console.log("Sample pharmacy:", {
            name: pharmaciesList[0].name,
            distributorId: pharmaciesList[0].distributorId,
            _id: pharmaciesList[0]._id
          });
        }
        
        setPharmacies(pharmaciesList);

        // Get distributorId from first pharmacy or user record for stats
        const distributorIdForStats = pharmaciesList.length > 0 
          ? pharmaciesList[0].distributorId 
          : currentUser.distributorId;
        
        if (pharmaciesList.length > 0 && distributorIdForStats) {
          await loadPharmacyStats(pharmaciesList, distributorIdForStats);
        } else if (pharmaciesList.length === 0) {
          console.warn("No pharmacies found. This could mean:");
          console.warn("1. No pharmacies have been linked to this distributor in the admin panel");
          console.warn("2. The user's distributorId is not set in the database");
          console.warn("3. The pharmacies exist but don't have the matching distributorId");
          if (currentUser.distributorId) {
            console.warn("User's distributorId:", currentUser.distributorId);
          } else {
            console.warn("User's distributorId is missing!");
          }
        }
      } else {
        const errorText = await response.text().catch(() => "");
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `HTTP ${response.status}` };
        }
        
        console.error("Failed to load pharmacies - Status:", response.status, "Error:", errorData);
        const errorMessage = errorData.message || `Failed to load pharmacies (${response.status})`;
        
        if (response.status === 401 || response.status === 403) {
          toast.error("Authentication failed. Please login again.");
          router.replace("/");
        } else {
          toast.error(errorMessage);
        }
        setPharmacies([]);
      }
    } catch (error: any) {
      console.error("Network error loading pharmacies:", error);
      
      // Check if it's a network/CORS error
      if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
        toast.error("Cannot connect to server. Please check if backend is running on " + API_BASE);
      } else {
        toast.error(error.message || "Network error: Please check if backend server is running");
      }
      setPharmacies([]);
    } finally {
      setLoading(false);
    }
  }, [loadPharmacyStats, router]);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    
    // Backend will automatically get distributorId from the authenticated user's database record
    // So we don't need to pass it - just call the API
    loadPharmaciesFromBackend();

    // Socket is already initialized in _app.tsx, just listen to events
    const socket = getSocket();
    if (socket) {
      const handlePharmacyUpdated = () => {
        loadPharmaciesFromBackend();
      };

      onSocketEvent("pharmacy:updated", handlePharmacyUpdated);

      return () => {
        offSocketEvent("pharmacy:updated", handlePharmacyUpdated);
      };
    }
  }, [loadPharmaciesFromBackend, router]);

  useEffect(() => {
    let filtered = [...pharmacies];

    if (searchTerm) {
      filtered = filtered.filter(
        (pharmacy) =>
          pharmacy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pharmacy.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pharmacy.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pharmacy._id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredPharmacies(filtered);
  }, [pharmacies, searchTerm]);


  const viewPharmacyDetails = (pharmacy: Pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setShowDetailsModal(true);
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="pharmacies">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Pharmacies</h1>
            <p className="text-gray-600">View all pharmacies linked to your distributor</p>
          </div>
          <button
            onClick={loadPharmaciesFromBackend}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Pharmacies</span>
              <span className="text-2xl">🏥</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{pharmacies.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Active</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {pharmacies.filter((p) => p.isActive !== false).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Orders</span>
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {Object.values(pharmacyStats).reduce((sum, stat) => sum + (stat.totalOrders || 0), 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Pending Orders</span>
              <span className="text-2xl">⏳</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">
              {Object.values(pharmacyStats).reduce((sum, stat) => sum + (stat.pendingOrders || 0), 0)}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <input
            type="text"
            placeholder="Search pharmacies by name, address, phone, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
          />
        </div>

        {/* Pharmacies List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPharmacies.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="mb-4">
              <span className="text-4xl">🏥</span>
            </div>
            <p className="text-gray-500 text-lg font-semibold mb-2">No pharmacies found</p>
            <div className="text-gray-400 text-sm space-y-2 max-w-md mx-auto">
              <p>This could mean:</p>
              <ul className="list-disc list-inside text-left space-y-1 mt-2">
                <li>No pharmacies have been linked to your distributor in the admin panel</li>
                <li>Your user account doesn't have a distributorId set</li>
                <li>The pharmacies exist but have a different distributorId</li>
              </ul>
              <p className="mt-4 text-xs">
                <strong>Solution:</strong> Ask the admin to:
                <br />1. Create pharmacies and assign them to your distributor
                <br />2. Ensure your user account has the correct distributorId
              </p>
            </div>
            {user?.distributorId && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Your Distributor ID:</strong> {user.distributorId}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Make sure pharmacies in admin panel have this distributorId
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPharmacies.map((pharmacy) => {
              const stats = pharmacyStats[pharmacy._id] || {};
              return (
                <motion.div
                  key={pharmacy._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl shadow-md border-2 border-gray-200 hover:border-purple-400 transition-all overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                          <span>🏥</span>
                          {pharmacy.name}
                        </h3>
                        <p className="text-purple-100 text-sm">ID: {pharmacy._id.slice(-8)}</p>
                      </div>
                      {pharmacy.isActive !== false && (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded">
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">📍 Address</p>
                      <p className="text-sm text-gray-600">{pharmacy.address}</p>
                    </div>

                    {pharmacy.phone && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">📞 Phone</p>
                        <p className="text-sm text-gray-600">{pharmacy.phone}</p>
                      </div>
                    )}

                    {pharmacy.email && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">📧 Email</p>
                        <p className="text-sm text-gray-600">{pharmacy.email}</p>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-200">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Total</p>
                        <p className="text-lg font-bold text-gray-900">{stats.totalOrders || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Pending</p>
                        <p className="text-lg font-bold text-orange-600">{stats.pendingOrders || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Delivered</p>
                        <p className="text-lg font-bold text-green-600">{stats.deliveredOrders || 0}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => viewPharmacyDetails(pharmacy)}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all text-sm"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => router.push(`/purchase-requests?pharmacyId=${pharmacy._id}`)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
                      >
                        View Orders
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pharmacy Details Modal */}
        {showDetailsModal && selectedPharmacy && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>🏥</span>
                {selectedPharmacy.name}
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Pharmacy ID</p>
                  <p className="text-sm text-gray-600 font-mono">{selectedPharmacy._id}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Address</p>
                  <p className="text-sm text-gray-600">{selectedPharmacy.address}</p>
                </div>
                {selectedPharmacy.phone && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Phone</p>
                    <p className="text-sm text-gray-600">{selectedPharmacy.phone}</p>
                  </div>
                )}
                {selectedPharmacy.email && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Email</p>
                    <p className="text-sm text-gray-600">{selectedPharmacy.email}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedPharmacy.isActive !== false
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedPharmacy.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </div>
                {selectedPharmacy.createdAt && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Created</p>
                    <p className="text-sm text-gray-600">
                      {new Date(selectedPharmacy.createdAt).toLocaleString()}
                    </p>
                  </div>
                )}
                {pharmacyStats[selectedPharmacy._id] && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Order Statistics</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {pharmacyStats[selectedPharmacy._id].totalOrders || 0}
                        </p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Pending</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {pharmacyStats[selectedPharmacy._id].pendingOrders || 0}
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Dispatched</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {pharmacyStats[selectedPharmacy._id].dispatchedOrders || 0}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Delivered</p>
                        <p className="text-2xl font-bold text-green-600">
                          {pharmacyStats[selectedPharmacy._id].deliveredOrders || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => router.push(`/purchase-requests?pharmacyId=${selectedPharmacy._id}`)}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
                >
                  View Orders
                </button>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedPharmacy(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

