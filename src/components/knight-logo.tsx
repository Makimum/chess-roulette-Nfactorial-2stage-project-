import { cn } from "@/lib/utils";

interface KnightLogoProps {
  className?: string;
}

/**
 * Brand logo glyph for Chess Roulette.
 * Renders the ♞ chess knight character.
 */
export function KnightLogo({ className }: KnightLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex items-center justify-center leading-none", className)}
    >
      ♞
    </span>
  );
}
