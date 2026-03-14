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
  const activeFilterCount =
    (filters.category !== "all" ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  const clearAll = () => onChange(DEFAULT_FILTERS);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search input */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8 pr-8 h-8 text-sm"
          placeholder="Search logs by title..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
        {filters.search && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onChange({ ...filters, search: "" })}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Category filter */}
      <Select
        value={filters.category}
        onValueChange={(v) => onChange({ ...filters, category: v as LogCategory | "all" })}
      >
        <SelectTrigger className="w-38 h-8 text-xs">
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
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs",
              (filters.dateFrom || filters.dateTo) && "border-primary/50 text-primary"
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Date range
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
          className="h-8 text-xs text-muted-foreground gap-1.5"
          onClick={clearAll}
        >
          <X className="w-3 h-3" />
          Clear filters
          <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">
            {activeFilterCount}
          </span>
        </Button>
      )}

      {/* Result count */}
      {isSearchMode && resultCount !== null && (
        <span className="text-xs text-muted-foreground ml-auto">
          <SlidersHorizontal className="w-3 h-3 inline mr-1" />
          {resultCount} result{resultCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
