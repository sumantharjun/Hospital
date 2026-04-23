import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import { getSocket, onSocketEvent, offSocketEvent } from "../services/socket";
import {
  HospitalIcon,
  DoctorIcon,
  PharmacyIcon,
  DistributorIcon,
  AppointmentsIcon,
  InventoryIcon,
  OrdersIcon,
  RevenueIcon,
} from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [branchStockData, setBranchStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const previousActivityIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !token) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(storedUser));
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [
          appointmentsRes,
          distributorOrdersRes,
          patientOrdersRes,
          financeRes,
          hospitalsRes,
          pharmaciesRes,
          distributorsRes,
          usersRes,
          ipRes,
          opRes,
          svcRes,
          bedRes,
        ] = await Promise.all([
          fetch(`${API_BASE}/api/appointments`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/distributor-orders`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/orders`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/finance/summary`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/master/hospitals`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/master/pharmacies`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/master/distributors`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/users`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/reports/hospital/daily-ip?date=${today}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
          fetch(`${API_BASE}/api/reports/hospital/daily-op?date=${today}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
          fetch(`${API_BASE}/api/service-registrations`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
          fetch(`${API_BASE}/api/reports/hospital/bed-occupancy`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
        ]);

        const [
          appointments,
          distributorOrders,
          patientOrders,
          finance,
          hospitals,
          pharmacies,
          distributors,
          users,
          ipData,
          opData,
          svcData,
          bedData,
        ] = await Promise.all([
          appointmentsRes.ok ? appointmentsRes.json() : [],
          distributorOrdersRes.ok ? distributorOrdersRes.json() : [],
          patientOrdersRes.ok ? patientOrdersRes.json() : [],
          financeRes.ok ? financeRes.json() : { total: 0, revenue: 0, expenses: 0, netProfit: 0, count: 0 },
          hospitalsRes.ok ? hospitalsRes.json() : [],
          pharmaciesRes.ok ? pharmaciesRes.json() : [],
          distributorsRes.ok ? distributorsRes.json() : [],
          usersRes.ok ? usersRes.json() : [],
          ipRes?.ok ? ipRes.json() : null,
          opRes?.ok ? opRes.json() : null,
          svcRes?.ok ? svcRes.json() : null,
          bedRes?.ok ? bedRes.json() : null,
        ]);
        
        // Fetch inventory count and stock alerts from all pharmacies
        let inventoryCount = 0;
        let branchStockData: any[] = [];
        try {
          if (Array.isArray(pharmacies) && pharmacies.length > 0) {
            // Fetch inventory data for all pharmacies in parallel
            const inventoryPromises = pharmacies.map(async (pharmacy: any) => {
              const pharmacyId = pharmacy._id || pharmacy.id;
              if (!pharmacyId) return null;
              
              try {
                const [inventoryRes, expiryRiskRes, lowStockRes] = await Promise.all([
                  fetch(`${API_BASE}/api/inventory/by-pharmacy/${pharmacyId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  }),
                  fetch(`${API_BASE}/api/inventory/expiry-risk?pharmacyId=${pharmacyId}&days=30`, {
                    headers: { Authorization: `Bearer ${token}` },
                  }),
                  fetch(`${API_BASE}/api/inventory/by-pharmacy/${pharmacyId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  }),
                ]);
                
                const inventoryItems = inventoryRes.ok ? await inventoryRes.json() : [];
                const expiryRisk = expiryRiskRes.ok ? await expiryRiskRes.json() : { riskItems: [], totalValue: 0 };
                
                // Calculate low stock items
                const lowStockItems = Array.isArray(inventoryItems) 
                  ? inventoryItems.filter((item: any) => item.quantity <= (item.threshold || 0))
                  : [];
                
                // Calculate expired items
                const today = new Date();
                const expiredItems = Array.isArray(inventoryItems)
                  ? inventoryItems.filter((item: any) => {
                      if (!item.expiryDate) return false;
                      return new Date(item.expiryDate) < today;
                    })
                  : [];
                
                return {
                  pharmacyId,
                  pharmacyName: pharmacy.name || "Unknown",
                  totalItems: Array.isArray(inventoryItems) ? inventoryItems.length : 0,
                  lowStockCount: lowStockItems.length,
                  expiringSoonCount: expiryRisk.riskItems?.length || 0,
                  expiredCount: expiredItems.length,
                  totalValueAtRisk: expiryRisk.totalValue || 0,
                };
              } catch (err) {
                console.warn(`Error fetching inventory for pharmacy ${pharmacyId}:`, err);
                return null;
              }
            });
            
            const results = await Promise.all(inventoryPromises);
            branchStockData = results.filter(Boolean);
            inventoryCount = branchStockData.reduce((sum, data) => sum + (data?.totalItems || 0), 0);
          }
        } catch (invError) {
          console.warn("Could not fetch inventory data:", invError);
        }

        // Calculate order stats
        const patientOrdersArray = Array.isArray(patientOrders) ? patientOrders : [];
        const pendingOrders = patientOrdersArray.filter((o: any) => o.status === "PENDING").length;
        const activeOrders = patientOrdersArray.filter((o: any) => 
          ["ACCEPTED", "PACKED", "OUT_FOR_DELIVERY"].includes(o.status)
        ).length;

        const svcArray = Array.isArray(svcData) ? svcData : [];
        const todaySvc = svcArray.filter((s: any) => {
          const d = s.registrationDate || s.createdAt;
          return d && new Date(d).toISOString().split("T")[0] === today;
        }).length;

        setStats({
          appointmentsCount: Array.isArray(appointments) ? appointments.length : 0,
          stockItems: inventoryCount,
          distributorOrders: Array.isArray(distributorOrders) ? distributorOrders.length : 0,
          patientOrders: patientOrdersArray.length,
          pendingOrders,
          activeOrders,
          financeTotal: finance.revenue ?? finance.total ?? 0,
          todayIP: ipData?.count ?? 0,
          todayIPEmergency: ipData?.emergency ?? 0,
          todayOP: opData?.count ?? 0,
          todaySvc,
          bedOccupied: bedData?.occupied ?? 0,
          bedTotal: bedData?.total ?? 0,
          bedOccupancyRate: bedData?.occupancyRate ?? 0,
          hospitalsCount: Array.isArray(hospitals) ? hospitals.length : 0,
          pharmaciesCount: Array.isArray(pharmacies) ? pharmacies.length : 0,
          distributorsCount: Array.isArray(distributors) ? distributors.length : 0,
          doctorsCount: Array.isArray(users)
            ? users.filter((u: any) => u.role === "DOCTOR").length
            : 0,
        });
        setBranchStockData(branchStockData);
      } catch (e: any) {
        // Silently handle connection errors (backend might be starting)
        if (e.message?.includes("Failed to fetch") || e.message?.includes("ERR_CONNECTION_REFUSED")) {
          // Backend is not running, show user-friendly message
          if (loading) {
            toast.error(
              <div>
                <div className="font-semibold">Cannot connect to backend server</div>
                <div className="text-sm text-gray-600 mt-1">Please make sure the backend server is running on port 4000</div>
              </div>,
              {
                duration: 5000,
              }
            );
          }
        } else {
          console.error(e);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStats();

    // Fetch recent activities
    const fetchActivities = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/activities?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const activities = Array.isArray(data) ? data : [];
          
          // Detect new activities
          const currentActivityIds = new Set(activities.map((a: any) => a._id || a.id));
          const newActivities = activities.filter((a: any) => 
            !previousActivityIdsRef.current.has(a._id || a.id)
          );
          
          // Show toast for new activities (only if not initial load)
          if (previousActivityIdsRef.current.size > 0 && newActivities.length > 0) {
            newActivities.forEach((activity: any) => {
              toast.success(
                <div>
                  <div className="font-semibold">{activity.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{activity.description}</div>
                </div>,
                {
                  duration: 3000,
                }
              );
            });
            // Refresh stats when new activity arrives
            fetchStats();
          }
          
          previousActivityIdsRef.current = currentActivityIds;
          setRecentActivities(activities);
        }
      } catch (e: any) {
        // Silently handle connection errors (backend might be starting)
        if (e.message?.includes("Failed to fetch") || e.message?.includes("ERR_CONNECTION_REFUSED")) {
          // Backend is not running, don't spam console
          return;
        }
        console.error("Failed to fetch activities", e);
      }
    };

    fetchActivities();

    // Socket.IO real-time updates
    const socket = getSocket();
    if (socket) {
      const handleAppointmentCreated = () => {
        fetchStats();
        fetchActivities();
      };

      const handlePrescriptionCreated = () => {
        fetchStats();
        fetchActivities();
      };

      const handleOrderCreated = () => {
        fetchStats();
        fetchActivities();
      };

      const handleOrderStatusUpdated = () => {
        fetchStats();
        fetchActivities();
      };

      const handleOrderDelivered = () => {
        // Refresh stats when order is delivered to update revenue
        fetchStats();
        fetchActivities();
      };

      const handleFinanceUpdated = () => {
        // Refresh stats when finance entries are updated (payment received)
        fetchStats();
      };

      onSocketEvent("appointment:created", handleAppointmentCreated);
      onSocketEvent("prescription:created", handlePrescriptionCreated);
      onSocketEvent("prescription:formatted", handlePrescriptionCreated);
      onSocketEvent("prescription:finalized", handlePrescriptionCreated);
      onSocketEvent("order:created", handleOrderCreated);
      onSocketEvent("order:statusUpdated", handleOrderStatusUpdated);
      onSocketEvent("order:delivered", handleOrderDelivered);
      onSocketEvent("finance:updated", handleFinanceUpdated);

      return () => {
        offSocketEvent("appointment:created", handleAppointmentCreated);
        offSocketEvent("prescription:created", handlePrescriptionCreated);
        offSocketEvent("prescription:formatted", handlePrescriptionCreated);
        offSocketEvent("prescription:finalized", handlePrescriptionCreated);
        offSocketEvent("order:created", handleOrderCreated);
        offSocketEvent("order:statusUpdated", handleOrderStatusUpdated);
        offSocketEvent("order:delivered", handleOrderDelivered);
        offSocketEvent("finance:updated", handleFinanceUpdated);
      };
    }

    // Auto-refresh stats every 10 seconds
    const statsInterval = setInterval(() => {
      fetchStats();
    }, 10000);

    return () => {
      clearInterval(statsInterval);
    };
  }, [router]);

  if (!user) return null;

  const statCards = [
    {
      label: "Hospitals",
      value: stats?.hospitalsCount ?? 0,
      helper: "Healthcare facilities",
      icon: HospitalIcon,
      accent: "from-cyan-500/10 to-cyan-500/30 text-cyan-700",
    },
    {
      label: "Doctors",
      value: stats?.doctorsCount ?? 0,
      helper: "Medical professionals",
      icon: DoctorIcon,
      accent: "from-emerald-500/10 to-emerald-500/30 text-emerald-700",
    },
    {
      label: "Pharmacies",
      value: stats?.pharmaciesCount ?? 0,
      helper: "Dispensing units",
      icon: PharmacyIcon,
      accent: "from-blue-500/10 to-blue-500/30 text-blue-700",
    },
    {
      label: "Distributors",
      value: stats?.distributorsCount ?? 0,
      helper: "Supply chain partners",
      icon: DistributorIcon,
      accent: "from-orange-500/10 to-orange-500/30 text-orange-700",
    },
    {
      label: "Appointments",
      value: stats?.appointmentsCount ?? 0,
      helper: "Total scheduled visits",
      icon: AppointmentsIcon,
      accent: "from-purple-500/10 to-purple-500/30 text-purple-700",
    },
    {
      label: "Stock Items",
      value: stats?.stockItems ?? 0,
      helper: "Pharmacy inventory",
      icon: InventoryIcon,
      accent: "from-rose-500/10 to-rose-500/30 text-rose-700",
    },
    {
      label: "Patient Orders",
      value: stats?.patientOrders ?? 0,
      helper: `${stats?.activeOrders ?? 0} Active, ${stats?.pendingOrders ?? 0} Pending`,
      icon: OrdersIcon,
      accent: "from-amber-500/10 to-amber-500/30 text-amber-700",
    },
    {
      label: "Total Revenue",
      value: `Rs. ${(stats?.financeTotal ?? 0).toLocaleString()}`,
      helper: "Net across all units",
      icon: RevenueIcon,
      accent: "from-teal-500/10 to-teal-500/30 text-teal-700",
      onClick: () => router.push("/finance"),
    },
  ];

  const operationsTiles = [
    { label: "IP Admissions", value: stats?.todayIP ?? 0, sub: "Today", color: "text-blue-700", onClick: () => router.push("/ip-management") },
    { label: "Emergencies", value: stats?.todayIPEmergency ?? 0, sub: "IP Emergency", color: (stats?.todayIPEmergency ?? 0) > 0 ? "text-red-600" : "text-slate-700", onClick: () => router.push("/ip-management") },
    { label: "OP Visits", value: stats?.todayOP ?? 0, sub: "Today", color: "text-emerald-700", onClick: () => router.push("/hospital-reports") },
    { label: "Services Billed", value: stats?.todaySvc ?? 0, sub: "Today", color: "text-violet-700", onClick: () => router.push("/hospital-reports") },
    { label: "Beds Occupied", value: stats?.bedOccupied ?? 0, sub: `of ${stats?.bedTotal ?? 0} total`, color: "text-orange-700", onClick: () => router.push("/infrastructure") },
    { label: "Bed Occupancy", value: `${stats?.bedOccupancyRate ?? 0}%`, sub: "Current rate", color: (stats?.bedOccupancyRate ?? 0) > 80 ? "text-red-600" : "text-emerald-700", onClick: () => router.push("/infrastructure") },
  ];

  return (
    <Layout user={user} currentPage="dashboard">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <div className="medical-card bg-gradient-to-r from-white via-white to-cyan-50/70 border border-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1">
              <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase mb-2">Admin Console</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Dashboard Overview</h1>
              <p className="text-sm text-slate-600 max-w-xl">
                Real-time insight across hospitals, pharmacies, orders, and operations.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <motion.div
                animate={{ scale: isPolling ? [1, 1.08, 1] : 1 }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${isPolling ? "bg-emerald-500" : "bg-slate-400"}`} />
                {isPolling ? "Live sync" : "Paused"}
              </motion.div>
              <div className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-semibold tracking-wide">
                {user.role.replace("_", " ")}
              </div>
              <button
                onClick={() => router.push("/hospital-reports")}
                className="px-4 py-2 rounded-full text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition"
              >
                View Reports
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {statCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.button
                  key={card.label}
                  initial={{ scale: 0.96, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05, duration: 0.3 }}
                  whileHover={{ y: -4 }}
                  onClick={card.onClick}
                  className={`medical-card group text-left ${card.onClick ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${card.accent}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">Today</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">{card.label}</h3>
                  <p className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">{card.value}</p>
                  <p className="text-xs text-slate-500">{card.helper}</p>
                </motion.button>
              );
            })}
          </div>

          {/* Hospital Operations Today */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="mt-6 sm:mt-8 medical-card p-0 overflow-hidden"
          >
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Hospital Operations - Today</h2>
                <p className="text-sm text-slate-500 mt-0.5">IP admissions, OP registrations, services, and bed occupancy</p>
              </div>
              <button
                onClick={() => router.push("/hospital-reports")}
                className="text-xs text-teal-700 border border-teal-200 px-3 py-1.5 rounded-full hover:bg-teal-50 transition"
              >
                View Reports →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0 divide-x divide-y divide-slate-100">
              {operationsTiles.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="p-4 text-center hover:bg-slate-50 transition-colors"
                >
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs font-semibold text-slate-700 mt-1">{item.label}</div>
                  <div className="text-xs text-slate-400">{item.sub}</div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex flex-wrap gap-3">
              {[
                { label: "IP Management", path: "/ip-management", color: "bg-blue-600" },
                { label: "Patient Summary", path: "/patient-consolidated", color: "bg-indigo-600" },
                { label: "Rooms & Beds", path: "/infrastructure", color: "bg-orange-600" },
                { label: "Certificates", path: "/certificates", color: "bg-teal-600" },
                { label: "Hospital Reports", path: "/hospital-reports", color: "bg-gray-700" },
              ].map((btn) => (
                <button key={btn.label} onClick={() => router.push(btn.path)}
                  className={`${btn.color} text-white text-xs px-4 py-2 rounded-full font-semibold hover:opacity-90`}>
                  {btn.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Branch-wise Stock Visibility Section */}
          {branchStockData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
              className="mt-6 sm:mt-8 medical-card p-0 overflow-hidden"
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Branch Stock Visibility</h2>
                    <p className="text-sm text-slate-600 mt-1">Real-time stock levels, expiry risks, and low-stock alerts per branch</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Pharmacy Branch</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Items</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Low Stock</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Expiring Soon</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Expired</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Value at Risk</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {branchStockData.map((branch, idx) => {
                      const hasAlerts = branch.lowStockCount > 0 || branch.expiringSoonCount > 0 || branch.expiredCount > 0;
                      return (
                        <motion.tr
                          key={branch.pharmacyId}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.9 + idx * 0.05 }}
                          className={`hover:bg-slate-50 transition-colors ${
                            hasAlerts ? "bg-yellow-50/50" : ""
                          }`}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="font-semibold text-sm text-slate-900">{branch.pharmacyName}</div>
                            <div className="text-xs text-slate-500">ID: {branch.pharmacyId.slice(-8)}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-semibold text-slate-900">{branch.totalItems}</span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            {branch.lowStockCount > 0 ? (
                              <span className="medical-badge-error">Low {branch.lowStockCount}</span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            {branch.expiringSoonCount > 0 ? (
                              <span className="medical-badge-warning">Soon {branch.expiringSoonCount}</span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            {branch.expiredCount > 0 ? (
                              <span className="px-2 py-1 text-xs font-semibold bg-red-600 text-white rounded-full">Expired {branch.expiredCount}</span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            {branch.totalValueAtRisk > 0 ? (
                              <span className="text-sm font-semibold text-red-600">Rs. {branch.totalValueAtRisk.toFixed(2)}</span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            {hasAlerts ? (
                              <span className="medical-badge-warning">Alert</span>
                            ) : (
                              <span className="medical-badge-success">OK</span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}
    </Layout>
  );
}




