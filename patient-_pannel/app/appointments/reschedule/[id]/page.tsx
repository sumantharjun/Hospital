"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiGet, apiPatch } from "@/lib/api";

interface Appointment {
  _id: string;
  doctorId: string;
  hospitalId: string;
  scheduledAt: string;
  doctor?: { name: string };
}

interface Slot {
  _id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  date: string;
}

export default function ReschedulePage() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
    }
  }, [router]);

  const fetchAppointment = async () => {
    if (!token || !appointmentId) return;
    
    try {
      const data = await apiGet<Appointment>(`/api/appointments/${appointmentId}`);
      setAppointment(data);
      
      // Fetch doctor details
      if (data.doctorId) {
        const doctorData = await apiGet<{ name: string }>(`/api/users/${data.doctorId}`).catch(() => null);
        setAppointment({ ...data, doctor: doctorData || undefined });
      }
    } catch (error: any) {
      console.error("Error fetching appointment:", error);
      toast.error("Failed to load appointment details");
      router.push("/appointments");
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async (doctorId: string, date: string, hospitalId: string) => {
    try {
      const data = await apiGet<Slot[]>(
        `/api/schedules/slots/available?doctorId=${doctorId}&date=${date}&hospitalId=${hospitalId}`
      );
      setSlots(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching slots:", error);
      setSlots([]);
    }
  };

  useEffect(() => {
    if (!token || !appointmentId) return;
    fetchAppointment();
  }, [token, appointmentId]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    if (appointment) {
      fetchSlots(appointment.doctorId, date, appointment.hospitalId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !appointment || !selectedSlot) return;

    setSubmitting(true);
    try {
      const slot = slots.find(s => s._id === selectedSlot);
      const newScheduledAt = slot ? new Date(slot.startTime).toISOString() : new Date(selectedDate).toISOString();

      await apiPatch(`/api/appointments/${appointmentId}/reschedule`, {
        scheduledAt: newScheduledAt,
        reason: reason || "Rescheduled by patient",
      });

      toast.success("Appointment rescheduled successfully!");
      setTimeout(() => {
        router.push("/appointments");
      }, 1000);
    } catch (error: any) {
      toast.error("Failed to reschedule appointment: " + (error.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push(date.toISOString().split("T")[0]);
    }
    return days;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading appointment...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Appointment Not Found</h2>
          <Link href="/appointments" className="text-blue-900 hover:text-blue-800">
            Back to Appointments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-300 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reschedule Appointment</h1>
              <p className="mt-1 text-sm text-gray-600">
                Current: {new Date(appointment.scheduledAt).toLocaleString()}
              </p>
            </div>
            <Link
              href="/appointments"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Reschedule with {appointment.doctor?.name || "Doctor"}
            </h2>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Select New Date</label>
            <div className="grid grid-cols-7 gap-2">
              {getNext7Days().map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => handleDateSelect(date)}
                  className={`rounded-lg border p-3 text-sm font-semibold ${
                    selectedDate === date
                      ? "border-blue-900 bg-blue-50 text-blue-900"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {new Date(date).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                </button>
              ))}
            </div>
          </div>

          {selectedDate && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Available Time Slots</label>
              {slots.length === 0 ? (
                <p className="text-gray-600">No slots available for this date.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots
                    .filter(slot => !slot.isBooked)
                    .map((slot) => {
                      const startTime = new Date(slot.startTime).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <button
                          key={slot._id}
                          type="button"
                          onClick={() => setSelectedSlot(slot._id)}
                          className={`rounded-lg border p-3 text-sm font-semibold ${
                            selectedSlot === slot._id
                              ? "border-blue-900 bg-blue-50 text-blue-900"
                              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {startTime}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Reason for Rescheduling (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
              placeholder="Enter reason for rescheduling..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedSlot}
            className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
          >
            {submitting ? "Rescheduling..." : "Reschedule Appointment"}
          </button>
        </form>
      </div>
    </div>
  );
}

