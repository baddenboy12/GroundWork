import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { CATEGORY_LABELS, type LogCategory } from "./constants.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type ExportOptions = {
  siteName: string;
  siteLocation?: string;
  logs: LogWithAuthor[];
  dateFrom?: string;
  dateTo?: string;
  category?: string;
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCSV({ siteName, logs, dateFrom, dateTo, category }: ExportOptions): void {
  const headers = ["Date & Time", "Title", "Category", "Author", "Notes", "Location", "Photos"];
  const rows = logs.map((log) => [
    format(new Date(log.loggedAt), "yyyy-MM-dd HH:mm"),
    log.title,
    CATEGORY_LABELS[log.category as LogCategory] ?? log.category,
    log.authorName,
    log.content.replace(/\n/g, " "),
    log.location ?? "",
    String(log.photoUrls?.length ?? 0),
  ]);

  // Metadata header rows
  const meta: string[][] = [
    ["LogVault Field Log Export"],
    [`Site: ${siteName}`],
    dateFrom || dateTo ? [`Period: ${dateFrom ?? "start"} to ${dateTo ?? "present"}`] : [],
    category && category !== "all" ? [`Category: ${CATEGORY_LABELS[category as LogCategory] ?? category}`] : [],
    [`Exported: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
    [`Total entries: ${logs.length}`],
    [],
  ].filter((r) => r.length > 0);

  const csvContent = [...meta, headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const safeName = siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  link.download = `logvault-${safeName}-${dateStr}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Shared PDF helpers ───────────────────────────────────────────────────────

// Brand colours (RGB)
const AMBER: [number, number, number] = [245, 158, 11];
const DARK: [number, number, number] = [18, 24, 38];
const MID: [number, number, number] = [40, 48, 66];
const LIGHT: [number, number, number] = [245, 247, 250];
const MUTED: [number, number, number] = [120, 130, 150];
const WHITE: [number, number, number] = [255, 255, 255];

const CATEGORY_PDF_COLORS: Record<LogCategory, [number, number, number]> = {
  inspection: [59, 130, 246],
  maintenance: [245, 158, 11],
  incident: [239, 68, 68],
  audit: [168, 85, 247],
  general: [100, 116, 139],
};

function drawPageHeader(doc: jsPDF, pageW: number): void {
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 26, pageW, 2, "F");
}

function drawPageFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  page: number,
  total: number,
  margin: number
): void {
  doc.setFillColor(...DARK);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("LogVault — Confidential field report", margin, pageH - 4);
  doc.text(`Page ${page} of ${total}`, pageW - margin, pageH - 4, { align: "right" });
}

function periodLabel(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) return "All entries";
  if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
  if (dateFrom) return `From ${dateFrom}`;
  return `Up to ${dateTo}`;
}

// ─── Summary Table PDF ────────────────────────────────────────────────────────

