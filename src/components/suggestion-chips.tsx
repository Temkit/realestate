"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

interface SuggestionChipsProps {
  chips: string[];
  onChipClick: (chip: string) => void;
  isLoading: boolean;
}

export function SuggestionChips({ chips, onChipClick, isLoading }: SuggestionChipsProps) {
  const t = useTranslations("suggestions");
  if (chips.length === 0 || isLoading) return null;

  return (
    <div className="mt-8 mb-2 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-primary/60" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("tryNext")}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 stagger-children">
        {chips.map((chip) => (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            className="text-sm px-4 py-2.5 rounded-full border border-primary/20 bg-primary/[0.03]
                       text-foreground hover:bg-primary/10 hover:border-primary/40
                       active:scale-95 transition-all duration-200 min-h-[44px]"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
