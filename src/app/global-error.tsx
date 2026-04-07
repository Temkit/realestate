"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-background text-foreground font-sans">
        <div className="text-center px-6">
          <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-xl">!</span>
          </div>
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