export function exportPDF({
  siteName,
  siteLocation,
  logs,
  dateFrom,
  dateTo,
  category,
}: ExportOptions): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const now = new Date();

  drawPageHeader(doc, pageW);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text("LogVault", margin, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Summary Table Report", margin, 19);

  doc.setFontSize(8);
  doc.text(`Generated: ${format(now, "MMM d, yyyy 'at' h:mm a")}`, pageW - margin, 12, { align: "right" });

  // Site info block
  let y = 38;
  doc.setFillColor(...MID);
  doc.roundedRect(margin, y, pageW - margin * 2, siteLocation ? 18 : 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(siteName, margin + 4, y + 8);
  if (siteLocation) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(siteLocation, margin + 4, y + 14);
  }
  y += (siteLocation ? 18 : 12) + 4;

  // Filter summary
  const activeFilters: string[] = [];
  if (dateFrom || dateTo) activeFilters.push(`Period: ${periodLabel(dateFrom, dateTo)}`);
  if (category && category !== "all")
    activeFilters.push(`Category: ${CATEGORY_LABELS[category as LogCategory]}`);

  if (activeFilters.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Filters: ${activeFilters.join("  ·  ")}`, margin, y);
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...AMBER);
  doc.text(`${logs.length} log ${logs.length === 1 ? "entry" : "entries"}`, margin, y);
  y += 6;

  const tableBody = logs.map((log) => [
    format(new Date(log.loggedAt), "MMM d, yyyy\nh:mm a"),
    log.title,
    CATEGORY_LABELS[log.category as LogCategory] ?? log.category,
    log.authorName,
    log.content,
    log.photoUrls?.length > 0 ? String(log.photoUrls.length) : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Date & Time", "Title", "Category", "Author", "Notes", "Photos"]],
    body: tableBody,
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: "bold", fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3, textColor: [30, 36, 50], valign: "top" },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: 38, fontStyle: "bold" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 24 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 14, halign: "center" },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const log = logs[data.row.index];
        const color = CATEGORY_PDF_COLORS[log.category as LogCategory] ?? MUTED;
        doc.setFillColor(...color);
        doc.roundedRect(
          data.cell.x + 2,
          data.cell.y + (data.cell.height - 5) / 2,
          data.cell.width - 4,
          5,
          1,
          1,
          "F"
        );
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...WHITE);
        doc.text(
          CATEGORY_LABELS[log.category as LogCategory] ?? log.category,
          data.cell.x + data.cell.width / 2,
          data.cell.y + data.cell.height / 2 + 0.5,
          { align: "center" }
        );
      }
    },
  });

  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc, pageW, pageH, i, totalPages, margin);
  }

  const dateStr = format(now, "yyyy-MM-dd");
  const safeName = siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  doc.save(`logvault-${safeName}-${dateStr}.pdf`);
}

// ─── Full Report PDF ──────────────────────────────────────────────────────────

export function exportFullReportPDF({
  siteName,
  siteLocation,
  logs,
  dateFrom,
  dateTo,
  category,
}: ExportOptions): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const now = new Date();
  const LINE_H = 4.5; // mm per text line at ~9pt

  // ── Cover page ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, pageH, "F");

  // Amber accent band
  doc.setFillColor(...AMBER);
  doc.rect(0, 60, pageW, 4, "F");

  // Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(...WHITE);
  doc.text("LogVault", margin, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...MUTED);
  doc.text("Full Field Log Report", margin, 56);

  // Site block
  let y = 80;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text(siteName, margin, y);
  y += 9;

  if (siteLocation) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text(siteLocation, margin, y);
    y += 8;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Period: ${periodLabel(dateFrom, dateTo)}`, margin, y);
  y += 6;
  if (category && category !== "all") {
    doc.text(`Category: ${CATEGORY_LABELS[category as LogCategory] ?? category}`, margin, y);
    y += 6;
  }
  doc.text(`Generated: ${format(now, "MMMM d, yyyy 'at' h:mm a")}`, margin, y);

  // Stats summary box
  y = 145;
  doc.setFillColor(...MID);
  doc.roundedRect(margin, y, contentW, 38, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...AMBER);
  doc.text(String(logs.length), margin + 8, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`total ${logs.length === 1 ? "entry" : "entries"}`, margin + 8, y + 28);

  // Category breakdown
  const catCounts: Partial<Record<LogCategory, number>> = {};
  logs.forEach((log) => {
    catCounts[log.category as LogCategory] = (catCounts[log.category as LogCategory] ?? 0) + 1;
  });

  let cx = margin + 52;
  for (const [cat, count] of Object.entries(catCounts)) {
    if (cx > pageW - margin - 30) break;
    const color = CATEGORY_PDF_COLORS[cat as LogCategory] ?? MUTED;
    doc.setFillColor(...color);
    doc.roundedRect(cx, y + 10, 3, 18, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...WHITE);
    doc.text(String(count), cx + 8, y + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(CATEGORY_LABELS[cat as LogCategory] ?? cat, cx + 8, y + 30);
    cx += 35;
  }

  // Cover footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("LogVault — Confidential field report", margin, pageH - 14);

  // ── Log entry pages ─────────────────────────────────────────────────────────
  doc.addPage();
  y = 18;

  logs.forEach((log) => {
    const catColor = CATEGORY_PDF_COLORS[log.category as LogCategory] ?? MUTED;

    // Pre-calculate text heights
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const titleLines = doc.splitTextToSize(log.title, contentW - 52);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const contentText = log.content.trim() || "(no notes)";
    const contentLines = doc.splitTextToSize(contentText, contentW - 14);

    const hasLocation = !!(log.location);
    const hasPhotos = (log.photoUrls?.length ?? 0) > 0;
    const metaRows = 1 + (hasLocation ? 1 : 0) + (hasPhotos ? 1 : 0);

    const titleH = titleLines.length * 5.5;
    const contentH = contentLines.length * LINE_H;
    const blockH = 6 + titleH + 8 + 0.5 + 4 + contentH + metaRows * 4 + 6;

    // Page break
    if (y + blockH > pageH - 14) {
      doc.addPage();
      y = 18;
    }

    // Block background
    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, y, contentW, blockH, 2, 2, "F");

    // Left category colour bar
    doc.setFillColor(...catColor);
    doc.roundedRect(margin, y, 3.5, blockH, 1.5, 1.5, "F");

    // Date/time (top right)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      format(new Date(log.loggedAt), "MMM d, yyyy  h:mm a"),
      pageW - margin - 2,
      y + 8,
      { align: "right" }
    );

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text(titleLines, margin + 8, y + 8);

    let ey = y + 6 + titleH;

    // Category pill + author
    doc.setFillColor(...catColor);
    doc.roundedRect(margin + 8, ey, 24, 5.5, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(
      CATEGORY_LABELS[log.category as LogCategory] ?? log.category,
      margin + 20,
      ey + 3.8,
      { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`By ${log.authorName}`, margin + 36, ey + 3.8);
    ey += 8;

    // Separator
    doc.setDrawColor(215, 220, 230);
    doc.line(margin + 8, ey, pageW - margin - 2, ey);
    ey += 4;

    // Notes content
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(45, 55, 72);
    doc.text(contentLines, margin + 8, ey);
    ey += contentH + 3;

    // Location
    if (hasLocation) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Location: ${log.location}`, margin + 8, ey);
      ey += 4;
    }

    // Photo count
    if (hasPhotos) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(
        `${log.photoUrls.length} photo attachment${log.photoUrls.length > 1 ? "s" : ""}`,
        margin + 8,
        ey
      );
    }

    y += blockH + 4;
  });

  // ── Footer on every page (skip cover page 1) ────────────────────────────────
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageHeader(doc, pageW);
    // Repeat site name in running header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(siteName, margin, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Full Field Log Report", margin, 21);
    doc.setFontSize(8);
    doc.text(`Generated: ${format(now, "MMM d, yyyy")}`, pageW - margin, 14, { align: "right" });
    drawPageFooter(doc, pageW, pageH, i - 1, totalPages - 1, margin);
  }

  const dateStr = format(now, "yyyy-MM-dd");
  const safeName = siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  doc.save(`logvault-${safeName}-full-report-${dateStr}.pdf`);
}
