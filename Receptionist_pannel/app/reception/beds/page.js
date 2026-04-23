"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl, getAuthHeaders } from "../../lib/api";
import { BedIcon, RefreshIcon, IPAdmissionIcon } from "../../components/ReceptionIcons";

const STATUS_CONFIG = {
  AVAILABLE:   { label: "Available",   bg: "bg-green-100 text-green-800 border-green-300",   dot: "bg-green-500",  card: "border-green-300 bg-green-50/50" },
  OCCUPIED:    { label: "Occupied",    bg: "bg-red-100 text-red-800 border-red-300",          dot: "bg-red-500",    card: "border-red-300 bg-red-50/50"    },
  CLEANING:    { label: "Cleaning",    bg: "bg-yellow-100 text-yellow-800 border-yellow-300", dot: "bg-yellow-500", card: "border-yellow-300 bg-yellow-50/50"},
  MAINTENANCE: { label: "Maintenance", bg: "bg-gray-200 text-gray-700 border-gray-300",       dot: "bg-gray-400",   card: "border-gray-300 bg-gray-50"     },
};

const FILTER_TABS = [
  { key: "ALL",         label: "All" },
  { key: "AVAILABLE",   label: "Available" },
  { key: "OCCUPIED",    label: "Occupied" },
  { key: "ICU",         label: "ICU" },
  { key: "GENERAL",     label: "General" },
  { key: "PRIVATE",     label: "Private" },
];

