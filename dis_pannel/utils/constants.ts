export const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export const DISTRIBUTOR_ORDER_STATUSES: Record<string, { label: string; color: string; nextStatus?: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", nextStatus: "ACCEPTED" },
  ACCEPTED: { label: "Accepted", color: "bg-blue-100 text-blue-800", nextStatus: "DISPATCHED" },
  DISPATCHED: { label: "Dispatched", color: "bg-purple-100 text-purple-800", nextStatus: "DELIVERED" },
  DELIVERED: { label: "Delivered", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

export const DELIVERY_STATUSES = {
  PICKED: "Picked",
  OUT_FOR_DELIVERY: "Out For Delivery",
  DELIVERED: "Delivered",
};

export const AGENT_STATUSES: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: "Available", color: "bg-green-100 text-green-800" },
  BUSY: { label: "Busy", color: "bg-orange-100 text-orange-800" },
  OFFLINE: { label: "Offline", color: "bg-gray-100 text-gray-800" },
};

export const INVOICE_STATUSES: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  PAID: { label: "Paid", color: "bg-green-100 text-green-800" },
  OVERDUE: { label: "Overdue", color: "bg-red-100 text-red-800" },
};

