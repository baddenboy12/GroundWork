import { cn } from "@/lib/utils.ts";
import { THEMES, DEFAULT_THEME_ID, type Theme } from "../_lib/export.ts";
import { CheckIcon } from "lucide-react";

type Props = {
  value: string;
  onChange: (theme: Theme) => void;
};

function rgb(r: number, g: number, b: number): string {
  return `rgb(${r},${g},${b})`;
}

export default function ThemePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {THEMES.map((theme) => {
        const isSelected = theme.id === value;
        const [cr, cg, cb] = theme.coverBg;
        const [ar, ag, ab] = theme.coverAccent;
        const [er, eg, eb] = theme.entryBg;

        return (
          <button
            key={theme.id}
            type="button"
            title={theme.name}
            onClick={() => onChange(theme)}
            className={cn(
              "relative flex flex-col rounded-lg overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "border-primary shadow-md scale-105"
                : "border-border hover:border-muted-foreground/50 hover:scale-[1.02]"
            )}
          >
            {/* Mini cover preview */}
            <div
              className="h-6 w-full flex-shrink-0 relative"
              style={{ background: rgb(cr, cg, cb) }}
            >
              {/* Accent bar at top */}
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: rgb(ar, ag, ab) }}
              />
              {/* Sidebar variant indicator */}
              {theme.cover === "sidebar" && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-[5px]"
                  style={{ background: rgb(ar, ag, ab), opacity: 0.8 }}
                />
              )}
              {/* Band variant: white top half */}
              {theme.cover === "band" && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[6px]"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                />
              )}
              {/* Title stand-in lines */}
              <div className="absolute bottom-[5px] left-[6px] right-[6px] flex flex-col gap-[2px]">
                <div
                  className="h-[2px] rounded-full w-full"
                  style={{ background: `rgba(255,255,255,0.55)` }}
                />
                <div
                  className="h-[1.5px] rounded-full w-3/4"
                  style={{ background: `rgba(255,255,255,0.3)` }}
                />
              </div>
            </div>

            {/* Mini entry preview */}
            <div
              className="flex-1 w-full px-[4px] py-[3px] flex flex-col gap-[2px]"
              style={{ background: rgb(er, eg, eb) }}
            >
              {/* Left bar accent */}
              <div className="flex gap-[2px]">
                <div
                  className="w-[2.5px] h-[10px] rounded-full flex-shrink-0"
                  style={{ background: rgb(ar, ag, ab) }}
                />
                <div className="flex flex-col gap-[2px] flex-1 min-w-0">
                  <div
                    className="h-[2px] rounded-full"
                    style={{ background: `rgba(0,0,0,0.25)`, width: "80%" }}
                  />
                  <div
                    className="h-[1.5px] rounded-full"
                    style={{ background: `rgba(0,0,0,0.15)`, width: "60%" }}
                  />
                </div>
              </div>
            </div>

            {/* Theme name */}
            <div
              className="text-center text-[9px] font-medium py-[3px] w-full truncate px-1"
              style={{
                background: isSelected ? `rgb(${cr},${cg},${cb})` : "transparent",
                color: isSelected ? `rgb(${ar},${ag},${ab})` : "currentColor",
              }}
            >
              {theme.name}
            </div>

            {/* Selected checkmark */}
            {isSelected && (
              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <CheckIcon className="w-2.5 h-2.5 text-primary-foreground" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { DEFAULT_THEME_ID };
