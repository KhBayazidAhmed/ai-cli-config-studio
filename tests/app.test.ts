import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { configPaths, createSetupCommand, getRevertCommand } from "../public/commands.js";
import { createRequestHandler, isNonPublicAddress, sanitizeGatewayUrl } from "../server";

const temporaryHomes: string[] = [];
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

afterEach(async () => {
  await Promise.all(temporaryHomes.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createTemporaryHome() {
  const path = await mkdtemp(join(tmpdir(), "config-studio-test-"));
  temporaryHomes.push(path);
  return path;
}

async function runUnixCommand(command: string, home: string) {
  const process = Bun.spawn(["zsh", "-c", command], {
    env: { ...Bun.env, HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([
    process.exited,
    new Response(process.stderr).text(),
  ]);
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
}

async function writeHomeFile(home: string, relativePath: string, contents: string) {
  const target = join(home, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents);
  return target;
}

describe("gateway validation and model discovery", () => {
  test("normalizes model URLs and classifies private IP ranges", () => {
    expect(sanitizeGatewayUrl("gateway.example.com/v1").href).toBe("https://gateway.example.com/v1/models");
    expect(isNonPublicAddress("127.0.0.1")).toBe(true);
    expect(isNonPublicAddress("10.2.3.4")).toBe(true);
    expect(isNonPublicAddress("169.254.1.1")).toBe(true);
    expect(isNonPublicAddress("::1")).toBe(true);
    expect(isNonPublicAddress("fc00::1")).toBe(true);
    expect(isNonPublicAddress("fe80::1")).toBe(true);
    expect(isNonPublicAddress("93.184.216.34")).toBe(false);
    expect(isNonPublicAddress("2606:4700:4700::1111")).toBe(false);
    expect(() => sanitizeGatewayUrl("http://gateway.example.com/v1")).toThrow(
      "Only HTTPS gateway URLs are supported.",
    );
    expect(() => sanitizeGatewayUrl("https://user:pass@gateway.example.com/v1")).toThrow(
      "Gateway URLs must not contain embedded credentials.",
    );
  });

  test("forwards authorization and returns sorted unique model names", async () => {
    let requestedUrl = "";
    let authorization = "";
    const handler = createRequestHandler({
      lookup: publicLookup,
      fetch: (async (input, init) => {
        requestedUrl = String(input);
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        return Response.json({
          data: [{ id: "z-model" }, { id: "a-model" }, { id: "a-model" }, { id: " " }],
        });
      }) as typeof fetch,
    });

    const response = await handler(new Request("http://local/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "https://gateway.example.com/v1", apiKey: "test-key" }),
    }));

    expect(response.status).toBe(200);
    expect(requestedUrl).toBe("https://gateway.example.com/v1/models");
    expect(authorization).toBe("Bearer test-key");
    expect(await response.json()).toEqual({ models: ["a-model", "z-model"] });
  });

  test("blocks hostnames that resolve privately before fetch", async () => {
    let fetched = false;
    const handler = createRequestHandler({
      lookup: async () => [{ address: "192.168.1.20", family: 4 }],
      fetch: (async () => {
        fetched = true;
        return Response.json({ data: [{ id: "unexpected" }] });
      }) as typeof fetch,
    });

    const response = await handler(new Request("http://local/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "https://internal.example/v1", apiKey: "test" }),
    }));

    expect(response.status).toBe(502);
    expect(fetched).toBe(false);
    expect(await response.json()).toEqual({
      error: "Gateway hostname resolves to a local or private network address.",
    });
  });

  test("rejects direct private URLs and cross-origin redirects", async () => {
    const handler = createRequestHandler({
      lookup: publicLookup,
      fetch: (async () => new Response(null, {
        status: 302,
        headers: { Location: "https://other.example/models" },
      })) as typeof fetch,
    });

    const privateResponse = await handler(new Request("http://local/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "http://127.0.0.1:8080/v1", apiKey: "test" }),
    }));
    expect(privateResponse.status).toBe(400);

    const redirectResponse = await handler(new Request("http://local/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "https://gateway.example/v1", apiKey: "test" }),
    }));
    expect(redirectResponse.status).toBe(502);
    expect(await redirectResponse.json()).toEqual({
      error: "Cross-origin gateway redirects are not allowed.",
    });
  });

  test("follows validated same-origin redirects and handles malformed payloads", async () => {
    const requested: string[] = [];
    const handler = createRequestHandler({
      lookup: publicLookup,
      fetch: (async (input) => {
        requested.push(String(input));
        if (requested.length === 1) {
          return new Response(null, { status: 307, headers: { Location: "/v2/models" } });
        }
        return Response.json({ data: [{ id: "redirected-model" }] });
      }) as typeof fetch,
    });

    const response = await handler(new Request("http://local/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "https://gateway.example/v1", apiKey: "test" }),
    }));
    expect(response.status).toBe(200);
    expect(requested).toEqual([
      "https://gateway.example/v1/models",
      "https://gateway.example/v2/models",
    ]);
    expect(await response.json()).toEqual({ models: ["redirected-model"] });

    const malformedHandler = createRequestHandler({
      lookup: publicLookup,
      fetch: (async () => Response.json({ data: { id: "not-an-array" } })) as typeof fetch,
    });
    const malformed = await malformedHandler(new Request("http://local/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: "https://gateway.example/v1" }),
    }));
    expect(malformed.status).toBe(502);
    expect(await malformed.json()).toEqual({ error: "The gateway returned no models." });
  });
});

