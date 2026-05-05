import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function UserInteractionsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalInteractions: 0,
    todayInteractions: 0,
    activeUsers: 0,
    avgSessionTime: 0,
  });
  const [filterType, setFilterType] = useState<"all" | "login" | "action" | "error">("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("today");

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
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        
        // Fetch activities/logs as interactions
        const activitiesRes = await fetch(`${API_BASE}/api/activities?limit=100`, { headers });
        
        if (!activitiesRes.ok) {
          const errorData = await activitiesRes.json().catch(() => ({ message: "Failed to fetch activities" }));
          throw new Error(errorData.message || `HTTP ${activitiesRes.status}`);
        }
        
        const activities = await activitiesRes.json();
        const activitiesArray = Array.isArray(activities) ? activities : [];
        
        // Process interactions
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
        
        // Calculate stats
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
          avgSessionTime: 0, // Would need session data
        });
      } catch (e: any) {
        // Handle connection errors gracefully
        if (e.message?.includes("Failed to fetch") || e.message?.includes("ERR_CONNECTION_REFUSED")) {
          // Backend might not be running - only show error on initial load
          if (loading) {
            console.warn("Cannot connect to backend server for user interactions");
            setInteractions([]);
            setStats({
              totalInteractions: 0,
              todayInteractions: 0,
              activeUsers: 0,
              avgSessionTime: 0,
            });
          }
        } else {
          console.error("Error fetching user interactions:", e);
          toast.error(e.message || "Failed to fetch user interactions");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, dateRange]);

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

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case "login":
        return "🔐";
      case "action":
        return "⚡";
      case "error":
        return "⚠️";
      default:
        return "📝";
    }
  };

  const getInteractionColor = (type: string) => {
    switch (type) {
      case "login":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "action":
        return "bg-green-50 border-green-200 text-green-700";
      case "error":
        return "bg-red-50 border-red-200 text-red-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="user-interactions">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-black">
              User Interaction Dashboard
            </h2>
            <p className="text-sm text-gray-600">
              Monitor and analyze user interactions, activities, and system events
            </p>
          </div>
        </div>
      </motion.header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AnimatedCard delay={0.1}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Interactions</p>
              <p className="text-2xl font-bold text-black">{stats.totalInteractions}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.2}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Today's Interactions</p>
              <p className="text-2xl font-bold text-green-600">{stats.todayInteractions}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <span className="text-2xl">📈</span>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.3}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Users</p>
              <p className="text-2xl font-bold text-black">{stats.activeUsers}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.4}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Session Time</p>
              <p className="text-2xl font-bold text-black">{stats.avgSessionTime}m</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <span className="text-2xl">⏱️</span>
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Filters */}
      <AnimatedCard delay={0.5} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2 flex-wrap">
            <motion.button
              onClick={() => setFilterType("all")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterType === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Types
            </motion.button>
            <motion.button
              onClick={() => setFilterType("login")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterType === "login"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              🔐 Logins
            </motion.button>
            <motion.button
              onClick={() => setFilterType("action")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterType === "action"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              ⚡ Actions
            </motion.button>
            <motion.button
              onClick={() => setFilterType("error")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterType === "error"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              ⚠️ Errors
            </motion.button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <motion.button
              onClick={() => setDateRange("today")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                dateRange === "today"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Today
            </motion.button>
            <motion.button
              onClick={() => setDateRange("week")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                dateRange === "week"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              This Week
            </motion.button>
            <motion.button
              onClick={() => setDateRange("month")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                dateRange === "month"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              This Month
            </motion.button>
            <motion.button
              onClick={() => setDateRange("all")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                dateRange === "all"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Time
            </motion.button>
          </div>
        </div>
      </AnimatedCard>

      {/* Interactions List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <AnimatedCard delay={0.6}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-black">Recent Interactions</h3>
            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {filteredInteractions.length} {filteredInteractions.length === 1 ? "interaction" : "interactions"}
            </span>
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
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/50">
                          {interaction.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{interaction.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
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
              <p className="text-sm text-gray-600 font-medium">No interactions found</p>
              <p className="text-xs text-gray-500 mt-1">
                {filterType !== "all" || dateRange !== "all"
                  ? "Try adjusting your filters"
                  : "Interactions will appear here as they occur"}
              </p>
            </div>
          )}
        </AnimatedCard>
      )}
    </Layout>
  );
}

