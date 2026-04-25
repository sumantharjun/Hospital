import mongoose, { Schema, Document, Model } from "mongoose";

export type LabResultStatus = "PENDING" | "ENTERED" | "APPROVED" | "REJECTED";

export interface IParameterResult {
  parameterId: mongoose.Types.ObjectId;
  parameterName: string;
  unit: string;
  value: string;
  numericValue?: number;
  normalMin?: number;
  normalMax?: number;
  isAbnormal: boolean;
  remarks?: string;
}

export interface ILabResult extends Document {
  labId: string;
  orderId: mongoose.Types.ObjectId;
  testId: mongoose.Types.ObjectId;
  testName: string;
  patientId: mongoose.Types.ObjectId;
  parameterResults: IParameterResult[];
  status: LabResultStatus;
  enteredBy?: string;
  enteredAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  overallRemarks?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ParameterResultSchema = new Schema<IParameterResult>(
  {
    parameterId: { type: Schema.Types.ObjectId },
    parameterName: { type: String, required: true },
    unit: { type: String, default: "" },
    value: { type: String, required: true },
    numericValue: { type: Number },
    normalMin: { type: Number },
    normalMax: { type: Number },
    isAbnormal: { type: Boolean, default: false },
    remarks: { type: String },
  },
  { _id: false }
);

const LabResultSchema = new Schema<ILabResult>(
  {
    labId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "LabOrder", required: true, index: true },
    testId: { type: Schema.Types.ObjectId, ref: "LabTest", required: true },
    testName: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: "LabPatient", required: true },
    parameterResults: [ParameterResultSchema],
    status: {
      type: String,
      enum: ["PENDING", "ENTERED", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    enteredBy: { type: String },
    enteredAt: { type: Date },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    overallRemarks: { type: String },
  },
  { timestamps: true }
);

export const LabResult: Model<ILabResult> =
  mongoose.models.LabResult || mongoose.model<ILabResult>("LabResult", LabResultSchema);
