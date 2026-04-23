"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
// Socket is already initialized in SocketProvider
import DashboardLayout from "@/components/DashboardLayout";
import {
  AppointmentsIcon,
  OrdersIcon,
  TranscriptsIcon,
  InvoicesIcon,
  RecordsIcon,
  NewsIcon,
} from "@/components/icons";

interface Appointment {
  _id: string;
  scheduledAt: string;
  status: string;
  doctor?: { name: string; specialization?: string };
  hospital?: { name: string };
}

interface Order {
  _id: string;
  status: string;
  totalAmount?: number;
  items: Array<{ medicineName: string; quantity: number }>;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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
      // Socket is already initialized in SocketProvider, no need to initialize again
    }
  }, [router]);

  useEffect(() => {
    if (!token || !user?.id) return;

    const fetchData = async () => {
      try {
        const [appointments, prescriptions, orders] = await Promise.all([
          apiGet(`/api/appointments?patientId=${user.id}`).catch(() => []),
          apiGet(`/api/prescriptions?patientId=${user.id}`).catch(() => []),
          apiGet(`/api/orders?patientId=${user.id}`).catch(() => []),
        ]);

        const appointmentsList = Array.isArray(appointments) ? appointments : [];
        const ordersList = Array.isArray(orders) ? orders : [];

        setStats({
          appointments: appointmentsList.length,
          prescriptions: Array.isArray(prescriptions) ? prescriptions.length : 0,
          orders: ordersList.length,
        });

        // Get recent appointments (upcoming or latest 3)
        const sortedAppointments = appointmentsList
          .sort((a: Appointment, b: Appointment) => 
            new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
          )
          .slice(0, 3);
        setRecentAppointments(sortedAppointments);

        // Get recent orders (latest 3)
        const sortedOrders = ordersList
          .sort((a: Order, b: Order) => 
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )
          .slice(0, 3);
        setRecentOrders(sortedOrders);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, user?.id]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-100 text-green-800 border-green-300";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "COMPLETED":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "DELIVERED":
        return "bg-green-100 text-green-800 border-green-300";
      case "OUT_FOR_DELIVERY":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Patient Dashboard" description="Loading your dashboard...">
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
      title="Patient Dashboard"
      description={`Welcome back, ${user?.name || "Patient"}`}
    >
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Stats Cards with Gradient */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg transition-transform hover:scale-105">
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                  <AppointmentsIcon className="w-8 h-8 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Total</p>
                  <p className="text-3xl font-bold">{stats?.appointments || 0}</p>
              </div>
              </div>
              <p className="text-lg font-semibold">Appointments</p>
              <p className="text-sm opacity-90">Your medical appointments</p>
            </div>
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"></div>
            <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-white/10"></div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg transition-transform hover:scale-105">
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Total</p>
                  <p className="text-3xl font-bold">{stats?.prescriptions || 0}</p>
              </div>
              </div>
              <p className="text-lg font-semibold">Prescriptions</p>
              <p className="text-sm opacity-90">Your prescriptions</p>
            </div>
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"></div>
            <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-white/10"></div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg transition-transform hover:scale-105">
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                  <OrdersIcon className="w-8 h-8 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Total</p>
                  <p className="text-3xl font-bold">{stats?.orders || 0}</p>
              </div>
              </div>
              <p className="text-lg font-semibold">Orders</p>
              <p className="text-sm opacity-90">Medicine orders</p>
            </div>
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"></div>
            <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-white/10"></div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Quick Actions - Left Column */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
              <h2 className="mb-4 sm:mb-6 text-lg sm:text-xl font-bold text-gray-900">Quick Actions</h2>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <Link
                  href="/appointments/book"
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100 p-5 transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div className="relative z-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500 text-white">
                      <AppointmentsIcon className="w-6 h-6" />
                    </div>
                    <h3 className="mb-1 font-bold text-gray-900 group-hover:text-blue-700">Book Appointment</h3>
                    <p className="text-sm text-gray-600">Schedule a new appointment</p>
                  </div>
                  <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-blue-300 text-6xl">→</span>
                  </div>
            </Link>

                <Link
                  href="/appointments"
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-green-50 to-green-100 p-5 transition-all hover:border-green-300 hover:shadow-md"
                >
                  <div className="relative z-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500 text-white">
                      <AppointmentsIcon className="w-6 h-6" />
                    </div>
                    <h3 className="mb-1 font-bold text-gray-900 group-hover:text-green-700">My Appointments</h3>
                    <p className="text-sm text-gray-600">View and manage appointments</p>
                  </div>
                  <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-green-300 text-6xl">→</span>
                  </div>
            </Link>

                <Link
                  href="/orders"
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-purple-50 to-purple-100 p-5 transition-all hover:border-purple-300 hover:shadow-md"
                >
                  <div className="relative z-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500 text-white">
                      <OrdersIcon className="w-6 h-6" />
                    </div>
                    <h3 className="mb-1 font-bold text-gray-900 group-hover:text-purple-700">My Orders</h3>
                    <p className="text-sm text-gray-600">View and track medicine orders</p>
                  </div>
                  <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-purple-300 text-6xl">→</span>
                  </div>
            </Link>

                <Link
                  href="/transcripts"
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-orange-50 to-orange-100 p-5 transition-all hover:border-orange-300 hover:shadow-md"
                >
                  <div className="relative z-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500 text-white">
                      <TranscriptsIcon className="w-6 h-6" />
                    </div>
                    <h3 className="mb-1 font-bold text-gray-900 group-hover:text-orange-700">Transcripts</h3>
                    <p className="text-sm text-gray-600">View consultation history</p>
                  </div>
                  <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-orange-300 text-6xl">→</span>
                  </div>
            </Link>

                <Link
                  href="/invoices"
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-indigo-50 to-indigo-100 p-5 transition-all hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="relative z-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500 text-white">
                      <InvoicesIcon className="w-6 h-6" />
                    </div>
                    <h3 className="mb-1 font-bold text-gray-900 group-hover:text-indigo-700">Invoices & Bills</h3>
                    <p className="text-sm text-gray-600">Download prescriptions and invoices</p>
                  </div>
                  <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-indigo-300 text-6xl">→</span>
                  </div>
            </Link>

                <Link
                  href="/records"
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-teal-50 to-teal-100 p-5 transition-all hover:border-teal-300 hover:shadow-md"
                >
                  <div className="relative z-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-500 text-white">
                      <RecordsIcon className="w-6 h-6" />
                    </div>
                    <h3 className="mb-1 font-bold text-gray-900 group-hover:text-teal-700">Medical Records</h3>
                    <p className="text-sm text-gray-600">View and manage medical history</p>
                  </div>
                  <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-teal-300 text-6xl">→</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Activity - Right Column */}
          <div className="space-y-4 sm:space-y-6">
            {/* Recent Appointments */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Recent Appointments</h2>
                <Link
                  href="/appointments"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  View All
                </Link>
              </div>
              {recentAppointments.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-500">No appointments yet</p>
                  <Link
                    href="/appointments/book"
                    className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Book Now →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAppointments.map((apt) => (
                    <Link
                      key={apt._id}
                      href="/appointments"
                      className="block rounded-lg border border-gray-200 p-4 transition-all hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {apt.doctor?.name || "Doctor"}
                          </p>
                          {apt.doctor?.specialization && (
                            <p className="text-xs text-gray-500">{apt.doctor.specialization}</p>
                          )}
                          <p className="mt-1 text-xs text-gray-600">{formatDate(apt.scheduledAt)}</p>
                        </div>
                        <span className={`ml-2 rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(apt.status)}`}>
                          {apt.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Orders */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Recent Orders</h2>
                <Link
                  href="/orders"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  View All
                </Link>
              </div>
              {recentOrders.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-500">No orders yet</p>
                  <Link
                    href="/orders/new"
                    className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Order Now →
            </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
            <Link
                      key={order._id}
                      href="/orders"
                      className="block rounded-lg border border-gray-200 p-4 transition-all hover:border-purple-300 hover:bg-purple-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            Order #{order._id.slice(-8)}
                          </p>
                          <p className="text-xs text-gray-600">
                            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                          </p>
                          {order.totalAmount && (
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              ₹{order.totalAmount.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <span className={`ml-2 rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
            </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
