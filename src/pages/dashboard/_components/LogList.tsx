import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Plus, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import LogCard from "./LogCard.tsx";
import CreateLogDialog from "./CreateLogDialog.tsx";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { LOG_CATEGORIES, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  siteId: Id<"sites">;
};

export default function LogList({ siteId }: Props) {
  const sites = useQuery(api.sites.list, {});
  const site = sites?.find((s) => s._id === siteId);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<LogCategory | "all">("all");

  const { results, status, loadMore } = usePaginatedQuery(
    api.logs.listBySite,
    { siteId },
    { initialNumItems: 20 }
  );

  const filtered = filterCategory === "all"
    ? results
    : results.filter((l) => l.category === filterCategory);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4 bg-background shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-lg">{site?.name ?? "Loading..."}</h2>
          </div>
          {site?.location && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">{site.location}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Category filter */}
          <Select
            value={filterCategory}
            onValueChange={(v) => setFilterCategory(v as LogCategory | "all")}
          >
            <SelectTrigger className="w-40 h-8 text-xs">
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
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> New log
          </Button>
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-6">
        {status === "LoadingFirstPage" ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>
                {filterCategory === "all" ? "No log entries yet" : `No ${CATEGORY_LABELS[filterCategory]} logs`}
              </EmptyTitle>
              <EmptyDescription>
                {filterCategory === "all"
                  ? "Start documenting activity at this site"
                  : "Try a different category filter"}
              </EmptyDescription>
            </EmptyHeader>
            {filterCategory === "all" && (
              <EmptyContent>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> New log entry
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <>
            <div className="space-y-4">
              {(filtered as LogWithAuthor[]).map((log) => (
                <LogCard key={log._id} log={log} />
              ))}
            </div>
            {status === "CanLoadMore" && (
              <div className="flex justify-center mt-6">
                <Button variant="secondary" size="sm" onClick={() => loadMore(20)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <CreateLogDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        siteId={siteId}
      />
    </div>
  );
}
