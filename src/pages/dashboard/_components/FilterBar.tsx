import { useState, useRef, useEffect } from "react";
import { Search, X, SlidersHorizontal, CalendarDays, Tag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { LOG_CATEGORIES, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import { cn } from "@/lib/utils.ts";

export type FilterState = {
  search: string;
  category: LogCategory | "all";
  dateFrom: string;
  dateTo: string;
};

type Props = {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  resultCount: number | null;
  isSearchMode: boolean;
};

const DEFAULT_FILTERS: FilterState = {
  search: "",
  category: "all",
  dateFrom: "",
  dateTo: "",
};

export default function FilterBar({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeFilterCount =
    (filters.search.trim().length > 0 ? 1 : 0) +
    (filters.category !== "all" ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  const clearAll = () => {
    onChange(DEFAULT_FILTERS);
  };

  // Auto-focus search when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 150);
    }
  }, [open]);

  // Close on click outside (anything not the dropdown or the trigger button)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const inDropdown = dropdownRef.current?.contains(target);
      const inButton = buttonRef.current?.contains(target);
      if (!inDropdown && !inButton) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <div className="relative">
      {/* Filter trigger button */}
      <Button
        ref={buttonRef}
        variant="secondary"
        className={cn(
          "h-14 gap-2.5 text-base rounded-2xl px-6 active:scale-95 transition-transform",
          open && "bg-muted border-border shadow-inner",
          activeFilterCount > 0 && "border-primary/50 text-primary"
        )}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal className="w-5 h-5" />
        Filters
        {activeFilterCount > 0 && (
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
            {activeFilterCount}
          </span>
        )}
      </Button>

      {/* Filter panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={dropdownRef}
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(360px,90vw)] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <div className="p-5 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Filters</h3>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 transition-all"
                  onClick={() => setOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Search
                </Label>
                <Input
                  ref={searchRef}
                  className="h-14 text-lg rounded-xl px-4"
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => onChange({ ...filters, search: e.target.value })}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Category
                </Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={cn(
                      "px-4 py-3 rounded-xl text-base font-medium border transition-all active:scale-95",
                      filters.category === "all"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                    onClick={() => onChange({ ...filters, category: "all" })}
                  >
                    All
                  </button>
                  {LOG_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        "px-4 py-3 rounded-xl text-base font-medium border transition-all active:scale-95",
                        filters.category === c
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      )}
                      onClick={() => onChange({ ...filters, category: c })}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Date range
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">From</span>
                    <Input
                      type="date"
                      className="h-14 text-base rounded-xl"
                      value={filters.dateFrom}
                      onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">To</span>
                    <Input
                      type="date"
                      className="h-14 text-base rounded-xl"
                      value={filters.dateTo}
                      onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    className="flex-1 h-14 text-base rounded-xl text-muted-foreground active:scale-95 transition-transform"
                    onClick={clearAll}
                  >
                    Clear all
                  </Button>
                )}
                <Button
                  className="flex-1 h-14 text-base rounded-xl active:scale-95 transition-transform"
                  onClick={() => setOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
