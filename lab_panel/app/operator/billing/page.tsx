"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import type { LabBill, LabOrder } from "@/lib/types";
import toast from "react-hot-toast";

function BillingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preOrderId = searchParams.get("orderId") ?? "";

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [bills, setBills] = useState<LabBill[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState(preOrderId);
  const [discount, setDiscount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<{ orders: LabOrder[] }>("/api/lab/orders?limit=200"),
      apiGet<{ bills: LabBill[] }>("/api/lab/billing"),
    ]).then(([od, bd]) => {
      setOrders(od.orders.filter((o) => !o.billId));
      setBills(bd.bills);
    }).catch((err) => toast.error(err.message))
    .finally(() => setLoading(false));
  }, []);

  async function generate() {
    if (!selectedOrderId) { toast.error("Select an order"); return; }
    setGenerating(true);
    try {
      await apiPost(`/api/lab/billing/order/${selectedOrderId}`, { discountPercent: discount });
      toast.success("Bill generated");
      router.push("/operator/payments");
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  }

  const order = orders.find((o) => o._id === selectedOrderId);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Billing</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generate new bill */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold mb-4">Generate Bill</h2>
          {loading ? <div className="text-gray-400">Loading…</div> : (
            <>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Order (unbilled)</label>
                <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Choose order —</option>
                  {orders.map((o) => <option key={o._id} value={o._id}>{o.orderId} · {o.patientName} · ₹{o.grandTotal}</option>)}
                </select>
              </div>
              {order && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Patient</span><span>{order.patientName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tests</span><span>{order.tests.length + order.packages.length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{order.subtotal}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Status</span><span>{order.status}</span></div>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                <input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={generate} disabled={generating || !selectedOrderId} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400">
                {generating ? "Generating…" : "Generate Bill"}
              </button>
            </>
          )}
        </div>

        {/* Recent bills */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm">Recent Bills</div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {bills.slice(0, 20).map((b) => (
              <div key={b._id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium">{b.patientName}</div>
                  <div className="text-xs text-gray-400">{b.billNumber}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">₹{b.grandTotal.toLocaleString("en-IN")}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    b.status === "PAID" ? "bg-green-100 text-green-700" :
                    b.status === "PARTIAL" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{b.status}</span>
                </div>
              </div>
            ))}
            {bills.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No bills yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}><BillingContent /></Suspense>;
}
