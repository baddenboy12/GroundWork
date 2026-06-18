import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FocusEvent,
  type PointerEvent,
} from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { isNative } from "@/lib/platform.ts";
import { cn } from "@/lib/utils.ts";

type ExpandableTextareaProps = Omit<
  ComponentProps<"textarea">,
  "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  editorTitle: string;
  expandedOpen?: boolean;
  onExpandedOpenChange?: (open: boolean) => void;
  expandOnMobile?: boolean;
};

export default function ExpandableTextarea({
  value,
  onValueChange,
  editorTitle,
  expandedOpen,
  onExpandedOpenChange,
  expandOnMobile = true,
  className,
  disabled,
  id,
  onFocus,
  onPointerDown,
  placeholder,
  readOnly,
  style,
  ...textareaProps
}: ExpandableTextareaProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [useExpandedEditor, setUseExpandedEditor] = useState(false);
  const expandedRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);

  const open = expandedOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (onExpandedOpenChange) {
      onExpandedOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  };

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!expandOnMobile || typeof window === "undefined") {
      setUseExpandedEditor(false);
      return;
    }

    const mediaQueries = [
      window.matchMedia("(max-width: 768px)"),
      window.matchMedia("(pointer: coarse)"),
    ];
    const update = () => {
      setUseExpandedEditor(isNative || mediaQueries.some((mq) => mq.matches));
    };

    update();
    for (const mediaQuery of mediaQueries) {
      mediaQuery.addEventListener("change", update);
    }

    return () => {
      for (const mediaQuery of mediaQueries) {
        mediaQuery.removeEventListener("change", update);
      }
    };
  }, [expandOnMobile]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      const textarea = expandedRef.current;
      if (!textarea) return;

      textarea.focus();
      const end = valueRef.current.length;
      textarea.setSelectionRange(end, end);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [open]);

  const openEditor = () => {
    if (!useExpandedEditor || disabled) return false;
    setOpen(true);
    return true;
  };

  const handlePointerDown = (event: PointerEvent<HTMLTextAreaElement>) => {
    onPointerDown?.(event);
    if (event.defaultPrevented || !openEditor()) return;
    event.preventDefault();
  };

  const handleFocus = (event: FocusEvent<HTMLTextAreaElement>) => {
    onFocus?.(event);
    if (event.defaultPrevented || !openEditor()) return;
    event.currentTarget.blur();
  };

  return (
    <>
      <Textarea
        {...textareaProps}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={handleFocus}
        onPointerDown={handlePointerDown}
        readOnly={useExpandedEditor || readOnly}
        disabled={disabled}
        style={style}
        aria-haspopup={useExpandedEditor ? "dialog" : undefined}
        aria-expanded={useExpandedEditor ? open : undefined}
        className={cn(useExpandedEditor && "cursor-text", className)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[4rem] h-[min(68dvh,44rem)] max-h-[calc(100dvh-6rem)] translate-y-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="border-b border-border px-5 py-4 text-left">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-2xl">{editorTitle}</DialogTitle>
                <Button
                  type="button"
                  className="ml-auto h-12 rounded-2xl px-5 text-lg"
                  onClick={() => setOpen(false)}
                >
                  <Check className="!h-5 !w-5" />
                  Done
                </Button>
              </div>
            </DialogHeader>
            <Textarea
              id={id ? `${id}-expanded` : undefined}
              ref={expandedRef}
              placeholder={placeholder}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              disabled={disabled}
              style={style}
              className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-5 py-5 !text-[30px] leading-relaxed shadow-none focus-visible:ring-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
