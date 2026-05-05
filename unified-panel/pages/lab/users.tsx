import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

const ROLES = ["LAB_TECHNICIAN", "LAB_MANAGER", "DOCTOR"];

export default function LabUsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", phone: "", role: "LAB_TECHNICIAN" });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      const res = await fetch(buildApiUrl(`/api/users?${params}`), { headers: getAuthHeaders() });
      const data = res.ok ? await res.json() : [];
      const all = Array.isArray(data) ? data : data.users || [];
      // Filter to lab-relevant roles
      const labRoles = new Set(["LAB_TECHNICIAN", "LAB_MANAGER", "DOCTOR", "ADMIN"]);
      setUsers(roleFilter === "ALL" ? all.filter((u: any) => labRoles.has(u.role || "")) : all);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) { toast.error("Name and email are required"); return; }
    setInviting(true);
    try {
      const res = await fetch(buildApiUrl("/api/users/invite"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to invite user");
      toast.success("User invited successfully");
      setShowInvite(false);
      setInviteForm({ name: "", email: "", phone: "", role: "LAB_TECHNICIAN" });
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  const filtered = users.filter((u: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || u.mobile || "").includes(q)
    );
  });

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Lab Users</h1>
            <p className="mt-1 text-sm text-zinc-500">Manage lab technicians, managers and associated doctors.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchUsers} className="px-4 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">Refresh</button>
            <button onClick={() => setShowInvite(!showInvite)} className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">
              {showInvite ? "Cancel" : "+ Invite User"}
            </button>
          </div>
        </div>

        {showInvite && (
          <form onSubmit={inviteUser} className="medical-card p-6 space-y-4">
            <h2 className="font-semibold text-zinc-900">Invite Lab User</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name *</label>
                <input type="text" value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" className="medical-input w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email *</label>
                <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className="medical-input w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
                <input type="text" value={inviteForm.phone} onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Optional" className="medical-input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Role</label>
                <select value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))} className="medical-input w-full">
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={inviting} className="medical-btn-primary px-5 py-2 disabled:opacity-50">{inviting ? "Sending invite…" : "Send Invite"}</button>
              <button type="button" onClick={() => setShowInvite(false)} className="px-5 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
            </div>
          </form>
        )}

        <div className="medical-card p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or phone…" className="medical-input w-full" />
          </div>
          <div>
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); }} className="medical-input">
              <option value="ALL">All Roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button onClick={fetchUsers} className="medical-btn-primary px-4 py-2 text-sm">Filter</button>
        </div>

        <div className="medical-card overflow-hidden">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Lab Staff</h2>
            <span className="text-sm text-zinc-500">{filtered.length} user(s)</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No lab users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    {["Name", "Email", "Phone", "Role", "Status", "Joined"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map((u: any) => (
                    <tr key={u._id || u.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{u.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{u.email || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{u.phone || u.mobile || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {(u.role || "").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {u.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
