/**
 * The lëtz24 two-dot mark (the ë tréma: blue you, red your pro) used as a
 * recurring design motif — section marks, loaders, meta lines, empty states.
 * Colors follow the --logo-blue / --logo-red theme tokens.
 */

export function Dots({
  size = 6,
  pulse = false,
  className = "",
}: {
  /** Dot diameter in px. */
  size?: number;
  /** Loading affordance: the pair pulses alternately. */
  pulse?: boolean;
  className?: string;
}) {
  const dot = {
    width: size,
    height: size,
  } as const;
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap: Math.max(2, Math.round(size * 0.55)) }}
      aria-hidden="true"
    >
      <span
        className={`rounded-full bg-[var(--logo-blue)] ${pulse ? "animate-dot-pulse" : ""}`}
        style={dot}
      />
      <span
        className={`rounded-full bg-[var(--logo-red)] ${pulse ? "animate-dot-pulse [animation-delay:220ms]" : ""}`}
        style={dot}
      />
    </span>
  );
}

/** Centered section mark — the standard heading companion. */
export function SectionDots({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Dots size={7} />
    </div>
  );
}
