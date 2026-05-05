import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function InventoryPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [pharmacyId, setPharmacyId] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({
    medicineName: "",
    batchNumber: "",
    expiryDate: "",
    quantity: 0,
    threshold: 10,
    distributorId: "",
    rackNumber: "",
    rowNumber: "",
  });
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !t) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(storedUser));
    setToken(t);
  }, [router]);

  const fetchInventory = async (id: string, t: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/inventory/by-pharmacy/${id}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      setItems(res.ok ? await res.json() : []);
    } catch (e) {
      toast.error("Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pharmacyId) return;
    await fetchInventory(pharmacyId, token);
  };

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pharmacyId) return;
    try {
      const payload = { ...newItem, pharmacyId };
      const url = editingItem
        ? `${API_BASE}/api/inventory/${editingItem._id}`
        : `${API_BASE}/api/inventory`;
      const method = editingItem ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        if (editingItem) {
          setItems((prev) => prev.map((i) => (i._id === editingItem._id ? created : i)));
          setEditingItem(null);
        } else {
          setItems((prev) => [created, ...prev]);
        }
        setNewItem({
          medicineName: "",
          batchNumber: "",
          expiryDate: "",
          quantity: 0,
          threshold: 10,
          distributorId: "",
          rackNumber: "",
          rowNumber: "",
        });
        toast.success(`Item ${editingItem ? "updated" : "added"} successfully!`);
        await fetchInventory(pharmacyId, token);
      } else {
        toast.error(`Failed to ${editingItem ? "update" : "add"} item`);
      }
    } catch (e) {
      toast.error(`Error ${editingItem ? "updating" : "adding"} item`);
    }
  };

  const editItem = (item: any) => {
    setEditingItem(item);
    setNewItem({
      medicineName: item.medicineName,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      quantity: item.quantity,
      threshold: item.threshold,
      distributorId: item.distributorId || "",
      rackNumber: item.rackNumber || "",
      rowNumber: item.rowNumber || "",
    });
  };

  const deleteItem = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventory/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i._id !== id));
        toast.success("Item deleted successfully!");
        await fetchInventory(pharmacyId, token);
      } else {
        toast.error("Failed to delete item");
      }
    } catch (e) {
      toast.error("Error deleting item");
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="inventory">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-black">
          Inventory & Stock Management
        </h2>
            <p className="text-sm text-gray-600">
          Inspect and seed pharmacy inventory. Auto-restock will create distributor orders when stock falls below threshold.
        </p>
          </div>
        </div>
      </motion.header>

      <AnimatedCard delay={0.1} className="mb-6">
        <form onSubmit={handleLoad} className="flex flex-col sm:flex-row gap-3">
          <input
            placeholder="Enter Pharmacy ID"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={pharmacyId}
            onChange={(e) => setPharmacyId(e.target.value)}
            required
          />
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-60"
          >
            {loading ? "Loading..." : "Load Inventory"}
          </motion.button>
        </form>
      </AnimatedCard>

      {pharmacyId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <AnimatedCard delay={0.2}>
            <h3 className="text-lg font-semibold mb-4 text-black">
              {editingItem ? "Edit Stock Item" : "Add Stock Item"}
            </h3>
            <form onSubmit={createItem} className="space-y-3">
              <input
                placeholder="Medicine name"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={newItem.medicineName}
                onChange={(e) => setNewItem((prev) => ({ ...prev, medicineName: e.target.value }))}
                required
              />
              <input
                placeholder="Batch number"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={newItem.batchNumber}
                onChange={(e) => setNewItem((prev) => ({ ...prev, batchNumber: e.target.value }))}
                required
              />
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={newItem.expiryDate}
                onChange={(e) => setNewItem((prev) => ({ ...prev, expiryDate: e.target.value }))}
                required
              />
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="Quantity"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={newItem.quantity}
                  onChange={(e) =>
                    setNewItem((prev) => ({
                      ...prev,
                      quantity: Number(e.target.value),
                    }))
                  }
                  required
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Threshold"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  value={newItem.threshold}
                  onChange={(e) =>
                    setNewItem((prev) => ({
                      ...prev,
                      threshold: Number(e.target.value),
                    }))
                  }
                  required
                  min="0"
                />
              </div>
              <input
                placeholder="Distributor ID (for auto restock)"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={newItem.distributorId}
                onChange={(e) => setNewItem((prev) => ({ ...prev, distributorId: e.target.value }))}
              />
              <div className="flex gap-3">
                <input
                  placeholder="Rack Number"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={newItem.rackNumber}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, rackNumber: e.target.value }))}
                />
                <input
                  placeholder="Row/Shelf Number"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={newItem.rowNumber}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, rowNumber: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                {editingItem && (
                  <motion.button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setNewItem({
                        medicineName: "",
                        batchNumber: "",
                        expiryDate: "",
                        quantity: 0,
                        threshold: 10,
                        distributorId: "",
                        rackNumber: "",
                        rowNumber: "",
                      });
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 text-sm transition-all"
                  >
                    Cancel
                  </motion.button>
                )}
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`${editingItem ? "flex-1" : "w-full"} rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2.5 text-sm shadow-lg transition-all`}
                >
                  {editingItem ? "Update Item" : "Add Item"}
                </motion.button>
              </div>
            </form>
          </AnimatedCard>

          <AnimatedCard delay={0.3}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black">Current Stock</h3>
              <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="max-h-[600px] overflow-y-auto space-y-3">
              {items.map((i, idx) => {
                const isLowStock = i.quantity <= i.threshold;
                const isExpiringSoon = i.expiryDate && new Date(i.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                return (
                  <motion.div
                    key={i._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`border rounded-lg p-4 ${
                      isLowStock
                        ? "border-red-300 bg-red-50"
                        : isExpiringSoon
                        ? "border-yellow-300 bg-yellow-50"
                        : "border-gray-200 bg-white"
                    } hover:border-blue-300 hover:shadow-md transition-all`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-black break-words">{i.medicineName}</p>
                          {isLowStock && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium">
                              Low Stock
                            </span>
                          )}
                          {isExpiringSoon && !isLowStock && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300 font-medium">
                              Expiring Soon
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600">
                          Batch {i.batchNumber} · Expires{" "}
                          {i.expiryDate ? new Date(i.expiryDate).toLocaleDateString() : "-"}
                        </p>
                        {(i.rackNumber || i.rowNumber) && (
                          <p className="text-xs text-gray-600 mt-1">
                            📍 Location: {i.rackNumber || "N/A"}/{i.rowNumber || "N/A"}
                          </p>
                        )}
                        {i.distributorId && (
                          <p className="text-xs text-gray-500 mt-1">
                            Distributor: {i.distributorId.slice(-8)}
                          </p>
                        )}
                      </div>
                      <div className="text-right sm:ml-4 flex-shrink-0 w-full sm:w-auto">
                        <p className={`text-lg font-bold ${isLowStock ? "text-red-600" : "text-green-600"}`}>
                          {i.quantity}
                        </p>
                        <p className="text-xs text-gray-600">Threshold: {i.threshold}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                      <motion.button
                        onClick={() => editItem(i)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium hover:bg-blue-100 transition-all"
                      >
                        ✏️ Edit
                      </motion.button>
                      <motion.button
                        onClick={() => deleteItem(i._id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium hover:bg-red-100 transition-all"
                      >
                        🗑️ Delete
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
              {items.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📦</div>
                  <p className="text-sm text-gray-600 font-medium">No items found</p>
                  <p className="text-xs text-gray-500 mt-1">Add stock to get started</p>
                </div>
              )}
            </div>
          </AnimatedCard>
        </div>
      )}
    </Layout>
  );
}
