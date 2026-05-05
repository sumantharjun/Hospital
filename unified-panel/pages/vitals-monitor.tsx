import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function badgeColor(level: string) {
  if (level === "critical") return "bg-red-100 text-red-700 border border-red-300";
  if (level === "warning") return "bg-yellow-100 text-yellow-700 border border-yellow-300";
  return "bg-green-100 text-green-700 border border-green-300";
}

function alertLevel(key: string, val: number | string | undefined) {
  if (val === undefined || val === "") return "normal";
  const n = Number(val);
  if (key === "spo2") return n < 90 ? "critical" : n < 95 ? "warning" : "normal";
  if (key === "pulse") return n < 50 || n > 120 ? "critical" : n < 60 || n > 100 ? "warning" : "normal";
  if (key === "temperature") return n < 35 || n > 39.5 ? "critical" : n > 37.5 ? "warning" : "normal";
  if (key === "respiratoryRate") return n < 10 || n > 30 ? "critical" : n < 12 || n > 20 ? "warning" : "normal";
  if (key === "bloodSugar") return n < 70 || n > 400 ? "critical" : n < 80 || n > 250 ? "warning" : "normal";
  if (key === "pain") return n >= 8 ? "critical" : n >= 5 ? "warning" : "normal";
  return "normal";
}

interface VitalsRecord {
  _id: string;
  ipId: string;
  temperature?: number;
  pulse?: number;
  respiratoryRate?: number;
  bloodPressure?: string;
  spo2?: number;
  weight?: number;
  bloodSugar?: number;
  pain?: number;
  notes?: string;
  recordedAt: string;
  recordedBy?: { name: string };
}

