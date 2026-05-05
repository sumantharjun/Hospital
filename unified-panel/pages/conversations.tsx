import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function ConversationsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [appointmentId, setAppointmentId] = useState("");

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !t) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(storedUser));
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setConversations(res.ok ? await res.json() : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [token]);

  const fetchByAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !appointmentId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/by-appointment/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const conv = await res.json();
        setSelectedConversation(conv);
      } else {
        setSelectedConversation(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="conversations">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-green-600">
          Patient-Doctor Conversations
        </h2>
        <p className="text-xs sm:text-sm text-black">
          View recorded conversations from appointments (both online and offline).
        </p>
      </motion.header>

      <AnimatedCard delay={0.1} className="mb-6">
        <form onSubmit={fetchByAppointment} className="flex flex-col sm:flex-row gap-3">
          <input
            placeholder="Enter Appointment ID"
            className="flex-1 rounded-xl bg-white border-2 border-black px-4 py-3 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm"
          >
            Search
          </motion.button>
        </form>
      </AnimatedCard>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full"
          />
        </div>
      ) : selectedConversation ? (
        <AnimatedCard delay={0.2}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-black mb-2">Conversation Details</h3>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm text-black flex-wrap">
                <span className="font-medium">Appointment: {selectedConversation.appointmentId.slice(-8)}</span>
                <span className="font-medium">Type: {selectedConversation.conversationType}</span>
                <span className="font-medium">
                  Started: {new Date(selectedConversation.startedAt).toLocaleString()}
                </span>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedConversation(null)}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-white border-2 border-black text-black hover:bg-black hover:text-white text-sm font-semibold"
            >
              Close
            </motion.button>
          </div>
          {selectedConversation.summary && (
            <div className="mb-6 p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
              <p className="text-sm font-semibold text-black mb-2">Summary:</p>
              <p className="text-sm text-black">{selectedConversation.summary}</p>
            </div>
          )}
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {selectedConversation.messages.map((msg: any, idx: number) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex ${msg.senderRole === "DOCTOR" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-xl p-3 sm:p-4 ${
                    msg.senderRole === "DOCTOR"
                      ? "bg-green-50 border-2 border-green-200"
                      : "bg-blue-50 border-2 border-blue-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-black">
                      {msg.senderRole === "DOCTOR" ? "👨‍⚕️ Doctor" : "👤 Patient"}
                    </span>
                    <span className="text-xs text-black">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-black whitespace-pre-wrap">{msg.content}</p>
                  {msg.messageType !== "TEXT" && (
                    <p className="text-xs text-black mt-2">
                      Type: {msg.messageType}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
            {selectedConversation.messages.length === 0 && (
              <p className="text-center text-black py-8">No messages in this conversation</p>
            )}
          </div>
          {selectedConversation.prescriptionId && (
            <div className="mt-6 p-4 rounded-xl bg-green-50 border-2 border-green-200">
              <p className="text-sm text-black font-semibold">
                💊 Prescription Linked: {selectedConversation.prescriptionId.slice(-8)}
              </p>
            </div>
          )}
        </AnimatedCard>
      ) : (
        <AnimatedCard delay={0.2}>
          <h3 className="text-lg font-semibold mb-4 text-green-600">Recent Conversations</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {conversations.map((conv, idx) => (
              <motion.div
                key={conv._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border-2 border-blue-200 rounded-xl p-4 bg-white hover:border-green-400 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <span className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 font-medium">
                        {conv.conversationType}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 border border-green-300 font-medium">
                        {conv.messages.length} messages
                      </span>
                      {conv.prescriptionId && (
                        <span className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 border border-green-300 font-medium">
                          Has Prescription
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-black font-bold mb-1">
                      Appointment: {conv.appointmentId.slice(-8)}
                    </p>
                    <p className="text-xs text-black">
                      Doctor: {conv.doctorId.slice(-8)} · Patient: {conv.patientId.slice(-8)}
                    </p>
                    <p className="text-xs text-black mt-2">
                      {new Date(conv.startedAt).toLocaleString()}
                    </p>
                    {conv.summary && (
                      <p className="text-xs text-black mt-2 italic line-clamp-2">
                        {conv.summary}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {conversations.length === 0 && (
              <p className="text-center text-black py-8">No conversations found</p>
            )}
          </div>
        </AnimatedCard>
      )}
    </Layout>
  );
}

