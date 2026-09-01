/**
 * AI CLI Config Studio - Backend Server & Gateway Proxy
 * Handles model discovery requests and serves static frontend assets.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const PORT = Number(Bun.env.PORT ?? 3000);
const MAX_REDIRECTS = 5;

type LookupAddress = { address: string; family: number };
type LookupGateway = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<LookupAddress[]>;

export type GatewayDependencies = {
  fetch: typeof fetch;
  lookup: LookupGateway;
};

const defaultDependencies: GatewayDependencies = {
  fetch: (...args) => globalThis.fetch(...args),
  lookup: dnsLookup as LookupGateway,
};

/**
 * Standard JSON response helper with no-store cache control.
 */
function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Validates and normalizes the AI provider gateway URL.
 * Prevents Server-Side Request Forgery (SSRF) to private or localhost addresses.
 */
export function sanitizeGatewayUrl(input: string): URL {
  const normalized = input.match(/^https?:\/\//i) ? input : `https://${input}`;
  const url = new URL(normalized);

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS gateway URLs are supported.");
  }

  if (url.username || url.password) {
    throw new Error("Gateway URLs must not contain embedded credentials.");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isNamedLocalHost =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local");

  if (isNamedLocalHost || (isIP(host) && isNonPublicAddress(host))) {
    throw new Error("Local and private network gateway URLs are not allowed.");
  }

  // Ensure path ends in /models per OpenAI compatibility standard
  const cleanPath = url.pathname.replace(/\/+$/, "");
  if (!cleanPath.endsWith("/models")) {
    url.pathname = `${cleanPath}/models`;
  }
  url.hash = "";

  return url;
}

function isNonPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function ipv6ToBigInt(address: string): bigint | null {
  const normalized = address.toLowerCase().split("%")[0];
  const halves = normalized.split("::");
  if (halves.length > 2) return null;

  const parseHalf = (half: string): number[] | null => {
    if (!half) return [];
    const output: number[] = [];
    for (const part of half.split(":")) {
      if (part.includes(".")) {
        const octets = part.split(".").map(Number);
        if (octets.length !== 4 || octets.some((value) => value < 0 || value > 255)) return null;
        output.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      output.push(Number.parseInt(part, 16));
    }
    return output;
  };

  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] ?? "");
  if (!left || !right) return null;

  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = halves.length === 2 ? [...left, ...Array(missing).fill(0), ...right] : left;
  if (groups.length !== 8) return null;

  return groups.reduce((value, group) => (value << 16n) | BigInt(group), 0n);
}

function isInIpv6Range(value: bigint, base: bigint, prefix: number): boolean {
  const shift = BigInt(128 - prefix);
  return value >> shift === base >> shift;
}

function isNonPublicIpv6(address: string): boolean {
  const value = ipv6ToBigInt(address);
  if (value === null) return true;

  if (value === 0n || value === 1n) return true;
  if (isInIpv6Range(value, 0xfc00n << 112n, 7)) return true;
  if (isInIpv6Range(value, 0xfe80n << 112n, 10)) return true;
  if (isInIpv6Range(value, 0xff00n << 112n, 8)) return true;
  if (isInIpv6Range(value, 0x20010db8n << 96n, 32)) return true;

  // IPv4-compatible and IPv4-mapped IPv6 addresses inherit IPv4 restrictions.
  const prefix96 = value >> 32n;
  if (prefix96 === 0n || prefix96 === 0xffffn) {
    const ipv4 = Number(value & 0xffffffffn);
    return isNonPublicIpv4(
      `${(ipv4 >>> 24) & 255}.${(ipv4 >>> 16) & 255}.${(ipv4 >>> 8) & 255}.${ipv4 & 255}`,
    );
  }

  return false;
}

export function isNonPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isNonPublicIpv4(address);
  if (version === 6) return isNonPublicIpv6(address);
  return true;
}

async function assertPublicGatewayTarget(url: URL, lookup: LookupGateway): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) {
    if (isNonPublicAddress(hostname)) {
      throw new Error("Local and private network gateway URLs are not allowed.");
    }
    return;
  }

  let addresses: LookupAddress[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Gateway hostname could not be resolved.");
  }

  if (!addresses.length || addresses.some(({ address }) => isNonPublicAddress(address))) {
    throw new Error("Gateway hostname resolves to a local or private network address.");
  }
}

