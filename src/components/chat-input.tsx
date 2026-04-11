"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ArrowUp, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  isClassifying: boolean;
  mode: "buy" | "rent";
  onModeChange: (mode: "buy" | "rent") => void;
  placeholder?: string;
  hasResults: boolean;
}

export function ChatInput({
  onSubmit,
  isLoading,
  isClassifying,
  mode,
  onModeChange,
  placeholder,
  hasResults,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = isLoading || isClassifying;

  // Auto-focus on mount and when loading finishes
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [value]);

  // Cmd+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
    setValue("");
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const defaultPlaceholder = hasResults
    ? "Refine: plus grand, max 2000€, cherche à Luxembourg..."
    : "Rechercher: appartement kirchberg, bureau mondorf...";

  return (
    <div className="bg-background/80 backdrop-blur-xl border-t">
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 py-3">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => onModeChange("buy")}
            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              mode === "buy"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Acheter
          </button>
          <button
            onClick={() => onModeChange("rent")}
            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              mode === "rent"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Louer
          </button>
        </div>

        {/* Input row */}
        <div className="relative flex items-end gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={placeholder || defaultPlaceholder}
              rows={1}
              className="w-full resize-none rounded-xl border bg-muted/50 pl-10 pr-4 py-2.5 text-sm
                         placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20
                         focus:border-primary/30 transition-all min-h-[42px] max-h-[120px]"
              disabled={busy}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || busy}
            className="shrink-0 h-[42px] w-[42px] rounded-xl bg-primary text-primary-foreground
                       flex items-center justify-center transition-all
                       hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed
                       active:scale-95"
            aria-label="Send"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/40 text-center mt-1.5">
          olu.lu searches athome, immotop, wortimmo, vivi
        </p>
      </div>
    </div>
  );
}
