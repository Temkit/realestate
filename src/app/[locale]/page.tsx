"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ChatInput } from "@/components/chat-input";
import { ConversationThread } from "@/components/conversation-thread";
import { PropertyCard } from "@/components/property-card";
import { PropertyDetail } from "@/components/property-detail";
import { CompareView } from "@/components/compare-view";
import { FavoritesBar } from "@/components/favorites-bar";
import { FavoritesSheet } from "@/components/favorites-sheet";
import { BackToTop } from "@/components/back-to-top";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ToastContainer } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertySearch } from "@/hooks/use-property-search";
import { useToast } from "@/hooks/use-toast";
import { Heart, Search } from "lucide-react";
import type { Property } from "@/lib/types";

function ResultSkeleton() {
  return (
    <div className="ml-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden bg-card border">
          <Skeleton className="h-[180px] w-full" />
          <div className="p-4 space-y-2.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const t = useTranslations("home");
  const tFav = useTranslations("favorites");

  const {
    turns,
    lastQuery,
    searchMode,
    isLoading,
    isClassifying,
    error,
    selectedProperty,
    showCompare,
    showFavorites,
    expandedResults,
    isExpandedLoading,
    favorites,
    isFavorite,
    clearFavorites,
    removeFavorite,
    handleSearch,
    handleRefine,
    handleModeChange,
    resetConversation,
    loadExpanded,
    handlePropertyClick,
    toggleFavorite,
    setSelectedProperty,
    setShowCompare,
    setShowFavorites,
  } = usePropertySearch();

  const { toasts, toast, dismiss } = useToast();

  // ── Expanded results lazy-load ──────────────────────────────────────
  const expandedSentinelRef = useRef<HTMLDivElement | null>(null);
  const expandedLoadedRef = useRef(false);

  useEffect(() => { expandedLoadedRef.current = false; }, [turns.length]);

  const sentinelCallback = useCallback(
    (node: HTMLDivElement | null) => { expandedSentinelRef.current = node; },
    []
  );

  useEffect(() => {
    const sentinel = expandedSentinelRef.current;
    if (!sentinel || turns.length === 0 || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !expandedLoadedRef.current) {
          expandedLoadedRef.current = true;
          loadExpanded();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [turns.length, isLoading, loadExpanded]);

  const handleToggleFavorite = (property: Property) => {
    const action = toggleFavorite(property);
    if (action === "added") toast(tFav("addedToast"), "success");
    else toast(tFav("removedToast"), "default");
  };

  const handleSubmit = (message: string) => {
    if (turns.length === 0) handleSearch(message);
    else handleRefine(message);
  };

  const hasConversation = turns.length > 0;

  // Expanded results filtered
  const expandedFiltered = expandedResults?.properties.filter((p) => {
    const allIds = new Set(turns.flatMap((t) => t.properties?.map((pp) => pp.id) || []));
    return !allIds.has(p.id);
  }) || [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="border-b sticky top-0 z-40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-8 h-14 flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={resetConversation}
          >
            <div className="h-7 w-7 rounded-lg bg-[#3b5bdb] flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-extrabold tracking-tight">
                olu
              </span>
            </div>
            <span className="text-base font-bold tracking-tight">
              olu
              <span className="text-muted-foreground font-normal">.lu</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {favorites.length > 0 && (
              <button
                onClick={() => setShowFavorites(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted"
              >
                <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                <span className="font-medium tabular-nums text-xs">
                  {favorites.length}
                </span>
              </button>
            )}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Main content area ────────────────────────────────────── */}
      <main className="flex-1 flex flex-col pb-[140px]">
        {/* Welcome state — centered, like ChatGPT */}
        {!hasConversation && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-[60vh]">
            <div className="text-center max-w-lg animate-fade-in-up">
              <div className="h-14 w-14 rounded-2xl bg-[#3b5bdb] flex items-center justify-center shadow-lg mx-auto mb-6">
                <Search className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                {t("title")}{" "}
                <span className="text-primary">{t("titleHighlight")}</span>
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-8">
                {t("subtitle")}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "appartement kirchberg",
                  "bureau mondorf",
                  "maison esch",
                  "studio belval",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSearch(suggestion)}
                    className="text-sm px-4 py-2 rounded-full border bg-background
                               hover:bg-primary/5 hover:border-primary/30 hover:text-primary
                               transition-colors text-muted-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-5xl mx-auto px-3.5 sm:px-8 mt-4">
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        )}

        {/* Conversation */}
        {hasConversation && (
          <div className="max-w-5xl mx-auto w-full px-3.5 sm:px-8 pt-4 sm:pt-6">
            <ConversationThread
              turns={turns}
              searchMode={searchMode}
              onPropertySelect={handlePropertyClick}
              onToggleFavorite={handleToggleFavorite}
              isFavorite={isFavorite}
              onChipClick={handleRefine}
              isClassifying={isClassifying}
            />

            {/* Loading skeleton for streaming */}
            {isLoading && turns[turns.length - 1]?.isStreaming && !turns[turns.length - 1]?.properties?.length && (
              <ResultSkeleton />
            )}
          </div>
        )}

        {/* Expanded results sentinel */}
        {hasConversation && !isLoading && (
          <div ref={sentinelCallback} aria-hidden="true" />
        )}

        {/* Expanded results */}
        {hasConversation &&
          !isLoading &&
          (isExpandedLoading || expandedFiltered.length > 0) && (
            <div className="max-w-5xl mx-auto w-full px-3.5 sm:px-8 mt-4">
              <div className="bg-muted/40 border rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-semibold">
                    {t("youMightAlsoLike")}
                  </h2>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {t("similarListings")}
                  </span>
                </div>
                {isExpandedLoading ? (
                  <ResultSkeleton />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {expandedFiltered.map((property, index) => (
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
                )}
              </div>
            </div>
          )}

        {hasConversation && <Footer />}
      </main>

      {/* ── Fixed bottom input ───────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <ChatInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          isClassifying={isClassifying}
          mode={searchMode}
          onModeChange={handleModeChange}
          hasResults={hasConversation}
        />
      </div>

      {/* ── Overlays ─────────────────────────────────────────────── */}
      <PropertyDetail
        property={selectedProperty}
        isOpen={!!selectedProperty}
        onClose={() => setSelectedProperty(null)}
        isFavorite={selectedProperty ? isFavorite(selectedProperty.id) : false}
        onToggleFavorite={() => {
          if (selectedProperty) handleToggleFavorite(selectedProperty);
        }}
      />

      <FavoritesSheet
        isOpen={showFavorites}
        onClose={() => setShowFavorites(false)}
        favorites={favorites}
        onRemove={removeFavorite}
        onClearAll={clearFavorites}
        onSelect={handlePropertyClick}
      />

      <CompareView
        properties={favorites}
        isOpen={showCompare}
        onClose={() => setShowCompare(false)}
        onRemove={removeFavorite}
      />

      {favorites.length > 0 && !showFavorites && (
        <FavoritesBar
          favorites={favorites}
          onViewFavorites={() => setShowFavorites(true)}
          onOpenCompare={() => setShowCompare(true)}
        />
      )}

      <BackToTop />
    </div>
  );
}
