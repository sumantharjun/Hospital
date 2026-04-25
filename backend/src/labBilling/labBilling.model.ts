import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILabPayment {
  amount: number;
  mode: "CASH" | "CARD" | "UPI";
  referenceNumber?: string;
  receivedAt: Date;
  receivedBy: string;
  notes?: string;
}

export interface ILabBill extends Document {
  billNumber: string;
  labId: string;
  orderId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  patientName: string;
  patientPhone: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxPercent: number;
    taxAmount: number;
    total: number;
  }>;
  registrationCharge: number;
  subtotal: number;
  taxTotal: number;
  discountPercent: number;
  discountAmount: number;
  grandTotal: number;
  paidAmount: number;
  outstandingBalance: number;
  paymentHistory: ILabPayment[];
  status: "DRAFT" | "ACTIVE" | "PARTIAL" | "PAID" | "CANCELLED";
  notes?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const LabBillSchema = new Schema<ILabBill>(
  {
    billNumber: { type: String, required: true, unique: true },
    labId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "LabOrder", required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: "LabPatient", required: true },
    patientName: { type: String, required: true },
    patientPhone: { type: String, required: true },
    lineItems: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, required: true },
        taxPercent: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        total: { type: Number, required: true },
      },
    ],
    registrationCharge: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    paymentHistory: [
      {
        amount: { type: Number, required: true },
        mode: { type: String, enum: ["CASH", "CARD", "UPI"], required: true },
        referenceNumber: { type: String },
        receivedAt: { type: Date, default: Date.now },
        receivedBy: { type: String, required: true },
        notes: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PARTIAL", "PAID", "CANCELLED"],
      default: "ACTIVE",
    },
    notes: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const LabBill: Model<ILabBill> =
  mongoose.models.LabBill || mongoose.model<ILabBill>("LabBill", LabBillSchema);
