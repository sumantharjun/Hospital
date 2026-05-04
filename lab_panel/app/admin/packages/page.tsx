"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { LabPackage, LabTest } from "@/lib/types";
import toast from "react-hot-toast";

export default function PackagesPage() {
  const [packages, setPackages] = useState<LabPackage[]>([]);
  const [allTests, setAllTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LabPackage | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: 0, discountPercent: 0, taxPercent: 0 });
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewPkg, setViewPkg] = useState<LabPackage | null>(null);

  async function load() {
    try {
      const [pkgData, testData] = await Promise.all([
        apiGet<{ packages: LabPackage[] }>("/api/lab/packages"),
        apiGet<{ tests: LabTest[] }>("/api/lab/tests?activeOnly=true"),
      ]);
      setPackages(pkgData.packages);
      setAllTests(testData.tests);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", price: 0, discountPercent: 0, taxPercent: 0 });
    setSelectedTests([]);
    setShowForm(true);
  }

  function openEdit(p: LabPackage) {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? "", price: p.price, discountPercent: p.discountPercent, taxPercent: p.taxPercent ?? 0 });
    setSelectedTests(p.tests.map((t) => t._id));
    setShowForm(true);
  }

  function toggleTest(id: string) {
    setSelectedTests((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function save() {
    if (!form.name || selectedTests.length === 0) { toast.error("Name and at least one test required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, tests: selectedTests };
      if (editing) { await apiPatch(`/api/lab/packages/${editing._id}`, payload); toast.success("Package updated"); }
      else { await apiPost("/api/lab/packages", payload); toast.success("Package created"); }
      setShowForm(false);
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(p: LabPackage) {
    try {
      if (p.isActive) { await apiDelete(`/api/lab/packages/${p._id}`); toast.success("Package disabled"); }
      else { await apiPatch(`/api/lab/packages/${p._id}`, { isActive: true }); toast.success("Package enabled"); }
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Test Packages</h1>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Add Package</button>
      </div>

      {loading ? <div className="text-gray-400 text-center py-10">Loading…</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((p) => (
            <div key={p._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 cursor-pointer" onClick={() => setViewPkg(p)}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs ${p.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {p.isActive ? "Active" : "Disabled"}
                </span>
              </div>
              {p.description && <p className="text-xs text-gray-500 mb-3">{p.description}</p>}
              <div className="text-xs text-gray-500 mb-3">
                {p.tests.length} test{p.tests.length !== 1 ? "s" : ""}: {p.tests.map((t) => t.name).join(", ")}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-blue-600">₹{p.price}</span>
                  {p.originalPrice > p.price && <span className="text-xs text-gray-400 line-through ml-2">₹{p.originalPrice}</span>}
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); toggleActive(p); }} className={p.isActive ? "text-red-500 hover:underline" : "text-green-600 hover:underline"}>
                    {p.isActive ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {packages.length === 0 && <div className="col-span-3 text-center py-10 text-gray-400">No packages yet</div>}
        </div>
      )}

      {/* View Modal */}
      {viewPkg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative">
            <h2 className="text-lg font-bold mb-4">{viewPkg.name}</h2>
            {viewPkg.description && <p className="text-sm text-gray-500 mb-4">{viewPkg.description}</p>}
            <div className="grid grid-cols-2 gap-3 text-sm mb-5">
              <div><span className="text-gray-500">Price:</span> <span className="font-medium text-blue-600">₹{viewPkg.price}</span></div>
              {viewPkg.originalPrice > viewPkg.price && (
                <div><span className="text-gray-500">Original Price:</span> <span className="font-medium line-through text-gray-400">₹{viewPkg.originalPrice}</span></div>
              )}
              <div><span className="text-gray-500">Discount:</span> <span className="font-medium">{viewPkg.discountPercent}%</span></div>
              <div><span className="text-gray-500">Tax:</span> <span className="font-medium">{viewPkg.taxPercent}%</span></div>
              <div>
                <span className="text-gray-500">Status:</span>{" "}
                <span className={`px-2 py-0.5 rounded-full text-xs ${viewPkg.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {viewPkg.isActive ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
            <h3 className="font-semibold text-sm mb-2">Included Tests</h3>
            <ul className="space-y-1">
              {viewPkg.tests.map((t) => (
                <li key={t._id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{t.category}</span>
                  </div>
                  <span className="text-blue-600 font-medium">₹{t.price}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-5">
              <button onClick={() => setViewPkg(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? "Edit Package" : "Add Package"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Package Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹)</label>
                <input
                  type="number"
                  value={form.price}
                  min={0}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={(e) => setForm((f) => ({ ...f, price: Math.max(0, Number(e.target.value)) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Discount %</label>
                <input
                  type="number"
                  value={form.discountPercent}
                  min={0}
                  max={100}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={(e) => setForm((f) => ({ ...f, discountPercent: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tax %</label>
                <input
                  type="number"
                  value={form.taxPercent}
                  min={0}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={(e) => setForm((f) => ({ ...f, taxPercent: Math.max(0, Number(e.target.value)) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Select Tests</label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                  {allTests.map((t) => (
                    <label key={t._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input type="checkbox" checked={selectedTests.includes(t._id)} onChange={() => toggleTest(t._id)} className="rounded" />
                      <span className="text-sm">{t.name}</span>
                      <span className="text-xs text-gray-400 ml-auto">₹{t.price}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
