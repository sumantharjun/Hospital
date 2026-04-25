"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import type { LabTest, LabPackage, LabPatient } from "@/lib/types";
import toast from "react-hot-toast";

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prePatientId = searchParams.get("patientId") ?? "";

  const [patients, setPatients] = useState<LabPatient[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [packages, setPackages] = useState<LabPackage[]>([]);
  const [patientId, setPatientId] = useState(prePatientId);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<{ patients: LabPatient[] }>("/api/lab/patients?limit=200"),
      apiGet<{ tests: LabTest[] }>("/api/lab/tests?activeOnly=true"),
      apiGet<{ packages: LabPackage[] }>("/api/lab/packages?activeOnly=true"),
    ]).then(([pd, td, pkd]) => {
      setPatients(pd.patients);
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
    if (!patientId) { toast.error("Please select a patient"); return; }
    if (selectedTests.length === 0 && selectedPackages.length === 0) { toast.error("Select at least one test or package"); return; }
    setSaving(true);
    try {
      const d = await apiPost<{ order: { _id: string } }>("/api/lab/orders", {
        patientId, testIds: selectedTests, packageIds: selectedPackages, discountPercent, notes,
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
        {/* Patient */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold mb-3">Select Patient</h2>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Choose patient —</option>
            {patients.map((p) => <option key={p._id} value={p._id}>{p.name} · {p.phone} · {p.labPatientId}</option>)}
          </select>
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
          </div>
        </div>

        {/* Packages */}
        {packages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold mb-3">Packages</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {packages.map((p) => (
                <label key={p._id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedPackages.includes(p._id) ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={selectedPackages.includes(p._id)} onChange={() => togglePkg(p._id)} className="rounded accent-blue-600" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.tests.length} tests</div>
                  </div>
                  <span className="text-sm font-semibold text-blue-700 flex-shrink-0">₹{p.price}</span>
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
              <input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-20 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
