import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import Layout from "../components/Layout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const CERT_TYPES = ["MEDICAL_FITNESS", "ADMISSION", "DISCHARGE_SUMMARY"];

export default function CertificatesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [certs, setCerts] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ patientId: "", doctorId: "", type: "MEDICAL_FITNESS", referenceId: "", content: "", additionalNotes: "" });
  const [preview, setPreview] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.replace("/"); return; }
    setToken(t);
    Promise.all([
      fetch(`${API_BASE}/api/master/hospitals`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/users?role=DOCTOR`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/users?role=PATIENT`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.ok ? r.json() : []),
    ]).then(([h, d, p]) => {
      const hList = Array.isArray(h) ? h : [];
      setHospitals(hList);
      setDoctors(Array.isArray(d) ? d : []);
      setPatients(Array.isArray(p) ? p : []);
      if (hList.length > 0) setSelectedHospital(hList[0]._id);
    });
  }, [router]);

  useEffect(() => {
    if (!token || !selectedHospital) return;
    const params = new URLSearchParams({ hospitalId: selectedHospital });
    if (typeFilter) params.append("type", typeFilter);
    fetch(`${API_BASE}/api/certificates?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(d => setCerts(Array.isArray(d) ? d : []));
  }, [selectedHospital, token, typeFilter]);

  const saveCert = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const selectedPatient = patients.find(p => p._id === form.patientId);
      const selectedDoctor = doctors.find(d => d._id === form.doctorId);
      const res = await fetch(`${API_BASE}/api/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          hospitalId: selectedHospital,
          patientName: selectedPatient?.name || "",
          doctorName: selectedDoctor?.name || "",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const created = await res.json();
      setCerts(p => [created, ...p]);
      setShowModal(false);
      toast.success("Certificate generated");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openPreview = (cert: any) => setPreview(cert);

  const printCert = () => {
    if (!preview) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const hospital = hospitals.find(h => h._id === selectedHospital);
    win.document.write(`
      <html><head><title>Certificate</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px; }
        .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin: 8px 0; }
        .cert-no { font-size: 12px; color: #666; }
        .body { line-height: 1.8; }
        .signature { margin-top: 60px; text-align: right; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <div class="header">
          <div style="font-size:22px; font-weight:bold;">${hospital?.name || "Hospital"}</div>
          <div style="font-size:12px; color:#666;">${hospital?.address || ""} · ${hospital?.contactNumber || ""}</div>
          <div class="title">${preview.type.replace(/_/g, " ")}</div>
          <div class="cert-no">Certificate No: ${preview.certificateNumber} · Date: ${new Date(preview.issueDate).toLocaleDateString()}</div>
        </div>
        <div class="body">
          <p>This is to certify that <strong>${preview.patientId?.name || preview.patientName}</strong> was examined/treated by <strong>Dr. ${preview.doctorId?.name || preview.doctorName}</strong>.</p>
          ${preview.referenceId ? `<p>Reference: ${preview.referenceId}</p>` : ""}
          ${preview.content ? `<p>${preview.content}</p>` : ""}
          ${preview.additionalNotes ? `<p><strong>Notes:</strong> ${preview.additionalNotes}</p>` : ""}
        </div>
        <div class="signature">
          <div>___________________________</div>
          <div>Dr. ${preview.doctorId?.name || preview.doctorName}</div>
          <div>${preview.doctorId?.specialization || ""}</div>
        </div>
        <script>window.print();</script>
      </body></html>
    `);
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Medical Certificates</h1>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Generate Certificate</button>
        </div>

        <div className="flex gap-3 mb-4">
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)}>
            {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {CERT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-medium">Cert No.</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Patient</th>
                <th className="px-4 py-3 text-left font-medium">Doctor</th>
                <th className="px-4 py-3 text-left font-medium">Issue Date</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map(c => (
                <tr key={c._id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{c.certificateNumber}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{c.type.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-4 py-3">{c.patientId?.name || c.patientName}</td>
                  <td className="px-4 py-3">{c.doctorId?.name || c.doctorName}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(c.issueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => openPreview(c)} className="text-blue-600 hover:underline text-xs">Preview</button>
                  </td>
                </tr>
              ))}
              {certs.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No certificates generated.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Generate Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold mb-4">Generate Certificate</h2>
              <form onSubmit={saveCert} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Certificate Type *</label>
                  <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {CERT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Patient *</label>
                  <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.patientId} onChange={e => setForm(p => ({ ...p, patientId: e.target.value }))}>
                    <option value="">Select patient</option>
                    {patients.map(p => <option key={p._id} value={p._id}>{p.name} · {p.phone || p.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Doctor *</label>
                  <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.doctorId} onChange={e => setForm(p => ({ ...p, doctorId: e.target.value }))}>
                    <option value="">Select doctor</option>
                    {doctors.map(d => <option key={d._id} value={d._id}>Dr. {d.name} · {d.specialization}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Reference ID (IP/OP)</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder="e.g. IP-20250101-0001"
                    value={form.referenceId} onChange={e => setForm(p => ({ ...p, referenceId: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Certificate Content</label>
                  <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Additional Notes</label>
                  <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.additionalNotes} onChange={e => setForm(p => ({ ...p, additionalNotes: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">
                    {saving ? "Generating..." : "Generate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {preview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-8">
              <div className="text-center border-b border-gray-200 pb-4 mb-6">
                <div className="text-xl font-bold">{hospitals.find(h => h._id === selectedHospital)?.name || "Hospital"}</div>
                <div className="text-sm text-gray-500">{hospitals.find(h => h._id === selectedHospital)?.address}</div>
                <div className="text-lg font-semibold mt-2 uppercase">{preview.type.replace(/_/g, " ")}</div>
                <div className="text-xs text-gray-400">No: {preview.certificateNumber} · {new Date(preview.issueDate).toLocaleDateString()}</div>
              </div>
              <div className="text-sm leading-8 space-y-2">
                <p>This is to certify that <strong>{preview.patientId?.name || preview.patientName}</strong> was examined/treated by <strong>Dr. {preview.doctorId?.name || preview.doctorName}</strong> ({preview.doctorId?.specialization}).</p>
                {preview.referenceId && <p>Reference: <strong>{preview.referenceId}</strong></p>}
                {preview.content && <p>{preview.content}</p>}
                {preview.additionalNotes && <p><strong>Notes:</strong> {preview.additionalNotes}</p>}
              </div>
              <div className="text-right mt-12">
                <div className="border-t border-gray-400 inline-block px-8 pt-2">
                  <div className="text-sm font-medium">Dr. {preview.doctorId?.name || preview.doctorName}</div>
                  <div className="text-xs text-gray-500">{preview.doctorId?.specialization}</div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setPreview(null)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Close</button>
                <button onClick={printCert} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Print</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
