import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { distributorOrdersApi, pharmacyInvoiceApi } from "@/services/api";
import { getUser, getAuthToken } from "@/utils/auth";
import { DistributorOrder, PharmacyInvoice } from "@/types";
import { API_BASE } from "@/utils/constants";

type InvoiceTab = "pharmacy" | "distributor";

export default function InvoicesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<InvoiceTab>("pharmacy");
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [pharmacyInvoices, setPharmacyInvoices] = useState<PharmacyInvoice[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<DistributorOrder[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<PharmacyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    if (currentUser.pharmacyId) {
      const pharmacyId = currentUser.pharmacyId;
      loadData(pharmacyId);
      // Auto-refresh every 30 seconds to get new invoices
      const interval = setInterval(() => {
        loadData(pharmacyId);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [router]);

  useEffect(() => {
    // Filter pharmacy invoices
    let filteredInv = [...pharmacyInvoices];
    if (searchTerm) {
      filteredInv = filteredInv.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.items.some((item) => item.medicineName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    setFilteredInvoices(filteredInv);

    // Filter distributor orders
    let filtered = orders.filter((o) => o.status === "DELIVERED" || o.status === "DISPATCHED");
    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.distributorId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredOrders(filtered);
  }, [pharmacyInvoices, orders, searchTerm]);

  const loadData = async (pharmacyId: string) => {
    setLoading(true);
    try {
      await Promise.all([
        loadOrders(pharmacyId),
        loadPharmacyInvoices(pharmacyId),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (pharmacyId: string) => {
    try {
      const data = await distributorOrdersApi.getAll(pharmacyId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load distributor invoices");
    }
  };

  const loadPharmacyInvoices = async (pharmacyId: string) => {
    try {
      const data = await pharmacyInvoiceApi.getAll(pharmacyId);
      setPharmacyInvoices(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load pharmacy invoices");
    }
  };

  const downloadInvoice = async (order: DistributorOrder) => {
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error("Please login to download invoice");
        return;
      }

      const response = await fetch(`${API_BASE}/api/invoices/distributor-order/${order._id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate invoice");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const invoiceNumber = `INV-${order._id.slice(-8).toUpperCase()}-${new Date(order.createdAt || Date.now()).getFullYear()}`;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Invoice downloaded successfully!");
    } catch (error: any) {
      console.error("Error downloading invoice:", error);
      if (error.name === "TypeError" || error.message === "Failed to fetch") {
        toast.error("Cannot connect to server. Please check if the backend server is running.");
      } else {
        toast.error(error.message || "Failed to download invoice");
      }
    }
  };

  if (!user) return null;

  const totalRevenue = orders
    .filter((o) => o.status === "DELIVERED" || o.status === "DISPATCHED")
    .reduce((sum, order) => {
      // Calculate total amount (base price + tax)
      const amount = order.quantity * 100; // Base price
      const tax = amount * 0.18; // 18% GST
      return sum + amount + tax;
    }, 0);

  return (
    <Layout user={user} currentPage="invoices">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoices</h1>
            <p className="text-gray-600">View and download pharmacy and distributor invoices</p>
          </div>
          <button
            onClick={() => {
              if (user?.pharmacyId) {
                loadData(user.pharmacyId);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <span>🔄</span>
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md p-2 border border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("pharmacy")}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === "pharmacy"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Pharmacy Invoices ({filteredInvoices.length})
            </button>
            <button
              onClick={() => setActiveTab("distributor")}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === "distributor"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Distributor Invoices ({filteredOrders.length})
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Invoices</span>
              <span className="text-2xl">📄</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {activeTab === "pharmacy" ? filteredInvoices.length : filteredOrders.length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Amount</span>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              ₹{activeTab === "pharmacy" 
                ? filteredInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0).toFixed(2)
                : totalRevenue.toFixed(2)
              }
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">
                {activeTab === "pharmacy" ? "Paid Invoices" : "Delivered Orders"}
              </span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">
              {activeTab === "pharmacy"
                ? filteredInvoices.filter((inv) => inv.paymentStatus === "PAID").length
                : orders.filter((o) => o.status === "DELIVERED").length
              }
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <input
            type="text"
            placeholder="Search by order ID, medicine name, or distributor ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          />
        </div>

        {/* Invoices List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === "pharmacy" ? (
          filteredInvoices.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
              <p className="text-gray-500 text-lg">No pharmacy invoices found</p>
              <p className="text-gray-400 text-sm mt-2">Create invoices from the Billing page</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <motion.div
                  key={invoice._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col lg:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            Invoice: {invoice.invoiceNumber}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {new Date(invoice.billDate).toLocaleDateString()} •{" "}
                            <span className="font-medium text-gray-700">{invoice.invoiceType.replace("_", " ")}</span>
                            {invoice.invoiceType === "PATIENT_ORDER" && " (order)"}
                            {invoice.invoiceType === "WALK_IN" && " (walk-in)"}
                            {invoice.invoiceType === "MANUAL_BILL" && " (manual)"}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            invoice.paymentStatus === "PAID"
                              ? "bg-green-100 text-green-800"
                              : invoice.paymentStatus === "PARTIAL"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {invoice.paymentStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Items</p>
                          <p className="text-sm font-semibold text-gray-900">{invoice.items.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Subtotal</p>
                          <p className="text-sm font-semibold text-gray-900">₹{invoice.subtotal.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tax (GST)</p>
                          <p className="text-sm font-semibold text-gray-900">₹{invoice.totalTax.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Grand Total</p>
                          <p className="text-sm font-semibold text-green-600">₹{invoice.grandTotal.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        <p>Items: {invoice.items.map((item) => `${item.medicineName} (${item.quantity})`).join(", ")}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:min-w-[200px]">
                      <button
                        onClick={() => pharmacyInvoiceApi.downloadPDF(invoice._id).catch((e) => toast.error(e.message))}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
                      >
                        📥 Download Invoice
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No invoices found</p>
            <p className="text-gray-400 text-sm mt-2">Invoices will appear here when distributors send them</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const amount = order.quantity * 100; // Base price
              const tax = amount * 0.18; // 18% GST
              const totalAmount = amount + tax;
              const invoiceNumber = `INV-${order._id.slice(-8).toUpperCase()}-${new Date(order.createdAt || Date.now()).getFullYear()}`;

              return (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col lg:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            Invoice: {invoiceNumber}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Order #{order._id.slice(-8)} •{" "}
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString()
                              : "Date not available"}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            order.status === "DELIVERED"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {order.status === "DELIVERED" ? "Delivered" : "Dispatched"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Medicine</p>
                          <p className="text-sm font-semibold text-gray-900">{order.medicineName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Quantity</p>
                          <p className="text-sm font-semibold text-gray-900">{order.quantity} units</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Amount</p>
                          <p className="text-sm font-semibold text-gray-900">₹{amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Total</p>
                          <p className="text-sm font-semibold text-green-600">
                            ₹{totalAmount.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {order.deliveredAt && (
                        <div className="text-xs text-gray-500">
                          <p>Delivered: {new Date(order.deliveredAt).toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 lg:min-w-[200px]">
                      <button
                        onClick={() => downloadInvoice(order)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
                      >
                        📥 Download Invoice
                      </button>
                      {order.deliveryProofImageUrl && (
                        <a
                          href={order.deliveryProofImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all text-sm text-center"
                        >
                          📷 View Delivery Proof
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

