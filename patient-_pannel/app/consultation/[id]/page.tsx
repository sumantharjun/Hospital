"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";
import DashboardLayout from "@/components/DashboardLayout";
import PrescriptionModal from "@/components/PrescriptionModal";

interface Appointment {
  _id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  scheduledAt: string;
  status: string;
  channel: string;
  issue: string;
  doctor?: { name: string; specialization?: string };
  hospital?: { name: string };
}

interface Conversation {
  _id: string;
  messages: Array<{
    senderId: string;
    senderRole: string;
    content: string;
    messageType: string;
    timestamp: string;
  }>;
  summary?: string;
  isActive?: boolean;
}

export default function ConsultationPage() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reportRequests, setReportRequests] = useState<any[]>([]);
  const [uploadingReport, setUploadingReport] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<any | null>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const playNotificationSound = () => {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/Dej0AKE1606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBlou+/nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3o9AChNetOnrqFUUCkaf4PK+bCEFK4HO8tmJNggZaLvv559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N6PQAo=");
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (error) {
      // Ignore audio errors
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  const fetchData = async () => {
    if (!token || !appointmentId) return;
    
    try {
      const [appointmentData, conversationData] = await Promise.all([
        apiGet<Appointment>(`/api/appointments/${appointmentId}`).catch(() => null),
        apiGet<Conversation>(`/api/conversations/by-appointment/${appointmentId}`).catch(() => null),
      ]);

      setAppointment(appointmentData);
      
      // If conversation doesn't exist and appointment is confirmed, create one
      if (!conversationData && appointmentData && appointmentData.status === "CONFIRMED") {
        try {
          const newConversation = await apiPost<Conversation>("/api/conversations", {
            appointmentId: appointmentId,
            conversationType: appointmentData.channel === "VIDEO" ? "ONLINE" : "OFFLINE",
          });
          setConversation(newConversation);
        } catch (error) {
          console.error("Failed to create conversation:", error);
        }
      } else {
        setConversation(conversationData);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !appointmentId) return;
    fetchData();
    fetchReportRequests();
    fetchPrescription();
  }, [token, appointmentId]);

  // Listen for new messages
  useEffect(() => {
    if (!token || !appointmentId) return;

    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      // Only update if message is for this appointment and not from current user
      if (data.appointmentId === appointmentId && user && data.message?.senderId !== user.id && data.message?.senderId !== user._id) {
        fetchData(); // Refresh conversation
        // Play notification sound
        playNotificationSound();
      }
    };

    const handleReportRequested = () => {
      fetchReportRequests();
    };

    const handlePrescriptionCreated = () => {
      fetchPrescription();
    };

    onSocketEvent("message:created", handleNewMessage);
    onSocketEvent("notification:new", handleNewMessage);
    onSocketEvent("report:requested", handleReportRequested);
    onSocketEvent("prescription:created", handlePrescriptionCreated);
    
    return () => {
      offSocketEvent("message:created", handleNewMessage);
      offSocketEvent("notification:new", handleNewMessage);
      offSocketEvent("report:requested", handleReportRequested);
      offSocketEvent("prescription:created", handlePrescriptionCreated);
    };
  }, [token, appointmentId]);

  const handleSendMessage = async () => {
    if (!message.trim() || !conversation || sending) return;

    setSending(true);
    try {
      await apiPost(`/api/conversations/${conversation._id}/messages`, {
        content: message.trim(),
        messageType: "TEXT",
      });
      setMessage("");
      await fetchData(); // Refresh to get new message
    } catch (error: any) {
      toast.error("Failed to send message: " + (error.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `Today at ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fetchReportRequests = async () => {
    if (!token || !user) return;
    try {
      const patientId = user.id || user._id;
      const requests = await apiGet<any[]>(`/api/report-requests?patientId=${patientId}`);
      setReportRequests((requests || []).filter((req: any) => req.status === "PENDING"));
    } catch (error) {
      console.error("Error fetching report requests:", error);
      setReportRequests([]);
    }
  };

  const handleFileUpload = async (requestId: string, file: File) => {
    if (!token) return;

    setUploadingReport(requestId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
      const response = await fetch(`${API_BASE}/api/report-requests/${requestId}/upload`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload report");
      }

      // Send a message in the conversation about the upload
      if (conversation) {
        const request = reportRequests.find((r: any) => r._id === requestId);
        await apiPost(`/api/conversations/${conversation._id}/messages`, {
          content: `📄 I've uploaded the ${request?.reportType || "requested"} report.`,
          messageType: "TEXT",
        });
      }

      toast.success("Report uploaded successfully! The doctor will be notified.");
      fetchReportRequests();
      fetchData();
    } catch (error: any) {
      toast.error("Failed to upload report: " + (error.message || "Unknown error"));
    } finally {
      setUploadingReport(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleReportFileSelect = (requestId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (!fileExtension || !allowedTypes.test(fileExtension)) {
      toast.error("Invalid file type. Please upload images, PDFs, or documents only.");
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit. Please upload a smaller file.");
      return;
    }

    handleFileUpload(requestId, file);
  };

  const fetchPrescription = async () => {
    if (!token || !appointmentId) return;
    setLoadingPrescription(true);
    try {
      // Fetch prescription by appointmentId
      const prescriptions = await apiGet<any[]>(`/api/prescriptions?appointmentId=${appointmentId}`);
      if (prescriptions && prescriptions.length > 0) {
        // Get the most recent prescription for this appointment
        setPrescription(prescriptions[0]);
      } else {
        setPrescription(null);
      }
    } catch (error) {
      console.error("Error fetching prescription:", error);
      setPrescription(null);
    } finally {
      setLoadingPrescription(false);
    }
  };

  const handleViewPrescription = () => {
    if (prescription) {
      setShowPrescriptionModal(true);
    } else {
      toast.error("Prescription has not been created yet. Please wait for your doctor to generate it after the consultation.");
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Consultation" description="Loading consultation...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading consultation...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!appointment) {
    return (
      <DashboardLayout title="Consultation" description="Appointment not found">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Appointment Not Found</h2>
            <Link href="/appointments" className="text-blue-900 hover:text-blue-800">
              Back to Appointments
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const patientId = user?.id || user?._id;
  const isPatient = (senderId: string) => String(senderId) === String(patientId);

  return (
    <DashboardLayout
      title="Consultation"
      description={`Dr. ${appointment.doctor?.name || "Doctor"} | ${appointment.channel === "VIDEO" ? "Online" : "Offline"}`}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
            <div>
            <h1 className="text-2xl font-bold text-gray-900">Consultation</h1>
            <p className="text-sm text-gray-600 mt-1">
              {appointment.channel === "VIDEO" ? "Online" : "Offline"} Consultation with Dr. {appointment.doctor?.name || "Doctor"}
              </p>
            </div>
            <Link
              href="/appointments"
            className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
          >
            ← Back to Appointments
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Appointment Info & Report Requests */}
          <div className="lg:col-span-1 space-y-6">
            {/* Appointment Info Card */}
            <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {appointment.doctor?.name?.charAt(0) || "D"}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    Dr. {appointment.doctor?.name || "Doctor"}
                  </h2>
                  {appointment.doctor?.specialization && (
                    <p className="text-xs text-gray-600">{appointment.doctor.specialization}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-3 pt-4 border-t border-blue-200">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-semibold text-sm min-w-[80px]">📅 Scheduled:</span>
                  <p className="text-sm text-gray-700 font-medium">{formatDate(appointment.scheduledAt)}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-semibold text-sm min-w-[80px]">💬 Issue:</span>
                  <p className="text-sm text-gray-700 font-medium">{appointment.issue}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-semibold text-sm min-w-[80px]">📊 Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    appointment.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                    appointment.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                    appointment.status === "COMPLETED" ? "bg-blue-100 text-blue-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {appointment.status}
                  </span>
                </div>
                {appointment.hospital?.name && (
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold text-sm min-w-[80px]">🏥 Hospital:</span>
                    <p className="text-sm text-gray-700 font-medium">{appointment.hospital.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Report Requests - Prominent Alert */}
            {reportRequests.length > 0 && (
              <div className="rounded-xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 p-6 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">📋</span>
                  <h3 className="text-lg font-bold text-gray-900">Action Required</h3>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  Your doctor has requested the following reports. Please upload them as soon as possible.
                </p>
                <div className="space-y-3">
                  {reportRequests.map((request) => (
                    <div
                      key={request._id}
                      className="p-4 rounded-lg border-2 border-yellow-300 bg-white shadow-sm"
                    >
                      <div className="mb-3">
                        <p className="font-bold text-gray-900 text-sm mb-1">{request.reportType}</p>
                        {request.description && (
                          <p className="text-xs text-gray-600">{request.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Requested: {new Date(request.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                        onChange={(e) => handleReportFileSelect(request._id, e)}
                        className="hidden"
                        id={`file-input-${request._id}`}
                      />
                      <label
                        htmlFor={`file-input-${request._id}`}
                        className={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm cursor-pointer transition-all ${
                          uploadingReport === request._id
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-blue-900 hover:bg-blue-800 hover:shadow-md"
                        }`}
                      >
                        {uploadingReport === request._id ? "⏳ Uploading..." : "📤 Upload Report"}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {loadingPrescription ? (
                  <button
                    disabled
                    className="block w-full rounded-lg bg-gray-400 px-4 py-2.5 text-center text-sm font-semibold text-white cursor-not-allowed"
                  >
                    ⏳ Loading...
                  </button>
                ) : prescription ? (
                  <button
                    onClick={handleViewPrescription}
                    className="block w-full rounded-lg bg-green-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-green-700 shadow-sm transition-all"
                  >
                    📄 View Prescription
                  </button>
                ) : (
                  <button
                    disabled
                    className="block w-full rounded-lg bg-gray-300 px-4 py-2.5 text-center text-sm font-semibold text-gray-600 cursor-not-allowed"
                    title="Prescription will be available after the doctor creates it"
                  >
                    📄 Prescription Not Available
                  </button>
                )}
              </div>
            </div>
        </div>

          {/* Right Column - Chat Messages */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border-2 border-gray-200 bg-white shadow-lg overflow-hidden flex flex-col h-[calc(100vh-200px)]">
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 border-b-2 border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold">
                      {appointment.doctor?.name?.charAt(0) || "D"}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Dr. {appointment.doctor?.name || "Doctor"}
                      </h3>
                      <p className="text-xs text-blue-100">
                        {appointment.channel === "VIDEO" ? "🟢 Online Consultation" : "📋 Offline Consultation"}
                      </p>
                    </div>
                  </div>
                  {conversation && conversation.isActive === false && (
                    <span className="px-3 py-1 rounded-full bg-red-500 text-white text-xs font-semibold">
                      Consultation Ended
                    </span>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {!conversation ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-gray-600 font-medium mb-2">
                      {appointment.status === "CONFIRMED" 
                        ? "Consultation has not started yet"
                        : "Waiting for appointment confirmation"}
                    </p>
                    <p className="text-sm text-gray-500">
                {appointment.status === "CONFIRMED" 
                        ? "The doctor will start the consultation soon..."
                        : "Please wait for your appointment to be confirmed"}
              </p>
            </div>
          ) : conversation.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="text-6xl mb-4">👋</div>
                    <p className="text-gray-600 font-medium mb-2">No messages yet</p>
                    <p className="text-sm text-gray-500">Start the conversation with your doctor!</p>
            </div>
          ) : (
                  <div className="space-y-4">
              {conversation.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${isPatient(msg.senderId) ? "justify-end" : "justify-start"}`}
                >
                        <div className={`flex flex-col max-w-[75%] ${isPatient(msg.senderId) ? "items-end" : "items-start"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-600">
                              {isPatient(msg.senderId) ? "You" : `Dr. ${appointment.doctor?.name || "Doctor"}`}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(msg.timestamp).toLocaleTimeString("en-US", { 
                                hour: "2-digit", 
                                minute: "2-digit" 
                              })}
                            </span>
                          </div>
                          <div
                            className={`rounded-2xl px-4 py-3 shadow-sm ${
                      isPatient(msg.senderId)
                                ? "bg-blue-600 text-white rounded-br-sm"
                                : "bg-white text-gray-900 border-2 border-gray-200 rounded-bl-sm"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
              </div>

          {/* Message Input */}
          {conversation && conversation.isActive !== false && (
                <div className="border-t-2 border-gray-200 bg-white p-4">
                  <div className="flex gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                      placeholder="Type your message here..."
                      className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                disabled={sending}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || sending}
                      className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg"
              >
                      {sending ? "⏳" : "➤"}
              </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Press Enter to send, Shift+Enter for new line
                  </p>
            </div>
          )}

          {conversation && conversation.isActive === false && (
                <div className="border-t-2 border-gray-200 bg-gray-50 p-6 text-center">
                  <p className="text-gray-600 font-medium">This consultation has ended.</p>
                  <p className="text-sm text-gray-500 mt-1">You can still view the conversation history.</p>
            </div>
          )}
        </div>
          </div>
        </div>
      </div>

      {/* Prescription Modal */}
      <PrescriptionModal
        prescription={prescription}
        appointment={appointment}
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        token={token}
      />
    </DashboardLayout>
  );
}

