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
  filters: {
    search: string;
    category: string;
    dateFrom: string;
    dateTo: string;
  };
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCSV({ siteName, logs, filters }: ExportOptions): void {
  const headers = ["Date & Time", "Title", "Category", "Author", "Notes", "Photos"];
  const rows = logs.map((log) => [
    format(new Date(log.loggedAt), "yyyy-MM-dd HH:mm"),
    log.title,
    CATEGORY_LABELS[log.category as LogCategory] ?? log.category,
    log.authorName,
    log.content.replace(/\n/g, " "),
    String(log.photoUrls?.length ?? 0),
  ]);

  const csvContent = [headers, ...rows]
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

// ─── PDF Export ───────────────────────────────────────────────────────────────

// Brand colours (RGB)
const AMBER: [number, number, number] = [245, 158, 11];
const DARK: [number, number, number] = [18, 24, 38];
const MID: [number, number, number] = [40, 48, 66];
const LIGHT: [number, number, number] = [245, 247, 250];
const MUTED: [number, number, number] = [120, 130, 150];

const CATEGORY_PDF_COLORS: Record<LogCategory, [number, number, number]> = {
  inspection: [59, 130, 246],
  maintenance: [245, 158, 11],
  incident: [239, 68, 68],
  audit: [168, 85, 247],
  general: [100, 116, 139],
};

export function exportPDF({
  siteName,
  siteLocation,
  logs,
  filters,
}: ExportOptions): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const now = new Date();

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 28, "F");

  // Amber accent stripe
  doc.setFillColor(...AMBER);
  doc.rect(0, 26, pageW, 2, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("LogVault", margin, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Field Log Report", margin, 19);

  // Generated date (top-right)
  doc.setFontSize(8);
  doc.text(
    `Generated: ${format(now, "MMM d, yyyy 'at' h:mm a")}`,
    pageW - margin,
    12,
    { align: "right" }
  );

  // ── Site info block ───────────────────────────────────────────────────────
  let y = 38;

  doc.setFillColor(...MID);
  doc.roundedRect(margin, y, pageW - margin * 2, siteLocation ? 18 : 12, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(siteName, margin + 4, y + 8);

  if (siteLocation) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(siteLocation, margin + 4, y + 14);
  }

  y += (siteLocation ? 18 : 12) + 6;

  // ── Active filters summary ────────────────────────────────────────────────
  const activeFilters: string[] = [];
  if (filters.search) activeFilters.push(`Search: "${filters.search}"`);
  if (filters.category !== "all")
    activeFilters.push(`Category: ${CATEGORY_LABELS[filters.category as LogCategory]}`);
  if (filters.dateFrom) activeFilters.push(`From: ${filters.dateFrom}`);
  if (filters.dateTo) activeFilters.push(`To: ${filters.dateTo}`);

  if (activeFilters.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Filters applied: ${activeFilters.join("  ·  ")}`, margin, y);
    y += 6;
  }

  // ── Summary chips ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...AMBER);
  doc.text(`${logs.length} log ${logs.length === 1 ? "entry" : "entries"}`, margin, y);
  y += 6;

  // ── Table ─────────────────────────────────────────────────────────────────
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
    headStyles: {
      fillColor: DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 36, 50],
      valign: "top",
    },
    alternateRowStyles: {
      fillColor: LIGHT,
    },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: 38, fontStyle: "bold" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 24 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 14, halign: "center" },
    },
    // Colour the category cell
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
        doc.setTextColor(255, 255, 255);
        doc.text(
          CATEGORY_LABELS[log.category as LogCategory] ?? log.category,
          data.cell.x + data.cell.width / 2,
          data.cell.y + data.cell.height / 2 + 0.5,
          { align: "center" }
        );
      }
    },
  });

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages: number = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...DARK);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("LogVault — Confidential field report", margin, pageH - 4);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 4, {
      align: "right",
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const dateStr = format(now, "yyyy-MM-dd");
  const safeName = siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  doc.save(`logvault-${safeName}-${dateStr}.pdf`);
}
