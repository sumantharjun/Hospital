import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { deliveryAgentsApi } from "@/services/api";
import { getUser } from "@/utils/auth";
import { DeliveryAgent } from "@/types";
import { AGENT_STATUSES } from "@/utils/constants";

export default function DeliveryAgentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "AVAILABLE" | "BUSY" | "OFFLINE">("all");

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    loadAgents();
  }, [router]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await deliveryAgentsApi.getAll();
      setAgents(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load delivery agents");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (agentId: string, newStatus: string) => {
    try {
      await deliveryAgentsApi.updateStatus(agentId, newStatus);
      toast.success("Agent status updated successfully!");
      loadAgents();
    } catch (error: any) {
      toast.error(error.message || "Failed to update agent status");
    }
  };

  if (!user) return null;

  const filteredAgents =
    statusFilter === "all"
      ? agents
      : agents.filter((agent) => agent.status === statusFilter);

  const availableCount = agents.filter((a) => a.status === "AVAILABLE").length;
  const busyCount = agents.filter((a) => a.status === "BUSY").length;

  return (
    <Layout user={user} currentPage="delivery-agents">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Delivery Agents</h1>
            <p className="text-gray-600">Manage and track delivery agents</p>
          </div>
          <button
            onClick={loadAgents}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Agents</span>
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{agents.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Available</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{availableCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Busy</span>
              <span className="text-2xl">🚚</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{busyCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                statusFilter === "all"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {Object.keys(AGENT_STATUSES).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === status
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {AGENT_STATUSES[status].label}
              </button>
            ))}
          </div>
        </div>

        {/* Agents List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No delivery agents found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <motion.div
                key={agent._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-md border border-gray-100 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{agent.name}</h3>
                    <p className="text-sm text-gray-500">{agent.phone}</p>
                    {agent.email && <p className="text-sm text-gray-500">{agent.email}</p>}
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      AGENT_STATUSES[agent.status]?.color || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {AGENT_STATUSES[agent.status]?.label || agent.status}
                  </span>
                </div>

                {agent.currentOrderId && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900">Current Order:</p>
                    <p className="text-xs text-blue-700 font-mono">
                      #{agent.currentOrderId.slice(-8)}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  {agent.status !== "AVAILABLE" && (
                    <button
                      onClick={() => handleStatusUpdate(agent._id, "AVAILABLE")}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm"
                    >
                      Set Available
                    </button>
                  )}
                  {agent.status !== "BUSY" && (
                    <button
                      onClick={() => handleStatusUpdate(agent._id, "BUSY")}
                      className="flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-all text-sm"
                    >
                      Set Busy
                    </button>
                  )}
                  {agent.status !== "OFFLINE" && (
                    <button
                      onClick={() => handleStatusUpdate(agent._id, "OFFLINE")}
                      className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all text-sm"
                    >
                      Set Offline
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

