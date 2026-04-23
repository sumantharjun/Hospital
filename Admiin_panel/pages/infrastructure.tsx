import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const ROOM_TYPES = ["GENERAL", "SEMI_PRIVATE", "PRIVATE", "ICU", "EMERGENCY", "OPERATION_THEATRE"];
const BED_STATUSES = ["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE"];

const statusColor: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  OCCUPIED: "bg-red-100 text-red-800",
  CLEANING: "bg-yellow-100 text-yellow-800",
  MAINTENANCE: "bg-gray-100 text-gray-700",
};

export default function InfrastructurePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [rooms, setRooms] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"rooms" | "beds" | "occupancy">("rooms");
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editRoom, setEditRoom] = useState<any>(null);
  const [roomForm, setRoomForm] = useState({
    floor: 1, roomNumber: "", roomType: "GENERAL", totalBeds: 1, rentPerDay: 0, description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (!t || !u) { router.replace("/"); return; }
    setToken(t);
    fetchHospitals(t);
  }, [router]);

  const fetchHospitals = async (t: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/master/hospitals`, { headers: { Authorization: `Bearer ${t}` } });
      const data = res.ok ? await res.json() : [];
      setHospitals(Array.isArray(data) ? data : []);
      if (data.length > 0) setSelectedHospital(data[0]._id);
    } catch { toast.error("Failed to fetch hospitals"); }
  };

  const fetchRooms = async () => {
    if (!token || !selectedHospital) return;
    setLoading(true);
    try {
      const [rRes, bRes, oRes] = await Promise.all([
        fetch(`${API_BASE}/api/infrastructure/rooms?hospitalId=${selectedHospital}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/infrastructure/beds?hospitalId=${selectedHospital}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/infrastructure/occupancy?hospitalId=${selectedHospital}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setRooms(rRes.ok ? await rRes.json() : []);
      setBeds(bRes.ok ? await bRes.json() : []);
      setOccupancy(oRes.ok ? await oRes.json() : null);
    } catch { toast.error("Failed to fetch infrastructure data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRooms(); }, [selectedHospital, token]);

  const openAddRoom = () => {
    setEditRoom(null);
    setRoomForm({ floor: 1, roomNumber: "", roomType: "GENERAL", totalBeds: 1, rentPerDay: 0, description: "" });
    setShowRoomModal(true);
  };

  const openEditRoom = (room: any) => {
    setEditRoom(room);
    setRoomForm({ floor: room.floor, roomNumber: room.roomNumber, roomType: room.roomType, totalBeds: room.totalBeds, rentPerDay: room.rentPerDay, description: room.description || "" });
    setShowRoomModal(true);
  };

  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editRoom ? `${API_BASE}/api/infrastructure/rooms/${editRoom._id}` : `${API_BASE}/api/infrastructure/rooms`;
      const method = editRoom ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...roomForm, hospitalId: selectedHospital }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      toast.success(editRoom ? "Room updated" : "Room and beds created");
      setShowRoomModal(false);
      fetchRooms();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const updateBedStatus = async (bedId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/infrastructure/beds/${bedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Bed status updated");
      fetchRooms();
    } catch { toast.error("Failed to update bed status"); }
  };

  const deleteRoom = async (id: string) => {
    if (!confirm("Deactivate this room?")) return;
    try {
      await fetch(`${API_BASE}/api/infrastructure/rooms/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      toast.success("Room deactivated");
      fetchRooms();
    } catch { toast.error("Failed"); }
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Infrastructure Management</h1>
          <button onClick={openAddRoom} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + Add Room
          </button>
        </div>

        {/* Hospital Selector */}
        <div className="mb-4">
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)}>
            {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
        </div>

        {/* Occupancy Stats */}
        {occupancy && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Total Beds", value: occupancy.total, color: "bg-blue-50 text-blue-800" },
              { label: "Occupied", value: occupancy.occupied, color: "bg-red-50 text-red-800" },
              { label: "Available", value: occupancy.available, color: "bg-green-50 text-green-800" },
              { label: "Cleaning", value: occupancy.cleaning, color: "bg-yellow-50 text-yellow-800" },
              { label: "Occupancy %", value: `${occupancy.occupancyRate}%`, color: "bg-purple-50 text-purple-800" },
            ].map(s => (
              <div key={s.label} className={`rounded-lg p-3 text-center ${s.color}`}>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          {(["rooms", "beds", "occupancy"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : activeTab === "rooms" ? (
          <div className="grid gap-4">
            {rooms.length === 0 ? <div className="text-center py-12 text-gray-400">No rooms configured yet. Click "Add Room" to start.</div> : null}
            {rooms.map(room => (
              <motion.div key={room._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-900">Room {room.roomNumber}</span>
                    <span className="ml-2 text-xs text-gray-500">Floor {room.floor}</span>
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{room.roomType}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${statusColor[room.status] || "bg-gray-100"}`}>{room.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>{room.totalBeds} bed{room.totalBeds !== 1 ? "s" : ""}</span>
                    <span>₹{room.rentPerDay}/day</span>
                    <button onClick={() => openEditRoom(room)} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => deleteRoom(room._id)} className="text-red-500 hover:underline">Remove</button>
                  </div>
                </div>
                {room.description && <p className="text-xs text-gray-400 mt-1">{room.description}</p>}
              </motion.div>
            ))}
          </div>
        ) : activeTab === "beds" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 font-medium">Bed No.</th>
                  <th className="px-4 py-2 font-medium">Room</th>
                  <th className="px-4 py-2 font-medium">Floor</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Current IP</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {beds.map(bed => (
                  <tr key={bed._id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{bed.bedNumber}</td>
                    <td className="px-4 py-2">{bed.roomId?.roomNumber || "—"}</td>
                    <td className="px-4 py-2">{bed.roomId?.floor || "—"}</td>
                    <td className="px-4 py-2 text-xs">{bed.roomId?.roomType || "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[bed.status] || "bg-gray-100"}`}>{bed.status}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{bed.currentIpId || "—"}</td>
                    <td className="px-4 py-2">
                      <select className="border border-gray-200 rounded px-2 py-1 text-xs" value={bed.status}
                        onChange={e => updateBedStatus(bed._id, e.target.value)}>
                        {BED_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {beds.length === 0 && <div className="text-center py-12 text-gray-400">No beds found.</div>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Room-wise Occupancy</h3>
              {rooms.map(room => {
                const roomBeds = beds.filter(b => b.roomId?._id === room._id || b.roomId === room._id);
                const occ = roomBeds.filter(b => b.status === "OCCUPIED").length;
                const pct = roomBeds.length ? Math.round((occ / roomBeds.length) * 100) : 0;
                return (
                  <div key={room._id} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Room {room.roomNumber} (Floor {room.floor})</span>
                      <span>{occ}/{roomBeds.length} beds · {pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Bed Status Distribution</h3>
              {occupancy && Object.entries({
                Available: occupancy.available,
                Occupied: occupancy.occupied,
                Cleaning: occupancy.cleaning,
                Maintenance: occupancy.total - occupancy.available - occupancy.occupied - occupancy.cleaning,
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                  <span>{k}</span>
                  <span className="font-medium">{v as number}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Room Modal */}
        <AnimatePresence>
          {showRoomModal && (
            <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
                <h2 className="text-lg font-bold mb-4">{editRoom ? "Edit Room" : "Add New Room"}</h2>
                <form onSubmit={saveRoom} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Floor *</label>
                      <input type="number" min={1} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" value={roomForm.floor} onChange={e => setRoomForm(p => ({ ...p, floor: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Room Number *</label>
                      <input type="text" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" value={roomForm.roomNumber} onChange={e => setRoomForm(p => ({ ...p, roomNumber: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Room Type *</label>
                    <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" value={roomForm.roomType} onChange={e => setRoomForm(p => ({ ...p, roomType: e.target.value }))}>
                      {ROOM_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Total Beds *</label>
                      <input type="number" min={1} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" value={roomForm.totalBeds} onChange={e => setRoomForm(p => ({ ...p, totalBeds: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Rent/Day (₹)</label>
                      <input type="number" min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" value={roomForm.rentPerDay} onChange={e => setRoomForm(p => ({ ...p, rentPerDay: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Description</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" value={roomForm.description} onChange={e => setRoomForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowRoomModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
                    <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                      {saving ? "Saving..." : editRoom ? "Update" : "Create"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
