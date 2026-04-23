import { motion, AnimatePresence } from "framer-motion";
import { MedicineSearchResult } from "@/types";

interface BrandSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchResult: MedicineSearchResult | null;
  onSelectBrand: (brand: any, composition: string) => void;
}

export default function BrandSelectionModal({
  isOpen,
  onClose,
  searchResult,
  onSelectBrand,
}: BrandSelectionModalProps) {
  if (!searchResult || !isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900 bg-opacity-30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-green-600">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Select Brand</h2>
                    <p className="text-blue-100 text-sm mt-1">
                      {searchResult.results.length} composition(s) found for "{searchResult.query}"
                    </p>
                    <p className="text-blue-200/90 text-xs mt-0.5">
                      Brands shown in expiry order (soonest first). Select brand/batch to add to bill.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {searchResult.results.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No brands found</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {searchResult.results.map((result, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {result.medicineName}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">Composition: {result.composition}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {result.brands.map((brand, brandIdx) => {
                            const isExpired = brand.isExpired;
                            const isExpiringSoon = brand.isExpiringSoon;
                            
                            return (
                              <motion.button
                                key={brandIdx}
                                onClick={() => onSelectBrand(brand, result.composition)}
                                disabled={isExpired || brand.availableQuantity === 0}
                                className={`p-4 rounded-lg border-2 text-left transition-all ${
                                  isExpired || brand.availableQuantity === 0
                                    ? "border-red-200 bg-red-50 opacity-50 cursor-not-allowed"
                                    : isExpiringSoon
                                    ? "border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100"
                                    : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50"
                                }`}
                                whileHover={!isExpired && brand.availableQuantity > 0 ? { scale: 1.02 } : {}}
                                whileTap={!isExpired && brand.availableQuantity > 0 ? { scale: 0.98 } : {}}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900">{brand.brandName}</p>
                                    <p className="text-xs text-gray-500">Batch: {brand.batchNumber}</p>
                                  </div>
                                  {isExpired && (
                                    <span className="px-2 py-1 text-xs bg-red-200 text-red-800 rounded">EXPIRED</span>
                                  )}
                                  {isExpiringSoon && !isExpired && (
                                    <span className="px-2 py-1 text-xs bg-orange-200 text-orange-800 rounded">
                                      Expires in {brand.daysUntilExpiry} days
                                    </span>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                                  <div>
                                    <p className="text-gray-500">Qty Available</p>
                                    <p className="font-semibold text-gray-900">{brand.availableQuantity}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Cost Price</p>
                                    <p className="font-semibold text-gray-900">₹{brand.costPrice.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Selling Price</p>
                                    <p className="font-semibold text-green-600">₹{brand.sellingPrice.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Margin</p>
                                    <p className="font-semibold text-blue-600">{brand.margin.toFixed(1)}%</p>
                                  </div>
                                </div>
                                
                                {(brand.rackNumber || brand.rowNumber) && (
                                  <p className="text-xs text-gray-400 mt-2">
                                    Location: {brand.rackNumber || ""}{brand.rackNumber && brand.rowNumber ? "-" : ""}{brand.rowNumber || ""}
                                  </p>
                                )}
                                
                                <p className="text-xs text-gray-400 mt-1">
                                  Expiry: {new Date(brand.expiryDate).toLocaleDateString()}
                                </p>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

