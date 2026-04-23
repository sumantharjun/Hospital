"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";
import DashboardLayout from "@/components/DashboardLayout";

export default function WalletPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [receivedPayments, setReceivedPayments] = useState<any[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        router.replace("/");
        return;
      }
      
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setToken(storedToken);
      // Socket is already initialized in SocketProvider, no need to initialize again
    }
  }, [router]);

  const fetchWalletData = async () => {
    if (!token || !user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      const financeData = await apiGet<any>(`/api/finance/summary`).catch(() => ({ entries: [] }));
      
      // Get received payments (verified doctor commissions)
      const payments = (financeData.entries || []).filter((entry: any) => 
        entry.type === "DOCTOR_COMMISSION" && entry.meta?.verified === true && 
        (entry.doctorId === user.id || entry.doctorId === user._id)
      ).sort((a: any, b: any) => 
        new Date(b.meta?.verifiedAt || b.occurredAt).getTime() - new Date(a.meta?.verifiedAt || a.occurredAt).getTime()
      );
      
      // Remove duplicates
      const uniquePayments = payments.reduce((acc: any[], payment: any) => {
        const exists = acc.find((p: any) => 
          p._id === payment._id || 
          (p.meta?.appointmentId === payment.meta?.appointmentId && 
           String(p.doctorId) === String(payment.doctorId))
        );
        if (!exists) {
          acc.push(payment);
        }
        return acc;
      }, []);
      
      setReceivedPayments(uniquePayments);
      setTotalReceived(uniquePayments.reduce((sum: number, p: any) => sum + p.amount, 0));
    } catch (error: any) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !user?.id) return;
    
    fetchWalletData();
    
    // Listen for real-time payment updates
    const socket = getSocket();
    if (socket) {
      const handlePaymentReceived = () => {
        // Refresh wallet data when payment is received
        fetchWalletData();
      };

      onSocketEvent("payment:received", handlePaymentReceived);
      onSocketEvent("notification:new", handlePaymentReceived);
      
      return () => {
        offSocketEvent("payment:received", handlePaymentReceived);
        offSocketEvent("notification:new", handlePaymentReceived);
      };
    }
  }, [token, user?.id]);

  if (loading) {
    return (
      <DashboardLayout title="Wallet" description="Loading your wallet...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Wallet"
      description="View all your received payments"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Total Received Card */}
        <div className="rounded-lg border border-gray-300 bg-gradient-to-r from-green-50 to-blue-50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Total Received</p>
              <p className="text-4xl font-bold text-green-600">₹{totalReceived.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-2">
                {receivedPayments.length} verified payment{receivedPayments.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="text-6xl opacity-20">💰</div>
          </div>
        </div>

        {/* Payment History */}
        <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Payment History</h2>
          
          {receivedPayments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2">💰</div>
              <p className="text-sm text-gray-600">No payments received yet</p>
              <p className="text-xs text-gray-500 mt-1">Verified payments will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receivedPayments.map((payment: any, index: number) => (
                <div
                  key={payment._id || `payment-${index}`}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">💵</span>
                      <p className="font-semibold text-gray-900">₹{payment.amount.toLocaleString()}</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      {payment.meta?.patientName || 'Payment received'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(payment.meta?.verifiedAt || payment.occurredAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-semibold bg-green-100 text-green-700 border border-green-200">
                    Verified
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

