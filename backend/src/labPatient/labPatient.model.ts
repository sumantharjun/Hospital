import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILabPatient extends Document {
  labPatientId: string;
  labId: string;
  name: string;
  age: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  dob?: Date;
  phone: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  referredBy?: string;
  registrationCharge: number;
  totalVisits: number;
  isActive: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const LabPatientSchema = new Schema<ILabPatient>(
  {
    labPatientId: { type: String, required: true, unique: true },
    labId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"], required: true },
    dob: { type: Date },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String },
    bloodGroup: { type: String },
    referredBy: { type: String },
    registrationCharge: { type: Number, default: 0 },
    totalVisits: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

LabPatientSchema.index({ name: "text", phone: "text" });

export const LabPatient: Model<ILabPatient> =
  mongoose.models.LabPatient || mongoose.model<ILabPatient>("LabPatient", LabPatientSchema);
