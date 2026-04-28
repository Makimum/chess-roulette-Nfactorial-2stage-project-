import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a TanStack Router link target for the given player's public profile,
 * or null if the player should not be linkable (AI, missing id, AI placeholder id).
 */
export function profileLinkFor(
  player: { id?: string | null; isAi?: boolean | null } | null | undefined,
): { to: "/profile/$userId"; params: { userId: string } } | null {
  if (!player) return null;
  if (player.isAi) return null;
  const id = player.id;
  if (!id || id.startsWith("ai_")) return null;
  return { to: "/profile/$userId", params: { userId: id } };
}
