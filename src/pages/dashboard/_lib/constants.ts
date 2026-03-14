// Shared types and constants for the dashboard
export const LOG_CATEGORIES = [
  "inspection",
  "maintenance",
  "incident",
  "audit",
  "general",
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<LogCategory, string> = {
  inspection: "Inspection",
  maintenance: "Maintenance",
  incident: "Incident",
  audit: "Audit",
  general: "General",
};

export const CATEGORY_COLORS: Record<LogCategory, string> = {
  inspection: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  maintenance: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  incident: "bg-red-500/15 text-red-400 border-red-500/30",
  audit: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  general: "bg-muted text-muted-foreground border-border",
};
