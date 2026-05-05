import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { buildApiUrl, getAuthHeaders } from "@/lib/api";
import Layout from "@/components/Layout";

export default function LabTestsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", price: "", turnaroundTime: "", description: "", sampleType: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setUser(JSON.parse(u));
    fetchTests();
  }, []);

  async function fetchTests() {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/lab/tests"), { headers: getAuthHeaders() });
      const data = res.ok ? await res.json() : [];
      setTests(Array.isArray(data) ? data : data.tests || []);
    } catch {
      toast.error("Failed to load tests");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Test name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(buildApiUrl("/api/lab/tests"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price: Number(form.price) || 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save test");
      toast.success("Test added successfully");
      setShowForm(false);
      setForm({ name: "", category: "", price: "", turnaroundTime: "", description: "", sampleType: "" });
      fetchTests();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const filtered = tests.filter((t: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.name || "").toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q);
  });

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Lab Tests</h1>
            <p className="mt-1 text-sm text-zinc-500">Manage available lab tests and their pricing.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchTests} className="px-4 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Refresh
            </button>
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">
              {showForm ? "Cancel" : "+ Add Test"}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSave} className="medical-card p-6 space-y-4">
            <h2 className="font-semibold text-zinc-900">Add New Test</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Test Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Complete Blood Count" className="medical-input w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
                <input type="text" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Haematology" className="medical-input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Price (₹)</label>
                <input type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="0" className="medical-input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Turnaround Time</label>
                <input type="text" value={form.turnaroundTime} onChange={(e) => setForm((f) => ({ ...f, turnaroundTime: e.target.value }))} placeholder="e.g. 24 hours" className="medical-input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Sample Type</label>
                <input type="text" value={form.sampleType} onChange={(e) => setForm((f) => ({ ...f, sampleType: e.target.value }))} placeholder="e.g. Blood, Urine" className="medical-input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" className="medical-input w-full" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="medical-btn-primary px-5 py-2 disabled:opacity-50">{saving ? "Saving…" : "Save Test"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 border border-zinc-300 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
            </div>
          </form>
        )}

        <div className="medical-card p-4">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tests by name or category…" className="medical-input w-full" />
        </div>

        <div className="medical-card overflow-hidden">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Test Catalogue</h2>
            <span className="text-sm text-zinc-500">{filtered.length} test(s)</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading tests…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No tests found{search ? " matching your search" : ". Add a test to get started"}.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    {["Test Name", "Category", "Sample Type", "Price", "TAT", "Description"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map((t: any) => (
                    <tr key={t._id || t.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{t.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{t.category || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{t.sampleType || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">₹{(t.price || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-zinc-600">{t.turnaroundTime || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs max-w-xs truncate">{t.description || "—"}</td>
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
