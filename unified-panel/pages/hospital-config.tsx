import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const SERVICE_CATEGORIES = ["LAB", "SCAN", "PROCEDURE", "CONSULTATION", "OTHER"];

export default function HospitalConfigPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [config, setConfig] = useState<any>({
    registrationFee: 0, generalBedRentPerDay: 0, semiPrivateRentPerDay: 0,
    privateRentPerDay: 0, icuRentPerDay: 0, emergencyCharges: 0,
    defaultConsultationFee: 0, taxPercent: 0, discountMaxPercent: 10,
    letterheadTitle: "", letterheadAddress: "", letterheadPhone: "",
  });
  const [services, setServices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"config" | "services">("config");
  const [saving, setSaving] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editService, setEditService] = useState<any>(null);
  const [serviceForm, setServiceForm] = useState({ name: "", category: "LAB", description: "", fee: 0, taxPercent: 0 });
  const [savingService, setSavingService] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.replace("/"); return; }
    setToken(t);
    fetch(`${API_BASE}/api/master/hospitals`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => {
        const list = Array.isArray(d) ? d : [];
        setHospitals(list);
        if (list.length > 0) setSelectedHospital(list[0]._id);
      });
  }, [router]);

  useEffect(() => {
    if (!token || !selectedHospital) return;
    fetch(`${API_BASE}/api/hospital-services/config/${selectedHospital}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : {}).then(setConfig);
    fetch(`${API_BASE}/api/hospital-services/services?hospitalId=${selectedHospital}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(d => setServices(Array.isArray(d) ? d : []));
  }, [selectedHospital, token]);

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/hospital-services/config/${selectedHospital}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Configuration saved");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openAddService = () => {
    setEditService(null);
    setServiceForm({ name: "", category: "LAB", description: "", fee: 0, taxPercent: 0 });
    setShowServiceModal(true);
  };

  const openEditService = (s: any) => {
    setEditService(s);
    setServiceForm({ name: s.name, category: s.category, description: s.description || "", fee: s.fee, taxPercent: s.taxPercent });
    setShowServiceModal(true);
  };

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingService(true);
    try {
      const url = editService ? `${API_BASE}/api/hospital-services/services/${editService._id}` : `${API_BASE}/api/hospital-services/services`;
      const method = editService ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...serviceForm, hospitalId: selectedHospital }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success(editService ? "Service updated" : "Service added");
      setShowServiceModal(false);
      const r = await fetch(`${API_BASE}/api/hospital-services/services?hospitalId=${selectedHospital}`, { headers: { Authorization: `Bearer ${token}` } });
      setServices(r.ok ? await r.json() : []);
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingService(false); }
  };

  const deleteService = async (id: string) => {
    if (!confirm("Deactivate this service?")) return;
    await fetch(`${API_BASE}/api/hospital-services/services/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("Service removed");
    setServices(s => s.filter(x => x._id !== id));
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Hospital Configuration</h1>

        <div className="mb-4">
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)}>
            {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
        </div>

        <div className="flex gap-2 mb-4 border-b border-gray-200">
          {(["config", "services"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
              {tab === "config" ? "Financial Config" : "Services Catalog"}
            </button>
          ))}
        </div>

        {activeTab === "config" ? (
          <form onSubmit={saveConfig}>
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
              <section>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Charges & Fees</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    ["Registration Fee (₹)", "registrationFee"],
                    ["General Bed Rent/Day (₹)", "generalBedRentPerDay"],
                    ["Semi-Private Rent/Day (₹)", "semiPrivateRentPerDay"],
                    ["Private Rent/Day (₹)", "privateRentPerDay"],
                    ["ICU Rent/Day (₹)", "icuRentPerDay"],
                    ["Emergency Charges (₹)", "emergencyCharges"],
                    ["Default Consultation Fee (₹)", "defaultConsultationFee"],
                  ].map(([label, key]) => (
                    <div key={key as string}>
                      <label className="text-xs text-gray-600 font-medium">{label}</label>
                      <input type="number" min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                        value={config[key as string] || 0} onChange={e => setConfig((p: any) => ({ ...p, [key as string]: Number(e.target.value) }))} />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Tax & Discount</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600 font-medium">Default Tax (%)</label>
                    <input type="number" min={0} max={100} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={config.taxPercent || 0} onChange={e => setConfig((p: any) => ({ ...p, taxPercent: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium">Max Discount Allowed (%)</label>
                    <input type="number" min={0} max={100} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={config.discountMaxPercent || 10} onChange={e => setConfig((p: any) => ({ ...p, discountMaxPercent: Number(e.target.value) }))} />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Letterhead / Print Settings</h2>
                <div className="space-y-3">
                  {[
                    ["Hospital Title (for bills)", "letterheadTitle"],
                    ["Address (for bills)", "letterheadAddress"],
                    ["Phone (for bills)", "letterheadPhone"],
                    ["Logo URL", "letterheadLogoUrl"],
                  ].map(([label, key]) => (
                    <div key={key as string}>
                      <label className="text-xs text-gray-600 font-medium">{label}</label>
                      <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                        value={config[key as string] || ""} onChange={e => setConfig((p: any) => ({ ...p, [key as string]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </section>

              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium text-sm disabled:opacity-50">
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-600">{services.length} service{services.length !== 1 ? "s" : ""} configured</span>
              <button onClick={openAddService} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Service</button>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Fee (₹)</th>
                    <th className="px-4 py-3 font-medium">Tax (%)</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => (
                    <tr key={s._id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${s.category === "LAB" ? "bg-purple-100 text-purple-700" : s.category === "SCAN" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{s.category}</span>
                      </td>
                      <td className="px-4 py-3">₹{s.fee}</td>
                      <td className="px-4 py-3">{s.taxPercent}%</td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => openEditService(s)} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => deleteService(s._id)} className="text-red-500 hover:underline">Remove</button>
                      </td>
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No services added yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showServiceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold mb-4">{editService ? "Edit Service" : "Add Service"}</h2>
              <form onSubmit={saveService} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Service Name *</label>
                  <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={serviceForm.name} onChange={e => setServiceForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Category *</label>
                  <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={serviceForm.category} onChange={e => setServiceForm(p => ({ ...p, category: e.target.value }))}>
                    {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Fee (₹) *</label>
                    <input required type="number" min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={serviceForm.fee} onChange={e => setServiceForm(p => ({ ...p, fee: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Tax (%)</label>
                    <input type="number" min={0} max={100} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={serviceForm.taxPercent} onChange={e => setServiceForm(p => ({ ...p, taxPercent: Number(e.target.value) }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Description</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    value={serviceForm.description} onChange={e => setServiceForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowServiceModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
                  <button type="submit" disabled={savingService} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                    {savingService ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
