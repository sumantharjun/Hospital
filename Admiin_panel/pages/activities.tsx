import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { ActivityIcon, DeleteIcon, AppointmentsIcon, PharmacyIcon, OrdersIcon, InventoryIcon, RevenueIcon, PatientIcon, DoctorIcon, HospitalIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

interface Activity {
  _id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  patientId?: string;
  doctorId?: string;
  hospitalId?: string;
  pharmacyId?: string;
}

export default function ActivitiesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isPolling] = useState(true);
  const [loading, setLoading] = useState(true);
  const previousActivityIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !token) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(storedUser));

    // Fetch activities
    const fetchActivities = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/activities?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const fetchedActivities = Array.isArray(data) ? data : [];
          
          // Detect new activities
          const currentActivityIds = new Set(fetchedActivities.map((a: Activity) => a._id));
          const newActivities = fetchedActivities.filter((a: Activity) => 
            !previousActivityIdsRef.current.has(a._id)
          );
          
          // Show toast for new activities (only if not initial load)
          if (previousActivityIdsRef.current.size > 0 && newActivities.length > 0) {
            newActivities.forEach((activity: Activity) => {
              toast.success(
                <div>
                  <div className="font-semibold">{activity.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{activity.description}</div>
                </div>,
                {
                  duration: 4000,
                }
              );
            });
          }
          
          previousActivityIdsRef.current = currentActivityIds;
          setActivities(fetchedActivities);
          setLoading(false);
        }
      } catch (e: any) {
        // Silently handle connection errors (backend might be starting)
        if (e.message?.includes("Failed to fetch") || e.message?.includes("ERR_CONNECTION_REFUSED")) {
          // Backend is not running, show user-friendly message on initial load
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
          console.error("Failed to fetch activities", e);
        }
        setLoading(false);
      }
    };

    fetchActivities();

    // Poll for updates every 5 seconds
    const pollInterval = setInterval(() => {
      fetchActivities();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [router]);

  const getActivityIcon = (type: string) => {
    if (type.includes("APPOINTMENT")) return <AppointmentsIcon className="w-6 h-6 text-blue-900" />;
    if (type.includes("PRESCRIPTION")) return <PharmacyIcon className="w-6 h-6 text-blue-900" />;
    if (type.includes("ORDER")) return <OrdersIcon className="w-6 h-6 text-blue-900" />;
    if (type.includes("INVENTORY")) return <InventoryIcon className="w-6 h-6 text-blue-900" />;
    if (type.includes("FINANCE")) return <RevenueIcon className="w-6 h-6 text-blue-900" />;
    if (type.includes("USER")) return <PatientIcon className="w-6 h-6 text-blue-900" />;
    return <ActivityIcon className="w-6 h-6 text-blue-900" />;
  };

  const getActivityColor = (type: string) => {
    if (type.includes("APPOINTMENT")) return "text-blue-900 bg-blue-50 border-blue-200";
    if (type.includes("PRESCRIPTION")) return "text-blue-900 bg-blue-50 border-blue-200";
    if (type.includes("ORDER")) return "text-blue-900 bg-blue-50 border-blue-200";
    if (type.includes("INVENTORY")) return "text-blue-900 bg-blue-50 border-blue-200";
    if (type.includes("FINANCE")) return "text-blue-900 bg-blue-50 border-blue-200";
    if (type.includes("USER")) return "text-blue-900 bg-blue-50 border-blue-200";
    return "text-gray-700 bg-gray-50 border-gray-300";
  };

  const clearAllActivities = async () => {
    if (!confirm("Are you sure you want to delete all activities? This action cannot be undone.")) {
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast.error("Authentication required");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/activities/all`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setActivities([]);
        previousActivityIdsRef.current.clear();
        toast.success(`Successfully deleted ${data.deletedCount || 0} activities`);
      } else {
        const error = await res.json().catch(() => ({ message: "Failed to delete activities" }));
        toast.error(error.message || "Failed to delete activities");
      }
    } catch (e: any) {
      toast.error("Error deleting activities");
      console.error(e);
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="activities">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
                Live Activities
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Real-time updates from all system activities
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <motion.div
                animate={{
                  scale: isPolling ? [1, 1.1, 1] : 1,
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-white border border-gray-300"
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full ${isPolling ? "bg-green-600" : "bg-gray-400"}`}
                />
                <span className="text-xs text-gray-700 font-semibold">
                  {isPolling ? "Live" : "Paused"}
                </span>
              </motion.div>
              {activities.length > 0 && (
                <motion.button
                  onClick={clearAllActivities}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs sm:text-sm font-semibold transition-all flex items-center gap-2"
                >
                  <DeleteIcon className="w-4 h-4" />
                  <span>Clear All</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-blue-900 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <AnimatedCard delay={0.1}>
          <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
            {activities.map((activity, idx) => (
              <motion.div
                key={activity._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="border border-gray-300 rounded-lg p-4 bg-white hover:border-blue-900 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex-shrink-0 p-2 bg-blue-50 rounded-lg border border-blue-200">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm text-gray-900 break-words">{activity.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap border ${getActivityColor(activity.type)}`}>
                        {activity.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 mb-3 break-words">{activity.description}</p>
                    <div className="flex items-center gap-2 sm:gap-4 text-xs text-gray-600 flex-wrap">
                      {activity.patientId && (
                        <span className="font-medium flex items-center gap-1">
                          <PatientIcon className="w-3 h-3" />
                          Patient: {activity.patientId.slice(-8)}
                        </span>
                      )}
                      {activity.doctorId && (
                        <span className="font-medium flex items-center gap-1">
                          <DoctorIcon className="w-3 h-3" />
                          Doctor: {activity.doctorId.slice(-8)}
                        </span>
                      )}
                      {activity.pharmacyId && (
                        <span className="font-medium flex items-center gap-1">
                          <PharmacyIcon className="w-3 h-3" />
                          Pharmacy: {activity.pharmacyId.slice(-8)}
                        </span>
                      )}
                      {activity.hospitalId && (
                        <span className="font-medium flex items-center gap-1">
                          <HospitalIcon className="w-3 h-3" />
                          Hospital: {activity.hospitalId.slice(-8)}
                        </span>
                      )}
                      <span className="ml-auto font-medium text-gray-500">
                        {new Date(activity.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {activities.length === 0 && (
              <div className="text-center py-12">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                    <ActivityIcon className="w-10 h-10 text-blue-900" />
                  </div>
                </div>
                <p className="text-sm text-gray-700 font-medium mb-2">
                  No activities yet
                </p>
                <p className="text-xs text-gray-600">
                  Activities will appear here in real-time
                </p>
              </div>
            )}
          </div>
        </AnimatedCard>
      )}
    </Layout>
  );
}
