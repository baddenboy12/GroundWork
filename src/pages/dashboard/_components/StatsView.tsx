import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  BarChart2,
  ClipboardList,
  Camera,
  MapPin,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { api } from "@/convex/_generated/api.js";
import { CATEGORY_LABELS } from "../_lib/constants.ts";

/** Chart fill colours per category — work in both light and dark modes */
const CATEGORY_CHART_COLORS: Record<string, string> = {
  inspection: "#3b82f6",
  maintenance: "#f59e0b",
  incident: "#ef4444",
  audit: "#a855f7",
  general: "#6b7280",
};

type Props = { onBack: () => void };

export default function StatsView({ onBack }: Props) {
  const stats = useQuery(api.logs.getStats, {});

  if (stats === undefined) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-9 w-20" />
          <div className="space-y-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-52 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const categoryData = Object.entries(stats.categoryBreakdown)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      category,
      label: CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category,
      count,
      fill: CATEGORY_CHART_COLORS[category] ?? "#6b7280",
    }));

  const activityData = stats.dailyActivity.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "MMM d"),
  }));

  const statCards = [
    {
      label: "Total Entries",
      value: stats.totalEntries,
      icon: ClipboardList,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "This Week",
      value: stats.thisWeek,
      icon: TrendingUp,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "This Month",
      value: stats.thisMonth,
      icon: Calendar,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Photos",
      value: stats.totalPhotos,
      icon: Camera,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Active Sites",
      value: stats.totalSites,
      icon: MapPin,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  const tooltipStyle = {
    contentStyle: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "8px",
      fontSize: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
    labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
    itemStyle: { color: "hsl(var(--muted-foreground))" },
    cursor: { fill: "hsl(var(--muted))", opacity: 0.5 },
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-1 shrink-0">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            Statistics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your field logging activity overview
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.22, ease: "easeOut" }}
            >
              <Card className="h-full">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">
                      {card.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* 30-Day Activity Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.22, ease: "easeOut" }}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">30-Day Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.totalEntries === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <BarChart2 className="w-8 h-8 opacity-20" />
                Start logging entries to see your activity chart
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={activityData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar
                    dataKey="count"
                    name="Entries"
                    fill="hsl(var(--primary))"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Category breakdown + Top Sites */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Category Donut Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.22, ease: "easeOut" }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">By Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                  No entries yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="42%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {categoryData.map((entry) => (
                        <Cell key={entry.category} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle.contentStyle}
                      labelStyle={tooltipStyle.labelStyle}
                      itemStyle={tooltipStyle.itemStyle}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      formatter={(value) => (
                        <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Sites */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.52, duration: 0.22, ease: "easeOut" }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Top Sites</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topSites.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                  No sites yet
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {stats.topSites.map((site, i) => {
                    const pct =
                      stats.totalEntries > 0
                        ? (site.count / stats.topSites[0].count) * 100
                        : 0;
                    return (
                      <div key={`${site.siteName}-${i}`} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-medium text-muted-foreground shrink-0 w-5">
                              #{i + 1}
                            </span>
                            <span className="font-medium text-foreground truncate">
                              {site.siteName}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {site.count} {site.count === 1 ? "entry" : "entries"}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              delay: 0.6 + i * 0.06,
                              duration: 0.45,
                              ease: "easeOut",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
