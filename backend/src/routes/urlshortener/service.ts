import { FastifyInstance } from "fastify";
import { customAlphabet } from "nanoid";
import fetchRetry from "fetch-retry"

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const OWN_HOSTNAME = "sh.pages.dev";
const MAX_URL_LENGTH = 2000;

// 6-char ID from alphanumeric alphabet (no ambiguous chars like 0/O, 1/l)
// Source: nanoid customAlphabet — https://github.com/ai/nanoid
const generateId = customAlphabet(
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz",
  6
);

// ─────────────────────────────────────────────
// 1. Validate & Sanitize
//    Source: images — "Use new URL() constructor"
// ─────────────────────────────────────────────

export function VerifyIsUrl(
  fastify: FastifyInstance,
  longUrl: string
): string {
  let parsed: URL;

  try {
    parsed = new URL(longUrl);
  } catch {
    throw fastify.httpErrors.badRequest("The URL provided is not valid");
  }

  if (parsed.protocol !== "https:") {
    throw fastify.httpErrors.badRequest("Protocol must be strictly https");
  }

  if (parsed.hostname === OWN_HOSTNAME || parsed.hostname.endsWith(`.${OWN_HOSTNAME}`)) {
    throw fastify.httpErrors.badRequest(
      `URLs pointing to ${OWN_HOSTNAME} are not allowed`
    );
  }

  if (parsed.href.length > MAX_URL_LENGTH) {
    throw fastify.httpErrors.badRequest(
      `URL exceeds the maximum allowed length of ${MAX_URL_LENGTH} characters`
    );
  }

  return parsed.href;
}

// ─────────────────────────────────────────────
// 2. Recursive / Loop Check
//    Source: images — "Circular Redirects" section
//    Check if the destination's hostname IS our own domain.
//    Different from VerifyIsUrl: that checks the raw input string,
//    this checks the *final resolved* href after normalization.
// ─────────────────────────────────────────────

export function CheckIsRecursive(
  fastify: FastifyInstance,
  parsedUrl: URL
): void {
  if (
    parsedUrl.hostname === OWN_HOSTNAME ||
    parsedUrl.hostname.endsWith(`.${OWN_HOSTNAME}`)
  ) {
    throw fastify.httpErrors.badRequest(
      "Circular redirects are not allowed: URL points back to this shortener"
    );
  }
}

// ─────────────────────────────────────────────
// 3. URL Normalization
//    Sources:
//    - Wikipedia URI normalization: lowercase scheme+host, remove duplicate slashes
//    - TinyFn: remove default port :443, strip trailing slash, strip tracking params
//    - https://en.wikipedia.org/wiki/URI_normalization
//    - https://tinyfn.io/blog/url-normalize-api
// ─────────────────────────────────────────────

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_eid",
  "ref",
]);

export function NormalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  // Force lowercase on protocol and hostname (already done by URL constructor,
  // but being explicit for clarity)
  url.hostname = url.hostname.toLowerCase();
  url.protocol = url.protocol.toLowerCase();

  // Remove default port for https (:443)
  if (url.protocol === "https:" && url.port === "443") {
    url.port = "";
  }

  // Strip known tracking query parameters
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }

  // Sort remaining query params for consistent deduplication
  url.searchParams.sort();

  // Remove trailing slash on the pathname (only if it's not the root "/")
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  // Remove duplicate slashes in pathname
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");

  // Remove the fragment — it is never sent to the server and serves no purpose
  // in a stored short link
  url.hash = "";

  return url.href;
}

// ─────────────────────────────────────────────
// 4. Google Safe Browsing Check
//    Source: images — "Reputation Check (Optional but Senior Move)"
// ─────────────────────────────────────────────



const fetchWithRetry = fetchRetry(fetch, {
  retries: 2,
  retryDelay: 300,
  retryOn: (attempt: number, error: Error | null, response: Response | null) => {
    if (error !== null) return true  // retry on any network error (ETIMEDOUT, ECONNRESET etc)
    if (response && response.status >= 500) return true  // retry on Google 5xx
    return false
  }
})

export async function VerifyIsSecureUrl(
  fastify: FastifyInstance,
  longUrl: string
): Promise<{ safe: true }> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    throw fastify.httpErrors.internalServerError(
      "Safe Browsing API key is not configured"
    );
  }

  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;

  const requestBody = {
    client: {
      clientId: "safeshort-url-shortener",
      clientVersion: "1.0.0",
    },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url: longUrl }],
    },
  };

  let response: Response;

  try {
    response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(5000), // give Google 5 seconds per attempt
    });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    fastify.log.error({
      message: nodeError.message,
      code: nodeError.code,
      cause: (nodeError as any).cause,
    }, "Google Safe Browsing — fetch failed after 3 retries")

    throw fastify.httpErrors.serviceUnavailable(
      "Could not reach the Safe Browsing API"
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "<unreadable>");
    fastify.log.error(
      { status: response.status, body },
      "Google Safe Browsing — non-OK response"
    );
    throw fastify.httpErrors.badGateway(
      `Google Safe Browsing API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { matches?: unknown[] };

  if (data.matches && data.matches.length > 0) {
    throw fastify.httpErrors.forbidden(
      "The URL you provided has been flagged as malicious"
    );
  }

  return { safe: true };
}
// ─────────────────────────────────────────────
// 5. Short ID Generation
//    Source: nanoid customAlphabet
//    - https://github.com/ai/nanoid
//    - https://www.npmjs.com/package/nanoid
//    Chosen over crypto.randomUUID() because UUIDs are 36 chars — useless
//    for short links. nanoid with customAlphabet gives 6-char URL-safe IDs
//    with cryptographic security.
// ─────────────────────────────────────────────

export function GenerateShortId(): string {
  return generateId();
}

// ─────────────────────────────────────────────
// 6. X-Robots-Tag header helper
//    Sources:
//    - MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Robots-Tag
//    - DEV.to: robots.txt blocks crawling; X-Robots-Tag blocks indexing per-resource
//    Strategy: add this header to every redirect response so Google never
//    indexes individual short links even if it follows one.
// ─────────────────────────────────────────────

export function applyNoIndexHeader(reply: { header: (k: string, v: string) => void }): void {
  reply.header("X-Robots-Tag", "noindex, nofollow");
}


export function GenerateCreatedAt(): string {
  return new Date().toISOString() // "2026-05-09T20:38:50.138Z"
}