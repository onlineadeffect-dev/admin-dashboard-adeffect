import { jsPDF } from "jspdf";
import { supabase } from "../supabaseClient";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatMoney = (val) => {
  const n = typeof val === "number" ? val : parseFloat(val || 0);
  const num = Number.isFinite(n) ? n : 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime()))
    return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

/**
 * For a given month, sum all printing cost entries that START in that month.
 * If an entry has no from_month specified, it is assigned to the first month of the campaign.
 * This ensures a single print cost is NOT repeated every month.
 */
const printingCostForMonth = (printingCostList, month, periodMonths) => {
  if (!Array.isArray(printingCostList) || !month) return 0;
  const firstMonth = (periodMonths && periodMonths.length > 0) ? periodMonths[0] : null;
  let total = 0;
  for (const entry of printingCostList) {
    const cost = parseFloat(entry.cost) || 0;
    if (cost <= 0) continue;
    const startMonth = entry.from_month || firstMonth;
    if (startMonth === month) {
      total += cost;
    }
  }
  return total;
};

const totalPrintingCost = (printingCostList) => {
  if (!Array.isArray(printingCostList)) return 0;
  return printingCostList.reduce((acc, e) => acc + (parseFloat(e.cost) || 0), 0);
};

/**
 * Format the print period entry as a list of months (e.g. "January, February, March")
 * instead of "from -> to".
 */
const formatPrintPeriodMonths = (fromMonth, toMonth, campaignPeriod) => {
  if (fromMonth && toMonth) {
    const fromIdx = ALL_MONTHS.indexOf(fromMonth);
    const toIdx = ALL_MONTHS.indexOf(toMonth);
    if (fromIdx !== -1 && toIdx !== -1) {
      if (fromIdx <= toIdx) {
        return ALL_MONTHS.slice(fromIdx, toIdx + 1).join(", ");
      } else {
        const part1 = ALL_MONTHS.slice(fromIdx);
        const part2 = ALL_MONTHS.slice(0, toIdx + 1);
        return [...part1, ...part2].join(", ");
      }
    }
    if (fromMonth === toMonth) return fromMonth;
    return `${fromMonth}, ${toMonth}`;
  }
  if (fromMonth) return fromMonth;
  if (toMonth) return toMonth;
  if (Array.isArray(campaignPeriod) && campaignPeriod.length > 0) {
    return campaignPeriod.join(", ");
  }
  return "All months";
};

// ─── PDF Layout constants ────────────────────────────────────────────────────

const PAGE_W = 210; // A4 width in mm
const MARGIN = 14;
const INNER_LEFT = MARGIN + 4; // 18mm
const INNER_RIGHT = PAGE_W - MARGIN - 4; // 192mm
const CONTENT_W = INNER_RIGHT - INNER_LEFT; // 174mm

// Red brand colour
const RED = [227, 27, 35];
const BLACK = [20, 20, 20];
const GREY_LIGHT = [248, 249, 250];
const GREY_BORDER = [220, 220, 220];

// ─── Drawing utilities ───────────────────────────────────────────────────────

const setFill = (doc, [r, g, b]) => doc.setFillColor(r, g, b);
const setDraw = (doc, [r, g, b]) => doc.setDrawColor(r, g, b);
const setColor = (doc, [r, g, b]) => doc.setTextColor(r, g, b);

/**
 * Draw a horizontal rule line spanning inner content width.
 */
const hRule = (doc, y, lw = 0.4) => {
  doc.setLineWidth(lw);
  setDraw(doc, BLACK);
  doc.line(INNER_LEFT, y, INNER_RIGHT, y);
};

/**
 * Draw a section heading in small-caps style.
 */
const sectionHeading = (doc, label, y) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setColor(doc, [140, 140, 140]);
  doc.text(label.toUpperCase(), INNER_LEFT, y);
  return y + 5;
};

// ─── Table drawing with auto-clip/wrap ──────────────────────────────────────

/**
 * Draw a simple bordered table.
 * @param {jsPDF} doc
 * @param {number} startX
 * @param {number} startY
 * @param {number[]} colWidths   — array of column widths in mm
 * @param {string[]} headers     — header labels
 * @param {Array<string[]>} rows — body rows (string arrays)
 * @param {number[]} [headerAligns]  — 'left'|'center'|'right' per column
 * @param {number[]} [bodyAligns]
 * @param {boolean} [lastRowBold]
 * @returns {number} Y position after the table
 */
