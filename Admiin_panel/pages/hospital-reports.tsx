import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

type ReportType = "revenue" | "bed-occupancy" | "daily-op" | "daily-ip" | "pending-dues" | "discharge-summary" | "nurse-attendance" | "doctor-revenue";

const REPORT_TABS: { key: ReportType; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "doctor-revenue", label: "Doctor Revenue" },
  { key: "bed-occupancy", label: "Bed Occupancy" },
  { key: "daily-op", label: "Daily OP" },
  { key: "daily-ip", label: "Daily IP" },
  { key: "pending-dues", label: "Pending Dues" },
  { key: "discharge-summary", label: "Discharge Summary" },
  { key: "nurse-attendance", label: "Nurse Attendance" },
];

export default function HospitalReportsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [activeReport, setActiveReport] = useState<ReportType>("revenue");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.replace("/"); return; }
    setToken(t);
    fetch(`${API_BASE}/api/master/hospitals`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { const list = Array.isArray(d) ? d : []; setHospitals(list); if (list.length > 0) setSelectedHospital(list[0]._id); });
  }, [router]);

  const fetchReport = async () => {
    if (!token) return;
    setLoading(true);
    setReportData(null);
    try {
      const params = new URLSearchParams();
      if (selectedHospital) params.append("hospitalId", selectedHospital);
      if (activeReport === "daily-op" || activeReport === "daily-ip") {
        params.append("date", singleDate);
      } else {
        if (dateFrom) params.append("from", dateFrom);
        if (dateTo) params.append("to", dateTo);
      }
      const res = await fetch(`${API_BASE}/api/reports/hospital/${activeReport}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).message);
      setReportData(await res.json());
    } catch (err: any) { toast.error(err.message || "Failed to load report"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token && selectedHospital) fetchReport(); }, [activeReport, selectedHospital, token]);

  const fmtCurrency = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Hospital Reports</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)}>
            {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
          {(activeReport === "daily-op" || activeReport === "daily-ip") ? (
            <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={singleDate} onChange={e => setSingleDate(e.target.value)} />
          ) : (
            <>
              <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="From" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="To" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </>
          )}
          <button onClick={fetchReport} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Refresh</button>
        </div>

        {/* Report Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
          {REPORT_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveReport(t.key)}
              className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeReport === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Generating report...</div>
        ) : !reportData ? (
          <div className="text-center py-16 text-gray-300">Select filters and refresh to view report.</div>
        ) : activeReport === "revenue" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Billed", value: fmtCurrency(reportData.totalBilled), color: "text-blue-700" },
                { label: "Total Collected", value: fmtCurrency(reportData.totalCollected), color: "text-green-700" },
                { label: "Pending Dues", value: fmtCurrency(reportData.totalPending), color: "text-red-600" },
                { label: "Bills Count", value: reportData.billCount, color: "text-gray-700" },
              ].map(s => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-sm">Revenue by Type</h3>
                {Object.entries(reportData.byType || {}).map(([type, data]: any) => (
                  <div key={type} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                    <span className="font-medium">{type}</span>
                    <div className="text-right text-xs space-y-0.5">
                      <div>Billed: {fmtCurrency(data.billed)}</div>
                      <div className="text-green-600">Collected: {fmtCurrency(data.collected)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-sm">Collections by Mode</h3>
                {Object.entries(reportData.byMode || {}).map(([mode, amount]: any) => (
                  <div key={mode} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                    <span>{mode}</span>
                    <span className="font-medium">{fmtCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeReport === "bed-occupancy" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Total Beds", value: reportData.total, color: "bg-blue-50 text-blue-800" },
              { label: "Occupied", value: reportData.occupied, color: "bg-red-50 text-red-800" },
              { label: "Available", value: reportData.available, color: "bg-green-50 text-green-800" },
              { label: "Cleaning", value: reportData.cleaning, color: "bg-yellow-50 text-yellow-800" },
              { label: "Maintenance", value: reportData.maintenance, color: "bg-gray-100 text-gray-700" },
              { label: "Occupancy Rate", value: `${reportData.occupancyRate}%`, color: "bg-purple-50 text-purple-800" },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-6 text-center ${s.color}`}>
                <div className="text-3xl font-bold">{s.value}</div>
                <div className="text-sm mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        ) : activeReport === "pending-dues" ? (
          <div>
            <div className="flex gap-4 mb-4">
              <div className="bg-red-50 text-red-800 rounded-xl p-4 text-center flex-1">
                <div className="text-2xl font-bold">{fmtCurrency(reportData.total)}</div>
                <div className="text-xs mt-1">Total Outstanding</div>
              </div>
              <div className="bg-gray-50 text-gray-800 rounded-xl p-4 text-center flex-1">
                <div className="text-2xl font-bold">{reportData.count}</div>
                <div className="text-xs mt-1">Bills with Dues</div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium">Bill No.</th>
                    <th className="px-4 py-3 text-left font-medium">Patient</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Grand Total</th>
                    <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.bills?.map((b: any) => (
                    <tr key={b._id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{b.billNumber}</td>
                      <td className="px-4 py-3">{b.patientId?.name || b.patientName}</td>
                      <td className="px-4 py-3">{b.billType}</td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(b.grandTotal)}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{fmtCurrency(b.outstandingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeReport === "doctor-revenue" ? (
          <div>
            <div className="mb-4 text-sm text-gray-600">Doctors: <strong>{reportData.count}</strong></div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium">Doctor</th>
                    <th className="px-4 py-3 text-left font-medium">Specialization</th>
                    <th className="px-4 py-3 text-center font-medium">OP Visits</th>
                    <th className="px-4 py-3 text-center font-medium">IP Admissions</th>
                    <th className="px-4 py-3 text-right font-medium">OP Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">IP Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.doctors?.map((d: any, i: number) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">Dr. {d.doctor?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{d.doctor?.specialization || "—"}</td>
                      <td className="px-4 py-3 text-center">{d.opCount}</td>
                      <td className="px-4 py-3 text-center">{d.ipCount}</td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(d.opRevenue)}</td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(d.ipRevenue)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{fmtCurrency(d.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeReport === "nurse-attendance" ? (
          <div>
            <div className="mb-4 text-sm text-gray-600">Total shifts logged: <strong>{reportData.total}</strong></div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium">Nurse</th>
                    <th className="px-4 py-3 text-center font-medium">Day Shifts</th>
                    <th className="px-4 py-3 text-center font-medium">Night Shifts</th>
                    <th className="px-4 py-3 text-center font-medium">Total</th>
                    <th className="px-4 py-3 text-center font-medium">Emergencies</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.byNurse?.map((n: any, i: number) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{(n.nurse as any)?.name || "Unknown"}</td>
                      <td className="px-4 py-3 text-center">{n.dayShifts}</td>
                      <td className="px-4 py-3 text-center">{n.nightShifts}</td>
                      <td className="px-4 py-3 text-center font-bold">{n.total}</td>
                      <td className="px-4 py-3 text-center">{n.emergencies > 0 ? <span className="text-red-600 font-medium">{n.emergencies}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 text-sm text-gray-600">Count: <strong>{reportData.count}</strong></div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium">Patient</th>
                    <th className="px-4 py-3 text-left font-medium">Doctor</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    {activeReport === "daily-ip" && <th className="px-4 py-3 text-left font-medium">Emergency</th>}
                  </tr>
                </thead>
                <tbody>
                  {reportData.records?.map((r: any, i: number) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">{r.patientId?.name || "—"}</td>
                      <td className="px-4 py-3">{r.doctorId?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{r.registrationDate || r.admissionDate ? new Date(r.registrationDate || r.admissionDate).toLocaleDateString() : "—"}</td>
                      {activeReport === "daily-ip" && <td className="px-4 py-3">{(r.emergencyFlag || r.casualtyFlag) ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">YES</span> : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
