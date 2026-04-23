import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:       "bg-blue-100 text-blue-700 border border-blue-200",
  ADMINISTERED:  "bg-green-100 text-green-700 border border-green-200",
  SKIPPED:       "bg-yellow-100 text-yellow-700 border border-yellow-200",
  REFUSED:       "bg-orange-100 text-orange-700 border border-orange-200",
  CANCELLED:     "bg-red-100 text-red-700 border border-red-200",
};

interface Medication {
  _id: string;
  ipId: string;
  drugName: string;
  dosage: string;
  route: string;
  frequency: string;
  scheduledTime?: string;
  status: string;
  notes?: string;
  orderedBy?: { name: string };
  administeredBy?: { name: string };
  administeredAt?: string;
  createdAt: string;
}

interface IpAdmission {
  _id: string;
  ipId: string;
  patientName?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function MedicationsOverviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [admissions, setAdmissions] = useState<IpAdmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterIpId, setFilterIpId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!token || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterIpId) params.set("ipId", filterIpId);

      const [mRes, admRes] = await Promise.all([
        fetch(`${API}/api/medications?${params}`, { headers: authHeader() }),
        fetch(`${API}/api/ip-admissions?status=ACTIVE&limit=100`, { headers: authHeader() }),
      ]);
      if (mRes.ok) setMedications(await mRes.json());
      if (admRes.ok) {
        const data = await admRes.json();
        setAdmissions(Array.isArray(data) ? data : data.admissions || []);
      }
    } catch {
      toast.error("Failed to load medications");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterIpId]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const getPatientName = (ipId: string) => {
    const adm = admissions.find((a) => a.ipId === ipId);
    return adm?.patientName || ipId;
  };

  const filteredMeds = medications.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.drugName.toLowerCase().includes(q) ||
      m.ipId.toLowerCase().includes(q) ||
      getPatientName(m.ipId).toLowerCase().includes(q)
    );
  });

  const statuses = ["ALL", "PENDING", "ADMINISTERED", "SKIPPED", "REFUSED", "CANCELLED"];
  const counts = statuses.reduce((acc, s) => {
    acc[s] = s === "ALL" ? medications.length : medications.filter((m) => m.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  if (!user) return null;

  return (
    <Layout user={user} currentPage="Medications">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Medications Overview</h1>
            <p className="text-sm text-gray-500 mt-0.5">All medication orders across IP admissions</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
            >
              {s} <span className="ml-1 font-bold">{counts[s]}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end shadow-sm">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search Drug / Patient</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Patient</label>
            <select
              value={filterIpId}
              onChange={(e) => setFilterIpId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Patients</option>
              {admissions.map((a) => (
                <option key={a._id} value={a.ipId}>{a.ipId} — {a.patientName || "Patient"}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">Loading medications...</div>
        ) : filteredMeds.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-gray-500">No medications found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Status", "Patient", "IP ID", "Drug", "Dosage", "Route", "Frequency", "Scheduled", "Ordered By", "Administered By", "Ordered At"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMeds.map((m) => (
                  <tr key={m._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[m.status] || "bg-gray-100 text-gray-700"}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{getPatientName(m.ipId)}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{m.ipId}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{m.drugName}</td>
                    <td className="px-4 py-3 text-gray-700">{m.dosage}</td>
                    <td className="px-4 py-3 text-gray-700">{m.route}</td>
                    <td className="px-4 py-3 text-gray-700">{m.frequency}</td>
                    <td className="px-4 py-3 text-gray-600">{m.scheduledTime || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{m.orderedBy?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{m.administeredBy?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
