import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Suggestion {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  suggestions?: Suggestion[];
}

export function EmptyState({ icon: Icon, title, description, action, suggestions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1.5">{title}</h3>
      <p className="text-[0.9375rem] text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      {action && (
        <Button variant="outline" size="sm" className="mt-5 rounded-xl" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mt-5">
          {suggestions.map((s) => (
            <button
              key={s.label}
              onClick={s.onClick}
              className="text-xs px-3.5 py-2 rounded-full border border-primary/20 bg-primary/[0.03]
                         text-foreground hover:bg-primary/10 hover:border-primary/40
                         transition-all duration-200"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
