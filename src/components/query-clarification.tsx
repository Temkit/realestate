"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { QueryAnalysis } from "@/lib/search/query-analyzer";

interface QueryClarificationProps {
  analysis: QueryAnalysis;
  onSelect: (completedQuery: string) => void;
  onCancel: () => void;
}

export function QueryClarification({
  analysis,
  onSelect,
  onCancel,
}: QueryClarificationProps) {
  const [customValue, setCustomValue] = useState("");

  const handleOption = (option: string) => {
    const { parsed, missing } = analysis;
    let query = "";

    if (missing === "type") {
      query = `${option.toLowerCase()} ${parsed.location || ""} ${parsed.mode === "rent" ? "louer" : parsed.mode === "buy" ? "acheter" : ""}`.trim();
    } else if (missing === "location") {
      query = `${parsed.type || ""} ${option} ${parsed.mode === "rent" ? "louer" : parsed.mode === "buy" ? "acheter" : ""}`.trim();
    } else if (missing === "mode") {
      const modeWord = option.toLowerCase() === "louer" ? "louer" : "acheter";
      query = `${parsed.type || ""} ${parsed.location || ""} ${modeWord}`.trim();
    }

    onSelect(query);
  };

  const handleCustom = () => {
    if (customValue.trim()) {
      onSelect(customValue.trim());
    }
  };

  const questionText =
    analysis.missing === "type"
      ? "What are you looking for?"
      : analysis.missing === "location"
        ? "Where in Luxembourg?"
        : "Buy or rent?";

  return (
    <div className="animate-fade-in-up">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl border bg-card shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-4 sm:px-5 pt-4 pb-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {analysis.summary}
            </p>
            <p className="text-sm font-semibold mt-1">{questionText}</p>
          </div>

          {/* Options */}
          <div className="px-4 sm:px-5 pb-3 flex flex-wrap gap-2">
            {analysis.options.map((option) => (
              <button
                key={option}
                onClick={() => handleOption(option)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium
                         bg-primary/5 border border-primary/20 text-primary
                         hover:bg-primary hover:text-primary-foreground
                         active:scale-[0.97] transition-all duration-150"
              >
                {option}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="px-4 sm:px-5 pb-4 flex gap-2">
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustom()}
              placeholder="Or type your own..."
              className="flex-1 text-sm px-3 py-2 rounded-lg border bg-muted/50
                         placeholder:text-muted-foreground/50 focus:outline-none
                         focus:ring-1 focus:ring-primary/30"
            />
            {customValue.trim() && (
              <button
                onClick={handleCustom}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm
                           hover:bg-primary/90 active:scale-95 transition-all"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Cancel */}
          <div className="px-4 sm:px-5 pb-3">
            <button
              onClick={onCancel}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