interface IpAdmission {
  _id: string;
  ipId: string;
  patientName?: string;
  bedNumber?: string;
  roomNumber?: string;
  status?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function VitalsMonitorPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [vitals, setVitals] = useState<VitalsRecord[]>([]);
  const [admissions, setAdmissions] = useState<IpAdmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIpId, setSelectedIpId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<"all" | "critical" | "warning">("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!token || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, admRes] = await Promise.all([
        fetch(`${API}/api/vitals?limit=200${selectedIpId ? `&ipId=${selectedIpId}` : ""}`, { headers: authHeader() }),
        fetch(`${API}/api/ip-admissions?status=ACTIVE&limit=100`, { headers: authHeader() }),
      ]);
      if (vRes.ok) setVitals(await vRes.json());
      if (admRes.ok) {
        const data = await admRes.json();
        setAdmissions(Array.isArray(data) ? data : data.admissions || []);
      }
    } catch {
      toast.error("Failed to load vitals data");
    } finally {
      setLoading(false);
    }
  }, [selectedIpId]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const getPatientName = (ipId: string) => {
    const adm = admissions.find((a) => a.ipId === ipId);
    return adm?.patientName || ipId;
  };

  const getRecordLevel = (v: VitalsRecord) => {
    const levels = [
      alertLevel("spo2", v.spo2),
      alertLevel("pulse", v.pulse),
      alertLevel("temperature", v.temperature),
      alertLevel("respiratoryRate", v.respiratoryRate),
      alertLevel("bloodSugar", v.bloodSugar),
      alertLevel("pain", v.pain),
    ];
    if (levels.includes("critical")) return "critical";
    if (levels.includes("warning")) return "warning";
    return "normal";
  };

  const filteredVitals = vitals.filter((v) => {
    const level = getRecordLevel(v);
    if (filterLevel !== "all" && level !== filterLevel) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return v.ipId.toLowerCase().includes(q) || getPatientName(v.ipId).toLowerCase().includes(q);
    }
    return true;
  });

  const criticalCount = vitals.filter((v) => getRecordLevel(v) === "critical").length;
  const warningCount = vitals.filter((v) => getRecordLevel(v) === "warning").length;

  if (!user) return null;

  return (
    <Layout user={user} currentPage="Vitals Monitor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vitals Monitor</h1>
            <p className="text-sm text-gray-500 mt-0.5">Real-time patient vitals across all IP admissions</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Records", value: vitals.length, color: "blue" },
            { label: "Critical", value: criticalCount, color: "red" },
            { label: "Warning", value: warningCount, color: "yellow" },
            { label: "Normal", value: vitals.length - criticalCount - warningCount, color: "green" },
          ].map((stat) => (
            <div key={stat.label} className={`bg-white rounded-xl border-l-4 ${stat.color === "red" ? "border-red-500" : stat.color === "yellow" ? "border-yellow-500" : stat.color === "green" ? "border-green-500" : "border-blue-500"} p-4 shadow-sm`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
              <p className={`text-3xl font-bold mt-1 ${stat.color === "red" ? "text-red-600" : stat.color === "yellow" ? "text-yellow-600" : stat.color === "green" ? "text-green-600" : "text-blue-600"}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end shadow-sm">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search Patient / IP ID</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter by IP ID</label>
            <select
              value={selectedIpId}
              onChange={(e) => setSelectedIpId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Patients</option>
              {admissions.map((a) => (
                <option key={a._id} value={a.ipId}>{a.ipId} — {a.patientName || "Patient"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Alert Level</label>
            <div className="flex gap-2">
              {(["all", "critical", "warning"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setFilterLevel(level)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition ${filterLevel === level ? (level === "critical" ? "bg-red-600 text-white" : level === "warning" ? "bg-yellow-500 text-white" : "bg-blue-600 text-white") : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">Loading vitals...</div>
        ) : filteredVitals.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <p className="text-gray-500">No vitals records found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Status", "Patient", "IP ID", "Temp (°C)", "Pulse", "Resp Rate", "BP", "SpO₂ %", "Blood Sugar", "Pain", "Recorded By", "Time"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVitals.map((v) => {
                  const level = getRecordLevel(v);
                  return (
                    <tr key={v._id} className={level === "critical" ? "bg-red-50" : level === "warning" ? "bg-yellow-50" : ""}>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${badgeColor(level)}`}>{level}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{getPatientName(v.ipId)}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{v.ipId}</td>
                      <td className={`px-4 py-3 font-semibold ${alertLevel("temperature", v.temperature) === "critical" ? "text-red-600" : alertLevel("temperature", v.temperature) === "warning" ? "text-yellow-600" : "text-gray-800"}`}>
                        {v.temperature ?? "—"}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${alertLevel("pulse", v.pulse) === "critical" ? "text-red-600" : alertLevel("pulse", v.pulse) === "warning" ? "text-yellow-600" : "text-gray-800"}`}>
                        {v.pulse ?? "—"}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${alertLevel("respiratoryRate", v.respiratoryRate) === "critical" ? "text-red-600" : alertLevel("respiratoryRate", v.respiratoryRate) === "warning" ? "text-yellow-600" : "text-gray-800"}`}>
                        {v.respiratoryRate ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800">{v.bloodPressure ?? "—"}</td>
                      <td className={`px-4 py-3 font-semibold ${alertLevel("spo2", v.spo2) === "critical" ? "text-red-600" : alertLevel("spo2", v.spo2) === "warning" ? "text-yellow-600" : "text-gray-800"}`}>
                        {v.spo2 ?? "—"}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${alertLevel("bloodSugar", v.bloodSugar) === "critical" ? "text-red-600" : alertLevel("bloodSugar", v.bloodSugar) === "warning" ? "text-yellow-600" : "text-gray-800"}`}>
                        {v.bloodSugar ?? "—"}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${alertLevel("pain", v.pain) === "critical" ? "text-red-600" : alertLevel("pain", v.pain) === "warning" ? "text-yellow-600" : "text-gray-800"}`}>
                        {v.pain !== undefined ? `${v.pain}/10` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{v.recordedBy?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(v.recordedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
