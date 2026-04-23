"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPatch } from "@/lib/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";
import DashboardLayout from "@/components/DashboardLayout";

interface Appointment {
  _id: string;
  patientId: string;
  patientName: string;
  age: number;
  issue: string;
  scheduledAt: string;
  status: string;
  channel: string;
  hospitalId?: string;
  patient?: { name: string; phone?: string };
  hospital?: { name: string };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    today: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
  });
  const [isOnline, setIsOnline] = useState(true);
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
      setIsOnline(userData.status === "AVAILABLE" || !userData.status);
      // Socket is already initialized in SocketProvider, just get it
      const socket = getSocket();
      const userId = userData.id || userData._id;
      
      // Register user as online with backend (tracks login time)
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
      fetch(`${API_BASE}/api/users/${userId}/online`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storedToken}`,
        },
      }).then(() => {
        console.log("Registered user as online via API:", userId);
      }).catch((err) => {
        console.error("Failed to register as online:", err);
      });
      
      // Emit user online event when dashboard loads (this makes them show as "Online" in admin)
      // This is the REAL-TIME status tracking - only when socket is connected
      const emitOnlineEvent = () => {
        if (socket && socket.connected) {
          console.log("Emitting user:online event for userId:", userId);
          socket.emit("user:online", { userId });
        }
      };
      
      if (socket) {
        if (socket.connected) {
          emitOnlineEvent();
        } else {
          socket.once("connect", () => {
            console.log("Socket connected, emitting user:online");
            emitOnlineEvent();
          });
        }
      }
      
      // Update status to AVAILABLE in database (for doctor's own panel toggle)
      if (userData.status !== "AVAILABLE") {
        apiPatch(`/api/users/${userId}`, { 
          status: "AVAILABLE" 
        }).catch(console.error);
      }
    }
  }, [router]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!token || !user?.id) return;

    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = () => {
      // Refresh dashboard data when new notification arrives
      fetchDashboardData();
    };

    const handleNewAppointment = () => {
      // Refresh appointments when new appointment is created
      fetchDashboardData();
    };

    onSocketEvent("notification:new", handleNewNotification);
    onSocketEvent("appointment:created", handleNewAppointment);
    onSocketEvent("appointment:statusUpdated", handleNewNotification);
    
    return () => {
      offSocketEvent("notification:new", handleNewNotification);
      offSocketEvent("appointment:created", handleNewAppointment);
      offSocketEvent("appointment:statusUpdated", handleNewNotification);
    };
  }, [token, user?.id]);

  const fetchDashboardData = async () => {
    if (!token || !user?.id) {
        setLoading(false);
        return;
      }
      
      try {
      const [allAppointments] = await Promise.all([
        apiGet<any[]>(`/api/appointments?doctorId=${user.id}`).catch(() => []),
      ]);

      const appointments = Array.isArray(allAppointments) ? allAppointments : [];
      
      // Get today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrow = new Date(todayStart);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Filter today's appointments
      const todayAppts = appointments.filter((apt: any) => {
        const aptDate = new Date(apt.scheduledAt);
        return aptDate >= todayStart && aptDate < tomorrow && apt.status !== "CANCELLED";
      });

      // Filter pending appointments
      const pending = appointments.filter((apt: any) => apt.status === "PENDING");

      // Enrich with patient and hospital data
      const enrichedToday: Appointment[] = await Promise.all(
        todayAppts.map(async (apt: any): Promise<Appointment> => {
          let patient: { name: string; phone?: string } | undefined;
          let hospital: { name: string } | undefined;

          // Fetch patient data
          try {
            const patientData = await apiGet<{ name: string; phone?: string }>(`/api/users/${apt.patientId}`);
            if (patientData?.name) {
              patient = {
                name: String(patientData.name),
                phone: patientData.phone ? String(patientData.phone) : undefined,
              };
            }
          } catch {
            // Keep patient as undefined on error
          }

          // Fetch hospital data if hospitalId exists
          if (apt.hospitalId) {
            try {
              const hospitalData = await apiGet<{ name: string }>(`/api/master/hospitals/${apt.hospitalId}`);
              if (hospitalData?.name) {
                hospital = {
                  name: String(hospitalData.name),
                };
              }
            } catch {
              // Keep hospital as undefined on error
            }
          }

          return {
            _id: String(apt._id ?? ""),
            patientId: String(apt.patientId ?? ""),
            patientName: String(apt.patientName ?? ""),
            age: Number(apt.age ?? 0),
            issue: String(apt.issue ?? ""),
            scheduledAt: String(apt.scheduledAt ?? ""),
            status: String(apt.status ?? ""),
            channel: String(apt.channel ?? ""),
            hospitalId: apt.hospitalId ? String(apt.hospitalId) : undefined,
            patient,
            hospital,
          };
        })
      );

      const enrichedPending: Appointment[] = await Promise.all(
        pending.map(async (apt: any): Promise<Appointment> => {
          let patient: { name: string; phone?: string } | undefined;
          let hospital: { name: string } | undefined;

          // Fetch patient data
          try {
            const patientData = await apiGet<{ name: string; phone?: string }>(`/api/users/${apt.patientId}`);
            if (patientData?.name) {
              patient = {
                name: String(patientData.name),
                phone: patientData.phone ? String(patientData.phone) : undefined,
              };
            }
          } catch {
            // Keep patient as undefined on error
          }

          // Fetch hospital data if hospitalId exists
          if (apt.hospitalId) {
            try {
              const hospitalData = await apiGet<{ name: string }>(`/api/master/hospitals/${apt.hospitalId}`);
              if (hospitalData?.name) {
                hospital = {
                  name: String(hospitalData.name),
                };
              }
            } catch {
              // Keep hospital as undefined on error
            }
          }

          return {
            _id: String(apt._id ?? ""),
            patientId: String(apt.patientId ?? ""),
            patientName: String(apt.patientName ?? ""),
            age: Number(apt.age ?? 0),
            issue: String(apt.issue ?? ""),
            scheduledAt: String(apt.scheduledAt ?? ""),
            status: String(apt.status ?? ""),
            channel: String(apt.channel ?? ""),
            hospitalId: apt.hospitalId ? String(apt.hospitalId) : undefined,
            patient,
            hospital,
          };
        })
      );

      setTodayAppointments(enrichedToday);
      setPendingAppointments(enrichedPending);

        setStats({
        today: todayAppts.length,
        pending: pending.length,
        confirmed: appointments.filter((apt) => apt.status === "CONFIRMED").length,
        completed: appointments.filter((apt) => apt.status === "COMPLETED").length,
        });
      } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (!token || !user?.id) return;
    fetchDashboardData();
  }, [token, user?.id]);

  // Listen for real-time updates
  useEffect(() => {
    if (!token || !user?.id) return;

    const socket = getSocket();
    if (!socket) return;

    const handleAppointmentUpdate = () => {
      fetchDashboardData();
    };

    onSocketEvent("appointment:created", handleAppointmentUpdate);
    onSocketEvent("appointment:statusUpdated", handleAppointmentUpdate);
    
    return () => {
      offSocketEvent("appointment:created", handleAppointmentUpdate);
      offSocketEvent("appointment:statusUpdated", handleAppointmentUpdate);
    };
  }, [token, user?.id]);

  const toggleStatus = async () => {
    if (!token || !user?.id) return;
    
    try {
      const newStatus = isOnline ? "OFFLINE" : "AVAILABLE";
      await apiPatch(`/api/users/${user.id}`, { status: newStatus });
      setIsOnline(!isOnline);
      const updatedUser = { ...user, status: newStatus };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      // Emit socket event to notify admin panel immediately
      const socket = getSocket();
      const userId = user.id || user._id;
      
      const emitStatusEvent = () => {
        if (socket && socket.connected) {
          if (newStatus === "AVAILABLE") {
            console.log("Emitting user:online event for userId:", userId);
            socket.emit("user:online", { userId });
          } else {
            console.log("Emitting user:offline event for userId:", userId);
            socket.emit("user:offline", { userId });
          }
        }
      };
      
      if (socket && socket.connected) {
        emitStatusEvent();
      } else if (socket) {
        socket.once("connect", () => {
          console.log("Socket connected, emitting status event");
          emitStatusEvent();
        });
      }
    } catch (error: any) {
      alert("Failed to update status: " + (error.message || "Unknown error"));
    }
  };

  const handleAcceptAppointment = async (appointmentId: string) => {
    try {
      await apiPatch(`/api/appointments/${appointmentId}/status`, { status: "CONFIRMED" });
      fetchDashboardData();
      alert("Appointment accepted successfully!");
    } catch (error: any) {
      alert("Failed to accept appointment: " + (error.message || "Unknown error"));
    }
  };

  const handleRejectAppointment = async (appointmentId: string) => {
    const reason = prompt("Please provide a reason for rejection:");
    if (!reason) return;
    
    try {
      await apiPatch(`/api/appointments/${appointmentId}/cancel`, {
        cancellationReason: reason,
      });
      fetchDashboardData();
      alert("Appointment rejected successfully!");
    } catch (error: any) {
      alert("Failed to reject appointment: " + (error.message || "Unknown error"));
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <DashboardLayout title="Doctor Dashboard" description="Loading your dashboard...">
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
      title="Doctor Dashboard"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Status Toggle & Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Online/Offline Status */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  isOnline ? "bg-green-100" : "bg-gray-100"
                }`}>
                  <div className={`h-8 w-8 rounded-full ${
                    isOnline ? "bg-green-500" : "bg-gray-400"
                  }`}></div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</p>
                  <p className={`text-lg font-bold ${isOnline ? "text-green-600" : "text-gray-500"}`}>
                    {isOnline ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={toggleStatus}
              className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all ${
                isOnline
                  ? "bg-gray-600 hover:bg-gray-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isOnline ? "Go Offline" : "Go Online"}
            </button>
          </div>

          {/* Today's Appointments */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Today's Appointments</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.today}</p>
              </div>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-50">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending Approvals</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pending}</p>
              </div>
            </div>
          </div>

          {/* Completed */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Appointments - Quick Actions */}
        {pendingAppointments.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Pending Approvals</h2>
              <Link
                href="/appointments?filter=pending"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {pendingAppointments.slice(0, 3).map((appointment) => (
                <div
                  key={appointment._id}
                  className="flex items-center justify-between p-5 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">{appointment.patientName}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Age: {appointment.age} | {appointment.issue}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(appointment.scheduledAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })} at {formatTime(appointment.scheduledAt)}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAcceptAppointment(appointment._id)}
                      className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRejectAppointment(appointment._id)}
                      className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Appointments */}
        {todayAppointments.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Today's Appointments</h2>
              <Link
                href="/appointments"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {todayAppointments.map((appointment) => (
                <div
                  key={appointment._id}
                  className="flex items-center justify-between p-5 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg">{appointment.patientName}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          appointment.status === "CONFIRMED"
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                        }`}
                      >
                        {appointment.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {appointment.issue} | {appointment.channel === "VIDEO" ? "Online" : "Offline"}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {formatTime(appointment.scheduledAt)}
                      {appointment.hospital && ` | ${appointment.hospital.name}`}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {appointment.status === "CONFIRMED" && (
                      <Link
                        href={`/consultation/${appointment._id}`}
                        className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
                      >
                        Start Consultation
                      </Link>
                    )}
                    <Link
                      href={`/patients/${appointment.patientId}`}
                      className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
                    >
                      View History
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/appointments"
              className="rounded-lg border border-gray-200 bg-white p-5 transition-all hover:bg-gray-50 hover:shadow-md hover:border-gray-300"
            >
              <div className="text-2xl mb-2">📅</div>
              <h3 className="font-bold text-gray-900 mb-1">Manage Appointments</h3>
              <p className="text-sm text-gray-600 leading-[100%]">Accept, reject, or reschedule</p>
            </Link>
            <Link
              href="/schedule"
              className="rounded-lg border border-gray-200 bg-white p-5 transition-all hover:bg-gray-50 hover:shadow-md hover:border-gray-300"
            >
              <div className="text-2xl mb-2">⏰</div>
              <h3 className="font-bold text-gray-900 mb-1">Set Availability</h3>
              <p className="text-sm text-gray-600 leading-[100%]">Manage your schedule</p>
            </Link>
            <Link
              href="/news"
              className="rounded-lg border border-gray-200 bg-white p-5 transition-all hover:bg-gray-50 hover:shadow-md hover:border-gray-300"
            >
              <div className="text-2xl mb-2">🔔</div>
              <h3 className="font-bold text-gray-900 mb-1">Notifications</h3>
              <p className="text-sm text-gray-600 leading-[100%]">Check updates</p>
            </Link>
            <Link
              href="/settings/mfa"
              className="rounded-lg border border-gray-200 bg-white p-5 transition-all hover:bg-gray-50 hover:shadow-md hover:border-gray-300"
            >
              <div className="text-2xl mb-2">🔐</div>
              <h3 className="font-bold text-gray-900 mb-1">Security</h3>
              <p className="text-sm text-gray-600 leading-[100%]">Setup MFA</p>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
