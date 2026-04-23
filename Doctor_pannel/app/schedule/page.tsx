"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { initializeSocket, getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";

interface Schedule {
  _id: string;
  doctorId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isActive: boolean;
  maxAppointmentsPerSlot: number;
  hospitalId?: string;
}

interface Slot {
  _id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isBlocked: boolean;
  date: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ENUMS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const getDayName = (dayEnum: string): string => {
  const index = DAY_ENUMS.indexOf(dayEnum.toLowerCase());
  return index >= 0 ? DAYS[index] : dayEnum;
};

export default function SchedulePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [upcomingSlots, setUpcomingSlots] = useState<Slot[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [formData, setFormData] = useState({
    dayOfWeek: "monday",
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: 30,
    isActive: true,
    maxAppointmentsPerSlot: 1,
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

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

  const fetchSchedules = async () => {
    if (!token || !user?.id) return;
    
    try {
      setApiError(null);
      const data = await apiGet<Schedule[]>(`/api/schedules/doctor-schedule/${user.id}`);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Error fetching schedules:", error);
      if (error.isNetworkError || error.message?.includes("connect to server")) {
        setApiError("Unable to connect to backend server. Please ensure the server is running on http://localhost:4000");
      } else {
        setApiError(error.message || "Failed to load schedules");
      }
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingSlots = async () => {
    if (!token || !user?.id || !selectedDate) return;
    
    try {
      const slots = await apiGet<Slot[]>(
        `/api/schedules/slots/doctor/${user.id}?date=${selectedDate}`
      );
      setUpcomingSlots(Array.isArray(slots) ? slots : []);
    } catch (error: any) {
      console.error("Error fetching slots:", error);
      // Don't show error toast for network errors
      if (error.isNetworkError) {
        console.warn("Backend server may not be running:", error.message);
      }
      setUpcomingSlots([]);
    }
  };

  useEffect(() => {
    if (!token || !user?.id) return;
    fetchSchedules();
    
    // Socket is already initialized in SocketProvider, no need to initialize again
  }, [token, user?.id]);
  
  // Listen for real-time slot updates
  useEffect(() => {
    if (!token || !user?.id) return;
    
    const socket = getSocket();
    if (!socket) return;
    
    const handleSlotUpdate = (data: any) => {
      // If slot update is for this doctor, refresh slots
      if (data.doctorId === user.id) {
        fetchUpcomingSlots();
      }
    };
    
    const handleSlotsGenerated = (data: any) => {
      // If slots generated for this doctor, refresh
      if (data.doctorId === user.id) {
        fetchUpcomingSlots();
      }
    };
    
    onSocketEvent("slot:updated", handleSlotUpdate);
    onSocketEvent("slots:generated", handleSlotsGenerated);
    
    return () => {
      offSocketEvent("slot:updated", handleSlotUpdate);
      offSocketEvent("slots:generated", handleSlotsGenerated);
    };
  }, [token, user?.id, selectedDate]);

  useEffect(() => {
    if (!token || !user?.id) return;
    fetchUpcomingSlots();
  }, [token, user?.id, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user?.id) return;

    if (isNaN(formData.slotDuration) || formData.slotDuration < 30 || formData.slotDuration > 60) {
      alert("Slot duration must be between 30 and 60 minutes");
      return;
    }

    if (isNaN(formData.maxAppointmentsPerSlot) || formData.maxAppointmentsPerSlot < 1) {
      alert("Max appointments per slot must be at least 1");
      return;
    }

    if (!formData.startTime || !formData.endTime) {
      alert("Please provide both start and end times");
      return;
    }

    try {
      if (editingSchedule && editingSchedule.dayOfWeek !== formData.dayOfWeek) {
        try {
          await apiDelete(`/api/schedules/doctor-schedule/${editingSchedule._id}`);
        } catch (deleteError: any) {
          console.warn("Failed to delete old schedule:", deleteError);
        }
      }

      await apiPost("/api/schedules/doctor-schedule", {
        doctorId: user.id,
        hospitalId: user.hospitalId,
        dayOfWeek: formData.dayOfWeek,
        startTime: formData.startTime,
        endTime: formData.endTime,
        slotDuration: formData.slotDuration,
        isActive: formData.isActive,
        maxAppointmentsPerSlot: formData.maxAppointmentsPerSlot,
      });
      
      fetchSchedules();
      setEditingSchedule(null);
      setFormData({
        dayOfWeek: "monday",
        startTime: "09:00",
        endTime: "17:00",
        slotDuration: 30,
        isActive: true,
        maxAppointmentsPerSlot: 1,
      });
      alert("Schedule saved successfully!");
    } catch (error: any) {
      console.error("Error saving schedule:", error);
      alert(`Failed to save schedule: ${error.message || "Unknown error"}`);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      slotDuration: schedule.slotDuration,
      isActive: schedule.isActive,
      maxAppointmentsPerSlot: schedule.maxAppointmentsPerSlot,
    });
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    
    try {
      await apiDelete(`/api/schedules/doctor-schedule/${scheduleId}`);
      fetchSchedules();
      alert("Schedule deleted successfully!");
    } catch (error: any) {
      alert("Failed to delete schedule: " + (error.message || "Unknown error"));
    }
  };

  const handleToggleSlotBlock = async (slotId: string, isBlocked: boolean) => {
    try {
      if (isBlocked) {
        await apiPost(`/api/schedules/slots/${slotId}/unblock`, {});
      } else {
        await apiPost(`/api/schedules/slots/${slotId}/block`, {});
      }
      fetchUpcomingSlots();
    } catch (error: any) {
      alert("Failed to update slot: " + (error.message || "Unknown error"));
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);
    
    const isToday = slotDate.getTime() === today.getTime();
    const isTomorrow = slotDate.getTime() === today.getTime() + 86400000;
    
    if (isToday) {
      return "Today";
    } else if (isTomorrow) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
  };

  const getDateStatus = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);
    
    if (slotDate.getTime() < today.getTime()) {
      return "past";
    } else if (slotDate.getTime() === today.getTime()) {
      return "today";
    } else {
      return "upcoming";
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Availability Schedule" description="Loading your schedule...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading schedule...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (apiError) {
    return (
      <DashboardLayout title="Availability Schedule" description="Error loading schedule">
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
            <p className="text-gray-600 mb-4">{apiError}</p>
            <button
              onClick={() => {
                setApiError(null);
                setLoading(true);
                fetchSchedules();
              }}
              className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold hover:bg-blue-800"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My Schedule"
      description="Manage your availability and time slots"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Schedule Form */}
        <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {editingSchedule ? "✏️ Edit Schedule" : "➕ Add New Schedule"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Day of Week</label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                  required
                >
                  {DAYS.map((day, idx) => (
                    <option key={idx} value={DAY_ENUMS[idx]}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Slot Duration (minutes)
                </label>
                <input
                  type="number"
                  min="30"
                  max="60"
                  step="30"
                  value={isNaN(formData.slotDuration) ? "" : formData.slotDuration}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    // Ensure value is between 30 and 60, and is a multiple of 30
                    const clampedValue = Math.max(30, Math.min(60, Math.round(value / 30) * 30));
                    setFormData({ ...formData, slotDuration: isNaN(clampedValue) ? 30 : clampedValue });
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Minimum 30 minutes, Maximum 60 minutes (in 30-minute increments)</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Max Appointments per Slot
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={isNaN(formData.maxAppointmentsPerSlot) ? "" : formData.maxAppointmentsPerSlot}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    setFormData({ ...formData, maxAppointmentsPerSlot: isNaN(value) ? 1 : value });
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                  required
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-2 focus:ring-blue-900/20"
              />
              <label htmlFor="isActive" className="text-sm font-semibold text-gray-900">
                Active (Slots will be generated for this schedule)
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800"
              >
                {editingSchedule ? "Update Schedule" : "Add Schedule"}
              </button>
              {editingSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSchedule(null);
                    setFormData({
                      dayOfWeek: "monday",
                      startTime: "09:00",
                      endTime: "17:00",
                      slotDuration: 30,
                      isActive: true,
                      maxAppointmentsPerSlot: 1,
                    });
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Existing Schedules */}
        <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📅 Your Weekly Schedule</h2>
          {schedules.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📅</div>
              <p className="text-gray-600">No schedules set. Add one to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule._id}
                  className={`rounded-lg border-2 p-4 transition-all ${
                    schedule.isActive
                      ? "border-green-300 bg-green-50 hover:shadow-md"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-lg">
                        {getDayName(schedule.dayOfWeek)}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        ⏰ {schedule.startTime} - {schedule.endTime}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        schedule.isActive
                          ? "bg-green-200 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {schedule.isActive ? "✓ Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="space-y-1 mb-3">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Slot:</span> {schedule.slotDuration} minutes
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Max per slot:</span> {schedule.maxAppointmentsPerSlot}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(schedule)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(schedule._id)}
                      className="flex-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 shadow-sm"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Slots Management */}
        {schedules.length > 0 && (
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">📆 Manage Slots</h2>
                <p className="text-sm text-gray-600 mt-1">View and manage your slots by date</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                />
              </div>
            </div>
            
            {/* Date Info */}
            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-900">
                  📅 {formatDate(selectedDate)}
                </span>
                {getDateStatus(selectedDate) === "today" && (
                  <span className="px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded">
                    Current Date
                  </span>
                )}
                {getDateStatus(selectedDate) === "upcoming" && (
                  <span className="px-2 py-1 text-xs font-semibold bg-green-600 text-white rounded">
                    Upcoming
                  </span>
                )}
              </div>
            </div>

            {upcomingSlots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No slots available for this date.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Slots are automatically generated based on your schedule.
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center gap-4 text-xs font-semibold text-gray-700">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-300"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-yellow-300"></div>
                    <span>Booked</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-300"></div>
                    <span>Blocked</span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
                  {upcomingSlots.map((slot) => {
                    const slotDate = new Date(slot.startTime);
                    const slotDateStatus = getDateStatus(slot.startTime);
                    
                    return (
                      <div
                        key={slot._id}
                        className={`rounded-lg border-2 p-3 text-center transition-all ${
                          slot.isBlocked
                            ? "border-red-300 bg-red-50 hover:shadow-md"
                            : slot.isBooked
                            ? "border-yellow-300 bg-yellow-50 hover:shadow-md"
                            : "border-green-300 bg-green-50 hover:shadow-md"
                        }`}
                      >
                        <p className="font-semibold text-gray-900 text-sm mb-1">
                          {formatTime(slot.startTime)}
                        </p>
                        <p className="text-xs text-gray-500 mb-2">
                          {formatDate(slot.startTime)}
                        </p>
                        <div className="space-y-1 mb-2">
                          {slot.isBlocked && (
                            <span className="text-xs font-semibold text-red-700">🚫 Blocked</span>
                          )}
                          {slot.isBooked && !slot.isBlocked && (
                            <span className="text-xs font-semibold text-yellow-700">📅 Booked</span>
                          )}
                          {!slot.isBooked && !slot.isBlocked && (
                            <span className="text-xs font-semibold text-green-700">✓ Available</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleSlotBlock(slot._id, slot.isBlocked)}
                          className={`w-full rounded-lg px-2 py-1 text-xs font-semibold text-white shadow-sm transition-colors ${
                            slot.isBlocked
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-red-600 hover:bg-red-700"
                          }`}
                        >
                          {slot.isBlocked ? "Unblock" : "Block"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
