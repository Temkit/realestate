"use client";

import { useEffect, useRef } from "react";
import { Sparkles, User } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { MarketStats } from "@/components/market-stats";
import type { Property, MarketAnalytics } from "@/lib/types";

export interface ConversationMessage {
  role: "user" | "ai";
  content: string;
}

export interface ConversationTurn {
  userMessage: string;
  aiMessage?: string;
  properties?: Property[];
  analytics?: MarketAnalytics;
  chips?: string[];
  isStreaming?: boolean;
  statusMessage?: string;
}

interface ConversationThreadProps {
  turns: ConversationTurn[];
  searchMode: "buy" | "rent";
  onPropertySelect: (property: Property) => void;
  onToggleFavorite: (property: Property) => void;
  isFavorite: (id: string) => boolean;
  onChipClick: (chip: string) => void;
  isClassifying: boolean;
}

export function ConversationThread({
  turns,
  searchMode,
  onPropertySelect,
  onToggleFavorite,
  isFavorite,
  onChipClick,
  isClassifying,
}: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, turns[turns.length - 1]?.properties?.length, turns[turns.length - 1]?.aiMessage]);

  if (turns.length === 0) return null;

  return (
    <div className="space-y-6 pb-4">
      {turns.map((turn, turnIndex) => (
        <div key={turnIndex} className="space-y-4 animate-fade-in-up">
          {/* User message */}
          <div className="flex justify-end">
            <div className="flex items-start gap-2 max-w-[85%]">
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                {turn.userMessage}
              </div>
              <div className="shrink-0 mt-0.5">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Streaming status */}
          {turn.isStreaming && turn.statusMessage && (
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 mt-0.5">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {turn.statusMessage}
              </div>
            </div>
          )}

          {/* AI message */}
          {turn.aiMessage && (
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 mt-0.5">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed max-w-[85%]">
                {turn.aiMessage}
              </div>
            </div>
          )}

          {/* Market Stats (only on first turn or when analytics change) */}
          {turn.analytics?.priceRange && (
            <div className="ml-9">
              <MarketStats analytics={turn.analytics} mode={searchMode} />
            </div>
          )}

          {/* Property Cards */}
          {turn.properties && turn.properties.length > 0 && (
            <div className="ml-9">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {turn.properties.map((property, index) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    isFavorite={isFavorite(property.id)}
                    onToggleFavorite={() => onToggleFavorite(property)}
                    onSelect={() => onPropertySelect(property)}
                    index={index}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Suggestion Chips */}
          {turn.chips && turn.chips.length > 0 && !turn.isStreaming && (
            <div className="ml-9 flex flex-wrap gap-2">
              {turn.chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => onChipClick(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-background
                             hover:bg-primary/5 hover:border-primary/30 hover:text-primary
                             transition-colors text-muted-foreground"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Classifying indicator */}
      {isClassifying && (
        <div className="flex items-start gap-2.5 animate-fade-in-up">
          <div className="shrink-0 mt-0.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