async function fetchGateway(
  initialUrl: URL,
  headers: Headers,
  dependencies: GatewayDependencies,
): Promise<Response> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicGatewayTarget(currentUrl, dependencies.lookup);
    const response = await dependencies.fetch(currentUrl, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) return response;
    if (redirectCount === MAX_REDIRECTS) throw new Error("Gateway redirected too many times.");

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.protocol !== "https:") {
      throw new Error("Gateway redirected to an insecure URL protocol.");
    }
    if (nextUrl.origin !== currentUrl.origin) {
      throw new Error("Cross-origin gateway redirects are not allowed.");
    }
    nextUrl.hash = "";
    currentUrl = nextUrl;
  }

  throw new Error("Gateway redirected too many times.");
}

export type ModelInfo = {
  id: string;
  /** Provider or owner reported by the gateway, e.g. "openai", "qwen". */
  owner?: string;
  /** Free-form grouping label the gateway already assigns, e.g. "chat", "image". */
  category?: string;
  /** Output modalities, lowercased: "text", "image", "audio", "video". */
  modalities?: string[];
};

const OWNER_KEYS = ["owned_by", "ownedBy", "owner", "provider", "vendor", "organization"];
const CATEGORY_KEYS = ["category", "group", "family", "type", "task", "endpoint", "mode"];
const MODALITY_KEYS = [
  "modality",
  "modalities",
  "output_modalities",
  "outputModalities",
  "capabilities",
  "tags",
];

function readString(entry: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  }
  return undefined;
}

function readStringList(entry: Record<string, unknown>, keys: string[]): string[] {
  const found = new Set<string>();

  for (const key of keys) {
    const value = entry[key];
    const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    for (const item of items) {
      if (typeof item !== "string") continue;
      const normalized = item.trim().toLowerCase();
      if (normalized) found.add(normalized);
    }
  }

  return [...found];
}

function toModelInfo(id: string, entry: Record<string, unknown> | null): ModelInfo {
  const info: ModelInfo = { id };
  if (!entry) return info;

  const architecture =
    entry.architecture && typeof entry.architecture === "object" && !Array.isArray(entry.architecture)
      ? (entry.architecture as Record<string, unknown>)
      : {};

  const owner = readString(entry, OWNER_KEYS);
  // "model" is the default OpenAI `object` value and says nothing about grouping.
  const category = readString(entry, CATEGORY_KEYS);
  const modalities = [
    ...readStringList(entry, MODALITY_KEYS),
    ...readStringList(architecture, MODALITY_KEYS),
  ];

  if (owner) info.owner = owner;
  if (category && category !== "model" && category !== "list") info.category = category;
  if (modalities.length) info.modalities = [...new Set(modalities)];

  return info;
}

function addModel(models: Map<string, ModelInfo>, value: unknown, entry?: Record<string, unknown>): void {
  if (typeof value !== "string") return;
  const id = value.trim();
  if (!id) return;

  const info = toModelInfo(id, entry ?? null);
  const existing = models.get(id);
  // First sighting wins for the id itself; later entries only fill in blanks.
  models.set(id, existing ? { ...info, ...existing } : info);
}

function collectModelEntries(value: unknown, models: Map<string, ModelInfo>): void {
  if (!Array.isArray(value)) return;

  for (const item of value) {
    if (typeof item === "string") {
      addModel(models, item);
      continue;
    }
    if (!item || typeof item !== "object") continue;

    const entry = item as Record<string, unknown>;
    addModel(models, entry.id ?? entry.model ?? entry.slug ?? entry.name, entry);
  }
}

function collectModelMap(value: unknown, models: Map<string, ModelInfo>): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  for (const [modelId, details] of Object.entries(value as Record<string, unknown>)) {
    if (details && typeof details === "object" && !Array.isArray(details)) {
      const entry = details as Record<string, unknown>;
      const explicitId = entry.id ?? entry.model ?? entry.slug;
      addModel(models, explicitId ?? modelId, entry);
    } else {
      addModel(models, modelId);
    }
  }
}

/**
 * Extracts models, with any grouping metadata the gateway supplies, from common
 * OpenAI-compatible and multi-provider gateway shapes.
 */