describe("executable permanent configuration commands", () => {
  const hostileValues = {
    baseUrl: "https://gateway.example/v1?quote='&line=one\ntwo",
    apiKey: "key'\nEOF\n$(touch should-not-run)",
    model: "model'; touch injected-marker; #",
  };

  test("Claude command preserves settings, creates a backup, and safely handles hostile values", async () => {
    const home = await createTemporaryHome();
    const target = await writeHomeFile(home, ".claude/settings.json", JSON.stringify({
      theme: "dark",
      env: { KEEP: "yes" },
    }));

    await runUnixCommand(createSetupCommand("unix", { ...hostileValues, client: "claude" }), home);

    const config = JSON.parse(await readFile(target, "utf8"));
    expect(config.theme).toBe("dark");
    expect(config.env).toEqual({
      KEEP: "yes",
      ANTHROPIC_BASE_URL: hostileValues.baseUrl,
      ANTHROPIC_AUTH_TOKEN: hostileValues.apiKey,
      ANTHROPIC_MODEL: hostileValues.model,
    });
    expect(await readdir(join(home, ".claude"))).toContainEqual(
      expect.stringMatching(/^settings\.json\.bak-\d{8}-\d{6}$/),
    );
    expect(await Bun.file(join(home, "injected-marker")).exists()).toBe(false);
  });

  test("Codex command and restore command round-trip an existing config", async () => {
    const home = await createTemporaryHome();
    const original = { approvalMode: "manual", model: "old-model" };
    const target = await writeHomeFile(home, ".config/codex/config.json", JSON.stringify(original));

    await runUnixCommand(createSetupCommand("unix", { ...hostileValues, client: "codex" }), home);
    const updated = JSON.parse(await readFile(target, "utf8"));
    expect(updated.approvalMode).toBe("manual");
    expect(updated.model).toBe(hostileValues.model);

    await runUnixCommand(getRevertCommand("unix", "codex"), home);
    expect(JSON.parse(await readFile(target, "utf8"))).toEqual(original);
  });

  test("Aider command preserves unrelated YAML and quotes unsafe values", async () => {
    const home = await createTemporaryHome();
    const target = await writeHomeFile(home, ".aider.conf.yml", "dark-mode: true\nmodel: old-model\n");

    await runUnixCommand(createSetupCommand("unix", { ...hostileValues, client: "aider" }), home);

    const config = await readFile(target, "utf8");
    expect(config).toContain("dark-mode: true");
    expect(config).toContain(`openai-api-base: ${JSON.stringify(hostileValues.baseUrl)}`);
    expect(config).toContain(`openai-api-key: ${JSON.stringify(hostileValues.apiKey)}`);
    expect(config).toContain(`model: ${JSON.stringify(`openai/${hostileValues.model}`)}`);
    expect(config.match(/^model:/gm)).toHaveLength(1);
  });

  test("OpenCode command preserves provider settings and safely stores values", async () => {
    const home = await createTemporaryHome();
    const target = await writeHomeFile(home, ".config/opencode/opencode.json", JSON.stringify({
      provider: { openai: { timeout: 30 }, custom: { enabled: true } },
    }));

    await runUnixCommand(createSetupCommand("unix", { ...hostileValues, client: "opencode" }), home);

    const config = JSON.parse(await readFile(target, "utf8"));
    expect(config.model).toBe(hostileValues.model);
    expect(config.provider.openai).toEqual({
      timeout: 30,
      baseUrl: hostileValues.baseUrl,
      apiKey: hostileValues.apiKey,
    });
    expect(config.provider.custom).toEqual({ enabled: true });
  });

  test("Windows commands contain only encoded user values", () => {
    for (const client of ["claude", "codex", "aider", "opencode"]) {
      const command = createSetupCommand("windows", { ...hostileValues, client });
      expect(command).toContain("FromBase64String");
      expect(command).not.toContain(hostileValues.baseUrl);
      expect(command).not.toContain(hostileValues.apiKey);
      expect(command).not.toContain(hostileValues.model);
    }
  });
});

describe("config mappings and static routes", () => {
  test("defines paths for every supported client", () => {
    expect(configPaths.claude.unix).toBe("~/.claude/settings.json");
    expect(configPaths.codex.unix).toBe("~/.config/codex/config.json");
    expect(configPaths.aider.unix).toBe("~/.aider.conf.yml");
    expect(configPaths.opencode.unix).toBe("~/.config/opencode/opencode.json");
  });

  test("serves supported static files and rejects the old typo route", async () => {
    const handler = createRequestHandler();
    for (const page of ["/", "/index.html", "/docs", "/docs.html", "/styles.css", "/app.js", "/commands.js"]) {
      expect((await handler(new Request(`http://local${page}`))).status).toBe(200);
    }
    expect((await handler(new Request("http://local/dpcs"))).status).toBe(404);
  });
});
