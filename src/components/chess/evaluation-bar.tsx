import { cn } from "@/lib/utils";

interface EvaluationBarProps {
  /** Centipawns from white's perspective. Positive = white better. */
  evalCp?: number;
  orientation?: "white" | "black";
}

export function EvaluationBar({ evalCp = 0, orientation = "white" }: EvaluationBarProps) {
  // sigmoid mapping cp → percent for white
  const pct = 50 + 50 * (2 / (1 + Math.exp(-evalCp / 400)) - 1);
  const whitePct = orientation === "white" ? pct : 100 - pct;
  const display =
    Math.abs(evalCp) >= 1000 ? `M${Math.round(Math.abs(evalCp) / 100)}` : (evalCp / 100).toFixed(1);
  const advantage = evalCp >= 0;

  return (
    <div className="relative flex flex-col w-7 h-full min-h-[400px] rounded-md overflow-hidden ring-1 ring-border bg-neutral-900">
      <div
        className="bg-white transition-all duration-500 ease-out"
        style={{ height: `${100 - whitePct}%` }}
      />
      <div
        className="bg-neutral-900 flex-1 transition-all duration-500 ease-out"
        style={{ height: `${whitePct}%` }}
      />
      <span
        className={cn(
          "absolute left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold px-1 rounded",
          advantage ? "bottom-1 text-neutral-900 bg-white" : "top-1 text-white bg-neutral-900",
        )}
      >
        {display}
      </span>
    </div>
  );
}
