

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  pharmacyId?: string;
}

export interface InventoryItem {
  _id: string;
  pharmacyId: string;
  medicineName: string;
  composition?: string; 
  brandName?: string; 
  quantity: number;
  minStockLevel: number;
  threshold?: number; // Backend field
  expiryDate?: string;
  batchNumber?: string;
  purchasePrice?: number; 
  sellingPrice?: number; // Selling price
  unitPrice?: number; // Legacy field
  price?: number; // Legacy field
  mrp?: number; // Maximum Retail Price
  margin?: number; // Margin percentage
  discount?: number; // Discount percentage
  rackNumber?: string; // Rack location
  rowNumber?: string; // Row/shelf location
  supplier?: string;
  distributorId?: string; // ID of distributor for future orders
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  _id: string;
  patientId: string;
  pharmacyId: string;
  prescriptionId?: string;
  prescriptionImageUrl?: string; // Uploaded prescription image URL
  prescriptionVerified?: boolean; // Whether prescription was verified by pharmacy
  items: OrderItem[];
  status: OrderStatus;
  deliveryType: "DELIVERY" | "PICKUP";
  deliveryAddress?: string;
  phoneNumber?: string;
  totalAmount?: number;
  deliveryCharge?: number;
  tax?: number;
  discount?: number;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
  estimatedDeliveryTime?: string;
  deliveredAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type OrderStatus =
  | "PENDING"
  | "ORDER_RECEIVED"
  | "MEDICINE_RECEIVED"
  | "SENT_TO_PHARMACY"
  | "ACCEPTED"
  | "PACKED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderItem {
  prescriptionItemId?: string;
  medicineName: string;
  quantity: number;
}

export interface Prescription {
  _id: string;
  patientId: string;
  doctorId: string;
  pharmacyId?: string;
  items: PrescriptionItem[];
  status: PrescriptionStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PrescriptionStatus =
  | "PENDING"
  | "SENT_TO_PHARMACY"
  | "ACCEPTED"
  | "FULFILLED"
  | "REJECTED";

export interface PrescriptionItem {
  medicineName: string;
  quantity: number;
  dosage?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
}

export interface DistributorOrder {
  _id: string;
  pharmacyId: string;
  distributorId: string;
  medicineName: string;
  category?: "MEDICINE" | "MEDICAL_EQUIPMENT" | "HEALTH_SUPPLEMENT" | "PERSONAL_CARE";
  quantity: number;
  status: DistributorOrderStatus;
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

export interface Pharmacy {
  _id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  licenseNumber?: string;
  ownerName?: string;
}

export interface DeliveryAgent {
  id: string;
  name: string;
  phone: string;
  status: "AVAILABLE" | "BUSY" | "OFFLINE";
}

export interface PharmacyInvoice {
  _id: string;
  invoiceNumber: string;
  pharmacyId: string;
  patientId?: string;
  orderId?: string;
  invoiceType: "PATIENT_ORDER" | "WALK_IN" | "MANUAL_BILL";
  items: PharmacyInvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  paymentMethod?: "CASH" | "CARD" | "UPI" | "NET_BANKING" | "WALLET";
  paymentStatus: "PENDING" | "PAID" | "PARTIAL" | "REFUNDED";
  paidAmount?: number;
  dueAmount?: number;
  billDate: string;
  createdBy: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PharmacyInvoiceItem {
  inventoryItemId: string;
  medicineName: string;
  composition: string;
  brandName?: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  discount: number;
  discountAmount: number;
  purchasePrice: number;
  margin: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  rackNumber?: string;
  rowNumber?: string;
}

export interface StockAudit {
  _id: string;
  pharmacyId: string;
  auditDate: string;
  auditType: "DAILY" | "WEEKLY" | "MONTHLY" | "AD_HOC";
  items: StockAuditItem[];
  totalItems: number;
  itemsWithVariance: number;
  totalVarianceValue?: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REVIEWED" | "DISPUTED";
  openingStockValue?: number;
  totalSalesValue?: number;
  closingStockValue?: number;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewedNotes?: string;
  createdBy: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockAuditItem {
  inventoryItemId: string;
  medicineName: string;
  composition: string;
  brandName?: string;
  batchNumber: string;
  openingStock: number;
  systemSales: number;
  manualBills: number;
  totalSales: number;
  expectedClosingStock: number;
  actualClosingStock?: number;
  variance?: number;
  varianceReason?: string;
}

export interface MedicineSearchResult {
  query: string;
  results: {
    composition: string;
    medicineName: string;
    brands: {
      inventoryItemId: string;
      brandName: string;
      batchNumber: string;
      expiryDate: string;
      daysUntilExpiry: number;
      isExpiringSoon: boolean;
      isExpired: boolean;
      availableQuantity: number;
      costPrice: number;
      sellingPrice: number;
      mrp: number;
      margin: number;
      rackNumber?: string;
      rowNumber?: string;
    }[];
  }[];
  totalBrands: number;
  totalCompositions: number;
}

