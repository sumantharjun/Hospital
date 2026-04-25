import { Router } from "express";
import { requireAuth, requireRole } from "../shared/middleware/auth";
import { LabPatient } from "./labPatient.model";
import { LabSettings } from "../labSettings/labSettings.model";

export const router = Router();

const LAB_ROLES = ["LAB_ADMIN", "LAB_OPERATOR"];

function generateLabPatientId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `LP-${ts}-${rand}`;
}

// Register new patient
router.post("/", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { name, age, gender, dob, phone, email, address, bloodGroup, referredBy } = req.body;
    const labId = req.user!.labId;

    if (!name || !age || !gender || !phone) {
      return res.status(400).json({ message: "name, age, gender, phone are required" });
    }
    if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
      return res.status(400).json({ message: "gender must be MALE, FEMALE, or OTHER" });
    }
    if (Number(age) <= 0 || Number(age) > 150) {
      return res.status(400).json({ message: "age must be between 1 and 150" });
    }

    let registrationCharge = 0;
    try {
      const settings = await LabSettings.findOne({ labId });
      if (settings) registrationCharge = settings.registrationCharge ?? 0;
    } catch (e) {
      console.error("Failed to fetch lab settings for registration charge:", e);
    }

    const patient = await LabPatient.create({
      labPatientId: generateLabPatientId(),
      labId,
      name,
      age: Number(age),
      gender,
      dob,
      phone,
      email,
      address,
      bloodGroup,
      referredBy,
      registrationCharge,
      createdBy: req.user!.sub,
    });

    res.status(201).json({ message: "Patient registered", patient });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to register patient", error: error.message });
  }
});

// List patients
router.get("/", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = { labId: req.user!.labId };
    if (search) filter.$text = { $search: String(search) };

    const [patients, total] = await Promise.all([
      LabPatient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      LabPatient.countDocuments(filter),
    ]);

    res.json({ patients, total, page: Number(page), limit: Number(limit) });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch patients", error: error.message });
  }
});

// Get single patient — scoped to lab
router.get("/:id", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const patient = await LabPatient.findOne({ _id: req.params.id, labId: req.user!.labId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ patient });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch patient", error: error.message });
  }
});

// Update patient — scoped to lab
router.patch("/:id", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const allowed = ["name", "age", "gender", "dob", "phone", "email", "address", "bloodGroup", "referredBy"];
    const update: any = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    if (update.gender && !["MALE", "FEMALE", "OTHER"].includes(update.gender)) {
      return res.status(400).json({ message: "gender must be MALE, FEMALE, or OTHER" });
    }

    const patient = await LabPatient.findOneAndUpdate(
      { _id: req.params.id, labId: req.user!.labId },
      update,
      { new: true }
    );
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ message: "Patient updated", patient });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update patient", error: error.message });
  }
});
