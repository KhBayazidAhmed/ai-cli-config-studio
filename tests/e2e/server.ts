import { createRequestHandler } from "../../server";

const port = Number(Bun.env.PORT ?? 4173);

const handler = createRequestHandler({
  lookup: async () => [{ address: "93.184.216.34", family: 4 }],
  fetch: (async (_input, init) => {
    const authorization = new Headers(init?.headers).get("authorization");
    if (authorization === "Bearer bad-key") {
      return Response.json({ error: { message: "Invalid API key" } }, { status: 401 });
    }

    return Response.json({
      data: [
        { id: "cx/gpt-5.6-sol" },
        { id: "gpt-4.1-mini" },
        { id: "qwen/qwen3-coder" },
      ],
    });
  }) as typeof fetch,
});

const server = Bun.serve({ port, fetch: handler });
console.log(`E2E server running at ${server.url}`);
