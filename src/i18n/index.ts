import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { ru } from "./locales/ru";

export const SUPPORTED_LOCALES = ["en", "ru"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_STORAGE_KEY = "cma_locale";

// IMPORTANT: Initialize with a deterministic locale that matches SSR.
// Detection happens client-side AFTER mount via syncLocaleFromStorage()
// to avoid hydration mismatches.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
}

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "en" || stored === "ru") return stored;
  } catch {
    /* ignore */
  }
  const nav = (window.navigator?.language || "en").toLowerCase();
  if (nav.startsWith("ru")) return "ru";
  return "en";
}

/**
 * Call once on the client after mount to switch from the SSR default ("en")
 * to the user's preferred locale without causing a hydration mismatch.
 */
export function syncLocaleFromStorage() {
  const target = detectLocale();
  if (i18n.language !== target) {
    void i18n.changeLanguage(target);
  }
}

export function setLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(locale);
}

export function getLocale(): Locale {
  const l = (i18n.language || "en").slice(0, 2);
  return l === "ru" ? "ru" : "en";
}

export default i18n;
