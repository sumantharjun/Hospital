import { Router } from "express";
import PDFDocument from "pdfkit";
import { requireAuth, requireRole } from "../shared/middleware/auth";
import { LabOrder } from "../labOrder/labOrder.model";
import { LabResult } from "../labResult/labResult.model";
import { LabPatient } from "../labPatient/labPatient.model";
import { LabSettings } from "../labSettings/labSettings.model";

export const router = Router();

const LAB_ROLES = ["LAB_ADMIN", "LAB_OPERATOR"];

router.get("/order/:orderId/pdf", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const order = await LabOrder.findOne({ _id: req.params.orderId, labId: req.user!.labId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const [results, patient, settings] = await Promise.all([
      LabResult.find({ orderId: order._id, labId: req.user!.labId }).sort({ testName: 1 }),
      LabPatient.findById(order.patientId),
      LabSettings.findOne({ labId: req.user!.labId }),
    ]);

    const approvedResults = results.filter((r) => r.status === "APPROVED");
    if (approvedResults.length === 0) {
      return res.status(400).json({ message: "No approved results to generate report" });
    }

    const labName = settings?.labName ?? "Diagnostic Laboratory";
    const labAddress = settings?.address ?? "";
    const labPhone = settings?.phone ?? "";
    const reportFooter = settings?.reportFooter ?? "This is a computer-generated report.";
    const doctorName = settings?.doctorSignatureName ?? "";

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="report-${order.orderId}.pdf"`);
    doc.pipe(res);

    const W = doc.page.width - 80;
    const COLS = { test: 40, value: 260, unit: 360, range: 430 };

    // ── Header ──
    doc.fontSize(18).font("Helvetica-Bold").text(labName, 40, 40, { align: "center" });
    if (labAddress) doc.fontSize(9).font("Helvetica").text(labAddress, { align: "center" });
    if (labPhone) doc.fontSize(9).text(`Phone: ${labPhone}`, { align: "center" });

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Report title ──
    doc.fontSize(14).font("Helvetica-Bold").text("DIAGNOSTIC REPORT", { align: "center" });
    doc.moveDown(0.5);

    // ── Patient info ──
    const patientName = patient?.name ?? order.patientName;
    const infoY = doc.y;
    doc.fontSize(9).font("Helvetica");
    doc.text(`Patient: ${patientName}`, 40, infoY);
    doc.text(`Age / Gender: ${order.patientAge} yrs / ${order.patientGender}`, 40);
    doc.text(`Phone: ${order.patientPhone}`, 40);
    doc.text(`Order ID: ${order.orderId}`, 300, infoY);
    doc.text(`Date: ${new Date(order.createdAt!).toLocaleDateString("en-IN")}`, 300);
    doc.text(`Sample ID: ${order.sampleId ?? "N/A"}`, 300);
    doc.moveDown(0.5);

    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Column headers ──
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("TEST / PARAMETER", COLS.test, doc.y, { width: 200 });
    doc.text("RESULT", COLS.value, doc.y - doc.currentLineHeight(), { width: 90 });
    doc.text("UNIT", COLS.unit, doc.y - doc.currentLineHeight(), { width: 60 });
    doc.text("REFERENCE RANGE", COLS.range, doc.y - doc.currentLineHeight(), { width: 120 });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.3);

    // ── Results ──
    for (const result of approvedResults) {
      const rowY = doc.y;

      doc.fontSize(10).font("Helvetica-Bold").text(result.testName, COLS.test, rowY, { width: 200 });
      doc.moveDown(0.2);

      for (const pr of result.parameterResults) {
        const paramY = doc.y;
        const rangeText =
          pr.normalMin !== undefined && pr.normalMax !== undefined
            ? `${pr.normalMin} - ${pr.normalMax}`
            : pr.remarks ?? "-";

        doc.fontSize(9).font(pr.isAbnormal ? "Helvetica-Bold" : "Helvetica");

        doc.text(`  ${pr.parameterName}`, COLS.test, paramY, { width: 210 });

        const valueText = pr.isAbnormal ? `${pr.value} *` : pr.value || "-";
        doc.text(valueText, COLS.value, paramY, { width: 90 });
        doc.text(pr.unit || "-", COLS.unit, paramY, { width: 60 });
        doc.text(rangeText, COLS.range, paramY, { width: 120 });

        doc.moveDown(0.3);
      }

      if (result.overallRemarks) {
        doc.fontSize(8).font("Helvetica-Oblique").text(`  Remarks: ${result.overallRemarks}`, COLS.test, doc.y, { width: W });
      }

      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).dash(2, { space: 3 }).stroke().undash();
      doc.moveDown(0.3);
    }

    // ── Footer ──
    doc.moveDown(1);
    if (doctorName) {
      doc.fontSize(9).font("Helvetica-Bold").text(`Verified by: ${doctorName}`, { align: "right" });
    }
    doc.moveDown(0.5);
    doc.fontSize(8).font("Helvetica").fillColor("gray").text(reportFooter, 40, doc.y, { align: "center", width: W });

    doc.end();
  } catch (error: any) {
    console.error("Lab report PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate report", error: error.message });
    }
  }
});

// Reports & analytics
router.get("/analytics", requireAuth, requireRole(["LAB_ADMIN"]), async (req, res) => {
  try {
    const labId = req.user!.labId;
    const { from, to } = req.query;

    const dateFilter: any = {};
    if (from) dateFilter.$gte = new Date(String(from));
    if (to) dateFilter.$lte = new Date(String(to));

    const matchStage: any = { labId };
    if (Object.keys(dateFilter).length) matchStage.createdAt = dateFilter;

    const [orderStats, statusBreakdown] = await Promise.all([
      LabOrder.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: "$grandTotal" },
            avgOrderValue: { $avg: "$grandTotal" },
          },
        },
      ]),
      LabOrder.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const stats = orderStats[0] ?? { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
    res.json({ stats, statusBreakdown });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
  }
});
