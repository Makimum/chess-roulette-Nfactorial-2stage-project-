import { cn } from "@/lib/utils";

interface CountryFlagProps {
  code?: string | null;
  className?: string;
  /** Show the ISO code text next to the flag */
  withCode?: boolean;
  /** Pixel height of the flag image. Width auto-scales to 4:3. */
  size?: number;
}

/**
 * Renders a country flag as an SVG image from flagcdn.com.
 * Works consistently across all OS / browsers (no emoji-font dependency).
 * Returns null if the code is missing or invalid.
 */
export function CountryFlag({
  code,
  className,
  withCode = false,
  size = 14,
}: CountryFlagProps) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;

  const lower = normalized.toLowerCase();
  // Use 2x raster for crispness on hi-DPI displays
  const src = `https://flagcdn.com/w40/${lower}.png`;
  const srcSet = `https://flagcdn.com/w40/${lower}.png 1x, https://flagcdn.com/w80/${lower}.png 2x`;
  const width = Math.round(size * (4 / 3));

  return (
    <span
      title={normalized}
      aria-label={normalized}
      className={cn("inline-flex items-center gap-1 leading-none align-middle", className)}
    >
      <img
        src={src}
        srcSet={srcSet}
        width={width}
        height={size}
        alt={normalized}
        loading="lazy"
        decoding="async"
        className="inline-block rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] object-cover"
        style={{ width, height: size }}
      />
      {withCode && <span className="text-xs text-muted-foreground">{normalized}</span>}
    </span>
  );
}
