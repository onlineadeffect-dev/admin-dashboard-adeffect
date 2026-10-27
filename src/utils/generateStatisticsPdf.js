import { jsPDF } from 'jspdf';

// ─── Color Palette & Sizing Constants ──────────────────────────────────────────
const BRAND_RED = [242, 6, 31];       // #f2061f
const DARK_RED = [222, 49, 10];       // #de310a
const TEXT_DARK = [30, 30, 30];       // #1e1e1e
const TEXT_MUTED = [100, 100, 100];   // #646464
const BG_LIGHT = [248, 249, 250];     // #f8f9fa
const BORDER_COLOR = [220, 224, 230]; // #dce0e6
const WHITE = [255, 255, 255];

const PAGE_W = 210; // A4 portrait width in mm
const PAGE_H = 297; // A4 portrait height in mm
const MARGIN_X = 14;
const MARGIN_BOTTOM = 18;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// ─── Drawing Helpers ─────────────────────────────────────────────────────────

const formatMoney = (val) => {
  const n = typeof val === 'number' ? val : parseFloat(val || 0);
  const num = Number.isFinite(n) ? n : 0;
  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const drawHeader = (doc, title, subtitle, periodLabel, pageNum, totalPages) => {
  // Top Brand Bar
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 0, PAGE_W, 6, 'F');

  // Header Box
  let y = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_RED);
  doc.text('AD EFFECT', MARGIN_X, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MUTED);
  doc.text('OUTDOOR MEDIA ADVERTISING & MANAGEMENT', MARGIN_X + 38, y - 0.5);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...TEXT_DARK);
  doc.text(title || 'STATISTICS & ANALYTICS REPORT', MARGIN_X, y);

  // Right-aligned report metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  const dateStr = `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  doc.text(dateStr, PAGE_W - MARGIN_X, y - 7, { align: 'right' });
  doc.text(`Timeframe: ${periodLabel || 'All Time'}`, PAGE_W - MARGIN_X, y - 2, { align: 'right' });

  y += 5;
  if (subtitle) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(subtitle, MARGIN_X, y);
    y += 4;
  }

  // Thin separator rule
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);

  return y + 6;
};

const drawFooter = (doc, pageNum, totalPages) => {
  const y = PAGE_H - 10;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y - 3, PAGE_W - MARGIN_X, y - 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Ad Effect Admin Intelligence System — Confidential Report', MARGIN_X, y + 1);

  const pageStr = totalPages ? `Page ${pageNum} of ${totalPages}` : `Page ${pageNum}`;
  doc.text(pageStr, PAGE_W - MARGIN_X, y + 1, { align: 'right' });
};

const drawSectionTitle = (doc, title, y) => {
  doc.setFillColor(...BRAND_RED);
  doc.rect(MARGIN_X, y, 3, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_DARK);
  doc.text(title.toUpperCase(), MARGIN_X + 6, y + 5.5);

  return y + 11;
};

/**
 * Draws an array of KPI scorecard tiles.
 */
const drawKpiCards = (doc, kpis, startY) => {
  const cards = [
    { label: 'TOTAL REVENUE', value: formatMoney(kpis.totalRevenue), sub: `Media: ${formatMoney(kpis.totalMedia)} | Print: ${formatMoney(kpis.totalPrinting)}` },
    { label: 'TOTAL BOOKINGS', value: String(kpis.totalBookings || 0), sub: `${kpis.totalBillboardsBooked || 0} billboards reserved` },
    { label: 'AVG BOOKING VALUE', value: formatMoney(kpis.avgBookingValue), sub: 'Per confirmed transaction' },
    { label: 'OCCUPANCY RATE', value: `${kpis.occupancyRate || 0}%`, sub: `${kpis.activeBillboardsCount || 0} / ${kpis.totalBillboardsCount || 0} billboards active` },
    { label: 'TOP CLIENT', value: kpis.topClient?.business_name || kpis.topClient?.name || 'N/A', sub: kpis.topClient ? `${formatMoney(kpis.topClient.spend)} total spend` : 'No data' },
    { label: 'MOST POPULAR BOARD', value: kpis.topBillboard?.billboard_id || 'N/A', sub: kpis.topBillboard ? `${kpis.topBillboard.count} bookings (${kpis.topBillboard.location || ''})` : 'No data' },
  ];

  const cols = 3;
  const cardW = (CONTENT_W - 8) / cols;
  const cardH = 20;
  const gap = 4;

  let y = startY;

  for (let i = 0; i < cards.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN_X + col * (cardW + gap);
    const curY = y + row * (cardH + gap);

    // Card background
    doc.setFillColor(...BG_LIGHT);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, curY, cardW, cardH, 2, 2, 'FD');

    // Red left accent indicator
    doc.setFillColor(...BRAND_RED);
    doc.roundedRect(x, curY, 2, cardH, 1, 1, 'F');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(cards[i].label, x + 5, curY + 5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    doc.text(cards[i].value, x + 5, curY + 11.5, { maxWidth: cardW - 7 });

    // Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(cards[i].sub, x + 5, curY + 16.5, { maxWidth: cardW - 7 });
  }

  const rows = Math.ceil(cards.length / cols);
  return y + rows * (cardH + gap) + 4;
};

