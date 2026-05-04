import { Router } from "express";
import PDFDocument from "pdfkit";
import { requireAuth, requireRole } from "../shared/middleware/auth";
import { LabOrder } from "../labOrder/labOrder.model";
import { LabResult } from "../labResult/labResult.model";
import { LabPatient } from "../labPatient/labPatient.model";
import { LabSettings } from "../labSettings/labSettings.model";
import { LabTest } from "../labTest/labTest.model";

export const router = Router();
const LAB_ROLES = ["LAB_ADMIN", "LAB_OPERATOR"];

// ── Static clinical interpretation data (hardcoded per test type) ──────────

const INTERP_THYROID = `TABLE:Clinical Features of Thyroid disease
Hypothyroidism|Hyperthyroidism|Grave's disease
• Lethargy|• Tachycardia|• Exophthalmos / proptosis
• Weight gain|• Palpitations|• Chemosis
• Cold intolerance|• Hyperactivity|• Diffuse symmetrical goiter
• Constipation|• Weight loss with increased appetite|• Pretibial myxoedema
• Hair loss|• Heat intolerance|• Other autoimmune conditions
• Dry skin|• Sweating · Diarrhea · Fine tremor · Hyper reflexia · Goitre|• Thyroid bruit
• Depression|• Palmar erythema|
• Bradycardia|• Onycholysis|
• Memory impairment|• Muscle weakness and wasting|
• Menorrhagia|• Oligomenorrhoea / amenorrhoea|`;

const INTERP_HBA1C = `MIXED:HbA1c - Glycated Haemoglobin
LEFT:The A1c test is a common blood test used to identify prediabetes, diagnose type 1 and type 2 diabetes and to monitor how diabetes is managing. The A1c test result reflects your average blood glucose levels for the past two to three months. American Diabetes Association recommends HbA1c monitoring frequency should be quarterly, particularly in case with suboptimal HbA1c conditions.
COLS:HbA1c(%)|eAG(mg/dl)|Condition|Severity
6.0|125|Non Diabetic: < 6.0|#YELLOW
6.5|140||
7.0|154|Good Control: 6.0 - < 7.0|#AMBER
7.5|169||
8.0|183|Poor Control: 7.0 - < 8.0|#ORANGE
8.5|197||
9.0|212|Diabetic: > 8.0|#RED
9.5|226||
10.0|240||`;

const INTERP_LIPID = `TABLE:Lipid Profile - Interpretation
Parameter|Desirable|Borderline High|High Risk
Total Cholesterol|< 200 mg/dL|200 – 239 mg/dL|≥ 240 mg/dL
LDL Cholesterol|< 100 mg/dL|100 – 159 mg/dL|≥ 160 mg/dL
HDL Cholesterol|≥ 60 mg/dL (optimal)|40 – 59 mg/dL|< 40 mg/dL
Triglycerides|< 150 mg/dL|150 – 199 mg/dL|≥ 200 mg/dL
Non-HDL Cholesterol|< 130 mg/dL|130 – 189 mg/dL|≥ 190 mg/dL`;

const INTERP_LIVER = `TABLE:Liver Function - Interpretation
Test|Normal Range|Elevated Suggests|Significantly Elevated Suggests
AST / SGOT|10 – 40 U/L|Liver stress, muscle injury|Hepatitis, cirrhosis, MI
ALT / SGPT|7 – 56 U/L|Liver cell damage|Hepatitis, fatty liver disease
ALP|44 – 147 U/L|Bile duct disease, bone disease|Cholestasis, bone metastasis
GGT|8 – 61 U/L|Alcohol use, bile duct issue|Chronic liver disease
Bilirubin (Total)|0.1 – 1.2 mg/dL|Mild haemolysis or liver stress|Jaundice, hepatitis, obstruction
Albumin|3.5 – 5.0 g/dL|—|Low = impaired liver synthesis`;

