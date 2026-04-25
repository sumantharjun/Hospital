export type LabRole = "LAB_ADMIN" | "LAB_OPERATOR";

export interface AuthUser {
  sub: string;
  role: LabRole;
  name?: string;
  email?: string;
}

export interface LabPatient {
  _id: string;
  labPatientId: string;
  name: string;
  age: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  phone: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  referredBy?: string;
  registrationCharge: number;
  totalVisits: number;
  createdAt: string;
}

export interface TestParameter {
  _id?: string;
  name: string;
  unit: string;
  normalMin?: number;
  normalMax?: number;
  referenceText?: string;
  printOrder: number;
}

export interface LabTest {
  _id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  sampleType: string;
  parameters: TestParameter[];
  price: number;
  taxPercent: number;
  turnAroundTimeHours: number;
  isActive: boolean;
  createdAt: string;
}

export interface LabPackage {
  _id: string;
  name: string;
  description?: string;
  tests: LabTest[];
  originalPrice: number;
  price: number;
  discountPercent: number;
  taxPercent: number;
  isActive: boolean;
}

export interface OrderTest {
  testId: string;
  testName: string;
  price: number;
}

export interface LabOrder {
  _id: string;
  orderId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientAge: number;
  patientGender: string;
  tests: OrderTest[];
  packages: { packageId: string; packageName: string; price: number }[];
  sampleId?: string;
  sampleCollectedAt?: string;
  status: "PENDING" | "COLLECTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  assignedTechnician?: string;
  subtotal: number;
  taxTotal: number;
  discountPercent: number;
  discountAmount: number;
  grandTotal: number;
  billId?: string;
  createdAt: string;
}

export interface ParameterResult {
  parameterId?: string;
  parameterName: string;
  unit: string;
  value: string;
  numericValue?: number;
  normalMin?: number;
  normalMax?: number;
  isAbnormal: boolean;
  remarks?: string;
}

export interface LabResult {
  _id: string;
  orderId: string;
  testId: string;
  testName: string;
  parameterResults: ParameterResult[];
  status: "PENDING" | "ENTERED" | "APPROVED" | "REJECTED";
  enteredBy?: string;
  enteredAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  overallRemarks?: string;
}

export interface PaymentEntry {
  amount: number;
  mode: "CASH" | "CARD" | "UPI";
  referenceNumber?: string;
  receivedAt: string;
  receivedBy: string;
}

export interface LabBill {
  _id: string;
  billNumber: string;
  orderId: string;
  patientName: string;
  patientPhone: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; taxPercent: number; taxAmount: number; total: number }>;
  registrationCharge: number;
  subtotal: number;
  taxTotal: number;
  discountPercent: number;
  discountAmount: number;
  grandTotal: number;
  paidAmount: number;
  outstandingBalance: number;
  paymentHistory: PaymentEntry[];
  status: "DRAFT" | "ACTIVE" | "PARTIAL" | "PAID" | "CANCELLED";
  createdAt: string;
}

export interface LabSettings {
  labName: string;
  address?: string;
  phone?: string;
  email?: string;
  registrationCharge: number;
  defaultTaxPercent: number;
  reportHeader?: string;
  reportFooter?: string;
  doctorSignatureName?: string;
}
