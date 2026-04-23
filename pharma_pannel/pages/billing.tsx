import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "@/components/Layout";
import BrandSelectionModal from "@/components/BrandSelectionModal";
import CustomerDetailsModal from "@/components/CustomerDetailsModal";
import { ordersApi, pharmacyInvoiceApi, inventoryApi, inventorySearchApi, deliveryAgentApi } from "@/services/api";
import { getUser, getAuthToken } from "@/utils/auth";
import { PharmacyInvoiceItem, MedicineSearchResult } from "@/types";
import { API_BASE } from "@/utils/constants";

interface CartItem extends PharmacyInvoiceItem {
  inventoryItemId: string;
}

interface Order {
  _id: string;
  patientId: string;
  items: Array<{
    medicineName: string;
    quantity: number;
    prescriptionItemId?: string;
  }>;
  status: string;
  deliveryType?: "DELIVERY" | "PICKUP";
  deliveryAddress?: string;
  phoneNumber?: string;
  totalAmount?: number;
  deliveryCharge?: number;
  createdAt?: string;
  patient?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentMethod?: string;
}

type BillingMode = "ORDER" | "WALK_IN";

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [billingMode, setBillingMode] = useState<BillingMode>("ORDER");
  
  // Order billing state
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Walk-in billing state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MedicineSearchResult | null>(null);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  
  // Common state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "UPI" | "NET_BANKING" | "WALLET" | "">("");
  const [taxRate] = useState(18);
  const [errors, setErrors] = useState<FormErrors>({});
  
  // Delivery assignment state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deliveryAgents, setDeliveryAgents] = useState<any[]>([]);
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(null);
  const [deliveryAssigned, setDeliveryAssigned] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showMarkDelivered, setShowMarkDelivered] = useState(false);
  const [assignForm, setAssignForm] = useState({
    agentId: "",
    agentName: "",
    agentPhone: "",
    estimatedTime: "",
  });

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/");
      return;
    }
    setUser(currentUser);
    if (currentUser.pharmacyId) {
      loadOrders(currentUser.pharmacyId);
    }
  }, [router]);

  const loadOrders = async (pharmacyId: string) => {
    setLoadingOrders(true);
    try {
      const allOrders = await ordersApi.getByPharmacy(pharmacyId);
      const readyOrders = allOrders.filter(
        (order: Order) => 
          order.status === "SENT_TO_PHARMACY" || 
          order.status === "ACCEPTED" || 
          order.status === "PACKED"
      );
      setOrders(readyOrders);
    } catch (error: any) {
      toast.error("Failed to load orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadOrderItems = async (order: Order) => {
    if (!user?.pharmacyId) return;
    
    setLoading(true);
    try {
      // Fetch patient details if patientId exists
      let patientData: any = null;
      if (order.patientId) {
        try {
          const token = getAuthToken();
          if (token) {
            const response = await fetch(`${API_BASE}/api/users/${order.patientId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (response.ok) {
              patientData = await response.json();
            }
          }
        } catch (error) {
          console.error("Failed to fetch patient details:", error);
        }
      }

      const inventoryItems = await inventoryApi.getAll(user.pharmacyId);
      const cartItems: CartItem[] = [];
      
      // Calculate prices - use order's totalAmount if available to maintain consistency
      const orderSubtotal = order.totalAmount ? (order.totalAmount - (order.deliveryCharge || 0)) : null;
      const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
      
      for (const orderItem of order.items) {
        // Find ALL matching inventory items (same medicine name, may have different batches/brands)
        const matchingItems = Array.isArray(inventoryItems)
          ? inventoryItems.filter((inv: any) => 
              (inv.medicineName || "").trim().toLowerCase() === (orderItem.medicineName || "").trim().toLowerCase()
            )
          : [];

        // Use the first matching item for pricing/details (they should all have same medicine name)
        const inventoryItem = matchingItems[0] || null;

        if (inventoryItem) {
          const quantity = orderItem.quantity;
          
          // Calculate prices: use order's totalAmount if available, otherwise use inventory prices
          let sellingPrice: number;
          let mrp: number;
          let subtotal: number;
          
          if (orderSubtotal !== null && orderSubtotal > 0 && totalQuantity > 0) {
            // Use order's totalAmount to calculate prices proportionally
            const itemProportion = quantity / totalQuantity;
            subtotal = orderSubtotal * itemProportion;
            sellingPrice = subtotal / quantity;
            mrp = inventoryItem.mrp || inventoryItem.sellingPrice || sellingPrice;
          } else {
            // Fall back to inventory prices
            mrp = inventoryItem.mrp || inventoryItem.sellingPrice || inventoryItem.purchasePrice || 0;
            sellingPrice = inventoryItem.sellingPrice || inventoryItem.purchasePrice || mrp;
            subtotal = sellingPrice * quantity;
          }
          
          const discount = inventoryItem.discount || 0;
          const discountAmount = (subtotal * discount) / 100;
          const afterDiscount = subtotal - discountAmount;
          const taxAmount = afterDiscount * (taxRate / 100);
          const total = afterDiscount + taxAmount;

          cartItems.push({
            inventoryItemId: inventoryItem._id,
            medicineName: inventoryItem.medicineName,
            composition: inventoryItem.composition || "",
            brandName: inventoryItem.brandName || "",
            batchNumber: inventoryItem.batchNumber || "",
            expiryDate: inventoryItem.expiryDate || new Date().toISOString(),
            quantity: quantity,
            mrp: mrp,
            sellingPrice: sellingPrice,
            discount: discount,
            discountAmount: discountAmount,
            purchasePrice: inventoryItem.purchasePrice || 0,
            margin: inventoryItem.margin || 0,
            taxRate: taxRate,
            taxAmount: taxAmount,
            subtotal: subtotal,
            total: total,
            rackNumber: inventoryItem.rackNumber,
            rowNumber: inventoryItem.rowNumber,
          });
        }
      }

      setCart(cartItems);
      setSelectedOrder(order);
      
      // Auto-fill customer details from patient data and order
      const autoFilledInfo = {
        name: patientData?.name || order.patient?.name || "",
        phone: order.phoneNumber || patientData?.phone || patientData?.phoneNumber || order.patient?.phone || "",
        email: patientData?.email || order.patient?.email || "",
        address: order.deliveryAddress || patientData?.address || order.patient?.address || "",
      };
      setCustomerInfo(autoFilledInfo);
      
      toast.success(`Loaded ${cartItems.length} item(s) from order. Customer details auto-filled.`);
    } catch (error: any) {
      toast.error("Failed to load order items");
    } finally {
      setLoading(false);
    }
  };

  // Walk-in billing functions
  const handleSearch = async () => {
    if (!searchQuery.trim() || !user?.pharmacyId) {
      toast.error("Please enter a search query");
      return;
    }
    
    setLoading(true);
    try {
      const result = await inventorySearchApi.search(user.pharmacyId, searchQuery);
      if (result.results.length > 0) {
        setSearchResults(result);
        setShowBrandModal(true);
      } else {
        toast.error("No medicines found");
      }
    } catch (error: any) {
      toast.error(error.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBrand = (brand: any, composition: string) => {
    if (brand.isExpired) {
      toast.error("Cannot add expired medicine");
      return;
    }
    if (brand.availableQuantity === 0) {
      toast.error("Insufficient stock");
      return;
    }

    const existingIndex = cart.findIndex(
      (item) => item.inventoryItemId === brand.inventoryItemId
    );

    if (existingIndex >= 0) {
      const existingItem = cart[existingIndex];
      if (existingItem.quantity + 1 > brand.availableQuantity) {
        toast.error("Cannot exceed available quantity");
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex] = {
        ...existingItem,
        quantity: existingItem.quantity + 1,
        subtotal: (existingItem.mrp || existingItem.sellingPrice) * (existingItem.quantity + 1),
        discountAmount: ((existingItem.mrp || existingItem.sellingPrice) * (existingItem.quantity + 1) * existingItem.discount) / 100,
      };
      updatedCart[existingIndex].taxAmount = (updatedCart[existingIndex].subtotal - updatedCart[existingIndex].discountAmount) * (taxRate / 100);
      updatedCart[existingIndex].total = updatedCart[existingIndex].subtotal - updatedCart[existingIndex].discountAmount + updatedCart[existingIndex].taxAmount;
      setCart(updatedCart);
    } else {
      const quantity = 1;
      const mrp = brand.mrp || brand.sellingPrice;
      const subtotal = mrp * quantity;
      const discountAmount = 0;
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * (taxRate / 100);
      const total = afterDiscount + taxAmount;

      const newItem: CartItem = {
        inventoryItemId: brand.inventoryItemId,
        medicineName: searchResults?.results[0]?.medicineName || composition,
        composition: composition,
        brandName: brand.brandName,
        batchNumber: brand.batchNumber,
        expiryDate: brand.expiryDate,
        quantity: quantity,
        mrp: mrp,
        sellingPrice: brand.sellingPrice,
        discount: 0,
        discountAmount: discountAmount,
        purchasePrice: brand.costPrice,
        margin: brand.margin,
        taxRate: taxRate,
        taxAmount: taxAmount,
        subtotal: subtotal,
        total: total,
        rackNumber: brand.rackNumber,
        rowNumber: brand.rowNumber,
      };

      setCart([...cart, newItem]);
    }

    setShowBrandModal(false);
    setSearchQuery("");
    toast.success("Medicine added to cart");
  };

  const updateCartItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeCartItem(index);
      return;
    }

    const updatedCart = [...cart];
    updatedCart[index].quantity = newQuantity;
    updatedCart[index].subtotal = (updatedCart[index].mrp || updatedCart[index].sellingPrice) * newQuantity;
    updatedCart[index].discountAmount = (updatedCart[index].subtotal * updatedCart[index].discount) / 100;
    updatedCart[index].taxAmount = (updatedCart[index].subtotal - updatedCart[index].discountAmount) * (taxRate / 100);
    updatedCart[index].total = updatedCart[index].subtotal - updatedCart[index].discountAmount + updatedCart[index].taxAmount;
    setCart(updatedCart);
  };

  const removeCartItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const isWalkIn = billingMode === "WALK_IN";

    if (!customerInfo.name.trim()) {
      newErrors.name = "Required";
    }

    if (!customerInfo.phone.trim()) {
      newErrors.phone = "Required";
    } else if (!/^[0-9]{10}$/.test(customerInfo.phone.replace(/\D/g, ""))) {
      newErrors.phone = "Invalid 10-digit number";
    }

    // For walk-in: email and address optional; for order (e.g. delivery) require them
    if (!isWalkIn) {
      if (!customerInfo.email.trim()) {
        newErrors.email = "Required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
        newErrors.email = "Invalid email";
      }
      if (!customerInfo.address.trim()) {
        newErrors.address = "Required";
      }
    } else {
      if (customerInfo.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
        newErrors.email = "Invalid email";
      }
    }

    if (!paymentMethod) {
      newErrors.paymentMethod = "Required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDiscount = cart.reduce((sum, item) => sum + item.discountAmount, 0);
    const totalTax = cart.reduce((sum, item) => sum + item.taxAmount, 0);
    const grandTotal = subtotal - totalDiscount + totalTax;
    return { subtotal, totalDiscount, totalTax, grandTotal };
  };

  const handleCreateInvoice = async () => {
    if (!user?.pharmacyId) {
      toast.error("User not authenticated");
      return;
    }

    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fill all required fields");
      return;
    }

    setCreatingInvoice(true);
    try {
      const totals = calculateTotals();
      
      const payload = {
        pharmacyId: user.pharmacyId,
        patientId: billingMode === "ORDER" ? selectedOrder?.patientId : undefined,
        orderId: billingMode === "ORDER" ? selectedOrder?._id : undefined,
        invoiceType: billingMode === "ORDER" ? "PATIENT_ORDER" : "WALK_IN",
        items: cart.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          mrp: item.mrp,
          discount: item.discount,
          discountAmount: item.discountAmount,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          subtotal: item.subtotal,
          total: item.total,
        })),
        paymentMethod: paymentMethod,
        paymentStatus: "PAID",
        paidAmount: totals.grandTotal,
        billDate: new Date().toISOString(),
        notes: `Customer: ${customerInfo.name}, Phone: ${customerInfo.phone}, Email: ${customerInfo.email}, Address: ${customerInfo.address}`,
      };

      let invoice;
      try {
        invoice = await pharmacyInvoiceApi.create(payload);
      } catch (err: any) {
        if (err.code === "EXPIRY_OVERRIDE_REQUIRED") {
          const overrideOk = window.confirm(
            "Some items are expiring within 30 days or expired. Only Manager can override. Do you have manager permission to proceed?"
          );
          if (overrideOk) {
            invoice = await pharmacyInvoiceApi.create({ ...payload, overrideExpiry: true });
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      toast.success("Invoice created successfully!");
      
      // Reset form and reload orders (for WALK_IN or PICKUP orders)
      handleResetAfterInvoice();
    } catch (error: any) {
      toast.error(error.message || "Failed to create invoice");
    } finally {
      setCreatingInvoice(false);
    }
  };

  const switchMode = (mode: BillingMode) => {
    setBillingMode(mode);
    setCart([]);
    setSelectedOrder(null);
    setCustomerInfo({ name: "", phone: "", email: "", address: "" });
    setPaymentMethod("");
    setSearchQuery("");
    setErrors({});
    setShowCustomerModal(false);
    setDeliveryAssigned(false);
    setShowThankYou(false);
    setShowMarkDelivered(false);
    setLastCreatedOrderId(null);
  };

  const handleSaveCustomerDetails = (info: { name: string; phone: string; email: string; address: string }, payment: "CASH" | "CARD" | "UPI" | "NET_BANKING" | "WALLET" | "") => {
    setCustomerInfo(info);
    setPaymentMethod(payment);
    setErrors({});
    toast.success("Customer details saved");
  };

  const handleMarkDelivered = async () => {
    if (!selectedOrder) {
      toast.error("Order not selected");
      return;
    }

    try {
      await ordersApi.updateStatus(selectedOrder._id, {
        status: "DELIVERED",
      });
      toast.success("✅ Order marked as delivered!");
      handleResetAfterInvoice();
    } catch (error: any) {
      toast.error(error.message || "Failed to mark order as delivered");
    }
  };

  const handleResetAfterInvoice = () => {
    setCart([]);
    setSelectedOrder(null);
    setCustomerInfo({ name: "", phone: "", email: "", address: "" });
    setPaymentMethod("");
    setSearchQuery("");
    setErrors({});
    setLastCreatedOrderId(null);
    setDeliveryAssigned(false);
    setShowThankYou(false);
    setShowMarkDelivered(false);
    
    // Reload orders if in ORDER mode
    if (billingMode === "ORDER" && user?.pharmacyId) {
      loadOrders(user.pharmacyId);
    }
  };

  const handleAssignDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    // Just store delivery agent info locally (don't update order status yet)
    // Status will be updated to OUT_FOR_DELIVERY when we send the order (create invoice)
    if (!assignForm.agentId && !assignForm.agentName) {
      toast.error("Please select or enter delivery agent details");
      return;
    }

    toast.success("🚚 Delivery agent info saved!");
    
    // Close modal
    setShowAssignModal(false);
    
    // Mark delivery as assigned - show "Send Order" button
    setDeliveryAssigned(true);
  };

  const handleSendOrder = async () => {
    console.log("handleSendOrder called", { user: !!user, selectedOrder: !!selectedOrder, cartLength: cart.length, paymentMethod });
    
    if (!user?.pharmacyId || !selectedOrder) {
      toast.error("User not authenticated or order not selected");
      return;
    }

    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!paymentMethod) {
      toast.error("Please select payment method first");
      return;
    }

    // Set loading state immediately so user sees feedback
    console.log("Setting creatingInvoice to true...");
    setCreatingInvoice(true);

    // For ORDER mode, use order data if customer info is missing
    let finalCustomerInfo = { ...customerInfo };
    if (billingMode === "ORDER" && selectedOrder) {
      finalCustomerInfo = {
        name: customerInfo.name || selectedOrder.patient?.name || "",
        phone: customerInfo.phone || selectedOrder.phoneNumber || "",
        email: customerInfo.email || selectedOrder.patient?.email || "",
        address: customerInfo.address || selectedOrder.deliveryAddress || "",
      };
      // Update state for display, but use finalCustomerInfo for validation
      setCustomerInfo(finalCustomerInfo);
    }

    // For ORDER mode, skip strict validation and use order data
    // For WALK_IN mode, validate form
    if (billingMode === "WALK_IN") {
      const validationResult = validateForm();
      if (!validationResult) {
        console.log("Validation failed", { customerInfo, errors });
        setCreatingInvoice(false);
        toast.error("Please fill all required fields");
        return;
      }
    } else {
      // For ORDER mode, just ensure we have minimum required data
      if (!finalCustomerInfo.name && !finalCustomerInfo.phone) {
        console.log("Missing customer info for ORDER", { finalCustomerInfo });
        setCreatingInvoice(false);
        toast.error("Customer information is missing");
        return;
      }
    }

    console.log("Starting invoice creation...");
    try {
      const totals = calculateTotals();
      
      const payload = {
        pharmacyId: user.pharmacyId,
        patientId: selectedOrder.patientId,
        orderId: selectedOrder._id,
        invoiceType: "PATIENT_ORDER" as const,
        items: cart.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          mrp: item.mrp,
          discount: item.discount,
          discountAmount: item.discountAmount,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          subtotal: item.subtotal,
          total: item.total,
        })),
        paymentMethod: paymentMethod,
        paymentStatus: "PAID" as const,
        paidAmount: totals.grandTotal,
        billDate: new Date().toISOString(),
        notes: `Customer: ${customerInfo.name}, Phone: ${customerInfo.phone}, Email: ${customerInfo.email}, Address: ${customerInfo.address}`,
      };
      let invoice;
      try {
        invoice = await pharmacyInvoiceApi.create(payload);
      } catch (err: any) {
        if (err.code === "EXPIRY_OVERRIDE_REQUIRED") {
          const overrideOk = window.confirm(
            "Some items are expiring within 30 days or expired. Only Manager can override. Do you have manager permission to proceed?"
          );
          if (overrideOk) {
            invoice = await pharmacyInvoiceApi.create({ ...payload, overrideExpiry: true });
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      // Update order status to OUT_FOR_DELIVERY if delivery type and delivery agent was assigned
      if (selectedOrder.deliveryType === "DELIVERY" && deliveryAssigned) {
        try {
          await ordersApi.updateStatus(selectedOrder._id, {
            status: "OUT_FOR_DELIVERY",
            deliveryPersonId: assignForm.agentId || undefined,
            deliveryPersonName: assignForm.agentName || undefined,
            deliveryPersonPhone: assignForm.agentPhone || undefined,
            estimatedDeliveryTime: assignForm.estimatedTime || undefined,
          });
        } catch (error) {
          console.error("Failed to update order status:", error);
        }
      }
      
      console.log("Invoice created successfully", invoice);
      toast.success("Invoice created and sent to patient successfully!");
      
      // Show mark delivered button directly after invoice is created
      setShowMarkDelivered(true);
      
      // Invoice is automatically sent to patient by backend, no need to download here
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      toast.error(error.message || "Failed to create invoice");
    } finally {
      setCreatingInvoice(false);
    }
  };

  if (!user) return null;

  const { subtotal, totalDiscount, totalTax, grandTotal } = calculateTotals();

  return (
    <Layout user={user} currentPage="billing">
      <div className="min-h-[calc(100vh-120px)] flex flex-col gap-4 p-2 sm:p-4">
        {/* Header with Mode Toggle */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pharmacy Billing</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {billingMode === "ORDER"
                  ? "Create invoices for online patient orders"
                  : "Bill offline customers who visit the pharmacy — no prescription or online order required"}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => switchMode("ORDER")}
                className={`px-3 sm:px-6 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                  billingMode === "ORDER"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Order Billing
              </button>
              <button
                onClick={() => switchMode("WALK_IN")}
                className={`px-3 sm:px-6 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                  billingMode === "WALK_IN"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Walk-in / Offline
              </button>
            </div>
          </div>
          {/* Walk-in: short steps so staff know the flow */}
          {billingMode === "WALK_IN" && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
              <span className="font-semibold text-gray-700">Offline bill steps:</span>
              <span>1. Add customer (name & phone)</span>
              <span className="text-gray-400">→</span>
              <span>2. Search & add medicines</span>
              <span className="text-gray-400">→</span>
              <span>3. Select payment & Generate invoice</span>
            </div>
          )}
        </div>

        {/* Main Content - Single Grid Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1">
          {/* Main Column: Order Items - Single Unified Section */}
          <div className="col-span-full lg:col-span-9 bg-white rounded-lg shadow border border-gray-200 flex flex-col min-h-[500px] lg:min-h-0 lg:overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <h2 className="font-bold text-gray-900">
                    {billingMode === "WALK_IN" ? "Items for Bill" : "Order Items"}
                  </h2>
                  <p className="text-xs text-gray-600">
                    {cart.length} item(s) in cart
                    {billingMode === "WALK_IN" && " — search and add medicines (no prescription needed)"}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Orders Selector - Only in ORDER mode */}
                  {billingMode === "ORDER" && (
                    <select
                      value={selectedOrder?._id || ""}
                      onChange={(e) => {
                        const order = orders.find((o) => o._id === e.target.value);
                        if (order) loadOrderItems(order);
                      }}
                      disabled={loadingOrders || loading}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Order...</option>
                      {orders.map((order) => (
                        <option key={order._id} value={order._id}>
                          Order #{order._id.slice(-6)} - {order.items.length} item(s) - {order.status}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  {/* Search - Only in WALK_IN mode */}
                  {billingMode === "WALK_IN" && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search by medicine name or composition..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <button
                        onClick={handleSearch}
                        disabled={loading || !searchQuery.trim()}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                      >
                        {loading ? "..." : "Search"}
                      </button>
                    </div>
                  )}
                  
                  {/* Customer Details Button - Only in WALK_IN mode */}
                  {billingMode === "WALK_IN" && (
                    <button
                      onClick={() => setShowCustomerModal(true)}
                      className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {customerInfo.name ? "Edit Customer" : "Add Customer"}
                    </button>
                  )}
                  
                  {cart.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm("Clear cart?")) {
                          setCart([]);
                          setSelectedOrder(null);
                        }
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap"
                    >
                      Clear Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {showThankYou ? (
                <div className="text-center py-16 px-4">
                  <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
                  <p className="text-lg text-gray-600 mb-4">Order has been sent successfully</p>
                  <p className="text-sm text-gray-500">Invoice generated and sent to patient</p>
                </div>
              ) : showMarkDelivered ? (
                <div className="text-center py-16 px-4">
                  <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Order Sent Successfully!</h3>
                  <p className="text-lg text-gray-600 mb-4">Invoice generated and sent to patient</p>
                  <button
                    onClick={handleMarkDelivered}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2 mx-auto"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark Delivered
                  </button>
                </div>
              ) : loading ? (
                <div className="text-center py-12 text-gray-500">Loading items...</div>
              ) : cart.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">No items in cart</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {billingMode === "ORDER"
                      ? "Select an order to load items"
                      : "Search by medicine name or composition and add items. No prescription required for offline customers."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">Medicine / Brand</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs hidden sm:table-cell">Batch</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs hidden md:table-cell">Expiry</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Price</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Total</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cart.map((item, index) => {
                      const expiryDate = new Date(item.expiryDate);
                      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
                      const isExpired = daysUntilExpiry < 0;
                      const loc = [item.rackNumber, item.rowNumber].filter(Boolean).join("-");
                      
                      return (
                        <tr
                          key={index}
                          className={`hover:bg-gray-50 ${
                            isExpired ? "bg-red-50" : isExpiringSoon ? "bg-orange-50" : ""
                          }`}
                        >
                          <td className="px-3 py-3">
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{item.medicineName}</p>
                              {item.brandName && <p className="text-xs text-gray-600">{item.brandName}</p>}
                              {loc && <p className="text-xs text-gray-400">Loc: {loc}</p>}
                              {isExpired && <span className="inline-block mt-1 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded font-bold">EXPIRED</span>}
                              {isExpiringSoon && !isExpired && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded">
                                  {daysUntilExpiry}d left
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 hidden sm:table-cell text-xs text-gray-600">{item.batchNumber || "–"}</td>
                          <td className="px-3 py-3 hidden md:table-cell text-xs text-gray-600">{expiryDate.toLocaleDateString()}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updateCartItemQuantity(index, item.quantity - 1)}
                                className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 text-gray-600 font-bold text-sm"
                              >
                                −
                              </button>
                              <span className="w-10 text-center font-semibold">{item.quantity}</span>
                              <button
                                onClick={() => updateCartItemQuantity(index, item.quantity + 1)}
                                className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 text-gray-600 font-bold text-sm"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className="font-medium text-gray-900">₹{item.sellingPrice.toFixed(2)}</p>
                            {item.mrp > item.sellingPrice && (
                              <p className="text-xs text-gray-400 line-through">₹{item.mrp.toFixed(2)}</p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className="font-bold text-gray-900">₹{item.total.toFixed(2)}</p>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => removeCartItem(index)}
                              className="mx-auto flex items-center justify-center w-6 h-6 text-red-600 hover:text-red-800"
                              title="Remove"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Action Button - Show when items in cart - AT BOTTOM */}
            {cart.length > 0 && !showThankYou && !showMarkDelivered && (
              <div className="px-4 py-3 bg-blue-50 border-t border-blue-200">
                {billingMode === "ORDER" && selectedOrder?.deliveryType === "DELIVERY" ? (
                  // For ORDER mode with DELIVERY type
                  deliveryAssigned ? (
                    // After delivery assigned, show "Send Order" button
                    <>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("Send Order button clicked");
                          handleSendOrder();
                        }}
                        disabled={creatingInvoice}
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                        type="button"
                      >
                        {creatingInvoice ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sending Order...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Send Order
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    // Before delivery assigned, show "Assign Delivery" button
                    <>
                      <button
                        onClick={() => {
                          if (!paymentMethod) {
                            toast.error("Please select payment method first");
                            return;
                          }
                          // Load delivery agents and show modal
                          (async () => {
                            try {
                              const agents = await deliveryAgentApi.getByPharmacy(user.pharmacyId);
                              setDeliveryAgents(Array.isArray(agents) ? agents : []);
                              setShowAssignModal(true);
                            } catch (error) {
                              console.error("Failed to load delivery agents:", error);
                              toast.error("Failed to load delivery agents");
                            }
                          })();
                        }}
                        disabled={!paymentMethod}
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Assign Delivery
                      </button>
                      {!paymentMethod && (
                        <p className="text-xs text-red-600 mt-1.5 text-center">
                          Please select payment method first
                        </p>
                      )}
                    </>
                  )
                ) : (
                  // For WALK_IN mode or PICKUP orders, show "Generate Invoice" button
                  <>
                    <button
                      onClick={handleCreateInvoice}
                      disabled={!paymentMethod || creatingInvoice}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2"
                    >
                      {creatingInvoice ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating Invoice...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Generate Invoice
                        </>
                      )}
                    </button>
                    {!paymentMethod && (
                      <p className="text-xs text-red-600 mt-1.5 text-center">
                        {billingMode === "WALK_IN"
                          ? "Add customer (name & phone) and payment via « Add Customer » / « Edit Customer »"
                          : "Please select payment method"}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Payment Method & Invoice Summary */}
          <div className="col-span-full lg:col-span-3 flex flex-col gap-3 sm:gap-4">
            {/* Payment Method - Only shown in ORDER mode (WALK_IN has it in modal) */}
            {billingMode === "ORDER" && (
              <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                <h2 className="font-bold text-gray-900 mb-3 text-sm">Payment Method</h2>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Select Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value as any);
                      if (errors.paymentMethod) setErrors({ ...errors, paymentMethod: undefined });
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none ${
                      errors.paymentMethod ? "border-red-300" : "border-gray-300 focus:border-blue-500"
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="CASH">💵 Cash</option>
                    <option value="CARD">💳 Card</option>
                    <option value="UPI">📱 UPI</option>
                    <option value="NET_BANKING">🏦 Net Banking</option>
                    <option value="WALLET">👛 Wallet</option>
                  </select>
                  {errors.paymentMethod && <p className="text-xs text-red-600 mt-1">{errors.paymentMethod}</p>}
                </div>
              </div>
            )}

            {/* Invoice Summary (tax breakup per 4.1) */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg border-2 border-blue-200 p-3 sm:p-4">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">Invoice Summary & Tax Breakup</h3>
              <div className="space-y-2 mb-3 sm:mb-4">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-700">Subtotal:</span>
                  <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-700">Discount:</span>
                  <span className="font-semibold text-green-600">-₹{totalDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-700">Tax (GST {taxRate}%):</span>
                  <span className="font-semibold">₹{totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t-2 border-blue-300">
                  <span className="font-bold text-gray-900 text-sm sm:text-base">Total:</span>
                  <span className="text-lg sm:text-xl font-bold text-blue-600">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Selection Modal for Walk-in */}
        {billingMode === "WALK_IN" && searchResults && (
          <BrandSelectionModal
            isOpen={showBrandModal}
            onClose={() => {
              setShowBrandModal(false);
              setSearchResults(null);
            }}
            searchResult={searchResults}
            onSelectBrand={handleSelectBrand}
          />
        )}

        {/* Customer Details Modal for Walk-in */}
        {billingMode === "WALK_IN" && (
          <CustomerDetailsModal
            isOpen={showCustomerModal}
            onClose={() => setShowCustomerModal(false)}
            customerInfo={customerInfo}
            paymentMethod={paymentMethod}
            onSave={handleSaveCustomerDetails}
            errors={errors}
            walkInOnly={true}
          />
        )}

        {/* Assign Delivery Agent Modal */}
        {showAssignModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🚚 Assign Delivery Agent</h2>
              <form onSubmit={handleAssignDelivery} className="space-y-4">
                {deliveryAgents.length > 0 ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Delivery Agent</label>
                    <select
                      value={assignForm.agentId}
                      onChange={(e) => {
                        const agent = deliveryAgents.find((a) => a._id === e.target.value);
                        setAssignForm({
                          ...assignForm,
                          agentId: e.target.value,
                          agentName: agent?.name || "",
                          agentPhone: agent?.phoneNumber || agent?.phone || "",
                        });
                      }}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      required
                    >
                      <option value="">Select an agent</option>
                      {deliveryAgents.map((agent) => (
                        <option key={agent._id} value={agent._id}>
                          {agent.name} - {agent.phoneNumber || agent.phone || "No phone"}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Agent Name *</label>
                      <input
                        type="text"
                        required
                        value={assignForm.agentName}
                        onChange={(e) => setAssignForm({ ...assignForm, agentName: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Agent Phone *</label>
                      <input
                        type="tel"
                        required
                        value={assignForm.agentPhone}
                        onChange={(e) => setAssignForm({ ...assignForm, agentPhone: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated Delivery Time</label>
                  <input
                    type="datetime-local"
                    value={assignForm.estimatedTime}
                    onChange={(e) => setAssignForm({ ...assignForm, estimatedTime: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Assign Agent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setAssignForm({ agentId: "", agentName: "", agentPhone: "", estimatedTime: "" });
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    Skip
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}
