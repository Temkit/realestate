"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowRight, Home, Building2, Briefcase, Hotel, MapPin, Key, ShoppingBag } from "lucide-react";
import type { QueryAnalysis } from "@/lib/search/query-analyzer";

interface QueryClarificationProps {
  analysis: QueryAnalysis;
  onSelect: (completedQuery: string) => void;
  onCancel: () => void;
}

const TYPE_ICONS: Record<string, typeof Home> = {
  Appartement: Building2,
  Maison: Home,
  Bureau: Briefcase,
  Studio: Hotel,
};

const LOCATION_ICONS: Record<string, typeof MapPin> = {
  Luxembourg: MapPin,
  Kirchberg: MapPin,
  "Esch-sur-Alzette": MapPin,
  "Mondorf-les-Bains": MapPin,
};

const MODE_META: Record<string, { icon: typeof Key; desc: string }> = {
  Louer: { icon: Key, desc: "Location, bail mensuel" },
  Acheter: { icon: ShoppingBag, desc: "Acquisition, investissement" },
};

export function QueryClarification({
  analysis,
  onSelect,
  onCancel,
}: QueryClarificationProps) {
  const [customValue, setCustomValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Don't auto-focus the custom input — let user click an option first
  }, []);

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
    if (customValue.trim()) onSelect(customValue.trim());
  };

  const questionText =
    analysis.missing === "type"
      ? "What type of property?"
      : analysis.missing === "location"
        ? "Where in Luxembourg?"
        : "Looking to buy or rent?";

  const getDescription = (option: string): string => {
    if (analysis.missing === "type") {
      const descs: Record<string, string> = {
        Appartement: "Flat, condo, penthouse",
        Maison: "House, villa, townhouse",
        Bureau: "Office, co-working, cabinet",
        Studio: "Studio, chambre, petit espace",
      };
      return descs[option] || "";
    }
    if (analysis.missing === "location") {
      const descs: Record<string, string> = {
        Luxembourg: "Centre-ville, Kirchberg, Bonnevoie...",
        Kirchberg: "Quartier européen, business district",
        "Esch-sur-Alzette": "Deuxième ville, Belval",
        "Mondorf-les-Bains": "Sud, station thermale",
      };
      return descs[option] || "";
    }
    return MODE_META[option]?.desc || "";
  };

  const getIcon = (option: string) => {
    if (analysis.missing === "type") return TYPE_ICONS[option] || Home;
    if (analysis.missing === "location") return LOCATION_ICONS[option] || MapPin;
    return MODE_META[option]?.icon || Key;
  };

  return (
    <div className="animate-fade-in-up">
      <div className="max-w-xl mx-auto space-y-3">
        {/* Context */}
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
            {analysis.summary}
          </p>
          <p className="text-lg font-semibold tracking-tight">{questionText}</p>
        </div>

        {/* Full-width option buttons */}
        <div className="space-y-2">
          {analysis.options.map((option, i) => {
            const Icon = getIcon(option);
            const desc = getDescription(option);
            return (
              <button
                key={option}
                onClick={() => handleOption(option)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card
                           hover:border-primary/40 hover:bg-primary/[0.03]
                           active:scale-[0.99] transition-all duration-150 text-left group"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0
                                group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{option}</p>
                  {desc && (
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary
                                       group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Custom input — subtle, at the bottom */}
        <div className="flex gap-2 pt-1">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustom()}
              placeholder="Or type something else..."
              className="w-full text-sm px-4 py-3 rounded-xl border bg-muted/30
                         placeholder:text-muted-foreground/40 focus:outline-none
                         focus:ring-2 focus:ring-primary/20 focus:border-primary/30
                         transition-all"
            />
          </div>
          {customValue.trim() && (
            <button
              onClick={handleCustom}
              className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium
                         hover:bg-primary/90 active:scale-95 transition-all"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground
                     transition-colors py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
