"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
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
  const [showPwd, setShowPwd] = useState(false);

  const [viewUser, setViewUser] = useState<LabUser | null>(null);

  const [editUser, setEditUser] = useState<LabUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "" });
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    try {
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Invalid email address"); return; }
    setSaving(true);
    try {
      const me = getStoredUser();
      await apiPost("/api/users/signup", { ...form, labId: me?.sub });
      toast.success("User created");
      setShowForm(false);
      setForm({ name: "", email: "", password: "", role: "LAB_OPERATOR" });
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  function openEdit(u: LabUser) {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, password: "" });
    setShowEditPwd(false);
  }

  async function saveEdit() {
    if (!editUser) return;
    if (!editForm.name.trim()) { toast.error("Name is required"); return; }
    if (!editForm.email.trim()) { toast.error("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) { toast.error("Invalid email address"); return; }
    setEditSaving(true);
    try {
      const payload: any = { name: editForm.name, email: editForm.email };
      if (editForm.password) payload.password = editForm.password;
      await apiPatch(`/api/users/${editUser._id}/lab-update`, payload);
      toast.success("User updated");
      setEditUser(null);
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setEditSaving(false); }
  }

  async function toggleDeactivate(u: LabUser) {
    const action = u.isActive === false ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${u.name}?`)) return;
    try {
      await apiPatch(`/api/users/${u._id}/${action}`, {});
      toast.success(`User ${action}d`);
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  async function deleteUser(u: LabUser) {
    if (!window.confirm(`Are you sure you want to delete ${u.name}? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/users/${u._id}/lab-delete`);
      toast.success("User deleted");
      load();
    } catch (err: any) { toast.error(err.message); }
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
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewUser(u)}>
                  <td className="px-4 py-3 font-medium">
                    <span className="font-medium">{u.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "LAB_ADMIN" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {u.role === "LAB_ADMIN" ? "Admin" : "Operator"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive === false ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                      {u.isActive === false ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(u); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDeactivate(u); }}
                      className={`text-xs hover:underline ${u.isActive === false ? "text-green-600" : "text-yellow-600"}`}
                    >
                      {u.isActive === false ? "Activate" : "Deactivate"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteUser(u); }} className="text-xs text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No users yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* View User Modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative">
            <h2 className="text-lg font-bold mb-4">User Details</h2>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium ml-1">{viewUser.name}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="font-medium ml-1">{viewUser.email}</span></div>
              <div>
                <span className="text-gray-500">Role:</span>{" "}
                <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${viewUser.role === "LAB_ADMIN" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                  {viewUser.role === "LAB_ADMIN" ? "Admin" : "Operator"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>{" "}
                <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${viewUser.isActive === false ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                  {viewUser.isActive === false ? "Inactive" : "Active"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Joined:</span>{" "}
                <span className="font-medium ml-1">{viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleDateString("en-IN") : "—"}</span>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setViewUser(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Edit User</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Password <span className="text-gray-400">(leave blank to keep current)</span></label>
                <div className="relative">
                  <input
                    type={showEditPwd ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPwd((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showEditPwd ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Add User</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPwd ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
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