const INTERP_RENAL = `TABLE:Renal Function - Interpretation
Test|Normal Range|Mild Abnormality|Significant Concern
Serum Creatinine|0.6 – 1.2 mg/dL|1.2 – 2.0 mg/dL|> 2.0 mg/dL
Blood Urea Nitrogen|7 – 20 mg/dL|20 – 40 mg/dL|> 40 mg/dL
Uric Acid (M)|3.4 – 7.0 mg/dL|7.0 – 9.0 mg/dL|> 9.0 mg/dL
Uric Acid (F)|2.4 – 6.0 mg/dL|6.0 – 8.0 mg/dL|> 8.0 mg/dL
eGFR|> 90 mL/min|60 – 89 (mild decrease)|< 60 (CKD staging required)`;

function getStaticInterpretation(testName: string): string | null {
  const n = testName.toLowerCase();
  if (/thyroid|tsh|triiodothyronine|thyroxine|\bft3\b|\bft4\b|\bt3\b|\bt4\b/.test(n)) return INTERP_THYROID;
  if (/hba1c|hb a1c|glycat|hemoglobin a1|haemoglobin a1/.test(n)) return INTERP_HBA1C;
  if (/lipid|cholesterol/.test(n)) return INTERP_LIPID;
  if (/liver function|lft|sgot|sgpt|bilirubin|albumin/.test(n)) return INTERP_LIVER;
  if (/renal function|kidney function|creatinine|blood urea|uric acid/.test(n)) return INTERP_RENAL;
  return null;
}

// ── Page dimensions ────────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M      = 38;
const CW     = PAGE_W - M * 2;   // 519.28
const RM     = M + CW;            // 557.28

// ── Colors — matched to sample report ─────────────────────────────────────
const C_STEEL    = "#4a90c4";   // steel blue — banner bg, interpretation header
const C_WHITE    = "#ffffff";
const C_COL_BG   = "#e2e2e2";   // light gray — results table column headers
const C_TBL_HDR  = "#d5e8f7";   // light blue — interpretation table column headers (matches sample)
const C_DARK     = "#111111";
const C_GRAY     = "#555555";
const C_LTGRAY   = "#999999";
const C_BORDER   = "#cccccc";
const C_NAVY     = "#0c2d4e";   // used only for the top lab-name banner

// ── Layout zones ───────────────────────────────────────────────────────────
const LAB_HDR_H = 52;
const HEADER_H  = LAB_HDR_H + 114;
const FOOTER_H  = 72;
const CONTENT_B = PAGE_H - FOOTER_H;

// ── Table column x-positions ───────────────────────────────────────────────
const CX_TEST  = M;
const CX_RES   = M + 220;
const CX_UNIT  = M + 290;
const CX_RANGE = M + 348;
const CW_RANGE = RM - CX_RANGE - 4;   // ~205

// ── Helpers ────────────────────────────────────────────────────────────────
function hLine(doc: any, y: number, c = C_BORDER, lw = 0.4) {
  doc.save().moveTo(M, y).lineTo(RM, y).strokeColor(c).lineWidth(lw).stroke().restore();
}
function fillRect(doc: any, x: number, y: number, w: number, h: number, color: string) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}
function strokeRect(doc: any, x: number, y: number, w: number, h: number, color: string, lw = 0.5) {
  doc.save().rect(x, y, w, h).strokeColor(color).lineWidth(lw).stroke().restore();
}
function at(doc: any, text: string, x: number, y: number, opts: any = {}) {
  doc.text(text, x, y, { lineBreak: false, ...opts });
}
function fmtDateTime(d: any): string {
  if (!d) return "—";
  const dt   = new Date(d);
  const date = dt.toLocaleDateString("en-IN", { year: "numeric", month: "2-digit", day: "2-digit" });
  const time = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
}

