"use client";

import { useState } from "react";
import Link from "next/link";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";

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
  reportFile?: string;
  reportFileName?: string;
  patient?: { name: string; phone?: string };
  hospital?: { name: string };
}

interface AppointmentCardProps {
  appointment: Appointment;
  onUpdate: () => void;
}

export default function AppointmentCard({ appointment, onUpdate }: AppointmentCardProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
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
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      await apiPatch(`/api/appointments/${appointment._id}/status`, { status: "CONFIRMED" });
      onUpdate();
      alert("Appointment accepted successfully!");
    } catch (error: any) {
      alert("Failed to accept appointment: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    setLoading(true);
    try {
      await apiPatch(`/api/appointments/${appointment._id}/cancel`, {
        cancellationReason: rejectReason,
      });
      onUpdate();
      setShowRejectModal(false);
      setRejectReason("");
      alert("Appointment rejected successfully!");
    } catch (error: any) {
      alert("Failed to reject appointment: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime || !rescheduleReason.trim()) {
      alert("Please fill all fields");
      return;
    }
    const newDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`);
    setLoading(true);
    try {
      await apiPatch(`/api/appointments/${appointment._id}/reschedule`, {
        scheduledAt: newDateTime.toISOString(),
        rescheduleReason: rescheduleReason,
      });
      onUpdate();
      setShowRescheduleModal(false);
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleReason("");
      alert("Appointment rescheduled successfully!");
    } catch (error: any) {
      alert("Failed to reschedule: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const viewReport = () => {
    if (appointment.reportFile) {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
      window.open(`${API_BASE}/api/appointments/${appointment._id}/report`, "_blank");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this appointment? This action cannot be undone.")) return;
    
    setLoading(true);
    try {
      await apiDelete(`/api/appointments/${appointment._id}`);
      onUpdate();
      alert("Appointment deleted successfully");
    } catch (error: any) {
      alert("Failed to delete appointment: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{appointment.patientName}</h3>
                <p className="text-sm text-gray-600">Age: {appointment.age} years</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                {appointment.status}
              </span>
            </div>

            <div className="grid gap-2 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[80px]">Issue:</span>
                <span className="text-gray-900 font-medium">{appointment.issue}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[80px]">Scheduled:</span>
                <span className="text-gray-900">{formatDate(appointment.scheduledAt)}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[80px]">Type:</span>
                <span className="text-gray-900">
                  {appointment.channel === "VIDEO" ? "🖥️ Online" : "🏥 Offline"}
                </span>
              </div>
              {appointment.hospital && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 min-w-[80px]">Hospital:</span>
                  <span className="text-gray-900">{appointment.hospital.name}</span>
                </div>
              )}
              {appointment.patient?.phone && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 min-w-[80px]">Phone:</span>
                  <a href={`tel:${appointment.patient.phone}`} className="text-blue-900 hover:text-blue-800">
                    {appointment.patient.phone}
                  </a>
                </div>
              )}
              {appointment.reportFile && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-500">📄 Report:</span>
                  <button
                    onClick={viewReport}
                    className="text-blue-900 hover:text-blue-800 font-semibold text-sm"
                  >
                    {appointment.reportFileName || "View Report"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="ml-4 flex flex-col gap-2 min-w-[140px]">
            {appointment.status === "PENDING" && (
              <>
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                >
                  ✓ Accept
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={loading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  ✗ Reject
                </button>
                <button
                  onClick={() => {
                    const currentDate = new Date(appointment.scheduledAt);
                    setRescheduleDate(currentDate.toISOString().split("T")[0]);
                    setRescheduleTime(currentDate.toTimeString().slice(0, 5));
                    setShowRescheduleModal(true);
                  }}
                  disabled={loading}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-50"
                >
                  ↻ Reschedule
                </button>
              </>
            )}
            {appointment.status === "CONFIRMED" && (
              <>
                <Link
                  href={`/consultation/${appointment._id}`}
                  className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 text-center"
                >
                  Start Consultation
                </Link>
                <button
                  onClick={() => {
                    const currentDate = new Date(appointment.scheduledAt);
                    setRescheduleDate(currentDate.toISOString().split("T")[0]);
                    setRescheduleTime(currentDate.toTimeString().slice(0, 5));
                    setShowRescheduleModal(true);
                  }}
                  disabled={loading}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-50"
                >
                  ↻ Reschedule
                </button>
              </>
            )}
            <Link
              href={`/patients/${appointment.patientId}`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm text-center"
            >
              View History
            </Link>
            {(appointment.status === "PENDING" || appointment.status === "CANCELLED") && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="rounded-lg border border-red-500 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 shadow-sm disabled:opacity-50"
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reject Appointment</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to reject this appointment? Please provide a reason.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={loading || !rejectReason.trim()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Rejecting..." : "Reject"}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reschedule Appointment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">New Time</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Reason</label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Enter reason for rescheduling..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleReschedule}
                disabled={loading || !rescheduleDate || !rescheduleTime || !rescheduleReason.trim()}
                className="flex-1 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
              >
                {loading ? "Rescheduling..." : "Reschedule"}
              </button>
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setRescheduleDate("");
                  setRescheduleTime("");
                  setRescheduleReason("");
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

