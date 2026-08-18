/**
 * AI CLI Config Studio - Backend Server & Gateway Proxy
 * Handles model discovery requests and serves static frontend assets.
 */

const PORT = Number(Bun.env.PORT ?? 3000);

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

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS gateway URLs are supported.");
  }

  const host = url.hostname.toLowerCase();
  const isPrivateOrLocal =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("169.254.");

  if (isPrivateOrLocal) {
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

/**
 * Handles POST /api/models to discover models from an OpenAI-compatible gateway.
 */
async function handleModelsDiscovery(request: Request): Promise<Response> {
  let body: { baseUrl?: string; apiKey?: string };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const rawBaseUrl = body.baseUrl?.trim();
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
  const rawApiKey = body.apiKey?.trim();
  if (rawApiKey) {
    headers.set("Authorization", `Bearer ${rawApiKey}`);
  }

  try {
    const response = await fetch(modelsUrl, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

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

    const payload = (await response.json()) as {
      data?: Array<{ id?: string }>;
    };

    const discovered = [
      ...new Set(
        (payload.data ?? [])
          .map((item) => item.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ].sort();

    if (!discovered.length) {
      return jsonResponse({ error: "The gateway returned no models." }, 502);
    }

    return jsonResponse({ models: discovered });
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
  "/dpcs": "public/docs.html",
  "/docs.html": "public/docs.html",
  "/app.js": "public/app.js",
  "/commands.js": "public/commands.js",
  "/styles.css": "public/styles.css",
};

/**
 * Main HTTP request router.
 */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/api/models") {
    return handleModelsDiscovery(request);
  }

  if (request.method === "GET" && staticFiles[url.pathname]) {
    return new Response(Bun.file(staticFiles[url.pathname]));
  }

  return new Response("Not found", { status: 404 });
}

// Start server when executed directly
if (import.meta.main) {
  const server = Bun.serve({ port: PORT, fetch: handleRequest });
  console.log(`AI CLI Config Studio running at ${server.url}`);
}
