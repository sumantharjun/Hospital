"use client";

interface Product {
  _id: string;
  medicineName: string;
  composition: string;
  brandName?: string;
  category?: string;
  sellingPrice?: number;
  mrp?: number;
  discount?: number;
  quantity: number;
  imageUrl?: string;
  prescriptionRequired?: boolean;
  daysUntilExpiry?: number;
  pharmacy?: {
    _id: string;
    name: string;
    address?: string;
    distance?: number;
  };
}

interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
  isInCart: boolean;
}

export default function ProductCard({ product, onAddToCart, isInCart }: ProductCardProps) {
  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case "MEDICINE":
        return "💊";
      case "MEDICAL_EQUIPMENT":
        return "🩺";
      case "HEALTH_SUPPLEMENT":
        return "💊";
      case "PERSONAL_CARE":
        return "🧴";
      default:
        return "💊";
    }
  };

  const getExpiryBadge = () => {
    if (!product.daysUntilExpiry) return null;
    if (product.daysUntilExpiry < 0) {
      return (
        <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
          EXPIRED
        </span>
      );
    }
    if (product.daysUntilExpiry <= 30) {
      return (
        <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
          {product.daysUntilExpiry}d left
        </span>
      );
    }
    return null;
  };

  const sellingPrice = product.sellingPrice || product.mrp || 0;
  const discountPercent =
    product.mrp && product.mrp > sellingPrice
      ? Math.round(((product.mrp - sellingPrice) / product.mrp) * 100)
      : product.discount || 0;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all relative">
      {/* Product Image */}
      <div className="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.medicineName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="text-6xl">{getCategoryIcon(product.category)}</div>
        )}
        {getExpiryBadge()}
        {product.prescriptionRequired && (
          <span className="absolute top-2 left-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
            📋 Rx Required
          </span>
        )}
        {discountPercent > 0 && (
          <span className="absolute top-2 left-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
            {discountPercent}% OFF
          </span>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
          {product.medicineName}
        </h3>
        {product.brandName && (
          <p className="text-xs text-gray-600 mb-1">Brand: {product.brandName}</p>
        )}
        <p className="text-xs text-gray-500 mb-2 line-clamp-1">{product.composition}</p>

        {/* Pharmacy Info */}
        {product.pharmacy && (
          <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
            <span>🏥</span>
            <span className="truncate">{product.pharmacy.name}</span>
            {product.pharmacy.distance && (
              <span className="text-gray-500">• {product.pharmacy.distance.toFixed(1)} km</span>
            )}
          </div>
        )}

        {/* Stock Status */}
        <div className="mb-3">
          {product.quantity > 0 ? (
            <span className="text-xs text-green-600 font-semibold">✓ In Stock ({product.quantity})</span>
          ) : (
            <span className="text-xs text-red-600 font-semibold">✗ Out of Stock</span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold text-gray-900">
            ₹{sellingPrice.toFixed(2)}
          </span>
          {product.mrp && product.mrp > sellingPrice && (
            <>
              <span className="text-sm text-gray-400 line-through">₹{product.mrp.toFixed(2)}</span>
              {discountPercent > 0 && (
                <span className="text-xs text-green-600 font-semibold">({discountPercent}% off)</span>
              )}
            </>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={onAddToCart}
          disabled={product.quantity === 0 || isInCart}
          className={`w-full py-2 rounded-lg font-semibold text-sm transition-all ${
            product.quantity === 0
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : isInCart
              ? "bg-green-600 text-white cursor-default"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {product.quantity === 0
            ? "Out of Stock"
            : isInCart
            ? "✓ Added to Cart"
            : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

