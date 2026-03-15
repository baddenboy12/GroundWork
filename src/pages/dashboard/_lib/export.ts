import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { CATEGORY_LABELS, type LogCategory } from "./constants.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };
type LogWithSite = LogWithAuthor & { siteName: string };

type ExportOptions = {
  siteName: string;
  siteLocation?: string;
  logs: LogWithAuthor[];
  dateFrom?: string;
  dateTo?: string;
  category?: string;
};

type GlobalLog = {
  siteName: string;
  title: string;
  content: string;
  category: string;
  authorName: string;
  loggedAt: string;
  location?: string;
  photoUrls: string[];
};

type GlobalExportOptions = {
  logs: GlobalLog[];
  siteNames: string[];
  dateFrom?: string;
  dateTo?: string;
  category?: string;
};

// ─── Image helpers ────────────────────────────────────────────────────────────

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getImgFormat(dataUrl: string): string {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}

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
  link.download = `${siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Shared PDF helpers ───────────────────────────────────────────────────────

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

// Thin amber accent bar drawn at top of each content page
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

// Content pages start below the 28mm header + padding
const CONTENT_START_Y = 35;

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

  // Report label (not brand)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...AMBER);
  doc.text("SUMMARY TABLE REPORT", margin, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Generated: ${format(now, "MMM d, yyyy 'at' h:mm a")}`, pageW - margin, 11, { align: "right" });

  // Site info block
  let y = CONTENT_START_Y;
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
    format(new Date(log.loggedAt), "MMM d, yyyy") + "\n" + format(new Date(log.loggedAt), "h:mm a"),
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
      0: { cellWidth: 32, halign: "center" }, // wider date column
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
          data.cell.x + 2, data.cell.y + (data.cell.height - 5) / 2,
          data.cell.width - 4, 5, 1, 1, "F"
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

  doc.save(`${siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-summary-${format(now, "yyyy-MM-dd")}.pdf`);
}

// ─── Full Report PDF ──────────────────────────────────────────────────────────

