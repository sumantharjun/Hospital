"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { cartUtils, CartItem } from "@/lib/cart";

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartByPharmacy, setCartByPharmacy] = useState<Record<string, CartItem[]>>({});
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) {
        router.replace("/");
        return;
      }
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  useEffect(() => {
    loadCart();
    
    const handleCartUpdate = () => loadCart();
    window.addEventListener("cartUpdated", handleCartUpdate);
    return () => window.removeEventListener("cartUpdated", handleCartUpdate);
  }, []);

  const loadCart = () => {
    const cartItems = cartUtils.getCart();
    setCart(cartItems);
    setCartByPharmacy(cartUtils.getCartByPharmacy());
  };

  const handleQuantityChange = (productId: string, pharmacyId: string, newQuantity: number) => {
    cartUtils.updateQuantity(productId, pharmacyId, newQuantity);
  };

  const handleRemove = (productId: string, pharmacyId: string) => {
    if (confirm("Remove this item from cart?")) {
      cartUtils.removeFromCart(productId, pharmacyId);
      toast.success("Item removed from cart");
    }
  };

  const handleClearCart = () => {
    if (confirm("Clear entire cart?")) {
      cartUtils.clearCart();
      toast.success("Cart cleared");
    }
  };

  const handleProceedToCheckout = (pharmacyId: string, items: CartItem[]) => {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryCharge = 30; // Default delivery charge
    
    sessionStorage.setItem(
      "checkoutData",
      JSON.stringify({
        pharmacyId,
        items: items.map((item) => ({
          medicineName: item.medicineName,
          quantity: item.quantity,
        })),
        totalAmount: total + deliveryCharge,
        deliveryCharge,
        itemsDetails: items,
      })
    );

    router.push(`/checkout?pharmacy=${pharmacyId}`);
  };

  const calculateTotal = (items: CartItem[]) => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const grandTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (!user) return null;

  return (
    <DashboardLayout
      title="Shopping Cart"
      description={`${cart.length} item(s) in your cart`}
      actionButton={
        cart.length > 0 && (
          <button
            onClick={handleClearCart}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all"
          >
            Clear Cart
          </button>
        )
      }
    >
      {cart.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🛒</div>
          <p className="text-gray-500 text-lg mb-2">Your cart is empty</p>
          <p className="text-gray-400 text-sm mb-6">Start adding items from the Medical Store</p>
          <button
            onClick={() => router.push("/medical-store")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
          >
            Browse Products
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(cartByPharmacy).map(([pharmacyId, items]) => {
            const pharmacyName = items[0]?.pharmacyName || "Pharmacy";
            const total = calculateTotal(items);
            const hasPrescriptionRequired = items.some((item) => item.prescriptionRequired);

            return (
              <div key={pharmacyId} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                {/* Pharmacy Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">🏥 {pharmacyName}</h3>
                      <p className="text-sm text-gray-600">{items.length} item(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Subtotal</p>
                      <p className="text-xl font-bold text-gray-900">₹{total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="p-4 flex gap-4">
                      {/* Image */}
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.medicineName}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-3xl">💊</span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 mb-1">{item.medicineName}</h4>
                        {item.brandName && (
                          <p className="text-sm text-gray-600 mb-1">Brand: {item.brandName}</p>
                        )}
                        <p className="text-xs text-gray-500 mb-2">{item.composition}</p>
                        {item.prescriptionRequired && (
                          <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded mb-2">
                            📋 Prescription Required
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">₹{item.price.toFixed(2)}</span>
                          {item.mrp && item.mrp > item.price && (
                            <span className="text-sm text-gray-400 line-through">
                              ₹{item.mrp.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleQuantityChange(item.productId, item.pharmacyId, item.quantity - 1)
                            }
                            className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center font-bold"
                          >
                            −
                          </button>
                          <span className="w-10 text-center font-semibold">{item.quantity}</span>
                          <button
                            onClick={() =>
                              handleQuantityChange(item.productId, item.pharmacyId, item.quantity + 1)
                            }
                            disabled={item.quantity >= item.availableQuantity}
                            className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>
                        <p className="text-sm font-bold text-gray-900">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </p>
                        <button
                          onClick={() => handleRemove(item.productId, item.pharmacyId)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Checkout Button */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  {hasPrescriptionRequired && (
                    <p className="text-sm text-yellow-600 mb-2">
                      ⚠️ This order requires a prescription. You'll be asked to upload it during checkout.
                    </p>
                  )}
                  <button
                    onClick={() => handleProceedToCheckout(pharmacyId, items)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg transition-all"
                  >
                    Proceed to Checkout - ₹{(total + 30).toFixed(2)} (₹{total.toFixed(2)} + ₹30 delivery)
                  </button>
                </div>
              </div>
            );
          })}

          {/* Grand Total */}
          {Object.keys(cartByPharmacy).length > 1 && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">Grand Total (All Pharmacies)</p>
                  <p className="text-sm opacity-90">
                    {cart.length} item(s) from {Object.keys(cartByPharmacy).length} pharmacy(ies)
                  </p>
                </div>
                <p className="text-3xl font-bold">₹{grandTotal.toFixed(2)}</p>
              </div>
              <p className="text-sm mt-2 opacity-75">
                Note: You may need to checkout separately for each pharmacy
              </p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

