"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { PropertyCard } from "@/components/property-card";
import { PropertyDetail } from "@/components/property-detail";
import { CompareView } from "@/components/compare-view";
import { FavoritesBar } from "@/components/favorites-bar";
import { FavoritesSheet } from "@/components/favorites-sheet";
import { FilterBar } from "@/components/filter-bar";
import { SuggestionChips } from "@/components/suggestion-chips";
import { RefineInput } from "@/components/refine-input";
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden bg-card border"
          style={{ animationDelay: `${i * 75}ms` }}
        >
          <Skeleton className="h-[200px] w-full" />
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
    sortedPrimary,
    sortedExpanded,
    suggestedChips,
    marketContext,
    searchMode,
    sortBy,
    favorites,
    isFavorite,
    clearFavorites,
    removeFavorite,
    handleSearch,
    handleRefine,
    resetConversation,
    handlePropertyClick,
    toggleFavorite,
    setSelectedProperty,
    setShowCompare,
    setShowFavorites,
    setSearchMode,
    setSortBy,
  } = usePropertySearch();

  const { toasts, toast, dismiss } = useToast();

  const [filteredPrimary, setFilteredPrimary] = useState<Property[] | null>(
    null
  );

  const displayPrimary = filteredPrimary ?? sortedPrimary;
  const displayExpanded = sortedExpanded;

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
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={resetConversation}
          >
            <div className="h-8 w-8 rounded-lg bg-[#3b5bdb] flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-extrabold tracking-tight">olu</span>
            </div>
            <span className="text-[1.125rem] font-bold tracking-tight">
              olu<span className="text-muted-foreground font-normal">.lu</span>
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

      {/* Search Section — sticky when results exist */}
      <section
        id="main-content"
        className={`transition-all duration-500 ${
          results
            ? "py-2.5 sm:py-4 sticky top-16 z-30 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 border-b"
            : "py-16 sm:py-20 lg:py-32 hero-mesh"
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          {!results && !isLoading && (
            <div className="text-center mb-12 animate-fade-in-up">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance leading-[1.1]">
                Your next home
                <br />
                <span className="text-primary">in Luxembourg</span>
              </h1>
              <p className="mt-4 sm:mt-5 text-base sm:text-xl text-muted-foreground max-w-md mx-auto leading-relaxed text-balance">
                Search all major portals at once.
                Just describe what you want.
              </p>
            </div>
          )}
          <SearchBar
            onSearch={handleSearch}
            isLoading={isLoading}
            hasResults={!!results}
            searchMode={searchMode}
            onModeChange={setSearchMode}
          />
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-8 mt-6">
          <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-5">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-32 mt-6">
          <ResultSkeleton />
        </div>
      )}

      {/* Primary Results */}
      {results && !isLoading && (
        <div className="max-w-7xl mx-auto px-3.5 sm:px-8 pb-8 mt-4 sm:mt-6" aria-live="polite">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {displayPrimary.length}{" "}
              {displayPrimary.length === 1 ? "property" : "properties"} found
            </h2>
          </div>

          <FilterBar
            properties={sortedPrimary}
            onFilteredChange={(filtered) => setFilteredPrimary(filtered)}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {displayPrimary.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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

          {/* Suggestion Chips */}
          <SuggestionChips
            chips={suggestedChips}
            onChipClick={handleRefine}
            isLoading={isLoading}
          />

          {/* Refine Input */}
          <RefineInput
            onRefine={handleRefine}
            onReset={resetConversation}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Expanded Results */}
      {results &&
        !isLoading &&
        (isExpandedLoading || displayExpanded.length > 0) && (
          <div className="max-w-7xl mx-auto px-3.5 sm:px-8 pb-32">
            <div className="relative mt-4">
              <div className="bg-muted/40 border rounded-2xl sm:rounded-3xl p-4 sm:p-8">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