export async function exportFullReportPDF({
  siteName,
  siteLocation,
  logs,
  dateFrom,
  dateTo,
  category,
}: ExportOptions): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const now = new Date();
  const LINE_H = 4.5;

  // Pre-fetch all photos
  const allPhotoUrls = Array.from(new Set(logs.flatMap((l) => l.photoUrls ?? [])));
  const photoDataMap = new Map<string, string | null>();
  await Promise.all(allPhotoUrls.map(async (url) => {
    photoDataMap.set(url, await fetchImageDataUrl(url));
  }));

  // ── Cover page ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 0, pageW, 3, "F"); // thin top bar

  let y = 40;
  // Report type label (amber, small)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...AMBER);
  doc.text("FIELD LOG REPORT", margin, y);
  y += 14;

  // Site name as main heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  const siteNameLines = doc.splitTextToSize(siteName, contentW);
  doc.text(siteNameLines, margin, y);
  y += siteNameLines.length * 11;

  if (siteLocation) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(siteLocation, margin, y);
    y += 8;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
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

  // Footer watermark
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("LogVault — Confidential field report", margin, pageH - 14);

  // ── Log entry pages ─────────────────────────────────────────────────────────
  doc.addPage();
  y = CONTENT_START_Y;

  logs.forEach((log) => {
    const catColor = CATEGORY_PDF_COLORS[log.category as LogCategory] ?? MUTED;

    // Photo data
    const photosData = (log.photoUrls ?? []).slice(0, 3)
      .map((url) => ({ url, dataUrl: photoDataMap.get(url) ?? null }));
    const photosToRender = photosData.filter((p) => p.dataUrl !== null);
    const photoCount = photosToRender.length;
    const photoGap = 3;
    const photoAreaW = contentW - 16;
    const photoW = photoCount > 0 ? (photoAreaW - photoGap * (photoCount - 1)) / photoCount : 0;
    const photoH = photoCount > 0 ? Math.min(40, photoW * 0.65) : 0;
    const photoRowH = photoCount > 0 ? photoH + 8 : 0;

    // Pre-calculate text heights
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const titleLines = doc.splitTextToSize(log.title, contentW - 52);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const contentText = log.content.trim() || "(no notes)";
    const contentLines = doc.splitTextToSize(contentText, contentW - 14);

    const hasLocation = !!(log.location);
    const metaRows = hasLocation ? 1 : 0;
    const titleH = titleLines.length * 5.5;
    const contentH = contentLines.length * LINE_H;
    const blockH = 6 + titleH + 8 + 0.5 + 4 + contentH + metaRows * 4 + photoRowH + 6;

    if (y + blockH > pageH - 14) {
      doc.addPage();
      y = CONTENT_START_Y;
    }

    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, y, contentW, blockH, 2, 2, "F");
    doc.setFillColor(...catColor);
    doc.roundedRect(margin, y, 3.5, blockH, 1.5, 1.5, "F");

    // Date (top right)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      format(new Date(log.loggedAt), "MMM d, yyyy  h:mm a"),
      pageW - margin - 2, y + 8, { align: "right" }
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
      margin + 20, ey + 3.8, { align: "center" }
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`By ${log.authorName}`, margin + 36, ey + 3.8);
    ey += 8;

    doc.setDrawColor(215, 220, 230);
    doc.line(margin + 8, ey, pageW - margin - 2, ey);
    ey += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(45, 55, 72);
    doc.text(contentLines, margin + 8, ey);
    ey += contentH + 3;

    if (hasLocation) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Location: ${log.location}`, margin + 8, ey);
      ey += 5;
    }

    // Embedded photos
    if (photoCount > 0) {
      photosToRender.forEach((photo, idx) => {
        if (!photo.dataUrl) return;
        const px = margin + 8 + idx * (photoW + photoGap);
        try {
          doc.addImage(photo.dataUrl, getImgFormat(photo.dataUrl), px, ey, photoW, photoH, undefined, "FAST");
        } catch {
          doc.setFillColor(...MID);
          doc.roundedRect(px, ey, photoW, photoH, 2, 2, "F");
        }
      });
    }

    y += blockH + 4;
  });

  // ── Headers/footers on content pages ────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageHeader(doc, pageW);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(siteName, margin, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Field Log Report", margin, 21);
    doc.text(`Generated: ${format(now, "MMM d, yyyy")}`, pageW - margin, 14, { align: "right" });
    drawPageFooter(doc, pageW, pageH, i - 1, totalPages - 1, margin);
  }

  const dateStr = format(now, "yyyy-MM-dd");
  const safeName = siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  doc.save(`${safeName}-full-report-${dateStr}.pdf`);
}

// ─── Global (multi-site) CSV Export ──────────────────────────────────────────

export function exportGlobalCSV({ logs, siteNames, dateFrom, dateTo, category }: GlobalExportOptions): void {
  const headers = ["Date & Time", "Site", "Title", "Category", "Author", "Notes", "Location", "Photos"];
  const rows = logs.map((log) => [
    format(new Date(log.loggedAt), "yyyy-MM-dd HH:mm"),
    log.siteName,
    log.title,
    CATEGORY_LABELS[log.category as LogCategory] ?? log.category,
    log.authorName,
    log.content.replace(/\n/g, " "),
    log.location ?? "",
    String(log.photoUrls?.length ?? 0),
  ]);

  const meta: string[][] = [
    ["LogVault Multi-Site Export"],
    [`Sites: ${siteNames.join(", ")}`],
    dateFrom || dateTo ? [`Period: ${dateFrom ?? "start"} to ${dateTo ?? "present"}`] : [],
    category && category !== "all" ? [`Category: ${CATEGORY_LABELS[category as LogCategory] ?? category}`] : [],
    [`Exported: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
    [`Total entries: ${logs.length}`],
    [],
  ].filter((r) => r.length > 0);

  const csvContent = [...meta, headers, ...rows]
    .map((row) => row.map((cell) => {
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `logvault-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Global (multi-site) Summary Table PDF ───────────────────────────────────

export function exportGlobalPDF({ logs, siteNames, dateFrom, dateTo, category }: GlobalExportOptions): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const now = new Date();

  drawPageHeader(doc, pageW);

  // Report label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...AMBER);
  doc.text("MULTI-SITE SUMMARY REPORT", margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Generated: ${format(now, "MMM d, yyyy 'at' h:mm a")}`, pageW - margin, 11, { align: "right" });

  let y = CONTENT_START_Y;
  doc.setFillColor(...MID);
  doc.roundedRect(margin, y, pageW - margin * 2, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  const sitesLabel = siteNames.length <= 3
    ? siteNames.join(", ")
    : `${siteNames.slice(0, 3).join(", ")} +${siteNames.length - 3} more`;
  doc.text(sitesLabel, margin + 4, y + 8);
  y += 16;

  const activeFilters: string[] = [];
  if (dateFrom || dateTo) activeFilters.push(`Period: ${periodLabel(dateFrom, dateTo)}`);
  if (category && category !== "all") activeFilters.push(`Category: ${CATEGORY_LABELS[category as LogCategory]}`);
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
    format(new Date(log.loggedAt), "MMM d, yyyy") + "\n" + format(new Date(log.loggedAt), "h:mm a"),
    log.siteName,
    log.title,
    CATEGORY_LABELS[log.category as LogCategory] ?? log.category,
    log.authorName,
    log.content,
    log.photoUrls?.length > 0 ? String(log.photoUrls.length) : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Date & Time", "Site", "Title", "Category", "Author", "Notes", "Photos"]],
    body: tableBody,
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: "bold", fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 36, 50], valign: "top" },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 30, halign: "center" }, // wider date col — fits "Mar 15, 2026"
      1: { cellWidth: 36, fontStyle: "bold" },
      2: { cellWidth: 40 },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 26 },
      5: { cellWidth: "auto" },
      6: { cellWidth: 14, halign: "center" },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const log = logs[data.row.index];
        const color = CATEGORY_PDF_COLORS[log.category as LogCategory] ?? MUTED;
        doc.setFillColor(...color);
        doc.roundedRect(
          data.cell.x + 2, data.cell.y + (data.cell.height - 5) / 2,
          data.cell.width - 4, 5, 1, 1, "F"
        );
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
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

  doc.save(`logvault-multi-site-summary-${format(now, "yyyy-MM-dd")}.pdf`);
}

