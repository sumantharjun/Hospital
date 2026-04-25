"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import toast from "react-hot-toast";

interface AuditEntry {
  _id: string;
  userId: string;
  method: string;
  path: string;
  statusCode: number;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  async function load(p = 1) {
    try {
      const d = await apiGet<{ audits: AuditEntry[]; total: number }>(`/api/audits?page=${p}&limit=30`);
      setLogs(d.audits ?? []);
      setTotal(d.total ?? 0);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(page); }, [page]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Log</h1>

      {loading ? <div className="text-gray-400 text-center py-10">Loading…</div> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Time</th>
                <th className="text-left px-4 py-3 font-medium">Method</th>
                <th className="text-left px-4 py-3 font-medium">Path</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(l.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${l.method === "DELETE" ? "bg-red-100 text-red-600" : l.method === "POST" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{l.method}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{l.path}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${l.statusCode < 300 ? "bg-green-100 text-green-700" : l.statusCode < 500 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>{l.statusCode}</span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">No audit entries</td></tr>}
            </tbody>
          </table>
          {total > 30 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>Showing {((page - 1) * 30) + 1}–{Math.min(page * 30, total)} of {total}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">Prev</button>
                <button disabled={page * 30 >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
