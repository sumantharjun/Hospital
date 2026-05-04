import { Router } from "express";
import { requireAuth, requireRole } from "../shared/middleware/auth";
import { LabOrder } from "./labOrder.model";
import { LabPatient } from "../labPatient/labPatient.model";
import { LabTest } from "../labTest/labTest.model";
import { LabPackage } from "../labPackage/labPackage.model";
import { LabBill } from "../labBilling/labBilling.model";
import { LabSettings } from "../labSettings/labSettings.model";

export const router = Router();

const LAB_ROLES = ["LAB_ADMIN", "LAB_OPERATOR"];

function generateOrderId(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LO-${ymd}-${rand}`;
}

function generateSampleId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `SMP-${ts}`;
}

// Create order
router.post("/", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { patientId, testIds = [], packageIds = [], discountPercent = 0, notes } = req.body;
    const labId = req.user!.labId;

    if (!patientId || (testIds.length === 0 && packageIds.length === 0)) {
      return res.status(400).json({ message: "patientId and at least one test or package are required" });
    }

    const disc = Number(discountPercent);
    if (isNaN(disc) || disc < 0 || disc > 100) {
      return res.status(400).json({ message: "discountPercent must be between 0 and 100" });
    }

    // Patient must belong to this lab
    const patient = await LabPatient.findOne({ _id: patientId, labId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    // Tests and packages must belong to this lab
    const testDocs = testIds.length > 0
      ? await LabTest.find({ _id: { $in: testIds }, labId, isActive: true })
      : [];

    if (testIds.length > 0 && testDocs.length !== testIds.length) {
      return res.status(400).json({ message: "One or more tests not found or not active" });
    }

    const packageDocs = packageIds.length > 0
      ? await LabPackage.find({ _id: { $in: packageIds }, labId, isActive: true })
      : [];

    if (packageIds.length > 0 && packageDocs.length !== packageIds.length) {
      return res.status(400).json({ message: "One or more packages not found or not active" });
    }

    const tests = testDocs.map((t) => ({ testId: t._id, testName: t.name, price: t.price }));
    const packages = packageDocs.map((p) => ({
      packageId: p._id,
      packageName: p.name,
      price: p.price,
      tests: p.tests,
    }));

    const subtotal = tests.reduce((s, t) => s + t.price, 0) + packages.reduce((s, p) => s + p.price, 0);

    // Compute tax from each test/package's taxPercent
    const taxTotal =
      testDocs.reduce((s, t) => s + Math.round((t.price * (t.taxPercent ?? 0)) / 100), 0) +
      packageDocs.reduce((s, p) => s + Math.round((p.price * (p.taxPercent ?? 0)) / 100), 0);

    const discountAmount = Math.round((subtotal * disc) / 100);
    const grandTotal = subtotal + taxTotal - discountAmount;

    const order = await LabOrder.create({
      orderId: generateOrderId(),
      labId,
      patientId: patient._id,
      patientName: patient.name,
      patientPhone: patient.phone,
      patientAge: patient.age,
      patientGender: patient.gender,
      tests,
      packages,
      subtotal,
      taxTotal,
      discountPercent: disc,
      discountAmount,
      grandTotal,
      notes,
      createdBy: req.user!.sub,
    });

    // Auto-generate bill
    try {
      const settings = await LabSettings.findOne({ labId });
      const registrationCharge = settings?.registrationCharge ?? 0;

      const lineItems: any[] = [
        ...tests.map((t) => ({ description: t.testName, quantity: 1, unitPrice: t.price, taxPercent: 0, taxAmount: 0, total: t.price })),
        ...packages.map((p) => ({ description: p.packageName, quantity: 1, unitPrice: p.price, taxPercent: 0, taxAmount: 0, total: p.price })),
        ...(registrationCharge > 0 ? [{ description: "Registration Charge", quantity: 1, unitPrice: registrationCharge, taxPercent: 0, taxAmount: 0, total: registrationCharge }] : []),
      ];

      const billSubtotal = lineItems.reduce((s, i) => s + i.total, 0);
      const billGrandTotal = billSubtotal + taxTotal - discountAmount;

      const bill = await LabBill.create({
        billNumber: `LB-${Date.now().toString(36).toUpperCase()}`,
        labId,
        orderId: order._id,
        patientId: patient._id,
        patientName: patient.name,
        patientPhone: patient.phone,
        lineItems,
        registrationCharge,
        subtotal: billSubtotal,
        taxTotal,
        discountPercent: disc,
        discountAmount,
        grandTotal: billGrandTotal,
        outstandingBalance: billGrandTotal,
        notes,
        createdBy: req.user!.sub,
      });

      await LabOrder.findOneAndUpdate({ _id: order._id, labId }, { billId: bill._id });
      order.billId = bill._id as any;
    } catch (_) {}

    res.status(201).json({ message: "Order created", order });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to create order", error: error.message });
  }
});

// List orders
router.get("/", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { status, date, patientId, page = "1", limit = "20" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter: any = { labId: req.user!.labId };

    if (status) filter.status = status;
    if (patientId) filter.patientId = patientId;
    if (date) {
      const d = new Date(String(date));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.createdAt = { $gte: d, $lt: next };
    }

    const [orders, total] = await Promise.all([
      LabOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      LabOrder.countDocuments(filter),
    ]);

    res.json({ orders, total, page: Number(page), limit: Number(limit) });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch orders", error: error.message });
  }
});

// Get single order — scoped to lab
router.get("/:id", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const order = await LabOrder.findOne({ _id: req.params.id, labId: req.user!.labId });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ order });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch order", error: error.message });
  }
});

// Update sample collection
router.patch("/:id/sample", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { collectedBy } = req.body;
    const order = await LabOrder.findOneAndUpdate(
      { _id: req.params.id, labId: req.user!.labId, status: "PENDING" },
      {
        sampleId: generateSampleId(),
        sampleCollectedAt: new Date(),
        sampleCollectedBy: collectedBy || req.user!.sub,
        status: "IN_PROGRESS",
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found or already collected" });
    res.json({ message: "Sample collected", order });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update sample", error: error.message });
  }
});

// Update order status
router.patch("/:id/status", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { status, assignedTechnician } = req.body;
    const validTransitions: Record<string, string[]> = {
      PENDING: ["COLLECTED", "CANCELLED"],
      COLLECTED: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["CANCELLED"],
    };

    // Fetch and validate in one scoped query
    const order = await LabOrder.findOne({ _id: req.params.id, labId: req.user!.labId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const allowed = validTransitions[order.status] || [];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: `Cannot transition from ${order.status} to ${status}` });
    }

    const update: any = { status };
    if (assignedTechnician) update.assignedTechnician = assignedTechnician;
    if (status === "COLLECTED" && !order.sampleId) {
      update.sampleId = generateSampleId();
      update.sampleCollectedAt = new Date();
      update.sampleCollectedBy = req.user!.sub;
    }

    // Use scoped findOneAndUpdate — prevents race on labId
    const updated = await LabOrder.findOneAndUpdate(
      { _id: req.params.id, labId: req.user!.labId },
      update,
      { new: true }
    );

    res.json({ message: "Order status updated", order: updated });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update status", error: error.message });
  }
});
