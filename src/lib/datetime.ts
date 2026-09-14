/**
 * Every date the app shows is a Pakistan-market date. Pinning the zone here keeps
 * a UTC host and a Karachi browser rendering the same string — an unpinned
 * formatter in a client component is a hydration mismatch — and stops ten files
 * each declaring their own Intl options.
 */
const ZONE = "Asia/Karachi";

const DATE = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: ZONE });
const LONG_DATE = new Intl.DateTimeFormat("en-PK", { dateStyle: "long", timeZone: ZONE });
const DATE_TIME = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE });
const LONG_DATE_TIME = new Intl.DateTimeFormat("en-PK", { dateStyle: "long", timeStyle: "short", timeZone: ZONE });

export function formatDate(value: Date): string {
  return DATE.format(value);
}

export function formatLongDate(value: Date): string {
  return LONG_DATE.format(value);
}

export function formatDateTime(value: Date): string {
  return DATE_TIME.format(value);
}

export function formatLongDateTime(value: Date): string {
  return LONG_DATE_TIME.format(value);
}

/** Karachi is UTC+5 with no DST, so a fixed offset is enough to bucket by local day. */
export const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

export function startOfKarachiDay(timestamp: number): number {
  const shifted = timestamp + KARACHI_OFFSET_MS;
  return shifted - (shifted % 86_400_000) - KARACHI_OFFSET_MS;
}
