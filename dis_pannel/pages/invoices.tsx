import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { distributorOrdersApi } from "@/services/api";
import { getUser } from "@/utils/auth";
import { DistributorOrder } from "@/types";
import { INVOICE_STATUSES, API_BASE } from "@/utils/constants";

export default function InvoicesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<DistributorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sentInvoices, setSentInvoices] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    if (currentUser.distributorId) {
      loadOrders(currentUser.distributorId);
    }
  }, [router]);

  useEffect(() => {
    let filtered = orders.filter((o) => o.status === "DELIVERED" || o.status === "DISPATCHED");

    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.pharmacyId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm]);

  const loadOrders = async (distributorId: string) => {
    setLoading(true);
    try {
      const data = await distributorOrdersApi.getAll(distributorId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const generateInvoice = async (order: DistributorOrder) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login to download invoice");
        return;
      }

      if (!API_BASE) {
        toast.error("API configuration error");
        return;
      }
      const response = await fetch(`${API_BASE}/api/invoices/distributor-order/${order._id}`, {
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

  const sendInvoiceToPharmacy = async (order: DistributorOrder) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login to send invoice");
        return;
      }

      if (!API_BASE) {
        toast.error("API configuration error");
        return;
      }
      
      // Show loading toast
      const loadingToast = toast.loading("Sending invoice to pharmacy...");
      
      const response = await fetch(`${API_BASE}/api/invoices/distributor-order/${order._id}/send-to-pharmacy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      toast.dismiss(loadingToast);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.message || "Failed to send invoice to pharmacy");
      }

      const data = await response.json();
      
      // Mark invoice as sent
      setSentInvoices((prev) => new Set(prev).add(order._id));
      
      toast.success(
        `✅ Invoice sent successfully! Invoice ${data.invoiceNumber} has been sent to ${data.pharmacyName}. ${data.notificationsSent} notification${data.notificationsSent > 1 ? 's' : ''} sent.`,
        { duration: 5000 }
      );
    } catch (error: any) {
      console.error("Error sending invoice to pharmacy:", error);
      // Handle network errors
      if (error.name === "TypeError" || error.message === "Failed to fetch") {
        toast.error("Cannot connect to server. Please check if the backend server is running.");
      } else {
        toast.error(error.message || "Failed to send invoice to pharmacy");
      }
    }
  };

  if (!user) return null;

  const totalRevenue = filteredOrders.reduce((sum, order) => {
    // Assuming base price calculation
    return sum + order.quantity * 100;
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoices & Documents</h1>
            <p className="text-gray-600">Manage invoices and supply chain documents</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Invoices</span>
              <span className="text-2xl">📄</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{filteredOrders.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Revenue</span>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-3xl font-bold text-green-600">₹{totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Delivered Orders</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">
              {orders.filter((o) => o.status === "DELIVERED").length}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <input
            type="text"
            placeholder="Search by order ID, medicine name, or pharmacy ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
          />
        </div>

        {/* Orders/Invoices List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No invoices found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const amount = order.quantity * 100; // Base price
              const tax = amount * 0.18;
              const totalAmount = amount + tax;
              const invoiceNumber = `INV-${order._id.slice(-8).toUpperCase()}-${new Date(order.createdAt || Date.now()).getFullYear()}`;

              return (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl shadow-md border border-gray-100 p-6"
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
                          {order.status === "DELIVERED" ? "Paid" : "Pending"}
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

                      <div className="text-xs text-gray-500">
                        <p>Pharmacy ID: {order.pharmacyId}</p>
                        {order.deliveredAt && (
                          <p>Delivered: {new Date(order.deliveredAt).toLocaleString()}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:min-w-[200px]">
                      <button
                        onClick={() => generateInvoice(order)}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
                      >
                        📥 Download Invoice
                      </button>
                      {sentInvoices.has(order._id) ? (
                        <div className="px-4 py-2 bg-green-100 border-2 border-green-500 text-green-700 rounded-lg font-semibold text-sm text-center flex items-center justify-center gap-2">
                          <span>✅</span>
                          <span>Sent Successfully</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => sendInvoiceToPharmacy(order)}
                          className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
                        >
                          📤 Send to Pharmacy
                        </button>
                      )}
                      {order.deliveryProofImageUrl && (
                        <a
                          href={order.deliveryProofImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm text-center"
                        >
                          📷 View Proof
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

