import { jsPDF } from "jspdf";
import { supabase } from "../supabaseClient";

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
  if (isNaN(d.getTime())) return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

export async function downloadQuotationPdf(quotationData) {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const margin = 16;
    const cardWidth = pageWidth - margin * 2; // 178mm
    const cardStartX = margin;
    const cardStartY = 20;
    const cardHeight = 220;
    const borderRadius = 6;
    const shadowOffset = 3.5;

    // 1. Draw Offset Shadow (Solid Black rounded rect)
    doc.setFillColor(15, 15, 15);
    doc.roundedRect(
      cardStartX + shadowOffset,
      cardStartY + shadowOffset,
      cardWidth,
      cardHeight,
      borderRadius,
      borderRadius,
      "F"
    );

    // 2. Draw Main White Card Container (White fill, 1.2pt black border)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.6);
    doc.roundedRect(
      cardStartX,
      cardStartY,
      cardWidth,
      cardHeight,
      borderRadius,
      borderRadius,
      "FD"
    );

    let curY = cardStartY + 14;
    const innerLeftX = cardStartX + 12;
    const innerRightX = cardStartX + cardWidth - 12;

    // 3. HEADER SECTION
    // Brand Logo Top Left
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20); // Red #E31B23
    doc.text("ad", innerLeftX, curY);
    const adWidth = doc.getTextWidth("ad");

    doc.setTextColor(227, 27, 35); // Dark Black
    doc.text("effect", innerLeftX + adWidth, curY);

    // Sub-brands / Taglines
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(227, 27, 35);
    doc.text("CONNECTING MEDIA", innerLeftX, curY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("North Lebanon | Outdoor", innerLeftX, curY + 11);
    doc.text("Advertising", innerLeftX, curY + 15);

    // Top Right Official Quotation Title & Details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text("OFFICIAL", innerRightX, curY - 1, { align: "right" });
    doc.text("QUOTATION", innerRightX, curY + 6, { align: "right" });

    // Quotation ID
    const quoRef = quotationData.id ? `QUO-${quotationData.id}` : `QUO-${quotationData.booking_id || 1}`;
    doc.setFontSize(10.5);
    doc.setTextColor(227, 27, 35);
    doc.text(quoRef, innerRightX, curY + 12, { align: "right" });

    // Date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${formatDate(quotationData.created_at)}`, innerRightX, curY + 17, { align: "right" });

    curY += 24;

    // Header Separator Line
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.8);
    doc.line(innerLeftX, curY, innerRightX, curY);

    curY += 8;

    // 4. PREPARED FOR CLIENT & CAMPAIGN REFERENCE BOX
    const infoBoxWidth = cardWidth - 24; // 154mm
    const infoBoxHeight = 28;
    const infoBoxX = innerLeftX;
    const infoBoxY = curY;

    // Light gray rounded box background
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.roundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 3, 3, "FD");

    const leftColX = infoBoxX + 6;
    const rightColX = infoBoxX + (infoBoxWidth / 2) + 4;
    let infoY = infoBoxY + 7;

    // Left Column: Prepared For Client
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("PREPARED FOR CLIENT", leftColX, infoY);

    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    const clientName = quotationData.client_name || "Client Name";
    doc.text(clientName, leftColX, infoY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    const clientIdText = quotationData.client_id ? `Client ID: ${quotationData.client_id}` : "";
    if (clientIdText) {
      doc.text(clientIdText, leftColX, infoY + 10);
    }

    // Right Column: Campaign Reference
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("CAMPAIGN REFERENCE", rightColX, infoY);

    doc.setFontSize(11);
    doc.setTextColor(227, 27, 35); // Red reference
    const billboardRef = quotationData.reference ? `Billboard ${quotationData.reference}` : "Billboard Ref";
    doc.text(billboardRef, rightColX, infoY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    const locationText = quotationData.media_location ? `Location: ${quotationData.media_location}` : "Location: N/A";
    doc.text(locationText, rightColX, infoY + 10);

    curY += infoBoxHeight + 10;

    // 5. TABLE SECTION
    const tableX = innerLeftX;
    const tableWidth = cardWidth - 24; // 154mm
    const col1W = 66; // Item & Media Description
    const col2W = 24; // Frequency
    const col3W = 28; // Period
    const col4W = 36; // Amount (USD)

    const tableHeaderH = 13;
    const rowH1 = 20;
    const rowH2 = 20;

    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.4);

    // Table Header Row
    doc.setFillColor(255, 255, 255);
    doc.rect(tableX, curY, tableWidth, tableHeaderH, "D");

    // Vertical dividers in header
    doc.line(tableX + col1W, curY, tableX + col1W, curY + tableHeaderH);
    doc.line(tableX + col1W + col2W, curY, tableX + col1W + col2W, curY + tableHeaderH);
    doc.line(tableX + col1W + col2W + col3W, curY, tableX + col1W + col2W + col3W, curY + tableHeaderH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);

    // Header Text
    doc.text("Item & Media", tableX + (col1W / 2), curY + 5, { align: "center" });
    doc.text("Description", tableX + (col1W / 2), curY + 9.5, { align: "center" });

    doc.text("Frequency", tableX + col1W + (col2W / 2), curY + 7.5, { align: "center" });
    doc.text("Period", tableX + col1W + col2W + (col3W / 2), curY + 7.5, { align: "center" });

    doc.text("Amount", tableX + col1W + col2W + col3W + (col4W / 2), curY + 5, { align: "center" });
    doc.text("(USD)", tableX + col1W + col2W + col3W + (col4W / 2), curY + 9.5, { align: "center" });

    let rowY = curY + tableHeaderH;

    // ROW 1: Media Item (e.g. Unipole (MG001-B))
    doc.rect(tableX, rowY, tableWidth, rowH1, "D");
    doc.line(tableX + col1W, rowY, tableX + col1W, rowY + rowH1);
    doc.line(tableX + col1W + col2W, rowY, tableX + col1W + col2W, rowY + rowH1);
    doc.line(tableX + col1W + col2W + col3W, rowY, tableX + col1W + col2W + col3W, rowY + rowH1);

    const mediaTitle = `${quotationData.media_type || 'Media'} (${quotationData.reference || 'Ref'})`;
    const mediaSub = `Media Material: ${quotationData.media_used || 'N/A'}`;
    const periodText = Array.isArray(quotationData.period)
      ? (quotationData.period.length > 0 ? quotationData.period.join(', ') : 'N/A')
      : quotationData.period
      ? quotationData.period
      : quotationData.starting_period
      ? (quotationData.ending_period ? `${quotationData.starting_period} - ${quotationData.ending_period}` : quotationData.starting_period)
      : "N/A";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text(mediaTitle, tableX + 4, rowY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text(mediaSub, tableX + 4, rowY + 13);

    // Frequency, Period, Amount
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text(String(quotationData.frequency ?? 1), tableX + col1W + (col2W / 2), rowY + 11, { align: "center" });
    doc.text(periodText, tableX + col1W + col2W + (col3W / 2), rowY + 11, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.text(`$ ${formatMoney(quotationData.total_cost_wo_printing)}`, tableX + col1W + col2W + col3W + (col4W / 2), rowY + 11, { align: "center" });

    rowY += rowH1;

    // ROW 2: Printing & Production Cost
    doc.rect(tableX, rowY, tableWidth, rowH2, "D");
    doc.line(tableX + col1W, rowY, tableX + col1W, rowY + rowH2);
    doc.line(tableX + col1W + col2W, rowY, tableX + col1W + col2W, rowY + rowH2);
    doc.line(tableX + col1W + col2W + col3W, rowY, tableX + col1W + col2W + col3W, rowY + rowH2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text("Printing & Production", tableX + 4, rowY + 7);
    doc.text("Cost", tableX + 4, rowY + 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text("High resolution outdoor", tableX + 4, rowY + 15);
    doc.text("print & installation", tableX + 4, rowY + 18.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text("1", tableX + col1W + (col2W / 2), rowY + 11, { align: "center" });
    doc.text("One-time", tableX + col1W + col2W + (col3W / 2), rowY + 11, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.text(`$ ${formatMoney(quotationData.printing_cost)}`, tableX + col1W + col2W + col3W + (col4W / 2), rowY + 11, { align: "center" });

    curY = rowY + rowH2 + 12;

    // 6. TOTALS SUMMARY BOX (BOTTOM RIGHT)
    const totalsBoxW = 74;
    const totalsBoxH = 34;
    const totalsBoxX = tableX + tableWidth - totalsBoxW;
    const totalsBoxY = curY;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.6);
    doc.roundedRect(totalsBoxX, totalsBoxY, totalsBoxW, totalsBoxH, 4, 4, "FD");

    let totY = totalsBoxY + 8;
    const labelX = totalsBoxX + 5;
    const valX = totalsBoxX + totalsBoxW - 5;

    // Line 1: Subtotal w/o Printing
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text("Subtotal w/o Printing:", labelX, totY);
    doc.text(`$ ${formatMoney(quotationData.total_cost_wo_printing)}`, valX, totY, { align: "right" });

    totY += 7;

    // Line 2: Printing & Mounting
    doc.text("Printing & Mounting:", labelX, totY);
    doc.text(`$ ${formatMoney(quotationData.printing_cost)}`, valX, totY, { align: "right" });

    totY += 4;

    // Divider Line inside Totals Box
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.5);
    doc.line(labelX, totY, valX, totY);

    totY += 7;

    // Line 3: Total Payable (Red Bold)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(227, 27, 35); // Red #E31B23
    doc.text("Total Payable:", labelX, totY);
    doc.setFontSize(12);
    doc.text(`$ ${formatMoney(quotationData.total_cost_with_printing)}`, valX, totY, { align: "right" });

    // File name
    const fileName = `quotation_${quotationData.booking_id || quotationData.id || Date.now()}.pdf`;

    // Save locally
    doc.save(fileName);

    // Convert PDF to Blob
    const pdfBlob = doc.output("blob");

    return { blob, fileName, doc };
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}