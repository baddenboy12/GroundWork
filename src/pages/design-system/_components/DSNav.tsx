import { cn } from "@/lib/utils.ts";

type NavItem = {
  id: string;
  label: string;
  icon: string;
  children?: { id: string; label: string }[];
};

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: "◈" },
  {
    id: "tokens",
    label: "Design Tokens",
    icon: "◉",
    children: [
      { id: "colors", label: "Color Palette" },
      { id: "typography-tokens", label: "Type Scale" },
      { id: "spacing", label: "Spacing" },
      { id: "token-export", label: "Token Export" },
    ],
  },
  {
    id: "components",
    label: "Components",
    icon: "◧",
    children: [
      { id: "typography", label: "Typography" },
      { id: "buttons", label: "Buttons" },
      { id: "forms", label: "Forms" },
      { id: "tables", label: "Tables" },
      { id: "badges", label: "Badges & Tags" },
      { id: "cards", label: "Cards" },
      { id: "pagination", label: "Pagination" },
    ],
  },
  {
    id: "charts",
    label: "Charts & Data Viz",
    icon: "◎",
    children: [
      { id: "line-chart", label: "Line Chart" },
      { id: "bar-chart", label: "Bar Chart" },
      { id: "pie-chart", label: "Pie & Donut" },
    ],
  },
  {
    id: "layout",
    label: "Layout Templates",
    icon: "▤",
    children: [
      { id: "cover-page", label: "Cover Page" },
      { id: "toc", label: "Table of Contents" },
      { id: "content-page", label: "Content Page" },
      { id: "data-page", label: "Data Dashboard" },
    ],
  },
  { id: "accessibility", label: "Accessibility", icon: "◐" },
  { id: "file-structure", label: "File Structure", icon: "▦" },
  { id: "deliverables", label: "Deliverables & Timeline", icon: "◈" },
];

type Props = {
  active: string;
  onSelect: (id: string) => void;
};

export default function DSNav({ active, onSelect }: Props) {
  return (
    <nav className="w-64 shrink-0 sticky top-0 h-screen overflow-y-auto bg-[#0d1b33] border-r border-[#1e3055] flex flex-col">
      {/* Logo area */}
      <div className="p-5 border-b border-[#1e3055]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#c8962a] flex items-center justify-center text-[#0d1b33] font-bold text-sm">B</div>
          <div>
            <div className="text-white font-semibold text-sm leading-none">Building 20</div>
            <div className="text-[#7a9cc8] text-xs mt-0.5">Design System v1.0</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => onSelect(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 text-left",
                active === item.id
                  ? "bg-[#c8962a]/20 text-[#e8b84a] font-medium"
                  : "text-[#7a9cc8] hover:text-white hover:bg-[#1e3055]/60"
              )}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
            {item.children && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                {item.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onSelect(child.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all duration-150 text-left border-l-2",
                      active === child.id
                        ? "border-[#c8962a] text-[#e8b84a] bg-[#c8962a]/10"
                        : "border-transparent text-[#5a7ca8] hover:text-[#a8c4e0] hover:border-[#2a4a6a]"
                    )}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#1e3055]">
        <div className="text-xs text-[#3a5a7a]">
          <div>WCAG 2.1 AA Compliant</div>
          <div className="mt-0.5">Last updated: 2026</div>
        </div>
      </div>
    </nav>
  );
}
