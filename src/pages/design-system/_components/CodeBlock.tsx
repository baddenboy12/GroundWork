import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type Props = {
  code: string;
  language?: string;
  className?: string;
};

export default function CodeBlock({ code, language = "css", className }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative group rounded-lg overflow-hidden border border-[#2a3a5a]", className)}>
      <div className="flex items-center justify-between px-4 py-2 bg-[#0f1e38] border-b border-[#2a3a5a]">
        <span className="text-xs font-mono text-[#7a9cc8] uppercase tracking-widest">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#7a9cc8] hover:text-white transition-colors px-2 py-1 rounded"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-[#0a1628] text-sm">
        <code className="font-mono text-[#c8d8f0] leading-relaxed whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}
