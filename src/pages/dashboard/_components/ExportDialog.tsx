import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import {
  FileText, FileDown, Calendar, Tag, Loader2,
  Palette, ChevronDown,
} from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";
import {
  exportCSV, exportFullReportPDF,
  THEMES, DEFAULT_THEME_ID, type Theme,
} from "../_lib/export.ts";
import { CATEGORY_LABELS } from "../_lib/constants.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import ThemePicker from "./ThemePicker.tsx";

type ExportFormat = "full-pdf" | "csv";

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

// Small color swatch preview for theme trigger button
function ThemeSwatch({ theme }: { theme: Theme }) {
  const [cr, cg, cb] = theme.coverBg;
  const [ar, ag, ab] = theme.coverAccent;
  const [er, eg, eb] = theme.entryBg;
  return (
    <span className="inline-flex rounded overflow-hidden border border-border w-8 h-5 shrink-0">
      <span className="flex-1" style={{ background: `rgb(${cr},${cg},${cb})` }} />
      <span className="w-1" style={{ background: `rgb(${ar},${ag},${ab})` }} />
      <span className="flex-1" style={{ background: `rgb(${er},${eg},${eb})` }} />
    </span>
  );
}

export default function ExportDialog({ open, onClose, siteId, siteName, siteLocation }: Props) {
  const [format, setFormat] = useState<ExportFormat>("full-pdf");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(
    THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? THEMES[0]
  );
  const [themePopoverOpen, setThemePopoverOpen] = useState(false);

  const exportLogs = useQuery(
    api.logs.listBySiteForExport,
    open
      ? {
          siteId,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          category: category !== "all"
            ? (category as "inspection" | "maintenance" | "incident" | "audit" | "general")
            : undefined,
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
      } else {
        exportCSV(opts);
        toast.success(`CSV exported — ${count} ${count === 1 ? "entry" : "entries"}`);
      }
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export logs</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Format selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Format</Label>
            <div className="grid grid-cols-2 gap-2">
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
                  <span className="text-[11px] font-semibold text-foreground leading-tight">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme picker trigger — only for Full Report PDF */}
          {format === "full-pdf" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Report theme
              </Label>
              <Popover open={themePopoverOpen} onOpenChange={setThemePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <ThemeSwatch theme={selectedTheme} />
                    <span className="flex-1 text-left font-medium text-foreground">{selectedTheme.name}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[380px] p-3"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <p className="text-xs text-muted-foreground mb-2.5 font-medium uppercase tracking-wide">
                    Choose a theme — {selectedTheme.name}
                  </p>
                  <div className="max-h-72 overflow-y-auto pr-0.5">
                    <ThemePicker
                      value={selectedTheme.id}
                      onChange={(t) => { setSelectedTheme(t); setThemePopoverOpen(false); }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
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
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
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
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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
                <span className={cn("text-lg font-bold", count === 0 ? "text-muted-foreground" : "text-primary")}>
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
