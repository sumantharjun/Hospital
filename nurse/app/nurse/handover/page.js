"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import NurseLayout from "../../components/NurseLayout";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";

export default function HandoverPage() {
  const router = useRouter();
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNurses, setActiveNurses] = useState([]);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("nurseUser");
    if (!t || !u) { router.replace("/"); return; }
    const user = JSON.parse(u);
    Promise.all([
      fetch(buildApiUrl("/api/nurse/timesheets/mine?"), { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []),
      fetch(buildApiUrl(`/api/nurse/active-nurses${user.hospitalId ? `?hospitalId=${user.hospitalId}` : ""}`), { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []),
    ]).then(([s, n]) => {
      // Only show sheets without handover or ongoing
      setSheets(Array.isArray(s) ? s.filter(sh => !sh.checkOut) : []);
      setActiveNurses(Array.isArray(n) ? n : []);
    }).finally(() => setLoading(false));
  }, [router]);

  const recordHandover = async (sheetId, handoverTo, handoverNotes, checklist) => {
    try {
      const handoverToNurse = activeNurses.find(n => n._id === handoverTo);
      const res = await fetch(buildApiUrl(`/api/nurse/timesheets/${sheetId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          handoverTo,
          handoverToName: handoverToNurse?.name,
          handoverNotes,
          handoverChecklist: checklist,
          checkOut: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Handover recorded and shift closed!");
      setSheets(p => p.filter(s => s._id !== sheetId));
    } catch (err) { toast.error(err.message || "Failed to record handover"); }
  };

  return (
    <NurseLayout>
      <div className="nurse-page space-y-6">
        <div className="nurse-card p-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pending Handovers</h1>
            <p className="text-sm text-slate-500 mt-1">Complete transfer notes and close ongoing shifts</p>
          </div>
          <span className="nurse-badge bg-orange-50 text-orange-700">{sheets.length} pending</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : sheets.length === 0 ? (
          <div className="text-center py-12 text-slate-400 nurse-card">
            <div className="w-14 h-14 mx-auto bg-emerald-50 rounded-full flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-sm text-slate-500">No pending handovers. All shifts are closed.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {sheets.map(s => <HandoverCard key={s._id} sheet={s} nurses={activeNurses} onHandover={recordHandover} />)}
          </div>
        )}
      </div>
    </NurseLayout>
  );
}

function HandoverCard({ sheet, nurses, onHandover }) {
  const [handoverTo, setHandoverTo] = useState("");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState({ vitals: false, medicationPending: false, labPending: false, observations: false, specialInstructions: false });
  const [saving, setSaving] = useState(false);

  const checklistLabels = [
    ["vitals", "Vitals communicated"],
    ["medicationPending", "Pending medications informed"],
    ["labPending", "Pending lab results shared"],
    ["observations", "Observations documented"],
    ["specialInstructions", "Special instructions given"],
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!handoverTo) { alert("Select the nurse to handover to"); return; }
    setSaving(true);
    await onHandover(sheet._id, handoverTo, notes, checklist);
    setSaving(false);
  };

  return (
    <div className="nurse-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-orange-500">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
        </svg>
      </span>
        <div>
          <div className="font-semibold text-slate-900 text-sm">{sheet.patientCategoryId}</div>
          <div className="text-xs text-slate-500">{sheet.patientCategory} - Shift: {sheet.shiftType} - In: {sheet.checkIn ? new Date(sheet.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Handover To *</label>
          <select required className="nurse-input mt-1"
            value={handoverTo} onChange={e => setHandoverTo(e.target.value)}>
            <option value="">Select nurse</option>
            {nurses.map(n => <option key={n._id} value={n._id}>{n.name} ({n.department || "Nursing"})</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Handover Notes</label>
          <textarea rows={2} className="nurse-input mt-1"
            placeholder="Any important information for the next nurse..."
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-2 block">Checklist</label>
          <div className="space-y-1.5">
            {checklistLabels.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={checklist[key]}
                  onChange={e => setChecklist(p => ({ ...p, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="nurse-btn-primary w-full py-2.5 text-sm font-medium disabled:opacity-50">
          {saving ? "Recording..." : "Complete Handover & Close Shift"}
        </button>
      </form>
    </div>
  );
}

