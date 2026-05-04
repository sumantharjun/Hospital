import { Router } from "express";
import { requireAuth, requireRole } from "../shared/middleware/auth";
import { LabTest } from "./labTest.model";
import { LabPackage } from "../labPackage/labPackage.model";

export const router = Router();

const ADMIN_ONLY = ["LAB_ADMIN"];
const LAB_ROLES = ["LAB_ADMIN", "LAB_OPERATOR"];

// Create test
router.post("/", requireAuth, requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const { name, code, category, description, sampleType, parameters, price, taxPercent, turnAroundTimeHours } = req.body;

    if (!name || !code || !category || !sampleType) {
      return res.status(400).json({ message: "name, code, category, sampleType are required" });
    }

    const labId = req.user!.labId;
    const existing = await LabTest.findOne({ labId, code });
    if (existing) return res.status(409).json({ message: `Test with code '${code}' already exists` });

    const test = await LabTest.create({
      labId,
      name,
      code,
      category,
      description,
      sampleType,
      parameters: parameters || [],
      price: price ?? 0,
      taxPercent: taxPercent ?? 0,
      turnAroundTimeHours: turnAroundTimeHours ?? 24,
      createdBy: req.user!.sub,
    });

    res.status(201).json({ message: "Test created", test });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to create test", error: error.message });
  }
});

// List tests
router.get("/", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { search, category, activeOnly } = req.query;
    const filter: any = { labId: req.user!.labId };

    if (activeOnly === "true") filter.isActive = true;
    if (category) filter.category = category;
    if (search) filter.$text = { $search: String(search) };

    const tests = await LabTest.find(filter).sort({ name: 1 });
    res.json({ tests });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch tests", error: error.message });
  }
});

// Get single test — scoped to lab
router.get("/:id", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const test = await LabTest.findOne({ _id: req.params.id, labId: req.user!.labId });
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json({ test });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch test", error: error.message });
  }
});

// Update test
router.patch("/:id", requireAuth, requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const allowed = ["name", "description", "sampleType", "parameters", "price", "taxPercent", "turnAroundTimeHours", "isActive", "category"];
    const update: any = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const test = await LabTest.findOneAndUpdate({ _id: req.params.id, labId: req.user!.labId }, update, { new: true });
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json({ message: "Test updated", test });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update test", error: error.message });
  }
});

// Delete (soft — disable)
router.delete("/:id", requireAuth, requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const test = await LabTest.findOne({ _id: req.params.id, labId: req.user!.labId });
    if (!test) return res.status(404).json({ message: "Test not found" });

    const pkg = await LabPackage.findOne({ labId: req.user!.labId, tests: test._id });
    if (pkg) {
      return res.status(400).json({ message: `This test is part of the package "${pkg.name}". Please delete or update the package first before disabling this test.` });
    }

    test.isActive = false;
    await test.save();
    res.json({ message: "Test disabled", test });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to disable test", error: error.message });
  }
});
