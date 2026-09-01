// Shared raw-HTTP helper for the adversarial specs. Not a spec file: Playwright's
// default testMatch only picks up *.spec.ts / *.test.ts, so this is never collected.
//
// These specs assert on the STATUS LINE, so they must not follow redirects and must
// not throw on a non-2xx. Node's fetch with `redirect: "manual"` gives both; the
// Playwright APIRequestContext throws once maxRedirects is exceeded.

export const QA_BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3001";

export type ProbeResult = {
  path: string;
  status: number;
  headers: Headers;
  body: string;
};

/** `path` is concatenated, never URL-normalised, so `..` and `%00` reach the server verbatim. */
export async function probe(path: string, init: RequestInit = {}): Promise<ProbeResult> {
  const response = await fetch(`${QA_BASE_URL}${path}`, { redirect: "manual", ...init });
  return { path, status: response.status, headers: response.headers, body: await response.text() };
}

export function documentTitle(body: string): string {
  const matches = [...body.matchAll(/<title[^>]*>([^<]*)<\/title>/gi)].map((match) => match[1]);
  return matches.at(-1) ?? "";
}

/** Every product link the storefront renders, as a sorted, de-duplicated set. */
export function productHandles(body: string): string[] {
  return [...new Set([...body.matchAll(/href="\/products\/([a-z0-9-]+)"/g)].map((match) => match[1]))].sort();
}
