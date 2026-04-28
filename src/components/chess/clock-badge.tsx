import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { GameClock, Color } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ClockBadgeProps {
  /** Side this badge represents. */
  side: Color;
  /** Side currently to move per backend (drives ticking). */
  sideToMove: Color | undefined;
  clocks: GameClock | null;
  className?: string;
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (ms < 20_000) {
    const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
    return `${m}:${s.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ClockBadge({ side, sideToMove, clocks, className }: ClockBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  const isTicking = !!clocks?.isRunning && sideToMove === side;

  useEffect(() => {
    if (!isTicking) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [isTicking]);

  if (!clocks) return null;
  const baseMs = side === "white" ? clocks.whiteTimeMs : clocks.blackTimeMs;
  if (baseMs == null) return null;

  const elapsedSinceServer = isTicking
    ? Math.max(0, now - Date.parse(clocks.serverNow))
    : 0;
  const displayMs = Math.max(0, baseMs - elapsedSinceServer);
  const low = displayMs < 10_000;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-sm tabular-nums",
        isTicking ? "bg-primary/15 text-foreground" : "bg-muted/40 text-muted-foreground",
        low && "text-destructive",
        className,
      )}
    >
      <Clock className="h-3 w-3 opacity-70" />
      {fmt(displayMs)}
    </div>
  );
}
