"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { LabTest, TestParameter } from "@/lib/types";
import toast from "react-hot-toast";

const CATEGORIES = ["HEMATOLOGY", "BIOCHEMISTRY", "MICROBIOLOGY", "IMMUNOLOGY", "UROLOGY", "HORMONES", "SEROLOGY", "OTHER"];

const emptyTest = { name: "", code: "", category: "HEMATOLOGY", description: "", sampleType: "", price: 0, taxPercent: 0, turnAroundTimeHours: 24 };
const emptyParam: TestParameter = { name: "", unit: "", normalMin: undefined, normalMax: undefined, referenceText: "", printOrder: 0 };

export default function TestsPage() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LabTest | null>(null);
  const [form, setForm] = useState<typeof emptyTest>(emptyTest);
  const [params, setParams] = useState<TestParameter[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const d = await apiGet<{ tests: LabTest[] }>("/api/lab/tests");
      setTests(d.tests);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyTest);
    setParams([]);
    setShowForm(true);
  }

  function openEdit(t: LabTest) {
    setEditing(t);
    setForm({ name: t.name, code: t.code, category: t.category, description: t.description ?? "", sampleType: t.sampleType, price: t.price, taxPercent: t.taxPercent, turnAroundTimeHours: t.turnAroundTimeHours });
    setParams(t.parameters.map((p) => ({ ...p })));
    setShowForm(true);
  }

  function addParam() { setParams((prev) => [...prev, { ...emptyParam, printOrder: prev.length }]); }
  function removeParam(i: number) { setParams((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateParam(i: number, key: keyof TestParameter, value: any) {
    setParams((prev) => prev.map((p, idx) => idx === i ? { ...p, [key]: value } : p));
  }

  async function save() {
    if (!form.name || !form.code || !form.sampleType) { toast.error("Name, code and sample type are required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, parameters: params };
      if (editing) {
        await apiPatch(`/api/lab/tests/${editing._id}`, payload);
        toast.success("Test updated");
      } else {
        await apiPost("/api/lab/tests", payload);
        toast.success("Test created");
      }
      setShowForm(false);
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(t: LabTest) {
    try {
      if (t.isActive) {
        await apiDelete(`/api/lab/tests/${t._id}`);
        toast.success("Test disabled");
      } else {
        await apiPatch(`/api/lab/tests/${t._id}`, { isActive: true });
        toast.success("Test enabled");
      }
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Test Catalog</h1>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Add Test</button>
      </div>

      {loading ? <div className="text-gray-400 text-center py-10">Loading…</div> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Sample</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tests.map((t) => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-gray-500">{t.code}</td>
                  <td className="px-4 py-3 text-gray-500">{t.category}</td>
                  <td className="px-4 py-3 text-gray-500">{t.sampleType}</td>
                  <td className="px-4 py-3 text-right">₹{t.price}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${t.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {t.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => toggleActive(t)} className={`text-xs ${t.isActive ? "text-red-500" : "text-green-600"} hover:underline`}>
                      {t.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
              {tests.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No tests yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? "Edit Test" : "Add Test"}</h2>
            <div className="grid grid-cols-2 gap-4">
              {([
                ["name", "Test Name", "text"], ["code", "Code", "text"], ["sampleType", "Sample Type", "text"],
                ["price", "Price (₹)", "number"], ["taxPercent", "Tax %", "number"], ["turnAroundTimeHours", "TAT (hours)", "number"],
              ] as [keyof typeof form, string, string][]).map(([k, label, type]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={(form as any)[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: type === "number" ? Number(e.target.value) : e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Parameters</h3>
                <button onClick={addParam} className="text-xs text-blue-600 hover:underline">+ Add Parameter</button>
              </div>
              <div className="space-y-2">
                {params.map((p, i) => (
                  <div key={i} className="border rounded-lg p-3 grid grid-cols-5 gap-2">
                    {(["name", "unit"] as const).map((k) => (
                      <input key={k} placeholder={k} value={p[k]} onChange={(e) => updateParam(i, k, e.target.value)}
                        className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    ))}
                    <input type="number" placeholder="Min" value={p.normalMin ?? ""} onChange={(e) => updateParam(i, "normalMin", e.target.value ? Number(e.target.value) : undefined)}
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="number" placeholder="Max" value={p.normalMax ?? ""} onChange={(e) => updateParam(i, "normalMax", e.target.value ? Number(e.target.value) : undefined)}
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <button onClick={() => removeParam(i)} className="text-red-500 text-xs hover:underline">Remove</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
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
