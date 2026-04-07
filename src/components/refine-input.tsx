"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RefineInputProps {
  onRefine: (query: string) => void;
  onReset: () => void;
  isLoading: boolean;
}

export function RefineInput({ onRefine, onReset, isLoading }: RefineInputProps) {
  const t = useTranslations("refine");
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onRefine(query.trim());
      setQuery("");
    }
  };

  return (
    <div className="mt-6 animate-fade-in-up">
      <form onSubmit={handleSubmit} className="relative">
        <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-16 sm:pr-24 text-sm bg-card border border-primary/20 rounded-xl sm:rounded-2xl
                     outline-none transition-all duration-200
                     focus:border-primary focus:ring-4 focus:ring-primary/10
                     placeholder:text-muted-foreground/40
                     disabled:opacity-50"
          disabled={isLoading}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <Button
            type="submit"
            disabled={isLoading || !query.trim()}
            size="sm"
            className="h-8 px-3 rounded-lg"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
      <div className="flex items-center justify-center mt-2">
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors
                     flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted"
        >
          <RotateCcw className="h-3 w-3" />
          {t("newSearch")}
        </button>
      </div>
    </div>
  );
}
