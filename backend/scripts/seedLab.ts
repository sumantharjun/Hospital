/**
 * Lab System Seed Script
 * Run: npx ts-node scripts/seedLab.ts
 *
 * Creates:
 *  - 1 LAB_ADMIN user  (labadmin@lab.com / Lab@1234)
 *  - 1 LAB_OPERATOR user (operator@lab.com / Lab@1234)
 *  - Lab settings tied to the admin
 *  - 12 common diagnostic tests with parameters
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { User } from "../src/user/user.model";
import { LabSettings } from "../src/labSettings/labSettings.model";
import { LabTest } from "../src/labTest/labTest.model";

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error("MONGO_URI not set in .env"); process.exit(1); }

async function seed() {
  await mongoose.connect(MONGO_URI!);
  console.log("Connected to MongoDB");

  // ── 1. LAB_ADMIN ──────────────────────────────────────────────
  let admin = await User.findOne({ email: "labadmin@lab.com" });
  if (admin) {
    // Ensure labId is set on existing admin
    if (!admin.labId) await User.findByIdAndUpdate(admin._id, { labId: String(admin._id) });
    console.log("LAB_ADMIN already exists:", admin.email);
  } else {
    admin = await User.create({
      name: "Lab Admin",
      email: "labadmin@lab.com",
      passwordHash: await bcrypt.hash("Lab@1234", 10),
      role: "LAB_ADMIN",
      isActive: true,
    });
    console.log("Created LAB_ADMIN:", admin.email, "| id:", String(admin._id));
  }

  const labId = String(admin._id);

  // ── 2. LAB_OPERATOR ───────────────────────────────────────────
  const opExists = await User.findOne({ email: "operator@lab.com" });
  if (opExists) {
    await User.findByIdAndUpdate(opExists._id, { labId });
    console.log("LAB_OPERATOR already exists:", opExists.email, "| labId set to:", labId);
  } else {
    const op = await User.create({
      name: "Lab Operator",
      email: "operator@lab.com",
      passwordHash: await bcrypt.hash("Lab@1234", 10),
      role: "LAB_OPERATOR",
      labId,
      isActive: true,
    });
    console.log("Created LAB_OPERATOR:", op.email, "| id:", String(op._id));
  }

  // ── 3. Lab Settings ───────────────────────────────────────────
  const settingsExists = await LabSettings.findOne({ labId });
  if (settingsExists) {
    console.log("Lab settings already exist");
  } else {
    await LabSettings.create({
      labId,
      labName: "City Diagnostic Laboratory",
      address: "123 Medical Road, Health Nagar",
      phone: "9876543210",
      email: "info@citydiag.com",
      registrationCharge: 50,
      defaultTaxPercent: 0,
      reportHeader: "City Diagnostic Laboratory | NABL Accredited",
      reportFooter: "This report is computer generated and does not require a signature.",
      doctorSignatureName: "Dr. Lab Director",
    });
    console.log("Created lab settings");
  }

  // ── 4. Lab Tests ──────────────────────────────────────────────
  const TESTS = [
    {
      name: "Complete Blood Count (CBC)",
      code: "CBC",
      category: "HEMATOLOGY",
      sampleType: "Whole Blood (EDTA)",
      price: 300,
      turnAroundTimeHours: 4,
      parameters: [
        { name: "Haemoglobin (Hb)", unit: "g/dL", normalMin: 12, normalMax: 17, printOrder: 1 },
        { name: "RBC Count", unit: "mill/cumm", normalMin: 4.5, normalMax: 5.5, printOrder: 2 },
        { name: "WBC Count", unit: "cells/cumm", normalMin: 4000, normalMax: 11000, printOrder: 3 },
        { name: "Platelet Count", unit: "lakh/cumm", normalMin: 1.5, normalMax: 4.5, printOrder: 4 },
        { name: "Haematocrit (PCV)", unit: "%", normalMin: 36, normalMax: 50, printOrder: 5 },
        { name: "MCV", unit: "fL", normalMin: 80, normalMax: 100, printOrder: 6 },
        { name: "MCH", unit: "pg", normalMin: 27, normalMax: 33, printOrder: 7 },
        { name: "MCHC", unit: "g/dL", normalMin: 32, normalMax: 36, printOrder: 8 },
        { name: "Neutrophils", unit: "%", normalMin: 40, normalMax: 75, printOrder: 9 },
        { name: "Lymphocytes", unit: "%", normalMin: 20, normalMax: 45, printOrder: 10 },
        { name: "Monocytes", unit: "%", normalMin: 2, normalMax: 10, printOrder: 11 },
        { name: "Eosinophils", unit: "%", normalMin: 1, normalMax: 6, printOrder: 12 },
        { name: "Basophils", unit: "%", normalMin: 0, normalMax: 1, printOrder: 13 },
      ],
    },
    {
      name: "Blood Glucose - Fasting (FBS)",
      code: "FBS",
      category: "BIOCHEMISTRY",
      sampleType: "Serum",
      price: 80,
      turnAroundTimeHours: 2,
      parameters: [
        { name: "Fasting Blood Sugar", unit: "mg/dL", normalMin: 70, normalMax: 100, printOrder: 1 },
      ],
    },
    {
      name: "Blood Glucose - Post Prandial (PPBS)",
      code: "PPBS",
      category: "BIOCHEMISTRY",
      sampleType: "Serum",
      price: 80,
      turnAroundTimeHours: 2,
      parameters: [
        { name: "Post Prandial Blood Sugar", unit: "mg/dL", normalMin: 70, normalMax: 140, printOrder: 1 },
      ],
    },
    {
      name: "HbA1c (Glycated Haemoglobin)",
      code: "HBA1C",
      category: "BIOCHEMISTRY",
      sampleType: "Whole Blood (EDTA)",
      price: 350,
      turnAroundTimeHours: 6,
      parameters: [
        { name: "HbA1c", unit: "%", normalMin: 4, normalMax: 5.7, printOrder: 1 },
        { name: "Estimated Average Glucose", unit: "mg/dL", normalMin: 68, normalMax: 117, printOrder: 2 },
      ],
    },
    {
      name: "Lipid Profile",
      code: "LIPID",
      category: "BIOCHEMISTRY",
      sampleType: "Serum",
      price: 500,
      turnAroundTimeHours: 6,
      parameters: [
        { name: "Total Cholesterol", unit: "mg/dL", normalMin: 0, normalMax: 200, printOrder: 1 },
        { name: "HDL Cholesterol", unit: "mg/dL", normalMin: 40, normalMax: 60, printOrder: 2 },
        { name: "LDL Cholesterol", unit: "mg/dL", normalMin: 0, normalMax: 100, printOrder: 3 },
        { name: "VLDL Cholesterol", unit: "mg/dL", normalMin: 5, normalMax: 40, printOrder: 4 },
        { name: "Triglycerides", unit: "mg/dL", normalMin: 0, normalMax: 150, printOrder: 5 },
        { name: "Total Cholesterol / HDL Ratio", unit: "", normalMin: 0, normalMax: 5, printOrder: 6 },
      ],
    },
    {
      name: "Liver Function Test (LFT)",
      code: "LFT",
      category: "BIOCHEMISTRY",
      sampleType: "Serum",
      price: 600,
      turnAroundTimeHours: 8,
      parameters: [
        { name: "Total Bilirubin", unit: "mg/dL", normalMin: 0.2, normalMax: 1.2, printOrder: 1 },
        { name: "Direct Bilirubin", unit: "mg/dL", normalMin: 0, normalMax: 0.4, printOrder: 2 },
        { name: "Indirect Bilirubin", unit: "mg/dL", normalMin: 0.1, normalMax: 0.8, printOrder: 3 },
        { name: "SGOT (AST)", unit: "U/L", normalMin: 10, normalMax: 40, printOrder: 4 },
        { name: "SGPT (ALT)", unit: "U/L", normalMin: 7, normalMax: 56, printOrder: 5 },
        { name: "Alkaline Phosphatase (ALP)", unit: "U/L", normalMin: 44, normalMax: 147, printOrder: 6 },
        { name: "Total Protein", unit: "g/dL", normalMin: 6, normalMax: 8.3, printOrder: 7 },
        { name: "Albumin", unit: "g/dL", normalMin: 3.5, normalMax: 5, printOrder: 8 },
        { name: "Globulin", unit: "g/dL", normalMin: 2, normalMax: 3.5, printOrder: 9 },
        { name: "A/G Ratio", unit: "", normalMin: 1.1, normalMax: 2.2, printOrder: 10 },
      ],
    },
    {
      name: "Kidney Function Test (KFT / RFT)",
      code: "KFT",
      category: "BIOCHEMISTRY",
      sampleType: "Serum",
      price: 500,
      turnAroundTimeHours: 6,
      parameters: [
        { name: "Blood Urea", unit: "mg/dL", normalMin: 15, normalMax: 40, printOrder: 1 },
        { name: "Serum Creatinine", unit: "mg/dL", normalMin: 0.6, normalMax: 1.2, printOrder: 2 },
        { name: "Uric Acid", unit: "mg/dL", normalMin: 2.5, normalMax: 7.2, printOrder: 3 },
        { name: "Sodium (Na)", unit: "mEq/L", normalMin: 136, normalMax: 145, printOrder: 4 },
        { name: "Potassium (K)", unit: "mEq/L", normalMin: 3.5, normalMax: 5, printOrder: 5 },
        { name: "Chloride (Cl)", unit: "mEq/L", normalMin: 98, normalMax: 107, printOrder: 6 },
        { name: "eGFR", unit: "mL/min/1.73m²", normalMin: 90, normalMax: 120, printOrder: 7 },
      ],
    },
    {
      name: "Thyroid Profile (T3, T4, TSH)",
      code: "THYROID",
      category: "HORMONES",
      sampleType: "Serum",
      price: 700,
      turnAroundTimeHours: 12,
      parameters: [
        { name: "T3 (Triiodothyronine)", unit: "ng/dL", normalMin: 80, normalMax: 200, printOrder: 1 },
        { name: "T4 (Thyroxine)", unit: "µg/dL", normalMin: 5.1, normalMax: 14.1, printOrder: 2 },
        { name: "TSH (Thyroid Stimulating Hormone)", unit: "µIU/mL", normalMin: 0.4, normalMax: 4, printOrder: 3 },
      ],
    },
    {
      name: "Urine Complete Examination (UCE)",
      code: "UCE",
      category: "UROLOGY",
      sampleType: "Mid-stream Urine",
      price: 150,
      turnAroundTimeHours: 4,
      parameters: [
        { name: "Colour", unit: "", referenceText: "Pale Yellow to Yellow", printOrder: 1 },
        { name: "Appearance", unit: "", referenceText: "Clear", printOrder: 2 },
        { name: "pH", unit: "", normalMin: 4.5, normalMax: 8, printOrder: 3 },
        { name: "Specific Gravity", unit: "", normalMin: 1.005, normalMax: 1.030, printOrder: 4 },
        { name: "Protein", unit: "", referenceText: "Nil / Negative", printOrder: 5 },
        { name: "Glucose", unit: "", referenceText: "Nil / Negative", printOrder: 6 },
        { name: "Ketone Bodies", unit: "", referenceText: "Nil / Negative", printOrder: 7 },
        { name: "Bilirubin", unit: "", referenceText: "Nil / Negative", printOrder: 8 },
        { name: "RBC", unit: "/HPF", normalMin: 0, normalMax: 2, printOrder: 9 },
        { name: "Pus Cells (WBC)", unit: "/HPF", normalMin: 0, normalMax: 5, printOrder: 10 },
        { name: "Epithelial Cells", unit: "/HPF", referenceText: "Few", printOrder: 11 },
        { name: "Casts", unit: "", referenceText: "Nil", printOrder: 12 },
        { name: "Crystals", unit: "", referenceText: "Nil / Few", printOrder: 13 },
      ],
    },
    {
      name: "Widal Test",
      code: "WIDAL",
      category: "SEROLOGY",
      sampleType: "Serum",
      price: 200,
      turnAroundTimeHours: 8,
      parameters: [
        { name: "Salmonella Typhi O (TO)", unit: "Titre", referenceText: "< 1:80 (Non-reactive)", printOrder: 1 },
        { name: "Salmonella Typhi H (TH)", unit: "Titre", referenceText: "< 1:80 (Non-reactive)", printOrder: 2 },
        { name: "Salmonella Paratyphi AO (AO)", unit: "Titre", referenceText: "< 1:80 (Non-reactive)", printOrder: 3 },
        { name: "Salmonella Paratyphi BH (BH)", unit: "Titre", referenceText: "< 1:80 (Non-reactive)", printOrder: 4 },
      ],
    },
    {
      name: "Dengue Serology (NS1 + IgG + IgM)",
      code: "DENGUE",
      category: "SEROLOGY",
      sampleType: "Serum",
      price: 800,
      turnAroundTimeHours: 6,
      parameters: [
        { name: "Dengue NS1 Antigen", unit: "", referenceText: "Non-reactive", printOrder: 1 },
        { name: "Dengue IgG Antibody", unit: "", referenceText: "Non-reactive", printOrder: 2 },
        { name: "Dengue IgM Antibody", unit: "", referenceText: "Non-reactive", printOrder: 3 },
      ],
    },
    {
      name: "Malaria Antigen Test (MP-Ag)",
      code: "MALARIA",
      category: "HEMATOLOGY",
      sampleType: "Whole Blood (EDTA)",
      price: 250,
      turnAroundTimeHours: 2,
      parameters: [
        { name: "Plasmodium falciparum (HRP-2)", unit: "", referenceText: "Non-reactive", printOrder: 1 },
        { name: "Plasmodium vivax (pLDH)", unit: "", referenceText: "Non-reactive", printOrder: 2 },
      ],
    },
  ];

  let created = 0;
  let skipped = 0;
  for (const t of TESTS) {
    const exists = await LabTest.findOne({ labId, code: t.code });
    if (exists) { skipped++; continue; }
    await LabTest.create({ ...t, labId, isActive: true, createdBy: labId });
    created++;
  }
  console.log(`Tests: ${created} created, ${skipped} already existed`);

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n✓ Seed complete");
  console.log("─────────────────────────────────────────");
  console.log("LAB_ADMIN   → labadmin@lab.com  / Lab@1234");
  console.log("LAB_OPERATOR→ operator@lab.com  / Lab@1234");
  console.log("Lab ID (labId):", labId);
  console.log("─────────────────────────────────────────");

  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
