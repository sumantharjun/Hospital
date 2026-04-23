import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface CustomerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerInfo: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  paymentMethod: "CASH" | "CARD" | "UPI" | "NET_BANKING" | "WALLET" | "";
  onSave: (customerInfo: { name: string; phone: string; email: string; address: string }, paymentMethod: "CASH" | "CARD" | "UPI" | "NET_BANKING" | "WALLET" | "") => void;
  errors?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    paymentMethod?: string;
  };
  /** Walk-in/offline: only name & phone required; email & address optional */
  walkInOnly?: boolean;
}

export default function CustomerDetailsModal({
  isOpen,
  onClose,
  customerInfo: initialCustomerInfo,
  paymentMethod: initialPaymentMethod,
  onSave,
  errors = {},
  walkInOnly = false,
}: CustomerDetailsModalProps) {
  const [customerInfo, setCustomerInfo] = useState(initialCustomerInfo);
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);

  // Update local state when props change
  useEffect(() => {
    setCustomerInfo(initialCustomerInfo);
    setPaymentMethod(initialPaymentMethod);
  }, [initialCustomerInfo, initialPaymentMethod, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(customerInfo, paymentMethod);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col mx-4"
            >
              {/* Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-linear-to-r from-purple-600 to-indigo-600">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      {walkInOnly ? "Offline / Walk-in Customer" : "Customer Details"}
                    </h2>
                    <p className="text-purple-100 text-xs sm:text-sm mt-1">
                      {walkInOnly
                        ? "Name & phone required. Add payment method to generate bill (no prescription needed)."
                        : "Fill customer information to generate invoice"}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white hover:bg-white/20 rounded-full p-1 sm:p-2 transition-all"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => {
                        setCustomerInfo({ ...customerInfo, name: e.target.value });
                      }}
                      className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-2 outline-none transition-all ${
                        errors.name ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-gray-300 focus:border-purple-500 focus:ring-purple-200"
                      }`}
                      placeholder="Enter customer name"
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setCustomerInfo({ ...customerInfo, phone: value });
                      }}
                      className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-2 outline-none transition-all ${
                        errors.phone ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-gray-300 focus:border-purple-500 focus:ring-purple-200"
                      }`}
                      placeholder="Enter 10-digit phone number"
                    />
                    {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address {!walkInOnly && <span className="text-red-500">*</span>}
                      {walkInOnly && <span className="text-gray-400 text-xs ml-1">(optional)</span>}
                    </label>
                    <input
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => {
                        setCustomerInfo({ ...customerInfo, email: e.target.value });
                      }}
                      className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-2 outline-none transition-all ${
                        errors.email ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-gray-300 focus:border-purple-500 focus:ring-purple-200"
                      }`}
                      placeholder="Enter email address"
                    />
                    {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Address {!walkInOnly && <span className="text-red-500">*</span>}
                      {walkInOnly && <span className="text-gray-400 text-xs ml-1">(optional)</span>}
                    </label>
                    <textarea
                      value={customerInfo.address}
                      onChange={(e) => {
                        setCustomerInfo({ ...customerInfo, address: e.target.value });
                      }}
                      rows={3}
                      className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-2 outline-none transition-all resize-none ${
                        errors.address ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-gray-300 focus:border-purple-500 focus:ring-purple-200"
                      }`}
                      placeholder="Enter complete address"
                    />
                    {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => {
                        setPaymentMethod(e.target.value as "CASH" | "CARD" | "UPI" | "NET_BANKING" | "WALLET" | "");
                      }}
                      className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-2 outline-none transition-all ${
                        errors.paymentMethod ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-gray-300 focus:border-purple-500 focus:ring-purple-200"
                      }`}
                    >
                      <option value="">Select Payment Method</option>
                      <option value="CASH">💵 Cash</option>
                      <option value="CARD">💳 Card (Debit/Credit)</option>
                      <option value="UPI">📱 UPI</option>
                      <option value="NET_BANKING">🏦 Net Banking</option>
                      <option value="WALLET">👛 Wallet</option>
                    </select>
                    {errors.paymentMethod && <p className="mt-1 text-xs text-red-600">{errors.paymentMethod}</p>}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
                <button
                  onClick={onClose}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 bg-linear-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm sm:text-base font-semibold hover:shadow-lg transition-all"
                >
                  Save & Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

