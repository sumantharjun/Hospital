import mongoose, { Schema, Document, Model } from "mongoose";

export type LabOrderStatus = "PENDING" | "COLLECTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface IOrderTest {
  testId: mongoose.Types.ObjectId;
  testName: string;
  price: number;
}

export interface IOrderPackage {
  packageId: mongoose.Types.ObjectId;
  packageName: string;
  price: number;
  tests: mongoose.Types.ObjectId[];
}

export interface ILabOrder extends Document {
  orderId: string;
  labId: string;
  patientId: mongoose.Types.ObjectId;
  patientName: string;
  patientPhone: string;
  patientAge: number;
  patientGender: string;
  tests: IOrderTest[];
  packages: IOrderPackage[];
  sampleId?: string;
  sampleCollectedAt?: Date;
  sampleCollectedBy?: string;
  status: LabOrderStatus;
  assignedTechnician?: string;
  subtotal: number;
  taxTotal: number;
  discountPercent: number;
  discountAmount: number;
  grandTotal: number;
  billId?: mongoose.Types.ObjectId;
  notes?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const LabOrderSchema = new Schema<ILabOrder>(
  {
    orderId: { type: String, required: true, unique: true },
    labId: { type: String, required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "LabPatient", required: true },
    patientName: { type: String, required: true },
    patientPhone: { type: String, required: true },
    patientAge: { type: Number, required: true },
    patientGender: { type: String, required: true },
    tests: [
      {
        testId: { type: Schema.Types.ObjectId, ref: "LabTest" },
        testName: { type: String },
        price: { type: Number },
      },
    ],
    packages: [
      {
        packageId: { type: Schema.Types.ObjectId, ref: "LabPackage" },
        packageName: { type: String },
        price: { type: Number },
        tests: [{ type: Schema.Types.ObjectId, ref: "LabTest" }],
      },
    ],
    sampleId: { type: String },
    sampleCollectedAt: { type: Date },
    sampleCollectedBy: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "COLLECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    assignedTechnician: { type: String },
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    billId: { type: Schema.Types.ObjectId, ref: "LabBill" },
    notes: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const LabOrder: Model<ILabOrder> =
  mongoose.models.LabOrder || mongoose.model<ILabOrder>("LabOrder", LabOrderSchema);
