"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";

interface Appointment {
  _id: string;
  patientId: string;
  patientName: string;
  age: number;
  issue: string;
  address: string;
  scheduledAt: string;
  status: string;
  channel: string;
  doctorId?: string;
  doctor?: { name: string; specialization?: string };
  hospital?: { name: string };
}

export default function ReschedulePage() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to fetch and map doctor data
  const fetchDoctorData = async (doctorId: string): Promise<{ name: string; specialization?: string } | undefined> => {
    try {
      const response = await apiGet<{ name: string; specialization?: string }>(`/api/users/${doctorId}`);
      if (response && response.name) {
        return {
          name: String(response.name),
          specialization: response.specialization ? String(response.specialization) : undefined,
        };
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  // Helper function to fetch and map hospital data
  const fetchHospitalData = async (hospitalId: string): Promise<{ name: string } | undefined> => {
    try {
      const response = await apiGet<{ name: string }>(`/api/master/hospitals/${hospitalId}`);
      if (response && response.name) {
        return {
          name: String(response.name),
        };
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  // Helper function to map raw appointment data to Appointment type
  const mapToAppointment = async (rawData: any): Promise<Appointment> => {
    // Fetch doctor and hospital in parallel if IDs exist
    const [doctorData, hospitalData] = await Promise.all([
      rawData.doctorId ? fetchDoctorData(String(rawData.doctorId)) : Promise.resolve(undefined),
      rawData.hospitalId ? fetchHospitalData(String(rawData.hospitalId)) : Promise.resolve(undefined),
    ]);

    // Return properly typed Appointment object
    return {
      _id: String(rawData._id ?? ""),
      patientId: String(rawData.patientId ?? ""),
      patientName: String(rawData.patientName ?? ""),
      age: Number(rawData.age ?? 0),
      issue: String(rawData.issue ?? ""),
      address: String(rawData.address ?? ""),
      scheduledAt: String(rawData.scheduledAt ?? ""),
      status: String(rawData.status ?? ""),
      channel: String(rawData.channel ?? ""),
      doctorId: rawData.doctorId ? String(rawData.doctorId) : undefined,
      doctor: doctorData,
      hospital: hospitalData,
    };
  };

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!appointmentId) {
        setLoading(false);
        return;
      }
      
      try {
        // Fetch appointment data
        const rawAppointmentData = await apiGet<any>(`/api/appointments/${appointmentId}`);
        
        // Set initial date/time from existing appointment
        if (rawAppointmentData?.scheduledAt) {
          const currentDate = new Date(rawAppointmentData.scheduledAt);
          setRescheduleDate(currentDate.toISOString().split("T")[0]);
          setRescheduleTime(currentDate.toTimeString().slice(0, 5));
        }

        // Map to properly typed Appointment using helper function
        const typedAppointment = await mapToAppointment(rawAppointmentData);
        setAppointment(typedAppointment);
      } catch (error: any) {
        console.error("Error fetching appointment:", error);
        setError("Failed to load appointment. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [appointmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!rescheduleDate || !rescheduleTime || !rescheduleReason.trim()) {
      setError("Please fill all fields");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`);
      
      await apiPatch(`/api/appointments/${appointmentId}/reschedule`, {
        scheduledAt: newDateTime.toISOString(),
        rescheduleReason: rescheduleReason.trim(),
      });

      alert("Appointment rescheduled successfully!");
      router.push("/appointments");
    } catch (error: any) {
      console.error("Error rescheduling appointment:", error);
      setError("Failed to reschedule appointment: " + (error.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Reschedule Appointment" description="Loading appointment details...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!appointment) {
    return (
      <DashboardLayout title="Reschedule Appointment" description="Appointment not found">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Appointment Not Found</h2>
            <button
              onClick={() => router.push("/appointments")}
              className="text-blue-900 hover:text-blue-800"
            >
              Back to Appointments
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Reschedule Appointment"
      description={`Patient: ${appointment.patientName}`}
    >
      <div className="max-w-2xl mx-auto">
        <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          {/* Appointment Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Current Appointment Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Patient:</span>
                <span className="font-semibold text-gray-900">{appointment.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Age:</span>
                <span className="font-semibold text-gray-900">{appointment.age} years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Issue:</span>
                <span className="font-semibold text-gray-900">{appointment.issue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Date/Time:</span>
                <span className="font-semibold text-gray-900">
                  {new Date(appointment.scheduledAt).toLocaleString()}
                </span>
              </div>
              {appointment.doctor && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Doctor:</span>
                  <span className="font-semibold text-gray-900">{appointment.doctor.name}</span>
                </div>
              )}
              {appointment.hospital && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Hospital:</span>
                  <span className="font-semibold text-gray-900">{appointment.hospital.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reschedule Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                New Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                required
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                New Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Reason for Rescheduling <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                required
                rows={4}
                placeholder="Please provide a reason for rescheduling this appointment..."
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/appointments")}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-blue-900 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Rescheduling..." : "Reschedule Appointment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

