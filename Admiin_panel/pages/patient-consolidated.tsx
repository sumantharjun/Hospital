import { useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import Layout from "../components/Layout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function PatientConsolidatedPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/"); return; }
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`${API_BASE}/api/reports/hospital/patient-consolidated?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setData(await res.json());
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const fmtCurrency = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      IP: "bg-blue-100 text-blue-800",
      OP: "bg-green-100 text-green-800",
      SERVICE: "bg-purple-100 text-purple-800",
    };
    return <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[type] || "bg-gray-100 text-gray-700"}`}>{type}</span>;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PAID: "bg-green-100 text-green-800",
      ACTIVE: "bg-blue-100 text-blue-700",
      PARTIAL: "bg-yellow-100 text-yellow-800",
      COMPLETED: "bg-green-100 text-green-800",
      DISCHARGED: "bg-gray-100 text-gray-700",
      DRAFT: "bg-gray-100 text-gray-500",
    };
    return <span className={`text-xs px-2 py-0.5 rounded ${colors[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Patient Consolidated Report</h1>
        <p className="text-sm text-gray-500 mb-6">Search by patient name, phone, IP ID, or OP ID to see all charges, payments, and outstanding dues.</p>

        {/* Search Bar */}
        <form onSubmit={search} className="flex gap-3 mb-8">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter patient name, phone, IP ID (e.g. IP-20240101-0001) or OP ID..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700">
            Search
          </button>
        </form>

        {loading && <div className="text-center py-16 text-gray-400">Searching...</div>}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
              {[
                { label: "IP Records", value: data.summary.ipCount, color: "bg-blue-50 text-blue-700" },
                { label: "OP Records", value: data.summary.opCount, color: "bg-green-50 text-green-700" },
                { label: "Services", value: data.summary.svcCount, color: "bg-purple-50 text-purple-700" },
                { label: "Total Billed", value: fmtCurrency(data.summary.totalBilled), color: "bg-gray-50 text-gray-800" },
                { label: "Total Paid", value: fmtCurrency(data.summary.totalPaid), color: "bg-green-50 text-green-800" },
                { label: "Outstanding", value: fmtCurrency(data.summary.totalOutstanding), color: data.summary.totalOutstanding > 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-500" },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
                  <div className="text-lg font-bold">{s.value}</div>
                  <div className="text-xs mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {data.results.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No records found for "{query}"</div>
            ) : (
              <div className="space-y-3">
                {data.results.map((r: any, i: number) => {
                  const rid = r.id;
                  const isOpen = expanded === rid;
                  const bill = r.bill;
                  const outstanding = bill?.outstandingBalance ?? r.outstandingBalance ?? 0;
                  const grandTotal = bill?.grandTotal ?? r.grandTotal ?? 0;
                  const paidAmount = bill?.paidAmount ?? r.paidAmount ?? 0;

                  return (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      {/* Row header */}
                      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpanded(isOpen ? null : rid)}>
                        <div className="flex items-center gap-3">
                          {typeBadge(r.type)}
                          <div>
                            <div className="font-mono text-sm font-medium text-gray-900">{r.id}</div>
                            <div className="text-xs text-gray-500">{r.patient?.name || "Walk-in"} · {r.doctor ? `Dr. ${r.doctor.name}` : r.type === "SERVICE" ? "Services" : "—"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <div className="text-sm font-medium">{fmtCurrency(grandTotal)}</div>
                            {outstanding > 0 && <div className="text-xs text-red-600">Due: {fmtCurrency(outstanding)}</div>}
                          </div>
                          {statusBadge(bill?.status || r.status || "—")}
                          <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
                          {/* Patient info */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div><span className="text-gray-500 text-xs">Patient</span><div className="font-medium">{r.patient?.name || "—"}</div></div>
                            <div><span className="text-gray-500 text-xs">Phone</span><div>{r.patient?.phone || "—"}</div></div>
                            {r.doctor && <div><span className="text-gray-500 text-xs">Doctor</span><div>{r.doctor.name}</div></div>}
                            {r.token && <div><span className="text-gray-500 text-xs">Token</span><div className="font-mono">#{r.token}</div></div>}
                            {r.room && <div><span className="text-gray-500 text-xs">Room</span><div>{r.room.roomNumber} (Bed {r.bed?.bedNumber})</div></div>}
                            <div><span className="text-gray-500 text-xs">Date</span><div>{new Date(r.admissionDate || r.registrationDate).toLocaleDateString()}</div></div>
                            <div><span className="text-gray-500 text-xs">Status</span><div>{r.status}</div></div>
                          </div>

                          {/* Bill Line Items */}
                          {bill?.lineItems && bill.lineItems.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-2">Charges</div>
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                                      <th className="px-3 py-2 text-left font-medium text-gray-500">Category</th>
                                      <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bill.lineItems.map((li: any, j: number) => (
                                      <tr key={j} className="border-t border-gray-100">
                                        <td className="px-3 py-2">{li.description}</td>
                                        <td className="px-3 py-2 text-gray-500">{li.category}</td>
                                        <td className="px-3 py-2 text-right font-medium">₹{li.total}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Payment History */}
                          {bill?.paymentHistory && bill.paymentHistory.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-2">Payment History</div>
                              <div className="space-y-1">
                                {bill.paymentHistory.map((p: any, j: number) => (
                                  <div key={j} className="flex justify-between text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                                    <span className="text-gray-500">{new Date(p.date || p.paidAt).toLocaleString()} · {p.mode}{p.referenceNumber ? ` (${p.referenceNumber})` : ""}</span>
                                    <span className="font-medium text-green-700">₹{p.amount}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Bill Summary */}
                          <div className="flex gap-4 text-sm pt-2 border-t border-gray-200">
                            <div><span className="text-gray-500">Billed: </span><span className="font-medium">{fmtCurrency(grandTotal)}</span></div>
                            <div><span className="text-gray-500">Paid: </span><span className="font-medium text-green-700">{fmtCurrency(paidAmount)}</span></div>
                            <div><span className="text-gray-500">Outstanding: </span><span className={`font-medium ${outstanding > 0 ? "text-red-600" : "text-gray-500"}`}>{fmtCurrency(outstanding)}</span></div>
                            {bill?.isFrozen && <span className="text-xs text-gray-400 italic">Bill frozen</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
