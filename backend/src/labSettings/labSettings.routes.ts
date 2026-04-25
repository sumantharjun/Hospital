import { Router } from "express";
import { requireAuth, requireRole } from "../shared/middleware/auth";
import { LabSettings } from "./labSettings.model";

export const router = Router();

const ADMIN_ONLY = ["LAB_ADMIN"];
const LAB_ROLES = ["LAB_ADMIN", "LAB_OPERATOR"];

// Get settings (auto-creates defaults)
router.get("/", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    let settings = await LabSettings.findOne({ labId: req.user!.labId });
    if (!settings) {
      settings = await LabSettings.create({ labId: req.user!.labId, labName: "Diagnostic Laboratory" });
    }
    res.json({ settings });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch settings", error: error.message });
  }
});

// Update settings
router.patch("/", requireAuth, requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const allowed = ["labName", "address", "phone", "email", "registrationCharge", "defaultTaxPercent", "reportHeader", "reportFooter", "doctorSignatureName"];
    const update: any = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const settings = await LabSettings.findOneAndUpdate(
      { labId: req.user!.labId },
      { $set: update },
      { new: true, upsert: true }
    );
    res.json({ message: "Settings updated", settings });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update settings", error: error.message });
  }
});
