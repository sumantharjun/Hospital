import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Order, OrderItem, InventoryItem } from "@/types";
import { inventoryApi, ordersApi, distributorOrdersApi, getAuthHeaders } from "@/services/api";
import { API_BASE } from "@/utils/constants";

interface CheckoutItem extends OrderItem {
  available: boolean;
  availableQuantity: number;
  unitPrice: number;
  subtotal: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

interface OrderCheckoutProps {
  order: Order;
  onClose: () => void;
  onConfirm: () => void;
  pharmacyId: string;
  userDistributorId?: string;
}

export default function OrderCheckout({
  order,
  onClose,
  onConfirm,
  pharmacyId,
  userDistributorId,
}: OrderCheckoutProps) {
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [deliveryCharge, setDeliveryCharge] = useState(order.deliveryCharge || 0);

  useEffect(() => {
    loadInventoryAndCheckStock();
  }, []);

  const loadInventoryAndCheckStock = async () => {
    try {
      setLoading(true);
      const inventoryData = await inventoryApi.getAll(pharmacyId);
      const inventoryList = Array.isArray(inventoryData) ? inventoryData : [];
      setInventory(inventoryList);

      // Debug logging
      console.log("📋 OrderCheckout - Inventory loaded:", inventoryList.length, "items");
      console.log("📋 OrderCheckout - Order items:", order.items);
      if (inventoryList.length > 0) {
        console.log("📋 OrderCheckout - Sample inventory items:", inventoryList.slice(0, 3).map((item: any) => ({
          medicineName: item.medicineName,
          quantity: item.quantity,
          pharmacyId: item.pharmacyId
        })));
      }

      // Calculate prices - use order's totalAmount if available to maintain consistency
      const orderSubtotal = order.totalAmount ? (order.totalAmount - (order.deliveryCharge || 0)) : null;
      
      // Map order items to checkout items with stock status
      const checkoutItems: CheckoutItem[] = order.items.map((orderItem, index) => {
        // Normalize medicine names for comparison (trim and lowercase)
        const normalizedOrderName = orderItem.medicineName.trim().toLowerCase();
        
        // Find ALL matching inventory items (same medicine name, may have different batches/brands)
        const matchingItems = inventoryList.filter((inv) => {
          const normalizedInvName = (inv.medicineName || "").trim().toLowerCase();
          const matches = normalizedInvName === normalizedOrderName;
          if (matches) {
            console.log(`✅ Match found: "${inv.medicineName}" (qty: ${inv.quantity}) matches order item "${orderItem.medicineName}"`);
          }
          return matches;
        });

        // Sum up quantities from all matching items
        const availableQuantity = matchingItems.reduce((sum, item) => {
          const qty = item.quantity || 0;
          console.log(`  Adding quantity: ${qty} from item "${item.medicineName}"`);
          return sum + qty;
        }, 0);
        
        console.log(`📊 Order item "${orderItem.medicineName}": Found ${matchingItems.length} matching inventory items, Total available: ${availableQuantity}`);
        
        // Calculate unit price: use order's totalAmount if available, otherwise use inventory price
        let unitPrice: number;
        let subtotal: number;
        
        if (orderSubtotal !== null && orderSubtotal > 0) {
          // Use order's totalAmount to calculate prices proportionally
          const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
          const itemProportion = orderItem.quantity / totalQuantity;
          subtotal = orderSubtotal * itemProportion;
          unitPrice = subtotal / orderItem.quantity;
        } else {
          // Fall back to inventory price
          const firstItem = matchingItems[0];
          unitPrice = firstItem?.unitPrice || firstItem?.sellingPrice || firstItem?.mrp || firstItem?.price || 50;
          subtotal = orderItem.quantity * unitPrice;
        }
        
        const available = availableQuantity >= orderItem.quantity;
        const status =
          availableQuantity === 0
            ? "out_of_stock"
            : availableQuantity < orderItem.quantity
            ? "low_stock"
            : "in_stock";

        return {
          ...orderItem,
          available,
          availableQuantity,
          unitPrice,
          subtotal,
          status,
        };
      });

      console.log("📋 OrderCheckout - Final checkout items:", checkoutItems);
      setItems(checkoutItems);
    } catch (error: any) {
      console.error("❌ OrderCheckout - Error loading inventory:", error);
      toast.error("Failed to load inventory: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    const updatedItems = [...items];
    const item = updatedItems[index];
    
    // Check if new quantity exceeds available stock
    if (newQuantity > item.availableQuantity) {
      toast.error(`Only ${item.availableQuantity} units available for ${item.medicineName}`);
      return;
    }

    item.quantity = newQuantity;
    item.subtotal = newQuantity * item.unitPrice;
    item.available = item.availableQuantity >= newQuantity;
    item.status =
      item.availableQuantity === 0
        ? "out_of_stock"
        : item.availableQuantity < newQuantity
        ? "low_stock"
        : "in_stock";

    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast.error("Order must have at least one item");
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleOrderFromDistributor = async (item: CheckoutItem) => {
    if (!userDistributorId) {
      toast.error("Distributor ID not configured");
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      // Find inventory item to get category
      const inventoryItem = inventory.find(
        (inv) => inv.medicineName.toLowerCase() === item.medicineName.toLowerCase()
      );

      const response = await fetch(`${API_BASE}/api/distributor-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeaders.Authorization && { Authorization: authHeaders.Authorization }),
        },
        body: JSON.stringify({
          pharmacyId,
          distributorId: userDistributorId,
          medicineName: item.medicineName,
          category: (inventoryItem as any)?.category || "MEDICINE",
          quantity: item.quantity - item.availableQuantity, // Order the shortage
        }),
      });

      if (response.ok) {
        toast.success(`Order placed to distributor for ${item.medicineName}`);
        // Reload inventory after a delay
        setTimeout(() => {
          loadInventoryAndCheckStock();
        }, 1000);
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.message || "Failed to place order to distributor");
      }
    } catch (error: any) {
      toast.error("Failed to place order to distributor: " + error.message);
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = (subtotal * discount) / 100;
    const subtotalAfterDiscount = subtotal - discountAmount;
    const taxAmount = (subtotalAfterDiscount * tax) / 100;
    const total = subtotalAfterDiscount + taxAmount + deliveryCharge;

    return {
      subtotal,
      discountAmount,
      subtotalAfterDiscount,
      taxAmount,
      total,
    };
  };

  const handleConfirmOrder = async () => {
    // Check if all items are available
    const hasOutOfStock = items.some((item) => item.status === "out_of_stock");
    const hasLowStock = items.some((item) => item.status === "low_stock" && item.quantity > item.availableQuantity);
    
    // If items are out of stock, require ordering from distributor first
    if (hasOutOfStock) {
      const outOfStockItems = items.filter((item) => item.status === "out_of_stock");
      const itemNames = outOfStockItems.map((item) => item.medicineName).join(", ");
      
      const proceed = window.confirm(
        `⚠️ The following medicines are OUT OF STOCK:\n\n${itemNames}\n\n` +
        `You must order these from the distributor first before accepting this order.\n\n` +
        `Would you like to:\n` +
        `1. Order from distributor now (click OK)\n` +
        `2. Cancel and check inventory (click Cancel)`
      );
      
      if (!proceed) {
        toast.error("Please order unavailable medicines from distributor first");
        return;
      }
      
      // Order all out of stock items from distributor
      let allOrdered = true;
      for (const item of outOfStockItems) {
        if (userDistributorId) {
          try {
            await handleOrderFromDistributor(item);
          } catch (error) {
            allOrdered = false;
            toast.error(`Failed to order ${item.medicineName} from distributor`);
          }
        } else {
          allOrdered = false;
          toast.error("Distributor ID not configured. Cannot order medicines.");
        }
      }
      
      if (!allOrdered) {
        toast.error("Some medicines could not be ordered. Please try again or contact distributor.");
        return;
      }
      
      toast.success("Medicines ordered from distributor. Please wait for delivery before accepting order.");
      // Reload inventory to check updated stock
      setTimeout(() => {
        loadInventoryAndCheckStock();
      }, 2000);
      return;
    }
    
    // If low stock, warn but allow proceeding
    if (hasLowStock) {
      const lowStockItems = items.filter((item) => item.status === "low_stock" && item.quantity > item.availableQuantity);
      const itemNames = lowStockItems.map((item) => `${item.medicineName} (need ${item.quantity}, have ${item.availableQuantity})`).join(", ");
      
      const proceed = window.confirm(
        `⚠️ Some medicines have LOW STOCK:\n\n${itemNames}\n\n` +
        `You may need to order more from distributor. Do you want to proceed with accepting this order?`
      );
      
      if (!proceed) {
        return;
      }
    }

    setProcessing(true);
    try {
      const totals = calculateTotals();

      // Update order status - preserve original totalAmount to maintain price consistency
      await ordersApi.updateStatus(order._id, {
        status: "ACCEPTED",
        totalAmount: order.totalAmount || totals.total, // Use original totalAmount if available
        deliveryCharge: deliveryCharge,
      });
      
      // Update order items if quantities were changed
      const updatedItems = items.map((item) => ({
        medicineName: item.medicineName,
        quantity: item.quantity,
      }));
      
      // If items changed, update the order
      const itemsChanged = JSON.stringify(updatedItems) !== JSON.stringify(order.items);
      if (itemsChanged) {
        await ordersApi.update(order._id, {
          items: updatedItems,
        });
      }

      // For low stock items, optionally order from distributor
      for (const item of items) {
        if (item.status === "low_stock" && item.quantity > item.availableQuantity) {
          const shortage = item.quantity - item.availableQuantity;
          if (shortage > 0 && userDistributorId) {
            // Optionally order shortage from distributor
            try {
              await handleOrderFromDistributor({
                ...item,
                quantity: shortage,
              });
            } catch (error) {
              console.warn(`Failed to order ${item.medicineName} from distributor:`, error);
            }
          }
        }
      }

      toast.success("✅ Order accepted successfully! All medicines are available.");
      onConfirm();
    } catch (error: any) {
      toast.error("Failed to confirm order: " + (error.message || "Unknown error"));
    } finally {
      setProcessing(false);
    }
  };

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals();
  const hasOutOfStock = items.some((item) => item.status === "out_of_stock");
  const hasLowStock = items.some((item) => item.status === "low_stock");

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600 text-center">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Order Checkout</h2>
              <p className="text-blue-100 text-sm mt-1">
                Order #{order._id.slice(-8)} • {new Date(order.createdAt || Date.now()).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Stock Alerts */}
          {(hasOutOfStock || hasLowStock) && (
            <div className="mb-6 space-y-2">
              {hasOutOfStock && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-red-900 font-bold flex items-center gap-2 mb-2">
                    <span>🚨</span> CRITICAL: Some medicines are OUT OF STOCK
                  </p>
                  <p className="text-sm text-red-700">
                    You must order these medicines from the distributor before accepting this order.
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-red-700">
                    {items.filter((item) => item.status === "out_of_stock").map((item, idx) => (
                      <li key={idx}>
                        <strong>{item.medicineName}</strong> - Required: {item.quantity}, Available: {item.availableQuantity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {hasLowStock && !hasOutOfStock && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                  <p className="text-yellow-900 font-semibold flex items-center gap-2 mb-2">
                    <span>⚠️</span> WARNING: Some medicines have LOW STOCK
                  </p>
                  <p className="text-sm text-yellow-700">
                    Consider ordering more from distributor to maintain stock levels.
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-yellow-700">
                    {items.filter((item) => item.status === "low_stock" && item.quantity > item.availableQuantity).map((item, idx) => (
                      <li key={idx}>
                        <strong>{item.medicineName}</strong> - Required: {item.quantity}, Available: {item.availableQuantity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Order Items */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-bold text-gray-900">Order Items</h3>
            {items.map((item, index) => (
              <div
                key={index}
                className={`border-2 rounded-lg p-4 ${
                  item.status === "out_of_stock"
                    ? "border-red-300 bg-red-50"
                    : item.status === "low_stock"
                    ? "border-yellow-300 bg-yellow-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-lg">{item.medicineName}</h4>
                    <p className="text-sm text-gray-600 mt-1">Unit Price: ₹{item.unitPrice}</p>
                    {item.status === "out_of_stock" && (
                      <p className="text-sm text-red-600 font-semibold mt-1">Out of Stock</p>
                    )}
                    {item.status === "low_stock" && (
                      <p className="text-sm text-yellow-600 font-semibold mt-1">
                        Only {item.availableQuantity} units available
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-lg">₹{item.subtotal.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">₹{item.unitPrice} × {item.quantity}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateItemQuantity(index, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="w-8 h-8 rounded-lg border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="font-semibold text-gray-900 w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateItemQuantity(index, item.quantity + 1)}
                      disabled={item.quantity >= item.availableQuantity}
                      className="w-8 h-8 rounded-lg border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeItem(index)}
                      className="ml-4 px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200"
                    >
                      Remove
                    </button>
                  </div>
                  {item.status === "out_of_stock" && userDistributorId && (
                    <button
                      onClick={() => handleOrderFromDistributor(item)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
                    >
                      Order from Distributor
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Breakdown */}
          <div className="border-2 border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Pricing Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal</span>
                <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-gray-700">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <span className="font-semibold text-green-600">
                  -₹{discountAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-gray-700">Tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tax}
                    onChange={(e) => setTax(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <span className="font-semibold text-gray-700">₹{taxAmount.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-gray-700">Delivery Charge</label>
                  <input
                    type="number"
                    min="0"
                    value={deliveryCharge}
                    onChange={(e) => setDeliveryCharge(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <span className="font-semibold text-gray-700">₹{deliveryCharge.toFixed(2)}</span>
              </div>

              <div className="border-t-2 border-gray-300 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-gray-900">Total Amount</span>
                  <span className="text-2xl font-bold text-green-600">₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmOrder}
              disabled={processing || items.length === 0 || hasOutOfStock}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                hasOutOfStock
                  ? "bg-red-600 text-white cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-green-600 text-white"
              }`}
            >
              {processing
                ? "Processing..."
                : hasOutOfStock
                ? "⚠️ Order Unavailable Medicines First"
                : `✅ Accept Order (₹${total.toFixed(2)})`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

