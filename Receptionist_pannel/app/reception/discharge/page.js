"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";

export default function DischargePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ipIdParam = searchParams.get("ipId");

  const [searchIpId, setSearchIpId] = useState(ipIdParam || "");
  const [admission, setAdmission] = useState(null);
  const [discharge, setDischarge] = useState(null);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [step, setStep] = useState("search"); // search | form | review | done

  const [form, setForm] = useState({
    dischargeType: "NORMAL",
    diagnosisSummary: "",
    treatmentSummary: "",
    medicationsOnDischarge: "",
    followUpInstructions: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/"); return; }
    if (ipIdParam) fetchAdmission(ipIdParam);
  }, [ipIdParam]);

  const fetchAdmission = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(`/api/ip-admissions/by-ip-id/${id}`), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("IP not found");
      const data = await res.json();
      setAdmission(data.admission);
      setBill(data.bill);

      // Check if discharge already initiated
      const dRes = await fetch(buildApiUrl(`/api/discharges/by-ip/${id}`), { headers: getAuthHeaders() });
      if (dRes.ok) {
        const dData = await dRes.json();
        if (dData) { setDischarge(dData); setStep("review"); }
        else setStep("form");
      } else setStep("form");
    } catch (err) {
      toast.error(err.message || "IP not found");
      setStep("search");
    } finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchIpId) { router.push(`/reception/discharge?ipId=${searchIpId}`); fetchAdmission(searchIpId); }
  };

  const initiateDischarge = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(buildApiUrl("/api/discharges"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          ipId: admission.ipId,
          hospitalId: admission.roomId?.hospitalId || bill?.hospitalId,
          patientId: admission.patientId?._id || admission.patientId,
          doctorId: admission.doctorId?._id || admission.doctorId,
          admissionDate: admission.admissionDate,
          ...form,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      setDischarge(data);
      setStep("review");
      toast.success("Discharge initiated. Awaiting doctor approval.");
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const completeDischarge = async () => {
    if (!discharge) return;
    if (discharge.doctorApprovalStatus !== "APPROVED") {
      toast.error("Doctor must approve discharge first");
      return;
    }
    setCompleting(true);
    try {
      const res = await fetch(buildApiUrl(`/api/discharges/${discharge._id}/complete`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      setDischarge(data.discharge);
      setStep("done");
      toast.success("Discharge completed! Bed is now available.");
    } catch (err) { toast.error(err.message); }
    finally { setCompleting(false); }
  };

  const admissionDate = admission?.admissionDate ? new Date(admission.admissionDate) : null;
  const today = new Date();
  const totalDays = admissionDate ? Math.max(1, Math.ceil((today.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const estimatedRoomRent = totalDays * (admission?.roomRentPerDay || 0);

  const printDischargeSummary = () => {
    if (!admission || !discharge) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const d = discharge;
    const a = admission;
    win.document.write(`<!DOCTYPE html><html><head><title>Discharge Summary</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#333}
        h1{text-align:center;font-size:22px;margin-bottom:4px}
        .sub{text-align:center;font-size:13px;color:#666;margin-bottom:20px}
        hr{margin:16px 0;border:none;border-top:1px solid #ddd}
        .section h3{font-size:12px;font-weight:bold;color:#444;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
        .row{display:flex;gap:8px;margin-bottom:4px;font-size:13px}
        .lbl{color:#666;min-width:180px}.val{font-weight:500}
        @media print{button{display:none}}
      </style></head><body>
      <h1>Discharge Summary</h1>
      <div class="sub">In-Patient Discharge Record</div>
      <hr>
      <div class="section">
        <h3>Patient Information</h3>
        <div class="row"><span class="lbl">IP ID:</span><span class="val">${a.ipId}</span></div>
        <div class="row"><span class="lbl">Patient Name:</span><span class="val">${a.patientId?.name || "—"}</span></div>
        <div class="row"><span class="lbl">Contact:</span><span class="val">${a.patientId?.phone || a.patientId?.email || "—"}</span></div>
        <div class="row"><span class="lbl">Room / Bed:</span><span class="val">${a.roomId?.roomNumber || "—"} / Bed ${a.bedId?.bedNumber || "—"}</span></div>
        <div class="row"><span class="lbl">Admission Date:</span><span class="val">${a.admissionDate ? new Date(a.admissionDate).toLocaleDateString() : "—"}</span></div>
        <div class="row"><span class="lbl">Discharge Date:</span><span class="val">${new Date().toLocaleDateString()}</span></div>
        <div class="row"><span class="lbl">Total Stay:</span><span class="val">${totalDays} day(s)</span></div>
      </div>
      <hr>
      <div class="section">
        <h3>Discharge Details</h3>
        <div class="row"><span class="lbl">Discharge Type:</span><span class="val">${d.dischargeType || "NORMAL"}</span></div>
        <div class="row"><span class="lbl">Doctor Approval:</span><span class="val">${d.doctorApprovalStatus}</span></div>
      </div>
      <hr>
      <div class="section">
        <h3>Clinical Summary</h3>
        <div class="row"><span class="lbl">Diagnosis:</span><span class="val">${d.diagnosisSummary || "—"}</span></div>
        <div class="row"><span class="lbl">Treatment:</span><span class="val">${d.treatmentSummary || "—"}</span></div>
        <div class="row"><span class="lbl">Medications on Discharge:</span><span class="val">${d.medicationsOnDischarge || "—"}</span></div>
        <div class="row"><span class="lbl">Follow-up Instructions:</span><span class="val">${d.followUpInstructions || "—"}</span></div>
      </div>
      <hr>
      <div class="section">
        <h3>Financial Summary</h3>
        <div class="row"><span class="lbl">Room Rent (${totalDays}d × ₹${a.roomRentPerDay}):</span><span class="val">₹${estimatedRoomRent}</span></div>
        ${bill ? `<div class="row"><span class="lbl">Total Bill:</span><span class="val">₹${bill.grandTotal || 0}</span></div>
        <div class="row"><span class="lbl">Paid:</span><span class="val">₹${bill.paidAmount || 0}</span></div>
        <div class="row"><span class="lbl">Outstanding:</span><span class="val">₹${bill.outstandingBalance || 0}</span></div>` : ""}
      </div>
      <hr>
      <p style="font-size:11px;color:#999;text-align:center;margin-top:30px">Generated on ${new Date().toLocaleString()} — Hospital Management System</p>
      <script>window.print();</script>
      </body></html>`);
  };

  if (step === "done") {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🏥</div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Discharge Completed!</h2>
          <p className="text-sm text-green-600 mb-2">Patient {admission?.patientId?.name} has been discharged.</p>
          <p className="text-sm text-gray-600 mb-6">Bed {admission?.bedId?.bedNumber} is now set to Cleaning status.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => router.push(`/reception/ip-billing?ipId=${admission?.ipId}`)}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium">View Final Bill</button>
            {discharge && (
              <button onClick={printDischargeSummary}
                className="bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-medium">Print Discharge Summary</button>
            )}
            <button onClick={() => router.push("/reception/dashboard")}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg text-sm font-medium">Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">←</button>
        <h1 className="text-xl font-bold text-gray-900">Discharge Management</h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input type="text" placeholder="Enter IP ID..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={searchIpId} onChange={e => setSearchIpId(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Search</button>
      </form>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !admission ? (
        <div className="text-center py-12 text-gray-300">Enter an IP ID to start discharge process.</div>
      ) : (
        <div className="space-y-4">
          {/* Admission Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm text-gray-800">Admission Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["IP ID", admission.ipId],
                ["Patient", admission.patientId?.name || "—"],
                ["Phone", admission.patientId?.phone || "—"],
                ["Doctor", `Dr. ${admission.doctorId?.name || "—"}`],
                ["Room", admission.roomId?.roomNumber || "—"],
                ["Bed", admission.bedId?.bedNumber || "—"],
                ["Admitted", admissionDate?.toLocaleDateString() || "—"],
                ["Days (est.)", `${totalDays} days`],
                ["Room Rent (est.)", `₹${estimatedRoomRent}`],
                ["Current Status", admission.status],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-gray-50 py-1">
                  <span className="text-gray-500 text-xs">{k}</span>
                  <span className="font-medium text-xs">{v}</span>
                </div>
              ))}
            </div>
            {bill && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-500">Current Outstanding</span>
                <span className="font-bold text-red-600">₹{bill.outstandingBalance}</span>
              </div>
            )}
          </div>

          {/* Discharge Form */}
          {step === "form" && (
            <form onSubmit={initiateDischarge}>
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-sm text-gray-800">Discharge Details</h3>
                <div>
                  <label className="text-xs font-medium text-gray-600">Discharge Type</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.dischargeType} onChange={e => setForm(p => ({ ...p, dischargeType: e.target.value }))}>
                    <option value="NORMAL">Normal Discharge</option>
                    <option value="AGAINST_MEDICAL_ADVICE">Against Medical Advice</option>
                    <option value="REFERRED">Referred to Another Hospital</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Diagnosis Summary</label>
                  <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.diagnosisSummary} onChange={e => setForm(p => ({ ...p, diagnosisSummary: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Treatment Summary</label>
                  <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.treatmentSummary} onChange={e => setForm(p => ({ ...p, treatmentSummary: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Medications on Discharge</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.medicationsOnDischarge} onChange={e => setForm(p => ({ ...p, medicationsOnDischarge: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Follow-up Instructions</label>
                  <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.followUpInstructions} onChange={e => setForm(p => ({ ...p, followUpInstructions: e.target.value }))} />
                </div>
                <button type="submit" disabled={submitting} className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50">
                  {submitting ? "Initiating..." : "Initiate Discharge (Send for Doctor Approval)"}
                </button>
              </div>
            </form>
          )}

          {/* Discharge Status */}
          {step === "review" && discharge && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-800">Discharge Status</h3>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${discharge.doctorApprovalStatus === "APPROVED" ? "bg-green-500" : "bg-yellow-500"}`}>
                  {discharge.doctorApprovalStatus === "APPROVED" ? "✓" : "⏳"}
                </div>
                <div>
                  <div className="font-medium text-sm">Doctor Approval: {discharge.doctorApprovalStatus}</div>
                  <div className="text-xs text-gray-500">
                    {discharge.doctorApprovalStatus === "APPROVED" ? `Approved at ${new Date(discharge.doctorApprovedAt).toLocaleString()}` : "Waiting for doctor to approve"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${bill?.isFrozen ? "bg-green-500" : "bg-gray-300"}`}>
                  {bill?.isFrozen ? "✓" : "⏳"}
                </div>
                <div>
                  <div className="font-medium text-sm">Bill Freeze: {bill?.isFrozen ? "FROZEN" : "NOT FROZEN"}</div>
                  <div className="text-xs text-gray-500">Bill is auto-frozen when discharge is completed</div>
                </div>
              </div>

              {discharge.doctorApprovalStatus === "APPROVED" && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <div className="font-medium text-blue-800 mb-1">Room Rent Summary</div>
                  <div className="text-blue-600">{totalDays} days × ₹{admission.roomRentPerDay}/day = ₹{estimatedRoomRent}</div>
                  <div className="text-xs text-blue-500 mt-1">Room rent will be added to final bill on completion.</div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={completeDischarge} disabled={completing || discharge.doctorApprovalStatus !== "APPROVED"}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50">
                  {completing ? "Completing..." : discharge.doctorApprovalStatus === "APPROVED" ? "Complete Discharge & Free Bed" : "Waiting for Doctor Approval..."}
                </button>
                <button onClick={printDischargeSummary}
                  className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium">Print</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
