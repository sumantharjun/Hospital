// Common types for the distributor panel

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  distributorId?: string;
}

export interface WarehouseInventory {
  _id: string;
  distributorId: string;
  medicineName: string;
  quantity: number;
  minStockLevel: number;
  unitPrice: number;
  supplier?: string;
  batchNumber?: string;
  expiryDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DistributorOrder {
  _id: string;
  pharmacyId: string;
  distributorId: string;
  medicineName: string;
  quantity: number;
  status: DistributorOrderStatus;
  deliveryOtp?: string;
  deliveryProofImageUrl?: string;
  deliveryAgentId?: string;
  deliveryAgentName?: string;
  deliveryAgentPhone?: string;
  pickedAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DistributorOrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED";

export interface DeliveryAgent {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  status: "AVAILABLE" | "BUSY" | "OFFLINE";
  currentOrderId?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface Notification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  status: "PENDING" | "SENT" | "FAILED" | "READ";
  metadata?: any;
  createdAt?: string;
}

export interface Invoice {
  _id: string;
  distributorId: string;
  pharmacyId: string;
  orderId: string;
  invoiceNumber: string;
  amount: number;
  tax: number;
  totalAmount: number;
  status: "PENDING" | "PAID" | "OVERDUE";
  dueDate: string;
  paidAt?: string;
  createdAt?: string;
}

export interface Distributor {
  _id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  licenseNumber?: string;
  ownerName?: string;
}

