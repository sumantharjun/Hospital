import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILabPackage extends Document {
  labId: string;
  name: string;
  description?: string;
  tests: mongoose.Types.ObjectId[];
  originalPrice: number;
  price: number;
  discountPercent: number;
  taxPercent: number;
  isActive: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const LabPackageSchema = new Schema<ILabPackage>(
  {
    labId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    tests: [{ type: Schema.Types.ObjectId, ref: "LabTest" }],
    originalPrice: { type: Number, default: 0 },
    price: { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    taxPercent: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const LabPackage: Model<ILabPackage> =
  mongoose.models.LabPackage || mongoose.model<ILabPackage>("LabPackage", LabPackageSchema);
