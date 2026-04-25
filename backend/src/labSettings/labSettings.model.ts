import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILabSettings extends Document {
  labId: string;
  labName: string;
  address?: string;
  phone?: string;
  email?: string;
  registrationCharge: number;
  defaultTaxPercent: number;
  reportHeader?: string;
  reportFooter?: string;
  doctorSignatureName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const LabSettingsSchema = new Schema<ILabSettings>(
  {
    labId: { type: String, required: true, unique: true, index: true },
    labName: { type: String, required: true, default: "Diagnostic Laboratory" },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    registrationCharge: { type: Number, default: 0 },
    defaultTaxPercent: { type: Number, default: 0 },
    reportHeader: { type: String },
    reportFooter: { type: String },
    doctorSignatureName: { type: String },
  },
  { timestamps: true }
);

export const LabSettings: Model<ILabSettings> =
  mongoose.models.LabSettings || mongoose.model<ILabSettings>("LabSettings", LabSettingsSchema);