/**
 * Draws a clean bordered table.
 */
const drawTable = (doc, startX, startY, colWidths, headers, rows, aligns = []) => {
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const ROW_H = 7;
  const HEADER_H = 8;
  const CELL_PAD = 2;

  // Header background
  doc.setFillColor(...DARK_RED);
  doc.rect(startX, startY, tableW, HEADER_H, 'F');

  // Header text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);

  let cx = startX;
  headers.forEach((header, i) => {
    const align = aligns[i] || 'left';
    const textX = align === 'right' ? cx + colWidths[i] - CELL_PAD
      : align === 'center' ? cx + colWidths[i] / 2
      : cx + CELL_PAD;
    doc.text(header, textX, startY + 5.5, { align, maxWidth: colWidths[i] - CELL_PAD * 2 });
    cx += colWidths[i];
  });

  let curY = startY + HEADER_H;

  doc.setFontSize(7.5);
  rows.forEach((row, rowIndex) => {
    // Alternate row bg
    if (rowIndex % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 249, 250);
    }
    doc.rect(startX, curY, tableW, ROW_H, 'F');

    // Row border
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.15);
    doc.line(startX, curY + ROW_H, startX + tableW, curY + ROW_H);

    cx = startX;
    row.forEach((cell, i) => {
      const align = aligns[i] || 'left';
      const textX = align === 'right' ? cx + colWidths[i] - CELL_PAD
        : align === 'center' ? cx + colWidths[i] / 2
        : cx + CELL_PAD;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_DARK);
      doc.text(String(cell ?? ''), textX, curY + 4.8, { align, maxWidth: colWidths[i] - CELL_PAD * 2 });
      cx += colWidths[i];
    });

    curY += ROW_H;
  });

  return curY + 4;
};

// ─── Main Export Function ────────────────────────────────────────────────────

/**
 * Generates and downloads the comprehensive Statistics PDF.
 */
