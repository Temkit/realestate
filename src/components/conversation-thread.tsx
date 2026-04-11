"use client";

import { useEffect, useRef } from "react";
import { Sparkles, User } from "lucide-react";

export interface ConversationMessage {
  role: "user" | "ai";
  content: string;
}

interface ConversationThreadProps {
  messages: ConversationMessage[];
  isClassifying: boolean;
}

export function ConversationThread({
  messages,
  isClassifying,
}: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isClassifying]);

  // Only show if there's more than the initial search + response
  if (messages.length <= 2 && !isClassifying) return null;

  return (
    <div className="mt-6 mb-4 space-y-3">
      {messages.slice(2).map((msg, i) => (
        <div
          key={i}
          className={`flex gap-2.5 animate-fade-in-up ${
            msg.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          {msg.role === "ai" && (
            <div className="shrink-0 mt-0.5">
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {msg.content}
          </div>
          {msg.role === "user" && (
            <div className="shrink-0 mt-0.5">
              <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      ))}

      {isClassifying && (
        <div className="flex gap-2.5 animate-fade-in-up">
          <div className="shrink-0 mt-0.5">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
          </div>
          <div className="bg-muted rounded-xl px-3.5 py-2">
            <div className="flex gap-1">
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
