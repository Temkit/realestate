"use client";

import { Sparkles } from "lucide-react";

interface AiSummaryProps {
  summary: string;
  marketContext?: string;
}

export function AiSummary({ summary, marketContext }: AiSummaryProps) {
  return (
    <div className="mb-6 flex items-start gap-3 animate-fade-in-up">
      <div className="shrink-0 mt-0.5">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[0.9375rem] leading-relaxed text-foreground">
          {summary}
        </p>
        {marketContext && (
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            {marketContext}
          </p>
        )}
      </div>
    </div>
  );
}
