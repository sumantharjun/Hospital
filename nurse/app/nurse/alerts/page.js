"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import NurseLayout from "../../components/NurseLayout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const AlertIcons = {
  CRITICAL_VITALS: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  MEDICATION_DUE: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  DISCHARGE_READY: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  CALL_BELL: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  LAB_RESULT: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  GENERAL: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const ALERT_TYPES = {
  CRITICAL_VITALS:  { label: "Critical Vitals",    color: "bg-red-100 text-red-700 border-red-200",          dot: "bg-red-500"    },
  MEDICATION_DUE:   { label: "Medication Due",      color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-400" },
  DISCHARGE_READY:  { label: "Discharge Ready",     color: "bg-green-100 text-green-700 border-green-200",    dot: "bg-green-400"  },
  CALL_BELL:        { label: "Call Bell",           color: "bg-blue-100 text-blue-700 border-blue-200",       dot: "bg-blue-400"   },
  LAB_RESULT:       { label: "Lab Result Ready",    color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-400" },
  GENERAL:          { label: "General Alert",       color: "bg-gray-100 text-slate-700 border-slate-200",       dot: "bg-gray-400"   },
};

const MOCK_ALERTS = [
  { _id: "1", type: "CRITICAL_VITALS", patientName: "Ravi Kumar", ipId: "IP-20260311-0001", room: "Room 201 / Bed A", message: "SpO2 dropped to 88% - immediate attention required", createdAt: new Date(Date.now() - 5 * 60000).toISOString(), acknowledged: false, priority: "HIGH" },
  { _id: "2", type: "MEDICATION_DUE",  patientName: "Priya Sharma", ipId: "IP-20260311-0002", room: "Room 305 / Bed B", message: "Amoxicillin 500mg due at 14:00 - not yet administered", createdAt: new Date(Date.now() - 15 * 60000).toISOString(), acknowledged: false, priority: "MEDIUM" },
  { _id: "3", type: "CALL_BELL",       patientName: "Mohammed Ali", ipId: "IP-20260310-0005", room: "Room 102 / Bed C", message: "Patient pressed call bell - assistance needed", createdAt: new Date(Date.now() - 2 * 60000).toISOString(), acknowledged: false, priority: "HIGH" },
  { _id: "4", type: "LAB_RESULT",      patientName: "Sunita Devi", ipId: "IP-20260309-0003", room: "Room 204 / Bed A", message: "CBC results available - please review and inform doctor", createdAt: new Date(Date.now() - 30 * 60000).toISOString(), acknowledged: true, priority: "LOW" },
  { _id: "5", type: "DISCHARGE_READY", patientName: "Arun Singh", ipId: "IP-20260308-0007", room: "Room 401 / Bed D", message: "Doctor has approved discharge - complete paperwork", createdAt: new Date(Date.now() - 60 * 60000).toISOString(), acknowledged: true, priority: "MEDIUM" },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("UNREAD");
  const [newAlertForm, setNewAlertForm] = useState({ type: "GENERAL", patientName: "", ipId: "", room: "", message: "" });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.replace("/"); return; }
    // Load from backend or use mock data
    loadAlerts();
  }, [router]);

  async function loadAlerts() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/nurse/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data : MOCK_ALERTS);
      } else {
        setAlerts(MOCK_ALERTS); // Fallback to mock
      }
    } catch (_) {
      setAlerts(MOCK_ALERTS); // Fallback to mock
    } finally {
      setLoading(false);
    }
  }

  function acknowledgeAlert(id) {
    setAlerts(a => a.map(al => al._id === id ? { ...al, acknowledged: true } : al));
    toast.success("Alert acknowledged");
  }

  function dismissAlert(id) {
    setAlerts(a => a.filter(al => al._id !== id));
    toast.success("Alert dismissed");
  }

  async function createAlert(e) {
    e.preventDefault();
    if (!newAlertForm.message.trim()) { toast.error("Message is required"); return; }
    const alert = {
      _id: Date.now().toString(),
      ...newAlertForm,
      acknowledged: false,
      priority: "MEDIUM",
      createdAt: new Date().toISOString(),
    };
    setAlerts(a => [alert, ...a]);
    setNewAlertForm({ type: "GENERAL", patientName: "", ipId: "", room: "", message: "" });
    setShowForm(false);
    toast.success("Alert created");
  }

  const filtered = alerts.filter(a => {
    if (filter === "UNREAD") return !a.acknowledged;
    if (filter === "READ") return a.acknowledged;
    return true;
  });

  const unreadCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <NurseLayout>
      <div className="nurse-page space-y-6">
        <div className="nurse-card p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Alerts & Notifications</h1>
              {unreadCount > 0 && (
                <span className="nurse-badge bg-red-500 text-white">{unreadCount} Unread</span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-2">Patient alerts, medication reminders, and emergency notifications</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="nurse-btn-primary px-4 py-2 text-sm font-medium">
            + Create Alert
          </button>
        </div>

        {/* Create Alert Form */}
        {showForm && (
          <form onSubmit={createAlert} className="nurse-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">Create New Alert</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Alert Type</label>
                <select value={newAlertForm.type} onChange={e => setNewAlertForm(f => ({ ...f, type: e.target.value }))}
                  className="nurse-input">
                  {Object.entries(ALERT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Patient Name</label>
                <input type="text" value={newAlertForm.patientName}
                  onChange={e => setNewAlertForm(f => ({ ...f, patientName: e.target.value }))}
                  placeholder="Patient name"
                  className="nurse-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">IP ID</label>
                <input type="text" value={newAlertForm.ipId}
                  onChange={e => setNewAlertForm(f => ({ ...f, ipId: e.target.value }))}
                  placeholder="IP-20260311-0001"
                  className="nurse-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Room / Bed</label>
                <input type="text" value={newAlertForm.room}
                  onChange={e => setNewAlertForm(f => ({ ...f, room: e.target.value }))}
                  placeholder="Room 201 / Bed A"
                  className="nurse-input" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Message <span className="text-red-500">*</span></label>
              <textarea value={newAlertForm.message} onChange={e => setNewAlertForm(f => ({ ...f, message: e.target.value }))}
                rows={2} placeholder="Describe the alert or situation..."
                className="nurse-input resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="nurse-btn-primary px-5 py-2 text-sm font-medium">
                Create Alert
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Filter Tabs */}
        <div className="nurse-card p-1.5 w-fit">
          {[
            { key: "UNREAD", label: `Unread (${unreadCount})` },
            { key: "READ", label: "Read" },
            { key: "ALL", label: "All" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === tab.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Alert List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading alerts...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 nurse-card border border-slate-200">
            <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm">No {filter.toLowerCase()} alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((alert) => {
              const cfg = ALERT_TYPES[alert.type] || ALERT_TYPES.GENERAL;
              return (
                <div key={alert._id}
                  className={`border rounded-xl p-4 transition-opacity nurse-card ${alert.acknowledged ? "opacity-60" : ""} ${cfg.color}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${alert.acknowledged ? "bg-gray-300" : cfg.dot}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold flex items-center gap-1.5">
                            {AlertIcons[alert.type] ? AlertIcons[alert.type]() : null}
                            {cfg.label}
                          </span>
                          {alert.priority === "HIGH" && !alert.acknowledged && (
                            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">URGENT</span>
                          )}
                        </div>
                        {alert.patientName && (
                          <div className="text-sm font-medium mt-0.5">
                            {alert.patientName}
                            {alert.ipId && <span className="font-mono text-xs ml-2 opacity-75">({alert.ipId})</span>}
                          </div>
                        )}
                        {alert.room && <div className="text-xs opacity-75">{alert.room}</div>}
                        <p className="text-sm mt-1">{alert.message}</p>
                        <div className="text-xs opacity-60 mt-1">{timeAgo(alert.createdAt)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!alert.acknowledged && (
                        <button onClick={() => acknowledgeAlert(alert._id)}
                          className="text-xs bg-white/70 hover:bg-white px-3 py-1.5 rounded-lg font-medium transition-colors border border-current/20">
                          Acknowledge
                        </button>
                      )}
                      <button onClick={() => dismissAlert(alert._id)}
                        className="text-xs bg-white/40 hover:bg-white/70 px-2 py-1.5 rounded-lg transition-colors">
                        x
                      </button>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {!alert.acknowledged && alert.type === "CRITICAL_VITALS" && alert.ipId && (
                    <div className="mt-3 pt-3 border-t border-current/10">
                      <button onClick={() => router.push(`/nurse/vitals?ipId=${alert.ipId}`)}
                        className="text-xs bg-white/70 hover:bg-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                        {"->"} Record Vitals Now
                      </button>
                    </div>
                  )}
                  {!alert.acknowledged && alert.type === "MEDICATION_DUE" && alert.ipId && (
                    <div className="mt-3 pt-3 border-t border-current/10">
                      <button onClick={() => router.push(`/nurse/medications?ipId=${alert.ipId}`)}
                        className="text-xs bg-white/70 hover:bg-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                        {"->"} Go to Medications
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </NurseLayout>
  );
}

