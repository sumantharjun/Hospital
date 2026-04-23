"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";
import DashboardLayout from "@/components/DashboardLayout";
import AppointmentCard from "@/components/AppointmentCard";

interface Appointment {
  _id: string;
  patientId: string;
  patientName: string;
  age: number;
  address: string;
  issue: string;
  scheduledAt: string;
  status: string;
  channel: string;
  reportFile?: string;
  reportFileName?: string;
  patient?: { name: string; phone?: string };
  hospital?: { name: string };
}

function AppointmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "completed">(
    (searchParams?.get("filter") as any) || "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

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

  const fetchAppointments = async () => {
    if (!token || !user?.id) return;
    
    try {
      const statusFilter = filter !== "all" ? `&status=${filter.toUpperCase()}` : "";
      const data = await apiGet<any[]>(`/api/appointments?doctorId=${user.id}${statusFilter}`);
      const appointmentsList = Array.isArray(data) ? data : [];
      
      // Enrich with patient and hospital data
      const enrichedAppointments: Appointment[] = await Promise.all(
        appointmentsList.map(async (apt: any): Promise<Appointment> => {
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

          // Map to Appointment type, ensuring all required fields are present
          return {
            _id: String(apt._id ?? ""),
            patientId: String(apt.patientId ?? ""),
            patientName: String(apt.patientName ?? ""),
            age: Number(apt.age ?? 0),
            address: String(apt.address ?? ""),
            issue: String(apt.issue ?? ""),
            scheduledAt: String(apt.scheduledAt ?? ""),
            status: String(apt.status ?? ""),
            channel: String(apt.channel ?? ""),
            reportFile: apt.reportFile ? String(apt.reportFile) : undefined,
            reportFileName: apt.reportFileName ? String(apt.reportFileName) : undefined,
            patient,
            hospital,
          };
        })
      );
      
      setAppointments(enrichedAppointments);
      setFilteredAppointments(enrichedAppointments);
    } catch (error: any) {
      console.error("Error fetching appointments:", error);
      setAppointments([]);
      setFilteredAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search appointments
  useEffect(() => {
    let filtered = [...appointments];

    // Apply status filter
    if (filter !== "all") {
      filtered = filtered.filter((apt) => apt.status === filter.toUpperCase());
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (apt) =>
          apt.patientName.toLowerCase().includes(query) ||
          apt.issue.toLowerCase().includes(query) ||
          apt.address.toLowerCase().includes(query) ||
          apt.patient?.name?.toLowerCase().includes(query) ||
          apt.patient?.phone?.includes(query)
      );
    }

    // Sort by scheduled date (most recent first)
    filtered.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

    setFilteredAppointments(filtered);
  }, [appointments, filter, searchQuery]);

  useEffect(() => {
    if (!token || !user?.id) return;
    fetchAppointments();
  }, [token, user?.id, filter]);

  // Listen for real-time updates
  useEffect(() => {
    if (!token || !user?.id) return;

    const socket = getSocket();
    if (!socket) return;

    const handleAppointmentUpdate = () => {
      fetchAppointments();
    };

    onSocketEvent("appointment:created", handleAppointmentUpdate);
    onSocketEvent("appointment:statusUpdated", handleAppointmentUpdate);
    
    return () => {
      offSocketEvent("appointment:created", handleAppointmentUpdate);
      offSocketEvent("appointment:statusUpdated", handleAppointmentUpdate);
    };
  }, [token, user?.id]);

  const handleStatusUpdate = async (appointmentId: string, status: string) => {
    if (!token) return;
    try {
      await apiPatch(`/api/appointments/${appointmentId}`, { status });
      await fetchAppointments();
    } catch (error: any) {
      console.error("Error updating appointment status:", error);
      alert("Failed to update appointment: " + (error.message || "Unknown error"));
    }
  };

  const handleReschedule = async (appointmentId: string, newDate: string, reason: string) => {
    if (!token) return;
    try {
      await apiPatch(`/api/appointments/${appointmentId}`, {
        scheduledAt: newDate,
        rescheduleReason: reason,
      });
      await fetchAppointments();
    } catch (error: any) {
      console.error("Error rescheduling appointment:", error);
      alert("Failed to reschedule appointment: " + (error.message || "Unknown error"));
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Appointments" description="Loading your appointments...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading appointments...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Appointments"
      description="Manage your appointments"
    >
      <div className="max-w-7xl mx-auto">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name, issue, address, or phone..."
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pl-10 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "confirmed", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  filter === f
                    ? "bg-blue-900 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== "all" && (
                  <span className="ml-2 text-xs opacity-75">
                    ({appointments.filter((apt) => apt.status === f.toUpperCase()).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Appointments List */}
        {filteredAppointments.length === 0 ? (
          <div className="rounded-lg border border-gray-300 bg-white p-12 text-center shadow-sm">
            <div className="text-6xl mb-4">
              {appointments.length === 0 ? "📅" : "🔍"}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {appointments.length === 0
                ? "No Appointments"
                : "No Appointments Found"}
            </h2>
            <p className="text-gray-600">
              {appointments.length === 0
                ? "You don't have any appointments yet."
                : searchQuery
                ? `No appointments match "${searchQuery}". Try a different search.`
                : `No appointments with status "${filter}".`}
            </p>
            {searchQuery && appointments.length > 0 && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-2">
              Showing {filteredAppointments.length} of {appointments.length} appointment{appointments.length !== 1 ? "s" : ""}
            </div>
            {filteredAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment._id}
                appointment={appointment}
                onUpdate={fetchAppointments}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout title="Appointments" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    }>
      <AppointmentsContent />
    </Suspense>
  );
}

