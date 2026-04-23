"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import NurseLayout from "../../components/NurseLayout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const VITAL_FIELDS = [
  { key: "temperature",     label: "Temperature (F)",   placeholder: "98.6",  type: "number" },
  { key: "pulse",           label: "Pulse (bpm)",       placeholder: "72",    type: "number" },
  { key: "respiratoryRate", label: "Respiratory Rate",  placeholder: "16",    type: "number" },
  { key: "bloodPressure",   label: "Blood Pressure",    placeholder: "120/80",type: "text"   },
  { key: "spo2",            label: "SpO2 (%)",          placeholder: "98",    type: "number" },
  { key: "weight",          label: "Weight (kg)",       placeholder: "70",    type: "number" },
  { key: "bloodSugar",      label: "Blood Sugar (mg/dL)", placeholder: "100", type: "number" },
  { key: "pain",            label: "Pain Score (0-10)", placeholder: "0",     type: "number" },
];

const alertLevel = (key, val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return "";
  if (key === "temperature") return n > 103 ? "text-red-600 font-bold" : n > 100 ? "text-yellow-600" : "text-teal-600";
  if (key === "pulse") return n > 120 || n < 50 ? "text-red-600 font-bold" : "text-teal-600";
  if (key === "spo2") return n < 90 ? "text-red-600 font-bold" : n < 95 ? "text-yellow-600" : "text-teal-600";
  if (key === "pain") return n >= 7 ? "text-red-600 font-bold" : n >= 4 ? "text-yellow-600" : "text-teal-600";
  return "text-slate-700";
};

function VitalsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ipId = searchParams.get("ipId") || "";

  const [form, setForm] = useState({
    ipId: ipId,
    temperature: "", pulse: "", respiratoryRate: "", bloodPressure: "",
    spo2: "", weight: "", bloodSugar: "", pain: "", notes: "",
  });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.replace("/"); return; }
    if (ipId) fetchHistory(ipId);
  }, [ipId, router]);

  async function fetchHistory(id) {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/vitals?ipId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHistory(await res.json());
    } catch (_) {}
    finally { setLoadingHistory(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ipId.trim()) { toast.error("Please enter an IP ID"); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, recordedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to save");
      toast.success("Vitals recorded successfully");
      setForm(f => ({ ...f, temperature: "", pulse: "", respiratoryRate: "", bloodPressure: "", spo2: "", weight: "", bloodSugar: "", pain: "", notes: "" }));
      fetchHistory(form.ipId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <NurseLayout>
      <div className="nurse-page space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Record Vitals</h1>
          <p className="text-sm text-slate-500 mt-1">Document patient vital signs with timestamp</p>
        </div>

        <form onSubmit={handleSubmit} className="nurse-card p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Patient IP ID <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.ipId}
              onChange={e => setForm(f => ({ ...f, ipId: e.target.value }))}
              placeholder="e.g. IP-20240101-0001"
              className="nurse-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VITAL_FIELDS.map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  step={type === "number" ? "0.1" : undefined}
                  className={`nurse-input ${alertLevel(key, form[key])}`}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Clinical Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Observations, interventions, patient response..."
              className="nurse-input resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="nurse-btn-primary px-6 py-2.5 text-sm font-medium disabled:opacity-60">
              {saving ? "Saving..." : "Save Vitals"}
            </button>
            <button type="button" onClick={() => router.back()}
              className="border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>

        {form.ipId && (
          <div className="nurse-card p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Vitals History - {form.ipId}</h2>
            {loadingHistory ? (
              <div className="text-sm text-slate-400">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center">No vitals recorded yet for this patient.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-2 pr-4 text-slate-500 font-medium">Time</th>
                      <th className="py-2 pr-4 text-slate-500 font-medium">Temp</th>
                      <th className="py-2 pr-4 text-slate-500 font-medium">Pulse</th>
                      <th className="py-2 pr-4 text-slate-500 font-medium">BP</th>
                      <th className="py-2 pr-4 text-slate-500 font-medium">SpO2</th>
                      <th className="py-2 pr-4 text-slate-500 font-medium">RR</th>
                      <th className="py-2 text-slate-500 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((v, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 pr-4 text-slate-600 whitespace-nowrap">{new Date(v.recordedAt || v.createdAt).toLocaleString("en-IN")}</td>
                        <td className={`py-2 pr-4 font-medium ${alertLevel("temperature", v.temperature)}`}>{v.temperature ? `${v.temperature} F` : "-"}</td>
                        <td className={`py-2 pr-4 font-medium ${alertLevel("pulse", v.pulse)}`}>{v.pulse ? `${v.pulse} bpm` : "-"}</td>
                        <td className="py-2 pr-4">{v.bloodPressure || "-"}</td>
                        <td className={`py-2 pr-4 font-medium ${alertLevel("spo2", v.spo2)}`}>{v.spo2 ? `${v.spo2}%` : "-"}</td>
                        <td className="py-2 pr-4">{v.respiratoryRate || "-"}</td>
                        <td className="py-2 text-slate-500 max-w-xs truncate">{v.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </NurseLayout>
  );
}

export default function VitalsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Loading vitals…</p>
        </div>
      </div>
    }>
      <VitalsPageInner />
    </Suspense>
  );
}
