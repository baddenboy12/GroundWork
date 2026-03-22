import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import {
  FileText, FileDown, Calendar, Tag, Loader2,
  MapPin, CheckSquare, Square, Search, ListChecks, Filter,
  X, Palette, ChevronDown, Type,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";
import {
  exportGlobalCSV,
  exportGlobalXLSX,
  exportGlobalFullReportPDF,
  THEMES,
  DEFAULT_THEME_ID,
  type Theme,
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
    description: "Detailed PDF with full notes",
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
  { value: "all", label: "All Categories" },
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
};

export default function GlobalExportDialog({ open, onClose }: Props) {
  const sites = useQuery(api.sites.list, open ? {} : "skip");

  const [selectionMode, setSelectionMode] = useState<SelectionMode>("filter");
  const [format_, setFormat_] = useState<ExportFormat>("full-pdf");
  const [reportTitle, setReportTitle] = useState("Multi-Site Field Log Report");
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<Id<"sites">>>(new Set());
  const [allSitesSelected, setAllSitesSelected] = useState(true);
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
  const [sitesPopoverOpen, setSitesPopoverOpen] = useState(false);
  const [entriesPopoverOpen, setEntriesPopoverOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);


  // When sites load, default to all selected
  useEffect(() => {
    if (sites) {
      setSelectedSiteIds(new Set(sites.map((s) => s._id)));
    }
  }, [sites]);

  // Reset individual selections when switching modes
  useEffect(() => {
    if (selectionMode === "filter") {
      setSelectedEntryIds(new Set());
      setEntrySearch("");
    }
  }, [selectionMode]);

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
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSiteIds(next);
    setAllSitesSelected(next.size === (sites?.length ?? 0));
  };

  // Query for the export data
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

  // Filtered list for the individual entry selector
  const filteredEntries = useMemo(() => {
    if (!exportLogs) return [];
    if (!entrySearch.trim()) return exportLogs;
    const q = entrySearch.toLowerCase();
    return exportLogs.filter(
      (log) =>
        log.title.toLowerCase().includes(q) ||
        log.siteName.toLowerCase().includes(q) ||
        log.content.toLowerCase().includes(q) ||
        log.authorName.toLowerCase().includes(q)
    );
  }, [exportLogs, entrySearch]);

  // Sync selectedEntryIds when logs load (select all by default in individual mode)
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

  const isLoading = exportLogs === undefined;

  const logsToExport = useMemo(() => {
    if (!exportLogs) return [];
    if (selectionMode === "filter") return exportLogs;
    return exportLogs.filter((l) => selectedEntryIds.has(l._id));
  }, [exportLogs, selectionMode, selectedEntryIds]);

  const count = logsToExport.length;

  const allFilteredSelected =
    filteredEntries.length > 0 && filteredEntries.every((l) => selectedEntryIds.has(l._id));

  // Sites summary label
  const sitesSummary = allSitesSelected
    ? `All Sites (${sites?.length ?? 0})`
    : selectedSiteIds.size === 0
    ? "No sites selected"
    : `${selectedSiteIds.size} of ${sites?.length ?? 0} sites`;

  // Entries summary label
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
      const siteNames = allSitesSelected
        ? (sites?.map((s) => s.name) ?? [])
        : (sites?.filter((s) => selectedSiteIds.has(s._id)).map((s) => s.name) ?? []);

      const opts = {
        logs: logsToExport,
        siteNames,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        category: category !== "all" ? category : undefined,
        theme: selectedTheme,
        reportTitle,
      };

      if (format_ === "full-pdf") {
        await exportGlobalFullReportPDF(opts);
        toast.success(`Full report exported — ${count} ${count === 1 ? "entry" : "entries"}`);
      } else if (format_ === "xlsx") {
        await exportGlobalXLSX(opts);
        toast.success(`Excel exported — ${count} ${count === 1 ? "entry" : "entries"}`);
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
      <DialogContent className={cn("!max-w-none w-[90%] max-h-[90vh] top-[5%] translate-y-0 px-8 pb-8 pt-12 rounded-3xl [&>button]:w-16 [&>button]:h-16 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-2xl [&>button]:bg-white/10 [&>button>svg]:!w-10 [&>button>svg]:!h-10 [&>button]:active:scale-75 [&>button]:transition-transform", sitesPopoverOpen || categoryOpen || themePopoverOpen || entriesPopoverOpen ? "overflow-visible" : "overflow-y-auto")} onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
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
            <DialogTitle className="text-3xl font-bold relative" style={{ top: "-1.2rem" }}>Export Logs</DialogTitle>
          </motion.div>
        </DialogHeader>

        <div className="space-y-5 py-1 mt-4">
          {/* Selection mode toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setSelectionMode("filter")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-base font-medium transition-all",
                selectionMode === "filter"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter className="w-5 h-5" />
              Bulk Filter
            </button>
            <button
              type="button"
              onClick={() => setSelectionMode("individual")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-base font-medium transition-all",
                selectionMode === "individual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListChecks className="w-5 h-5" />
              Select Entries
            </button>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label className="text-base text-muted-foreground uppercase tracking-wide">Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat_(opt.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-all",
                    format_ === opt.id
                      ? cn("border-2", opt.accent)
                      : "border-border bg-card hover:border-muted-foreground/40"
                  )}
                >
                  <span className={cn(format_ === opt.id ? opt.accent.split(" ")[0] : "text-muted-foreground")}>
                    {opt.icon}
                  </span>
                  <span className="text-base font-semibold text-foreground leading-tight">{opt.label}</span>
                  <span className="text-sm text-muted-foreground leading-tight">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Compact row of selectors ── */}
          <div className="space-y-2">
            <Label className="text-base text-muted-foreground uppercase tracking-wide">Options</Label>
            <div className="space-y-2">

              {/* Theme — only for Full Report */}
              {format_ === "full-pdf" && (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 text-lg hover:bg-accent transition-colors"
                      onClick={() => { setThemePopoverOpen(!themePopoverOpen); setSitesPopoverOpen(false); setCategoryOpen(false); setEntriesPopoverOpen(false); }}
                    >
                      <Palette className="w-5 h-5 text-muted-foreground shrink-0" />
                      <span className="text-base text-muted-foreground shrink-0 text-left w-20">Theme</span>
                      <ThemeSwatch theme={selectedTheme} />
                      <span className="flex-1 text-left font-medium text-foreground truncate">{selectedTheme.name}</span>
                      <ChevronDown className={cn("w-5 h-5 text-muted-foreground shrink-0 transition-transform", themePopoverOpen && "rotate-180")} />
                    </button>
                    {themePopoverOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl border border-border bg-popover shadow-lg p-4">
                        <p className="text-sm text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                          Choose a theme — {selectedTheme.name}
                        </p>
                        <ThemePicker
                          value={selectedTheme.id}
                          onChange={(t) => { setSelectedTheme(t); setThemePopoverOpen(false); }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Report title */}
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3">
                    <Type className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-base text-muted-foreground shrink-0 w-20">Title</span>
                    <input
                      type="text"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="e.g. Multi-Site Field Log Report"
                      maxLength={80}
                      className="flex-1 bg-transparent text-lg font-medium text-foreground placeholder:text-muted-foreground outline-none min-w-0"
                    />
                  </div>
                </>
              )}

              {/* Sites — floating absolute dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-2xl border bg-card px-4 py-3 text-lg hover:bg-accent transition-colors",
                    !allSitesSelected && selectedSiteIds.size === 0 ? "border-destructive" : "border-border"
                  )}
                  onClick={() => { setSitesPopoverOpen(!sitesPopoverOpen); setThemePopoverOpen(false); setCategoryOpen(false); setEntriesPopoverOpen(false); }}
                >
                  <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                  <span className="text-base text-muted-foreground shrink-0 text-left w-20">Sites</span>
                  <span className="flex-1 text-left font-medium text-foreground truncate">{sitesSummary}</span>
                  <ChevronDown className={cn("w-5 h-5 text-muted-foreground shrink-0 transition-transform", sitesPopoverOpen && "rotate-180")} />
                </button>
                {sitesPopoverOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl border border-border bg-popover shadow-lg overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-border">
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors text-left"
                        onClick={toggleAllSites}
                      >
                        {allSitesSelected
                          ? <CheckSquare className="w-5 h-5 text-primary shrink-0" />
                          : <Square className="w-5 h-5 text-muted-foreground shrink-0" />}
                        <span className="text-lg font-medium">All Sites</span>
                        <span className="ml-auto text-base text-muted-foreground">{sites?.length ?? 0} total</span>
                      </button>
                    </div>
                    <div
                      className="px-3 py-2.5 space-y-1"
                      style={{
                        maxHeight: "384px",
                        overflowY: "auto",
                        overscrollBehavior: "contain",
                        touchAction: "pan-y",
                        WebkitOverflowScrolling: "touch",
                      }}
                    >
                      {!sites ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-base text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                        </div>
                      ) : sites.length === 0 ? (
                        <p className="py-4 text-center text-base text-muted-foreground">No sites found</p>
                      ) : (
                        sites.map((site) => (
                          <button
                            key={site._id}
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors text-left"
                            onClick={() => toggleSite(site._id)}
                          >
                            {selectedSiteIds.has(site._id)
                              ? <CheckSquare className="w-5 h-5 text-primary shrink-0" />
                              : <Square className="w-5 h-5 text-muted-foreground shrink-0" />}
                            <MapPin className="w-4 h-4 text-primary/60 shrink-0" />
                            <span className="text-lg text-foreground truncate">{site.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-base text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> From
                  </Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} className="text-base h-14" />
                </div>
                <div className="space-y-1">
                  <Label className="text-base text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> To
                  </Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} className="text-base h-14" />
                </div>
              </div>

              {/* Category — floating absolute dropdown */}
              {selectionMode === "filter" && (
                <div className="relative">
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-xl hover:bg-accent transition-colors"
                    onClick={() => { setCategoryOpen(!categoryOpen); setThemePopoverOpen(false); setSitesPopoverOpen(false); setEntriesPopoverOpen(false); }}
                  >
                    <Tag className="w-6 h-6 text-muted-foreground shrink-0" />
                    <span className="text-lg text-muted-foreground shrink-0 text-left w-24">Category</span>
                    <span className="flex-1 text-left font-medium text-foreground truncate text-xl">
                      {CATEGORIES.find((c) => c.value === category)?.label ?? "All Categories"}
                    </span>
                    <ChevronDown className={cn("w-6 h-6 text-muted-foreground shrink-0 transition-transform", categoryOpen && "rotate-180")} />
                  </button>
                  {categoryOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl border border-border bg-popover shadow-lg p-3">
                      <div className="space-y-1">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3.5 rounded-lg hover:bg-accent transition-colors text-left",
                              category === c.value && "bg-accent"
                            )}
                            onClick={() => { setCategory(c.value); setCategoryOpen(false); }}
                          >
                            {c.value !== "all" && (
                              <span className={cn("w-3.5 h-3.5 rounded-full shrink-0", CATEGORY_BADGE_COLORS[c.value]?.split(" ")[0] ?? "bg-muted")} />
                            )}
                            <span className="text-lg text-foreground">{c.label}</span>
                            {category === c.value && (
                              <CheckSquare className="w-5 h-5 text-primary shrink-0 ml-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Entries selector — individual mode, floating dropdown */}
              {selectionMode === "individual" && (
                <div className="relative">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-lg hover:bg-accent transition-colors"
                    onClick={() => { setEntriesPopoverOpen(!entriesPopoverOpen); setThemePopoverOpen(false); setSitesPopoverOpen(false); setCategoryOpen(false); }}
                  >
                    <ListChecks className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-base text-muted-foreground shrink-0 text-left w-20">Entries</span>
                    <span className="flex-1 text-left font-medium text-foreground truncate">{entriesSummary}</span>
                    <ChevronDown className={cn("w-5 h-5 text-muted-foreground shrink-0 transition-transform", entriesPopoverOpen && "rotate-180")} />
                  </button>
                  {entriesPopoverOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl border border-border bg-popover shadow-lg overflow-hidden">
                      {/* Search */}
                      <div className="px-3 py-2.5 border-b border-border space-y-2">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                          <Input
                            placeholder="Search entries…"
                            value={entrySearch}
                            onChange={(e) => setEntrySearch(e.target.value)}
                            className="pl-12 pr-12 text-lg h-14 rounded-xl"
                          />
                          {entrySearch && (
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => setEntrySearch("")}
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                        {!isLoading && filteredEntries.length > 0 && (
                          <div className="flex items-center justify-between px-0.5">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                              onClick={toggleAllFilteredEntries}
                            >
                              {allFilteredSelected
                                ? <CheckSquare className="w-4 h-4 text-primary" />
                                : <Square className="w-4 h-4" />}
                              {allFilteredSelected ? "Deselect all" : "Select all"}
                              {entrySearch ? ` (${filteredEntries.length} shown)` : ""}
                            </button>
                            <span className="text-sm text-muted-foreground">
                              {selectedEntryIds.size} / {exportLogs?.length ?? 0}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Entry list */}
                      <div
                        className="px-3 py-2.5 space-y-1"
                        style={{
                          maxHeight: "384px",
                          overflowY: "auto",
                          overscrollBehavior: "contain",
                          touchAction: "pan-y",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
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
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      <MapPin className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{log.siteName}</span>
                                      <span className="shrink-0">·</span>
                                      <span className="shrink-0">{format(new Date(log.loggedAt), "MMM d, yyyy")}</span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Live count — only shown standalone for individual mode (filter mode has it inline) */}
          {selectionMode === "individual" && (
            <div className={cn(
              "rounded-lg border px-4 py-3 flex items-center justify-between",
              isLoading ? "border-border bg-muted/30" : "border-primary/30 bg-primary/5"
            )}>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading entries…
                </div>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">Selected entries</span>
                  <span className={cn("text-lg font-bold", count === 0 ? "text-muted-foreground" : "text-primary")}>
                    {count}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-5 pt-4">
          <Button variant="secondary" onClick={onClose} className="h-16 text-xl px-8 rounded-2xl">Cancel</Button>
          <Button
            onClick={handleExport}
            disabled={
              isExporting ||
              isLoading ||
              count === 0 ||
              (!allSitesSelected && selectedSiteIds.size === 0)
            }
            className="gap-1.5 h-16 text-xl px-8 rounded-2xl"
          >
            {isExporting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
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
