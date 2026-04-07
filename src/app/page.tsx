"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { PropertyCard } from "@/components/property-card";
import { PropertyDetail } from "@/components/property-detail";
import { CompareView } from "@/components/compare-view";
import { FavoritesBar } from "@/components/favorites-bar";
import { FavoritesSheet } from "@/components/favorites-sheet";
import { FilterBar } from "@/components/filter-bar";
import { BackToTop } from "@/components/back-to-top";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastContainer } from "@/components/ui/toast";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertySearch } from "@/hooks/use-property-search";
import { useToast } from "@/hooks/use-toast";
import { Heart, SearchX } from "lucide-react";
import type { Property } from "@/lib/types";

function ResultSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden bg-card border"
          style={{ animationDelay: `${i * 75}ms` }}
        >
          <Skeleton className="aspect-[16/10] w-full" />
          <div className="p-5 space-y-3">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-4 pt-1">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const {
    results,
    expandedResults,
    isLoading,
    isExpandedLoading,
    error,
    selectedProperty,
    showCompare,
    showFavorites,
    filteredExpanded,
    favorites,
    isFavorite,
    clearFavorites,
    removeFavorite,
    handleSearch,
    handlePropertyClick,
    toggleFavorite,
    setSelectedProperty,
    setShowCompare,
    setShowFavorites,
  } = usePropertySearch();

  const { toasts, toast, dismiss } = useToast();

  const [filteredPrimary, setFilteredPrimary] = useState<Property[] | null>(
    null
  );
  const [filteredExpandedLocal, setFilteredExpandedLocal] = useState<
    Property[] | null
  >(null);

  const displayPrimary = filteredPrimary ?? results?.properties ?? [];
  const displayExpanded = filteredExpandedLocal ?? filteredExpanded;

  const handleToggleFavorite = (property: Property) => {
    const action = toggleFavorite(property);
    if (action === "added") {
      toast("Added to favorites", "success");
    } else {
      toast("Removed from favorites", "default");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <header className="border-b sticky top-0 z-40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground"
              >
                <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
                <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </div>
            <span className="text-[1.125rem] font-semibold tracking-tight">
              HomeFind
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {favorites.length > 0 && (
              <button
                onClick={() => setShowFavorites(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground
                           transition-colors px-3 py-2 rounded-xl hover:bg-muted"
                aria-label={`View ${favorites.length} saved properties`}
              >
                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                <span className="font-medium tabular-nums">
                  {favorites.length}
                </span>
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero / Search */}
      <section
        id="main-content"
        className={`transition-all duration-500 ${results ? "py-6" : "py-20 sm:py-32 hero-mesh"}`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          {!results && !isLoading && (
            <div className="text-center mb-12 animate-fade-in-up">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance leading-[1.1]">
                Find your perfect
                <br />
                <span className="text-primary">place to call home</span>
              </h1>
              <p className="mt-5 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed text-balance">
                Describe what you&apos;re looking for in plain language.
                We&apos;ll search real listings across the web.
              </p>
            </div>
          )}
          <SearchBar
            onSearch={handleSearch}
            isLoading={isLoading}
            hasResults={!!results}
          />
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-8">
          <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-5">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-32">
          <div className="mb-6">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-80 mt-2.5" />
          </div>
          <ResultSkeleton />
        </div>
      )}

      {/* Primary Results */}
      {results && !isLoading && (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-8" aria-live="polite">
          <div className="mb-6">
            <h2 className="text-lg font-semibold tracking-tight">
              {displayPrimary.length}{" "}
              {displayPrimary.length === 1 ? "home" : "homes"} found
            </h2>
            {results.summary && (
              <p className="text-[0.9375rem] text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">
                {results.summary}
              </p>
            )}
            {results.citations.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Sources
                </span>
                {results.citations.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary/70 hover:text-primary hover:underline transition-colors"
                  >
                    [{i + 1}]
                  </a>
                ))}
              </div>
            )}
          </div>

          <FilterBar
            properties={results.properties}
            onFilteredChange={(filtered) => setFilteredPrimary(filtered)}
          />

          {displayPrimary.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayPrimary.map((property, index) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  isFavorite={isFavorite(property.id)}
                  onToggleFavorite={() => handleToggleFavorite(property)}
                  onSelect={() => handlePropertyClick(property)}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={SearchX}
              title="No matching properties"
              description="Try adjusting your filters or search for something different."
            />
          )}
        </div>
      )}

      {/* Expanded Results */}
      {results &&
        !isLoading &&
        (isExpandedLoading || displayExpanded.length > 0) && (
          <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-32">
            <div className="relative mt-4">
              <div className="bg-muted/40 border rounded-3xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="text-lg font-semibold tracking-tight">
                    You might also like
                  </h2>
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    Similar listings
                  </span>
                </div>
                {expandedResults?.summary && !isExpandedLoading && (
                  <p className="text-[0.9375rem] text-muted-foreground mb-6 leading-relaxed max-w-2xl">
                    {expandedResults.summary}
                  </p>
                )}

                {isExpandedLoading ? (
                  <ResultSkeleton count={3} />
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {displayExpanded.map((property, index) => (
                        <PropertyCard
                          key={property.id}
                          property={property}
                          isFavorite={isFavorite(property.id)}
                          onToggleFavorite={() =>
                            handleToggleFavorite(property)
                          }
                          onSelect={() => handlePropertyClick(property)}
                          index={index}
                        />
                      ))}
                    </div>
                    {expandedResults &&
                      expandedResults.citations.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-5">
                          <span className="text-xs font-medium text-muted-foreground">
                            Sources
                          </span>
                          {expandedResults.citations.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary/70 hover:text-primary hover:underline transition-colors"
                            >
                              [{i + 1}]
                            </a>
                          ))}
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Bottom spacer */}
      {results &&
        !isLoading &&
        !isExpandedLoading &&
        displayExpanded.length === 0 && <div className="pb-32" />}

      {/* Property Detail */}
      <PropertyDetail
        property={selectedProperty}
        isOpen={!!selectedProperty}
        onClose={() => setSelectedProperty(null)}
        isFavorite={
          selectedProperty ? isFavorite(selectedProperty.id) : false
        }
        onToggleFavorite={() => {
          if (selectedProperty) handleToggleFavorite(selectedProperty);
        }}
      />

      {/* Favorites Sheet */}
      <FavoritesSheet
        favorites={favorites}
        isOpen={showFavorites}
        onClose={() => setShowFavorites(false)}
        onRemove={removeFavorite}
        onSelect={(p) => setSelectedProperty(p)}
        onClearAll={clearFavorites}
      />

      {/* Compare Dialog */}
      <CompareView
        properties={favorites}
        isOpen={showCompare}
        onClose={() => setShowCompare(false)}
        onRemove={removeFavorite}
      />

      {/* Favorites Bottom Bar */}
      <FavoritesBar
        favorites={favorites}
        onOpenCompare={() => setShowCompare(true)}
        onViewFavorites={() => setShowFavorites(true)}
      />

      <BackToTop />
    </div>
  );
}
