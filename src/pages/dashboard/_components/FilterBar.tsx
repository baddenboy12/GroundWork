import { useState, useRef, useEffect } from "react";
import { Search, X, SlidersHorizontal, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
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

export default function FilterBar({ filters, onChange, resultCount, isSearchMode }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeFilterCount =
    (filters.category !== "all" ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  const clearAll = () => {
    onChange(DEFAULT_FILTERS);
    setSearchOpen(false);
  };

  // Auto-focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Keep search open if there's a search term
  const hasSearch = filters.search.length > 0;

  return (
    <div className="flex items-center gap-2.5 justify-end">
      {/* Search — button or expanded input */}
      {searchOpen || hasSearch ? (
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            className="pl-10 pr-10 h-12 text-base rounded-xl"
            placeholder="Search logs..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            onBlur={() => {
              if (!filters.search) setSearchOpen(false);
            }}
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => {
              onChange({ ...filters, search: "" });
              setSearchOpen(false);
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="h-12 gap-2 text-sm shrink-0 rounded-xl px-5"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="w-4 h-4" />
          Search
        </Button>
      )}

      {/* Category filter */}
      <Select
        value={filters.category}
        onValueChange={(v) => onChange({ ...filters, category: v as LogCategory | "all" })}
      >
        <SelectTrigger className="w-auto min-w-28 h-12 text-sm rounded-xl shrink-0">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {LOG_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            className={cn(
              "h-12 gap-2 text-sm shrink-0 rounded-xl px-5",
              (filters.dateFrom || filters.dateTo) && "border-primary/50 text-primary"
            )}
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Date range</span>
            <span className="sm:hidden">Date</span>
            {(filters.dateFrom || filters.dateTo) && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                !
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4 space-y-3" align="end">
          <p className="text-xs font-semibold text-foreground">Filter by date</p>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={filters.dateFrom}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={filters.dateTo}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            />
          </div>
          {(filters.dateFrom || filters.dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-muted-foreground"
              onClick={() => onChange({ ...filters, dateFrom: "", dateTo: "" })}
            >
              Clear dates
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Active filters badge + clear */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground gap-1.5 shrink-0"
          onClick={clearAll}
        >
          <X className="w-3 h-3" />
          Clear
          <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">
            {activeFilterCount}
          </span>
        </Button>
      )}

      {/* Result count */}
      {isSearchMode && resultCount !== null && (
        <span className="text-xs text-muted-foreground shrink-0">
          <SlidersHorizontal className="w-3 h-3 inline mr-1" />
          {resultCount} result{resultCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
