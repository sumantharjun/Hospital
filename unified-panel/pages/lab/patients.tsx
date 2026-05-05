import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

export default function LabPatientsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientOrders, setPatientOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchPatients();
  }, []);

  async function fetchPatients() {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/users?role=PATIENT"), { headers: getAuthHeaders() });
      const data = res.ok ? await res.json() : [];
      setPatients(Array.isArray(data) ? data : data.users || []);
    } catch {
      toast.error("Failed to load patients");
    } finally {
      setLoading(false);
    }
  }

  async function viewPatientOrders(patient: any) {
    setSelectedPatient(patient);
    setOrdersLoading(true);
    try {
      const id = patient._id || patient.id;
      const res = await fetch(buildApiUrl(`/api/lab/orders?patientId=${id}`), { headers: getAuthHeaders() });
      const data = res.ok ? await res.json() : [];
      setPatientOrders(Array.isArray(data) ? data : data.orders || []);
    } catch {
      toast.error("Failed to load patient orders");
      setPatientOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  const filtered = patients.filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(q) ||
      (p.phone || p.mobile || "").includes(q) ||
      (p._id || p.id || "").toLowerCase().includes(q)
    );
  });

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Lab Patients</h1>
            <p className="mt-1 text-sm text-zinc-500">Browse patients and view their lab order history.</p>
          </div>
          <button onClick={fetchPatients} className="px-4 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Refresh
          </button>
        </div>

        <div className="medical-card p-4">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone or patient ID…" className="medical-input w-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="medical-card overflow-hidden">
            <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900">Patients</h2>
              <span className="text-sm text-zinc-500">{filtered.length}</span>
            </div>
            {loading ? (
              <div className="p-8 text-center text-zinc-500">Loading patients…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">No patients found.</div>
            ) : (
              <div className="divide-y divide-zinc-100 max-h-[500px] overflow-y-auto">
                {filtered.map((p: any) => (
                  <div
                    key={p._id || p.id}
                    onClick={() => viewPatientOrders(p)}
                    className={`p-4 cursor-pointer hover:bg-zinc-50 transition-colors ${selectedPatient?._id === p._id ? "bg-blue-50 border-l-4 border-blue-600" : ""}`}
                  >
                    <p className="font-medium text-zinc-900">{p.name}</p>
                    <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                      {(p.phone || p.mobile) && <span>{p.phone || p.mobile}</span>}
                      {p.age && <span>Age: {p.age}</span>}
                      {p.gender && <span>{p.gender}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="medical-card overflow-hidden">
            <div className="p-4 border-b border-zinc-200 bg-zinc-50">
              <h2 className="font-semibold text-zinc-900">
                {selectedPatient ? `Orders — ${selectedPatient.name}` : "Select a patient to view orders"}
              </h2>
            </div>
            {!selectedPatient ? (
              <div className="p-8 text-center text-zinc-500">Click a patient on the left to view their lab orders.</div>
            ) : ordersLoading ? (
              <div className="p-8 text-center text-zinc-500">Loading orders…</div>
            ) : patientOrders.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">No lab orders found for this patient.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      {["Test", "Status", "Ordered", "Result"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {patientOrders.map((o: any) => (
                      <tr key={o._id || o.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900">{o.testName || o.test?.name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            (o.status || "").toUpperCase() === "COMPLETED" ? "bg-green-100 text-green-700" :
                            (o.status || "").toUpperCase() === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                            "bg-zinc-100 text-zinc-700"
                          }`}>{o.status || "PENDING"}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                        <td className="px-4 py-3 text-zinc-600 text-xs max-w-[120px] truncate">{o.result || o.resultSummary || "Awaiting"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
