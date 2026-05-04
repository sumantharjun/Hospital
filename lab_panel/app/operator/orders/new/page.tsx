"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import type { LabTest, LabPackage, LabPatient } from "@/lib/types";
import toast from "react-hot-toast";

const today = new Date().toISOString().split("T")[0];

const emptyPatient = { name: "", phone: "", age: "", gender: "MALE", dob: "", email: "", bloodGroup: "", referredBy: "", address: "" };

function NewOrderForm() {
  const router = useRouter();

  const [tests, setTests] = useState<LabTest[]>([]);
  const [packages, setPackages] = useState<LabPackage[]>([]);
  const [patient, setPatient] = useState<typeof emptyPatient>(emptyPatient);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<{ tests: LabTest[] }>("/api/lab/tests?activeOnly=true"),
      apiGet<{ packages: LabPackage[] }>("/api/lab/packages?activeOnly=true"),
    ]).then(([td, pkd]) => {
      setTests(td.tests);
      setPackages(pkd.packages);
    }).catch((err) => toast.error(err.message))
    .finally(() => setLoading(false));
  }, []);

  function toggleTest(id: string) { setSelectedTests((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }
  function togglePkg(id: string) { setSelectedPackages((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }

  const subtotal =
    tests.filter((t) => selectedTests.includes(t._id)).reduce((s, t) => s + t.price, 0) +
    packages.filter((p) => selectedPackages.includes(p._id)).reduce((s, p) => s + p.price, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const grandTotal = subtotal - discountAmount;

  async function submit() {
    if (!patient.name.trim()) { toast.error("Patient name is required"); return; }
    if (!patient.phone.trim()) { toast.error("Patient phone is required"); return; }
    if (!patient.age || Number(patient.age) <= 0) { toast.error("Valid age is required"); return; }
    if (patient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) { toast.error("Invalid email address"); return; }
    if (selectedTests.length === 0 && selectedPackages.length === 0) { toast.error("Select at least one test or package"); return; }

    setSaving(true);
    try {
      const patientPayload: Record<string, any> = {
        name: patient.name.trim(),
        phone: patient.phone.trim(),
        age: Number(patient.age),
        gender: patient.gender,
      };
      if (patient.dob) patientPayload.dob = patient.dob;
      if (patient.email) patientPayload.email = patient.email.trim();
      if (patient.bloodGroup) patientPayload.bloodGroup = patient.bloodGroup;
      if (patient.referredBy) patientPayload.referredBy = patient.referredBy.trim();
      if (patient.address) patientPayload.address = patient.address.trim();

      const { patient: savedPatient, created } = await apiPost<{ patient: LabPatient; created: boolean }>(
        "/api/lab/patients/find-or-create",
        patientPayload
      );

      if (!created) toast.success(`Existing patient found: ${savedPatient.name}`);

      await apiPost("/api/lab/orders", {
        patientId: savedPatient._id,
        testIds: selectedTests,
        packageIds: selectedPackages,
        discountPercent,
        notes,
      });

      toast.success("Order created");
      router.push("/operator/orders");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Test Order</h1>
      </div>

      <div className="space-y-5">
        {/* Patient Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold mb-4">Patient Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={patient.name}
                onChange={(e) => setPatient((p) => ({ ...p, name: e.target.value }))}
                placeholder="Patient full name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-red-500">*</span></label>
              <input
                type="tel"
                value={patient.phone}
                onChange={(e) => setPatient((p) => ({ ...p, phone: e.target.value }))}
                placeholder="10-digit mobile number"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Age <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={patient.age}
                min={0}
                max={150}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                onChange={(e) => setPatient((p) => ({ ...p, age: e.target.value }))}
                placeholder="Age in years"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gender <span className="text-red-500">*</span></label>
              <select
                value={patient.gender}
                onChange={(e) => setPatient((p) => ({ ...p, gender: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
              <input
                type="date"
                value={patient.dob}
                max={today}
                onChange={(e) => setPatient((p) => ({ ...p, dob: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={patient.email}
                onChange={(e) => setPatient((p) => ({ ...p, email: e.target.value }))}
                placeholder="optional"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Blood Group</label>
              <select
                value={patient.bloodGroup}
                onChange={(e) => setPatient((p) => ({ ...p, bloodGroup: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select —</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Referred By</label>
              <input
                type="text"
                value={patient.referredBy}
                onChange={(e) => setPatient((p) => ({ ...p, referredBy: e.target.value }))}
                placeholder="Doctor / clinic name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <input
                type="text"
                value={patient.address}
                onChange={(e) => setPatient((p) => ({ ...p, address: e.target.value }))}
                placeholder="optional"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">If a patient with the same name and phone already exists, the existing record will be used.</p>
        </div>

        {/* Tests */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold mb-3">Individual Tests</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tests.map((t) => (
              <label key={t._id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedTests.includes(t._id) ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="checkbox" checked={selectedTests.includes(t._id)} onChange={() => toggleTest(t._id)} className="rounded accent-blue-600" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-xs text-gray-400">{t.category} · {t.sampleType}</div>
                </div>
                <span className="text-sm font-semibold text-blue-700 flex-shrink-0">₹{t.price}</span>
              </label>
            ))}
            {tests.length === 0 && <div className="col-span-2 text-sm text-gray-400">No active tests</div>}
          </div>
        </div>

        {/* Packages */}
        {packages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold mb-3">Packages</h2>
            <div className="space-y-2">
              {packages.map((p) => (
                <label key={p._id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedPackages.includes(p._id) ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={selectedPackages.includes(p._id)} onChange={() => togglePkg(p._id)} className="rounded accent-blue-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-sm font-semibold text-blue-700 ml-3 flex-shrink-0">₹{p.price}</span>
                    </div>
                    {p.description && <div className="text-xs text-gray-400 mt-0.5">{p.description}</div>}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.tests.map((t) => (
                        <span key={t._id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.name}</span>
                      ))}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold mb-3">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Discount %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={discountPercent}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-20 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-red-500">-₹{discountAmount}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-100">
              <span>Grand Total</span>
              <span className="text-blue-700">₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.back()} className="px-4 py-2.5 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400">
            {saving ? "Creating Order…" : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}><NewOrderForm /></Suspense>;
}
