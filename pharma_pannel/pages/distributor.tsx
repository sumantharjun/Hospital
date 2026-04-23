import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getSocket, onSocketEvent, offSocketEvent } from "@/services/socket";
import Layout from "@/components/Layout";
import { distributorOrdersApi, inventoryApi, distributorsApi, getAuthHeaders } from "@/services/api";
import { getUser } from "@/utils/auth";
import { DistributorOrder, DistributorOrderStatus } from "@/types";
import { DISTRIBUTOR_ORDER_STATUSES, API_BASE } from "@/utils/constants";

interface OrderItem {
  medicineName: string;
  category: "MEDICINE" | "MEDICAL_EQUIPMENT" | "HEALTH_SUPPLEMENT" | "PERSONAL_CARE";
  quantity: number;
  description?: string;
}

type TabType = "new-order" | "orders";

export default function DistributorPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>("new-order");
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>("");
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loadingDistributors, setLoadingDistributors] = useState(false);
  
  // New Order state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [currentItem, setCurrentItem] = useState<OrderItem>({
    medicineName: "",
    category: "MEDICINE",
    quantity: 1,
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Orders state
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<DistributorOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DistributorOrderStatus | "all">("all");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderCategoryFilter, setOrderCategoryFilter] = useState<"ALL" | "MEDICINE" | "MEDICAL_EQUIPMENT" | "HEALTH_SUPPLEMENT" | "PERSONAL_CARE">("ALL");

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);

    // Socket is already initialized in _app.tsx, just listen to events
    const socket = getSocket();
    if (socket && currentUser.pharmacyId) {
      const handleOrderCreated = (data: any) => {
        if (data.pharmacyId === currentUser.pharmacyId && currentUser.pharmacyId) {
          toast.success("📦 Order placed to distributor!");
          if (activeTab === "orders") {
            loadDistributorOrders(currentUser.pharmacyId);
          }
        }
      };

      const handleStatusUpdated = (data: any) => {
        if (data.pharmacyId === currentUser.pharmacyId && currentUser.pharmacyId) {
          loadDistributorOrders(currentUser.pharmacyId);
        }
      };

      onSocketEvent("distributorOrder:created", handleOrderCreated);
      onSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);

      return () => {
        offSocketEvent("distributorOrder:created", handleOrderCreated);
        offSocketEvent("distributorOrder:statusUpdated", handleStatusUpdated);
      };
    }

    // Load initial data
    if (currentUser.pharmacyId) {
      loadDistributors();
      loadDistributorId(currentUser.pharmacyId, currentUser);
      if (activeTab === "orders") {
        loadDistributorOrders(currentUser.pharmacyId);
      }
    }
  }, [router]);

  // Reload when tab changes
  useEffect(() => {
    if (user?.pharmacyId && activeTab === "orders") {
      loadDistributorOrders(user.pharmacyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.pharmacyId]);

  const loadDistributors = async () => {
    setLoadingDistributors(true);
    try {
      const data = await distributorsApi.getAll();
      const distributorsList = Array.isArray(data) ? data : [];
      setDistributors(distributorsList);
      
      // Auto-select default distributor if only one is available
      if (distributorsList.length === 1) {
        setSelectedDistributorId(distributorsList[0]._id);
      } else if (distributorsList.length > 1 && !selectedDistributorId) {
        // If default distributor exists, select it
        loadDistributorId(user?.pharmacyId || "", user);
      }
    } catch (error: any) {
      console.error("Error loading distributors:", error);
      toast.error(error.message || "Failed to load distributors");
    } finally {
      setLoadingDistributors(false);
    }
  };

  const loadDistributorId = async (pharmacyId: string, currentUser?: any): Promise<string | null> => {
    try {
      const userToCheck = currentUser || user;
      if (userToCheck?.distributorId) {
        setSelectedDistributorId(userToCheck.distributorId);
        return userToCheck.distributorId;
      }

      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = {
        ...(authHeaders.Authorization && { Authorization: authHeaders.Authorization }),
      };

      const response = await fetch(`${API_BASE}/api/master/pharmacies/${pharmacyId}`, { headers });
      if (response.ok) {
        const pharmacy = await response.json();
        if (pharmacy.distributorId) {
          setSelectedDistributorId(pharmacy.distributorId);
          return pharmacy.distributorId;
        }
      }

      return null;
    } catch (error) {
      console.error("Error loading distributor ID:", error);
      return null;
    }
  };

  const loadDistributorOrders = async (pharmacyId: string) => {
    setOrdersLoading(true);
    try {
      console.log("Loading orders for pharmacyId:", pharmacyId);
      const data = await distributorOrdersApi.getAll(pharmacyId);
      console.log("Orders fetched:", data);
      const ordersArray = Array.isArray(data) ? data : [];
      setOrders(ordersArray);
      
      if (ordersArray.length === 0) {
        console.warn("No orders found for pharmacyId:", pharmacyId);
      }
    } catch (error: any) {
      console.error("Error loading distributor orders:", error);
      toast.error(error.message || "Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...orders];
    
    // Filter by category
    if (orderCategoryFilter !== "ALL") {
      filtered = filtered.filter((order) => {
        const orderCategory = order.category || "MEDICINE";
        return orderCategory === orderCategoryFilter;
      });
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }
    if (orderSearchTerm) {
      filtered = filtered.filter(
        (order) =>
          order._id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
          order.medicineName.toLowerCase().includes(orderSearchTerm.toLowerCase())
      );
    }
    setFilteredOrders(filtered);
  }, [orders, statusFilter, orderSearchTerm, orderCategoryFilter]);

  const addItemToOrder = () => {
    if (!currentItem.medicineName.trim()) {
      toast.error("Please enter medicine/item name");
      return;
    }
    if (currentItem.quantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    setOrderItems([...orderItems, { ...currentItem }]);
    setCurrentItem({
      medicineName: "",
      category: "MEDICINE",
      quantity: 1,
      description: "",
    });
    toast.success(`✅ ${currentItem.medicineName} added to order list`);
  };

  const removeItemFromOrder = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity < 1) {
      removeItemFromOrder(index);
      return;
    }
    setOrderItems(
      orderItems.map((item, i) => (i === index ? { ...item, quantity } : item))
    );
  };

  const placeOrder = async () => {
    if (!user?.pharmacyId) {
      toast.error("Pharmacy ID not found");
      return;
    }

    if (!selectedDistributorId) {
      toast.error("Please select a distributor");
      return;
    }

    if (orderItems.length === 0) {
      toast.error("Please add items to order");
      return;
    }

    setSubmitting(true);
    try {
      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(authHeaders.Authorization && { Authorization: authHeaders.Authorization }),
      };

      const selectedDistributor = distributors.find(d => d._id === selectedDistributorId);
      const distributorName = selectedDistributor?.name || "Distributor";

      const orderPayloads = orderItems.map((item) => ({
        pharmacyId: user.pharmacyId,
        distributorId: selectedDistributorId,
        medicineName: item.medicineName.trim(),
        category: item.category,
        quantity: item.quantity,
      }));

      console.log("Creating orders with payloads:", orderPayloads);

      const promises = orderPayloads.map((payload) =>
        fetch(`${API_BASE}/api/distributor-orders`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }).then(async (response) => {
          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Unknown error" }));
            throw new Error(error.message || `Failed to create order for ${payload.medicineName}`);
          }
          return response.json();
        })
      );

      const results = await Promise.all(promises);
      
      // Log created orders for debugging
      console.log("Orders created successfully:", results);
      console.log("Created orders have pharmacyId:", results.map((r: any) => r.pharmacyId));

      const socket = getSocket();
      if (socket) {
        socket.emit("distributorOrder:created", {
          pharmacyId: user.pharmacyId,
          distributorId: selectedDistributorId,
        });
      }

      toast.success(`✅ Successfully placed order for ${orderItems.length} item(s) to ${distributorName}!`);
      setOrderItems([]);
      setCurrentItem({
        medicineName: "",
        category: "MEDICINE",
        quantity: 1,
        description: "",
      });
      
      // Immediately switch to orders tab and reload
      setActiveTab("orders");
      // Load orders immediately and also after a short delay to ensure backend has processed
      if (user.pharmacyId) {
        loadDistributorOrders(user.pharmacyId);
        // Also reload after a short delay to catch any timing issues
        setTimeout(() => {
          loadDistributorOrders(user.pharmacyId);
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncStock = async (order: DistributorOrder) => {
    if (!user?.pharmacyId) return;

    try {
      const inventory = await inventoryApi.getAll(user.pharmacyId);
      const existingItem = Array.isArray(inventory)
        ? inventory.find((item) => item.medicineName === order.medicineName)
        : null;

      if (existingItem) {
        const newQuantity = existingItem.quantity + order.quantity;
        await inventoryApi.update(existingItem._id, { quantity: newQuantity });
        toast.success(`✅ Stock synced: Added ${order.quantity} units of ${order.medicineName}`);
      } else {
        // Create new inventory item with all required fields
        // Generate a batch number and expiry date for the new item
        const batchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Set expiry 1 year from now
        
        const inventoryPayload = {
          pharmacyId: user.pharmacyId,
          medicineName: order.medicineName,
          composition: order.medicineName, // Use medicine name as composition if not available
          category: order.category || "MEDICINE",
          quantity: order.quantity,
          minStockLevel: 10, // threshold - use minStockLevel for frontend compatibility
          batchNumber: batchNumber,
          expiryDate: expiryDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
          purchasePrice: 0, // Will need to be updated later
          sellingPrice: 0, // Will need to be updated later
        };
        
        console.log("📦 Creating new inventory item from order:");
        console.log("  - User pharmacyId:", user.pharmacyId);
        console.log("  - Order pharmacyId:", order.pharmacyId);
        console.log("  - Payload pharmacyId:", inventoryPayload.pharmacyId);
        console.log("  - Full payload:", JSON.stringify(inventoryPayload, null, 2));
        
        try {
          const createdItem = await inventoryApi.create(inventoryPayload);
          console.log("✅ Inventory item created successfully:", createdItem);
          toast.success(`✅ New stock added: ${order.quantity} units of ${order.medicineName}`);
          
          // Verify the item was created by fetching inventory again after a short delay
          setTimeout(async () => {
            try {
              const updatedInventory = await inventoryApi.getAll(user.pharmacyId);
              const foundItem = Array.isArray(updatedInventory)
                ? updatedInventory.find((item: any) => item.medicineName === order.medicineName)
                : null;
              if (foundItem) {
                console.log("✅ Verified: Item found in inventory:", foundItem);
              } else {
                console.error("❌ Item not found in inventory after creation!");
                console.log("Current inventory items:", updatedInventory);
                toast.error("Warning: Item created but not found. Please refresh the inventory page.");
              }
            } catch (error) {
              console.error("Error verifying inventory:", error);
            }
          }, 1500);
        } catch (createError: any) {
          console.error("❌ Error creating inventory item:", createError);
          toast.error(`Failed to create inventory item: ${createError.message || "Unknown error"}`);
          throw createError; // Re-throw to stop execution
        }
      }

      await distributorOrdersApi.update(order._id, { status: "DELIVERED" });

      const socket = getSocket();
      if (socket) {
        socket.emit("distributorOrder:statusUpdated", {
          orderId: order._id,
          status: "DELIVERED",
          pharmacyId: user.pharmacyId,
        });
      }

      // Reload distributor orders
      loadDistributorOrders(user.pharmacyId);
      
      // Reload inventory page if it's open (using custom event)
      // Dispatch with detail first, then also dispatch without detail as fallback
      console.log("📢 Dispatching inventoryUpdated event for pharmacy:", user.pharmacyId);
      window.dispatchEvent(new CustomEvent('inventoryUpdated', { detail: { pharmacyId: user.pharmacyId } }));
      // Also dispatch a general event after a delay to ensure backend has saved
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('inventoryUpdated'));
      }, 2000);
    } catch (error: any) {
      console.error("Error syncing stock:", error);
      toast.error(error.message || "Failed to sync stock");
    }
  };

  const handleDeleteOrder = async (order: DistributorOrder) => {
    // Only allow deleting PENDING or CANCELLED orders
    if (order.status !== "PENDING" && order.status !== "CANCELLED") {
      toast.error(`Cannot delete order with status: ${order.status}. Only PENDING or CANCELLED orders can be deleted.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete this order?\n\nOrder: ${order.medicineName}\nQuantity: ${order.quantity}\nStatus: ${order.status}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = {
        ...(authHeaders.Authorization && { Authorization: authHeaders.Authorization }),
      };

      const response = await fetch(`${API_BASE}/api/distributor-orders/${order._id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete order");
      }

      toast.success(`✅ Order deleted successfully`);
      loadDistributorOrders(user.pharmacyId!);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete order");
    }
  };

  const getStatusColor = (status: DistributorOrderStatus) => {
    return DISTRIBUTOR_ORDER_STATUSES[status]?.color || "bg-gray-100 text-gray-800";
  };

  if (!user) return null;

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "PENDING").length,
    dispatched: orders.filter((o) => o.status === "DISPATCHED").length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
  };

  return (
    <Layout user={user} currentPage="distributor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Order from Distributor</h1>
            <p className="text-gray-600">Order medicines or medical items to update your inventory. Add items below and send order to distributor.</p>
          </div>
          <button
            onClick={() => {
              if (user?.pharmacyId) {
                loadDistributorOrders(user.pharmacyId);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <span>🔄</span> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-1">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("new-order")}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === "new-order"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-transparent text-gray-700 hover:bg-gray-100"
              }`}
            >
              ➕ New Order
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all relative ${
                activeTab === "orders"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-transparent text-gray-700 hover:bg-gray-100"
              }`}
            >
              📦 My Orders
              {stats.pending > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {stats.pending}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* New Order Tab */}
        {activeTab === "new-order" && (
          <div className="space-y-6">
            {/* Distributor Selection Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Select Distributor</h2>
              
              {loadingDistributors ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : distributors.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 font-semibold">⚠️ No Distributors Available</p>
                  <p className="text-yellow-700 text-sm mt-1">Please contact admin to add distributors to the system.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Choose Distributor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedDistributorId}
                    onChange={(e) => setSelectedDistributorId(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-lg"
                    required
                  >
                    <option value="">-- Select Distributor --</option>
                    {distributors.map((distributor) => (
                      <option key={distributor._id} value={distributor._id}>
                        {distributor.name} {distributor.address ? `- ${distributor.address}` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedDistributorId && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      {(() => {
                        const selectedDist = distributors.find(d => d._id === selectedDistributorId);
                        return (
                          <div>
                            <p className="text-sm font-semibold text-blue-900">
                              📦 Selected: {selectedDist?.name || "Distributor"}
                            </p>
                            {selectedDist?.phone && (
                              <p className="text-xs text-blue-700 mt-1">Phone: {selectedDist.phone}</p>
                            )}
                            {selectedDist?.email && (
                              <p className="text-xs text-blue-700">Email: {selectedDist.email}</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Order Form Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Add Items to Order</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Medicine/Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentItem.medicineName}
                    onChange={(e) => setCurrentItem({ ...currentItem, medicineName: e.target.value })}
                    placeholder="e.g., Paracetamol 500mg, Digital Thermometer"
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addItemToOrder();
                      }
                    }}
                  />
                </div>
                
                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currentItem.category}
                    onChange={(e) => setCurrentItem({ ...currentItem, category: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    <option value="MEDICINE">💊 Medicine</option>
                    <option value="MEDICAL_EQUIPMENT">🩺 Medical Equipment</option>
                    <option value="HEALTH_SUPPLEMENT">💊 Health Supplement</option>
                    <option value="PERSONAL_CARE">🧴 Personal Care</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={currentItem.quantity}
                    onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                
                <div className="md:col-span-3">
                  <button
                    onClick={addItemToOrder}
                    className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    ➕ Add to Order
                  </button>
                </div>
              </div>

              {/* Note */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>Tip:</strong> You can order any medicine or medical item, even if it's not in stock with distributor. 
                  Just select distributor, enter the name, select category, and quantity. Distributor will source it for you.
                </p>
              </div>
            </div>

            {/* Order Items List */}
            {orderItems.length > 0 && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    Order Items ({orderItems.length})
                  </h2>
                  <button
                    onClick={() => setOrderItems([])}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all"
                  >
                    Clear All
                  </button>
                </div>
                
                <div className="space-y-3">
                  {orderItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-lg">
                            {item.category === "MEDICINE" && "💊"}
                            {item.category === "MEDICAL_EQUIPMENT" && "🩺"}
                            {item.category === "HEALTH_SUPPLEMENT" && "💊"}
                            {item.category === "PERSONAL_CARE" && "🧴"}
                          </span>
                          <h3 className="font-bold text-gray-900">{item.medicineName}</h3>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                            {item.category.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateItemQuantity(index, item.quantity - 1)}
                            className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateItemQuantity(index, item.quantity + 1)}
                            className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeItemFromOrder(index)}
                          className="px-3 py-1 text-red-600 hover:bg-red-50 rounded font-medium transition-all"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Place Order Button */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Items: <span className="font-bold text-gray-900">{orderItems.length}</span></p>
                      <p className="text-sm text-gray-600 mt-1">
                        Total Quantity: <span className="font-bold text-gray-900">
                          {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={placeOrder}
                      disabled={submitting || !selectedDistributorId}
                      className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${
                        submitting || !selectedDistributorId
                          ? "bg-gray-400 text-white cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg"
                      }`}
                    >
                      {submitting ? "⏳ Placing Order..." : "📤 Send Order to Distributor"}
                    </button>
                  </div>
                  {!selectedDistributorId && (
                    <p className="text-red-600 text-sm mt-2">⚠️ Please select a distributor first.</p>
                  )}
                </div>
              </div>
            )}

            {/* Empty State */}
            {orderItems.length === 0 && (
              <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-gray-500 text-lg mb-2">No items added to order yet</p>
                <p className="text-gray-400 text-sm">Add items above to create an order</p>
                {!selectedDistributorId && (
                  <p className="text-red-500 text-sm mt-4 font-semibold">⚠️ Don't forget to select a distributor first!</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-100 text-sm font-medium">Total Orders</span>
                  <span className="text-3xl">📤</span>
                </div>
                <p className="text-4xl font-bold">{stats.total}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-100 text-sm font-medium">Waiting Response</span>
                  <span className="text-3xl">⏳</span>
                </div>
                <p className="text-4xl font-bold">{stats.pending}</p>
                <p className="text-xs text-orange-100 mt-1">Distributor received, preparing...</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-cyan-100 text-sm font-medium">Distributor Sent</span>
                  <span className="text-3xl">🚚</span>
                </div>
                <p className="text-4xl font-bold">{stats.dispatched}</p>
                <p className="text-xs text-cyan-100 mt-1">Waiting for you to receive</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-100 text-sm font-medium">Completed</span>
                  <span className="text-3xl">✅</span>
                </div>
                <p className="text-4xl font-bold">{stats.delivered}</p>
                <p className="text-xs text-green-100 mt-1">Added to inventory</p>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="🔍 Search by order ID or medicine name..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      statusFilter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    All
                  </button>
                  {Object.keys(DISTRIBUTOR_ORDER_STATUSES).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status as DistributorOrderStatus)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                        statusFilter === status
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {DISTRIBUTOR_ORDER_STATUSES[status].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Orders List */}
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-gray-500 text-lg mb-2">No orders sent to distributor yet</p>
                <p className="text-gray-400 text-sm mb-4">Create a new order from the "New Order" tab</p>
                <button
                  onClick={() => setActiveTab("new-order")}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
                >
                  Create New Order
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredOrders.map((order) => (
                  <motion.div
                    key={order._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl shadow-lg border-2 border-gray-200 hover:border-blue-300 transition-all overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b-2 border-blue-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Order #{order._id.slice(-8).toUpperCase()}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Date not available"}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                          {DISTRIBUTOR_ORDER_STATUSES[order.status]?.label || order.status}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {order.category && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                              {(() => {
                                const categoryMap: Record<string, string> = {
                                  MEDICINE: "💊",
                                  MEDICAL_EQUIPMENT: "🩺",
                                  HEALTH_SUPPLEMENT: "💊",
                                  PERSONAL_CARE: "🧴",
                                };
                                return categoryMap[order.category] || "📦";
                              })()}
                              {order.category.replace("_", " ")}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-semibold">Item:</span> {order.medicineName}
                        </p>
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-semibold">Quantity:</span> {order.quantity} units
                        </p>
                      </div>

                      {order.status === "PENDING" && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-800 font-semibold">📤 Status: Order Sent</p>
                          <p className="text-xs text-yellow-700 mt-1">Waiting for distributor to receive and accept your order</p>
                        </div>
                      )}

                      {order.status === "ACCEPTED" && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800 font-semibold">✅ Status: Distributor Accepted</p>
                          <p className="text-xs text-blue-700 mt-1">Distributor received your order. They are preparing items to send to you...</p>
                        </div>
                      )}

                      {order.status === "DISPATCHED" && (
                        <>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-sm text-green-800 font-semibold">🚚 Status: Distributor Sent</p>
                            <p className="text-xs text-green-700 mt-1">Distributor has sent the items. When you receive them, click below to add to your inventory.</p>
                          </div>
                          <button
                            onClick={() => handleSyncStock(order)}
                            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                          >
                            ✅ I Received - Add to My Inventory
                          </button>
                        </>
                      )}

                      {order.status === "DELIVERED" && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <p className="text-sm text-emerald-800 font-semibold">✅ Status: Completed</p>
                          <p className="text-xs text-emerald-700 mt-1">Items received and added to your inventory successfully!</p>
                        </div>
                      )}

                      {/* Delete Button - Only show for PENDING or CANCELLED orders */}
                      {(order.status === "PENDING" || order.status === "CANCELLED") && (
                        <div className="pt-3 border-t border-gray-200 mt-3">
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                          >
                            🗑️ Delete Order
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
