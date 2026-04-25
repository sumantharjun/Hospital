"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import toast from "react-hot-toast";

interface LabUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<LabUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "LAB_OPERATOR" });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      // Fetch both roles in parallel — backend exposes /by-role/:role (returns plain array)
      const [admins, operators] = await Promise.all([
        apiGet<LabUser[]>("/api/users/by-role/LAB_ADMIN"),
        apiGet<LabUser[]>("/api/users/by-role/LAB_OPERATOR"),
      ]);
      setUsers([...(Array.isArray(admins) ? admins : []), ...(Array.isArray(operators) ? operators : [])]);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    if (!form.name || !form.email || !form.password) { toast.error("All fields are required"); return; }
    setSaving(true);
    try {
      await apiPost("/api/users/signup", form);
      toast.success("User created");
      setShowForm(false);
      setForm({ name: "", email: "", password: "", role: "LAB_OPERATOR" });
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Add User</button>
      </div>

      {loading ? <div className="text-gray-400 text-center py-10">Loading…</div> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "LAB_ADMIN" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {u.role === "LAB_ADMIN" ? "Admin" : "Operator"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">No users yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Add User</h2>
            <div className="space-y-3">
              {[["name", "Full Name", "text"], ["email", "Email", "email"], ["password", "Password", "password"]].map(([k, label, type]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type as string} value={(form as any)[k as string]} onChange={(e) => setForm((f) => ({ ...f, [k as string]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="LAB_OPERATOR">Lab Operator</option>
                  <option value="LAB_ADMIN">Lab Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={createUser} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
