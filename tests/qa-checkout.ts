// Raw server-action harness for the COD checkout. Not a spec file: Playwright's
// default testMatch only collects *.spec.ts / *.test.ts.
//
// `placeCodOrder` is a React server action, so its id is a build hash that changes
// whenever the module changes. Nothing here hardcodes it. One real browser
// submission is intercepted and aborted; the captured request is then the template
// every raw replay is built from, so the encoding is React's own and only the bytes
// under test differ.

import type { Page } from "@playwright/test";

export type ActionTemplate = {
  url: string;
  actionId: string;
  contentType: string;
  boundary: string;
  /** React's per-form field-name prefix, e.g. `_1_`. Derived, never assumed. */
  prefix: string;
  body: string;
};

/** Contract B's `Result` envelope, as it arrives on the wire. */
export type ActionState = {
  ok: boolean;
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  data?: { orderToken?: string };
};

export const orderTokenOf = (state: ActionState | null): string =>
  (state?.ok ? state.data?.orderToken : undefined) ?? "";

export type ReplayResult = { status: number; text: string; state: ActionState | null };

/**
 * A caller address unique to this worker process. The rate limiter keys on
 * `x-forwarded-for` over a 60s sliding window, so a fixed address would make a
 * second run inside a minute fail on the previous run's budget — a flake that
 * looks exactly like a regression.
 */
const octet = () => 1 + Math.floor(Math.random() * 250);
const RUN_PREFIX = `198.${octet()}.${octet()}`;
export const qaClient = (index: number): string => `${RUN_PREFIX}.${index}`;

export const SEEDED_HANDLE = "ease-fit-trouser";
export const AVAILABLE_VARIANT = "dev-ease-black-m";
/** `isAvailable: false` in the development seed — resolvable by id, not orderable. */
export const UNAVAILABLE_VARIANT = "dev-ease-black-l";
export const SEEDED_UNIT_PRICE = 599_900;
export const SHIPPING_FEE = 25_000;

export const cartLines = (lines: readonly { variantId?: string; handle?: string; quantity?: number }[]): string =>
  JSON.stringify(
    lines.map((line) => ({
      productHandle: line.handle ?? SEEDED_HANDLE,
      variantId: line.variantId ?? AVAILABLE_VARIANT,
      quantity: line.quantity ?? 1,
    })),
  );

/**
 * Drives one genuine checkout submission and intercepts it at the network boundary.
 * The request is aborted, so capturing costs no order.
 */
export async function captureCheckoutSubmission(page: Page): Promise<ActionTemplate> {
  type Shot = { url: string; headers: Record<string, string>; body: string };
  let resolveShot: (shot: Shot) => void = () => undefined;
  const firstPost = new Promise<Shot>((resolve) => {
    resolveShot = resolve;
  });
  let captured = false;

  await page.route("**/checkout", async (route) => {
    const request = route.request();
    if (!captured && request.method() === "POST") {
      captured = true;
      resolveShot({ url: request.url(), headers: request.headers(), body: request.postData() ?? "" });
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.addInitScript(() => window.sessionStorage.setItem("delta-home-intro-seen", "true"));
  await page.goto(`/products/${SEEDED_HANDLE}`);
  await page.getByRole("radio", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "ADD TO CART" }).click();
  await page.getByRole("link", { name: "Check out" }).click();
  await page.waitForURL(/\/checkout$/);
  await page.getByLabel("Full name").fill("Ali Khan");
  await page.getByLabel("Pakistani mobile number").fill("03001234567");
  await page.getByLabel("Address line 1").fill("House 12, Street 4");
  await page.getByLabel("City").fill("Lahore");
  await page.getByRole("button", { name: "Place COD order" }).click();

  // Settled by the route handler above and by nothing else, so this is the
  // submission event itself rather than a delay standing in for one.
  const shot = await firstPost;
  const actionId = shot.headers["next-action"] ?? "";
  const contentType = shot.headers["content-type"] ?? "";
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1] ?? "";
  const prefix = /name="([^"]*)cartLines"/.exec(shot.body)?.[1] ?? "";
  if (!actionId || !boundary || !prefix) {
    throw new Error(`unusable capture: action=${actionId} boundary=${boundary} prefix=${prefix}`);
  }
  await page.unroute("**/checkout");
  return { url: shot.url, actionId, contentType, boundary, prefix, body: shot.body };
}

/** Replaces one multipart part's value, leaving React's encoding otherwise byte-identical. */
export function setField(template: ActionTemplate, body: string, name: string, value: string): string {
  const marker = `Content-Disposition: form-data; name="${template.prefix}${name}"\r\n\r\n`;
  const start = body.indexOf(marker);
  if (start < 0) throw new Error(`no multipart part named ${template.prefix}${name}`);
  const valueStart = start + marker.length;
  const end = body.indexOf(`\r\n--${template.boundary}`, valueStart);
  if (end < 0) throw new Error(`unterminated multipart part ${name}`);
  return body.slice(0, valueStart) + value + body.slice(end);
}

/** Appends a part the form never sends, to prove the server ignores it. */
export function addField(template: ActionTemplate, body: string, name: string, value: string): string {
  const close = `--${template.boundary}--`;
  const at = body.lastIndexOf(close);
  if (at < 0) throw new Error("no closing multipart delimiter");
  const part = `--${template.boundary}\r\nContent-Disposition: form-data; name="${template.prefix}${name}"\r\n\r\n${value}\r\n`;
  return body.slice(0, at) + part + body.slice(at);
}

/** The action's return value, dug out of the RSC flight stream. */
export function parseActionState(text: string): ActionState | null {
  for (const line of text.split("\n")) {
    const match = /^[0-9a-f]+:(\{.*\})\s*$/.exec(line.trim());
    if (!match) continue;
    try {
      const value = JSON.parse(match[1]) as ActionState;
      if (value !== null && typeof value === "object" && typeof value.ok === "boolean") return value;
    } catch {
      // Not the state line.
    }
  }
  return null;
}

export async function replay(
  template: ActionTemplate,
  body: string,
  options: { actionId?: string; client?: string } = {},
): Promise<ReplayResult> {
  const response = await fetch(template.url, {
    method: "POST",
    redirect: "manual",
    headers: {
      "next-action": options.actionId ?? template.actionId,
      "content-type": template.contentType,
      accept: "text/x-component",
      // A limiter keyed on the caller has to read this header behind a proxy, so a
      // distinct value per test is what isolates one case from the next.
      ...(options.client ? { "x-forwarded-for": options.client } : {}),
    },
    body,
  });
  const text = await response.text();
  return { status: response.status, text, state: parseActionState(text) };
}

/** Every 64-hex order token the response handed back, however it was framed. */
export const tokensIn = (text: string): string[] => [...new Set(text.match(/\b[a-f0-9]{64}\b/g) ?? [])];
