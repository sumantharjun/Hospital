"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { initializeSocket, getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";
import DashboardLayout from "@/components/DashboardLayout";

interface Appointment {
  _id: string;
  patientId: string;
  doctorId: string;
  patientName: string;
  age: number;
  issue: string;
  channel: string;
  scheduledAt: string;
  hospitalId?: string;
  reportFile?: string;
  reportFileName?: string;
  patient?: { name: string; phone?: string; email?: string };
  hospital?: { name: string; address?: string };
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
}

interface PatientRecord {
  diagnosis?: string[];
  allergies?: string[];
  currentMedications?: string[];
  pastSurgeries?: string[];
  labReports?: Array<{
    date: Date;
    testName: string;
    results: string;
    fileUrl?: string;
  }>;
}

interface TranscriptionResult {
  transcript: string;
  suggestions: {
    diagnosis: string[];
    medicines: Array<{
      medicineName: string;
      dosage: string;
      frequency: string;
      duration: string;
      notes?: string;
    }>;
    notes: string;
  };
}

export default function ConsultationPage() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [patientRecord, setPatientRecord] = useState<PatientRecord | null>(null);
  const [previousAppointments, setPreviousAppointments] = useState<Appointment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<TranscriptionResult["suggestions"] | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showReportRequestModal, setShowReportRequestModal] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportRequests, setReportRequests] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<{ fileUrl: string; fileName?: string; reportType?: string } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

      if (appointmentData) {
        // Fetch patient details and hospital
        const [patient, hospital] = await Promise.all([
          apiGet(`/api/users/${appointmentData.patientId}`).catch(() => null),
          appointmentData.hospitalId ? apiGet(`/api/master/hospitals/${appointmentData.hospitalId}`).catch(() => null) : null,
        ]);
        
        const updatedAppointment = { 
          ...appointmentData, 
          patient: patient as { name: string; phone?: string; email?: string } | undefined,
          hospital: hospital as { name: string; address?: string } | undefined
        };
        setAppointment(updatedAppointment);
        
        // Fetch report requests after appointment is loaded
        if (updatedAppointment.patientId && user) {
          // Use setTimeout to ensure state is updated
          setTimeout(() => {
            fetchReportRequests();
          }, 100);
        }

        // Fetch patient record
        try {
          const record = await apiGet<PatientRecord>(`/api/patient-records/${appointmentData.patientId}`);
          setPatientRecord(record);
        } catch {
          setPatientRecord(null);
        }

        // Fetch previous appointments
        try {
          const prevAppts = await apiGet<Appointment[]>(`/api/appointments?patientId=${appointmentData.patientId}&status=COMPLETED`);
          setPreviousAppointments(Array.isArray(prevAppts) ? prevAppts.filter(apt => apt._id !== appointmentId).slice(0, 5) : []);
        } catch {
          setPreviousAppointments([]);
        }
      }

      if (conversationData) {
        setConversation(conversationData);
      } else if (appointmentData) {
        // Create conversation if it doesn't exist
        try {
          const newConversation = await apiPost<Conversation>("/api/conversations", {
            appointmentId,
            conversationType: appointmentData.channel === "VIDEO" ? "ONLINE" : "OFFLINE",
            doctorId: appointmentData.doctorId,
            patientId: appointmentData.patientId,
            hospitalId: appointmentData.hospitalId,
          });
          setConversation(newConversation);
        } catch (error: any) {
          console.error("Error creating conversation:", error);
        }
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
    
    // Listen for new messages and report updates
    const socket = getSocket();
    if (socket && user) {
      const handleNewMessage = (data: any) => {
        // Only update if message is for this appointment and not from current user
        if (data.appointmentId === appointmentId && data.message?.senderId !== user.id && data.message?.senderId !== user._id) {
          fetchData();
          // Play notification sound
          playNotificationSound();
        }
      };
      const handleReportUploaded = (data: any) => {
        // Only update if report is for this appointment or if no appointmentId filter
        if (data) {
          // Check if the report request belongs to this appointment
          if (!data.appointmentId || data.appointmentId === appointmentId) {
            fetchReportRequests();
            // Play notification sound
            playNotificationSound();
          }
        } else {
          // If no data, refresh anyway (might be from notification:new event)
          fetchReportRequests();
        }
      };
      onSocketEvent("message:created", handleNewMessage);
      onSocketEvent("report:uploaded", handleReportUploaded);
      onSocketEvent("notification:new", handleReportUploaded);
      return () => {
        offSocketEvent("message:created", handleNewMessage);
        offSocketEvent("report:uploaded", handleReportUploaded);
        offSocketEvent("notification:new", handleReportUploaded);
      };
    }
  }, [token, appointmentId]);

  // Memoize doctorId to ensure stable dependency
  const doctorId = useMemo(() => {
    return user?.id || user?._id || null;
  }, [user?.id, user?._id]);

  // Fetch report requests when appointment data is loaded (for page refresh)
  useEffect(() => {
    if (appointment?.patientId && doctorId && token && appointmentId) {
      console.log("Fetching report requests on appointment load:", {
        patientId: appointment.patientId,
        doctorId,
        appointmentId
      });
      fetchReportRequests();
    }
  }, [appointment?.patientId, doctorId, token, appointmentId]);

  const startRecording = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error("Error starting recording:", error);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        alert("Microphone permission denied. Please allow microphone access and try again.");
      } else {
        alert("Failed to start recording: " + (error.message || "Unknown error"));
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        
        const result = await apiPost<TranscriptionResult>("/api/transcription/transcribe", {
          audioData: base64Audio,
          conversationId: conversation?._id,
          appointmentId,
        });

        setTranscript(result.transcript);
        setAiSuggestions(result.suggestions);
        
        if (conversation) {
          await apiPost(`/api/conversations/${conversation._id}/messages`, {
            content: `[Auto-transcribed]\n${result.transcript}`,
            messageType: "TEXT",
          });
          fetchData();
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error: any) {
      console.error("Error processing recording:", error);
      alert("Failed to transcribe audio: " + (error.message || "Unknown error"));
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !conversation) return;

    try {
      await apiPost(`/api/conversations/${conversation._id}/messages`, {
        content: message,
        messageType: "TEXT",
      });
      setMessage("");
      fetchData();
    } catch (error: any) {
      alert("Failed to send message: " + (error.message || "Unknown error"));
    }
  };

  const handleEndConsultation = async () => {
    if (!conversation) return;
    
    if (!confirm("Are you sure you want to end this consultation?")) return;
    
    try {
      await apiPatch(`/api/conversations/${conversation._id}`, {
        isActive: false,
        endedAt: new Date().toISOString(),
      });
      
      await apiPatch(`/api/appointments/${appointmentId}/status`, {
        status: "COMPLETED",
      });
      
      alert("Consultation ended successfully!");
      router.push("/appointments");
    } catch (error: any) {
      alert("Failed to end consultation: " + (error.message || "Unknown error"));
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversation) return;
    
    if (!confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) return;
    
    try {
      await apiDelete(`/api/conversations/${conversation._id}`);
      alert("Conversation deleted successfully!");
      router.push("/appointments");
    } catch (error: any) {
      alert("Failed to delete conversation: " + (error.message || "Unknown error"));
    }
  };

  const viewReport = () => {
    if (appointment?.reportFile) {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
      window.open(`${API_BASE}/api/appointments/${appointmentId}/report`, "_blank");
    }
  };

  const fetchReportRequests = async () => {
    if (!token || !user) {
      console.warn("Cannot fetch report requests: missing token or user");
      return;
    }
    
    // Get patientId from appointment if available
    const patientId = appointment?.patientId;
    if (!patientId) {
      console.warn("Cannot fetch report requests: patientId not available yet");
      return;
    }
    
    try {
      const doctorId = user.id || user._id;
      
      // Fetch all report requests for this patient AND this doctor
      // This ensures we see all reports requested by this doctor for this patient
      const requests = await apiGet<any[]>(`/api/report-requests?patientId=${patientId}&doctorId=${doctorId}`);
      
      // Show all reports for this patient-doctor combination
      // Optionally filter by appointmentId if provided, but show all if no appointmentId
      const filteredRequests = requests?.filter((req: any) => {
        // Convert both to strings for comparison (handles ObjectId vs string)
        const reqAppointmentId = req.appointmentId ? String(req.appointmentId) : null;
        const currentAppointmentId = String(appointmentId);
        
        // Show if:
        // 1. No appointmentId in request (general request for this patient)
        // 2. appointmentId matches current appointment
        return !reqAppointmentId || reqAppointmentId === currentAppointmentId;
      }) || [];
      
      console.log("Fetched report requests:", {
        total: requests?.length || 0,
        filtered: filteredRequests.length,
        appointmentId,
        patientId,
        doctorId,
        requests: filteredRequests.map((r: any) => ({ 
          id: r._id, 
          type: r.reportType, 
          status: r.status, 
          appointmentId: r.appointmentId 
        }))
      });
      
      // Sort by status: UPLOADED first, then PENDING, then REVIEWED
      filteredRequests.sort((a: any, b: any) => {
        if (a.status === "UPLOADED" && b.status !== "UPLOADED") return -1;
        if (a.status !== "UPLOADED" && b.status === "UPLOADED") return 1;
        if (a.status === "PENDING" && b.status === "REVIEWED") return -1;
        if (a.status === "REVIEWED" && b.status === "PENDING") return 1;
        // Sort by date (newest first) if same status
        return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
      });
      
      setReportRequests(filteredRequests);
    } catch (error) {
      console.error("Error fetching report requests:", error);
      setReportRequests([]);
    }
  };

  const handleRequestReport = async () => {
    if (!reportType.trim() || !appointment?.patientId) {
      alert("Please enter a report type");
      return;
    }

    try {
      await apiPost("/api/report-requests", {
        patientId: appointment.patientId,
        reportType: reportType.trim(),
        description: reportDescription.trim() || undefined,
        appointmentId: appointmentId,
        conversationId: conversation?._id,
      });
      
      // Send a message in the conversation about the report request
      if (conversation) {
        await apiPost(`/api/conversations/${conversation._id}/messages`, {
          content: `📋 I've requested a ${reportType} report. ${reportDescription ? `Details: ${reportDescription}` : "Please upload the report when ready."}`,
          messageType: "TEXT",
        });
      }
      
      alert("Report request sent successfully! The patient will be notified.");
      setShowReportRequestModal(false);
      setReportType("");
      setReportDescription("");
      fetchReportRequests();
      fetchData();
    } catch (error: any) {
      alert("Failed to request report: " + (error.message || "Unknown error"));
    }
  };

  const viewUploadedReport = (fileUrl: string, fileName?: string, reportType?: string) => {
    if (!fileUrl) {
      alert("Report file URL is missing. Please contact support.");
      return;
    }
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
    if (!API_BASE) {
      alert("API base URL is not configured. Please check your environment settings.");
      return;
    }
    // Ensure fileUrl starts with / if it doesn't already
    const cleanUrl = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
    const fullUrl = `${API_BASE}${cleanUrl}`;
    
    // Check if it's a PDF file
    const isPDF = fileName?.toLowerCase().endsWith('.pdf') || fileUrl.toLowerCase().includes('.pdf');
    
    if (isPDF) {
      // Open in modal for PDF viewing
      setSelectedReport({ fileUrl: fullUrl, fileName, reportType });
      setShowReportModal(true);
    } else {
      // For non-PDF files (images, docs), open in new tab
      window.open(fullUrl, "_blank");
    }
  };
  
  const getReportUrl = () => {
    if (!selectedReport) return "";
    return selectedReport.fileUrl;
  };

  const handleDownloadReport = async () => {
    if (!selectedReport) return;
    
    try {
      const reportUrl = getReportUrl();
      if (!reportUrl) {
        alert("Report URL is missing.");
        return;
      }

      // Fetch the file as blob
      const response = await fetch(reportUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download report");
      }

      const blob = await response.blob();
      
      // Determine filename - ensure it ends with .pdf
      let fileName = selectedReport.fileName || "report.pdf";
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        // Remove existing extension and add .pdf
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
        fileName = `${nameWithoutExt}.pdf`;
      }

      // Create a new blob with PDF type to ensure correct MIME type
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.type = 'application/pdf';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error: any) {
      console.error("Error downloading report:", error);
      alert("Failed to download report: " + (error.message || "Unknown error"));
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

  if (!appointment || !conversation) {
    return (
      <DashboardLayout title="Consultation" description="Consultation not found">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Consultation Not Found</h2>
            <Link href="/appointments" className="text-blue-900 hover:text-blue-800">
              Back to Appointments
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Consultation"
      description={`Patient: ${appointment.patientName} | ${appointment.channel === "VIDEO" ? "Online" : "Offline"}`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            {appointment.channel === "OFFLINE" && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${
                  isRecording
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-900 hover:bg-blue-800"
                }`}
              >
                {isRecording ? "⏹ Stop Recording" : "⏺ Start Recording"}
              </button>
            )}
            {isRecording && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2">
                <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse"></div>
                <span className="text-sm font-semibold text-red-700">Recording</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReportRequestModal(true)}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
              title="Ask patient for a report"
            >
              📋 Ask for Report
            </button>
            <Link
              href={`/prescription/${appointmentId}${aiSuggestions ? `?suggestions=${encodeURIComponent(JSON.stringify(aiSuggestions))}` : ""}`}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
            >
              📝 Generate Prescription
            </Link>
            <button
              onClick={handleEndConsultation}
              className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-700"
            >
              End Consultation
            </button>
            {conversation && (
              <button
                onClick={handleDeleteConversation}
                className="rounded-lg border border-red-500 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                🗑️ Delete Conversation
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Chat Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chat Messages */}
            <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Conversation</h2>
              <div className="h-96 overflow-y-auto mb-4 space-y-3 pr-2">
                {conversation.messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  conversation.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg ${
                        msg.senderRole === "DOCTOR"
                          ? "bg-blue-50 ml-8 border-l-4 border-blue-900"
                          : "bg-gray-50 mr-8 border-l-4 border-gray-400"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">
                          {msg.senderRole === "DOCTOR" ? "You" : appointment.patientName}
                        </span>
                        <span className="text-xs text-gray-600">
                          {new Date(msg.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReportRequestModal(true)}
                  className="rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-purple-700 text-sm"
                  title="Ask patient for a report"
                >
                  📋 Ask for Report
                </button>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                />
                <button
                  onClick={handleSendMessage}
                  className="rounded-lg bg-blue-900 px-6 py-3 font-semibold text-white shadow-sm hover:bg-blue-800"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Transcription */}
            {transcript && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">📝 Transcription</h2>
                <div className="h-48 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                  {transcript}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Patient Info */}
            <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Patient Information</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Name:</span>
                  <p className="font-semibold text-gray-900">{appointment.patientName}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Age:</span>
                  <p className="font-semibold text-gray-900">{appointment.age} years</p>
                </div>
                {appointment.patient?.phone && (
                  <div>
                    <span className="text-sm text-gray-600">Phone:</span>
                    <p className="font-semibold text-gray-900">
                      <a href={`tel:${appointment.patient.phone}`} className="text-blue-900 hover:text-blue-800">
                        {appointment.patient.phone}
                      </a>
                    </p>
                  </div>
                )}
                {appointment.hospital && (
                  <div>
                    <span className="text-sm text-gray-600">Hospital:</span>
                    <p className="font-semibold text-gray-900">{appointment.hospital.name}</p>
                  </div>
                )}
                {appointment.reportFile && (
                  <div>
                    <button
                      onClick={viewReport}
                      className="w-full rounded-lg bg-blue-50 border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100"
                    >
                      📄 View Uploaded Report
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Report Requests Section - Always Visible */}
            <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Reports</h2>
              {reportRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No report requests yet.</p>
                  <p className="text-xs mt-1">Click "Ask for Report" to request a report from the patient.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {reportRequests.map((request) => (
                    <div
                      key={request._id}
                      className={`p-4 rounded-lg border-2 ${
                        request.status === "UPLOADED"
                          ? "bg-green-50 border-green-400 shadow-md"
                          : request.status === "REVIEWED"
                          ? "bg-blue-50 border-blue-300"
                          : "bg-yellow-50 border-yellow-300"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-gray-900 text-base">{request.reportType}</p>
                            {request.status === "UPLOADED" && (
                              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                                NEW
                              </span>
                            )}
                          </div>
                          {request.description && (
                            <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                          )}
                          {request.status === "UPLOADED" && request.fileName && (
                            <p className="text-xs text-gray-500 mt-1">📎 {request.fileName}</p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-bold ${
                            request.status === "UPLOADED"
                              ? "bg-green-500 text-white"
                              : request.status === "REVIEWED"
                              ? "bg-blue-500 text-white"
                              : "bg-yellow-500 text-white"
                          }`}
                        >
                          {request.status}
                        </span>
                      </div>
                      
                      {request.status === "UPLOADED" && request.fileUrl && (
                        <div className="mt-3 flex flex-col gap-2">
                          <button
                            onClick={() => viewUploadedReport(request.fileUrl)}
                            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 shadow-md transition-all hover:scale-105 flex items-center justify-center gap-2"
                          >
                            <span className="text-lg">📄</span>
                            View Report
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await apiPatch(`/api/report-requests/${request._id}/review`);
                                fetchReportRequests();
                                alert("Report marked as reviewed!");
                              } catch (error: any) {
                                alert("Failed to mark as reviewed: " + (error.message || "Unknown error"));
                              }
                            }}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            ✓ Mark as Reviewed
                          </button>
                        </div>
                      )}
                      
                      {request.status === "PENDING" && (
                        <div className="mt-3 text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded">
                          ⏳ Waiting for patient to upload...
                        </div>
                      )}
                      
                      {request.status === "REVIEWED" && (
                        <div className="mt-3 text-xs text-green-600 bg-green-100 px-3 py-2 rounded font-semibold">
                          ✓ Reviewed
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-200">
                        Requested: {new Date(request.requestedAt).toLocaleString()}
                        {request.uploadedAt && (
                          <span className="ml-2">
                            • Uploaded: {new Date(request.uploadedAt).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Patient History */}
            {patientRecord && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Medical History</h2>
                <div className="space-y-4">
                  {patientRecord.diagnosis && patientRecord.diagnosis.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Diagnosis</h3>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {patientRecord.diagnosis.map((diag, idx) => (
                          <li key={idx}>• {diag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {patientRecord.allergies && patientRecord.allergies.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-red-700 mb-2">⚠️ Allergies</h3>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {patientRecord.allergies.map((allergy, idx) => (
                          <li key={idx}>• {allergy}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {patientRecord.currentMedications && patientRecord.currentMedications.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Medications</h3>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {patientRecord.currentMedications.map((med, idx) => (
                          <li key={idx}>• {med}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Previous Appointments */}
            {previousAppointments.length > 0 && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Previous Appointments</h2>
                <div className="space-y-2">
                  {previousAppointments.map((apt) => (
                    <div key={apt._id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(apt.scheduledAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-600">{apt.issue}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Suggestions */}
            {aiSuggestions && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">🤖 AI Suggestions</h2>
                
                {aiSuggestions.diagnosis.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm">Diagnosis</h3>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {aiSuggestions.diagnosis.map((diag, idx) => (
                        <li key={idx}>{diag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSuggestions.medicines.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm">Suggested Medicines</h3>
                    <div className="space-y-2">
                      {aiSuggestions.medicines.map((med, idx) => (
                        <div key={idx} className="text-sm text-gray-700 p-2 bg-gray-50 rounded">
                          <strong>{med.medicineName}</strong>
                          <p className="text-xs text-gray-600 mt-1">
                            {med.dosage}, {med.frequency}, {med.duration}
                          </p>
                          {med.notes && <p className="text-xs text-gray-500 mt-1">{med.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiSuggestions.notes && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm">Notes</h3>
                    <p className="text-sm text-gray-700">{aiSuggestions.notes}</p>
                  </div>
                )}

                <Link
                  href={`/prescription/${appointmentId}?suggestions=${encodeURIComponent(JSON.stringify(aiSuggestions))}`}
                  className="mt-4 block rounded-lg bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-green-700"
                >
                  Use for Prescription
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Request Modal */}
      {showReportRequestModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Request Report from Patient</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Report Type <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  placeholder="e.g., Blood Test, X-Ray, Lab Report, etc."
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Additional details about the report needed..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReportRequestModal(false);
                    setReportType("");
                    setReportDescription("");
                  }}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestReport}
                  className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 font-semibold text-white hover:bg-purple-700"
                >
                  Request Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Report Viewer Modal */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  📄 {selectedReport.reportType || "Medical Report"}
                </h3>
                {selectedReport.fileName && (
                  <p className="text-sm text-gray-600 mt-1">{selectedReport.fileName}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadReport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
                >
                  ⬇️ Download PDF
                </button>
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setSelectedReport(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            
            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={`${getReportUrl()}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full border-0"
                title="PDF Report Viewer"
                style={{ minHeight: "100%" }}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
