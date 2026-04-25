"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";
import type { LabSettings } from "@/lib/types";
import toast from "react-hot-toast";

export default function PricingPage() {
  const [settings, setSettings] = useState<LabSettings | null>(null);
  const [form, setForm] = useState<LabSettings>({
    labName: "", address: "", phone: "", email: "",
    registrationCharge: 0, defaultTaxPercent: 0,
    reportHeader: "", reportFooter: "", doctorSignatureName: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<{ settings: LabSettings }>("/api/lab/settings")
      .then((d) => { setSettings(d.settings); setForm(d.settings); })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const d = await apiPatch<{ settings: LabSettings }>("/api/lab/settings", form);
      setSettings(d.settings);
      toast.success("Settings saved");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;

  const fields: Array<[keyof LabSettings, string, string]> = [
    ["labName", "Lab Name", "text"],
    ["address", "Address", "text"],
    ["phone", "Phone", "text"],
    ["email", "Email", "email"],
    ["registrationCharge", "Registration Charge (₹)", "number"],
    ["defaultTaxPercent", "Default Tax %", "number"],
    ["reportHeader", "Report Header Text", "text"],
    ["reportFooter", "Report Footer Text", "text"],
    ["doctorSignatureName", "Doctor / Pathologist Name", "text"],
  ];

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pricing & Settings</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        {fields.map(([k, label, type]) => (
          <div key={k}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type}
              value={(form as any)[k] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [k]: type === "number" ? Number(e.target.value) : e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
        <div className="pt-2">
          <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-lg font-medium text-sm">
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
