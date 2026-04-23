export const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export const ORDER_STATUSES: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  ORDER_RECEIVED: { label: "Order Received", color: "bg-blue-100 text-blue-800" },
  MEDICINE_RECEIVED: { label: "Medicine Received", color: "bg-purple-100 text-purple-800" },
  SENT_TO_PHARMACY: { label: "Sent to Pharmacy", color: "bg-indigo-100 text-indigo-800" },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-800" },
  PACKED: { label: "Packed", color: "bg-teal-100 text-teal-800" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "bg-orange-100 text-orange-800" },
  DELIVERED: { label: "Delivered", color: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

export const PRESCRIPTION_STATUSES: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  SENT_TO_PHARMACY: { label: "Sent to Pharmacy", color: "bg-blue-100 text-blue-800" },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-800" },
  FULFILLED: { label: "Fulfilled", color: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800" },
};

export const DISTRIBUTOR_ORDER_STATUSES: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-800" },
  DISPATCHED: { label: "Dispatched", color: "bg-blue-100 text-blue-800" },
  DELIVERED: { label: "Delivered", color: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

