"use client";

import { Sparkles } from "lucide-react";

interface SuggestionChipsProps {
  chips: string[];
  onChipClick: (chip: string) => void;
  isLoading: boolean;
}

export function SuggestionChips({ chips, onChipClick, isLoading }: SuggestionChipsProps) {
  if (chips.length === 0 || isLoading) return null;

  return (
    <div className="mt-8 mb-2 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-primary/60" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Try next
        </span>
      </div>
      <div className="flex flex-wrap gap-2 stagger-children">
        {chips.map((chip) => (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            className="text-[0.8125rem] px-4 py-2 rounded-full border border-primary/20 bg-primary/[0.03]
                       text-foreground hover:bg-primary/10 hover:border-primary/40
                       transition-all duration-200"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
