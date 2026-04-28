import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale, getLocale, type Locale } from "@/i18n";

const LABELS: Record<Locale, string> = {
  en: "EN",
  ru: "RU",
};

const FULL_LABELS: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
};

export function LanguageSwitcher({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const { i18n } = useTranslation();
  const current = (i18n.language?.slice(0, 2) === "ru" ? "ru" : "en") as Locale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" aria-label="Language" className="gap-1.5">
          <Languages className="h-4 w-4" />
          <span className="text-xs font-semibold">{LABELS[current]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(LABELS) as Locale[]).map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => setLocale(loc)}
            className={loc === current ? "font-semibold" : ""}
          >
            {FULL_LABELS[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LanguageSelectInline() {
  const { i18n } = useTranslation();
  const current = (i18n.language?.slice(0, 2) === "ru" ? "ru" : "en") as Locale;
  return (
    <div className="flex gap-1">
      {(Object.keys(FULL_LABELS) as Locale[]).map((loc) => (
        <Button
          key={loc}
          size="sm"
          variant={loc === current ? "default" : "outline"}
          onClick={() => setLocale(loc)}
        >
          {FULL_LABELS[loc]}
        </Button>
      ))}
    </div>
  );
}

export { getLocale };
