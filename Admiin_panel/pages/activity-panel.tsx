import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { DeleteIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

type ActiveSection = "user-interactions" | "live-activities" | "conversations";

export default function ActivityPanelPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("user-interactions");

  // User Interactions State
  const [interactions, setInteractions] = useState<any[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalInteractions: 0,
    todayInteractions: 0,
    activeUsers: 0,
    avgSessionTime: 0,
  });
  const [filterType, setFilterType] = useState<"all" | "login" | "action" | "error">("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("today");

  // Live Activities State
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [isPolling] = useState(true);
  const previousActivityIdsRef = useRef<Set<string>>(new Set());

  // Conversations State
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [appointmentId, setAppointmentId] = useState("");

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

  // Fetch User Interactions
  useEffect(() => {
    if (!token || activeSection !== "user-interactions") return;
    const fetchData = async () => {
      setInteractionsLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const activitiesRes = await fetch(`${API_BASE}/api/activities?limit=100`, { headers });
        
        if (!activitiesRes.ok) {
          const errorData = await activitiesRes.json().catch(() => ({ message: "Failed to fetch activities" }));
          throw new Error(errorData.message || `HTTP ${activitiesRes.status}`);
        }
        
        const activities = await activitiesRes.json();
        const activitiesArray = Array.isArray(activities) ? activities : [];
        
        const processedInteractions = activitiesArray.map((activity: any) => ({
          id: activity._id || activity.id,
          type: activity.type || "action",
          user: activity.userId || "System",
          action: activity.title || "Unknown Action",
          description: activity.description || "",
          timestamp: activity.createdAt || new Date().toISOString(),
          status: activity.status || "success",
        }));

        setInteractions(processedInteractions);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayInteractions = processedInteractions.filter(
          (i: any) => new Date(i.timestamp) >= today
        );
        
        const uniqueUsers = new Set(processedInteractions.map((i: any) => i.user));
        
        setStats({
          totalInteractions: processedInteractions.length,
          todayInteractions: todayInteractions.length,
          activeUsers: uniqueUsers.size,
          avgSessionTime: 0,
        });
      } catch (e: any) {
        // Handle connection errors gracefully
        if (e.message?.includes("Failed to fetch") || e.message?.includes("ERR_CONNECTION_REFUSED")) {
          // Backend might not be running - only show error on initial load
          if (interactionsLoading) {
            console.warn("Cannot connect to backend server for user interactions");
          }
          setInteractions([]);
          setStats({
            totalInteractions: 0,
            todayInteractions: 0,
            activeUsers: 0,
            avgSessionTime: 0,
          });
        } else {
          console.error("Error fetching user interactions:", e);
          toast.error(e.message || "Failed to fetch user interactions");
        }
      } finally {
        setInteractionsLoading(false);
      }
    };
    fetchData();
  }, [token, activeSection, dateRange]);

  // Fetch Live Activities
  useEffect(() => {
    if (!token || activeSection !== "live-activities") return;
    
    const fetchActivities = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/activities?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const fetchedActivities = Array.isArray(data) ? data : [];
          
          const currentActivityIds = new Set(fetchedActivities.map((a: any) => a._id));
          const newActivities = fetchedActivities.filter((a: any) => 
            !previousActivityIdsRef.current.has(a._id)
          );
          
          if (previousActivityIdsRef.current.size > 0 && newActivities.length > 0) {
            newActivities.forEach((activity: any) => {
              toast.success(activity.title, {
                duration: 4000,
              });
            });
          }
          
          previousActivityIdsRef.current = currentActivityIds;
          setActivities(fetchedActivities);
          setActivitiesLoading(false);
        }
      } catch (e: any) {
        if (activitiesLoading) {
          toast.error("Cannot connect to backend server");
        }
        setActivitiesLoading(false);
      }
    };

    fetchActivities();
    const pollInterval = setInterval(() => {
      fetchActivities();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [token, activeSection]);

  // Fetch Conversations
  useEffect(() => {
    if (!token || activeSection !== "conversations") return;
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setConversations(res.ok ? await res.json() : []);
      } catch (e) {
        console.error(e);
      } finally {
        setConversationsLoading(false);
      }
    };
    fetchConversations();
  }, [token, activeSection]);

  const fetchByAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !appointmentId) return;
    setConversationsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/by-appointment/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const conv = await res.json();
        setSelectedConversation(conv);
      } else {
        setSelectedConversation(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConversationsLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    if (type.includes("APPOINTMENT")) return "📅";
    if (type.includes("PRESCRIPTION")) return "💊";
    if (type.includes("ORDER")) return "📦";
    if (type.includes("INVENTORY")) return "📋";
    if (type.includes("FINANCE")) return "💰";
    if (type.includes("USER")) return "👤";
    return "🔔";
  };

  const getActivityColor = (type: string) => {
    if (type.includes("APPOINTMENT")) return "text-blue-700 bg-blue-100 border-blue-300";
    if (type.includes("PRESCRIPTION")) return "text-green-700 bg-green-100 border-green-300";
    if (type.includes("ORDER")) return "text-blue-700 bg-blue-100 border-blue-300";
    if (type.includes("INVENTORY")) return "text-green-700 bg-green-100 border-green-300";
    if (type.includes("FINANCE")) return "text-green-700 bg-green-100 border-green-300";
    if (type.includes("USER")) return "text-blue-700 bg-blue-100 border-blue-300";
    return "text-black bg-white border-black";
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case "login": return "🔐";
      case "action": return "⚡";
      case "error": return "⚠️";
      default: return "📝";
    }
  };

  const getInteractionColor = (type: string) => {
    switch (type) {
      case "login": return "bg-blue-50 border-blue-200 text-blue-700";
      case "action": return "bg-green-50 border-green-200 text-green-700";
      case "error": return "bg-red-50 border-red-200 text-red-700";
      default: return "bg-white border-black text-black";
    }
  };

  const getDoctorName = (doctorId: any) => {
    if (!doctorId) return "N/A";
    if (typeof doctorId === 'object' && doctorId.name) return doctorId.name;
    const idString = typeof doctorId === 'string' ? doctorId : String(doctorId);
    return idString.length > 8 ? idString.slice(-8) : idString;
  };

  const getPatientName = (patientId: any) => {
    if (!patientId) return "N/A";
    if (typeof patientId === 'object' && patientId.name) return patientId.name;
    const idString = typeof patientId === 'string' ? patientId : String(patientId);
    return idString.length > 8 ? idString.slice(-8) : idString;
  };

  const clearAllActivities = async () => {
    if (!confirm("Are you sure you want to delete all activities? This action cannot be undone.")) {
      return;
    }

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
        setInteractions([]);
        setActivities([]);
        previousActivityIdsRef.current.clear();
        setStats({
          totalInteractions: 0,
          todayInteractions: 0,
          activeUsers: 0,
          avgSessionTime: 0,
        });
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

  const filteredInteractions = interactions.filter((interaction) => {
    if (filterType !== "all" && interaction.type !== filterType) return false;
    
    const interactionDate = new Date(interaction.timestamp);
    const now = new Date();
    
    if (dateRange === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return interactionDate >= today;
    } else if (dateRange === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return interactionDate >= weekAgo;
    } else if (dateRange === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return interactionDate >= monthAgo;
    }
    
    return true;
  });

  if (!user) return null;

  const sections = [
    { id: "user-interactions" as ActiveSection, label: "User Interaction Dashboard", icon: "📊" },
    { id: "live-activities" as ActiveSection, label: "Live Activities", icon: "🔔" },
    { id: "conversations" as ActiveSection, label: "Patient-Doctor Conversations", icon: "💬" },
  ];

  return (
    <Layout user={user} currentPage="activity-panel">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
                Activity Panel
              </h2>
              <p className="text-sm text-gray-600">
                Monitor user interactions, live activities, and patient-doctor conversations
              </p>
            </div>
            {(interactions.length > 0 || activities.length > 0) && (
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
      </motion.header>

      {/* Section Buttons */}
      <AnimatedCard delay={0.1} className="mb-6">
        <div className="flex flex-wrap gap-3">
          {sections.map((section) => (
            <motion.button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border-2 transition-all ${
                activeSection === section.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                  : "bg-white text-black border-black hover:bg-blue-50 hover:border-blue-600"
              }`}
            >
              <span className="text-lg">{section.icon}</span>
              <span>{section.label}</span>
            </motion.button>
          ))}
        </div>
      </AnimatedCard>

      {/* User Interactions Section */}
      {activeSection === "user-interactions" && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <AnimatedCard delay={0.2}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black mb-1">Total Interactions</p>
                  <p className="text-2xl font-bold text-black">{stats.totalInteractions}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <span className="text-2xl">📊</span>
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.3}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black mb-1">Today's Interactions</p>
                  <p className="text-2xl font-bold text-green-600">{stats.todayInteractions}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <span className="text-2xl">📈</span>
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.4}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black mb-1">Active Users</p>
                  <p className="text-2xl font-bold text-black">{stats.activeUsers}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <span className="text-2xl">👥</span>
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.5}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black mb-1">Avg Session Time</p>
                  <p className="text-2xl font-bold text-black">{stats.avgSessionTime}m</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <span className="text-2xl">⏱️</span>
                </div>
              </div>
            </AnimatedCard>
          </div>

          {/* Filters */}
          <AnimatedCard delay={0.6} className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex gap-2 flex-wrap">
                {["all", "login", "action", "error"].map((type) => (
                  <motion.button
                    key={type}
                    onClick={() => setFilterType(type as any)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      filterType === type
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-black border-black hover:bg-blue-50 hover:border-blue-600"
                    }`}
                  >
                    {type === "all" ? "All Types" : type === "login" ? "🔐 Logins" : type === "action" ? "⚡ Actions" : "⚠️ Errors"}
                  </motion.button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {["today", "week", "month", "all"].map((range) => (
                  <motion.button
                    key={range}
                    onClick={() => setDateRange(range as any)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      dateRange === range
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-black border-black hover:bg-green-50 hover:border-green-600"
                    }`}
                  >
                    {range === "all" ? "All Time" : range === "today" ? "Today" : range === "week" ? "This Week" : "This Month"}
                  </motion.button>
                ))}
              </div>
            </div>
          </AnimatedCard>

          {/* Interactions List */}
          {interactionsLoading ? (
            <div className="flex items-center justify-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
              />
            </div>
          ) : (
            <AnimatedCard delay={0.7}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Interactions</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 bg-blue-50 px-3 py-1 rounded-md border border-blue-200">
                    {filteredInteractions.length} {filteredInteractions.length === 1 ? "interaction" : "interactions"}
                  </span>
                  {filteredInteractions.length > 0 && (
                    <motion.button
                      onClick={clearAllActivities}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-all flex items-center gap-2"
                    >
                      <DeleteIcon className="w-3 h-3" />
                      <span>Clear All</span>
                    </motion.button>
                  )}
                </div>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredInteractions.map((interaction, idx) => (
                  <motion.div
                    key={interaction.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`p-4 rounded-lg border-2 ${getInteractionColor(interaction.type)} transition-all hover:shadow-md`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="text-2xl">{getInteractionIcon(interaction.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm text-black">{interaction.action}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 border border-black">
                              {interaction.type}
                            </span>
                          </div>
                          <p className="text-xs text-black mb-2">{interaction.description}</p>
                          <div className="flex items-center gap-4 text-xs text-black">
                            <span>👤 {interaction.user}</span>
                            <span>🕐 {new Date(interaction.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              {filteredInteractions.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-sm text-black font-medium">No interactions found</p>
                </div>
              )}
            </AnimatedCard>
          )}
        </>
      )}

      {/* Live Activities Section */}
      {activeSection === "live-activities" && (
        <>
          <AnimatedCard delay={0.2} className="mb-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-black w-fit">
              <div className={`h-3 w-3 rounded-full ${isPolling ? "bg-green-600" : "bg-black"}`} />
              <span className="text-xs text-black font-semibold">
                {isPolling ? "Live" : "Paused"}
              </span>
            </div>
          </AnimatedCard>

          {activitiesLoading ? (
            <div className="flex items-center justify-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full"
              />
            </div>
          ) : (
            <AnimatedCard delay={0.3}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Live Activities</h3>
                {activities.length > 0 && (
                  <motion.button
                    onClick={clearAllActivities}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-all flex items-center gap-2"
                  >
                    <DeleteIcon className="w-3 h-3" />
                    <span>Clear All</span>
                  </motion.button>
                )}
              </div>
              <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                {activities.map((activity, idx) => (
                  <motion.div
                    key={activity._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border-2 border-blue-200 rounded-xl p-4 bg-white hover:border-green-400 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="text-2xl sm:text-3xl flex-shrink-0">{getActivityIcon(activity.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-sm text-black break-words">{activity.title}</h3>
                          <span className={`text-xs px-2 py-1 rounded-lg font-medium whitespace-nowrap border ${getActivityColor(activity.type)}`}>
                            {activity.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-black mb-3 break-words">{activity.description}</p>
                        <div className="flex items-center gap-2 sm:gap-4 text-xs text-black flex-wrap">
                          {activity.patientId && (
                            <span className="font-medium">👤 Patient: {activity.patientId.slice(-8)}</span>
                          )}
                          {activity.doctorId && (
                            <span className="font-medium">👨‍⚕️ Doctor: {activity.doctorId.slice(-8)}</span>
                          )}
                          {activity.pharmacyId && (
                            <span className="font-medium">💊 Pharmacy: {activity.pharmacyId.slice(-8)}</span>
                          )}
                          {activity.hospitalId && (
                            <span className="font-medium">🏥 Hospital: {activity.hospitalId.slice(-8)}</span>
                          )}
                          <span className="ml-auto font-medium">
                            {new Date(activity.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {activities.length === 0 && (
                  <p className="text-sm text-black text-center py-8 font-medium">
                    No activities yet. Activities will appear here in real-time.
                  </p>
                )}
              </div>
            </AnimatedCard>
          )}
        </>
      )}

      {/* Conversations Section */}
      {activeSection === "conversations" && (
        <>
          <AnimatedCard delay={0.2} className="mb-6">
            <form onSubmit={fetchByAppointment} className="flex flex-col sm:flex-row gap-3">
              <input
                placeholder="Enter Appointment ID"
                className="flex-1 rounded-xl bg-white border-2 border-black px-4 py-3 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                value={appointmentId}
                onChange={(e) => setAppointmentId(e.target.value)}
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm"
              >
                Search
              </motion.button>
            </form>
          </AnimatedCard>

          {conversationsLoading ? (
            <div className="flex items-center justify-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full"
              />
            </div>
          ) : selectedConversation ? (
            <AnimatedCard delay={0.3}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-black mb-2">Conversation Details</h3>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm text-black flex-wrap">
                    <span>Appointment: {selectedConversation.appointmentId.slice(-8)}</span>
                    <span>Type: {selectedConversation.conversationType}</span>
                    <span>Started: {new Date(selectedConversation.startedAt).toLocaleString()}</span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedConversation(null)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-white border-2 border-black text-black hover:bg-black hover:text-white text-sm font-semibold"
                >
                  Close
                </motion.button>
              </div>
              {selectedConversation.summary && (
                <div className="mb-6 p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
                  <p className="text-sm font-semibold text-black mb-2">Summary:</p>
                  <p className="text-sm text-black">{selectedConversation.summary}</p>
                </div>
              )}
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {selectedConversation.messages?.map((msg: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex ${msg.senderRole === "DOCTOR" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-xl p-3 sm:p-4 ${
                        msg.senderRole === "DOCTOR"
                          ? "bg-green-50 border-2 border-green-200"
                          : "bg-blue-50 border-2 border-blue-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-black">
                          {msg.senderRole === "DOCTOR" ? "👨‍⚕️ Doctor" : "👤 Patient"}
                        </span>
                        <span className="text-xs text-black">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-black whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
                {(!selectedConversation.messages || selectedConversation.messages.length === 0) && (
                  <p className="text-center text-black py-8">No messages in this conversation</p>
                )}
              </div>
            </AnimatedCard>
          ) : (
            <AnimatedCard delay={0.3}>
              <h3 className="text-lg font-semibold mb-4 text-green-600">Recent Conversations</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {conversations.map((conv, idx) => (
                  <motion.div
                    key={conv._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => setSelectedConversation(conv)}
                    className="medical-card cursor-pointer border-l-4 border-l-blue-600 hover:shadow-xl transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">💬</span>
                        <h4 className="text-lg font-bold text-black">
                          Appointment #{conv.appointmentId?.slice(-8) || conv._id.slice(-8)}
                        </h4>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-black">👨‍⚕️</span>
                        <span className="text-sm font-semibold text-black truncate">
                          {getDoctorName(conv.doctorId)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-black">👤</span>
                        <span className="text-sm font-semibold text-black truncate">
                          {getPatientName(conv.patientId)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-black">📅</span>
                        <span className="text-xs text-black">
                          {new Date(conv.startedAt || conv.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-blue-200">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 font-medium">
                          {conv.conversationType || "CONVERSATION"}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 border border-green-300 font-medium">
                          {conv.messages?.length || 0} messages
                        </span>
                        {conv.prescriptionId && (
                          <span className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 border border-green-300 font-medium">
                            Has Prescription
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-blue-600 mt-1">Click to view details →</p>
                    </div>
                  </motion.div>
                ))}
                {conversations.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <div className="text-4xl mb-3">💬</div>
                    <p className="text-sm text-black font-medium">No conversations found</p>
                  </div>
                )}
              </div>
            </AnimatedCard>
          )}
        </>
      )}
    </Layout>
  );
}