// ─── Global (multi-site) Full Report PDF ─────────────────────────────────────

export async function exportGlobalFullReportPDF({
  logs,
  siteNames,
  dateFrom,
  dateTo,
  category,
}: GlobalExportOptions): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const now = new Date();
  const LINE_H = 4.5;

  // Pre-fetch all photos
  const allPhotoUrls = Array.from(new Set(logs.flatMap((l) => l.photoUrls ?? [])));
  const photoDataMap = new Map<string, string | null>();
  await Promise.all(allPhotoUrls.map(async (url) => {
    photoDataMap.set(url, await fetchImageDataUrl(url));
  }));

  // ── Cover page ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 0, pageW, 3, "F"); // thin top accent

  let y = 40;

  // Report type label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...AMBER);
  doc.text("MULTI-SITE FIELD LOG REPORT", margin, y);
  y += 14;

  // Main heading: site count or single site name
  const coverTitle = siteNames.length === 1 ? siteNames[0] : `${siteNames.length} Sites`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  const coverTitleLines = doc.splitTextToSize(coverTitle, contentW);
  doc.text(coverTitleLines, margin, y);
  y += coverTitleLines.length * 11;

  if (siteNames.length > 1) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const listStr = siteNames.slice(0, 6).join(", ") + (siteNames.length > 6 ? ` +${siteNames.length - 6} more` : "");
    const listLines = doc.splitTextToSize(listStr, contentW);
    doc.text(listLines, margin, y);
    y += listLines.length * 5 + 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Period: ${periodLabel(dateFrom, dateTo)}`, margin, y);
  y += 6;
  if (category && category !== "all") {
    doc.text(`Category: ${CATEGORY_LABELS[category as LogCategory] ?? category}`, margin, y);
    y += 6;
  }
  doc.text(`Generated: ${format(now, "MMMM d, yyyy 'at' h:mm a")}`, margin, y);

  // Stats box
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

  const catCounts: Partial<Record<LogCategory, number>> = {};
  logs.forEach((log) => { catCounts[log.category as LogCategory] = (catCounts[log.category as LogCategory] ?? 0) + 1; });
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

  // Footer watermark
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("LogVault — Confidential field report", margin, pageH - 14);

  // ── Log entry pages ─────────────────────────────────────────────────────────
  doc.addPage();
  y = CONTENT_START_Y;

  logs.forEach((log) => {
    const catColor = CATEGORY_PDF_COLORS[log.category as LogCategory] ?? MUTED;

    // Photo data
    const photosData = (log.photoUrls ?? []).slice(0, 3)
      .map((url) => ({ url, dataUrl: photoDataMap.get(url) ?? null }));
    const photosToRender = photosData.filter((p) => p.dataUrl !== null);
    const photoCount = photosToRender.length;
    const photoGap = 3;
    const photoAreaW = contentW - 16;
    const photoW = photoCount > 0 ? (photoAreaW - photoGap * (photoCount - 1)) / photoCount : 0;
    const photoH = photoCount > 0 ? Math.min(40, photoW * 0.65) : 0;
    const photoRowH = photoCount > 0 ? photoH + 8 : 0;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const titleLines = doc.splitTextToSize(log.title, contentW - 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const contentText = log.content.trim() || "(no notes)";
    const contentLines = doc.splitTextToSize(contentText, contentW - 14);
    const hasLocation = !!log.location;
    const metaRows = hasLocation ? 1 : 0;
    const titleH = titleLines.length * 5.5;
    const contentH = contentLines.length * LINE_H;
    const blockH = 6 + titleH + 8 + 0.5 + 4 + contentH + metaRows * 4 + photoRowH + 6;

    if (y + blockH > pageH - 14) { doc.addPage(); y = CONTENT_START_Y; }

    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, y, contentW, blockH, 2, 2, "F");
    doc.setFillColor(...catColor);
    doc.roundedRect(margin, y, 3.5, blockH, 1.5, 1.5, "F");

    // Date (top right)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      format(new Date(log.loggedAt), "MMM d, yyyy  h:mm a"),
      pageW - margin - 2, y + 8, { align: "right" }
    );

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text(titleLines, margin + 8, y + 8);

    let ey = y + 6 + titleH;

    // Site pill
    doc.setFillColor(...MID);
    doc.roundedRect(margin + 8, ey, 30, 5.5, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(log.siteName, margin + 23, ey + 3.8, { align: "center" });

    // Category pill
    doc.setFillColor(...catColor);
    doc.roundedRect(margin + 42, ey, 24, 5.5, 1.2, 1.2, "F");
    doc.text(
      CATEGORY_LABELS[log.category as LogCategory] ?? log.category,
      margin + 54, ey + 3.8, { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`By ${log.authorName}`, margin + 70, ey + 3.8);
    ey += 8;

    doc.setDrawColor(215, 220, 230);
    doc.line(margin + 8, ey, pageW - margin - 2, ey);
    ey += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(45, 55, 72);
    doc.text(contentLines, margin + 8, ey);
    ey += contentH + 3;

    if (hasLocation) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Location: ${log.location}`, margin + 8, ey);
      ey += 5;
    }

    // Embedded photos
    if (photoCount > 0) {
      photosToRender.forEach((photo, idx) => {
        if (!photo.dataUrl) return;
        const px = margin + 8 + idx * (photoW + photoGap);
        try {
          doc.addImage(photo.dataUrl, getImgFormat(photo.dataUrl), px, ey, photoW, photoH, undefined, "FAST");
        } catch {
          doc.setFillColor(...MID);
          doc.roundedRect(px, ey, photoW, photoH, 2, 2, "F");
        }
      });
    }

    y += blockH + 4;
  });

  // ── Headers/footers on content pages ────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageHeader(doc, pageW);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    const headerTitle = siteNames.length === 1 ? siteNames[0] : `${siteNames.length} Sites`;
    doc.text(headerTitle, margin, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Multi-Site Field Log Report", margin, 21);
    doc.text(`Generated: ${format(now, "MMM d, yyyy")}`, pageW - margin, 14, { align: "right" });
    drawPageFooter(doc, pageW, pageH, i - 1, totalPages - 1, margin);
  }

  doc.save(`logvault-multi-site-full-report-${format(now, "yyyy-MM-dd")}.pdf`);
}

// Keep LogWithSite exported in case it's used elsewhere
export type { LogWithSite };
