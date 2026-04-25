"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import toast from "react-hot-toast";

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
}

interface StatusBreakdown {
  _id: string;
  count: number;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  COLLECTED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [breakdown, setBreakdown] = useState<StatusBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ stats: Stats; statusBreakdown: StatusBreakdown[] }>("/api/lab/reports/analytics")
      .then((data) => { setStats(data.stats); setBreakdown(data.statusBreakdown); })
      .catch((err: any) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;

  const cards = [
    { label: "Total Orders", value: stats?.totalOrders ?? 0, color: "text-blue-600" },
    { label: "Total Revenue", value: `₹${(stats?.totalRevenue ?? 0).toLocaleString("en-IN")}`, color: "text-green-600" },
    { label: "Avg Order Value", value: `₹${Math.round(stats?.avgOrderValue ?? 0).toLocaleString("en-IN")}`, color: "text-purple-600" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm text-gray-500 mb-1">{c.label}</div>
            <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">Orders by Status</h2>
        {breakdown.length === 0 ? (
          <p className="text-gray-400 text-sm">No data yet</p>
        ) : (
          <div className="space-y-3">
            {breakdown.map((b) => (
              <div key={b._id} className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[b._id] ?? "bg-gray-100 text-gray-700"}`}>{b._id}</span>
                <span className="font-semibold text-gray-700">{b.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
