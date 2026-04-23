"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiGet } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import ProductCard from "@/components/ProductCard";
import { cartUtils, CartItem } from "@/lib/cart";

interface Product {
  _id: string;
  medicineName: string;
  composition: string;
  brandName?: string;
  category?: string;
  sellingPrice: number;
  mrp?: number;
  discount?: number;
  quantity: number;
  imageUrl?: string;
  description?: string;
  prescriptionRequired?: boolean;
  daysUntilExpiry?: number;
  pharmacy?: {
    _id: string;
    name: string;
    address: string;
    phone?: string;
    distance?: number;
  };
}

interface Category {
  value: string;
  label: string;
  icon: string;
  description: string;
}

export default function MedicalStorePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: "", max: "" });
  const [prescriptionFilter, setPrescriptionFilter] = useState<string>("");
  const [cartCount, setCartCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const itemsPerPage = 20;
  const [compositionResults, setCompositionResults] = useState<{
    compositions: Array<{
      composition: string;
      medicineName: string;
      brands: Array<{
        inventoryItemId: string;
        brandName: string;
        batchNumber?: string;
        expiryDate?: string;
        daysUntilExpiry?: number;
        availableQuantity: number;
        sellingPrice: number;
        mrp: number;
        pharmacy?: { _id: string; name: string; address?: string; phone?: string; distance?: number };
      }>;
    }>;
    query: string;
  } | null>(null);
  const [loadingComposition, setLoadingComposition] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) {
        router.replace("/");
        return;
      }
      setUser(JSON.parse(storedUser));

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
    loadCategories();
    updateCartCount();
    
    // Listen for cart updates
    const handleCartUpdate = () => updateCartCount();
    window.addEventListener("cartUpdated", handleCartUpdate);
    return () => window.removeEventListener("cartUpdated", handleCartUpdate);
  }, []);

  useEffect(() => {
    if (user) {
      loadProducts();
    }
  }, [user, selectedCategory, searchQuery, priceRange, prescriptionFilter, userLocation, currentPage]);

  useEffect(() => {
    if (!user || !searchQuery || searchQuery.trim().length < 2) {
      setCompositionResults(null);
      return;
    }
    const params = new URLSearchParams({ search: searchQuery.trim() });
    if (userLocation) {
      params.append("latitude", userLocation.lat.toString());
      params.append("longitude", userLocation.lng.toString());
      params.append("radius", "15");
    }
    setLoadingComposition(true);
    apiGet<{ compositions: any[]; query: string }>(`/api/public/products/by-composition?${params}`)
      .then((data) => {
        setCompositionResults(data);
      })
      .catch(() => setCompositionResults(null))
      .finally(() => setLoadingComposition(false));
  }, [user, searchQuery, userLocation]);

  const updateCartCount = () => {
    setCartCount(cartUtils.getCartCount());
  };

  const loadCategories = async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const response = await fetch(`${API_BASE}/api/public/products/categories/list`);
      if (!response.ok) throw new Error("Failed to load categories");
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error: any) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (selectedCategory) params.append("category", selectedCategory);
      if (searchQuery) params.append("search", searchQuery);
      if (priceRange.min) params.append("minPrice", priceRange.min);
      if (priceRange.max) params.append("maxPrice", priceRange.max);
      if (prescriptionFilter) params.append("prescriptionRequired", prescriptionFilter);
      if (userLocation) {
        params.append("latitude", userLocation.lat.toString());
        params.append("longitude", userLocation.lng.toString());
        params.append("radius", "10");
      }
      params.append("limit", itemsPerPage.toString());
      params.append("skip", ((currentPage - 1) * itemsPerPage).toString());

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const response = await fetch(`${API_BASE}/api/public/products?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load products");
      const data = await response.json();

      if (currentPage === 1) {
        setProducts(data.products || []);
      } else {
        setProducts((prev) => [...prev, ...(data.products || [])]);
      }
      setHasMore(data.hasMore || false);
    } catch (error: any) {
      toast.error(error.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    const cartItem: CartItem = {
      productId: product._id,
      medicineName: product.medicineName,
      composition: product.composition,
      brandName: product.brandName,
      category: product.category,
      quantity: 1,
      price: product.sellingPrice,
      mrp: product.mrp,
      discount: product.discount,
      imageUrl: product.imageUrl,
      pharmacyId: product.pharmacy?._id || "",
      pharmacyName: product.pharmacy?.name,
      prescriptionRequired: product.prescriptionRequired,
      availableQuantity: product.quantity,
    };

    cartUtils.addToCart(cartItem);
    toast.success("Added to cart!");
  };

  const handleAddBrandToCart = (
    composition: string,
    medicineName: string,
    brand: {
      inventoryItemId: string;
      brandName: string;
      sellingPrice: number;
      mrp: number;
      availableQuantity: number;
      pharmacy?: { _id: string; name: string };
    }
  ) => {
    const cartItem: CartItem = {
      productId: brand.inventoryItemId,
      medicineName: medicineName || composition,
      composition,
      brandName: brand.brandName,
      quantity: 1,
      price: brand.sellingPrice,
      mrp: brand.mrp,
      pharmacyId: brand.pharmacy?._id || "",
      pharmacyName: brand.pharmacy?.name,
      availableQuantity: brand.availableQuantity,
    };
    cartUtils.addToCart(cartItem);
    toast.success(`${brand.brandName} added to cart!`);
    updateCartCount();
  };

  const handleFilterReset = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setPriceRange({ min: "", max: "" });
    setPrescriptionFilter("");
    setCurrentPage(1);
  };

  const handleLoadMore = () => {
    setCurrentPage((prev) => prev + 1);
  };

  if (!user) return null;

  return (
    <DashboardLayout
      title="Medical Store"
      description="Browse and purchase medicines, medical equipment, and health products"
      actionButton={
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/cart")}
            className="relative px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Categories */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Shop by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((category) => (
              <button
                key={category.value}
                onClick={() => {
                  setSelectedCategory(selectedCategory === category.value ? "" : category.value);
                  setCurrentPage(1);
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedCategory === category.value
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <div className="text-3xl mb-2">{category.icon}</div>
                <div className="font-semibold text-sm text-gray-900">{category.label}</div>
                <div className="text-xs text-gray-500 mt-1">{category.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search medicines, brands, or composition..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>

            {/* Price Range */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min ₹"
                value={priceRange.min}
                onChange={(e) => {
                  setPriceRange({ ...priceRange, min: e.target.value });
                  setCurrentPage(1);
                }}
                className="w-24 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none text-sm"
              />
              <input
                type="number"
                placeholder="Max ₹"
                value={priceRange.max}
                onChange={(e) => {
                  setPriceRange({ ...priceRange, max: e.target.value });
                  setCurrentPage(1);
                }}
                className="w-24 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none text-sm"
              />
            </div>

            {/* Prescription Filter */}
            <select
              value={prescriptionFilter}
              onChange={(e) => {
                setPrescriptionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none text-sm"
            >
              <option value="">All Items</option>
              <option value="true">Prescription Required</option>
              <option value="false">No Prescription</option>
            </select>

            {/* Reset */}
            <button
              onClick={handleFilterReset}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Search by composition – show available brands */}
        {searchQuery.trim().length >= 2 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Search by composition or brand</h2>
            {loadingComposition ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : compositionResults?.compositions?.length ? (
              <div className="space-y-4">
                {compositionResults.compositions.map((comp, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-1">{comp.medicineName || comp.composition}</h3>
                    <p className="text-sm text-gray-500 mb-3">Composition: {comp.composition}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {comp.brands.map((brand) => (
                        <div
                          key={brand.inventoryItemId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{brand.brandName}</p>
                            <p className="text-sm text-gray-600">
                              ₹{brand.sellingPrice.toFixed(2)}
                              {brand.mrp > brand.sellingPrice && (
                                <span className="ml-2 line-through text-gray-400">₹{brand.mrp.toFixed(2)}</span>
                              )}
                            </p>
                            {brand.pharmacy && (
                              <p className="text-xs text-gray-500 mt-1">{brand.pharmacy.name}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddBrandToCart(comp.composition, comp.medicineName, brand)}
                            disabled={cartUtils.isInCart(brand.inventoryItemId, brand.pharmacy?._id || "")}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {cartUtils.isInCart(brand.inventoryItemId, brand.pharmacy?._id || "") ? "In cart" : "Add"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : !loadingComposition && compositionResults ? (
              <p className="text-gray-500 py-4">No compositions found for &quot;{searchQuery}&quot;</p>
            ) : null}
          </div>
        )}

        {/* Products Grid */}
        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500 text-lg">No products found</p>
            <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={`${product._id}-${product.pharmacy?._id}`}
                  product={product}
                  onAddToCart={() => handleAddToCart(product)}
                  isInCart={cartUtils.isInCart(product._id, product.pharmacy?._id || "")}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="text-center py-6">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? "Loading..." : "Load More Products"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

