import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { FinanceIcon, RevenueIcon, ExpenseIcon, ProfitIcon, ChartBarIcon, DownloadIcon, CalendarIcon, HospitalIcon, ClockIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

// Simple Line Chart Component
const LineChart = ({ data, width = 400, height = 200, color = "#1e40af" }: any) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map((d: any) => Math.max(d.revenue || 0, d.expenses || 0)));
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  const points = data.map((d: any, i: number) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - (d.revenue / maxValue) * chartHeight;
    return { x, y, ...d };
  });
  
  const pathData = points.map((p: any, i: number) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');
  
  return (
    <svg width={width} height={height} className="w-full">
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathData} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`}
        fill="url(#lineGradient)"
      />
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {points.map((p: any, i: number) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} />
      ))}
    </svg>
  );
};

// Simple Bar Chart Component
const BarChart = ({ data, width = 400, height = 200, color = "#1e40af" }: any) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map((d: any) => d.value || 0));
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = chartWidth / data.length - 10;
  
  return (
    <svg width={width} height={height} className="w-full">
      {data.map((d: any, i: number) => {
        const barHeight = (d.value / maxValue) * chartHeight;
        const x = padding + i * (chartWidth / data.length);
        const y = padding + chartHeight - barHeight;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={color}
              rx="4"
            />
            <text
              x={x + barWidth / 2}
              y={height - padding + 15}
              textAnchor="middle"
              className="text-xs fill-gray-600"
              fontSize="10"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Recharts Pie Chart Component
const FinancePieChart = ({ data }: { data: Array<{ label: string; value: number }> }) => {
  if (!data || data.length === 0) return null;
  
  const colors = ["#1e40af", "#059669", "#dc2626", "#7c3aed", "#ea580c", "#0891b2", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
  
  const total = data.reduce((sum: number, d: any) => sum + d.value, 0);
  
  // Custom label formatter
  const renderLabel = (entry: any) => {
    const percentage = ((entry.value / total) * 100).toFixed(1);
    return `${percentage}%`;
  };
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            Amount: <span className="font-semibold text-blue-900">₹{data.value.toLocaleString()}</span>
          </p>
          <p className="text-xs text-gray-500">Percentage: {percentage}%</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={120}
          innerRadius={60}
          fill="#8884d8"
          dataKey="value"
          nameKey="label"
          animationBegin={0}
          animationDuration={800}
        >
          {data.map((entry: any, index: number) => (
            <Cell 
              key={`cell-${index}`} 
              fill={colors[index % colors.length]}
              stroke="#fff"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          formatter={(value: string) => value}
          wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default function FinancePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !t) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(storedUser));
    setToken(t);
    
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  }, [router]);

  const [reportType, setReportType] = useState<"summary" | "hospital" | "unit" | "time">("summary");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("MONTHLY");
  const [hospitals, setHospitals] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const headers = { Authorization: `Bearer ${token}` };
        const params = new URLSearchParams();
        if (dateFrom) params.append('from', dateFrom);
        if (dateTo) params.append('to', dateTo);
        
        const [hRes, summaryRes] = await Promise.all([
          fetch(`${API_BASE}/api/master/hospitals`, { headers }),
          fetch(`${API_BASE}/api/finance/summary?${params.toString()}`, { headers }),
        ]);
        setHospitals(hRes.ok ? await hRes.json() : []);
        setSummary(summaryRes.ok ? await summaryRes.json() : { total: 0, count: 0, entries: [] });
      } catch (e) {
        console.error(e);
        toast.error("Failed to fetch finance data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, dateFrom, dateTo]);

  const fetchReport = async (type: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = new URLSearchParams();
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      
      let url = "";
      if (type === "hospital" && selectedHospital) {
        url = `${API_BASE}/api/finance/reports/hospital/${selectedHospital}?${params.toString()}`;
      } else if (type === "time") {
        params.append('period', selectedPeriod);
        url = `${API_BASE}/api/finance/reports/time?${params.toString()}`;
      } else {
        url = `${API_BASE}/api/finance/summary?${params.toString()}`;
      }
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (type === "time") {
        setSummary({ entries: [], ...data });
      } else {
        setSummary(data);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const entries = summary?.entries ?? [];
  const revenue = entries
    .filter((e: any) => e.type?.includes("REVENUE") || e.amount > 0)
    .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const expenses = entries
    .filter((e: any) => e.type?.includes("EXPENSE") || e.amount < 0)
    .reduce((sum: number, e: any) => sum + Math.abs(e.amount || 0), 0);
  const profit = revenue - expenses;

  // Prepare chart data
  const timeSeriesData = summary?.summary?.map((s: any) => ({
    period: s.period,
    revenue: s.revenue || 0,
    expenses: s.expenses || 0,
  })) || [];

  // Category breakdown
  const categoryData = entries.reduce((acc: any, e: any) => {
    const type = e.type || "OTHER";
    if (!acc[type]) acc[type] = 0;
    acc[type] += Math.abs(e.amount || 0);
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryData)
    .map(([label, value]: [string, any]) => ({ label: label.replace(/_/g, ' '), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Export to CSV
  const exportToCSV = () => {
    const csv = [
      ["Type", "Amount", "Hospital", "Pharmacy", "Date"].join(","),
      ...entries.map((e: any) => [
        e.type || "",
        e.amount || 0,
        e.hospitalId?.slice(-8) || "",
        e.pharmacyId?.slice(-8) || "",
        e.occurredAt ? new Date(e.occurredAt).toLocaleString() : "",
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="finance">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
                Finance Overview
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Comprehensive financial analytics and reporting
              </p>
            </div>
            <motion.button
              onClick={exportToCSV}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold transition-all flex items-center gap-2"
            >
              <DownloadIcon className="w-4 h-4" />
              <span>Export CSV</span>
            </motion.button>
          </div>

          {/* Date Range Picker */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex items-center gap-2 flex-1">
              <CalendarIcon className="w-4 h-4 text-gray-600" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              />
              <span className="text-gray-600">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              />
            </div>
          </div>

          {/* Report Type Selector */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as any);
                fetchReport(e.target.value);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
            >
              <option value="summary">Summary</option>
              <option value="hospital">Hospital-wise</option>
              <option value="time">Time-wise</option>
            </select>
            {reportType === "hospital" && (
              <select
                value={selectedHospital}
                onChange={(e) => {
                  setSelectedHospital(e.target.value);
                  if (e.target.value) fetchReport("hospital");
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              >
                <option value="">Select Hospital</option>
                {hospitals.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}
            {reportType === "time" && (
              <select
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                  fetchReport("time");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              >
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            )}
          </div>
        </div>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-blue-900 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <AnimatedCard delay={0.1}>
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <FinanceIcon className="w-6 h-6 text-blue-900" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">₹{(summary?.total || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{summary?.count || 0} entries</p>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.2}>
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-green-50 rounded-lg border border-green-200">
                    <RevenueIcon className="w-6 h-6 text-green-700" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Revenue</p>
                <p className="text-2xl font-bold text-green-700">₹{revenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Total income</p>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.3}>
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-red-50 rounded-lg border border-red-200">
                    <ExpenseIcon className="w-6 h-6 text-red-700" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Expenses</p>
                <p className="text-2xl font-bold text-red-700">₹{expenses.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Total costs</p>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.4}>
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
                    <ProfitIcon className="w-6 h-6 text-purple-700" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Net Profit</p>
                <p className={`text-2xl font-bold ${profit >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                  ₹{profit.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">Revenue - Expenses</p>
              </div>
            </AnimatedCard>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Time Series Chart */}
            {reportType === "time" && timeSeriesData.length > 0 && (
              <AnimatedCard delay={0.5}>
                <div className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ChartBarIcon className="w-5 h-5 text-blue-900" />
                    <h3 className="text-lg font-bold text-gray-900">Revenue & Expenses Trend</h3>
                  </div>
                  <div className="h-64">
                    <LineChart data={timeSeriesData} width={600} height={256} color="#1e40af" />
                  </div>
                  <div className="flex gap-4 mt-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-900 rounded"></div>
                      <span className="text-gray-600">Revenue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-600 rounded"></div>
                      <span className="text-gray-600">Expenses</span>
                    </div>
                  </div>
                </div>
              </AnimatedCard>
            )}

            {/* Category Breakdown Pie Chart */}
            {categoryChartData.length > 0 && (
              <AnimatedCard delay={0.6}>
                <div className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ChartBarIcon className="w-5 h-5 text-blue-900" />
                    <h3 className="text-lg font-bold text-gray-900">Category Breakdown</h3>
                  </div>
                  <div className="w-full">
                    <FinancePieChart data={categoryChartData} />
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-gray-200">
                    {categoryChartData.map((item: any, idx: number) => {
                      const colors = ["#1e40af", "#059669", "#dc2626", "#7c3aed", "#ea580c", "#0891b2", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
                      const total = categoryChartData.reduce((sum: number, d: any) => sum + d.value, 0);
                      const percentage = ((item.value / total) * 100).toFixed(1);
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                            <span className="text-sm font-medium text-gray-700">{item.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">₹{item.value.toLocaleString()}</span>
                            <span className="text-xs text-gray-500 ml-2">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </AnimatedCard>
            )}

            {/* Bar Chart for Time Periods */}
            {reportType === "time" && timeSeriesData.length > 0 && (
              <AnimatedCard delay={0.7}>
                <div className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ChartBarIcon className="w-5 h-5 text-blue-900" />
                    <h3 className="text-lg font-bold text-gray-900">Revenue by Period</h3>
                  </div>
                  <div className="h-64">
                    <BarChart 
                      data={timeSeriesData.map((d: any) => ({ label: d.period, value: d.revenue }))} 
                      width={600} 
                      height={256} 
                      color="#1e40af" 
                    />
                  </div>
                </div>
              </AnimatedCard>
            )}
          </div>

          {/* Recent Entries */}
          <AnimatedCard delay={0.8}>
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
                <span className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-md border border-blue-200">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              <div className="max-h-[600px] overflow-y-auto space-y-3">
                {entries.map((e: any, idx: number) => {
                  const isPositive = e.amount > 0;
                  return (
                    <motion.div
                      key={e._id || idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border border-gray-300 rounded-lg p-4 bg-white hover:border-blue-900 hover:shadow-md transition-all"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                            <p className="font-semibold text-sm text-gray-900 break-words">{e.type || "Transaction"}</p>
                            <span className={`text-xs px-2 py-1 rounded-md font-medium w-fit ${
                              isPositive
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}>
                              {isPositive ? "Income" : "Expense"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                            {e.hospitalId && (
                              <span className="flex items-center gap-1">
                                <HospitalIcon className="w-3 h-3" />
                                {e.hospitalId.slice(-8)}
                              </span>
                            )}
                            {e.occurredAt && (
                              <span className="flex items-center gap-1">
                                <ClockIcon className="w-3 h-3" />
                                {new Date(e.occurredAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right sm:ml-4 flex-shrink-0 w-full sm:w-auto">
                          <p className={`text-lg font-bold ${isPositive ? "text-green-700" : "text-red-700"}`}>
                            {isPositive ? "+" : "-"}₹{Math.abs(e.amount || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {entries.length === 0 && (
                  <div className="text-center py-12">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                        <FinanceIcon className="w-10 h-10 text-blue-900" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 font-medium mb-2">
                      No finance entries yet
                    </p>
                    <p className="text-xs text-gray-600">
                      Transactions will appear here as they occur
                    </p>
                  </div>
                )}
              </div>
            </div>
          </AnimatedCard>
        </>
      )}
    </Layout>
  );
}