const drawTable = (doc, startX, startY, colWidths, headers, rows, headerAligns, bodyAligns, lastRowBold = false) => {
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const ROW_H = 9;
  const HEADER_H = 10;
  const CELL_PAD = 2.5;

  // Header background
  setFill(doc, [240, 240, 240]);
  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.rect(startX, startY, tableW, HEADER_H, "FD");

  // Header text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setColor(doc, BLACK);

  let cx = startX;
  headers.forEach((header, i) => {
    const align = (headerAligns && headerAligns[i]) || "center";
    const textX = align === "right" ? cx + colWidths[i] - CELL_PAD
      : align === "left" ? cx + CELL_PAD
        : cx + colWidths[i] / 2;
    doc.text(header, textX, startY + HEADER_H / 2 + 2, {
      align,
      maxWidth: colWidths[i] - CELL_PAD * 2,
    });
    if (i < headers.length - 1) {
      doc.setLineWidth(0.3);
      doc.line(cx + colWidths[i], startY, cx + colWidths[i], startY + HEADER_H);
    }
    cx += colWidths[i];
  });

  // Body rows
  let ry = startY + HEADER_H;
  rows.forEach((row, rowIdx) => {
    const isLast = rowIdx === rows.length - 1;
    const bold = isLast && lastRowBold;
    const bg = bold ? [255, 248, 245] : [255, 255, 255];

    setFill(doc, bg);
    setDraw(doc, BLACK);
    doc.setLineWidth(0.3);
    doc.rect(startX, ry, tableW, ROW_H, "FD");

    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8.5);
    setColor(doc, bold ? RED : BLACK);

    let bx = startX;
    row.forEach((cell, i) => {
      const align = (bodyAligns && bodyAligns[i]) || "left";
      const textX = align === "right" ? bx + colWidths[i] - CELL_PAD
        : align === "center" ? bx + colWidths[i] / 2
          : bx + CELL_PAD;
      doc.text(String(cell), textX, ry + ROW_H / 2 + 2, {
        align,
        maxWidth: colWidths[i] - CELL_PAD * 2,
      });
      if (i < row.length - 1) {
        doc.setLineWidth(0.2);
        setDraw(doc, [200, 200, 200]);
        doc.line(bx + colWidths[i], ry, bx + colWidths[i], ry + ROW_H);
        setDraw(doc, BLACK);
      }
      bx += colWidths[i];
    });

    ry += ROW_H;
  });

  return ry;
};

// ─── Main export ─────────────────────────────────────────────────────────────

