"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { LabPatient } from "@/lib/types";
import toast from "react-hot-toast";

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<LabPatient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewPatient, setViewPatient] = useState<LabPatient | null>(null);

  async function load(p = 1, q = "") {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (q) params.set("search", q);
      const d = await apiGet<{ patients: LabPatient[]; total: number }>(`/api/lab/patients?${params}`);
      setPatients(d.patients);
      setTotal(d.total);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(page, search); }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, search);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Search</button>
      </form>

      {loading ? <div className="text-center py-10 text-gray-400">Loading…</div> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Patient ID</th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Age / Gender</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Referred By</th>
                <th className="text-right px-4 py-3 font-medium">Reg. Charge</th>
                <th className="text-center px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patients.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewPatient(p)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.labPatientId}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.age} / {p.gender}</td>
                  <td className="px-4 py-3 text-gray-500">{p.phone}</td>
                  <td className="px-4 py-3 text-gray-400">{p.referredBy ?? "—"}</td>
                  <td className="px-4 py-3 text-right">₹{p.registrationCharge}</td>
                  <td className="px-4 py-3 text-center space-x-3">
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/operator/orders/new?patientId=${p._id}`); }} className="text-xs text-blue-600 hover:underline">New Order</button>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No patients found</td></tr>}
            </tbody>
          </table>
          {total > 20 && (
            <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
              <span>{total} total patients</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">Prev</button>
                <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Patient Modal */}
      {viewPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Patient Details</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Patient ID</span>
                <span className="font-mono text-xs">{viewPatient.labPatientId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="font-medium">{viewPatient.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Age / Gender</span>
                <span>{viewPatient.age} / {viewPatient.gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span>{viewPatient.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span>{viewPatient.email ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Blood Group</span>
                <span>{viewPatient.bloodGroup ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Referred By</span>
                <span>{viewPatient.referredBy ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Registration Charge</span>
                <span>₹{viewPatient.registrationCharge}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Registered At</span>
                <span className="text-xs">{new Date(viewPatient.createdAt).toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setViewPatient(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