router.get("/order/:orderId/pdf", requireAuth, requireRole(LAB_ROLES), async (req, res) => {
  try {
    const order = await LabOrder.findOne({ _id: req.params.orderId, labId: req.user!.labId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const [results, patient, settings] = await Promise.all([
      LabResult.find({ orderId: order._id, labId: req.user!.labId }).sort({ testName: 1 }),
      LabPatient.findById(order.patientId),
      LabSettings.findOne({ labId: req.user!.labId }),
    ]);

    const approved = results.filter((r) => r.status === "APPROVED");
    if (approved.length === 0) {
      return res.status(400).json({ message: "No approved results to generate report" });
    }

    // ── Build live lookups from test catalog ──────────────────────────
    // paramRefMap:       parameterId → referenceText  (per-parameter ranges)
    // testInterpMap:     testId      → defaultInterpretation  (clinical features table etc.)
    // Both are sourced live from Admin → Tests so they update without re-initialising results.
    const testIds = [...new Set(approved.map((r) => String(r.testId)))];
    const testDocs = await LabTest.find({ _id: { $in: testIds }, labId: req.user!.labId });
    const paramRefMap      = new Map<string, string>();
    const testCategoryMap  = new Map<string, string>();
    testDocs.forEach((t) => {
      testCategoryMap.set(String(t._id), t.category);
      (t.parameters as any[]).forEach((p) => {
        if (p.referenceText) paramRefMap.set(String(p._id), p.referenceText);
      });
    });

    // ── Flatten order fields to avoid null-in-closure TS errors ───────
    const patientName    = (patient?.name ?? order.patientName).toUpperCase();
    const patientAge     = order.patientAge;
    const patientGender  = order.patientGender;
    const patientPhone   = order.patientPhone;
    const orderId        = order.orderId;
    const sampleId       = order.sampleId ?? "—";
    const sampleCollectedAt = order.sampleCollectedAt;
    const orderCreatedAt = (order as any).createdAt;
    const refDoctor      = patient?.referredBy ?? "";

    const labName    = settings?.labName             ?? "Diagnostic Laboratory";
    const labAddress = settings?.address             ?? "";
    const labPhone   = settings?.phone               ?? "";
    const footer     = settings?.reportFooter        ?? "This is an electronically authenticated report. Results should be interpreted by a qualified physician.";
    const doctorName = settings?.doctorSignatureName ?? "";

    const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="report-${orderId}.pdf"`);
    doc.pipe(res);

    // ── Header ─────────────────────────────────────────────────────────
    function drawHeader() {
      // Lab name banner (dark navy, matching our brand)
      fillRect(doc, 0, 0, PAGE_W, LAB_HDR_H, C_NAVY);
      doc.font("Helvetica-Bold").fontSize(18).fillColor(C_WHITE);
      at(doc, labName, M, 10, { width: CW, align: "center" });
      const subParts = [labAddress, labPhone ? `Ph: ${labPhone}` : ""].filter(Boolean);
      if (subParts.length) {
        doc.font("Helvetica").fontSize(8).fillColor("#93c5fd");
        at(doc, subParts.join("   ·   "), M, 32, { width: CW, align: "center" });
      }
      doc.save().moveTo(0, LAB_HDR_H).lineTo(PAGE_W, LAB_HDR_H)
        .strokeColor(C_NAVY).lineWidth(1).stroke().restore();

      const PY = LAB_HDR_H + 10;

      // Left: patient demographics
      doc.font("Helvetica-Bold").fontSize(12.5).fillColor(C_DARK);
      at(doc, patientName, M, PY + 6);
      doc.font("Helvetica").fontSize(9).fillColor(C_DARK);
      at(doc, `Age    :  ${patientAge} Year(s)`, M, PY + 24);
      at(doc, `Gender :  ${patientGender}`,       M, PY + 38);

      // Center: order / referral info
      const cx = M + 172;
      const centreRows: [string, string][] = [
        ["Order ID",   orderId],
        ["Ref Doctor", refDoctor],
        ["Phone",      patientPhone],
      ];
      let cy = PY + 10;
      for (const [lbl, val] of centreRows) {
        doc.font("Helvetica").fontSize(7.5).fillColor(C_GRAY);
        at(doc, `${lbl} :`, cx, cy);
        doc.font("Helvetica").fontSize(8.5).fillColor(C_DARK);
        at(doc, val, cx + 68, cy);
        cy += 14;
      }

      // Right: sample details box
      const bx = M + 325;
      const bw = RM - bx;
      strokeRect(doc, bx, PY + 4, bw, 88, C_BORDER, 0.6);
      const sRows: [string, string, boolean][] = [
        ["Sample Type", "SERUM",                       false],
        ["SID",          sampleId,                     true ],
        ["Collected on", fmtDateTime(sampleCollectedAt), false],
        ["Regd on",      fmtDateTime(orderCreatedAt),  false],
        ["Reported on",  fmtDateTime(new Date()),       false],
      ];
      let sy = PY + 10;
      for (const [lbl, val, bold] of sRows) {
        doc.font("Helvetica").fontSize(6.8).fillColor(C_GRAY);
        at(doc, lbl, bx + 7, sy);
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(C_DARK);
        at(doc, `:  ${val}`, bx + 74, sy);
        sy += 15;
      }

      hLine(doc, HEADER_H - 6, C_BORDER, 0.8);
    }

    // ── Test section banner (steel blue, white text — matches sample) ───
    function drawBanner(y: number, testName: string): number {
      fillRect(doc, M, y, CW, 22, C_STEEL);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(C_WHITE);
      at(doc, testName.toUpperCase(), M, y + 7, { width: CW, align: "center" });
      return y + 22;
    }

    // ── Column headers (light blue — matches sample) ───────────────────
    function drawColHeaders(y: number): number {
      fillRect(doc, M, y, CW, 18, C_TBL_HDR);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(C_DARK);
      at(doc, "Test Description",             CX_TEST  + 5, y + 5);
      at(doc, "Result",                        CX_RES   + 5, y + 5);
      at(doc, "Units",                         CX_UNIT  + 5, y + 5);
      at(doc, "Biological Reference Ranges",   CX_RANGE + 5, y + 5);
      return y + 18;
    }

    // ── Footer ──────────────────────────────────────────────────────────
    function drawFooters() {
      const total = doc.bufferedPageRange().count;
      for (let i = 0; i < total; i++) {
        doc.switchToPage(i);

        const fy = PAGE_H - FOOTER_H + 4;
        hLine(doc, fy, C_BORDER, 0.7);

        // Right: doctor signature
        if (doctorName) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor(C_DARK);
          at(doc, doctorName, RM - 160, fy + 10);
          doc.font("Helvetica").fontSize(8).fillColor(C_GRAY);
          at(doc, "MD PATHOLOGIST", RM - 160, fy + 23);
        }

        // Disclaimer bar at very bottom
        const barY = PAGE_H - 28;
        fillRect(doc, 0, barY, PAGE_W, 28, "#f4f4f4");
        doc.save().moveTo(0, barY).lineTo(PAGE_W, barY)
          .strokeColor(C_BORDER).lineWidth(0.4).stroke().restore();

        doc.font("Helvetica-Oblique").fontSize(6.8).fillColor(C_GRAY);
        at(doc, footer, M, barY + 5, { width: CW - 90 });
        const branch = [labName, labAddress].filter(Boolean).join("  ·  ");
        if (branch) at(doc, branch, M, barY + 16, { width: CW - 90 });

        doc.font("Helvetica-Bold").fontSize(8).fillColor(C_DARK);
        at(doc, `Page ${i + 1} of ${total}`, 0, barY + 10, { width: PAGE_W - M, align: "right" });
      }
    }

    // ── Severity color map (used by MIXED: blocks) ─────────────────────
    const SEVERITY_COLORS: Record<string, string> = {
      "#GREEN":  "#d4edda",
      "#YELLOW": "#fff9c4",
      "#AMBER":  "#ffe082",
      "#ORANGE": "#ffe0b2",
      "#RED":    "#ffcccc",
    };

    // ── Interpretation: plain text | TABLE: | MIXED: ───────────────────
    function drawRemark(text: string, y: number): number {

      // ── MIXED: — left text panel + right data table with severity bar ──
      if (text.startsWith("MIXED:")) {
        const lines = text.split("\n");
        const title = lines[0].slice(6).trim();
        let leftText = "";
        let colHeaders: string[] = [];
        const rows: { cells: string[]; color: string }[] = [];
        let lastColor = "";

        for (const line of lines.slice(1)) {
          if (line.startsWith("LEFT:")) { leftText = line.slice(5); continue; }
          if (line.startsWith("COLS:")) { colHeaders = line.slice(5).split("|").map((s) => s.trim()); continue; }
          if (!line.trim()) continue;
          const parts = line.split("|").map((s) => s.trim());
          const tail  = parts[parts.length - 1] ?? "";
          if (SEVERITY_COLORS[tail]) { lastColor = tail; parts[parts.length - 1] = ""; }
          rows.push({ cells: parts, color: lastColor });
        }

        const TITLE_H  = 22;
        const CH_H     = 16;
        const SEV_W    = 18;               // severity colour bar width
        const LEFT_W   = Math.round(CW * 0.38);
        const TABLE_X  = M + LEFT_W;
        const TABLE_W  = RM - TABLE_X;
        const DATA_COLS = Math.max(colHeaders.length - 1, 1);   // all cols except severity
        const COL_W    = (TABLE_W - SEV_W) / DATA_COLS;
        const PAD      = 4;

        // Pre-measure row heights from data cells
        const rowHs = rows.map(({ cells }) =>
          Math.max(14, ...cells.slice(0, DATA_COLS).map((cell) => {
            if (!cell) return 14;
            doc.font("Helvetica").fontSize(7.8);
            return doc.heightOfString(cell, { width: COL_W - PAD * 2 }) + PAD * 2;
          }))
        );
        const tableH = CH_H + rowHs.reduce((s, h) => s + h, 0);

        doc.font("Helvetica").fontSize(7.8);
        const leftH = doc.heightOfString(leftText, { width: LEFT_W - 12 }) + 16;
        const bodyH = Math.max(tableH, leftH);
        const blockH = TITLE_H + bodyH + 8;

        if (y + blockH > CONTENT_B) { doc.addPage(); drawHeader(); y = HEADER_H; }

        // Title banner
        fillRect(doc, M, y, CW, TITLE_H, C_STEEL);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(C_WHITE);
        at(doc, title, M, y + 7, { width: CW, align: "center" });
        y += TITLE_H;
        const bodyY = y;

        // Left text panel
        strokeRect(doc, M, bodyY, LEFT_W, bodyH, C_BORDER, 0.4);
        doc.font("Helvetica").fontSize(7.8).fillColor(C_DARK);
        doc.text(leftText, M + 6, bodyY + 8, { width: LEFT_W - 12, lineBreak: true });

        // Column headers
        fillRect(doc, TABLE_X, bodyY, TABLE_W, CH_H, C_TBL_HDR);
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C_DARK);
        colHeaders.slice(0, DATA_COLS).forEach((h, ci) =>
          at(doc, h, TABLE_X + ci * COL_W + PAD, bodyY + 4)
        );
        if (colHeaders[DATA_COLS]) {
          at(doc, colHeaders[DATA_COLS], TABLE_X + DATA_COLS * COL_W + 3, bodyY + 4, { width: SEV_W - 4 });
        }
        hLine(doc, bodyY + CH_H);
        y = bodyY + CH_H;

        // Data rows
        for (let ri = 0; ri < rows.length; ri++) {
          const { cells, color } = rows[ri];
          const rh = rowHs[ri];

          // Severity bar
          fillRect(doc, TABLE_X + DATA_COLS * COL_W, y, SEV_W, rh, SEVERITY_COLORS[color] ?? "#ffffff");

          // Cell content
          cells.slice(0, DATA_COLS).forEach((cell, ci) => {
            if (!cell) return;
            doc.font("Helvetica").fontSize(7.8).fillColor(C_DARK);
            doc.text(cell, TABLE_X + ci * COL_W + PAD, y + PAD, { width: COL_W - PAD * 2, lineBreak: true });
          });

          // Vertical dividers
          for (let ci = 1; ci <= DATA_COLS; ci++) {
            doc.save()
              .moveTo(TABLE_X + ci * COL_W, y).lineTo(TABLE_X + ci * COL_W, y + rh)
              .strokeColor(C_BORDER).lineWidth(0.3).stroke().restore();
          }
          hLine(doc, y + rh);
          y += rh;
        }

        // Outer border for right table panel
        strokeRect(doc, TABLE_X, bodyY, TABLE_W, bodyH, C_BORDER, 0.4);

        return Math.max(y, bodyY + bodyH) + 8;
      }

      // ── TABLE: — interpretation table (sample report style) ───────────
      if (text.startsWith("TABLE:")) {
        const lines   = text.split("\n");
        const title   = lines[0].slice(6).trim();
        const headers = (lines[1] ?? "").split("|").map((s) => s.trim());
        const rows    = lines.slice(2).filter((l) => l.trim()).map((l) => l.split("|").map((s) => s.trim()));
        const cols    = Math.max(headers.length, 1);

        // Indent 20 pt each side — noticeably smaller than the results table
        const INDENT  = 20;
        const TL      = M + INDENT;       // table left x
        const TW      = CW - INDENT * 2;  // table width
        const TR      = TL + TW;          // table right x

        const colW    = TW / cols;
        const PAD     = 6;
        const TITLE_H = 22;
        const CH_H    = 18;

        // Scoped hLine that spans only the table width
        const tHLine = (ly: number) => {
          doc.save().moveTo(TL, ly).lineTo(TR, ly)
            .strokeColor(C_BORDER).lineWidth(0.5).stroke().restore();
        };

        const FONT_SZ = 7.5;
        const ROW_PAD = 3;   // tighter padding = shorter rows

        // Pre-measure row heights with compact sizing
        const rowHs = rows.map((row) =>
          Math.max(13, ...row.map((cell) => {
            doc.font("Helvetica").fontSize(FONT_SZ);
            return doc.heightOfString(cell || " ", { width: colW - PAD * 2 }) + ROW_PAD * 2;
          }))
        );

        const totalH = TITLE_H + CH_H + rowHs.reduce((s, h) => s + h, 0);
        if (y + totalH > CONTENT_B) { doc.addPage(); drawHeader(); y = HEADER_H; }

        const tableTop = y;

        function drawTblBanner(ty: number) {
          fillRect(doc, TL, ty, TW, TITLE_H, C_STEEL);
          doc.font("Helvetica-Bold").fontSize(9).fillColor(C_WHITE);
          at(doc, title, TL, ty + 5, { width: TW, align: "center" });
        }
        function drawTblColHdrs(ty: number) {
          fillRect(doc, TL, ty, TW, CH_H, C_TBL_HDR);
          doc.font("Helvetica-Bold").fontSize(8).fillColor(C_DARK);
          headers.forEach((h, ci) => at(doc, h, TL + ci * colW + PAD, ty + 4));
          for (let ci = 1; ci < cols; ci++) {
            doc.save().moveTo(TL + ci * colW, ty).lineTo(TL + ci * colW, ty + CH_H)
              .strokeColor(C_BORDER).lineWidth(0.5).stroke().restore();
          }
          tHLine(ty + CH_H);
        }

        drawTblBanner(y); y += TITLE_H;
        drawTblColHdrs(y); y += CH_H;

        // ── Data rows (no row separators) ────────────────────────────
        for (let ri = 0; ri < rows.length; ri++) {
          const rh = rowHs[ri];

          if (y + rh > CONTENT_B) {
            strokeRect(doc, TL, tableTop, TW, y - tableTop, C_STEEL, 0.7);
            doc.addPage(); drawHeader(); y = HEADER_H;
            drawTblBanner(y); y += TITLE_H;
            drawTblColHdrs(y); y += CH_H;
          }

          // Vertical column dividers only — no horizontal row lines
          for (let ci = 1; ci < cols; ci++) {
            doc.save().moveTo(TL + ci * colW, y).lineTo(TL + ci * colW, y + rh)
              .strokeColor(C_BORDER).lineWidth(0.5).stroke().restore();
          }

          rows[ri].forEach((cell, ci) => {
            if (!cell) return;
            doc.font("Helvetica").fontSize(FONT_SZ).fillColor(C_DARK);
            doc.text(cell, TL + ci * colW + PAD, y + ROW_PAD, { width: colW - PAD * 2, lineBreak: true });
          });

          y += rh;
        }

        strokeRect(doc, TL, tableTop, TW, y - tableTop, C_STEEL, 0.7);
        return y + 8;
      }

      // ── Plain text interpretation box ──────────────────────────────────
      doc.font("Helvetica").fontSize(8.5);
      const tH   = doc.heightOfString(text, { width: CW - 20 });
      const boxH = tH + 32;
      if (y + boxH > CONTENT_B) { doc.addPage(); drawHeader(); y = HEADER_H; }
      strokeRect(doc, M, y, CW, boxH, C_STEEL, 0.6);
      fillRect(doc, M, y, CW, 18, C_STEEL);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C_WHITE);
      at(doc, "Interpretation:", M + 8, y + 5);
      fillRect(doc, M, y + 18, CW, boxH - 18, C_WHITE);
      doc.font("Helvetica").fontSize(8.5).fillColor(C_DARK);
      doc.text(text, M + 10, y + 22, { width: CW - 20, lineBreak: true });
      return y + boxH + 8;
    }

    // ── Render ─────────────────────────────────────────────────────────
    // Group approved results by category so one banner covers all tests
    // in that category (e.g. "HORMONES" for T3 + T4 + TSH together).
    const categoryGroups = new Map<string, typeof approved[number][]>();
    for (const r of approved) {
      const cat = testCategoryMap.get(String(r.testId)) ?? "OTHER";
      if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
      categoryGroups.get(cat)!.push(r);
    }

    drawHeader();
    let curY = HEADER_H;

    for (const [category, catResults] of categoryGroups) {
      // Ensure room for banner + col headers + at least one test sub-header + one row
      if (curY + 22 + 18 + 20 + 24 > CONTENT_B) {
        doc.addPage(); drawHeader(); curY = HEADER_H;
      }
      curY = drawBanner(curY, category);
      curY = drawColHeaders(curY);

      for (const result of catResults) {
        // ── Test name sub-header row (bold, no background) ────────────
        if (curY + 20 > CONTENT_B) {
          doc.addPage(); drawHeader(); curY = HEADER_H;
          curY = drawBanner(curY, category);
          curY = drawColHeaders(curY);
        }
        doc.font("Helvetica-Bold").fontSize(9).fillColor(C_DARK);
        at(doc, `  ${result.testName.toUpperCase()}`, CX_TEST + 5, curY + 5);
        curY += 20;

        // ── Parameter rows ────────────────────────────────────────────
        for (const pr of result.parameterResults) {
          const rangeText =
            paramRefMap.get(String(pr.parameterId)) ||
            pr.remarks ||
            (pr.normalMin !== undefined && pr.normalMax !== undefined
              ? `${pr.normalMin} - ${pr.normalMax}`
              : "—");

          doc.font("Helvetica").fontSize(8);
          const rangeH = doc.heightOfString(rangeText, { width: CW_RANGE - 8 });
          const rowH   = Math.max(24, rangeH + 10);

          if (curY + rowH > CONTENT_B) {
            doc.addPage(); drawHeader(); curY = HEADER_H;
            curY = drawBanner(curY, category);
            curY = drawColHeaders(curY);
          }

          const abnormal = pr.isAbnormal;
          const valStr   = pr.value || "—";

          doc.font("Helvetica").fontSize(8.5).fillColor(C_DARK);
          at(doc, pr.parameterName, CX_TEST + 8, curY + 4);

          doc.font(abnormal ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(C_DARK);
          at(doc, valStr, CX_RES + 5, curY + 4);
          if (abnormal && valStr !== "—") {
            const vw = doc.widthOfString(valStr);
            doc.save()
              .moveTo(CX_RES + 5, curY + 15).lineTo(CX_RES + 5 + vw, curY + 15)
              .strokeColor(C_DARK).lineWidth(0.6).stroke().restore();
          }

          doc.font("Helvetica").fontSize(8).fillColor(C_LTGRAY);
          at(doc, pr.unit || "", CX_UNIT + 5, curY + 4);

          doc.font("Helvetica").fontSize(8).fillColor(C_DARK);
          doc.text(rangeText, CX_RANGE + 5, curY + 4, { width: CW_RANGE - 8, lineBreak: true });

          curY += rowH;
        }

        // ── Interpretation / static clinical table ────────────────────
        // Operator remark shown first, then static clinical table — both render independently
        if (result.overallRemarks) curY = drawRemark(result.overallRemarks, curY);
        const staticInterp = getStaticInterpretation(result.testName);
        if (staticInterp) curY = drawRemark(staticInterp, curY);
        else if (!result.overallRemarks) curY += 6;
      }
    }

    drawFooters();
    doc.end();

  } catch (error: any) {
    console.error("Lab report PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate report", error: error.message });
    }
  }
});

// Reports & analytics
import { LabOrder as _LabOrder } from "../labOrder/labOrder.model";
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
        { $group: { _id: null, totalOrders: { $sum: 1 }, totalRevenue: { $sum: "$grandTotal" }, avgOrderValue: { $avg: "$grandTotal" } } },
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
