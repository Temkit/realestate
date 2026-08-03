/**
 * lëtz24 logotype — drawn vector geometry (monoline, 9-unit stroke, round
 * terminals). Colors come from --logo-blue / --logo-red tokens (theme-aware);
 * the `white` variant is for brand-blue or photo backgrounds.
 * Static exports of the same geometry live in /public/logo*.svg.
 */

const BLUE = "var(--logo-blue, #1554e8)";
const RED = "var(--logo-red, #e63946)";

export function Logo({
  className,
  white = false,
  title = "lëtz24",
}: {
  className?: string;
  white?: boolean;
  title?: string;
}) {
  const ink = white ? "#ffffff" : BLUE;
  return (
    <svg viewBox="0 0 206 72" className={className} role="img" aria-label={title}>
      <g fill="none" stroke={ink} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12 V58" />
        <path d="M25 41 H55 A15 15 0 1 0 50.6 51.6" />
        <path d="M70 14 V49 A9 9 0 0 0 79 58" />
        <path d="M61 25 H80" />
        <path d="M92 26 H114 L92 58 H114" />
      </g>
      <g
        fill="none"
        stroke={white ? "#ffffff" : RED}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M128 24 A11 11 0 1 1 148 30 L128 58 H150" />
        <path d="M181 13 L163 41 H191" />
        <path d="M183 27 V58" />
      </g>
      <circle cx="34.5" cy="13" r="4.6" fill={ink} />
      <circle cx="45.5" cy="13" r="4.6" fill={RED} />
    </svg>
  );
}

/** The ë icon alone (square tile) — for compact placements. */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="lëtz24">
      <rect width="64" height="64" rx="15" fill={BLUE} />
      <circle cx="27" cy="13.5" r="4.1" fill="#ffffff" />
      <circle cx="37" cy="13.5" r="4.1" fill={RED} />
      <path
        d="M18.5 39 H45.5 A13.5 13.5 0 1 0 41.5 48.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
