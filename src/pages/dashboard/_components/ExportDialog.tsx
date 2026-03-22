import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import {
  FileText, FileDown, Calendar, Tag, Loader2,
  Palette, ChevronDown, Type, Filter, ListChecks,
  CheckSquare, Square, Search, X,
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
  exportCSV, exportXLSX, exportFullReportPDF,
  THEMES, DEFAULT_THEME_ID, type Theme,
} from "../_lib/export.ts";
import { CATEGORY_LABELS } from "../_lib/constants.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { format } from "date-fns";
import ThemePicker from "./ThemePicker.tsx";

type ExportFormat = "full-pdf" | "xlsx" | "csv";
type SelectionMode = "filter" | "individual";

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
    id: "xlsx",
    label: "Excel (XLSX)",
    description: "Auto-sized columns, opens in Excel",
    icon: <FileDown className="w-5 h-5" />,
    accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
  {
    id: "csv",
    label: "CSV",
    description: "Plain text for any spreadsheet app",
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

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  inspection: "bg-blue-500/15 text-blue-400",
  maintenance: "bg-amber-500/15 text-amber-400",
  incident: "bg-red-500/15 text-red-400",
  audit: "bg-purple-500/15 text-purple-400",
  general: "bg-slate-500/15 text-slate-400",
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

type Props = {
  open: boolean;
  onClose: () => void;
  siteId: Id<"sites">;
  siteName: string;
  siteLocation?: string;
};

export default function ExportDialog({ open, onClose, siteId, siteName, siteLocation }: Props) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("filter");
  const [format_, setFormat_] = useState<ExportFormat>("full-pdf");
  const [reportTitle, setReportTitle] = useState("Field Log Report");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("all");
  const [entrySearch, setEntrySearch] = useState("");
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(
    THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? THEMES[0]
  );

  // Popover open states
  const [themePopoverOpen, setThemePopoverOpen] = useState(false);
  const [entriesPopoverOpen, setEntriesPopoverOpen] = useState(false);

  // Reset individual selection when switching modes
  useEffect(() => {
    if (selectionMode === "filter") {
      setSelectedEntryIds(new Set());
      setEntrySearch("");
    }
  }, [selectionMode]);

  const exportLogs = useQuery(
    api.logs.listBySiteForExport,
    open
      ? {
          siteId,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          category:
            category !== "all"
              ? (category as "inspection" | "maintenance" | "incident" | "audit" | "general")
              : undefined,
        }
      : "skip"
  );

  const isLoading = exportLogs === undefined;

  // Filtered list for the individual entry selector (search by title, content, author)
  const filteredEntries = useMemo(() => {
    if (!exportLogs) return [];
    if (!entrySearch.trim()) return exportLogs;
    const q = entrySearch.toLowerCase();
    return exportLogs.filter(
      (log) =>
        log.title.toLowerCase().includes(q) ||
        log.content.toLowerCase().includes(q) ||
        log.authorName.toLowerCase().includes(q)
    );
  }, [exportLogs, entrySearch]);

  // Auto-select all when switching to individual mode
  useEffect(() => {
    if (selectionMode === "individual" && exportLogs && selectedEntryIds.size === 0) {
      setSelectedEntryIds(new Set(exportLogs.map((l) => l._id)));
    }
  }, [selectionMode, exportLogs, selectedEntryIds.size]);

  const toggleEntry = (id: string) => {
    const next = new Set(selectedEntryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEntryIds(next);
  };

  const toggleAllFilteredEntries = () => {
    const filteredIds = new Set(filteredEntries.map((l) => l._id));
    const allSelected = filteredEntries.every((l) => selectedEntryIds.has(l._id));
    const next = new Set(selectedEntryIds);
    if (allSelected) filteredIds.forEach((id) => next.delete(id));
    else filteredIds.forEach((id) => next.add(id));
    setSelectedEntryIds(next);
  };

  const logsToExport = useMemo(() => {
    if (!exportLogs) return [];
    if (selectionMode === "filter") return exportLogs;
    return exportLogs.filter((l) => selectedEntryIds.has(l._id));
  }, [exportLogs, selectionMode, selectedEntryIds]);

  const count = logsToExport.length;

  const allFilteredSelected =
    filteredEntries.length > 0 && filteredEntries.every((l) => selectedEntryIds.has(l._id));

  const entriesSummary = isLoading
    ? "Loading…"
    : selectionMode === "individual"
    ? `${selectedEntryIds.size} of ${exportLogs?.length ?? 0} selected`
    : `${count} entries`;

  const handleExport = async () => {
    if (logsToExport.length === 0) {
      toast.error("No log entries selected for export");
      return;
    }
    setIsExporting(true);
    try {
      const opts = {
        siteName,
        siteLocation,
        logs: logsToExport,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        category: category !== "all" ? category : undefined,
        theme: selectedTheme,
        reportTitle,
      };
      if (format_ === "full-pdf") {
        await exportFullReportPDF(opts);
        toast.success(`Full report exported — ${count} ${count === 1 ? "entry" : "entries"}`);
      } else if (format_ === "xlsx") {
        await exportXLSX(opts);
        toast.success(`Excel exported — ${count} ${count === 1 ? "entry" : "entries"}`);
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
      <DialogContent className="max-w-md !top-[12%] !translate-y-0" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.8 }}
        >
        <DialogHeader>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          >
            <DialogTitle>Export logs — {siteName}</DialogTitle>
          </motion.div>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setSelectionMode("filter")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                selectionMode === "filter"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Bulk filter
            </button>
            <button
              type="button"
              onClick={() => setSelectionMode("individual")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                selectionMode === "individual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Select entries
            </button>
          </div>

          {/* Format selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat_(opt.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                    format_ === opt.id
                      ? cn("border-2", opt.accent)
                      : "border-border bg-card hover:border-muted-foreground/40"
                  )}
                >
                  <span className={cn(format_ === opt.id ? opt.accent.split(" ")[0] : "text-muted-foreground")}>
                    {opt.icon}
                  </span>
                  <span className="text-[11px] font-semibold text-foreground leading-tight">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Options</Label>
            <div className="space-y-2">

              {/* Theme — Full Report only */}
              {format_ === "full-pdf" && (
                <>
                  <Popover open={themePopoverOpen} onOpenChange={setThemePopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        <Palette className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground w-14 shrink-0 text-left">Theme</span>
                        <ThemeSwatch theme={selectedTheme} />
                        <span className="flex-1 text-left font-medium text-foreground truncate">{selectedTheme.name}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[380px] p-3" align="start" sideOffset={4}>
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

                  {/* Report title */}
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
                    <Type className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-14 shrink-0">Title</span>
                    <input
                      type="text"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="e.g. Field Log Report"
                      maxLength={80}
                      className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none min-w-0"
                    />
                  </div>
                </>
              )}

              {/* Date range */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> From
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    max={dateTo || undefined}
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> To
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    min={dateFrom || undefined}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {/* Category — bulk filter mode only */}
              {selectionMode === "filter" && (
                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-0">
                  <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground w-14 shrink-0">Category</span>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="border-0 shadow-none h-9 px-0 flex-1 text-sm font-medium focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Entries selector — individual mode */}
              {selectionMode === "individual" && (
                <Popover open={entriesPopoverOpen} onOpenChange={setEntriesPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <ListChecks className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground w-14 shrink-0 text-left">Entries</span>
                      <span className="flex-1 text-left font-medium text-foreground truncate">{entriesSummary}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0" align="start" sideOffset={4}>
                    {/* Search */}
                    <div className="p-2 border-b border-border space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Search entries by name…"
                          value={entrySearch}
                          onChange={(e) => setEntrySearch(e.target.value)}
                          className="pl-8 pr-8 text-sm h-8"
                        />
                        {entrySearch && (
                          <button
                            type="button"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setEntrySearch("")}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {!isLoading && filteredEntries.length > 0 && (
                        <div className="flex items-center justify-between px-0.5">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={toggleAllFilteredEntries}
                          >
                            {allFilteredSelected
                              ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                              : <Square className="w-3.5 h-3.5" />}
                            {allFilteredSelected ? "Deselect all" : "Select all"}
                            {entrySearch ? ` (${filteredEntries.length} shown)` : ""}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {selectedEntryIds.size} / {exportLogs?.length ?? 0}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Entry list */}
                    <div className="max-h-64 overflow-y-auto">
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading entries…
                        </div>
                      ) : filteredEntries.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          {entrySearch ? "No entries match your search" : "No entries found"}
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50 p-1">
                          {filteredEntries.map((log) => {
                            const isSelected = selectedEntryIds.has(log._id);
                            return (
                              <button
                                key={log._id}
                                type="button"
                                className={cn(
                                  "w-full flex items-start gap-2.5 px-2 py-2 text-left rounded-md transition-colors hover:bg-accent",
                                  isSelected && "bg-primary/5"
                                )}
                                onClick={() => toggleEntry(log._id)}
                              >
                                {isSelected
                                  ? <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                  : <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium text-foreground truncate">{log.title}</span>
                                    <span className={cn(
                                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                                      CATEGORY_BADGE_COLORS[log.category] ?? "bg-muted text-muted-foreground"
                                    )}>
                                      {CATEGORY_LABELS[log.category as keyof typeof CATEGORY_LABELS] ?? log.category}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {format(new Date(log.loggedAt), "MMM d, yyyy")} · {log.authorName}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
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
                <span className="text-sm text-muted-foreground">
                  {selectionMode === "individual" ? "Selected entries" : "Entries to export"}
                </span>
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
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
