import { Router } from "express";
import { requireAuth, requireRole } from "../shared/middleware/auth";
import { LabPackage } from "./labPackage.model";
import { LabTest } from "../labTest/labTest.model";

export const router = Router();

const ADMIN_ONLY = ["LAB_ADMIN"];
const LAB_ROLES = ["LAB_ADMIN", "LAB_OPERATOR"];

// Create package
router.post("/", requireAuth, requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const { name, description, tests, price, discountPercent, taxPercent } = req.body;

    if (!name || !tests?.length || price === undefined) {
      return res.status(400).json({ message: "name, tests, price are required" });
    }

    // Compute originalPrice from individual test prices
    const testDocs = await LabTest.find({ _id: { $in: tests }, labId: req.user!.labId });
    const originalPrice = testDocs.reduce((sum, t) => sum + t.price, 0);

    const pkg = await LabPackage.create({
      labId: req.user!.labId,
      name,
      description,
      tests,
      originalPrice,
      price,
      discountPercent: discountPercent ?? 0,
      taxPercent: taxPercent ?? 0,
      createdBy: req.user!.sub,
    });

    res.status(201).json({ message: "Package created", package: pkg });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to create package", error: error.message });
  }
});

// List packages
router.get("/", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const filter: any = { labId: req.user!.labId };
    if (req.query.activeOnly === "true") filter.isActive = true;

    const packages = await LabPackage.find(filter).populate("tests", "name code price sampleType").sort({ name: 1 });
    res.json({ packages });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch packages", error: error.message });
  }
});

// Get single package — scoped to lab
router.get("/:id", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const pkg = await LabPackage.findOne({ _id: req.params.id, labId: req.user!.labId }).populate("tests");
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json({ package: pkg });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch package", error: error.message });
  }
});

// Update package
router.patch("/:id", requireAuth, requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const allowed = ["name", "description", "tests", "price", "discountPercent", "taxPercent", "isActive"];
    const update: any = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    if (update.tests) {
      const testDocs = await LabTest.find({ _id: { $in: update.tests }, labId: req.user!.labId });
      update.originalPrice = testDocs.reduce((sum, t) => sum + t.price, 0);
    }

    const pkg = await LabPackage.findOneAndUpdate(
      { _id: req.params.id, labId: req.user!.labId },
      update,
      { new: true }
    ).populate("tests", "name code price");

    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json({ message: "Package updated", package: pkg });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update package", error: error.message });
  }
});

// Delete (soft)
router.delete("/:id", requireAuth, requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const pkg = await LabPackage.findOneAndUpdate(
      { _id: req.params.id, labId: req.user!.labId },
      { isActive: false },
      { new: true }
    );
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json({ message: "Package disabled" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to disable package", error: error.message });
  }
});
