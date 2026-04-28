import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getPublicProfileByUsername } from "@/lib/api";

const MIN_LEN = 2;
const MAX_LEN = 16;

type Status = "idle" | "loading" | "notFound" | "error";

export function PlayerSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmed = query.trim();
  const validLength = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN;

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!validLength) {
      setStatus("error");
      setErrorMsg(t("publicProfile.search.invalidLength"));
      return;
    }
    setStatus("loading");
    setErrorMsg(null);
    try {
      // recentLimit=0: only need user.id for redirect
      const profile = await getPublicProfileByUsername(trimmed, 0);
      if (!profile) {
        setStatus("notFound");
        return;
      }
      navigate({
        to: "/profile/$userId",
        params: { userId: profile.user.id },
        replace: true,
      });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : t("publicProfile.search.networkError"));
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 glass-gloss">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (status !== "idle") {
                setStatus("idle");
                setErrorMsg(null);
              }
            }}
            placeholder={t("publicProfile.search.placeholder")}
            maxLength={MAX_LEN}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="pl-9"
            aria-label={t("publicProfile.search.placeholder")}
          />
        </div>
        <Button
          type="submit"
          disabled={status === "loading" || !validLength}
          className="min-w-[120px]"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Search className="h-4 w-4" />
              {t("publicProfile.search.button")}
            </>
          )}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground mt-2">
        {t("publicProfile.search.hint", { min: MIN_LEN, max: MAX_LEN })}
      </p>

      {status === "notFound" && (
        <div className="mt-4 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
          <p className="font-medium">{t("publicProfile.search.notFound")}</p>
          <p className="text-muted-foreground mt-1">
            {t("publicProfile.search.notFoundDesc", { username: trimmed })}
          </p>
        </div>
      )}

      {status === "error" && errorMsg && (
        <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm flex items-start justify-between gap-3">
          <p className="text-destructive">{errorMsg}</p>
          {validLength && (
            <Button size="sm" variant="outline" onClick={() => handleSubmit()}>
              {t("publicProfile.search.retry")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
