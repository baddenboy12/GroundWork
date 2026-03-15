import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import {
  FileText, FileDown, TableProperties, Calendar, Tag, Loader2,
  MapPin, CheckSquare, Square, ChevronDown, ChevronUp,
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
import { cn } from "@/lib/utils.ts";
import {
  exportGlobalCSV,
  exportGlobalPDF,
  exportGlobalFullReportPDF,
} from "../_lib/export.ts";
import { CATEGORY_LABELS } from "../_lib/constants.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

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
    description: "Detailed PDF with full notes",
    icon: <FileText className="w-5 h-5" />,
    accent: "text-red-400 bg-red-500/10 border-red-500/30",
  },
  {
    id: "table-pdf",
    label: "Summary Table",
    description: "Compact PDF overview",
    icon: <TableProperties className="w-5 h-5" />,
    accent: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  },
  {
    id: "csv",
    label: "CSV Spreadsheet",
    description: "Raw data for Excel / Sheets",
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
};

export default function GlobalExportDialog({ open, onClose }: Props) {
  const sites = useQuery(api.sites.list, open ? {} : "skip");

  const [format, setFormat] = useState<ExportFormat>("full-pdf");
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<Id<"sites">>>(new Set());
  const [allSitesSelected, setAllSitesSelected] = useState(true);
  const [sitesExpanded, setSitesExpanded] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  // When sites load, default to "all selected"
  useEffect(() => {
    if (sites) {
      setSelectedSiteIds(new Set(sites.map((s) => s._id)));
    }
  }, [sites]);

  const toggleAllSites = () => {
    if (allSitesSelected) {
      setAllSitesSelected(false);
      setSelectedSiteIds(new Set());
    } else {
      setAllSitesSelected(true);
      setSelectedSiteIds(new Set(sites?.map((s) => s._id) ?? []));
    }
  };

  const toggleSite = (id: Id<"sites">) => {
    const next = new Set(selectedSiteIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedSiteIds(next);
    setAllSitesSelected(next.size === (sites?.length ?? 0));
  };

  // Query for the live count / export data
  const exportSiteIds = allSitesSelected ? [] : Array.from(selectedSiteIds);
  const exportLogs = useQuery(
    api.logs.listForGlobalExport,
    open && (allSitesSelected || selectedSiteIds.size > 0)
      ? {
          siteIds: exportSiteIds.length > 0 ? exportSiteIds : undefined,
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
      const siteNames =
        allSitesSelected
          ? (sites?.map((s) => s.name) ?? [])
          : (sites?.filter((s) => selectedSiteIds.has(s._id)).map((s) => s.name) ?? []);

      const opts = {
        logs: exportLogs,
        siteNames,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        category: category !== "all" ? category : undefined,
      };

      if (format === "full-pdf") {
        exportGlobalFullReportPDF(opts);
        toast.success(`Full report exported — ${count} ${count === 1 ? "entry" : "entries"}`);
      } else if (format === "table-pdf") {
        exportGlobalPDF(opts);
        toast.success(`Summary PDF exported — ${count} ${count === 1 ? "entry" : "entries"}`);
      } else {
        exportGlobalCSV(opts);
        toast.success(`CSV exported — ${count} ${count === 1 ? "entry" : "entries"}`);
      }
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export logs</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Format */}
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
                  <span className="text-[11px] font-semibold text-foreground leading-tight">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sites */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Sites
            </Label>

            <div className="rounded-xl border border-border overflow-hidden">
              {/* All sites toggle */}
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                onClick={toggleAllSites}
              >
                {allSitesSelected
                  ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                  : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className="text-sm font-medium text-foreground flex-1">All sites</span>
                <span className="text-xs text-muted-foreground">{sites?.length ?? 0} total</span>
                <button
                  type="button"
                  className="p-0.5 hover:bg-accent rounded"
                  onClick={(e) => { e.stopPropagation(); setSitesExpanded((v) => !v); }}
                >
                  {sitesExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </button>

              {/* Individual site list */}
              {sitesExpanded && sites && sites.length > 0 && (
                <div className="border-t border-border divide-y divide-border/50 max-h-48 overflow-y-auto">
                  {sites.map((site) => (
                    <button
                      key={site._id}
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent transition-colors text-left"
                      onClick={() => toggleSite(site._id)}
                    >
                      {selectedSiteIds.has(site._id)
                        ? <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                        : <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      <MapPin className="w-3 h-3 text-primary/60 shrink-0" />
                      <span className="text-sm text-foreground truncate">{site.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!allSitesSelected && selectedSiteIds.size === 0 && (
              <p className="text-xs text-destructive">Select at least one site</p>
            )}
          </div>

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
            disabled={isExporting || isLoading || count === 0 || (!allSitesSelected && selectedSiteIds.size === 0)}
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
