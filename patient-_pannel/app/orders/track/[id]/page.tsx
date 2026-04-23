"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPut } from "@/lib/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";
import DashboardLayout from "@/components/DashboardLayout";

interface Order {
  _id: string;
  status: string;
  items: Array<{ medicineName: string; quantity: number }>;
  deliveryType: string;
  deliveryLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  pharmacyLocation?: {
    latitude: number;
    longitude: number;
  };
  patientLocation?: {
    latitude: number;
    longitude: number;
  };
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
  estimatedDeliveryTime?: string;
  deliveredAt?: string;
  pharmacy?: { name: string; address: string };
}

export default function TrackOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<string>("");
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);

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
      
      // Only initialize socket if we have a token
      // Socket will handle connection errors gracefully
      try {
        // Socket is already initialized in SocketProvider, no need to initialize again
      } catch (error) {
        console.warn("Failed to initialize socket:", error);
        // Continue without socket - real-time updates won't work but page will still function
      }
    }
  }, [router]);

  const fetchOrder = async () => {
    if (!token || !orderId) return;
    
    try {
      const data = await apiGet<Order>(`/api/orders/${orderId}`);
      setOrder(data);
      
      // Generate map URL if locations are available
      if (data.deliveryLocation || data.pharmacyLocation) {
        const deliveryLat = data.deliveryLocation?.latitude || data.pharmacyLocation?.latitude;
        const deliveryLng = data.deliveryLocation?.longitude || data.pharmacyLocation?.longitude;
        const patientLat = data.patientLocation?.latitude;
        const patientLng = data.patientLocation?.longitude;
        
        if (deliveryLat && deliveryLng) {
          let url = `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}`;
          if (patientLat && patientLng) {
            url = `https://www.google.com/maps/dir/${patientLat},${patientLng}/${deliveryLat},${deliveryLng}`;
          }
          setMapUrl(url);
        }
      }
    } catch (error: any) {
      console.error("Error fetching order:", error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!token || !orderId) return;
    fetchOrder();
  }, [token, orderId]);

  // Listen for real-time location updates
  useEffect(() => {
    if (!token || !orderId) return;

    const socket = getSocket();
    if (!socket) return;

    const handleLocationUpdate = () => {
      fetchOrder();
    };

    onSocketEvent("order:deliveryLocationUpdated", handleLocationUpdate);
    onSocketEvent("order:statusUpdated", handleLocationUpdate);
    
    return () => {
      offSocketEvent("order:deliveryLocationUpdated", handleLocationUpdate);
      offSocketEvent("order:statusUpdated", handleLocationUpdate);
    };
  }, [token, orderId]);

  const getStatusSteps = () => {
    const statusOrder = ["PENDING", "ORDER_RECEIVED", "ACCEPTED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];
    const currentIndex = statusOrder.indexOf(order?.status || "PENDING");
    
    const steps = [
      { key: "PENDING", label: "Order Placed", shortLabel: "Placed", icon: "📦", completed: true, isCurrent: order?.status === "PENDING" },
      { key: "ORDER_RECEIVED", label: "Order Received", shortLabel: "Received", icon: "✅", completed: currentIndex >= 1, isCurrent: order?.status === "ORDER_RECEIVED" },
      { key: "ACCEPTED", label: "Accepted", shortLabel: "Accepted", icon: "✓", completed: currentIndex >= 2, isCurrent: order?.status === "ACCEPTED" },
      { key: "PACKED", label: "Packed", shortLabel: "Packed", icon: "📋", completed: currentIndex >= 3, isCurrent: order?.status === "PACKED" },
      { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", shortLabel: "On the Way", icon: "🚚", completed: currentIndex >= 4, isCurrent: order?.status === "OUT_FOR_DELIVERY" },
      { key: "DELIVERED", label: "Delivered", shortLabel: "Delivered", icon: "🎉", completed: currentIndex >= 5, isCurrent: order?.status === "DELIVERED" },
    ];
    return steps;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <DashboardLayout title="Track Order" description="Loading order details...">
        <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading order details...</p>
        </div>
      </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout title="Track Order" description="Order not found">
        <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <Link href="/orders" className="text-blue-900 hover:text-blue-800">
            Back to Orders
          </Link>
        </div>
      </div>
      </DashboardLayout>
    );
  }

  const statusSteps = getStatusSteps();

  return (
    <DashboardLayout
      title="Track Order"
      description={`Order #${order._id.slice(-8)}`}
      actionButton={
            <Link
              href="/orders"
          className="flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
              Back to Orders
            </Link>
      }
    >
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-8">
        {/* Order Status Timeline - Amazon/Flipkart Style Horizontal Timeline */}
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-blue-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>📦</span>
                Track Your Order
              </h2>
              <div className="text-right">
                <p className="text-blue-100 text-xs">Order ID</p>
                <p className="text-white font-bold text-sm sm:text-base">#{order._id.slice(-8)}</p>
          </div>
        </div>
      </div>

          <div className="p-4 sm:p-6">
            {/* Horizontal Timeline */}
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                  style={{ 
                    width: `${(statusSteps.filter(s => s.completed).length - 1) * (100 / (statusSteps.length - 1))}%` 
                  }}
                ></div>
              </div>

              {/* Steps */}
              <div className="relative z-10 flex justify-between items-start">
                {statusSteps.map((step, index) => {
                  const isLast = index === statusSteps.length - 1;
                  return (
                    <div key={step.key} className="flex flex-col items-center" style={{ flex: 1 }}>
                      {/* Step Circle */}
                      <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md transition-all duration-300 ${
                        step.isCurrent
                          ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white ring-2 ring-blue-200 scale-110"
                          : step.completed
                          ? "bg-gradient-to-br from-green-500 to-green-600 text-white"
                          : "bg-gray-200 text-gray-400"
                      }`}>
                        {step.completed ? (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-xs">{index + 1}</span>
                        )}
                        {step.isCurrent && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full animate-ping"></div>
                          </div>
                        )}
                      </div>

                      {/* Step Label */}
                      <div className="mt-2 text-center max-w-[80px] sm:max-w-[100px]">
                        <p className={`text-xs sm:text-sm font-semibold ${
                          step.completed ? "text-gray-900" : step.isCurrent ? "text-blue-600" : "text-gray-400"
                        }`}>
                          {step.shortLabel}
                        </p>
                        {step.isCurrent && (
                          <p className="text-[10px] sm:text-xs text-blue-600 font-medium mt-0.5">In Progress</p>
                        )}
                        {step.completed && !step.isCurrent && (
                          <p className="text-[10px] sm:text-xs text-green-600 font-medium mt-0.5">✓ Done</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Status Card */}
            {statusSteps.find(s => s.isCurrent) && (
              <div className="mt-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-lg">
                      {statusSteps.find(s => s.isCurrent)?.icon}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1">
                      {statusSteps.find(s => s.isCurrent)?.label}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-700">
                      {order.status === "OUT_FOR_DELIVERY" && order.deliveryPersonName
                        ? `Your order is on the way! Delivery person: ${order.deliveryPersonName}`
                        : order.status === "PACKED"
                        ? "Your order has been packed and is ready for dispatch"
                        : order.status === "ACCEPTED"
                        ? "Your order has been accepted and is being processed"
                        : order.status === "ORDER_RECEIVED"
                        ? "Your order has been received and is being reviewed"
                        : "Your order has been placed successfully"}
                    </p>
                    {order.estimatedDeliveryTime && order.status === "OUT_FOR_DELIVERY" && (
                      <p className="text-xs font-semibold text-blue-700 mt-1">
                        Estimated delivery: {formatDate(order.estimatedDeliveryTime)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map Section - Full Width */}
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-blue-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>🗺️</span>
                Live Delivery Tracking
              </h2>
              <button
                onClick={() => setShowOrderDetailsModal(true)}
                className="flex items-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-sm font-semibold text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Order Details
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {order.status === "OUT_FOR_DELIVERY" && (order.deliveryLocation || order.pharmacyLocation) ? (
              <div className="space-y-4">
                {/* Delivery Partner Info */}
                {order.deliveryPersonName && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-xl">
                          🚚
              </div>
              <div>
                          <p className="text-sm font-semibold text-green-900">Delivery Partner</p>
                          <p className="font-bold text-gray-900">{order.deliveryPersonName}</p>
                          {order.deliveryPersonPhone && (
                            <a 
                              href={`tel:${order.deliveryPersonPhone}`} 
                              className="text-xs text-green-700 hover:text-green-900 font-medium mt-1 inline-flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {order.deliveryPersonPhone}
                            </a>
                          )}
                        </div>
                      </div>
                      {order.deliveryLocation && (
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-500">Last Updated</p>
                          <p className="text-sm font-bold text-gray-900">{formatDate(order.deliveryLocation.timestamp)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Map Embed */}
                <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100" style={{ height: '500px' }}>
                  {mapUrl ? (
                    <>
                      <iframe
                        src={`https://www.google.com/maps?q=${order.deliveryLocation?.latitude || order.pharmacyLocation?.latitude},${order.deliveryLocation?.longitude || order.pharmacyLocation?.longitude}&output=embed`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="w-full h-full"
                      ></iframe>
                      <div className="absolute top-4 right-4 z-10">
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-lg hover:bg-gray-50 transition-all border border-gray-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open Full Map
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl mb-3">📍</div>
                        <p className="text-gray-600 font-medium">Loading map...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Map Actions */}
                {mapUrl && (
                  <div className="flex gap-3">
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 font-bold text-white shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open in Google Maps
                    </a>
                  </div>
                )}
              </div>
            ) : order.status === "DELIVERED" ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Order Delivered!</h3>
                <p className="text-gray-600 mb-4">Your order has been successfully delivered.</p>
                {order.deliveredAt && (
                  <p className="text-sm text-gray-500">Delivered on {formatDate(order.deliveredAt)}</p>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📍</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Tracking Not Available Yet</h3>
                <p className="text-gray-600">
                  {order.status === "OUT_FOR_DELIVERY" 
                    ? "Map tracking will be available once the delivery partner starts their journey."
                    : "Live tracking will be available when your order is out for delivery."}
                </p>
                </div>
              )}
          </div>
        </div>

        {/* Order Details Modal */}
        {showOrderDetailsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowOrderDetailsModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100/50">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <span>📋</span>
                  Order Details
                </h2>
                <button
                  onClick={() => setShowOrderDetailsModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Order Items */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>💊</span>
                    Order Items
                  </h3>
                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-white rounded-lg p-4 border-2 border-gray-200">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold">
                            {idx + 1}
                          </div>
                          <span className="font-bold text-gray-900">{item.medicineName}</span>
                        </div>
                        <span className="text-sm font-semibold text-blue-900 bg-blue-50 px-3 py-1 rounded-lg">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Information */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>📋</span>
                    Delivery Information
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Delivery Type</p>
                        <p className="font-bold text-gray-900">{order.deliveryType}</p>
                      </div>
                      {order.pharmacy && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pharmacy</p>
                          <p className="font-bold text-gray-900">{order.pharmacy.name}</p>
                        </div>
                      )}
                    </div>

                    {order.deliveryPersonName && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-xl">
                            🚚
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-900">Delivery Person</p>
                            <p className="font-bold text-gray-900">{order.deliveryPersonName}</p>
                          </div>
                        </div>
                        {order.deliveryPersonPhone && (
                          <a 
                            href={`tel:${order.deliveryPersonPhone}`} 
                            className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-semibold bg-white px-4 py-2 rounded-lg border border-green-200 hover:bg-green-50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {order.deliveryPersonPhone}
                          </a>
                        )}
                      </div>
                    )}

                    {order.estimatedDeliveryTime && order.status !== "DELIVERED" && (
                      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border-2 border-yellow-200">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center text-xl">
                            ⏰
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-yellow-900 mb-1">Estimated Delivery</p>
                            <p className="font-bold text-gray-900">{formatDate(order.estimatedDeliveryTime)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.deliveredAt && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-300">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-xl">
                            ✅
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-900 mb-1">Delivered At</p>
                            <p className="font-bold text-gray-900">{formatDate(order.deliveredAt)}</p>
                          </div>
                        </div>
                </div>
              )}
            </div>
          </div>
        </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowOrderDetailsModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 shadow-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

