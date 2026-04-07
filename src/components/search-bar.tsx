"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SearchMode } from "@/hooks/use-property-search";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  hasResults?: boolean;
  searchMode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

const suggestionKeys = ["1", "2", "3", "4", "5"] as const;

const RECENT_SEARCHES_KEY = "olu-recent-searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const recent = getRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT))
    );
  } catch {
    // ignore
  }
}

export function SearchBar({ onSearch, isLoading, hasResults, searchMode, onModeChange }: SearchBarProps) {
  const t = useTranslations("search");
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query.trim());
      setRecentSearches(getRecentSearches());
      setShowRecent(false);
      onSearch(query.trim());
    }
  };

  const handleSuggestionClick = (s: string) => {
    setQuery(s);
    saveRecentSearch(s);
    setRecentSearches(getRecentSearches());
    setShowRecent(false);
    onSearch(s);
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    setRecentSearches([]);
  };

  const compact = !!hasResults;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Rent/Buy Toggle — hidden on mobile when compact */}
      <div className={`flex justify-center ${compact ? "hidden sm:flex mb-3" : "mb-5"}`}>
        <div className="inline-flex rounded-xl bg-muted p-1 gap-0.5">
          <button
            type="button"
            onClick={() => onModeChange("buy")}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              searchMode === "buy"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("buy")}
          </button>
          <button
            type="button"
            onClick={() => onModeChange("rent")}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              searchMode === "rent"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("rent")}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} role="search" aria-label="Search properties">
        <div className="relative flex items-center gap-2">
          {/* Mobile Buy/Rent mini-toggle when compact */}
          {compact && (
            <div className="flex sm:hidden shrink-0">
              <div className="inline-flex rounded-lg bg-muted p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => onModeChange("buy")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    searchMode === "buy"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {t("buy")}
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange("rent")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    searchMode === "rent"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {t("rent")}
                </button>
              </div>
            </div>
          )}

          <div className="relative flex-1">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 ${compact ? "h-4 w-4" : "h-5 w-5 sm:left-5"}`} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowRecent(true)}
              onBlur={() => setTimeout(() => setShowRecent(false), 200)}
              placeholder={searchMode === "rent" ? t("placeholderRent") : t("placeholderBuy")}
              className={`w-full bg-card border-2 border-border rounded-2xl
                         outline-none transition-all duration-200 shadow-sm
                         focus:border-primary focus:ring-4 focus:ring-primary/10 focus:shadow-md
                         placeholder:text-muted-foreground/40
                         disabled:opacity-50
                         ${compact
                           ? "h-11 pl-10 pr-20 text-sm rounded-xl"
                           : "h-12 sm:h-14 pl-11 sm:pl-13 pr-28 sm:pr-32 text-[0.9375rem]"
                         }`}
              disabled={isLoading}
              aria-label="Search for properties"
            />
            <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 ${compact ? "right-1.5" : ""}`}>
              {!hasResults && !isLoading && (
                <kbd
                  className="hidden sm:inline-flex h-7 items-center gap-0.5 rounded-lg border bg-muted px-2.5
                                text-[11px] font-medium text-muted-foreground"
                >
                  <span className="text-xs">&#8984;</span>K
                </kbd>
              )}
              <Button
                type="submit"
                disabled={isLoading || !query.trim()}
                className={compact ? "h-8 px-3 rounded-lg text-xs" : "h-9 sm:h-10 px-4 sm:px-5 rounded-xl font-medium text-sm"}
                size={compact ? "sm" : "default"}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("search")
                )}
              </Button>
            </div>

            {/* Recent searches dropdown */}
            {showRecent && recentSearches.length > 0 && !isLoading && (
              <div
                className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-2xl shadow-xl
                              overflow-hidden z-50 animate-fade-in-up"
                style={{ animationDuration: "0.2s" }}
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("recentSearches")}
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={clearRecent}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("clear")}
                  </button>
                </div>
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionClick(s)}
                    className="w-full text-left px-4 py-3 text-sm flex items-center gap-3
                               hover:bg-muted transition-colors"
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>

      {!isLoading && !hasResults && (
        <div className="mt-4 sm:mt-5 flex flex-wrap gap-2 sm:gap-2.5 justify-center stagger-children">
          {suggestionKeys.map((key) => (
            <button
              key={key}
              onClick={() => handleSuggestionClick(t(`suggestions.${key}`))}
              className="text-xs sm:text-[0.8125rem] px-3 sm:px-4 py-2 rounded-full border bg-card
                         text-muted-foreground hover:bg-secondary hover:border-primary/30
                         hover:text-foreground transition-all duration-200 shadow-sm"
            >
              {t(`suggestions.${key}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
