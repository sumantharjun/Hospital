import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH:   "bg-red-100 text-red-700 border border-red-300",
  MEDIUM: "bg-yellow-100 text-yellow-700 border border-yellow-300",
  LOW:    "bg-blue-100 text-blue-700 border border-blue-300",
};

const TYPE_LABELS: Record<string, string> = {
  CRITICAL_VITALS: "Critical Vitals",
  MEDICATION_DUE:  "Medication Due",
  DISCHARGE_READY: "Discharge Ready",
  CALL_BELL:       "Call Bell",
  LAB_RESULT:      "Lab Result",
  GENERAL:         "General",
};

interface NurseAlert {
  _id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  isRead: boolean;
  isAcknowledged: boolean;
  ipId?: string;
  nurseId?: { name: string };
  createdBy?: { name: string };
  acknowledgedBy?: { name: string };
  acknowledgedAt?: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function NurseAlertsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [alerts, setAlerts] = useState<NurseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!token || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
  }, [router]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPriority !== "ALL") params.set("priority", filterPriority);
      if (filterType !== "ALL") params.set("type", filterType);
      if (showUnreadOnly) params.set("isRead", "false");
      const res = await fetch(`${API}/api/nurse/alerts?${params}`, { headers: authHeader() });
      if (res.ok) setAlerts(await res.json());
      else toast.error("Failed to load alerts");
    } catch {
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [filterPriority, filterType, showUnreadOnly]);

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user, fetchAlerts]);

  const acknowledge = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/nurse/alerts/${id}/acknowledge`, {
        method: "PATCH",
        headers: authHeader(),
      });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => a._id === id ? { ...a, isAcknowledged: true, isRead: true } : a));
        toast.success("Alert acknowledged");
      }
    } catch {
      toast.error("Failed to acknowledge");
    }
  };

  const unreadCount = alerts.filter((a) => !a.isRead).length;
  const criticalCount = alerts.filter((a) => a.priority === "HIGH").length;

  if (!user) return null;

  return (
    <Layout user={user} currentPage="Nurse Alerts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nurse Alerts</h1>
            <p className="text-sm text-gray-500 mt-0.5">System alerts from nursing staff across all wards</p>
          </div>
          <div className="flex gap-3">
            {unreadCount > 0 && (
              <span className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3a1 1 0 001 1h.01a1 1 0 100-2H11V7z" clipRule="evenodd" /></svg>
                {unreadCount} Unread
              </span>
            )}
            <button onClick={fetchAlerts} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Alerts", value: alerts.length, color: "blue" },
            { label: "Unread", value: unreadCount, color: "orange" },
            { label: "Critical (HIGH)", value: criticalCount, color: "red" },
            { label: "Acknowledged", value: alerts.filter((a) => a.isAcknowledged).length, color: "green" },
          ].map((stat) => (
            <div key={stat.label} className={`bg-white rounded-xl border-l-4 ${stat.color === "red" ? "border-red-500" : stat.color === "orange" ? "border-orange-500" : stat.color === "green" ? "border-green-500" : "border-blue-500"} p-4 shadow-sm`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
              <p className={`text-3xl font-bold mt-1 ${stat.color === "red" ? "text-red-600" : stat.color === "orange" ? "text-orange-600" : stat.color === "green" ? "text-green-600" : "text-blue-600"}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end shadow-sm">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="ALL">All Priorities</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="ALL">All Types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="unreadOnly"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600"
            />
            <label htmlFor="unreadOnly" className="text-sm text-gray-700">Unread only</label>
          </div>
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <p className="text-gray-500">No alerts found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert._id}
                className={`bg-white rounded-xl border shadow-sm p-4 ${!alert.isRead ? "border-l-4 border-l-blue-500 border-t border-r border-b border-gray-200" : "border-gray-200"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${PRIORITY_COLORS[alert.priority] || "bg-gray-100 text-gray-700"}`}>
                        {alert.priority}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                        {TYPE_LABELS[alert.type] || alert.type}
                      </span>
                      {!alert.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full" title="Unread" />}
                      {alert.isAcknowledged && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Acknowledged</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                    <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                      {alert.ipId && <span>IP: <span className="font-mono font-medium">{alert.ipId}</span></span>}
                      {alert.nurseId && <span>Nurse: {alert.nurseId.name}</span>}
                      {alert.acknowledgedBy && <span>Ack by: {alert.acknowledgedBy.name}</span>}
                      <span>{new Date(alert.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                  </div>
                  {!alert.isAcknowledged && (
                    <button
                      onClick={() => acknowledge(alert._id)}
                      className="shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition font-medium"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