export function extractModels(payload: unknown): ModelInfo[] {
  const models = new Map<string, ModelInfo>();

  if (Array.isArray(payload)) {
    collectModelEntries(payload, models);
  } else if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;

    collectModelEntries(root.data, models);
    collectModelEntries(root.models, models);
    collectModelEntries(root.value, models);
    collectModelMap(root.models, models);

    const providers = root.providers;
    const providerEntries: [string | undefined, unknown][] = Array.isArray(providers)
      ? providers.map((provider) => [undefined, provider])
      : providers && typeof providers === "object"
        ? Object.entries(providers as Record<string, unknown>)
        : [];

    for (const [providerName, provider] of providerEntries) {
      if (Array.isArray(provider)) {
        collectModelEntries(provider, models);
        continue;
      }
      if (!provider || typeof provider !== "object") continue;

      const providerPayload = provider as Record<string, unknown>;
      const before = new Set(models.keys());

      collectModelEntries(providerPayload.data, models);
      collectModelEntries(providerPayload.models, models);
      collectModelEntries(providerPayload.value, models);
      collectModelMap(providerPayload.models, models);

      // A model nested under a provider inherits that provider as its owner.
      const owner = readString(providerPayload, OWNER_KEYS) ?? providerName?.toLowerCase();
      if (!owner) continue;
      for (const [id, info] of models) {
        if (!before.has(id) && !info.owner) models.set(id, { ...info, owner });
      }
    }
  }

  return [...models.values()].sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Extracts just the model IDs, sorted, from a gateway payload.
 */
export function extractModelIds(payload: unknown): string[] {
  return extractModels(payload).map((model) => model.id);
}

/**
 * Handles POST /api/models to discover models from an OpenAI-compatible gateway.
 */
async function handleModelsDiscovery(
  request: Request,
  dependencies: GatewayDependencies,
): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const { baseUrl, apiKey } = body as { baseUrl?: unknown; apiKey?: unknown };
  const rawBaseUrl = typeof baseUrl === "string" ? baseUrl.trim() : "";
  if (!rawBaseUrl) {
    return jsonResponse({ error: "Base URL is required." }, 400);
  }

  let modelsUrl: URL;
  try {
    modelsUrl = sanitizeGatewayUrl(rawBaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid gateway URL.";
    return jsonResponse({ error: message }, 400);
  }

  const headers = new Headers({ Accept: "application/json" });
  const rawApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (rawApiKey) {
    headers.set("Authorization", `Bearer ${rawApiKey}`);
  }

  try {
    const response = await fetchGateway(modelsUrl, headers, dependencies);

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      let detail = response.statusText;

      try {
        const errorPayload = JSON.parse(responseText) as {
          error?: string | { message?: string };
          message?: string;
        };
        detail =
          typeof errorPayload.error === "string"
            ? errorPayload.error
            : errorPayload.error?.message || errorPayload.message || detail;
      } catch {
        if (responseText && responseText.length < 240) {
          detail = responseText;
        }
      }

      const status = response.status >= 400 && response.status < 500 ? response.status : 502;
      return jsonResponse(
        { error: `Gateway returned ${response.status}: ${detail || "Request failed"}` },
        status,
      );
    }

    const payload = await response.json();
    const discovered = extractModels(payload);

    if (!discovered.length) {
      return jsonResponse({ error: "The gateway returned no models." }, 502);
    }

    // Only models the gateway actually described; the client groups by this when
    // present and falls back to name heuristics otherwise. Omitted entirely for
    // gateways that report nothing but ids.
    const details = discovered.filter((model) => model.owner || model.category || model.modalities);

    return jsonResponse({
      models: discovered.map((model) => model.id),
      ...(details.length ? { details } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gateway request failed.";
    return jsonResponse({ error: message }, 502);
  }
}

/**
 * Static asset route mapping.
 */
const staticFiles: Record<string, string> = {
  "/": "public/index.html",
  "/index.html": "public/index.html",
  "/docs": "public/docs.html",
  "/docs.html": "public/docs.html",
  "/app.js": "public/app.js",
  "/commands.js": "public/commands.js",
  "/styles.css": "public/styles.css",
};

/**
 * Main HTTP request router.
 */
export function createRequestHandler(
  overrides: Partial<GatewayDependencies> = {},
): (request: Request) => Promise<Response> {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function requestHandler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/models") {
      return handleModelsDiscovery(request, dependencies);
    }

    if (request.method === "GET" && staticFiles[url.pathname]) {
      return new Response(Bun.file(staticFiles[url.pathname]));
    }

    return new Response("Not found", { status: 404 });
  };
}

export const handleRequest = createRequestHandler();

// Start server when executed directly
if (import.meta.main) {
  const server = Bun.serve({ port: PORT, fetch: handleRequest });
  console.log(`AI CLI Config Studio running at ${server.url}`);
}
