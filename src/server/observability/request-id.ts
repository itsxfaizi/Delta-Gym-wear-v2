import "server-only";

const REQUEST_ID_HEADER = "x-request-id";

export function getOrCreateRequestId(request: Request): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER)?.trim();

  return incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
}

export { REQUEST_ID_HEADER };
