import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { ReceptionistIcon, PlusIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function ReceptionistManagementPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [receptionists, setReceptionists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

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
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.ok ? await res.json() : [];
        const list = Array.isArray(data) ? data : [];
        setReceptionists(list.filter((u: any) => u.role === "HOSPITAL_ADMIN"));
      } catch (e) {
        toast.error("Failed to fetch receptionists");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.name || !form.email || !form.password) {
      toast.error("Please fill name, email and password");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: "HOSPITAL_ADMIN",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create receptionist");
      }
      const created = await res.json();
      setReceptionists((prev) => [{ ...created, role: "HOSPITAL_ADMIN" }, ...prev]);
      setForm({ name: "", email: "", password: "" });
      setShowAddModal(false);
      toast.success("Receptionist added! Share the email and password with them to log in to the Receptionist app.");
    } catch (e: any) {
      toast.error(e.message || "Error adding receptionist");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="receptionist-management">
            <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <div className="medical-card bg-gradient-to-r from-white via-white to-emerald-50/70 border border-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase mb-2">Management</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-slate-900">
                Receptionists
              </h2>
              <p className="text-sm text-slate-600">
                Add login credentials for reception staff. They use these to sign in to the Receptionist app.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setForm({ name: "", email: "", password: "" });
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full shadow-sm transition-all flex items-center gap-2 text-sm sm:text-base"
            >
              <PlusIcon className="w-4 h-4" />
              Add Receptionist
            </motion.button>
          </div>
        </div>
      </motion.header>

      <AnimatedCard className="p-0">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading receptionists...</div>
        ) : receptionists.length === 0 ? (
          <div className="text-center py-12">
            <ReceptionistIcon className="w-16 h-16 mx-auto text-indigo-500/50 mb-4" />
            <p className="text-slate-700 font-semibold mb-2">No receptionists yet</p>
            <p className="text-sm text-slate-500 mb-4">Add one so they can log in to the Receptionist app.</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Add Receptionist
            </motion.button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {receptionists.map((r: any, idx: number) => (
              <motion.div
                key={r._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="medical-card p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                    <ReceptionistIcon className="w-5 h-5 text-teal-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{r.name}</h3>
                    <p className="text-sm text-slate-600 truncate">{r.email}</p>
                    <span className="inline-block mt-2 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Receptionist
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatedCard>

      {/* Add Receptionist Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-4">Add Receptionist</h3>
            <p className="text-sm text-slate-600 mb-4">
              They will use this email and password to sign in to the Receptionist app.
            </p>
            <form onSubmit={handleAdd} className="space-y-4">
              <input
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                className="medical-input w-full"
              />
              <input
                type="email"
                placeholder="Email (login)"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
                className="medical-input w-full"
              />
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                required
                minLength={6}
                className="medical-input w-full"
              />
              <div className="flex gap-3 pt-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={saving}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 medical-btn-primary text-sm disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
