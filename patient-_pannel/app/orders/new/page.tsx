"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiGet, apiPost } from "@/lib/api";

interface Pharmacy {
  _id: string;
  name: string;
  address: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>("");
  const [items, setItems] = useState<Array<{ medicineName: string; quantity: number }>>([
    { medicineName: "", quantity: 1 },
  ]);
  const [deliveryType, setDeliveryType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isFromPrescription, setIsFromPrescription] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        router.replace("/");
        return;
      }
      
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      
      // Check if there's a prescription order
      const prescriptionOrderStr = sessionStorage.getItem("prescriptionOrder");
      if (prescriptionOrderStr) {
        try {
          const prescriptionOrder = JSON.parse(prescriptionOrderStr);
          if (prescriptionOrder.items && Array.isArray(prescriptionOrder.items)) {
            setItems(prescriptionOrder.items);
            setIsFromPrescription(true);
            sessionStorage.removeItem("prescriptionOrder");
          }
        } catch (error) {
          console.error("Error parsing prescription order:", error);
        }
      }
      
      // Get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => {
            console.log("Location access denied");
          }
        );
      }
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    fetchPharmacies();
  }, [token, userLocation]);

  const fetchPharmacies = async () => {
    try {
      const data = await apiGet<{ data?: Pharmacy[] } | Pharmacy[]>("/api/public/pharmacies");
      let pharmaciesList: Pharmacy[] = [];
      if (Array.isArray(data)) {
        pharmaciesList = data;
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        pharmaciesList = data.data;
      }
      
      // Calculate distances if user location is available
      if (userLocation) {
        pharmaciesList = pharmaciesList.map((pharmacy) => {
          if (pharmacy.latitude && pharmacy.longitude) {
            const distance = calculateDistance(
              userLocation.lat,
              userLocation.lng,
              pharmacy.latitude,
              pharmacy.longitude
            );
            return { ...pharmacy, distance };
          }
          return pharmacy;
        });
        
        // Sort by distance
        pharmaciesList.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
      }
      
      setPharmacies(pharmaciesList);
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const handleAddItem = () => {
    setItems([...items, { medicineName: "", quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user?.id || !selectedPharmacy) return;

    // Validate items
    const validItems = items.filter(item => item.medicineName.trim() !== "");
    if (validItems.length === 0) {
      toast.error("Please add at least one medicine");
      return;
    }

    if (deliveryType === "DELIVERY" && !deliveryAddress.trim()) {
      toast.error("Please enter delivery address");
      return;
    }

    // Store order data and redirect to checkout
    const selectedPharmacyData = pharmacies.find(p => p._id === selectedPharmacy);
    const orderData = {
      pharmacyId: selectedPharmacy,
      pharmacy: selectedPharmacyData,
      items: validItems,
      deliveryType,
      deliveryAddress: deliveryType === "DELIVERY" ? deliveryAddress : undefined,
      phoneNumber: user.phone || "",
      patientLocation: userLocation ? {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      } : undefined,
      pharmacyLocation: selectedPharmacyData?.latitude && selectedPharmacyData?.longitude ? {
        latitude: selectedPharmacyData.latitude,
        longitude: selectedPharmacyData.longitude,
      } : undefined,
    };

    // Store in sessionStorage to pass to checkout
    sessionStorage.setItem("pendingOrder", JSON.stringify(orderData));
    router.push("/orders/checkout");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">New Order</h1>
              <p className="mt-1 text-sm text-gray-600">Order medicines from nearby pharmacy</p>
            </div>
            <Link
              href="/orders"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {isFromPrescription && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
            <p className="text-sm font-semibold text-green-900">
              ✓ Medicines from your prescription have been added. You can modify quantities or add more medicines.
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm p-8 shadow-lg">
          {/* Select Pharmacy */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Select Pharmacy {userLocation && "(Sorted by distance)"}
            </label>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {pharmacies.map((pharmacy) => (
                <button
                  key={pharmacy._id}
                  type="button"
                  onClick={() => setSelectedPharmacy(pharmacy._id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selectedPharmacy === pharmacy._id
                      ? "border-blue-900 bg-blue-50"
                      : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{pharmacy.name}</h3>
                      <p className="text-sm text-gray-600">{pharmacy.address}</p>
                      {pharmacy.phone && (
                        <p className="text-sm text-gray-600">{pharmacy.phone}</p>
                      )}
                    </div>
                    {pharmacy.distance !== undefined && (
                      <span className="text-sm font-semibold text-blue-900">
                        {pharmacy.distance.toFixed(1)} km
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Medicine Items */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-lg font-bold text-gray-900">Medicines</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 shadow-sm transition-colors"
              >
                + Add Medicine
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <input
                      type="text"
                      required={index === 0}
                      value={item.medicineName}
                      onChange={(e) => handleItemChange(index, "medicineName", e.target.value)}
                      placeholder="Medicine name"
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Type */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Delivery Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="DELIVERY"
                  checked={deliveryType === "DELIVERY"}
                  onChange={(e) => setDeliveryType(e.target.value as "DELIVERY" | "PICKUP")}
                  className="mr-2"
                />
                <span className="text-gray-700">Delivery</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="PICKUP"
                  checked={deliveryType === "PICKUP"}
                  onChange={(e) => setDeliveryType(e.target.value as "DELIVERY" | "PICKUP")}
                  className="mr-2"
                />
                <span className="text-gray-700">Pickup</span>
              </label>
            </div>
          </div>

          {/* Delivery Address */}
          {deliveryType === "DELIVERY" && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Delivery Address
              </label>
              <textarea
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                placeholder="Enter your delivery address"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedPharmacy}
            className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Processing..." : "Continue to Checkout"}
          </button>
        </form>
      </div>
    </div>
  );
}