export async function downloadQuotationPdf(quotationData) {
  try {
    // ── Normalise data ──────────────────────────────────────────────────────
    const isUnofficial = !!quotationData.is_unofficial;
    const period = Array.isArray(quotationData.period)
      ? quotationData.period
      : quotationData.period
        ? quotationData.period.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    // Normalise printing_cost to array
    let printingCostList = [];
    if (Array.isArray(quotationData.printing_cost)) {
      printingCostList = quotationData.printing_cost;
    } else if (
      quotationData.printing_cost &&
      typeof quotationData.printing_cost === "object"
    ) {
      printingCostList = [quotationData.printing_cost];
    } else if (
      typeof quotationData.printing_cost === "number" &&
      quotationData.printing_cost > 0
    ) {
      // Legacy numeric value
      printingCostList = [{ cost: quotationData.printing_cost, from_month: "", to_month: "" }];
    }

    const totalWo = parseFloat(quotationData.total_cost_wo_printing) || 0;
    const numMonths = period.length || 1;
    const costPerMonth = totalWo / numMonths;
    const totalPrinting = totalPrintingCost(printingCostList);
    const grandTotal = totalWo + totalPrinting;

    // Per-month breakdown rows
    const monthRows = period.map((month) => {
      const printCost = printingCostForMonth(printingCostList, month, period);
      return {
        month,
        billboardCost: costPerMonth,
        printingCost: printCost,
        totalWithPrinting: costPerMonth + printCost,
      };
    });

    // ── Document setup ──────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageH = doc.internal.pageSize.getHeight();
    let curY = 18;

    // Helper: check if we need a new page
    const ensureSpace = (needed) => {
      if (curY + needed > pageH - 14) {
        doc.addPage();
        curY = 14;
      }
    };

    // ── HEADER ──────────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    setColor(doc, BLACK);
    doc.text("ad", INNER_LEFT, curY);
    const adW = doc.getTextWidth("ad");
    setColor(doc, RED);
    doc.text("effect", INNER_LEFT + adW, curY);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    setColor(doc, RED);
    doc.text("CONNECTING MEDIA", INNER_LEFT, curY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(doc, [120, 120, 120]);
    doc.text("North Lebanon | Outdoor", INNER_LEFT, curY + 11);
    doc.text("Advertising", INNER_LEFT, curY + 15);

    // Right: title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    setColor(doc, BLACK);
    if (isUnofficial) {
      doc.text("QUOTATION", INNER_RIGHT, curY + 3, { align: "right" });
    } else {
      doc.text("OFFICIAL", INNER_RIGHT, curY - 1, { align: "right" });
      doc.text("QUOTATION", INNER_RIGHT, curY + 6, { align: "right" });
    }

    const quoRef = quotationData.id
      ? `QUO-${quotationData.id}`
      : `QUO-${quotationData.booking_id || Date.now()}`;
    doc.setFontSize(10.5);
    setColor(doc, RED);
    doc.text(quoRef, INNER_RIGHT, curY + 12, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setColor(doc, [100, 100, 100]);
    doc.text(`Date: ${formatDate(quotationData.created_at)}`, INNER_RIGHT, curY + 17, { align: "right" });

    curY += 24;
    hRule(doc, curY, 0.8);
    curY += 8;

    // ── CLIENT & CAMPAIGN INFO BOX ──────────────────────────────────────────
    const infoBoxW = CONTENT_W; // 174mm
    const infoBoxH = 26;

    setFill(doc, GREY_LIGHT);
    setDraw(doc, GREY_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(INNER_LEFT, curY, infoBoxW, infoBoxH, 3, 3, "FD");

    const leftColX = INNER_LEFT + 6;
    const rightColX = INNER_LEFT + infoBoxW / 2 + 4;
    const colMaxW = infoBoxW / 2 - 10;
    let infoY = curY + 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(doc, [120, 120, 120]);
    doc.text("PREPARED FOR CLIENT", leftColX, infoY);

    doc.setFontSize(10.5);
    setColor(doc, BLACK);
    doc.text(quotationData.client_name || "Client Name", leftColX, infoY + 5, { maxWidth: colMaxW });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, [120, 120, 120]);
    if (quotationData.client_id) {
      doc.text(`Client ID: ${quotationData.client_id}`, leftColX, infoY + 10, { maxWidth: colMaxW });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(doc, [120, 120, 120]);
    doc.text("CAMPAIGN REFERENCE", rightColX, infoY);

    doc.setFontSize(10.5);
    setColor(doc, RED);
    doc.text(
      quotationData.reference ? `Billboard ${quotationData.reference}` : "Billboard Ref",
      rightColX,
      infoY + 5,
      { maxWidth: colMaxW }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, [120, 120, 120]);
    doc.text(
      quotationData.media_location ? `Location: ${quotationData.media_location}` : "Location: N/A",
      rightColX,
      infoY + 10,
      { maxWidth: colMaxW }
    );

    curY += infoBoxH + 8;

    // ── MEDIA DETAILS ROW ───────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(doc, [140, 140, 140]);
    doc.text("MEDIA DETAILS", INNER_LEFT, curY);
    curY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(doc, BLACK);
    const mediaLine = [
      quotationData.media_type ? `Type: ${quotationData.media_type}` : null,
      quotationData.media_used ? `Used: ${quotationData.media_used}` : null,
      quotationData.frequency != null ? `Frequency: ${quotationData.frequency}` : null,
    ]
      .filter(Boolean)
      .join("    |    ");
    doc.text(mediaLine || "N/A", INNER_LEFT, curY, { maxWidth: CONTENT_W });
    curY += 10;

    // ── SECTION 1: PER-MONTH BILLBOARD COST BREAKDOWN ───────────────────────
    ensureSpace(14 + (period.length + 1) * 9 + 10);

    curY = sectionHeading(doc, "Billboard Cost Breakdown by Month", curY);

    // colWidths sum = 42 + 44 + 44 + 44 = 174mm (matches CONTENT_W exactly)
    const bbColWidths = [42, 44, 44, 44];
    const bbHeaders = ["Month", "Billboard Cost / Mo", "Printing Cost", "Total w/ Printing"];
    const bbAligns = ["left", "right", "right", "right"];

    const bbRows = monthRows.map((r) => [
      r.month,
      `$ ${formatMoney(r.billboardCost)}`,
      r.printingCost > 0 ? `$ ${formatMoney(r.printingCost)}` : "$ 0.00",
      `$ ${formatMoney(r.totalWithPrinting)}`,
    ]);

    // Totals row
    bbRows.push([
      "TOTAL",
      `$ ${formatMoney(totalWo)}`,
      totalPrinting > 0 ? `$ ${formatMoney(totalPrinting)}` : "$ 0.00",
      `$ ${formatMoney(grandTotal)}`,
    ]);

    curY = drawTable(
      doc,
      INNER_LEFT,
      curY,
      bbColWidths,
      bbHeaders,
      bbRows,
      bbAligns,
      bbAligns,
      true // last row bold
    );

    curY += 10;

    // ── SECTION 2: PRINTING COST BREAKDOWN ─────────────────────────────────
    if (printingCostList.length > 0) {
      ensureSpace(14 + (printingCostList.length + 1) * 9 + 10);

      curY = sectionHeading(doc, "Printing & Production Cost Breakdown", curY);

      // colWidths sum = 74 + 36 + 64 = 174mm (matches CONTENT_W exactly)
      const prColWidths = [74, 36, 64];
      const prHeaders = ["Period (Months)", "Cost (USD)", "Notes"];
      const prAligns = ["left", "right", "left"];

      const prRows = printingCostList.map((entry) => {
        const periodLabel = formatPrintPeriodMonths(entry.from_month, entry.to_month, period);
        return [
          periodLabel,
          `$ ${formatMoney(entry.cost)}`,
          "High-resolution outdoor print & installation",
        ];
      });

      // Total printing row
      prRows.push(["TOTAL PRINTING COST", `$ ${formatMoney(totalPrinting)}`, ""]);

      curY = drawTable(
        doc,
        INNER_LEFT,
        curY,
        prColWidths,
        prHeaders,
        prRows,
        prAligns,
        prAligns,
        true
      );

      curY += 10;
    }

    // ── SECTION 3: SUMMARY TOTALS BOX ───────────────────────────────────────
    ensureSpace(55);

    const summaryW = 100;
    const summaryX = INNER_RIGHT - summaryW; // 92mm to 192mm

    // Summary lines
    const summaryLines = [
      {
        label: "Total Cost w/o Printing (all months):",
        value: `$ ${formatMoney(totalWo)}`,
        red: false,
      },
      {
        label: "Total Printing Cost:",
        value: `$ ${formatMoney(totalPrinting)}`,
        red: false,
      },
    ];

    if (period.length > 0) {
      summaryLines.unshift({
        label: `Cost w/o Printing per Month:`,
        value: `$ ${formatMoney(costPerMonth)}`,
        red: false,
        small: true,
      });
    }

    const summaryBoxH = 10 + summaryLines.length * 8 + 14;

    setFill(doc, [255, 255, 255]);
    setDraw(doc, BLACK);
    doc.setLineWidth(0.6);
    doc.roundedRect(summaryX, curY, summaryW, summaryBoxH, 4, 4, "FD");

    let sy = curY + 8;
    const labelX = summaryX + 4;
    const valX = INNER_RIGHT - 4;

    for (const line of summaryLines) {
      doc.setFont("helvetica", line.small ? "normal" : "bold");
      doc.setFontSize(line.small ? 7.5 : 8.5);
      setColor(doc, line.red ? RED : BLACK);
      doc.text(line.label, labelX, sy, { maxWidth: summaryW - 35 });
      doc.text(line.value, valX, sy, { align: "right" });
      sy += 8;
    }

    // Divider
    sy -= 2;
    doc.setLineWidth(0.5);
    setDraw(doc, BLACK);
    doc.line(labelX, sy, valX, sy);
    sy += 7;

    // Grand total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    setColor(doc, RED);
    doc.text("COMPLETE TOTAL (w/ Printing):", labelX, sy, { maxWidth: summaryW - 40 });
    doc.setFontSize(11.5);
    doc.text(`$ ${formatMoney(grandTotal)}`, valX, sy, { align: "right" });

    curY = curY + summaryBoxH + 12;

    // ── FOOTER NOTE ─────────────────────────────────────────────────────────
    ensureSpace(18);
    hRule(doc, curY, 0.5);
    curY += 5;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    setColor(doc, [160, 160, 160]);
    //doc.text(
      //"This quotation is valid for 30 days from the date of issue. All amounts are in USD.",
      //INNER_LEFT,
      //curY
    //);
    curY += 4;
    doc.text(
      "adeffect | North Lebanon | Outdoor Advertising",
      INNER_LEFT,
      curY
    );

    // ── Save & export ───────────────────────────────────────────────────────
    const fileName = `quotation_${quotationData.booking_id || quotationData.id || Date.now()}.pdf`;
    doc.save(fileName);
    const pdfBlob = doc.output("blob");

    return { blob: pdfBlob, fileName, doc };
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}