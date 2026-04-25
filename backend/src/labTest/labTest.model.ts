import mongoose, { Schema, Document, Model } from "mongoose";

export type LabTestCategory =
  | "HEMATOLOGY"
  | "BIOCHEMISTRY"
  | "MICROBIOLOGY"
  | "IMMUNOLOGY"
  | "UROLOGY"
  | "HORMONES"
  | "SEROLOGY"
  | "OTHER";

export interface ITestParameter {
  name: string;
  unit: string;
  normalMin?: number;
  normalMax?: number;
  referenceText?: string;
  printOrder: number;
}

export interface ILabTest extends Document {
  labId: string;
  name: string;
  code: string;
  category: LabTestCategory;
  description?: string;
  sampleType: string;
  parameters: ITestParameter[];
  price: number;
  taxPercent: number;
  turnAroundTimeHours: number;
  isActive: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const TestParameterSchema = new Schema<ITestParameter>(
  {
    name: { type: String, required: true },
    unit: { type: String, default: "" },
    normalMin: { type: Number },
    normalMax: { type: Number },
    referenceText: { type: String },
    printOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

const LabTestSchema = new Schema<ILabTest>(
  {
    labId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    category: {
      type: String,
      enum: ["HEMATOLOGY", "BIOCHEMISTRY", "MICROBIOLOGY", "IMMUNOLOGY", "UROLOGY", "HORMONES", "SEROLOGY", "OTHER"],
      required: true,
    },
    description: { type: String },
    sampleType: { type: String, required: true },
    parameters: [TestParameterSchema],
    price: { type: Number, required: true, default: 0 },
    taxPercent: { type: Number, default: 0 },
    turnAroundTimeHours: { type: Number, default: 24 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

LabTestSchema.index({ labId: 1, code: 1 }, { unique: true });
LabTestSchema.index({ name: "text" });

export const LabTest: Model<ILabTest> =
  mongoose.models.LabTest || mongoose.model<ILabTest>("LabTest", LabTestSchema);
