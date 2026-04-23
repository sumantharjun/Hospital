"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiPost } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";

interface Pharmacy {
  _id: string;
  name: string;
  address: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

interface OrderItem {
  medicineName: string;
  quantity: number;
}

interface PendingOrder {
  pharmacyId: string;
  pharmacy?: Pharmacy;
  items: OrderItem[];
  deliveryType: "DELIVERY" | "PICKUP";
  deliveryAddress?: string;
  phoneNumber?: string;
  patientLocation?: {
    latitude: number;
    longitude: number;
  };
  pharmacyLocation?: {
    latitude: number;
    longitude: number;
  };
}

type PaymentMethod = "CASH" | "CARD" | "UPI" | "WALLET";

export default function CheckoutPage() {
  const router = useRouter();
  const [orderData, setOrderData] = useState<PendingOrder | null>(null);
  const [deliveryType, setDeliveryType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Calculate prices (dummy calculation)
  const calculatePrices = () => {
    if (!orderData) return { subtotal: 0, deliveryCharge: 0, total: 0 };
    
    // Dummy price calculation - in real app, this would come from backend
    const itemPrice = 50; // Dummy price per item
    const subtotal = orderData.items.reduce((sum, item) => sum + (item.quantity * itemPrice), 0);
    const deliveryCharge = deliveryType === "DELIVERY" ? 30 : 0;
    const total = subtotal + deliveryCharge;
    
    return { subtotal, deliveryCharge, total };
  };

  const { subtotal, deliveryCharge, total } = calculatePrices();

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

      // Get pending order from sessionStorage
      const pendingOrderStr = sessionStorage.getItem("pendingOrder");
      if (!pendingOrderStr) {
        router.push("/orders/new");
        return;
      }

      try {
        const pendingOrder: PendingOrder = JSON.parse(pendingOrderStr);
        setOrderData(pendingOrder);
        setDeliveryType(pendingOrder.deliveryType);
        setDeliveryAddress(pendingOrder.deliveryAddress || "");
      } catch (error) {
        console.error("Error parsing pending order:", error);
        router.push("/orders/new");
      }
    }
  }, [router]);

  const handlePlaceOrder = async () => {
    if (!token || !user?.id || !orderData) return;

    if (deliveryType === "DELIVERY" && !deliveryAddress.trim()) {
      toast.error("Please enter delivery address");
      return;
    }

    setProcessingPayment(true);
    
    // Simulate payment processing (dummy)
    await new Promise(resolve => setTimeout(resolve, 2000));

    setProcessingPayment(false);
    setLoading(true);

    try {
      const orderPayload = {
        pharmacyId: orderData.pharmacyId,
        items: orderData.items,
        deliveryType,
        deliveryAddress: deliveryType === "DELIVERY" ? deliveryAddress : undefined,
        phoneNumber: orderData.phoneNumber || user.phone || "",
        totalAmount: total,
        deliveryCharge: deliveryCharge,
        patientLocation: orderData.patientLocation,
        pharmacyLocation: orderData.pharmacyLocation,
      };

      const createdOrder = await apiPost("/api/orders/medicine-order", orderPayload);

      // Clear pending order
      sessionStorage.removeItem("pendingOrder");

      // Redirect to track order page
      router.push(`/orders/track/${(createdOrder as any)._id}`);
    } catch (error: any) {
      toast.error("Failed to place order: " + (error.message || "Unknown error"));
      setLoading(false);
    }
  };

  if (!orderData) {
    return (
      <DashboardLayout title="Checkout" description="Loading checkout...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading checkout...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Checkout"
      description="Review your order and complete payment"
      actionButton={
        <Link
          href="/orders/new"
          className="flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Link>
      }
    >
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pharmacy Info - Enhanced */}
            <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b-2 border-blue-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span>🏥</span>
                  Pharmacy
                </h2>
              </div>
              {orderData.pharmacy && (
                <div className="p-6">
                  <div className="bg-gradient-to-r from-white to-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{orderData.pharmacy.name}</h3>
                    <p className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                      <span>📍</span>
                      {orderData.pharmacy.address}
                    </p>
                    {orderData.pharmacy.phone && (
                      <a href={`tel:${orderData.pharmacy.phone}`} className="text-sm text-blue-700 hover:text-blue-900 font-medium flex items-center gap-2 mt-2">
                        <span>📞</span>
                        {orderData.pharmacy.phone}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Order Items - Enhanced */}
            <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b-2 border-green-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span>💊</span>
                  Order Items
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {orderData.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-white rounded-lg p-4 border-2 border-gray-200 hover:border-blue-300 transition-all">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-lg">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg">{item.medicineName}</h3>
                          <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-lg">₹{item.quantity * 50}</p>
                        <p className="text-xs text-gray-500">₹50 × {item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Delivery Type - Enhanced */}
            <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b-2 border-purple-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span>🚚</span>
                  Delivery Type
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <label className={`relative flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all ${
                    deliveryType === "DELIVERY"
                      ? "border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md"
                      : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                  }`}>
                    <input
                      type="radio"
                      value="DELIVERY"
                      checked={deliveryType === "DELIVERY"}
                      onChange={(e) => setDeliveryType(e.target.value as "DELIVERY" | "PICKUP")}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-3 w-full">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        deliveryType === "DELIVERY" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                      }`}>
                        🚚
                      </div>
                      <span className="font-bold text-gray-900">Delivery</span>
                    </div>
                    {deliveryType === "DELIVERY" && (
                      <div className="absolute top-2 right-2">
                        <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </label>
                  <label className={`relative flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all ${
                    deliveryType === "PICKUP"
                      ? "border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md"
                      : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                  }`}>
                    <input
                      type="radio"
                      value="PICKUP"
                      checked={deliveryType === "PICKUP"}
                      onChange={(e) => setDeliveryType(e.target.value as "DELIVERY" | "PICKUP")}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-3 w-full">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        deliveryType === "PICKUP" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                      }`}>
                        🏃
                      </div>
                      <span className="font-bold text-gray-900">Pickup</span>
                    </div>
                    {deliveryType === "PICKUP" && (
                      <div className="absolute top-2 right-2">
                        <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </label>
                </div>

                {deliveryType === "DELIVERY" && (
                  <div className="mt-4">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      📍 Delivery Address
                    </label>
                    <textarea
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 transition-all"
                      placeholder="Enter your complete delivery address..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method - Enhanced */}
            <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 px-6 py-4 border-b-2 border-yellow-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span>💳</span>
                  Payment Method
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { value: "CARD", label: "Card", icon: "💳" },
                    { value: "UPI", label: "UPI", icon: "📱" },
                    { value: "WALLET", label: "Wallet", icon: "💼" },
                    { value: "CASH", label: "Cash on Delivery", icon: "💵" },
                  ].map((method) => (
                    <label
                      key={method.value}
                      className={`relative flex flex-col items-center justify-center p-5 rounded-xl border-2 cursor-pointer transition-all ${
                        paymentMethod === method.value
                          ? "border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg scale-105"
                          : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        value={method.value}
                        checked={paymentMethod === method.value}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="sr-only"
                      />
                      <div className="text-3xl mb-2">{method.icon}</div>
                      <span className="font-bold text-gray-900 text-sm text-center">{method.label}</span>
                      {paymentMethod === method.value && (
                        <div className="absolute top-2 right-2">
                          <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 font-medium">
                    {paymentMethod === "CASH" 
                      ? "💰 Pay when your order is delivered"
                      : "ℹ️ This is a demo payment. No actual payment will be processed."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary - Enhanced */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden sticky top-4">
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 border-b-2 border-green-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📋</span>
                  Order Summary
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-medium">Subtotal</span>
                    <span className="font-bold text-gray-900">₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-medium">Delivery Charge</span>
                    <span className="font-bold text-gray-900">{deliveryCharge > 0 ? `₹${deliveryCharge}` : "Free"}</span>
                  </div>
                  <div className="border-t-2 border-gray-200 pt-4 flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-green-600">₹{total}</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={loading || processingPayment || (deliveryType === "DELIVERY" && !deliveryAddress.trim())}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 font-bold text-white shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:transform-none"
                >
                  {processingPayment ? (
                    <span className="flex items-center justify-center">
                      <span className="inline-block h-5 w-5 animate-spin rounded-full border-3 border-solid border-white border-r-transparent mr-2"></span>
                      Processing Payment...
                    </span>
                  ) : loading ? (
                    <span className="flex items-center justify-center">
                      <span className="inline-block h-5 w-5 animate-spin rounded-full border-3 border-solid border-white border-r-transparent mr-2"></span>
                      Placing Order...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>💳</span>
                      Pay ₹{total} & Place Order
                    </span>
                  )}
                </button>

                <p className="text-xs text-center text-gray-500 leading-relaxed">
                  By placing this order, you agree to our terms and conditions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

