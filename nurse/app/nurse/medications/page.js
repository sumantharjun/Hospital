"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import NurseLayout from "../../components/NurseLayout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const STATUS_COLORS = {
  PENDING:       "bg-yellow-100 text-yellow-700",
  ADMINISTERED:  "bg-green-100 text-green-700",
  SKIPPED:       "bg-gray-100 text-slate-500",
  REFUSED:       "bg-red-100 text-red-700",
};

const ROUTE_OPTIONS = ["Oral", "IV", "IM", "SC", "Topical", "Inhalation", "Sublingual", "Rectal", "Nasal"];
const FREQ_OPTIONS  = ["Once daily", "Twice daily", "Three times daily", "Four times daily", "Every 6 hours", "Every 8 hours", "Every 12 hours", "As needed", "Stat"];

function MedicationsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ipId = searchParams.get("ipId") || "";

  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchIpId, setSearchIpId] = useState(ipId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ipId: ipId, medicationName: "", dosage: "", route: "Oral",
    frequency: "Once daily", scheduledTime: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.replace("/"); return; }
    if (ipId) fetchMeds(ipId);
  }, [ipId, router]);

  async function fetchMeds(id) {
    if (!id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/medications?ipId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMeds(await res.json());
      else setMeds([]);
    } catch (_) { setMeds([]); }
    finally { setLoading(false); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.ipId.trim() || !form.medicationName.trim()) {
      toast.error("IP ID and medication name are required");
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, status: "PENDING" }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to save");
      toast.success("Medication order added");
      setShowForm(false);
      setForm(f => ({ ...f, medicationName: "", dosage: "", route: "Oral", frequency: "Once daily", scheduledTime: "", notes: "" }));
      fetchMeds(form.ipId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    setUpdating(id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/medications/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, administeredAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(`Marked as ${status}`);
      setMeds(m => m.map(med => med._id === id ? { ...med, status } : med));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <NurseLayout>
      <div className="nurse-page space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Medication Administration</h1>
            <p className="text-sm text-slate-500 mt-1">Track and administer patient medications</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="nurse-btn-primary px-4 py-2 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Order
          </button>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter IP ID to load medications..."
            value={searchIpId}
            onChange={e => setSearchIpId(e.target.value)}
            className="nurse-input flex-1"
          />
          <button onClick={() => { setForm(f => ({ ...f, ipId: searchIpId })); fetchMeds(searchIpId); }}
            className="nurse-btn-primary px-5 py-2 text-sm font-medium">
            Load
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="nurse-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">New Medication Order</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Patient IP ID <span className="text-red-500">*</span></label>
                <input type="text" value={form.ipId} onChange={e => setForm(f => ({ ...f, ipId: e.target.value }))}
                  placeholder="IP-20240101-0001"
                  className="nurse-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Medication Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.medicationName} onChange={e => setForm(f => ({ ...f, medicationName: e.target.value }))}
                  placeholder="e.g. Paracetamol 500mg"
                  className="nurse-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dosage</label>
                <input type="text" value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
                  placeholder="e.g. 500mg, 10mL"
                  className="nurse-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Route</label>
                <select value={form.route} onChange={e => setForm(f => ({ ...f, route: e.target.value }))}
                  className="nurse-input">
                  {ROUTE_OPTIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Frequency</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                  className="nurse-input">
                  {FREQ_OPTIONS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Scheduled Time</label>
                <input type="time" value={form.scheduledTime} onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                  className="nurse-input" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Special instructions..."
                className="nurse-input resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="nurse-btn-primary px-5 py-2 text-sm font-medium disabled:opacity-60">
                {saving ? "Adding..." : "Add Order"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading medications...</div>
        ) : meds.length === 0 ? (
          <div className="text-center py-12 text-slate-400 nurse-card border border-slate-200">
            <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <p className="text-sm">No medication orders. Enter an IP ID above to load.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {meds.map((med) => (
              <div key={med._id} className="nurse-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{med.medicationName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {[med.dosage, med.route, med.frequency].filter(Boolean).join(" - ")}
                      {med.scheduledTime && ` - ${med.scheduledTime}`}
                    </div>
                    {med.notes && <div className="text-xs text-slate-400 mt-1 italic">{med.notes}</div>}
                    {med.administeredAt && (
                      <div className="text-xs text-teal-600 mt-1">
                        Administered: {new Date(med.administeredAt).toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STATUS_COLORS[med.status] || "bg-gray-100 text-slate-600"}`}>
                    {med.status || "PENDING"}
                  </span>
                </div>
                {med.status === "PENDING" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => updateStatus(med._id, "ADMINISTERED")} disabled={updating === med._id}
                      className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors font-medium">
                      Mark Given
                    </button>
                    <button onClick={() => updateStatus(med._id, "SKIPPED")} disabled={updating === med._id}
                      className="text-xs bg-gray-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-gray-300 disabled:opacity-60 transition-colors font-medium">
                      Skip
                    </button>
                    <button onClick={() => updateStatus(med._id, "REFUSED")} disabled={updating === med._id}
                      className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 disabled:opacity-60 transition-colors font-medium">
                      Refused
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </NurseLayout>
  );
}

export default function MedicationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Loading medications…</p>
        </div>
      </div>
    }>
      <MedicationsPageInner />
    </Suspense>
  );
}
