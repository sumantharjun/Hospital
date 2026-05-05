/**
 * Seed script for the hospital_unified database.
 * Run: npm run seed:hospital_unified
 *
 * Creates:
 *  - 1 Super Admin
 *  - 1 Hospital Admin
 *  - 1 sample Hospital entry
 *  - 1 Receptionist
 *  - 1 Lab Technician
 *  - 1 Doctor
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ── Inline minimal models so this script is self-contained ───────────────────

const UserSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true },
    email:        { type: String, required: true, unique: true },
    phone:        { type: String },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["SUPER_ADMIN","HOSPITAL_ADMIN","DOCTOR","PHARMACY_STAFF","DISTRIBUTOR",
             "PATIENT","DELIVERY_AGENT","RECEPTIONIST","NURSE","LAB_TECH"],
      required: true,
    },
    hospitalId:      { type: mongoose.Schema.Types.ObjectId },
    specialization:  { type: String },
    qualification:   { type: String },
    serviceCharge:   { type: Number },
    isActive:        { type: Boolean, default: true },
  },
  { timestamps: true }
);

const HospitalSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    address:  { type: String },
    phone:    { type: String },
    email:    { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const User     = mongoose.models.User     || mongoose.model("User",     UserSchema);
const Hospital = mongoose.models.Hospital || mongoose.model("Hospital", HospitalSchema);

// ── Config ───────────────────────────────────────────────────────────────────

const DB_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://letsgolearning123_db_user:vsnGroups%402024@labcluster.mgcyg01.mongodb.net/hospital_unified?retryWrites=true&w=majority";

const ACCOUNTS = [
  {
    name:     "Super Admin",
    email:    "superadmin@hospital.com",
    password: "Admin@1234",
    role:     "SUPER_ADMIN",
  },
  {
    name:     "Hospital Admin",
    email:    "admin@hospital.com",
    password: "Admin@1234",
    role:     "HOSPITAL_ADMIN",
  },
  {
    name:     "Receptionist",
    email:    "reception@hospital.com",
    password: "Reception@1234",
    role:     "RECEPTIONIST",
  },
  {
    name:     "Lab Technician",
    email:    "lab@hospital.com",
    password: "Lab@1234",
    role:     "LAB_TECH",
  },
  {
    name:           "Dr. John Smith",
    email:          "doctor@hospital.com",
    password:       "Doctor@1234",
    role:           "DOCTOR",
    specialization: "General Medicine",
    qualification:  "MBBS, MD",
    serviceCharge:  500,
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🔌 Connecting to hospital_unified database...");
  await mongoose.connect(DB_URI);
  console.log("✅ Connected\n");

  // ── Hospital ──────────────────────────────────────────────────────────────
  let hospital = await Hospital.findOne({ name: "City Medical Centre" });
  if (!hospital) {
    hospital = await Hospital.create({
      name:    "City Medical Centre",
      address: "123 Main Street, City",
      phone:   "9876543210",
      email:   "info@citymedical.com",
    });
    console.log("🏥 Created hospital: City Medical Centre");
  } else {
    console.log("🏥 Hospital already exists, skipping");
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  for (const acc of ACCOUNTS) {
    const existing = await User.findOne({ email: acc.email });
    if (existing) {
      console.log(`⏭  User already exists: ${acc.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(acc.password, 10);
    await User.create({
      name:           acc.name,
      email:          acc.email,
      passwordHash,
      role:           acc.role,
      hospitalId:     ["HOSPITAL_ADMIN","RECEPTIONIST","LAB_TECH","DOCTOR"].includes(acc.role)
                        ? hospital._id
                        : undefined,
      specialization: (acc as any).specialization,
      qualification:  (acc as any).qualification,
      serviceCharge:  (acc as any).serviceCharge,
      isActive:       true,
    });
    console.log(`✅ Created ${acc.role}: ${acc.email}  (password: ${acc.password})`);
  }

  console.log("\n🎉 Seed complete!\n");
  console.log("──────────────────────────────────────────");
  console.log("  Credentials for hospital_unified DB");
  console.log("──────────────────────────────────────────");
  for (const acc of ACCOUNTS) {
    console.log(`  ${acc.role.padEnd(16)} ${acc.email.padEnd(30)} ${acc.password}`);
  }
  console.log("──────────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