export const downloadStatisticsPdf = async ({
  stats,
  periodLabel = 'All Time',
  visibleSections = {},
  customTitle = 'AD EFFECT — STATISTICS & ANALYTICS REPORT',
  customSubtitle = '',
  customNotes = '',
  chartImages = {},
  adminName = 'Administrator',
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let curPage = 1;
  const kpis = stats.kpis || {};

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1: Executive Overview, KPIs & Primary Trends
  // ══════════════════════════════════════════════════════════════════════════
  let y = drawHeader(doc, customTitle, customSubtitle, periodLabel, curPage);

  // Optional Admin Custom Notes / Executive Summary
  if (customNotes && customNotes.trim()) {
    doc.setFillColor(254, 242, 242); // very soft red
    doc.setDrawColor(...BRAND_RED);
    doc.setLineWidth(0.4);
    const splitNotes = doc.splitTextToSize(customNotes, CONTENT_W - 8);
    const boxH = Math.max(14, splitNotes.length * 4.2 + 8);
    doc.roundedRect(MARGIN_X, y, CONTENT_W, boxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_RED);
    doc.text('EXECUTIVE NOTES:', MARGIN_X + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(splitNotes, MARGIN_X + 4, y + 10);

    y += boxH + 6;
  }

  // 1. KPI Cards
  if (visibleSections.kpis !== false) {
    y = drawSectionTitle(doc, 'Key Performance Indicators (KPIs)', y);
    y = drawKpiCards(doc, kpis, y);
  }

  // 2. Revenue & Bookings Trend Images or Tables
  if (visibleSections.revenueTrend !== false && chartImages.revenueChart) {
    if (y + 60 > PAGE_H - MARGIN_BOTTOM) {
      drawFooter(doc, curPage);
      doc.addPage();
      curPage++;
      y = drawHeader(doc, customTitle, customSubtitle, periodLabel, curPage);
    }
    y = drawSectionTitle(doc, 'Monthly Revenue & Profit Growth', y);
    try {
      const imgProps = doc.getImageProperties(chartImages.revenueChart);
      const imgH = (imgProps.height * CONTENT_W) / imgProps.width;
      const fitH = Math.min(imgH, 55);
      doc.addImage(chartImages.revenueChart, 'PNG', MARGIN_X, y, CONTENT_W, fitH);
      y += fitH + 8;
    } catch (e) {
      console.warn('Could not insert revenue chart image:', e);
    }
  }

  if (visibleSections.bookingsTrend !== false && chartImages.bookingsChart) {
    if (y + 55 > PAGE_H - MARGIN_BOTTOM) {
      drawFooter(doc, curPage);
      doc.addPage();
      curPage++;
      y = drawHeader(doc, customTitle, customSubtitle, periodLabel, curPage);
    }
    y = drawSectionTitle(doc, 'Billboards Booked Volume per Month', y);
    try {
      const imgProps = doc.getImageProperties(chartImages.bookingsChart);
      const imgH = (imgProps.height * CONTENT_W) / imgProps.width;
      const fitH = Math.min(imgH, 48);
      doc.addImage(chartImages.bookingsChart, 'PNG', MARGIN_X, y, CONTENT_W, fitH);
      y += fitH + 8;
    } catch (e) {
      console.warn('Could not insert bookings chart image:', e);
    }
  }

  drawFooter(doc, curPage);

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2: Deep Dives (Top Billboards, Top Clients, Distribution)
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  curPage++;
  y = drawHeader(doc, customTitle, customSubtitle, periodLabel, curPage);

  // 3. Top Billboards
  if (visibleSections.topBillboards !== false && stats.topBillboards?.length > 0) {
    y = drawSectionTitle(doc, 'Most Booked & Top Performing Billboards', y);
    const headers = ['Billboard ID', 'Location', 'Structure / Media', 'Bookings', 'Total Revenue'];
    const colWidths = [32, 60, 42, 22, 26]; // sum = 182 = CONTENT_W
    const rows = stats.topBillboards.slice(0, 10).map((b) => [
      b.billboard_id || 'N/A',
      b.location || 'Unknown',
      b.type || 'Standard',
      String(b.count || 0),
      formatMoney(b.revenue || 0),
    ]);
    y = drawTable(doc, MARGIN_X, y, colWidths, headers, rows, ['left', 'left', 'left', 'center', 'right']);
    y += 2;
  }

  // 4. Most Loyal Clients
  if (visibleSections.topClients !== false && stats.topClients?.length > 0) {
    if (y + 45 > PAGE_H - MARGIN_BOTTOM) {
      drawFooter(doc, curPage);
      doc.addPage();
      curPage++;
      y = drawHeader(doc, customTitle, customSubtitle, periodLabel, curPage);
    }
    y = drawSectionTitle(doc, 'Most Loyal & High-Value Clients', y);
    const headers = ['Client / Business Name', 'Contact Info', 'Bookings', 'Total Spend', 'Avg. Deal Value'];
    const colWidths = [56, 52, 22, 26, 26];
    const rows = stats.topClients.slice(0, 10).map((c) => [
      c.business_name || c.name || 'Private Client',
      c.email || c.name || '-',
      String(c.count || 0),
      formatMoney(c.spend || 0),
      formatMoney(c.avgSpend || 0),
    ]);
    y = drawTable(doc, MARGIN_X, y, colWidths, headers, rows, ['left', 'left', 'center', 'right', 'right']);
    y += 2;
  }

  // 5. Media Breakdown & Booking Channels Summary
  if (
    (visibleSections.mediaBreakdown !== false && stats.mediaTypeBreakdown?.length > 0) ||
    (visibleSections.channels !== false && stats.channelBreakdown)
  ) {
    if (y + 40 > PAGE_H - MARGIN_BOTTOM) {
      drawFooter(doc, curPage);
      doc.addPage();
      curPage++;
      y = drawHeader(doc, customTitle, customSubtitle, periodLabel, curPage);
    }

    y = drawSectionTitle(doc, 'Inventory Share & Acquisition Channels', y);

    // Two-column tables
    const halfW = (CONTENT_W - 6) / 2;

    // Media Type table on the left
    if (stats.mediaTypeBreakdown?.length > 0) {
      const mediaHeaders = ['Media Type', 'Share %', 'Revenue'];
      const mediaWidths = [halfW * 0.45, halfW * 0.25, halfW * 0.3];
      const mediaRows = stats.mediaTypeBreakdown.slice(0, 6).map((m) => [
        m.type.toUpperCase(),
        `${m.percentage}%`,
        formatMoney(m.revenue),
      ]);
      drawTable(doc, MARGIN_X, y, mediaWidths, mediaHeaders, mediaRows, ['left', 'center', 'right']);
    }

    // Channels on the right
    if (stats.channelBreakdown) {
      const rightX = MARGIN_X + halfW + 6;
      const channelHeaders = ['Channel', 'Bookings', 'Share %'];
      const channelWidths = [halfW * 0.45, halfW * 0.25, halfW * 0.3];
      const channelRows = [
        ['Online Platform', String(stats.channelBreakdown.onlineCount || 0), `${stats.channelBreakdown.onlinePercent || 0}%`],
        ['Offline / Direct', String(stats.channelBreakdown.offlineCount || 0), `${stats.channelBreakdown.offlinePercent || 0}%`],
      ];
      drawTable(doc, rightX, y, channelWidths, channelHeaders, channelRows, ['left', 'center', 'right']);
    }

    y += 40;
  }

  drawFooter(doc, curPage);

  // Set total pages accurately
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  // File Download
  const cleanLabel = (periodLabel || 'All_Time').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `AdEffect_Statistics_${cleanLabel}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
