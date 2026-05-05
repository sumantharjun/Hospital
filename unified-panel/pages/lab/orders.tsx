import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

function todayStr() { return new Date().toISOString().slice(0, 10); }

const STATUS_COLORS: any = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function LabOrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patientId: "", testId: "", priority: "NORMAL", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams({ from: date, to: date });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const [ordersRes, testsRes, patientsRes] = await Promise.all([
        fetch(buildApiUrl(`/api/lab/orders?${params}`), { headers }),
        fetch(buildApiUrl("/api/lab/tests"), { headers }).catch(() => ({ ok: false } as any)),
        fetch(buildApiUrl("/api/users?role=PATIENT"), { headers }).catch(() => ({ ok: false } as any)),
      ]);
      const ordersData = ordersRes.ok ? await ordersRes.json() : [];
      const testsData = (testsRes as any).ok ? await (testsRes as any).json() : [];
      const patientsData = (patientsRes as any).ok ? await (patientsRes as any).json() : [];
      setOrders(Array.isArray(ordersData) ? ordersData : ordersData.orders || []);
      setTests(Array.isArray(testsData) ? testsData : testsData.tests || []);
      setPatients(Array.isArray(patientsData) ? patientsData : patientsData.users || []);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.testId) { toast.error("Patient and test are required"); return; }
    setSaving(true);
    try {
      const test = tests.find((t: any) => (t._id || t.id) === form.testId);
      const patient = patients.find((p: any) => (p._id || p.id) === form.patientId);
      const res = await fetch(buildApiUrl("/api/lab/orders"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          testId: form.testId,
          patientName: patient?.name || "",
          testName: test?.name || "",
          priority: form.priority,
          notes: form.notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to create order");
      toast.success("Lab order created");
      setShowForm(false);
      setForm({ patientId: "", testId: "", priority: "NORMAL", notes: "" });
      fetchAll();
    } catch (e: any) {
      toast.error(e.message || "Failed to create order");
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder(orderId: string) {
    if (!confirm("Cancel this order?")) return;
    try {
      const res = await fetch(buildApiUrl(`/api/lab/orders/${orderId}`), {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to cancel");
      toast.success("Order cancelled");
      fetchAll();
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel order");
    }
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Lab Orders</h1>
            <p className="mt-1 text-sm text-zinc-500">Create and manage lab test orders.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAll} className="px-4 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">Refresh</button>
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">
              {showForm ? "Cancel" : "+ New Order"}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={createOrder} className="medical-card p-6 space-y-4">
            <h2 className="font-semibold text-zinc-900">Create Lab Order</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Patient *</label>
                <select value={form.patientId} onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))} className="medical-input w-full" required>
                  <option value="">Select patient</option>
                  {patients.map((p: any) => (
                    <option key={p._id || p.id} value={p._id || p.id}>{p.name}{p.phone ? ` — ${p.phone}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Test *</label>
                <select value={form.testId} onChange={(e) => setForm((f) => ({ ...f, testId: e.target.value }))} className="medical-input w-full" required>
                  <option value="">Select test</option>
                  {tests.map((t: any) => (
                    <option key={t._id || t.id} value={t._id || t.id}>{t.name}{t.price ? ` — ₹${t.price}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Priority</label>
                <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="medical-input w-full">
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgent</option>
                  <option value="STAT">STAT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="medical-input w-full" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="medical-btn-primary px-5 py-2 disabled:opacity-50">{saving ? "Creating…" : "Create Order"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
            </div>
          </form>
        )}

        <div className="medical-card p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="medical-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="medical-input">
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <button onClick={fetchAll} className="medical-btn-primary px-4 py-2 text-sm">Apply</button>
        </div>

        <div className="medical-card overflow-hidden">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Orders on {date}</h2>
            <span className="text-sm text-zinc-500">{orders.length} order(s)</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No orders found for the selected date.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    {["Order ID", "Patient", "Test", "Priority", "Status", "Time", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.map((o: any) => (
                    <tr key={o._id || o.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{(o.orderId || o._id || "").slice(-8)}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{o.patientName || o.patient?.name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-700">{o.testName || o.test?.name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${o.priority === "URGENT" || o.priority === "STAT" ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-700"}`}>
                          {o.priority || "NORMAL"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[(o.status || "PENDING").toUpperCase()] || "bg-zinc-100 text-zinc-700"}`}>
                          {o.status || "PENDING"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{o.createdAt ? new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-4 py-3">
                        {(o.status || "").toUpperCase() === "PENDING" && (
                          <button onClick={() => cancelOrder(o._id || o.id)} className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100">
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
