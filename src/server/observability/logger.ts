import "server-only";

const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 } as const;

export type LogLevel = keyof typeof LEVEL_ORDER;

/** Only non-sensitive scalars. Never pass credentials, keys, tokens or personal data. */
export type LogFields = Record<string, string | number | boolean>;

function isLogLevel(value: string | undefined): value is LogLevel {
  return value !== undefined && value in LEVEL_ORDER;
}

/**
 * Minimal structured server logger. LOG_LEVEL is read directly rather than
 * through the env schema so logging can never be the thing that throws.
 */
export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const configured = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (LEVEL_ORDER[level] < LEVEL_ORDER[isLogLevel(configured) ? configured : "info"]) return;

  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
