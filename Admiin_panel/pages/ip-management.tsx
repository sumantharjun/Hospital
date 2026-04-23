import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const statusColors: Record<string, string> = {
  ADMITTED: "bg-blue-100 text-blue-800",
  UNDER_OBSERVATION: "bg-yellow-100 text-yellow-800",
  READY_FOR_DISCHARGE: "bg-orange-100 text-orange-800",
  DISCHARGED: "bg-green-100 text-green-800",
};

export default function IPManagementPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [bill, setBill] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [addChargeModal, setAddChargeModal] = useState(false);
  const [chargeForm, setChargeForm] = useState({ description: "", category: "OTHER", unitPrice: 0, quantity: 1 });
  const [savingCharge, setSavingCharge] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.replace("/"); return; }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    fetchAdmissions();
  }, [token, statusFilter]);

  const fetchAdmissions = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/ip-admissions?`;
      if (statusFilter) url += `status=${statusFilter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      setAdmissions(res.ok ? await res.json() : []);
    } catch { toast.error("Failed to load admissions"); }
    finally { setLoading(false); }
  };

  const openDetail = async (ipId: string) => {
    setLoadingDetail(true);
    setBill(null);
    try {
      const res = await fetch(`${API_BASE}/api/ip-admissions/by-ip-id/${ipId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : null;
      if (data) { setSelected(data.admission); setBill(data.bill); }
    } catch { toast.error("Failed to load details"); }
    finally { setLoadingDetail(false); }
  };

  const addCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill) return;
    setSavingCharge(true);
    try {
      const total = chargeForm.unitPrice * chargeForm.quantity;
      const res = await fetch(`${API_BASE}/api/bills/${bill._id}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lineItems: [{ ...chargeForm, taxPercent: 0, taxAmount: 0, total }] }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Charge added");
      const updated = await res.json();
      setBill(updated);
      setAddChargeModal(false);
      setChargeForm({ description: "", category: "OTHER", unitPrice: 0, quantity: 1 });
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingCharge(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/ip-admissions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Status updated");
      fetchAdmissions();
      if (selected?._id === id) setSelected((p: any) => ({ ...p, status }));
    } catch (err: any) { toast.error(err.message); }
  };

  const filtered = admissions.filter(a => {
    const name = a.patientId?.name?.toLowerCase() || "";
    const ipId = a.ipId?.toLowerCase() || "";
    return name.includes(search.toLowerCase()) || ipId.includes(search.toLowerCase());
  });

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">IP (In-Patient) Management</h1>

        <div className="flex flex-wrap gap-3 mb-4">
          <input type="text" placeholder="Search by name or IP ID..." className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="ADMITTED">Admitted</option>
            <option value="UNDER_OBSERVATION">Under Observation</option>
            <option value="READY_FOR_DISCHARGE">Ready for Discharge</option>
            <option value="DISCHARGED">Discharged</option>
          </select>
        </div>

        <div className="flex gap-4">
          {/* List */}
          <div className="flex-1 min-w-0">
            {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
              <div className="space-y-2">
                {filtered.length === 0 && <div className="text-center py-12 text-gray-400">No IP admissions found.</div>}
                {filtered.map(a => (
                  <motion.div key={a._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={() => openDetail(a.ipId)}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${selected?.ipId === a.ipId ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">{a.patientId?.name || "Unknown"}</span>
                        <span className="ml-2 text-xs text-gray-500 font-mono">{a.ipId}</span>
                        {(a.emergencyFlag || a.casualtyFlag) && (
                          <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">EMERGENCY</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[a.status] || "bg-gray-100"}`}>{a.status}</span>
                        <select className="text-xs border border-gray-200 rounded px-2 py-1" value={a.status}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); updateStatus(a._id, e.target.value); }}>
                          <option value="ADMITTED">Admitted</option>
                          <option value="UNDER_OBSERVATION">Under Observation</option>
                          <option value="READY_FOR_DISCHARGE">Ready for Discharge</option>
                          <option value="DISCHARGED">Discharged</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex gap-4">
                      <span>Doctor: {a.doctorId?.name || "—"}</span>
                      <span>Room: {a.roomId?.roomNumber || "—"}, Bed: {a.bedId?.bedNumber || "—"}</span>
                      <span>Admitted: {a.admissionDate ? new Date(a.admissionDate).toLocaleDateString() : "—"}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-96 flex-shrink-0">
              <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-4">
                {loadingDetail ? <div className="text-center py-8 text-gray-400">Loading...</div> : (
                  <>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-gray-900">Patient Details</h3>
                      <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">IP ID</span><span className="font-mono font-medium">{selected.ipId}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Patient</span><span>{selected.patientId?.name}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{selected.patientId?.phone || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Gender/Age</span><span>{selected.patientId?.gender || "—"} / {selected.patientId?.age || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Doctor</span><span>{selected.doctorId?.name}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Room</span><span>{selected.roomId?.roomNumber} (Floor {selected.roomId?.floor})</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Bed</span><span>{selected.bedId?.bedNumber}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Admitted</span><span>{selected.admissionDate ? new Date(selected.admissionDate).toLocaleString() : "—"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Expected Days</span><span>{selected.expectedDays}</span></div>
                    </div>

                    {bill && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-sm">Bill Summary</h4>
                          <button onClick={() => setAddChargeModal(true)} className="text-xs text-blue-600 hover:underline">+ Add Charge</button>
                        </div>
                        <div className="space-y-1 text-xs">
                          {bill.lineItems?.map((li: any, i: number) => (
                            <div key={i} className="flex justify-between text-gray-600">
                              <span>{li.description}</span>
                              <span>₹{li.total}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-sm">
                          <div className="flex justify-between"><span>Subtotal</span><span>₹{bill.subtotal}</span></div>
                          {bill.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{bill.discountAmount}</span></div>}
                          <div className="flex justify-between font-bold"><span>Total</span><span>₹{bill.grandTotal}</span></div>
                          <div className="flex justify-between text-green-600"><span>Paid</span><span>₹{bill.paidAmount}</span></div>
                          <div className="flex justify-between text-red-600 font-medium"><span>Outstanding</span><span>₹{bill.outstandingBalance}</span></div>
                        </div>
                        <div className="mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${bill.isFrozen ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {bill.isFrozen ? "FROZEN (Pre-discharge)" : "ACTIVE"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                      <button onClick={() => router.push(`/discharge?ipId=${selected.ipId}`)}
                        className="flex-1 bg-orange-500 text-white text-xs py-2 rounded-lg font-medium">
                        Initiate Discharge
                      </button>
                      <button onClick={() => router.push(`/certificates?ipId=${selected.ipId}&patientId=${selected.patientId?._id}`)}
                        className="flex-1 border border-gray-300 text-gray-700 text-xs py-2 rounded-lg font-medium">
                        Certificate
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add Charge Modal */}
        {addChargeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h2 className="text-lg font-bold mb-4">Add Charge</h2>
              <form onSubmit={addCharge} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Description *</label>
                  <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={chargeForm.description} onChange={e => setChargeForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Category</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={chargeForm.category} onChange={e => setChargeForm(p => ({ ...p, category: e.target.value }))}>
                    {["DOCTOR_CONSULTATION","ROOM_RENT","BED_CHARGE","LAB","PHARMACY","PROCEDURE","SERVICE","EMERGENCY","OTHER"].map(c => (
                      <option key={c} value={c}>{c.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Unit Price (₹)</label>
                    <input type="number" min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={chargeForm.unitPrice} onChange={e => setChargeForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Quantity</label>
                    <input type="number" min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={chargeForm.quantity} onChange={e => setChargeForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="text-sm text-gray-600">Total: <strong>₹{chargeForm.unitPrice * chargeForm.quantity}</strong></div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setAddChargeModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
                  <button type="submit" disabled={savingCharge} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">
                    {savingCharge ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
