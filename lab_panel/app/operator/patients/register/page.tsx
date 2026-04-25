"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import toast from "react-hot-toast";

export default function RegisterPatient() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", age: "", gender: "MALE", dob: "", phone: "", email: "", address: "", bloodGroup: "", referredBy: "" });
  const [saving, setSaving] = useState(false);

  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name || !form.age || !form.phone) { toast.error("Name, age and phone are required"); return; }
    setSaving(true);
    try {
      const d = await apiPost<{ patient: { _id: string } }>("/api/lab/patients", { ...form, age: Number(form.age) });
      toast.success("Patient registered");
      router.push(`/operator/orders/new?patientId=${d.patient._id}`);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  const fields: Array<[keyof typeof form, string, string, string?]> = [
    ["name", "Full Name", "text"],
    ["age", "Age", "number"],
    ["phone", "Phone", "tel"],
    ["email", "Email (optional)", "email"],
    ["dob", "Date of Birth", "date"],
    ["address", "Address", "text"],
    ["bloodGroup", "Blood Group", "text"],
    ["referredBy", "Referred By", "text"],
  ];

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Register Patient</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {fields.map(([k, label, type]) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={form[k]} onChange={(e) => set(k, e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select value={form.gender} onChange={(e) => set("gender", e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        <div className="pt-2 flex gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2.5 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400">
            {saving ? "Registering…" : "Register & Create Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
