"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiGet, apiDelete } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";

interface Conversation {
  _id: string;
  appointmentId: string;
  messages: Array<{
    senderId: string;
    senderRole: string;
    content: string;
    messageType: string;
    timestamp: string;
  }>;
  summary?: string;
  startedAt: string;
  endedAt?: string;
  isActive?: boolean;
  appointment?: {
    scheduledAt: string;
    doctorId: string;
    doctor?: { name: string };
  };
}

export default function TranscriptsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
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
    }
  }, [router]);

  const fetchConversations = async () => {
    if (!token || !user?.id) return;
    
    try {
      const data = await apiGet<Conversation[]>(`/api/conversations?patientId=${user.id}`);
      const conversationsList = Array.isArray(data) ? data : [];
      
      // Fetch appointment details
      const enrichedConversations = await Promise.all(
        conversationsList.map(async (conv) => {
          try {
            const appointment = await apiGet<{ doctorId: string; scheduledAt: string }>(`/api/appointments/${conv.appointmentId}`).catch(() => null);
            if (appointment) {
              const doctor = await apiGet<{ name: string }>(`/api/users/${appointment.doctorId}`).catch(() => null);
              return { ...conv, appointment: { ...appointment, doctor: doctor || undefined } };
            }
            return conv;
          } catch {
            return conv;
          }
        })
      );
      
      setConversations(enrichedConversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !user?.id) return;
    fetchConversations();
  }, [token, user?.id]);

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

  const downloadTranscript = (conversation: Conversation) => {
    const content = `
CONSULTATION TRANSCRIPT
${"=".repeat(50)}

Date: ${formatDate(conversation.startedAt)}
${conversation.endedAt ? `Ended: ${formatDate(conversation.endedAt)}` : "Ongoing"}
${conversation.appointment?.doctor?.name ? `Doctor: ${conversation.appointment.doctor.name}` : ""}

${conversation.summary ? `Summary: ${conversation.summary}\n` : ""}

MESSAGES:
${"=".repeat(50)}

${conversation.messages.map((msg, idx) => `
[${formatDate(msg.timestamp)}] ${msg.senderRole === "DOCTOR" ? "Doctor" : "You"}:
${msg.content}
${msg.messageType === "AUDIO" ? "[Audio Message]" : ""}
`).join("\n")}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consultation-${conversation._id.slice(-8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (conversationId: string) => {
    if (!confirm("Are you sure you want to delete this conversation transcript? This action cannot be undone.")) return;
    
    try {
      await apiDelete(`/api/conversations/${conversationId}`);
      fetchConversations();
      setSelectedConversation(null);
      toast.success("Conversation deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete conversation: " + (error.message || "Unknown error"));
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Consultation Transcripts" description="Loading your transcripts...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading transcripts...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Consultation Transcripts"
      description="View your consultation history"
    >
      <div className="max-w-7xl mx-auto">
        {conversations.length === 0 ? (
          <div className="rounded-lg border border-gray-300 bg-white p-12 text-center shadow-sm">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Transcripts</h2>
            <p className="text-gray-600">You don't have any consultation transcripts yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Conversations List */}
            <div className="space-y-4">
              {conversations.map((conversation) => (
                <div
                  key={conversation._id}
                  className={`rounded-lg border border-gray-300 bg-white p-4 shadow-sm cursor-pointer transition-colors ${
                    selectedConversation?._id === conversation._id ? "border-blue-900 bg-blue-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {conversation.appointment?.doctor?.name || "Doctor"}
                      </h3>
                      <p className="text-sm text-gray-600">{formatDate(conversation.startedAt)}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {conversation.messages.length} messages
                      </p>
                      {conversation.summary && (
                        <p className="text-sm text-gray-700 mt-2 line-clamp-2">{conversation.summary}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(conversation._id);
                      }}
                      className="ml-2 px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Conversation Details */}
            {selectedConversation && (
              <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Transcript</h2>
                  <div className="flex gap-2">
                    {selectedConversation.isActive !== false && (
                      <Link
                        href={`/consultation/${selectedConversation.appointmentId}`}
                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 shadow-sm"
                      >
                        💬 Reply / Continue Chat
                      </Link>
                    )}
                    <button
                      onClick={() => downloadTranscript(selectedConversation)}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(selectedConversation._id)}
                      className="rounded-lg border border-red-500 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 shadow-sm"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
                
                <div className="mb-4 text-sm text-gray-600">
                  <p>Date: {formatDate(selectedConversation.startedAt)}</p>
                  {selectedConversation.endedAt && (
                    <p>Ended: {formatDate(selectedConversation.endedAt)}</p>
                  )}
                </div>

                {selectedConversation.summary && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
                    <p className="text-gray-700">{selectedConversation.summary}</p>
                  </div>
                )}

                <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                  {selectedConversation.messages.map((message, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg ${
                        message.senderRole === "DOCTOR"
                          ? "bg-blue-50 ml-8"
                          : "bg-gray-50 mr-8"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">
                          {message.senderRole === "DOCTOR" ? "Doctor" : "You"}
                        </span>
                        <span className="text-xs text-gray-600">
                          {formatDate(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                      {message.messageType === "AUDIO" && (
                        <p className="text-xs text-gray-500 mt-1">[Audio Message]</p>
                      )}
                    </div>
                  ))}
                </div>
                
                {selectedConversation.isActive === false && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-gray-600 mb-2">This consultation has ended.</p>
                    <Link
                      href={`/appointments`}
                      className="text-blue-900 hover:text-blue-800 font-semibold"
                    >
                      View Appointments →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

