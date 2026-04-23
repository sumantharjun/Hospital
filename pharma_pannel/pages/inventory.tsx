import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";
import Layout from "@/components/Layout";
import { inventoryApi, distributorsApi, distributorOrdersApi, getAuthHeaders } from "@/services/api";
import { getUser } from "@/utils/auth";
import { InventoryItem } from "@/types";
import { API_BASE } from "@/utils/constants";

export default function InventoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalCategory, setAddModalCategory] = useState<"MEDICINE" | "MEDICAL_EQUIPMENT" | "HEALTH_SUPPLEMENT" | "PERSONAL_CARE" | null>(null);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [filter, setFilter] = useState<"all" | "lowStock" | "expiring">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | "MEDICINE" | "MEDICAL_EQUIPMENT" | "HEALTH_SUPPLEMENT" | "PERSONAL_CARE">("ALL");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const [formData, setFormData] = useState({
    medicineName: "",
    composition: "",
    brandName: "",
    category: "MEDICINE" as "MEDICINE" | "MEDICAL_EQUIPMENT" | "HEALTH_SUPPLEMENT" | "PERSONAL_CARE",
    quantity: "",
    minStockLevel: "",
    expiryDate: "",
    batchNumber: "",
    purchasePrice: "",
    sellingPrice: "",
    mrp: "",
    rackNumber: "",
    rowNumber: "",
    unitPrice: "", // Legacy field
    supplier: "",
    distributorId: "",
    supplierType: "distributor" as "distributor" | "custom", // distributor or custom supplier name
    imageUrl: "",
    description: "",
    prescriptionRequired: false,
  });
  
  const [distributors, setDistributors] = useState<any[]>([]);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [customSupplierName, setCustomSupplierName] = useState("");
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderItem, setOrderItem] = useState<InventoryItem | null>(null);
  const [orderQuantity, setOrderQuantity] = useState("");

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    // Load distributors first, then inventory (so we can populate supplier names)
    const loadData = async () => {
      const distList = await loadDistributors();
      if (currentUser.pharmacyId) {
        loadInventory(currentUser.pharmacyId, distList);
      }
    };
    loadData();

    // Socket is already initialized in _app.tsx, just listen to events
    const socket = getSocket();
    if (socket && currentUser.pharmacyId) {
      const handleLowStock = (data: any) => {
        if (data.pharmacyId === currentUser.pharmacyId) {
          toast.error(`⚠️ Low Stock Alert: ${data.medicineName || "Medicine"} is running low!`, {
            duration: 5000,
          });
          if (currentUser.pharmacyId) {
            loadInventory(currentUser.pharmacyId);
          }
        }
      };

      onSocketEvent("notification:lowStock", handleLowStock);

      // Listen for inventory updates from other pages (e.g., when syncing stock from distributor orders)
      const handleInventoryUpdate = (event: CustomEvent) => {
        const pharmacyId = currentUser.pharmacyId;
        if (event.detail?.pharmacyId === pharmacyId && pharmacyId) {
          console.log("🔄 Inventory update event received, reloading inventory...");
          // Wait a bit to ensure backend has saved the data
          setTimeout(() => {
            if (pharmacyId) {
              loadInventory(pharmacyId);
            }
          }, 500);
        }
      };

      window.addEventListener('inventoryUpdated', handleInventoryUpdate as EventListener);
      
      // Also listen for general inventory update events (without detail)
      const handleGeneralInventoryUpdate = () => {
        const pharmacyId = currentUser.pharmacyId;
        if (pharmacyId) {
          console.log("🔄 General inventory update event received, reloading inventory...");
          setTimeout(() => {
            loadInventory(pharmacyId);
          }, 500);
        }
      };
      
      window.addEventListener('inventoryUpdated', handleGeneralInventoryUpdate);

      return () => {
        offSocketEvent("notification:lowStock", handleLowStock);
        window.removeEventListener('inventoryUpdated', handleInventoryUpdate as EventListener);
        window.removeEventListener('inventoryUpdated', handleGeneralInventoryUpdate);
      };
    }
  }, [router]);

  useEffect(() => {
    let filtered = [...inventory];

    // Filter by category
    if (selectedCategory !== "ALL") {
      filtered = filtered.filter((item) => {
        const itemCategory = (item as any).category || "MEDICINE";
        return itemCategory === selectedCategory;
      });
    }

    if (filter === "lowStock") {
      filtered = filtered.filter((item) => {
        const minStock = (item as any).threshold !== undefined ? (item as any).threshold : item.minStockLevel;
        return item.quantity <= (minStock ?? 0);
      });
    } else if (filter === "expiring") {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      filtered = filtered.filter((item) => {
        if (!item.expiryDate) return false;
        const expiry = new Date(item.expiryDate);
        return expiry <= thirtyDaysFromNow && expiry >= today;
      });
    }

    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.medicineName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredInventory(filtered);
  }, [inventory, filter, searchTerm, selectedCategory]);

  // Update supplier names when distributors are loaded (if inventory already exists)
  useEffect(() => {
    if (distributors.length > 0 && inventory.length > 0) {
      // Update supplier names for items that have distributorId but missing supplier name
      setInventory(prevInventory => prevInventory.map((item: any) => {
        if (item.distributorId && (!item.supplier || item.supplier === "N/A")) {
          const distributor = distributors.find((d: any) => d._id === item.distributorId);
          if (distributor) {
            return { ...item, supplier: distributor.name };
          }
        }
        return item;
      }));
    }
  }, [distributors]);

  const loadDistributors = async () => {
    try {
      const data = await distributorsApi.getAll();
      console.log("Distributors loaded:", data);
      const distributorsList = Array.isArray(data) ? data : [];
      setDistributors(distributorsList);
      return distributorsList;
    } catch (error: any) {
      console.error("Error loading distributors:", error);
      // Show error message if it's a connection error
      if (error.message?.includes("Cannot connect to server")) {
        toast.error(error.message);
      } else if (error.message) {
        console.warn("Failed to load distributors:", error.message);
      }
      return [];
    }
  };

  const loadInventory = async (pharmacyId: string, distributorsList?: any[]) => {
    setLoading(true);
    try {
      console.log(`🔄 Loading inventory for pharmacy: ${pharmacyId}`);
      const data = await inventoryApi.getAll(pharmacyId);
      
      console.log(`📦 Raw inventory data received:`, Array.isArray(data) ? `${data.length} items` : "Not an array", data);
      
      // Use provided distributors list or current state
      const distList = distributorsList || distributors;
      
      // Transform backend data: map threshold -> minStockLevel, price -> unitPrice, and populate supplier name from distributorId
      const transformedData = Array.isArray(data) ? data.map((item: any) => {
        // Find distributor name if distributorId exists
        let supplierName = item.supplier;
        if (item.distributorId && distList.length > 0) {
          const distributor = distList.find((d: any) => d._id === item.distributorId);
          if (distributor) {
            supplierName = distributor.name;
          }
        }
        
        return {
          ...item,
          minStockLevel: item.threshold !== undefined ? item.threshold : item.minStockLevel,
          unitPrice: item.price !== undefined ? item.price : item.unitPrice,
          supplier: supplierName || item.supplier || undefined,
          category: item.category || "MEDICINE", // Ensure category is always set
        };
      }) : [];
      
      console.log(`✅ Transformed inventory data: ${transformedData.length} items`);
      if (transformedData.length > 0) {
        console.log("Sample transformed items:", transformedData.slice(0, 3));
      }
      
      setInventory(transformedData);
      
      if (transformedData.length === 0) {
        console.warn("⚠️ No inventory items found for pharmacy:", pharmacyId);
      }
    } catch (error: any) {
      console.error("❌ Error loading inventory:", error);
      toast.error(error.message || "Failed to load inventory");
      setInventory([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.pharmacyId) return;

    try {
      // Determine supplier value based on type
      let supplierValue: string | undefined;
      let distributorIdValue: string | undefined;
      
      if (formData.supplierType === "distributor" && formData.distributorId) {
        const selectedDistributor = distributors.find(d => d._id === formData.distributorId);
        supplierValue = selectedDistributor?.name || undefined;
        distributorIdValue = formData.distributorId;
      } else if (formData.supplierType === "custom" && formData.supplier) {
        supplierValue = formData.supplier;
      }

      const result = await inventoryApi.create({
        pharmacyId: user.pharmacyId,
        medicineName: formData.medicineName,
        composition: formData.composition || formData.medicineName, // Use medicine name as composition if not provided
        brandName: formData.brandName || undefined,
        category: formData.category,
        quantity: parseInt(formData.quantity),
        threshold: parseInt(formData.minStockLevel),
        expiryDate: formData.expiryDate || undefined,
        batchNumber: formData.batchNumber || undefined,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : (formData.unitPrice ? parseFloat(formData.unitPrice) * 0.8 : undefined), // Estimate if not provided
        sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : (formData.unitPrice ? parseFloat(formData.unitPrice) : undefined),
        mrp: formData.mrp ? parseFloat(formData.mrp) : undefined,
        rackNumber: formData.rackNumber || undefined,
        rowNumber: formData.rowNumber || undefined,
        unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : undefined, // Legacy
        supplier: supplierValue,
        distributorId: distributorIdValue,
        imageUrl: formData.imageUrl || undefined,
        description: formData.description || undefined,
        prescriptionRequired: formData.prescriptionRequired,
      });

      // Check if quantity is low and trigger alert (backend will auto-notify admin & distributor)
      if (parseInt(formData.quantity) <= parseInt(formData.minStockLevel)) {
        toast.error(`⚠️ Low Stock: ${formData.medicineName} is below minimum level!`, {
          duration: 5000,
        });
      }

      toast.success("Stock added successfully!");
      setShowAddModal(false);
      setAddModalCategory(null);
      resetForm();
      loadInventory(user.pharmacyId);
    } catch (error: any) {
      toast.error(error.message || "Failed to add stock");
    }
  };

  const handleUpdateQuantity = async (item: InventoryItem, newQuantity: number) => {
    if (!user?.pharmacyId) return;

    try {
      await inventoryApi.update(item._id, { quantity: newQuantity });
      
      // Check if quantity is now low and trigger alert + auto-order
      const minStock = (item as any).threshold !== undefined ? (item as any).threshold : item.minStockLevel;
      if (newQuantity <= (minStock ?? 0)) {
        toast.error(`⚠️ Low Stock: ${item.medicineName} is now below minimum level!`, {
          duration: 5000,
        });
        // Auto-create stock order to distributor
        await createStockOrderToDistributor(item, newQuantity);
      }
      
      toast.success("Quantity updated successfully!");
      loadInventory(user.pharmacyId);
    } catch (error: any) {
      toast.error(error.message || "Failed to update quantity");
    }
  };

  const createStockOrderToDistributor = async (item: InventoryItem, currentQuantity: number) => {
    if (!user?.pharmacyId) return;
    
    try {
      // Get distributor ID from user or pharmacy
      const distributorId = user.distributorId;
      if (!distributorId) {
        toast.error("No distributor linked. Please link a distributor first.");
        return;
      }

      // Calculate required quantity (order enough to reach 2x min stock level)
      const minStock = (item as any).threshold !== undefined ? (item as any).threshold : item.minStockLevel;
      const requiredQuantity = Math.max((minStock ?? 10) * 2 - currentQuantity, minStock ?? 10);

      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(authHeaders.Authorization && { Authorization: authHeaders.Authorization }),
      };

      const response = await fetch(`${API_BASE}/api/distributor-orders`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pharmacyId: user.pharmacyId,
          distributorId: distributorId,
          medicineName: item.medicineName,
          category: (item as any).category || "MEDICINE",
          quantity: requiredQuantity,
          reason: "AUTO_REPLENISH", // Mark as auto-replenish order
        }),
      });

      if (response.ok) {
        toast.success(`📦 Auto-ordered ${requiredQuantity} units of ${item.medicineName} from distributor`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || "Failed to create stock order");
      }
    } catch (error: any) {
      console.error("Error creating stock order:", error);
      toast.error("Failed to auto-order from distributor");
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    // Determine supplier type based on whether distributorId exists
    const supplierType = item.distributorId ? "distributor" : "custom";
    // Handle both threshold/minStockLevel and price/unitPrice from backend
    const minStock = (item as any).threshold !== undefined ? (item as any).threshold : item.minStockLevel;
    const unitPrice = (item as any).price !== undefined ? (item as any).price : item.unitPrice;
    const sellingPrice = (item as any).sellingPrice !== undefined ? (item as any).sellingPrice : unitPrice;
    const purchasePrice = (item as any).purchasePrice !== undefined ? (item as any).purchasePrice : undefined;
    const mrp = (item as any).mrp !== undefined ? (item as any).mrp : sellingPrice;
    
    setFormData({
      medicineName: item.medicineName || "",
      composition: (item as any).composition || item.medicineName || "",
      brandName: (item as any).brandName || "",
      category: ((item as any).category || "MEDICINE") as "MEDICINE" | "MEDICAL_EQUIPMENT" | "HEALTH_SUPPLEMENT" | "PERSONAL_CARE",
      quantity: (item.quantity ?? 0).toString(),
      minStockLevel: (minStock ?? 0).toString(),
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split("T")[0] : "",
      batchNumber: item.batchNumber || "",
      purchasePrice: purchasePrice?.toString() || "",
      sellingPrice: sellingPrice?.toString() || "",
      mrp: mrp?.toString() || "",
      rackNumber: (item as any).rackNumber || "",
      rowNumber: (item as any).rowNumber || "",
      unitPrice: unitPrice?.toString() || "",
      supplier: item.supplier || "",
      distributorId: item.distributorId || "",
      supplierType: supplierType as "distributor" | "custom",
      imageUrl: (item as any).imageUrl || "",
      description: (item as any).description || "",
      prescriptionRequired: (item as any).prescriptionRequired || false,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !user?.pharmacyId) return;

    try {
      // Determine supplier value based on type
      let supplierValue: string | undefined;
      let distributorIdValue: string | undefined;
      
      if (formData.supplierType === "distributor" && formData.distributorId) {
        const selectedDistributor = distributors.find(d => d._id === formData.distributorId);
        supplierValue = selectedDistributor?.name || undefined;
        distributorIdValue = formData.distributorId;
      } else if (formData.supplierType === "custom" && formData.supplier) {
        supplierValue = formData.supplier;
        distributorIdValue = undefined; // Clear distributorId if using custom
      }

      await inventoryApi.update(selectedItem._id, {
        medicineName: formData.medicineName,
        composition: formData.composition || formData.medicineName,
        brandName: formData.brandName || undefined,
        category: formData.category,
        quantity: parseInt(formData.quantity),
        threshold: parseInt(formData.minStockLevel),
        expiryDate: formData.expiryDate || undefined,
        batchNumber: formData.batchNumber || undefined,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
        sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : undefined,
        mrp: formData.mrp ? parseFloat(formData.mrp) : undefined,
        rackNumber: formData.rackNumber || undefined,
        rowNumber: formData.rowNumber || undefined,
        unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : undefined, // Legacy
        supplier: supplierValue,
        distributorId: distributorIdValue,
        imageUrl: formData.imageUrl || undefined,
        description: formData.description || undefined,
        prescriptionRequired: formData.prescriptionRequired,
      });

      toast.success("Item updated successfully!");
      setShowEditModal(false);
      resetForm();
      setSelectedItem(null);
      loadInventory(user.pharmacyId);
    } catch (error: any) {
      toast.error(error.message || "Failed to update item");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      await inventoryApi.delete(id);
      toast.success("Item deleted successfully!");
      if (user?.pharmacyId) {
        loadInventory(user.pharmacyId);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete item");
    }
  };

  const handleOrderMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderItem || !user?.pharmacyId || !orderQuantity) return;

    try {
      const quantity = parseInt(orderQuantity);
      if (isNaN(quantity) || quantity <= 0) {
        toast.error("Please enter a valid quantity");
        return;
      }

      if (!orderItem.distributorId) {
        toast.error("No distributor linked to this item. Please select a distributor first.");
        return;
      }

      await distributorOrdersApi.create({
        pharmacyId: user.pharmacyId,
        distributorId: orderItem.distributorId,
        medicineName: orderItem.medicineName,
        category: (orderItem as any).category || "MEDICINE",
        quantity: quantity,
      });

      toast.success(`✅ Order placed for ${quantity} units of ${orderItem.medicineName} to distributor!`);
      setShowOrderModal(false);
      setOrderItem(null);
      setOrderQuantity("");
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
    }
  };

  const resetForm = () => {
    setFormData({
      medicineName: "",
      composition: "",
      brandName: "",
      category: "MEDICINE",
      quantity: "",
      minStockLevel: "",
      expiryDate: "",
      batchNumber: "",
      purchasePrice: "",
      sellingPrice: "",
      mrp: "",
      rackNumber: "",
      rowNumber: "",
      unitPrice: "",
      supplier: "",
      distributorId: "",
      supplierType: "distributor",
      imageUrl: "",
      description: "",
      prescriptionRequired: false,
    });
    setCustomSupplierName("");
  };

  const getExpiringItems = () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    return inventory.filter((item) => {
      if (!item.expiryDate) return false;
      const expiry = new Date(item.expiryDate);
      return expiry <= thirtyDaysFromNow && expiry >= today;
    });
  };

  const getLowStockItems = () => {
    return inventory.filter((item) => {
      const minStock = (item as any).threshold !== undefined ? (item as any).threshold : item.minStockLevel;
      return item.quantity <= (minStock ?? 0);
    });
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="inventory">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 sm:space-y-6 w-full max-w-full"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
          <div className="w-full sm:w-auto min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Inventory Management</h1>
            <p className="text-xs sm:text-sm text-gray-600">Manage your pharmacy stock, track expiry, and monitor low stock alerts</p>
          </div>
          <div className="relative z-50 w-full sm:w-auto flex-shrink-0">
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg text-sm sm:text-base font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              ➕ Add Stock
              <svg className={`w-4 h-4 transition-transform ${showAddDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown Menu - Card Style */}
            {showAddDropdown && (
              <>
                <div className="absolute right-0 mt-2 w-full sm:w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-green-50 border-b border-gray-200">
                    <h3 className="font-bold text-gray-900 text-sm">Select Category</h3>
                    <p className="text-xs text-gray-600 mt-0.5">Choose a category to add stock</p>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    <button
                      onClick={() => {
                        resetForm();
                        setAddModalCategory("MEDICINE");
                        setFormData(prev => ({ ...prev, category: "MEDICINE" }));
                        setShowAddModal(true);
                        setShowAddDropdown(false);
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full px-4 py-4 text-left hover:bg-blue-50 active:bg-blue-100 transition-all flex items-center gap-3 border-b border-gray-100 group"
                    >
                      <span className="text-2xl flex-shrink-0">💊</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-sm group-hover:text-blue-700">Add Medicine</div>
                        <div className="text-xs text-gray-500 mt-0.5">Prescription and OTC medicines</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        resetForm();
                        setAddModalCategory("MEDICAL_EQUIPMENT");
                        setFormData(prev => ({ ...prev, category: "MEDICAL_EQUIPMENT" }));
                        setShowAddModal(true);
                        setShowAddDropdown(false);
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full px-4 py-4 text-left hover:bg-purple-50 active:bg-purple-100 transition-all flex items-center gap-3 border-b border-gray-100 group"
                    >
                      <span className="text-2xl flex-shrink-0">🩺</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-sm group-hover:text-purple-700">Add Equipment</div>
                        <div className="text-xs text-gray-500 mt-0.5">Medical devices and equipment</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        resetForm();
                        setAddModalCategory("HEALTH_SUPPLEMENT");
                        setFormData(prev => ({ ...prev, category: "HEALTH_SUPPLEMENT" }));
                        setShowAddModal(true);
                        setShowAddDropdown(false);
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full px-4 py-4 text-left hover:bg-green-50 active:bg-green-100 transition-all flex items-center gap-3 border-b border-gray-100 group"
                    >
                      <span className="text-2xl flex-shrink-0">💊</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-sm group-hover:text-green-700">Add Supplement</div>
                        <div className="text-xs text-gray-500 mt-0.5">Vitamins and health supplements</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        resetForm();
                        setAddModalCategory("PERSONAL_CARE");
                        setFormData(prev => ({ ...prev, category: "PERSONAL_CARE" }));
                        setShowAddModal(true);
                        setShowAddDropdown(false);
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full px-4 py-4 text-left hover:bg-pink-50 active:bg-pink-100 transition-all flex items-center gap-3 group"
                    >
                      <span className="text-2xl flex-shrink-0">🧴</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-sm group-hover:text-pink-700">Add Personal Care</div>
                        <div className="text-xs text-gray-500 mt-0.5">Personal hygiene and care products</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-pink-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Click outside to close dropdown */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowAddDropdown(false)}
                />
              </>
            )}
          </div>
        </div>

        {/* Category Filter Section - Dropdown */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 border border-gray-100 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-3 sm:mb-4 w-full">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 w-full sm:w-auto flex-shrink-0">Filter by Category</h2>
            <div className="relative z-40 w-full sm:w-auto flex-shrink-0">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm sm:text-base font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span className="truncate">
                  {selectedCategory === "ALL" && "📦 All Products"}
                  {selectedCategory === "MEDICINE" && "💊 Medicines"}
                  {selectedCategory === "MEDICAL_EQUIPMENT" && "🩺 Medical Equipment"}
                  {selectedCategory === "HEALTH_SUPPLEMENT" && "💊 Health Supplements"}
                  {selectedCategory === "PERSONAL_CARE" && "🧴 Personal Care"}
                </span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded flex-shrink-0">
                  {selectedCategory === "ALL" 
                    ? inventory.length 
                    : inventory.filter((item) => ((item as any).category || "MEDICINE") === selectedCategory).length} items
                </span>
                <svg className={`w-4 h-4 transition-transform flex-shrink-0 ${showCategoryDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Category Dropdown Menu - Card Style */}
              {showCategoryDropdown && (
                <>
                  <div className="absolute left-0 top-full mt-2 w-full sm:w-72 bg-white rounded-lg shadow-2xl border-2 border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 text-sm">Select Category</h3>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <button
                        onClick={() => {
                          setSelectedCategory("ALL");
                          setShowCategoryDropdown(false);
                        }}
                        className={`w-full px-4 py-4 text-left transition-all flex items-center gap-3 border-b border-gray-100 ${
                          selectedCategory === "ALL" 
                            ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white" 
                            : "hover:bg-gray-50 text-gray-900"
                        }`}
                      >
                        <span className="text-2xl">📦</span>
                        <div className="flex-1">
                          <div className="font-semibold flex items-center gap-2">
                            All Products
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              selectedCategory === "ALL" 
                                ? "bg-purple-600 text-white" 
                                : "bg-purple-100 text-purple-700"
                            }`}>
                              {inventory.length} items
                            </span>
                          </div>
                          <div className={`text-xs mt-1 ${
                            selectedCategory === "ALL" ? "text-purple-100" : "text-gray-500"
                          }`}>
                            Prescription and OTC medicines
                          </div>
                        </div>
                        <svg 
                          className={`w-4 h-4 flex-shrink-0 ${
                            selectedCategory === "ALL" ? "text-white" : "text-gray-400"
                          }`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCategory("MEDICINE");
                          setShowCategoryDropdown(false);
                        }}
                        className={`w-full px-4 py-4 text-left transition-colors flex items-center gap-3 border-b border-gray-100 ${
                          selectedCategory === "MEDICINE" ? "bg-blue-50" : "hover:bg-blue-50"
                        }`}
                      >
                        <span className="text-2xl">💊</span>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            Medicines
                            {selectedCategory === "MEDICINE" && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Selected</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Prescription and over-the-counter medicines</div>
                          <div className="text-xs font-medium text-gray-700 mt-1">
                            {inventory.filter((item) => ((item as any).category || "MEDICINE") === "MEDICINE").length} items
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCategory("MEDICAL_EQUIPMENT");
                          setShowCategoryDropdown(false);
                        }}
                        className={`w-full px-4 py-4 text-left transition-colors flex items-center gap-3 border-b border-gray-100 ${
                          selectedCategory === "MEDICAL_EQUIPMENT" ? "bg-blue-50" : "hover:bg-purple-50"
                        }`}
                      >
                        <span className="text-2xl">🩺</span>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            Medical Equipment
                            {selectedCategory === "MEDICAL_EQUIPMENT" && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Selected</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Medical devices and equipment</div>
                          <div className="text-xs font-medium text-gray-700 mt-1">
                            {inventory.filter((item) => ((item as any).category || "MEDICINE") === "MEDICAL_EQUIPMENT").length} items
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCategory("HEALTH_SUPPLEMENT");
                          setShowCategoryDropdown(false);
                        }}
                        className={`w-full px-4 py-4 text-left transition-colors flex items-center gap-3 border-b border-gray-100 ${
                          selectedCategory === "HEALTH_SUPPLEMENT" ? "bg-blue-50" : "hover:bg-green-50"
                        }`}
                      >
                        <span className="text-2xl">💊</span>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            Health Supplements
                            {selectedCategory === "HEALTH_SUPPLEMENT" && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Selected</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Vitamins and health supplements</div>
                          <div className="text-xs font-medium text-gray-700 mt-1">
                            {inventory.filter((item) => ((item as any).category || "MEDICINE") === "HEALTH_SUPPLEMENT").length} items
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCategory("PERSONAL_CARE");
                          setShowCategoryDropdown(false);
                        }}
                        className={`w-full px-4 py-4 text-left transition-colors flex items-center gap-3 ${
                          selectedCategory === "PERSONAL_CARE" ? "bg-blue-50" : "hover:bg-pink-50"
                        }`}
                      >
                        <span className="text-2xl">🧴</span>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            Personal Care
                            {selectedCategory === "PERSONAL_CARE" && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Selected</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Personal hygiene and care products</div>
                          <div className="text-xs font-medium text-gray-700 mt-1">
                            {inventory.filter((item) => ((item as any).category || "MEDICINE") === "PERSONAL_CARE").length} items
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                  {/* Click outside to close dropdown */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowCategoryDropdown(false)}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full">
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-xs sm:text-sm font-medium">Total Items</span>
              <span className="text-xl sm:text-2xl">📦</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {selectedCategory === "ALL" ? inventory.length : filteredInventory.length}
            </p>
            {selectedCategory !== "ALL" && (
              <p className="text-xs text-gray-500 mt-1">in {selectedCategory.replace("_", " ")} category</p>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-xs sm:text-sm font-medium">Low Stock</span>
              <span className="text-xl sm:text-2xl">⚠️</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-red-600">{getLowStockItems().length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-xs sm:text-sm font-medium">Expiring Soon</span>
              <span className="text-xl sm:text-2xl">⏰</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-orange-600">{getExpiringItems().length}</p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-md p-3 sm:p-4 border border-gray-100 w-full">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by medicine name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter("all")}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-all ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("lowStock")}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-all ${
                  filter === "lowStock"
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Low Stock
              </button>
              <button
                onClick={() => {
                  setFilter("expiring");
                  setShowExpiryModal(true);
                }}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-all ${
                  filter === "expiring"
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Expiring
              </button>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No inventory items found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden w-full">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[800px] lg:min-w-0">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Medicine</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Category</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Brand</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Quantity</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Min Level</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Expiry</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Batch</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Cost/Sell</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">Location</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInventory.map((item) => {
                    // Handle both threshold/minStockLevel and price/unitPrice from backend
                    const minStock = (item as any).threshold !== undefined ? (item as any).threshold : item.minStockLevel;
                    const unitPrice = (item as any).price !== undefined ? (item as any).price : item.unitPrice;
                    const sellingPrice = (item as any).sellingPrice !== undefined ? (item as any).sellingPrice : unitPrice;
                    const isLowStock = item.quantity <= (minStock ?? 0);
                    
                    // Calculate expiry status
                    let expiryStatus: "expired" | "critical" | "warning" | "ok" = "ok";
                    let daysUntilExpiry = null;
                    if (item.expiryDate) {
                      const expiryDate = new Date(item.expiryDate);
                      const today = new Date();
                      daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      
                      if (daysUntilExpiry < 0) {
                        expiryStatus = "expired";
                      } else if (daysUntilExpiry <= 7) {
                        expiryStatus = "critical";
                      } else if (daysUntilExpiry <= 30) {
                        expiryStatus = "warning";
                      }
                    }
                    
                    const rowBgColor = expiryStatus === "expired" ? "bg-red-50" : 
                                      expiryStatus === "critical" ? "bg-orange-50" : 
                                      expiryStatus === "warning" ? "bg-yellow-50" : 
                                      isLowStock ? "bg-pink-50" : "";
                    
                    return (
                      <tr key={item._id} className={`hover:bg-gray-100 ${rowBgColor}`}>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                            <div className="min-w-0 flex-1">
                            <span className="text-xs sm:text-sm font-medium text-gray-900 break-words">{item.medicineName}</span>
                              {(item as any).composition && (item as any).composition !== item.medicineName && (
                                <p className="text-[10px] sm:text-xs text-gray-500 break-words">{(item as any).composition}</p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 sm:gap-2 flex-shrink-0">
                            {isLowStock && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-red-100 text-red-800 rounded font-semibold whitespace-nowrap">
                                ⚠️ Low
                              </span>
                            )}
                            {expiryStatus === "expired" && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-red-600 text-white rounded font-bold whitespace-nowrap">
                                ❌ EXP
                              </span>
                            )}
                            {expiryStatus === "critical" && daysUntilExpiry !== null && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-orange-600 text-white rounded font-bold whitespace-nowrap">
                                ⚠️ {daysUntilExpiry}d
                              </span>
                            )}
                            {expiryStatus === "warning" && daysUntilExpiry !== null && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-yellow-500 text-white rounded font-semibold whitespace-nowrap">
                                ⏰ {daysUntilExpiry}d
                              </span>
                            )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden sm:table-cell whitespace-nowrap">
                          {(() => {
                            const category = (item as any).category || "MEDICINE";
                            const categoryMap: Record<string, { icon: string; label: string }> = {
                              MEDICINE: { icon: "💊", label: "Medicines" },
                              MEDICAL_EQUIPMENT: { icon: "🩺", label: "Medical Equipment" },
                              HEALTH_SUPPLEMENT: { icon: "💊", label: "Health Supplements" },
                              PERSONAL_CARE: { icon: "🧴", label: "Personal Care" },
                            };
                            const cat = categoryMap[category] || categoryMap.MEDICINE;
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                                {cat.icon} {cat.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden md:table-cell text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                          {(item as any).brandName || "Generic"}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 0;
                                handleUpdateQuantity(item, newQty);
                              }}
                              className="w-16 sm:w-20 px-1.5 sm:px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                              min="0"
                            />
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden md:table-cell text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                          {minStock !== undefined && minStock !== null ? minStock : "N/A"}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                          {item.expiryDate ? (
                            <div>
                              <div className={`text-xs sm:text-sm font-medium ${
                                expiryStatus === "expired" ? "text-red-700" :
                                expiryStatus === "critical" ? "text-orange-700" :
                                expiryStatus === "warning" ? "text-yellow-700" :
                                "text-gray-900"
                              }`}>
                                {new Date(item.expiryDate).toLocaleDateString()}
                              </div>
                              {daysUntilExpiry !== null && (
                                <div className={`text-[10px] sm:text-xs ${
                                  expiryStatus === "expired" ? "text-red-600" :
                                  expiryStatus === "critical" ? "text-orange-600" :
                                  expiryStatus === "warning" ? "text-yellow-600" :
                                  "text-gray-500"
                                }`}>
                                  {expiryStatus === "expired" 
                                    ? `Exp ${Math.abs(daysUntilExpiry)}d ago`
                                    : `${daysUntilExpiry}d left`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden sm:table-cell text-xs sm:text-sm text-gray-600 whitespace-nowrap">{item.batchNumber || "N/A"}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden lg:table-cell text-xs sm:text-sm text-gray-600">
                          <div className="min-w-0">
                            {(item as any).purchasePrice && (
                              <p className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">Cost: ₹{(item as any).purchasePrice.toFixed(2)}</p>
                            )}
                            {sellingPrice !== undefined && sellingPrice !== null ? (
                              <p className="text-xs sm:text-sm font-medium whitespace-nowrap">Sell: ₹{sellingPrice.toFixed(2)}</p>
                            ) : (
                              <span className="text-xs sm:text-sm whitespace-nowrap">N/A</span>
                            )}
                            {(item as any).margin !== undefined && (
                              <p className="text-[10px] sm:text-xs text-green-600 whitespace-nowrap">Margin: {(item as any).margin.toFixed(1)}%</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden xl:table-cell whitespace-nowrap">
                          {(item as any).rackNumber || (item as any).rowNumber ? (
                            <div className="flex items-center gap-1 text-xs sm:text-sm">
                              <span className="text-blue-600 font-semibold">
                                📍 {(item as any).rackNumber || ""}
                                {(item as any).rackNumber && (item as any).rowNumber ? "-" : ""}
                                {(item as any).rowNumber || ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-400">Not set</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium whitespace-nowrap">
                          <div className="flex gap-1 sm:gap-2 flex-wrap">
                            {isLowStock && item.distributorId && (
                              <button
                                onClick={() => {
                                  setOrderItem(item);
                                  setOrderQuantity("");
                                  setShowOrderModal(true);
                                }}
                                className="text-green-600 hover:text-green-900 font-medium text-xs sm:text-sm"
                                title="Order from distributor"
                              >
                                📦 Order
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-600 hover:text-blue-900 text-xs sm:text-sm"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item._id)}
                              className="text-red-600 hover:text-red-900 text-xs sm:text-sm"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Stock Modal */}
        {showAddModal && addModalCategory && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => { setShowAddModal(false); setAddModalCategory(null); resetForm(); setShowCategoryDropdown(false); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {addModalCategory === "MEDICINE" && "💊 Add Medicine"}
                  {addModalCategory === "MEDICAL_EQUIPMENT" && "🩺 Add Medical Equipment"}
                  {addModalCategory === "HEALTH_SUPPLEMENT" && "💊 Add Health Supplement"}
                  {addModalCategory === "PERSONAL_CARE" && "🧴 Add Personal Care"}
                </h2>
                <button
                  onClick={() => { setShowAddModal(false); setAddModalCategory(null); resetForm(); setShowCategoryDropdown(false); }}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleAddStock} className="space-y-4">
                {/* Product Name Field - Label changes based on category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {addModalCategory === "MEDICINE" && "Medicine Name *"}
                    {addModalCategory === "MEDICAL_EQUIPMENT" && "Equipment Name *"}
                    {addModalCategory === "HEALTH_SUPPLEMENT" && "Supplement Name *"}
                    {addModalCategory === "PERSONAL_CARE" && "Product Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.medicineName}
                    onChange={(e) => setFormData({ ...formData, medicineName: e.target.value })}
                    placeholder={
                      addModalCategory === "MEDICINE" ? "e.g., Paracetamol, Aspirin"
                      : addModalCategory === "MEDICAL_EQUIPMENT" ? "e.g., Digital Thermometer, BP Monitor"
                      : addModalCategory === "HEALTH_SUPPLEMENT" ? "e.g., Vitamin D, Calcium"
                      : "e.g., Shampoo, Soap, Toothpaste"
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                
                {/* Composition/Type Field - Label and placeholder change based on category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {addModalCategory === "MEDICINE" && "Composition *"}
                      {addModalCategory === "MEDICAL_EQUIPMENT" && "Model/Type"}
                      {addModalCategory === "HEALTH_SUPPLEMENT" && "Composition/Ingredients *"}
                      {addModalCategory === "PERSONAL_CARE" && "Type/Category"}
                    </label>
                    <input
                      type="text"
                      required={addModalCategory === "MEDICINE" || addModalCategory === "HEALTH_SUPPLEMENT"}
                      value={formData.composition}
                      onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                      placeholder={
                        addModalCategory === "MEDICINE" ? "e.g., Paracetamol 500mg"
                        : addModalCategory === "MEDICAL_EQUIPMENT" ? "e.g., Digital, Manual"
                        : addModalCategory === "HEALTH_SUPPLEMENT" ? "e.g., Calcium 1000mg, Vitamin D3"
                        : "e.g., Shampoo, Soap, Cream"
                      }
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Brand Name</label>
                    <input
                      type="text"
                      value={formData.brandName}
                      onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                      placeholder={
                        addModalCategory === "MEDICINE" ? "e.g., Crocin, Calpol"
                        : addModalCategory === "MEDICAL_EQUIPMENT" ? "e.g., Omron, Dr Morepen"
                        : addModalCategory === "HEALTH_SUPPLEMENT" ? "e.g., HealthKart, MuscleBlaze"
                        : "e.g., Dove, Colgate, Himalaya"
                      }
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Min Stock Level *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.minStockLevel}
                      onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                {/* Expiry Date - Required for Medicine, Supplement, Personal Care; Optional for Equipment */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {addModalCategory === "MEDICAL_EQUIPMENT" && "Warranty/Expiry Date"}
                    {(addModalCategory === "MEDICINE" || addModalCategory === "HEALTH_SUPPLEMENT" || addModalCategory === "PERSONAL_CARE") && "Expiry Date *"}
                  </label>
                  <input
                    type="date"
                    required={addModalCategory === "MEDICINE" || addModalCategory === "HEALTH_SUPPLEMENT" || addModalCategory === "PERSONAL_CARE"}
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                
                {/* Batch/Serial Number - Required for Medicine, Supplement, Personal Care; Optional for Equipment */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {addModalCategory === "MEDICAL_EQUIPMENT" && "Serial/Batch Number"}
                    {(addModalCategory === "MEDICINE" || addModalCategory === "HEALTH_SUPPLEMENT" || addModalCategory === "PERSONAL_CARE") && "Batch Number *"}
                  </label>
                  <input
                    type="text"
                    required={addModalCategory === "MEDICINE" || addModalCategory === "HEALTH_SUPPLEMENT" || addModalCategory === "PERSONAL_CARE"}
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    placeholder={
                      addModalCategory === "MEDICAL_EQUIPMENT" ? "e.g., SN123456 or Batch ABC123"
                      : "e.g., BATCH001, LOT2024"
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Purchase Price (Cost) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Selling Price *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">MRP</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    placeholder="Max Retail Price"
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Rack Number</label>
                    <input
                      type="text"
                      value={formData.rackNumber}
                      onChange={(e) => setFormData({ ...formData, rackNumber: e.target.value })}
                      placeholder="e.g., A, B, Rack-1"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Row/Shelf Number</label>
                    <input
                      type="text"
                      value={formData.rowNumber}
                      onChange={(e) => setFormData({ ...formData, rowNumber: e.target.value })}
                      placeholder="e.g., 1, 2, Top"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>

                {/* Category Badge (read-only) */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {addModalCategory === "MEDICINE" && "💊"}
                      {addModalCategory === "MEDICAL_EQUIPMENT" && "🩺"}
                      {addModalCategory === "HEALTH_SUPPLEMENT" && "💊"}
                      {addModalCategory === "PERSONAL_CARE" && "🧴"}
                    </span>
                    <div>
                      <p className="font-semibold text-blue-900">
                        {addModalCategory === "MEDICINE" && "Medicines"}
                        {addModalCategory === "MEDICAL_EQUIPMENT" && "Medical Equipment"}
                        {addModalCategory === "HEALTH_SUPPLEMENT" && "Health Supplements"}
                        {addModalCategory === "PERSONAL_CARE" && "Personal Care"}
                      </p>
                      <p className="text-xs text-blue-700">
                        {addModalCategory === "MEDICINE" && "Prescription and over-the-counter medicines"}
                        {addModalCategory === "MEDICAL_EQUIPMENT" && "Medical devices and equipment"}
                        {addModalCategory === "HEALTH_SUPPLEMENT" && "Vitamins and health supplements"}
                        {addModalCategory === "PERSONAL_CARE" && "Personal hygiene and care products"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prescription Required (only for MEDICINE) */}
                {addModalCategory === "MEDICINE" && (
                  <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.prescriptionRequired}
                        onChange={(e) => setFormData({ ...formData, prescriptionRequired: e.target.checked })}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-gray-700">Requires Prescription</span>
                    </label>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder={
                      addModalCategory === "MEDICINE" ? "Enter medicine description, usage instructions, etc."
                      : addModalCategory === "MEDICAL_EQUIPMENT" ? "Enter equipment specifications, features, usage instructions, etc."
                      : addModalCategory === "HEALTH_SUPPLEMENT" ? "Enter supplement details, benefits, dosage instructions, etc."
                      : "Enter product details, benefits, usage instructions, etc."
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Add Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setAddModalCategory(null);
                      resetForm();
                      setShowCategoryDropdown(false);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedItem && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowEditModal(false); setSelectedItem(null); resetForm(); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Stock Item</h2>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Medicine Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.medicineName}
                    onChange={(e) => setFormData({ ...formData, medicineName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Composition *</label>
                    <input
                      type="text"
                      required
                      value={formData.composition}
                      onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                      placeholder="e.g., Paracetamol 500mg"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Brand Name</label>
                    <input
                      type="text"
                      value={formData.brandName}
                      onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                      placeholder="e.g., Crocin"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Min Stock Level *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.minStockLevel}
                      onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                  <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Batch Number *</label>
                    <input
                      type="text"
                    required
                      value={formData.batchNumber}
                      onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Purchase Price (Cost) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Selling Price *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">MRP</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.mrp}
                      onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                      placeholder="Max Retail Price"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Rack Number</label>
                    <input
                      type="text"
                      value={formData.rackNumber}
                      onChange={(e) => setFormData({ ...formData, rackNumber: e.target.value })}
                      placeholder="e.g., A, B, Rack-1"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Row/Shelf Number</label>
                    <input
                      type="text"
                      value={formData.rowNumber}
                      onChange={(e) => setFormData({ ...formData, rowNumber: e.target.value })}
                      placeholder="e.g., 1, 2, Top"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category * <span className="text-xs font-normal text-gray-500">(This will show in Patient Medical Store)</span>
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    >
                      <option value="MEDICINE">💊 Medicines - Prescription and over-the-counter medicines</option>
                      <option value="MEDICAL_EQUIPMENT">🩺 Medical Equipment - Medical devices and equipment</option>
                      <option value="HEALTH_SUPPLEMENT">💊 Health Supplements - Vitamins and health supplements</option>
                      <option value="PERSONAL_CARE">🧴 Personal Care - Personal hygiene and care products</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Prescription Required</label>
                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={formData.prescriptionRequired}
                        onChange={(e) => setFormData({ ...formData, prescriptionRequired: e.target.checked })}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Requires prescription</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="Product description..."
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-700">Supplier / Distributor</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.supplierType === "distributor") {
                          setFormData({ ...formData, supplierType: "custom", distributorId: "", supplier: "" });
                        } else {
                          setFormData({ ...formData, supplierType: "distributor", supplier: "" });
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {formData.supplierType === "distributor" ? "➕ Add Custom Supplier" : "📋 Select Distributor"}
                    </button>
                  </div>
                  
                  {formData.supplierType === "distributor" ? (
                    <select
                      value={formData.distributorId}
                      onChange={(e) => {
                        const selectedDist = distributors.find(d => d._id === e.target.value);
                        setFormData({ 
                          ...formData, 
                          distributorId: e.target.value,
                          supplier: selectedDist?.name || ""
                        });
                      }}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    >
                      <option value="">Select Distributor</option>
                      {distributors.map((distributor) => (
                        <option key={distributor._id} value={distributor._id}>
                          {distributor.name} {distributor.address ? `- ${distributor.address}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Enter supplier name..."
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.supplierType === "distributor" 
                      ? "Choose distributor to order from in future" 
                      : "Enter custom supplier name"}
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Update Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedItem(null);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Expiry Alert Modal */}
        {showExpiryModal && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowExpiryModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Expiring Soon Items (Next 30 Days)</h2>
              {getExpiringItems().length === 0 ? (
                <p className="text-gray-500 text-center py-8">No items expiring in the next 30 days</p>
              ) : (
                <div className="space-y-2">
                  {getExpiringItems().map((item) => {
                    const daysUntilExpiry = Math.ceil(
                      (new Date(item.expiryDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div key={item._id} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-900">{item.medicineName}</p>
                            <p className="text-sm text-gray-600">
                              Expires: {new Date(item.expiryDate!).toLocaleDateString()} ({daysUntilExpiry} days)
                            </p>
                            {item.batchNumber && (
                              <p className="text-xs text-gray-500">Batch: {item.batchNumber}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">Qty: {item.quantity}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => setShowExpiryModal(false)}
                className="mt-6 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
        {/* Order Medicine Modal */}
        {showOrderModal && orderItem && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowOrderModal(false); setOrderItem(null); setOrderQuantity(""); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">📦 Order Medicine</h2>
                  <p className="text-sm text-gray-500 mt-1">Place order to distributor</p>
                </div>
                <button
                  onClick={() => {
                    setShowOrderModal(false);
                    setOrderItem(null);
                    setOrderQuantity("");
                  }}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Medicine</p>
                    <p className="text-lg font-bold text-gray-900">{orderItem.medicineName}</p>
                  </div>
                  {orderItem.supplier && (
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Supplier</p>
                      <p className="text-sm font-semibold text-blue-600">{orderItem.supplier}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-blue-200">
                  <div>
                    <p className="text-xs text-gray-600">Current Stock</p>
                    <p className="text-xl font-bold text-red-600">{orderItem.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Min Level</p>
                    <p className="text-xl font-bold text-gray-700">
                      {(orderItem as any).threshold !== undefined ? (orderItem as any).threshold : orderItem.minStockLevel}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleOrderMedicine} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quantity to Order <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    placeholder="Enter quantity to order"
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none text-lg font-medium transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span>💡</span>
                    <span>Order will be sent directly to the distributor for processing</span>
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOrderModal(false);
                      setOrderItem(null);
                      setOrderQuantity("");
                    }}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg hover:from-green-700 hover:to-blue-700 transition-all transform hover:scale-105"
                  >
                    📦 Place Order
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

