import { Router } from "express";
import { requireAuth, requireRole } from "../shared/middleware/auth";
import { LabResult } from "./labResult.model";
import { LabOrder } from "../labOrder/labOrder.model";
import { LabTest } from "../labTest/labTest.model";

export const router = Router();

const LAB_ROLES = ["LAB_ADMIN", "LAB_OPERATOR"];
const ADMIN_ONLY = ["LAB_ADMIN"];

// Initialize result stubs for all tests in an order
router.post("/init/:orderId", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const labId = req.user!.labId;
    const order = await LabOrder.findOne({ _id: req.params.orderId, labId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const testIds = new Set<string>();
    order.tests.forEach((t) => testIds.add(String(t.testId)));
    order.packages.forEach((p) => p.tests.forEach((t) => testIds.add(String(t))));

    const created: any[] = [];

    for (const testId of testIds) {
      const existing = await LabResult.findOne({ orderId: order._id, testId, labId });
      if (existing) continue;

      const test = await LabTest.findOne({ _id: testId, labId });
      if (!test) continue;

      const parameterResults = test.parameters.map((p) => ({
        parameterId: p._id,
        parameterName: p.name,
        unit: p.unit,
        value: "",
        normalMin: p.normalMin,
        normalMax: p.normalMax,
        remarks: p.referenceText ?? "",
        isAbnormal: false,
      }));

      const result = await LabResult.create({
        labId,
        orderId: order._id,
        testId: test._id,
        testName: test.name,
        patientId: order.patientId,
        parameterResults,
      });

      created.push(result);
    }

    res.status(201).json({ message: "Results initialized", results: created });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to initialize results", error: error.message });
  }
});

// Enter / update result values
router.patch("/:id/enter", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { parameterResults, overallRemarks } = req.body;

    if (!Array.isArray(parameterResults)) {
      return res.status(400).json({ message: "parameterResults must be an array" });
    }

    const result = await LabResult.findOne({ _id: req.params.id, labId: req.user!.labId });
    if (!result) return res.status(404).json({ message: "Result not found" });
    if (result.status === "APPROVED") {
      return res.status(400).json({ message: "Cannot modify an approved result" });
    }

    // Auto-flag abnormal values
    const processedParams = parameterResults.map((pr: any) => {
      const numericValue = parseFloat(String(pr.value));
      let isAbnormal = false;
      if (
        !isNaN(numericValue) &&
        pr.normalMin !== undefined && pr.normalMin !== null &&
        pr.normalMax !== undefined && pr.normalMax !== null
      ) {
        isAbnormal = numericValue < Number(pr.normalMin) || numericValue > Number(pr.normalMax);
      }
      return {
        ...pr,
        numericValue: isNaN(numericValue) ? undefined : numericValue,
        isAbnormal,
      };
    });

    result.parameterResults = processedParams;
    result.overallRemarks = overallRemarks;
    result.status = "APPROVED";
    result.enteredBy = req.user!.sub;
    result.enteredAt = new Date();
    result.approvedBy = req.user!.sub;
    result.approvedAt = new Date();
    await result.save();

    // Auto-complete order if all results are now approved
    const order = await LabOrder.findOne({ _id: result.orderId, labId: req.user!.labId });
    if (order && order.status === "IN_PROGRESS") {
      const allResults = await LabResult.find({ orderId: order._id, labId: req.user!.labId });
      const allApproved = allResults.length > 0 && allResults.every((r) => r.status === "APPROVED");
      if (allApproved) {
        order.status = "COMPLETED";
        await order.save();
      }
    }

    res.json({ message: "Result saved", result });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to enter result", error: error.message });
  }
});

// Approve result
router.patch("/:id/approve", requireAuth, requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const labId = req.user!.labId;
    const result = await LabResult.findOne({ _id: req.params.id, labId, status: "ENTERED" });
    if (!result) return res.status(404).json({ message: "Result not found or not in ENTERED state" });

    result.status = "APPROVED";
    result.approvedBy = req.user!.sub;
    result.approvedAt = new Date();
    await result.save();

    // Check if all results for this order are approved — scoped to same lab
    const order = await LabOrder.findOne({ _id: result.orderId, labId });
    if (order && order.status === "IN_PROGRESS") {
      const allResults = await LabResult.find({ orderId: order._id, labId });
      const allApproved = allResults.length > 0 && allResults.every((r) => r.status === "APPROVED");
      if (allApproved) {
        order.status = "COMPLETED";
        await order.save();
      }
    }

    res.json({ message: "Result approved", result });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to approve result", error: error.message });
  }
});

// Reject result
router.patch("/:id/reject", requireAuth, requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await LabResult.findOneAndUpdate(
      { _id: req.params.id, labId: req.user!.labId, status: "ENTERED" },
      { status: "REJECTED", rejectionReason: reason },
      { new: true }
    );
    if (!result) return res.status(404).json({ message: "Result not found or not in ENTERED state" });
    res.json({ message: "Result rejected", result });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to reject result", error: error.message });
  }
});

// Get all results for an order
router.get("/order/:orderId", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const results = await LabResult.find({
      orderId: req.params.orderId,
      labId: req.user!.labId,
    }).sort({ testName: 1 });
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch results", error: error.message });
  }
});

// Get single result
router.get("/:id", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const result = await LabResult.findOne({ _id: req.params.id, labId: req.user!.labId });
    if (!result) return res.status(404).json({ message: "Result not found" });
    res.json({ result });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch result", error: error.message });
  }
});
