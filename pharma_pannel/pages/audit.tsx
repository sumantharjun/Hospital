import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import { auditApi } from "@/services/api";
import { getUser } from "@/utils/auth";
import { StockAudit, StockAuditItem } from "@/types";
import { FileIcon, AlertIcon, CalendarIcon, RefreshIcon } from "@/components/Icons";

export default function AuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<StockAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<"all" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REVIEWED">("all");
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split("T")[0]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItems, setEditingItems] = useState<Map<string, Partial<StockAuditItem>>>(new Map());
  const [editType, setEditType] = useState<"manual" | "closing">("manual");

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    if (currentUser.pharmacyId) {
      loadAudits(currentUser.pharmacyId);
    }
  }, [router]);

  const loadAudits = async (pharmacyId: string) => {
    setLoading(true);
    try {
      const filters: any = { pharmacyId };
      if (filter !== "all") {
        filters.status = filter;
      }
      const data = await auditApi.getAll(pharmacyId, filters);
      setAudits(Array.isArray(data) ? data : []);
    } catch (error: any) {
      const errorMessage = error?.message || error?.error || "Failed to load audits";
      // Silent error handling - only show toast
      toast.error(`❌ ${errorMessage}`, { duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAudit = async () => {
    if (!user?.pharmacyId) {
      toast.error("Pharmacy ID not found. Please login again.");
      return;
    }
    
    if (!auditDate) {
      toast.error("Please select an audit date");
      return;
    }
    
    setCreating(true);
    
    // Wrap in async function to properly handle all errors
    (async () => {
      try {
        const newAudit = await auditApi.createDaily({
          pharmacyId: user.pharmacyId,
          auditDate,
        }) as StockAudit;
        
        toast.success("Daily audit created successfully! ✅");
        setShowCreateModal(false);
        loadAudits(user.pharmacyId);
        setSelectedAudit(newAudit);
        setEditing(true);
        setEditType("manual");
        setCreating(false);
      } catch (error: any) {
        // Prevent error from propagating - catch all errors here silently
        const errorMessage = error?.message || error?.error || String(error) || "Failed to create audit";
        // No console.error - errors are shown only as toasts
        
        // Show specific error messages with helpful suggestions
        if (errorMessage.toLowerCase().includes("inventory items") || errorMessage.toLowerCase().includes("no inventory")) {
          // Show error message
          toast.error(`❌ ${errorMessage}`, { 
            duration: 6000,
            style: {
              maxWidth: '450px',
            },
          });
          // Show helpful tip after a short delay
          setTimeout(() => {
            toast("💡 Go to Inventory section → Add New Stock to add inventory items first", {
              icon: "💡",
              duration: 7000,
              style: {
                maxWidth: '450px',
              },
            });
          }, 500);
        } else if (errorMessage.toLowerCase().includes("already exists")) {
          toast.error(`⚠️ ${errorMessage}`, { duration: 4000 });
        } else {
          toast.error(`❌ ${errorMessage}`, { duration: 5000 });
        }
        setCreating(false);
        
        // Return to prevent any further error propagation
        return;
      }
    })().catch((err) => {
      // Extra catch to ensure no unhandled promise rejection - silent handling
      toast.error("❌ An unexpected error occurred. Please try again.");
      setCreating(false);
    });
  };

  const handleUpdateManualBills = async () => {
    if (!selectedAudit) {
      toast.error("No audit selected");
      return;
    }
    
    if (editingItems.size === 0) {
      toast.error("Please enter manual bills quantity for at least one item");
      return;
    }
    
    const items = Array.from(editingItems.entries()).map(([inventoryItemId, updates]) => ({
      inventoryItemId,
      manualBills: updates.manualBills || 0,
    }));

    try {
      const updated = await auditApi.updateManualBills(selectedAudit._id, items);
      setSelectedAudit(updated);
      setEditingItems(new Map());
      toast.success("✅ Manual bills updated successfully!");
    } catch (error: any) {
      const errorMessage = error?.message || error?.error || "Failed to update manual bills";
      // Silent error handling - only show toast
      toast.error(`❌ ${errorMessage}`, { duration: 5000 });
    }
  };

  const handleUpdateClosingStock = async () => {
    if (!selectedAudit) {
      toast.error("No audit selected");
      return;
    }
    
    if (editingItems.size === 0) {
      toast.error("Please enter actual closing stock for at least one item");
      return;
    }
    
    const items = Array.from(editingItems.entries()).map(([inventoryItemId, updates]) => ({
      inventoryItemId,
      actualClosingStock: updates.actualClosingStock,
      varianceReason: updates.varianceReason,
    }));

    try {
      const updated = await auditApi.updateClosingStock(selectedAudit._id, items);
      setSelectedAudit(updated);
      setEditingItems(new Map());
      toast.success("✅ Closing stock updated successfully!");
      
      // Show warning if there are variances
      const itemsWithVariance = updated.items.filter((item: any) => item.variance !== undefined && item.variance !== 0);
      if (itemsWithVariance.length > 0) {
        toast(`⚠️ Audit completed with ${itemsWithVariance.length} item(s) showing variance`, {
          icon: "⚠️",
          duration: 6000,
        });
      }
      
      loadAudits(user!.pharmacyId);
    } catch (error: any) {
      const errorMessage = error?.message || error?.error || "Failed to update closing stock";
      // Silent error handling - only show toast
      toast.error(`❌ ${errorMessage}`, { duration: 5000 });
    }
  };

  const handleEditItem = (item: StockAuditItem, field: "manualBills" | "actualClosingStock", value: number) => {
    const newEditingItems = new Map(editingItems);
    const current = newEditingItems.get(item.inventoryItemId) || {};
    newEditingItems.set(item.inventoryItemId, { ...current, [field]: value });
    setEditingItems(newEditingItems);
  };

  const handleEditVarianceReason = (item: StockAuditItem, reason: string) => {
    const newEditingItems = new Map(editingItems);
    const current = newEditingItems.get(item.inventoryItemId) || {};
    newEditingItems.set(item.inventoryItemId, { ...current, varianceReason: reason });
    setEditingItems(newEditingItems);
  };

  const getVarianceColor = (variance?: number) => {
    if (variance === undefined) return "text-gray-500";
    if (variance === 0) return "text-green-600";
    if (variance > 0) return "text-blue-600";
    return "text-red-600";
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: "bg-gray-100 text-gray-800",
      IN_PROGRESS: "bg-blue-100 text-blue-800",
      COMPLETED: "bg-green-100 text-green-800",
      REVIEWED: "bg-purple-100 text-purple-800",
      DISPUTED: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status as keyof typeof styles] || styles.PENDING}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredAudits = filter === "all" ? audits : audits.filter(a => a.status === filter);
  const itemsWithVariance = selectedAudit?.items.filter(item => item.variance !== undefined && item.variance !== 0) || [];

  return (
    <Layout user={user} currentPage="audit">
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-lg shadow-sm border border-gray-300 p-6"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Daily Stock Audit</h1>
              <p className="text-sm text-gray-600">Manage daily stock audits and track variances</p>
              <p className="text-xs text-gray-500 mt-1">
                <strong>Audit rule:</strong> Opening Stock − Total Sales (system + manual) = Expected Closing. Mismatches are highlighted for admin review.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center gap-2 font-medium"
            >
              <FileIcon className="w-5 h-5" />
              Create New Audit
            </button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-lg shadow-sm border border-gray-300 p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            {["all", "PENDING", "IN_PROGRESS", "COMPLETED", "REVIEWED"].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setFilter(status as any);
                  if (user.pharmacyId) loadAudits(user.pharmacyId);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? "bg-blue-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {status === "all" ? "All" : status.replace("_", " ")}
              </button>
            ))}
            <button
              onClick={() => user.pharmacyId && loadAudits(user.pharmacyId)}
              className="ml-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <RefreshIcon className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Audits List and Detail View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Audits List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-300 bg-gray-50">
              <h2 className="font-semibold text-gray-900">Recent Audits</h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[calc(100vh-300px)] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : filteredAudits.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No audits found</p>
                </div>
              ) : (
                filteredAudits.map((audit) => (
                  <button
                    key={audit._id}
                    onClick={() => {
                      setSelectedAudit(audit);
                      setEditing(false);
                      setEditingItems(new Map());
                    }}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedAudit?._id === audit._id ? "bg-blue-50 border-l-4 border-blue-900" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(audit.auditDate).toLocaleDateString()}
                        </span>
                      </div>
                      {getStatusBadge(audit.status)}
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>Items: {audit.totalItems}</div>
                      {audit.itemsWithVariance > 0 && (
                        <div className="text-red-600 font-medium">
                          {audit.itemsWithVariance} variance(s)
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>

          {/* Audit Detail */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden"
          >
            {!selectedAudit ? (
              <div className="p-12 text-center text-gray-500">
                <FileIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select an audit to view details</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 max-h-[calc(100vh-300px)] overflow-y-auto">
                {/* Audit Header */}
                <div className="p-6 bg-gradient-to-r from-blue-900 to-blue-800 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold mb-1">Audit Details</h2>
                      <p className="text-blue-100 text-sm">
                        {new Date(selectedAudit.auditDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    {getStatusBadge(selectedAudit.status)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <div className="text-blue-200 text-xs mb-1">Total Items</div>
                      <div className="text-2xl font-bold">{selectedAudit.totalItems}</div>
                    </div>
                    <div>
                      <div className="text-blue-200 text-xs mb-1">With Variance</div>
                      <div className={`text-2xl font-bold ${selectedAudit.itemsWithVariance > 0 ? "text-red-300" : "text-green-300"}`}>
                        {selectedAudit.itemsWithVariance}
                      </div>
                    </div>
                    <div>
                      <div className="text-blue-200 text-xs mb-1">Status</div>
                      <div className="text-lg font-semibold">{selectedAudit.status}</div>
                    </div>
                    <div>
                      <div className="text-blue-200 text-xs mb-1">Type</div>
                      <div className="text-lg font-semibold">{selectedAudit.auditType}</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-3 items-center">
                  <button
                    onClick={async () => {
                      try {
                        await auditApi.downloadReport(selectedAudit._id);
                        toast.success("Audit report downloaded");
                      } catch (e: any) {
                        toast.error(e.message || "Failed to download");
                      }
                    }}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Audit Report
                  </button>
                  {selectedAudit.status === "IN_PROGRESS" && (
                    <>
                      <button
                        onClick={() => {
                          setEditing(true);
                          setEditType("manual");
                        }}
                        className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium"
                      >
                        Enter Manual Bills
                      </button>
                      <button
                        onClick={() => {
                          setEditing(true);
                          setEditType("closing");
                        }}
                        className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                      >
                        Enter Closing Stock
                      </button>
                    </>
                  )}
                </div>

                {/* Audit Items Table */}
                <div className="p-4">
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <strong>Rule:</strong> Opening Stock − Total Sales (System + Manual) = Expected Closing. Variance = Expected − Actual. Mismatches are highlighted for admin review.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">Medicine</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">Batch</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-900">Opening</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-900">System Sales</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-900">Manual</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-900">Total Sales</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-900">Expected Closing</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-900">Actual Closing</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-900">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedAudit.items.map((item, index) => {
                          const editingItem = editingItems.get(item.inventoryItemId);
                          const hasVariance = item.variance !== undefined && item.variance !== 0;
                          return (
                            <motion.tr
                              key={item.inventoryItemId}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.02 }}
                              className={`hover:bg-gray-50 ${hasVariance ? "bg-red-50" : ""}`}
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{item.medicineName}</div>
                                {item.brandName && (
                                  <div className="text-xs text-gray-500">{item.brandName}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{item.batchNumber}</td>
                              <td className="px-4 py-3 text-right font-medium">{item.openingStock}</td>
                              <td className="px-4 py-3 text-right">{item.systemSales}</td>
                              <td className="px-4 py-3">
                                {editing && editType === "manual" ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingItem?.manualBills ?? item.manualBills}
                                    onChange={(e) =>
                                      handleEditItem(item, "manualBills", parseInt(e.target.value) || 0)
                                    }
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                                  />
                                ) : (
                                  <span className="text-right block">{item.manualBills}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {item.totalSales}
                              </td>
                              <td className="px-4 py-3 text-right">{item.expectedClosingStock}</td>
                              <td className="px-4 py-3">
                                {editing && editType === "closing" ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingItem?.actualClosingStock ?? item.actualClosingStock ?? ""}
                                    onChange={(e) =>
                                      handleEditItem(
                                        item,
                                        "actualClosingStock",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                                  />
                                ) : (
                                  <span className="text-right block">
                                    {item.actualClosingStock ?? "-"}
                                  </span>
                                )}
                              </td>
                              <td className={`px-4 py-3 text-right font-semibold ${getVarianceColor(item.variance)}`}>
                                {item.variance !== undefined ? (
                                  <div>
                                    <div>{item.variance > 0 ? "+" : ""}{item.variance}</div>
                                    {item.varianceReason && editing && (
                                      <input
                                        type="text"
                                        value={editingItem?.varianceReason ?? item.varianceReason}
                                        onChange={(e) => handleEditVarianceReason(item, e.target.value)}
                                        placeholder="Reason"
                                        className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded"
                                      />
                                    )}
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Save Buttons */}
                  {editing && editingItems.size > 0 && (
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={editType === "manual" ? handleUpdateManualBills : handleUpdateClosingStock}
                        className="px-6 py-2 bg-green-700 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditingItems(new Map());
                        }}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Variance Summary */}
                  {itemsWithVariance.length > 0 && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertIcon className="w-5 h-5 text-red-600" />
                        <h3 className="font-semibold text-red-900">Items with Variance</h3>
                      </div>
                      <div className="space-y-2">
                        {itemsWithVariance.map((item) => (
                          <div key={item.inventoryItemId} className="text-sm">
                            <span className="font-medium">{item.medicineName}</span>
                            {" - "}
                            <span className={getVarianceColor(item.variance)}>
                              Variance: {item.variance! > 0 ? "+" : ""}{item.variance}
                            </span>
                            {item.varianceReason && (
                              <span className="text-gray-600 ml-2">({item.varianceReason})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Create Audit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Create Daily Audit</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Audit Date</label>
                    <input
                      type="date"
                      value={auditDate}
                      onChange={(e) => setAuditDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCreateAudit}
                      disabled={creating}
                      className="flex-1 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium disabled:opacity-50"
                    >
                      {creating ? "Creating..." : "Create Audit"}
                    </button>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Layout>
  );
}

