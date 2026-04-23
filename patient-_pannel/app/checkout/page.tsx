"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { apiPost, apiFetch } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { cartUtils, CartItem } from "@/lib/cart";

interface Pharmacy {
  _id: string;
  name: string;
  address: string;
  phone?: string;
}

interface CheckoutData {
  pharmacyId: string;
  items: Array<{ medicineName: string; quantity: number }>;
  totalAmount: number;
  deliveryCharge: number;
  itemsDetails: CartItem[];
}

type PaymentMethod = "CASH" | "CARD" | "UPI" | "WALLET" | "NET_BANKING";
type DeliveryType = "DELIVERY" | "PICKUP";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pharmacyIdParam = searchParams.get("pharmacy");

  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("DELIVERY");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const hasPrescriptionRequired = checkoutData?.itemsDetails.some(
    (item) => item.prescriptionRequired
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) {
        router.replace("/");
        return;
      }
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setPhoneNumber(userData.phone || "");

      // Get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => console.log("Location access denied")
        );
      }

      // Load checkout data
      const checkoutDataStr = sessionStorage.getItem("checkoutData");
      if (checkoutDataStr) {
        try {
          const data: CheckoutData = JSON.parse(checkoutDataStr);
          if (pharmacyIdParam && data.pharmacyId === pharmacyIdParam) {
            setCheckoutData(data);
            loadPharmacy(data.pharmacyId);
          } else {
            setCheckoutData(data);
            loadPharmacy(data.pharmacyId);
          }
        } catch (error) {
          console.error("Error parsing checkout data:", error);
          router.push("/cart");
        }
      } else {
        router.push("/cart");
      }
    }
  }, [router, pharmacyIdParam]);

  const loadPharmacy = async (pharmacyId: string) => {
    try {
      const data = await apiFetch(`/api/public/pharmacies`);
      const pharmacies = await data.json();
      const pharmacyData = pharmacies.data?.find(
        (p: Pharmacy) => p._id === pharmacyId
      ) || pharmacies.find((p: Pharmacy) => p._id === pharmacyId);
      if (pharmacyData) {
        setPharmacy(pharmacyData);
      }
    } catch (error) {
      console.error("Failed to load pharmacy:", error);
    }
  };

  const handlePrescriptionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Please upload an image or PDF file");
      return;
    }

    setPrescriptionFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPrescriptionPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPrescriptionPreview(null);
    }
  };

  const uploadPrescription = async (): Promise<string | null> => {
    if (!prescriptionFile) return null;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", prescriptionFile);

      const token = localStorage.getItem("token");
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

      const response = await fetch(`${API_BASE}/api/public/upload/prescription`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload prescription");
      }

      const data = await response.json();
      return data.url || data.fileUrl || null;
    } catch (error: any) {
      toast.error(error.message || "Failed to upload prescription");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!checkoutData || !user) return;

    // Validation
    if (deliveryType === "DELIVERY" && !deliveryAddress.trim()) {
      toast.error("Please enter delivery address");
      return;
    }

    if (!phoneNumber.trim()) {
      toast.error("Please enter phone number");
      return;
    }

    if (hasPrescriptionRequired && !prescriptionFile) {
      toast.error("Please upload prescription for prescription-required medicines");
      return;
    }

    setLoading(true);

    try {
      // Upload prescription if required
      let prescriptionImageUrl: string | null = null;
      if (prescriptionFile) {
        prescriptionImageUrl = await uploadPrescription();
        if (hasPrescriptionRequired && !prescriptionImageUrl) {
          setLoading(false);
          return;
        }
      }

      // Create order
      const orderPayload = {
        patientId: user.id || user._id,
        pharmacyId: checkoutData.pharmacyId,
        items: checkoutData.items,
        status: "PENDING",
        deliveryType,
        deliveryAddress: deliveryType === "DELIVERY" ? deliveryAddress : undefined,
        address: deliveryType === "DELIVERY" ? deliveryAddress : pharmacy?.address,
        phoneNumber,
        totalAmount: checkoutData.totalAmount,
        deliveryCharge: deliveryType === "DELIVERY" ? checkoutData.deliveryCharge : 0,
        prescriptionImageUrl,
        patientLocation: userLocation
          ? {
              latitude: userLocation.lat,
              longitude: userLocation.lng,
            }
          : undefined,
      };

      const order = await apiPost("/api/orders/medicine-order", orderPayload);

      toast.success("Order placed successfully!");

      // Clear cart items for this pharmacy
      checkoutData.itemsDetails.forEach((item) => {
        cartUtils.removeFromCart(item.productId, item.pharmacyId);
      });

      // Clear checkout data
      sessionStorage.removeItem("checkoutData");

      // Redirect to order tracking
      const orderId = (order as any)._id || (order as any).id;
      router.push(`/orders/track/${orderId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  if (!checkoutData || !user) {
    return (
      <DashboardLayout title="Checkout">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const subtotal = checkoutData.totalAmount - checkoutData.deliveryCharge;
  const finalTotal =
    deliveryType === "DELIVERY"
      ? subtotal + checkoutData.deliveryCharge
      : subtotal;

  return (
    <DashboardLayout title="Checkout" description="Review and place your order">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
          
          {pharmacy && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-1">🏥 {pharmacy.name}</h3>
              <p className="text-sm text-gray-600">{pharmacy.address}</p>
              {pharmacy.phone && (
                <p className="text-sm text-gray-600">📞 {pharmacy.phone}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {checkoutData.itemsDetails.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.medicineName}</p>
                  {item.brandName && (
                    <p className="text-sm text-gray-600">Brand: {item.brandName}</p>
                  )}
                  {item.prescriptionRequired && (
                    <span className="inline-block mt-1 bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">
                      📋 Rx Required
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                  <p className="font-semibold text-gray-900">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal:</span>
              <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Delivery Charge:</span>
              <span className="font-semibold">
                {deliveryType === "DELIVERY" ? `₹${checkoutData.deliveryCharge.toFixed(2)}` : "FREE"}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-300">
              <span>Total:</span>
              <span>₹{finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Options */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Delivery Options</h2>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-all">
              <input
                type="radio"
                name="deliveryType"
                value="DELIVERY"
                checked={deliveryType === "DELIVERY"}
                onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                className="w-5 h-5 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">🚚 Home Delivery</div>
                <div className="text-sm text-gray-600">
                  Delivery charge: ₹{checkoutData.deliveryCharge.toFixed(2)}
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-all">
              <input
                type="radio"
                name="deliveryType"
                value="PICKUP"
                checked={deliveryType === "PICKUP"}
                onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                className="w-5 h-5 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">🏥 Pharmacy Pickup</div>
                <div className="text-sm text-gray-600">Pick up from pharmacy (FREE)</div>
              </div>
            </label>
          </div>

          {deliveryType === "DELIVERY" && (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Delivery Address <span className="text-red-500">*</span>
              </label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={3}
                placeholder="Enter complete delivery address..."
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                required
              />
            </div>
          )}
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h2>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Enter 10-digit phone number"
              maxLength={10}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              required
            />
          </div>
        </div>

        {/* Prescription Upload */}
        {hasPrescriptionRequired && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Prescription Upload <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Some items in your order require a valid prescription. Please upload a clear image or PDF of your prescription.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Upload Prescription (Image or PDF, Max 5MB)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handlePrescriptionUpload}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {prescriptionPreview && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Preview:</p>
                  <img
                    src={prescriptionPreview}
                    alt="Prescription preview"
                    className="max-w-full h-auto max-h-64 rounded-lg border border-gray-200"
                  />
                </div>
              )}

              {prescriptionFile && !prescriptionPreview && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700">
                    📄 File selected: {prescriptionFile.name} ({(prescriptionFile.size / 1024).toFixed(2)} KB)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Method */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Method</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(["CARD", "UPI", "WALLET", "NET_BANKING", "CASH"] as PaymentMethod[]).map((method) => (
              <label
                key={method}
                className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-all ${
                  paymentMethod === method
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="font-medium text-gray-900">{method}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Place Order Button */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white text-lg font-semibold">Total Amount</p>
              <p className="text-white text-3xl font-bold">₹{finalTotal.toFixed(2)}</p>
            </div>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={loading || uploading || (hasPrescriptionRequired && !prescriptionFile)}
            className="w-full px-6 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {uploading
              ? "Uploading Prescription..."
              : loading
              ? "Placing Order..."
              : hasPrescriptionRequired && !prescriptionFile
              ? "Please Upload Prescription"
              : "Place Order"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout title="Checkout">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </DashboardLayout>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

