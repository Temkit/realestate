"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  hasResults?: boolean;
}

const suggestions = [
  "Appartement 3 chambres à Kirchberg",
  "Maison familiale à Bertrange sous €1M",
  "Bureau à louer Luxembourg-ville centre",
  "Appartement moderne à Belval sous €500K",
  "Maison avec jardin à Hesperange",
];

const RECENT_SEARCHES_KEY = "realestate-recent-searches";
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

export function SearchBar({ onSearch, isLoading, hasResults }: SearchBarProps) {
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

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} role="search" aria-label="Search properties">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowRecent(true)}
            onBlur={() => setTimeout(() => setShowRecent(false), 200)}
            placeholder="Describe your ideal home..."
            className="w-full h-14 sm:h-[3.75rem] pl-13 pr-32 text-[0.9375rem] bg-card border-2 border-border rounded-2xl
                       outline-none transition-all duration-200 shadow-sm
                       focus:border-primary focus:ring-4 focus:ring-primary/10 focus:shadow-md
                       placeholder:text-muted-foreground/40
                       disabled:opacity-50"
            disabled={isLoading}
            aria-label="Search for properties"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
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
              className="h-10 px-5 rounded-xl font-medium text-sm"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching
                </span>
              ) : (
                "Search"
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
                  Recent searches
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearRecent}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
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
      </form>

      {!isLoading && !hasResults && (
        <div className="mt-5 flex flex-wrap gap-2.5 justify-center stagger-children">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestionClick(s)}
              className="text-[0.8125rem] px-4 py-2 rounded-full border bg-card
                         text-muted-foreground hover:bg-secondary hover:border-primary/30
                         hover:text-foreground transition-all duration-200 shadow-sm"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
