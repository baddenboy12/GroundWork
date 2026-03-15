import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { FileText, FileDown, TableProperties, Calendar, Tag, Loader2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import { exportCSV, exportPDF, exportFullReportPDF, THEMES, DEFAULT_THEME_ID, type Theme } from "../_lib/export.ts";
import { CATEGORY_LABELS } from "../_lib/constants.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import ThemePicker from "./ThemePicker.tsx";

type ExportFormat = "full-pdf" | "table-pdf" | "csv";

const FORMAT_OPTIONS: {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    id: "full-pdf",
    label: "Full Report",
    description: "Detailed PDF with full notes per entry",
    icon: <FileText className="w-5 h-5" />,
    accent: "text-red-400 bg-red-500/10 border-red-500/30",
  },
  {
    id: "table-pdf",
    label: "Summary Table",
    description: "Compact PDF table overview",
    icon: <TableProperties className="w-5 h-5" />,
    accent: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  },
  {
    id: "csv",
    label: "CSV Spreadsheet",
    description: "Raw data for Excel, Sheets, etc.",
    icon: <FileDown className="w-5 h-5" />,
    accent: "text-green-400 bg-green-500/10 border-green-500/30",
  },
];

const CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "inspection", label: CATEGORY_LABELS.inspection },
  { value: "maintenance", label: CATEGORY_LABELS.maintenance },
  { value: "incident", label: CATEGORY_LABELS.incident },
  { value: "audit", label: CATEGORY_LABELS.audit },
  { value: "general", label: CATEGORY_LABELS.general },
];

type Props = {
  open: boolean;
  onClose: () => void;
  siteId: Id<"sites">;
  siteName: string;
  siteLocation?: string;
};

export default function ExportDialog({ open, onClose, siteId, siteName, siteLocation }: Props) {
  const [format, setFormat] = useState<ExportFormat>("full-pdf");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(
    THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? THEMES[0]
  );

  const exportLogs = useQuery(
    api.logs.listBySiteForExport,
    open
      ? {
          siteId,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          category: category !== "all" ? (category as "inspection" | "maintenance" | "incident" | "audit" | "general") : undefined,
        }
      : "skip"
  );

  const isLoading = exportLogs === undefined;
  const count = exportLogs?.length ?? 0;

  const handleExport = async () => {
    if (!exportLogs || exportLogs.length === 0) {
      toast.error("No log entries match the selected filters");
      return;
    }
    setIsExporting(true);
    try {
      const opts = {
        siteName,
        siteLocation,
        logs: exportLogs,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        category: category !== "all" ? category : undefined,
        theme: selectedTheme,
      };
      if (format === "full-pdf") {
        await exportFullReportPDF(opts);
        toast.success(`Full report exported — ${count} ${count === 1 ? "entry" : "entries"}`);
      } else if (format === "table-pdf") {
        exportPDF(opts);
        toast.success(`Summary PDF exported — ${count} ${count === 1 ? "entry" : "entries"}`);
      } else {
        exportCSV(opts);
        toast.success(`CSV exported — ${count} ${count === 1 ? "entry" : "entries"}`);
      }
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export logs</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Format selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat(opt.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                    format === opt.id
                      ? cn("border-2", opt.accent)
                      : "border-border bg-card hover:border-muted-foreground/40"
                  )}
                >
                  <span className={cn(format === opt.id ? opt.accent.split(" ")[0] : "text-muted-foreground")}>
                    {opt.icon}
                  </span>
                  <span className="text-[11px] font-semibold text-foreground leading-tight">
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme picker — only for Full Report PDF */}
          {format === "full-pdf" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Report theme
                <span className="ml-auto font-normal normal-case text-muted-foreground">
                  {selectedTheme.name}
                </span>
              </Label>
              <ThemePicker value={selectedTheme.id} onChange={setSelectedTheme} />
            </div>
          )}

          {/* Date range */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date range
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || undefined}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                />
              </div>
            </div>
            {!dateFrom && !dateTo && (
              <p className="text-xs text-muted-foreground">Leave blank to include all dates</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Live count */}
          <div className={cn(
            "rounded-lg border px-4 py-3 flex items-center justify-between",
            isLoading ? "border-border bg-muted/30" : "border-primary/30 bg-primary/5"
          )}>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Counting matching entries...
              </div>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">Entries to export</span>
                <span className={cn(
                  "text-lg font-bold",
                  count === 0 ? "text-muted-foreground" : "text-primary"
                )}>
                  {count}
                </span>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || isLoading || count === 0}
            className="gap-1.5"
          >
            {isExporting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
            ) : (
              <><FileDown className="w-4 h-4" /> Export {count > 0 ? count : ""}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
