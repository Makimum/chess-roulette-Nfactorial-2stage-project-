import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolvePhotoUrl } from "@/lib/auth";

interface PlayerBarProps {
  name: string;
  countryCode?: string | null;
  rating?: number | null;
  isAi?: boolean;
  isYou?: boolean;
  isTurn?: boolean;
  photoUrl?: string | null;
  /** UUID of the player. When provided and the player is human and not "you", the name links to their public profile. */
  userId?: string | null;
  /** Optional right-aligned slot, e.g. for a timer or extra badge. */
  rightSlot?: React.ReactNode;
  className?: string;
}

/**
 * Compact horizontal player strip. Used at the top (opponent) and bottom (you)
 * of the chess board on mobile to give every game a clear vertical Top → Board → Bottom flow.
 */
export function PlayerBar({
  name,
  countryCode,
  rating,
  isAi,
  isYou,
  isTurn,
  photoUrl,
  userId,
  rightSlot,
  className,
}: PlayerBarProps) {
  const initial = (name?.[0] ?? "?").toUpperCase();
  const src = !isAi ? resolvePhotoUrl(photoUrl) : null;
  const linkable = !isAi && !isYou && userId && !userId.startsWith("ai_");
  const NameTag = linkable ? Link : "span";
  const nameProps = linkable
    ? ({ to: "/profile/$userId", params: { userId: userId! } } as const)
    : ({} as Record<string, never>);
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl glass-panel glass-gloss px-3 py-2.5",
        isTurn && "shadow-[0_0_0_1px_var(--glow-emerald),0_0_30px_-4px_var(--glow-emerald)]",
        className,
      )}
    >
      <Avatar className="h-9 w-9 shrink-0">
        {src && <AvatarImage key={src} src={src} alt={name} />}
        <AvatarFallback className="bg-accent text-xs">
          {isAi ? <Bot className="h-4 w-4" /> : initial}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {!isAi && <CountryFlag code={countryCode} className="text-base shrink-0" />}
          {/* @ts-expect-error union of Link/span */}
          <NameTag {...nameProps} className={cn("font-medium text-sm truncate", linkable && "hover:underline")}>
            {name}
          </NameTag>
          {isYou && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-tight">
              You
            </Badge>
          )}
        </div>
        {rating != null && (
          <p className="text-[11px] text-muted-foreground">
            <User className="h-2.5 w-2.5 inline mr-1 -mt-0.5" />
            ELO {rating}
          </p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
