import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function LabBillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [payMode, setPayMode] = useState("CASH");
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchBills();
  }, []);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(`/api/lab/bills?from=${date}&to=${date}`), { headers: getAuthHeaders() });
      const data = res.ok ? await res.json() : [];
      setBills(Array.isArray(data) ? data : data.bills || []);
    } catch {
      toast.error("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { if (user) fetchBills(); }, [fetchBills, user]);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBill) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setPaying(true);
    try {
      const billId = selectedBill._id || selectedBill.id;
      const res = await fetch(buildApiUrl(`/api/lab/bills/${billId}/payment`), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ amount, mode: payMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to record payment");
      toast.success("Payment recorded successfully");
      setSelectedBill(null);
      setPayAmount("");
      setPayMode("CASH");
      fetchBills();
    } catch (e: any) {
      toast.error(e.message || "Failed to record payment");
    } finally {
      setPaying(false);
    }
  }

  const totalBilled = bills.reduce((s: number, b: any) => s + (b.totalAmount || b.grandTotal || 0), 0);
  const totalCollected = bills.reduce((s: number, b: any) => s + (b.paidAmount || 0), 0);
  const totalPending = totalBilled - totalCollected;

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Lab Billing</h1>
            <p className="mt-1 text-sm text-zinc-500">View and collect payments for lab tests.</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="medical-input text-sm" />
            <button onClick={fetchBills} className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">Load</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Billed", value: totalBilled, color: "border-blue-500 text-blue-700" },
            { label: "Collected", value: totalCollected, color: "border-green-500 text-green-700" },
            { label: "Pending", value: totalPending, color: "border-red-500 text-red-700" },
          ].map((s) => (
            <div key={s.label} className={`medical-card border-l-4 p-4 ${s.color.split(" ")[0]}`}>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color.split(" ")[1]}`}>₹{s.value.toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>

        {selectedBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedBill(null)}>
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-zinc-900">Record Payment</h3>
              <div className="mt-2 text-sm text-zinc-600 space-y-1">
                <p>Patient: <strong>{selectedBill.patientName || "—"}</strong></p>
                <p>Total: <strong>₹{(selectedBill.totalAmount || selectedBill.grandTotal || 0).toLocaleString("en-IN")}</strong></p>
                <p>Paid: <strong className="text-green-700">₹{(selectedBill.paidAmount || 0).toLocaleString("en-IN")}</strong></p>
                <p>Outstanding: <strong className="text-red-700">₹{((selectedBill.totalAmount || selectedBill.grandTotal || 0) - (selectedBill.paidAmount || 0)).toLocaleString("en-IN")}</strong></p>
              </div>
              <form onSubmit={recordPayment} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Amount (₹)</label>
                  <input type="number" min="1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount" className="medical-input w-full" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Payment Mode</label>
                  <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className="medical-input w-full">
                    {["CASH", "UPI", "CARD", "INSURANCE", "OTHER"].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={paying} className="medical-btn-primary px-5 py-2 disabled:opacity-50">{paying ? "Saving…" : "Record Payment"}</button>
                  <button type="button" onClick={() => setSelectedBill(null)} className="px-5 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="medical-card overflow-hidden">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Bills on {date}</h2>
            <span className="text-sm text-zinc-500">{bills.length} bill(s)</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading bills…</div>
          ) : bills.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No lab bills found for {date}.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    {["Patient", "Tests", "Total", "Paid", "Outstanding", "Status", "Action"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {bills.map((b: any) => {
                    const outstanding = (b.totalAmount || b.grandTotal || 0) - (b.paidAmount || 0);
                    return (
                      <tr key={b._id || b.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900">{b.patientName || b.patient?.name || "—"}</td>
                        <td className="px-4 py-3 text-zinc-600 text-xs">{(b.tests || []).map((t: any) => t.name || t).join(", ") || b.testName || "—"}</td>
                        <td className="px-4 py-3 text-zinc-900">₹{(b.totalAmount || b.grandTotal || 0).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-green-700 font-semibold">₹{(b.paidAmount || 0).toLocaleString("en-IN")}</td>
                        <td className={`px-4 py-3 font-semibold ${outstanding > 0 ? "text-red-600" : "text-green-600"}`}>₹{outstanding.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            b.status === "PAID" ? "bg-green-100 text-green-700" :
                            b.status === "PARTIAL" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>{b.status || "PENDING"}</span>
                        </td>
                        <td className="px-4 py-3">
                          {outstanding > 0 && (
                            <button onClick={() => setSelectedBill(b)} className="px-3 py-1.5 bg-blue-700 text-white text-xs rounded hover:bg-blue-800 font-medium">
                              Collect
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
