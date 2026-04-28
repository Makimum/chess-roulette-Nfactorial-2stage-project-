/**
 * Country catalog for leaderboard filters and player metadata.
 *
 * `PINNED_COUNTRIES` are the CIS region — they show as quick tabs above the
 * country select. `OTHER_COUNTRIES` populate the dropdown ("Other country").
 *
 * Localized names live in i18n under `countries.<ISO2>`.
 */

import type { TFunction } from "i18next";

export interface Country {
  /** ISO-3166 alpha-2 code, uppercase. */
  code: string;
  /** i18n key for the localized display name. */
  nameKey: string;
}

const c = (code: string): Country => ({ code, nameKey: `countries.${code}` });

export const PINNED_COUNTRIES: Country[] = [
  c("RU"), c("KZ"), c("BY"), c("UA"), c("UZ"),
  c("KG"), c("AM"), c("AZ"), c("GE"), c("MD"),
  c("TJ"), c("TM"),
];

export const OTHER_COUNTRIES: Country[] = [
  "US", "GB", "DE", "FR", "ES", "IT", "PL", "PT", "NL", "BE",
  "SE", "NO", "FI", "DK", "IE", "CZ", "AT", "CH", "GR", "RO",
  "BG", "HU", "HR", "RS", "TR", "IL", "EG", "ZA", "MA",
  "CN", "JP", "KR", "IN", "PK", "ID", "VN", "TH", "PH", "MY", "SG",
  "AU", "NZ",
  "BR", "AR", "MX", "CL", "CO", "PE", "VE", "CA",
].map(c);

const PINNED_CODES = new Set(PINNED_COUNTRIES.map((x) => x.code));

export function getAllCountries(): Country[] {
  return [...PINNED_COUNTRIES, ...OTHER_COUNTRIES];
}

export function isPinned(code: string | null | undefined): boolean {
  return !!code && PINNED_CODES.has(code.toUpperCase());
}

export function findCountry(code: string | null | undefined): Country | null {
  if (!code) return null;
  const up = code.toUpperCase();
  return getAllCountries().find((x) => x.code === up) ?? null;
}

/** Localized country name (falls back to the ISO code). */
export function getCountryName(code: string | null | undefined, t: TFunction): string {
  if (!code) return "";
  const up = code.toUpperCase();
  return t(`countries.${up}` as never, { defaultValue: up }) as string;
}

/** Returns OTHER_COUNTRIES sorted by their localized display name. */
export function getOtherCountriesSorted(t: TFunction): Country[] {
  return [...OTHER_COUNTRIES].sort((a, b) =>
    getCountryName(a.code, t).localeCompare(getCountryName(b.code, t)),
  );
}
