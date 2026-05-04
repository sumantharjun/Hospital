"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import type { LabBill, LabOrder } from "@/lib/types";
import toast from "react-hot-toast";

const BILL_STATUS_BADGE: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-600",
  DRAFT: "bg-gray-100 text-gray-600",
};

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
  const [viewBill, setViewBill] = useState<LabBill | null>(null);

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
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discount}
                  onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
              <div key={b._id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer" onClick={() => setViewBill(b)}>
                <div>
                  <div className="text-sm font-medium">{b.patientName}</div>
                  <div className="text-xs text-gray-400">{b.billNumber}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold">₹{b.grandTotal.toLocaleString("en-IN")}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${BILL_STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-600"}`}>{b.status}</span>
                  </div>
                </div>
              </div>
            ))}
            {bills.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No bills yet</div>}
          </div>
        </div>
      </div>

      {/* View Bill Modal */}
      {viewBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Bill Details</h2>

            <div className="space-y-3 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Bill Number</span>
                <span className="font-mono text-xs">{viewBill.billNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Patient</span>
                <span className="font-medium">{viewBill.patientName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${BILL_STATUS_BADGE[viewBill.status] ?? "bg-gray-100 text-gray-600"}`}>{viewBill.status}</span>
              </div>
            </div>

            {viewBill.lineItems.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Line Items</div>
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Description</th>
                        <th className="text-right px-3 py-2 font-medium">Unit Price</th>
                        <th className="text-right px-3 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewBill.lineItems.map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-right">₹{item.unitPrice.toLocaleString("en-IN")}</td>
                          <td className="px-3 py-2 text-right">₹{item.total.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>₹{viewBill.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Discount ({viewBill.discountPercent}%)</span>
                <span>₹{viewBill.discountAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax</span>
                <span>₹{viewBill.taxTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-gray-200 pt-1.5 mt-1">
                <span>Grand Total</span>
                <span>₹{viewBill.grandTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span>₹{viewBill.paidAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className={`flex justify-between font-medium ${viewBill.outstandingBalance > 0 ? "text-red-500" : "text-gray-400"}`}>
                <span>Outstanding</span>
                <span>₹{viewBill.outstandingBalance.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setViewBill(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}><BillingContent /></Suspense>;
}
