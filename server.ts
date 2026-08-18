const port = Number(Bun.env.PORT ?? 3000);

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function gatewayModelsUrl(input: string) {
  const url = new URL(input.match(/^https?:\/\//i) ? input : `https://${input}`);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS gateway URLs are supported.");
  }

  const hostname = url.hostname.toLowerCase();
  const blockedHostname =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname.startsWith("169.254.");

  if (blockedHostname) {
    throw new Error("Local and private network gateway URLs are not allowed.");
  }

  if (!url.pathname.replace(/\/$/, "").endsWith("/models")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/models`;
  }
  url.hash = "";
  return url;
}

async function models(request: Request) {
  let body: { baseUrl?: string; apiKey?: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!body.baseUrl?.trim()) {
    return json({ error: "Base URL is required." }, 400);
  }

  let modelsUrl: URL;
  try {
    modelsUrl = gatewayModelsUrl(body.baseUrl.trim());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid gateway URL.";
    return json({ error: message }, 400);
  }

  const headers = new Headers({ Accept: "application/json" });
  if (body.apiKey?.trim()) {
    headers.set("Authorization", `Bearer ${body.apiKey.trim()}`);
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
        if (responseText && responseText.length < 240) detail = responseText;
      }

      const status = response.status >= 400 && response.status < 500
        ? response.status
        : 502;
      return json(
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
      return json({ error: "The gateway returned no models." }, 502);
    }

    return json({ models: discovered });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gateway request failed.";
    return json({ error: message }, 502);
  }
}

const staticFiles: Record<string, string> = {
  "/": "public/index.html",
  "/app.js": "public/app.js",
  "/commands.js": "public/commands.js",
  "/styles.css": "public/styles.css",
};

export async function handleRequest(request: Request) {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/api/models") {
    return models(request);
  }

  if (request.method === "GET" && staticFiles[url.pathname]) {
    return new Response(Bun.file(staticFiles[url.pathname]));
  }

  return new Response("Not found", { status: 404 });
}

if (import.meta.main) {
  const server = Bun.serve({ port, fetch: handleRequest });
  console.log(`Herness Config running at ${server.url}`);
}
