import { Router } from "express";
import { requireAuth, requireRole } from "../shared/middleware/auth";
import { LabBill } from "./labBilling.model";
import { LabOrder } from "../labOrder/labOrder.model";
import { LabSettings } from "../labSettings/labSettings.model";

export const router = Router();

const LAB_ROLES = ["LAB_ADMIN", "LAB_OPERATOR"];

function generateBillNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `LB-${ts}`;
}

// Generate bill for an order
router.post("/order/:orderId", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { discountPercent = 0, notes } = req.body;

    const disc = Number(discountPercent);
    if (isNaN(disc) || disc < 0 || disc > 100) {
      return res.status(400).json({ message: "discountPercent must be between 0 and 100" });
    }

    const order = await LabOrder.findOne({ _id: req.params.orderId, labId: req.user!.labId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const existing = await LabBill.findOne({ orderId: order._id });
    if (existing) return res.status(409).json({ message: "Bill already exists for this order", bill: existing });

    // Get registration charge from settings
    let registrationCharge = 0;
    try {
      const settings = await LabSettings.findOne({ labId: req.user!.labId });
      if (settings) registrationCharge = settings.registrationCharge ?? 0;
    } catch (_) {}

    // Build line items from order
    const lineItems: any[] = [];

    for (const t of order.tests) {
      lineItems.push({
        description: t.testName,
        quantity: 1,
        unitPrice: t.price,
        taxPercent: 0,
        taxAmount: 0,
        total: t.price,
      });
    }

    for (const p of order.packages) {
      lineItems.push({
        description: p.packageName,
        quantity: 1,
        unitPrice: p.price,
        taxPercent: 0,
        taxAmount: 0,
        total: p.price,
      });
    }

    if (registrationCharge > 0) {
      lineItems.push({
        description: "Registration Charge",
        quantity: 1,
        unitPrice: registrationCharge,
        taxPercent: 0,
        taxAmount: 0,
        total: registrationCharge,
      });
    }

    const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
    const taxTotal = lineItems.reduce((s, i) => s + i.taxAmount, 0);
    const discountAmount = Math.round((subtotal * disc) / 100);
    const grandTotal = subtotal + taxTotal - discountAmount;

    const bill = await LabBill.create({
      billNumber: generateBillNumber(),
      labId: req.user!.labId,
      orderId: order._id,
      patientId: order.patientId,
      patientName: order.patientName,
      patientPhone: order.patientPhone,
      lineItems,
      registrationCharge,
      subtotal,
      taxTotal,
      discountPercent: disc,
      discountAmount,
      grandTotal,
      outstandingBalance: grandTotal,
      notes,
      createdBy: req.user!.sub,
    });

    // Link bill to order (order ownership already verified above)
    await LabOrder.findOneAndUpdate({ _id: order._id, labId: req.user!.labId }, { billId: bill._id });

    res.status(201).json({ message: "Bill generated", bill });
  } catch (error: any) {
    if (error.code === 11000) {
      // Duplicate key — race condition: another request already created the bill
      const existing = await LabBill.findOne({ orderId: req.params.orderId });
      return res.status(409).json({ message: "Bill already exists for this order", bill: existing });
    }
    res.status(500).json({ message: "Failed to generate bill", error: error.message });
  }
});

// List bills
router.get("/", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter: any = { labId: req.user!.labId };
    if (status) filter.status = status;

    const [bills, total] = await Promise.all([
      LabBill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      LabBill.countDocuments(filter),
    ]);

    res.json({ bills, total, page: Number(page), limit: Number(limit) });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch bills", error: error.message });
  }
});

// Get single bill
router.get("/:id", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const bill = await LabBill.findOne({ _id: req.params.id, labId: req.user!.labId });
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json({ bill });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch bill", error: error.message });
  }
});

// Record payment
router.post("/:id/payment", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const { amount, mode, referenceNumber, notes } = req.body;

    if (!amount || !mode) return res.status(400).json({ message: "amount and mode are required" });
    if (!["CASH", "CARD", "UPI"].includes(mode)) {
      return res.status(400).json({ message: "mode must be CASH, CARD, or UPI" });
    }

    const bill = await LabBill.findOne({ _id: req.params.id, labId: req.user!.labId });
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    if (bill.status === "PAID") return res.status(400).json({ message: "Bill is already fully paid" });
    if (bill.status === "CANCELLED") return res.status(400).json({ message: "Cannot record payment on cancelled bill" });

    const payAmount = Math.min(Number(amount), bill.outstandingBalance);

    bill.paymentHistory.push({
      amount: payAmount,
      mode,
      referenceNumber,
      receivedAt: new Date(),
      receivedBy: req.user!.sub,
      notes,
    });

    bill.paidAmount += payAmount;
    bill.outstandingBalance = bill.grandTotal - bill.paidAmount;
    bill.status = bill.outstandingBalance <= 0 ? "PAID" : "PARTIAL";

    await bill.save();
    res.json({ message: "Payment recorded", bill });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to record payment", error: error.message });
  }
});

// Cancel bill
router.patch("/:id/cancel", requireAuth, requireRole(["LAB_ADMIN"]), async (req, res) => {
  try {
    const bill = await LabBill.findOneAndUpdate(
      { _id: req.params.id, labId: req.user!.labId, status: { $in: ["ACTIVE", "DRAFT"] } },
      { status: "CANCELLED" },
      { new: true }
    );
    if (!bill) return res.status(404).json({ message: "Bill not found or cannot be cancelled" });
    res.json({ message: "Bill cancelled", bill });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to cancel bill", error: error.message });
  }
});