export default function BedAvailabilityPage() {
  const router = useRouter();
  const [beds, setBeds] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [fallbackStats, setFallbackStats] = useState(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const headers = getAuthHeaders();
      const [bedRes, roomRes] = await Promise.all([
        fetch(buildApiUrl("/api/infrastructure/beds"), { headers }),
        fetch(buildApiUrl("/api/infrastructure/rooms"), { headers }),
      ]);

      if (bedRes.ok) {
        const data = await bedRes.json();
        const bedList = Array.isArray(data) ? data : data.beds || [];
        setBeds(bedList);
      } else {
        // Try fallback
        const fallbackRes = await fetch(buildApiUrl("/api/reports/hospital/bed-occupancy"), { headers });
        if (fallbackRes.ok) {
          const fb = await fallbackRes.json();
          setFallbackStats(fb);
          setBeds([]);
        } else {
          toast.error("Could not load bed data");
        }
      }

      if (roomRes.ok) {
        const data = await roomRes.json();
        setRooms(Array.isArray(data) ? data : data.rooms || []);
      }
    } catch {
      if (!silent) toast.error("Failed to load bed data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Group beds by room
  function getRoomInfo(bed) {
    const roomId = bed.roomId?._id || bed.roomId || bed.room?._id || bed.room;
    return rooms.find((r) => (r._id || r.id) === roomId) || bed.roomId || {};
  }

  const roomTypeFilter = ["ICU", "GENERAL", "PRIVATE"].includes(filter) ? filter : null;

  const filteredBeds = beds.filter((bed) => {
    const status = (bed.status || "AVAILABLE").toUpperCase();
    const room = getRoomInfo(bed);
    const roomType = (room.roomType || room.type || "").toUpperCase();

    if (filter === "AVAILABLE" && status !== "AVAILABLE") return false;
    if (filter === "OCCUPIED" && status !== "OCCUPIED") return false;
    if (roomTypeFilter && !roomType.includes(roomTypeFilter)) return false;
    return true;
  });

  // Group by room
  const grouped = filteredBeds.reduce((acc, bed) => {
    const room = getRoomInfo(bed);
    const key =
      room.roomNumber ||
      room._id ||
      bed.roomId ||
      "Unassigned";
    if (!acc[key]) acc[key] = { room, beds: [] };
    acc[key].beds.push(bed);
    return acc;
  }, {});

  const stats = {
    total:       beds.length,
    available:   beds.filter((b) => (b.status || "").toUpperCase() === "AVAILABLE").length,
    occupied:    beds.filter((b) => (b.status || "").toUpperCase() === "OCCUPIED").length,
    cleaning:    beds.filter((b) => (b.status || "").toUpperCase() === "CLEANING").length,
    maintenance: beds.filter((b) => (b.status || "").toUpperCase() === "MAINTENANCE").length,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">
          Bed Availability
        </h1>
        <div className="text-center py-16 text-gray-400">Loading bed data...</div>
      </div>
    );
  }

  // Fallback summary view when no detailed bed data
  if (beds.length === 0 && fallbackStats) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">
              Bed Availability
            </h1>
            <p className="text-sm text-[#4a5568] mt-0.5">Summary view (detailed beds not available)</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 border border-[#cbd5e0] bg-white text-[#2d3748] px-3 py-2 text-sm rounded-sm hover:bg-[#e2e8f0] transition-colors disabled:opacity-50"
          >
            <RefreshIcon className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(fallbackStats).map(([k, v]) => (
            <div key={k} className="gov-card p-4">
              <div className="text-2xl font-bold text-[#1a202c]">{v}</div>
              <div className="text-xs text-[#718096] mt-0.5 capitalize">{k.replace(/_/g, " ")}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a202c] uppercase tracking-tight">
            Bed Availability
          </h1>
          <p className="text-sm text-[#4a5568] mt-0.5">
            Real-time bed status across all wards —{" "}
            {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 border border-[#cbd5e0] bg-white text-[#2d3748] px-3 py-2 text-sm rounded-sm hover:bg-[#e2e8f0] transition-colors disabled:opacity-50"
        >
          <RefreshIcon className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",       value: stats.total,       bg: "bg-white border border-[#e2e8f0]",     text: "text-[#1a202c]" },
          { label: "Available",   value: stats.available,   bg: "bg-green-50 border border-green-200",   text: "text-green-800" },
          { label: "Occupied",    value: stats.occupied,    bg: "bg-red-50 border border-red-200",        text: "text-red-800"   },
          { label: "Cleaning",    value: stats.cleaning,    bg: "bg-yellow-50 border border-yellow-200",  text: "text-yellow-800"},
          { label: "Maintenance", value: stats.maintenance, bg: "bg-gray-50 border border-gray-200",      text: "text-gray-600"  },
        ].map((s) => (
          <div key={s.label} className={`rounded-sm p-4 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
            <div className="text-xs text-[#718096] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-sm overflow-hidden border border-[#cbd5e0]">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                filter === t.key
                  ? "bg-[#0d47a1] text-white"
                  : "bg-white text-[#4a5568] hover:bg-[#f5f7fa]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bed grid by room */}
      {Object.keys(grouped).length === 0 ? (
        <div className="gov-card p-12 text-center">
          <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <BedIcon className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm text-[#718096]">No beds found for the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([roomKey, { room, beds: roomBeds }]) => (
            <div key={roomKey} className="gov-card overflow-hidden">
              {/* Room header */}
              <div className="px-4 py-3 bg-[#f5f7fa] border-b border-[#e2e8f0] flex items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-[#1a202c] text-sm">
                    Room {room.roomNumber || roomKey}
                  </span>
                  {(room.roomType || room.type) && (
                    <span className="ml-2 text-xs bg-[#e3f2fd] text-[#0d47a1] px-2 py-0.5 rounded-full font-medium">
                      {room.roomType || room.type}
                    </span>
                  )}
                  {room.floor != null && (
                    <span className="ml-2 text-xs text-[#718096]">Floor {room.floor}</span>
                  )}
                </div>
                <div className="text-xs text-[#718096]">
                  {roomBeds.filter((b) => (b.status || "").toUpperCase() === "AVAILABLE").length} available
                  / {roomBeds.length} beds
                </div>
              </div>

              {/* Beds grid */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {roomBeds.map((bed) => {
                  const status = (bed.status || "AVAILABLE").toUpperCase();
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.AVAILABLE;
                  const isAvailable = status === "AVAILABLE";
                  const patientName =
                    bed.currentPatient?.name ||
                    bed.patient?.name ||
                    bed.patientName ||
                    null;

                  return (
                    <div
                      key={bed._id || bed.id}
                      className={`rounded-sm border p-3 flex flex-col gap-2 ${cfg.card}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1a202c] text-sm">
                          {bed.bedNumber || bed.number || "—"}
                        </span>
                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium self-start ${cfg.bg}`}
                      >
                        {cfg.label}
                      </span>
                      {patientName && (
                        <div className="text-[11px] text-[#4a5568] truncate" title={patientName}>
                          {patientName}
                        </div>
                      )}
                      {isAvailable && (
                        <button
                          onClick={() =>
                            router.push(
                              `/reception/ip-registration?bedId=${bed._id || bed.id}`
                            )
                          }
                          className="mt-auto flex items-center justify-center gap-1 text-[10px] bg-[#0d47a1] text-white px-2 py-1.5 rounded-sm hover:bg-[#0a3d91] transition-colors font-medium"
                        >
                          <IPAdmissionIcon className="w-3 h-3" />
                          Admit
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[#718096] text-center">
        Auto-refreshes every 60 seconds.
      </p>
    </div>
  );
}
