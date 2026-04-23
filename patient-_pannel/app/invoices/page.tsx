"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiGet } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { InvoicesIcon, OrdersIcon } from "@/components/icons";

interface Order {
  _id: string;
  totalAmount?: number;
  deliveryCharge?: number;
  items: Array<{ medicineName: string; quantity: number }>;
  createdAt: string;
  status: string;
  pharmacy?: { name: string };
}

interface FinanceEntry {
  _id: string;
  type: string;
  amount: number;
  occurredAt: string;
  meta?: {
    orderId?: string;
    appointmentId?: string;
  };
}

export default function InvoicesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "bills">("orders");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        router.replace("/");
        return;
      }
      
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
  }, [router]);

  const fetchData = async () => {
    if (!token || !user?.id) return;
    
    try {
      // Fetch orders
      const ordersData = await apiGet<Order[]>(`/api/orders/my`).catch(() => []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);

      // Fetch finance entries (bills) - filter by patientId
      const billsData = await apiGet<{ entries?: FinanceEntry[] }>(`/api/finance/summary?patientId=${user.id}`).catch(() => ({ entries: [] }));
      const allEntries = billsData.entries || [];
      // Filter to only show entries that belong to this patient
      // The backend should already filter by patientId, but we double-check here for security
      const patientBills = allEntries.filter((entry: FinanceEntry) => {
        const entryPatientId = (entry as any).patientId;
        // Only include entries that have the current patient's ID
        return entryPatientId && String(entryPatientId) === String(user.id);
      });
      setBills(patientBills);
    } catch (error: any) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !user?.id) return;
    fetchData();
  }, [token, user?.id]);

  const downloadOrderInvoice = async (order: Order) => {
    try {
      if (!token) {
        toast.error("Please login to download invoice");
        return;
      }

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
      const response = await fetch(`${API_BASE}/api/invoices/order/${order._id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate invoice");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const invoiceNumber = `INV-${order._id.slice(-8).toUpperCase()}-${new Date().getFullYear()}`;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Invoice downloaded successfully!");
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      toast.error(error.message || "Failed to download invoice");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalAmount = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const totalBills = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalInvoices = orders.length + bills.length;

  if (loading) {
    return (
      <DashboardLayout title="Invoices & Bills" description="Loading your invoices...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading invoices...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Invoices & Bills"
      description="Download your prescriptions, invoices, and bills"
    >
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Summary Statistics */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                  <InvoicesIcon className="w-8 h-8 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Total Invoices</p>
                  <p className="text-3xl font-bold">{totalInvoices}</p>
                </div>
              </div>
              <p className="text-lg font-semibold">All Documents</p>
              <p className="text-sm opacity-90">Invoices & Bills</p>
            </div>
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"></div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg">
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                  <OrdersIcon className="w-8 h-8 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Total Orders</p>
                  <p className="text-3xl font-bold">{orders.length}</p>
                </div>
              </div>
              <p className="text-lg font-semibold">Order Invoices</p>
              <p className="text-sm opacity-90">₹{totalAmount.toFixed(2)}</p>
            </div>
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"></div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg">
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Total Bills</p>
                  <p className="text-3xl font-bold">{bills.length}</p>
                </div>
              </div>
              <p className="text-lg font-semibold">Bills</p>
              <p className="text-sm opacity-90">₹{totalBills.toFixed(2)}</p>
            </div>
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex-1 rounded-lg px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "orders"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <OrdersIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden xs:inline">Order Invoices</span>
                <span className="xs:hidden">Orders</span>
                <span className="hidden sm:inline">({orders.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("bills")}
              className={`flex-1 rounded-lg px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "bills"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <InvoicesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Bills</span>
                <span className="hidden sm:inline">({bills.length})</span>
              </div>
            </button>
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Order Invoices Tab */}
          {activeTab === "orders" && (
            <div className="p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Order Invoices</h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-600">Download PDF invoices for your medicine orders</p>
              </div>
              {orders.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <OrdersIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">No Orders Found</h3>
                  <p className="mb-6 text-gray-600">You don't have any orders yet.</p>
                  <Link
                    href="/orders/new"
                    className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                  >
                    Place an Order
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order._id}
                      className="group rounded-lg border border-gray-200 bg-gradient-to-r from-white to-gray-50 p-4 sm:p-5 transition-all hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="mb-3 flex items-center gap-2 sm:gap-3">
                            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-100 flex-shrink-0">
                              <OrdersIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                                Order #{order._id.slice(-8).toUpperCase()}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-600 truncate">
                                {order.pharmacy?.name || "Pharmacy"} • {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="ml-0 sm:ml-16 grid gap-2 grid-cols-1 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-500">Order Date</p>
                              <p className="text-sm text-gray-900">{formatDate(order.createdAt)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500">Status</p>
                              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                                order.status === "DELIVERED" ? "bg-green-100 text-green-800" :
                                order.status === "OUT_FOR_DELIVERY" ? "bg-blue-100 text-blue-800" :
                                order.status === "PACKED" ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>
                                {order.status}
                              </span>
                            </div>
                            {order.totalAmount && (
                              <div className="sm:col-span-2">
                                <p className="text-xs font-semibold text-gray-500">Total Amount</p>
                                <p className="text-xl font-bold text-gray-900">₹{order.totalAmount.toFixed(2)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => downloadOrderInvoice(order)}
                          className="sm:ml-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md flex-shrink-0 self-start sm:self-auto"
                          title="Download Invoice"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bills Tab */}
          {activeTab === "bills" && (
            <div className="p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Bills</h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-600">View your medical bills and charges</p>
              </div>
              {bills.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <InvoicesIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">No Bills Available</h3>
                  <p className="text-gray-600">You don't have any bills yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bills.map((bill) => (
                    <div
                      key={bill._id}
                      className="group rounded-lg border border-gray-200 bg-gradient-to-r from-white to-gray-50 p-4 sm:p-5 transition-all hover:border-purple-300 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-purple-100 flex-shrink-0">
                            <InvoicesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">{bill.type}</h3>
                            <p className="text-xs sm:text-sm text-gray-600">{formatDate(bill.occurredAt)}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg sm:text-2xl font-bold text-gray-900">₹{bill.amount.toFixed(2)}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500">Amount</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
