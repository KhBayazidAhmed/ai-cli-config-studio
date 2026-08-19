import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, readdir, rm, symlink, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  configPaths,
  createSetupCommand,
  createTemporaryCommand,
  getRevertCommand,
} from "../public/commands.js";
import {
  createRequestHandler,
  extractModelIds,
  isNonPublicAddress,
  sanitizeGatewayUrl,
} from "../server";

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

async function runUnixCommand(command: string, home: string, path = Bun.env.PATH) {
  const process = Bun.spawn(["/bin/sh", "-c", command], {
    env: { ...Bun.env, HOME: home, PATH: path },
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

async function writeExecutable(home: string, name: string, contents: string) {
  const target = await writeHomeFile(home, `system-bin/${name}`, contents);
  await chmod(target, 0o755);
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

  test("collects every model exposed by multi-provider gateway payloads", () => {
    expect(extractModelIds({
      providers: {
        openai: {
          models: [{ id: "gpt-5" }, { model: "o3" }],
        },
        anthropic: {
          data: ["claude-sonnet-4", { slug: "claude-opus-4" }],
        },
        google: {
          models: {
            "gemini-2.5-pro": { enabled: true },
            alias: { id: "gemini-2.5-flash" },
          },
        },
      },
      models: [{ name: "qwen3-coder" }, "deepseek-r1", { id: "gpt-5" }],
    })).toEqual([
      "claude-opus-4",
      "claude-sonnet-4",
      "deepseek-r1",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gpt-5",
      "o3",
      "qwen3-coder",
    ]);
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
    verify: false,
    launch: false,
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
      ANTHROPIC_BASE_URL: "https://gateway.example",
      ANTHROPIC_AUTH_TOKEN: hostileValues.apiKey,
      ANTHROPIC_MODEL: hostileValues.model,
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
    });
    expect(config.model).toBe(hostileValues.model);
    expect(await readdir(join(home, ".claude"))).toContainEqual(
      expect.stringMatching(/^settings\.json\.bak-\d{8}-\d{6}$/),
    );
    expect(await Bun.file(join(home, "injected-marker")).exists()).toBe(false);
  });

  test("Codex command and restore command round-trip an existing config", async () => {
    const home = await createTemporaryHome();
    const original = 'approval_policy = "on-request"\nmodel = "old-model"\n\n[features]\nweb_search = true\n';
    const target = await writeHomeFile(home, ".codex/config.toml", original);

    await runUnixCommand(createSetupCommand("unix", { ...hostileValues, client: "codex" }), home);
    const updated = await readFile(target, "utf8");
    expect(updated).toContain('approval_policy = "on-request"');
    expect(updated).toContain(`model = ${JSON.stringify(hostileValues.model)}`);
    expect(updated).toContain('model_provider = "config-studio"');
    expect(updated).toContain('[model_providers.config-studio]');
    expect(updated).toContain('base_url = "https://gateway.example/v1"');
    expect(updated).toContain(`experimental_bearer_token = ${JSON.stringify(hostileValues.apiKey)}`);
    expect(updated).toContain('[features]\nweb_search = true');

    await runUnixCommand(getRevertCommand("unix", "codex"), home);
    expect(await readFile(target, "utf8")).toBe(original);
  });

  test("Aider command preserves unrelated YAML and quotes unsafe values", async () => {
    const home = await createTemporaryHome();
    const target = await writeHomeFile(home, ".aider.conf.yml", "dark-mode: true\nmodel: old-model\n");

    await runUnixCommand(createSetupCommand("unix", { ...hostileValues, client: "aider" }), home);

    const config = await readFile(target, "utf8");
    expect(config).toContain("dark-mode: true");
    expect(config).toContain('openai-api-base: "https://gateway.example/v1"');
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
    expect(config.model).toBe(`config-studio/${hostileValues.model}`);
    expect(config.provider["config-studio"]).toEqual({
      npm: "@ai-sdk/openai-compatible",
      name: "Config Studio Gateway",
      options: {
        baseURL: "https://gateway.example/v1",
        apiKey: hostileValues.apiKey,
      },
      models: {
        [hostileValues.model]: { name: hostileValues.model },
      },
    });
    expect(config.provider.openai).toEqual({ timeout: 30 });
    expect(config.provider.custom).toEqual({ enabled: true });
  });

  test("Windows commands keep values readable and safely quoted", () => {
    for (const client of ["claude", "codex", "aider", "opencode"]) {
      const command = createSetupCommand("windows", { ...hostileValues, client });
      expect(command).not.toContain("FromBase64String");
      expect(command).toContain(
        client === "claude"
          ? "$baseUrl = 'https://gateway.example'"
          : "$baseUrl = 'https://gateway.example/v1'",
      );
      expect(command).toContain("$apiKey = 'key''");
      expect(command).toContain(
        client === "aider"
          ? "$model = 'openai/model''; touch injected-marker; #'"
          : "$model = 'model''; touch injected-marker; #'",
      );
    }
  });

  test("generated setup commands do not require Node or a package manager", () => {
    for (const client of ["claude", "codex", "aider", "opencode"]) {
      const values = { ...hostileValues, client };
      expect(createSetupCommand("unix", values)).not.toMatch(/\b(?:node|npx|bun)\b|npm\s+(?:install|exec)/);
      expect(createSetupCommand("windows", values)).not.toMatch(/\b(?:node|npx|bun)\b|npm\s+(?:install|exec)/);
      expect(createTemporaryCommand("unix", values)).not.toMatch(/\b(?:node|npx|bun)\b|npm\s+(?:install|exec)/);
      expect(createTemporaryCommand("windows", values)).not.toMatch(/\b(?:node|npx|bun)\b|npm\s+(?:install|exec)/);
    }
  });

  test("permanent and temporary commands open the selected CLI without sending a prompt", () => {
    const values = {
      baseUrl: "https://gateway.example/v1",
      apiKey: "secret",
      model: "test-model",
    };
    const claudePermanent = createSetupCommand("unix", { ...values, client: "claude" });
    const codexPermanent = createSetupCommand("unix", { ...values, client: "codex" });
    const opencodePermanent = createSetupCommand("unix", { ...values, client: "opencode" });
    expect(claudePermanent).toContain("claude --model 'test-model'");
    expect(codexPermanent).toContain("codex --model 'test-model'");
    expect(opencodePermanent).toContain("opencode --model 'config-studio/test-model'");
    expect(claudePermanent).not.toMatch(/claude\s+(?:-p|--print)/);
    expect(codexPermanent).not.toContain("codex exec");
    expect(opencodePermanent).not.toContain("opencode run");
    expect(createTemporaryCommand("windows", { ...values, client: "codex" })).toContain("codex --model $env:CODEX_MODEL");
    expect(createTemporaryCommand("windows", { ...values, client: "codex" })).not.toContain("codex exec");
    expect(createTemporaryCommand("unix", { ...values, client: "claude" })).toContain('--settings');
    expect(createTemporaryCommand("unix", { ...values, client: "claude" })).toContain('--model "$ANTHROPIC_MODEL"');
    expect(createTemporaryCommand("unix", { ...values, client: "codex" })).toContain('model_provider="config-studio"');
    expect(createTemporaryCommand("unix", { ...values, client: "opencode" })).toContain('opencode --model "$OPENCODE_MODEL"');
    expect(createTemporaryCommand("unix", { ...values, client: "claude" })).toContain("Temporary settings ready.");
    expect(createTemporaryCommand("unix", { ...values, client: "claude" })).not.toContain("[4/4] Configuration saved");
  });

  test("permanent Unix commands expose readable configuration values and steps", () => {
    const command = createSetupCommand("unix", {
      client: "claude",
      baseUrl: "https://gateway.example/v1",
      apiKey: "readable-secret",
      model: "test-model",
    });

    expect(command).toContain("export HC_BASE='https://gateway.example'");
    expect(command).toContain("export HC_KEY='readable-secret'");
    expect(command).toContain("export HC_MODEL='test-model'");
    expect(command).toContain("if command -v python3");
    expect(command).toContain("python3 <<'CONFIG_STUDIO_PY'");
    expect(command).not.toMatch(/[A-Za-z0-9+/]{200,}={0,2}/);
  });

  test("keeps temporary session commands readable and safely quoted", () => {
    const values = {
      baseUrl: "https://gateway.example/v1",
      apiKey: "key'$(touch should-not-run)",
      model: "cx/gpt-5.6-luna",
      client: "claude",
      launch: false,
    };
    const unix = createTemporaryCommand("unix", values);
    const windows = createTemporaryCommand("windows", values);

    expect(unix).toContain("export ANTHROPIC_BASE_URL='https://gateway.example'");
    expect(unix).toContain("export ANTHROPIC_MODEL='cx/gpt-5.6-luna'");
    expect(unix).toContain(`export ANTHROPIC_AUTH_TOKEN='key'"'"'$(touch should-not-run)'`);
    expect(windows).toContain("$env:ANTHROPIC_MODEL = 'cx/gpt-5.6-luna'");
    expect(windows).toContain("$env:ANTHROPIC_AUTH_TOKEN = 'key''$(touch should-not-run)'");
  });

  test("temporary commands pass effective runtime configuration to every CLI", async () => {
    const home = await createTemporaryHome();
    const bin = join(home, "system-bin");
    await mkdir(bin);
    const values = {
      baseUrl: "https://gateway.example/v1",
      apiKey: "secret",
      model: "cx/gpt-5.6-luna",
    };

    await writeExecutable(home, "claude", '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$HOME/claude-args"\n');
    await runUnixCommand(createTemporaryCommand("unix", { ...values, client: "claude" }), home, bin);
    const claudeArgs = (await readFile(join(home, "claude-args"), "utf8")).trim().split("\n");
    expect(claudeArgs[0]).toBe("--settings");
    expect(JSON.parse(claudeArgs[1])).toMatchObject({
      model: values.model,
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example",
        ANTHROPIC_AUTH_TOKEN: values.apiKey,
        ANTHROPIC_MODEL: values.model,
      },
    });
    expect(claudeArgs.slice(-2)).toEqual(["--model", values.model]);

    await writeExecutable(home, "codex", '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$HOME/codex-args"\n');
    await runUnixCommand(createTemporaryCommand("unix", { ...values, client: "codex" }), home, bin);
    const codexArgs = await readFile(join(home, "codex-args"), "utf8");
    expect(codexArgs).toContain('model_provider="config-studio"');
    expect(codexArgs).toContain('model_providers.config-studio.base_url="https://gateway.example/v1"');
    expect(codexArgs).toContain('model_providers.config-studio.env_key="OPENAI_API_KEY"');

    await writeExecutable(home, "opencode", '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$HOME/opencode-args"\nprintf \'%s\' "$OPENCODE_CONFIG_CONTENT" > "$HOME/opencode-config"\n');
    await runUnixCommand(createTemporaryCommand("unix", { ...values, client: "opencode" }), home, bin);
    const opencodeArgs = await readFile(join(home, "opencode-args"), "utf8");
    const opencodeConfig = JSON.parse(await readFile(join(home, "opencode-config"), "utf8"));
    expect(opencodeArgs).toContain(`config-studio/${values.model}`);
    expect(opencodeConfig.provider["config-studio"]).toMatchObject({
      npm: "@ai-sdk/openai-compatible",
      options: { baseURL: "https://gateway.example/v1", apiKey: values.apiKey },
      models: { [values.model]: { name: values.model } },
    });
  });

  test("uses the system Perl fallback when Python is unavailable", async () => {
    const home = await createTemporaryHome();
    const bin = join(home, "system-bin");
    await mkdir(bin);
    await Promise.all([
      symlink("/usr/bin/perl", join(bin, "perl")),
      symlink("/bin/mkdir", join(bin, "mkdir")),
      symlink("/bin/cp", join(bin, "cp")),
      symlink("/bin/date", join(bin, "date")),
    ]);
    const target = await writeHomeFile(home, ".codex/config.toml", 'approval_policy = "never"\n');

    await runUnixCommand(createSetupCommand("unix", {
      client: "codex",
      baseUrl: "https://gateway.example/v1",
      apiKey: "secret",
      model: "test-model",
      verify: false,
      launch: false,
    }), home, bin);

    const config = await readFile(target, "utf8");
    expect(config).toContain('approval_policy = "never"');
    expect(config).toContain('model_provider = "config-studio"');
    expect(config).toContain('[model_providers.config-studio]');
  });

  test("uses the built-in macOS JavaScript fallback when Python and Perl are unavailable", async () => {
    if (process.platform !== "darwin") return;

    const home = await createTemporaryHome();
    const bin = join(home, "system-bin");
    await mkdir(bin);
    await Promise.all([
      symlink("/usr/bin/uname", join(bin, "uname")),
      symlink("/bin/mkdir", join(bin, "mkdir")),
      symlink("/bin/cp", join(bin, "cp")),
      symlink("/bin/date", join(bin, "date")),
      symlink("/usr/bin/osascript", join(bin, "osascript")),
    ]);

    const target = await writeHomeFile(home, ".claude/settings.json", JSON.stringify({ theme: "dark" }));
    await runUnixCommand(createSetupCommand("unix", {
      client: "claude",
      baseUrl: "https://gateway.example/v1",
      apiKey: "secret",
      model: "test-model",
      verify: false,
      launch: false,
    }), home, bin);

    expect(JSON.parse(await readFile(target, "utf8"))).toEqual({
      theme: "dark",
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example",
        ANTHROPIC_AUTH_TOKEN: "secret",
        ANTHROPIC_MODEL: "test-model",
        CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
      },
      model: "test-model",
    });
  });

  test("installed Codex and OpenCode CLIs accept the generated permanent configs", async () => {
    const values = {
      baseUrl: "https://gateway.example/v1",
      apiKey: "secret",
      model: "cx/gpt-5.6-luna",
      verify: false,
      launch: false,
    };

    if (Bun.which("codex")) {
      const home = await createTemporaryHome();
      await runUnixCommand(createSetupCommand("unix", { ...values, client: "codex" }), home);
      const codex = Bun.spawn([Bun.which("codex")!, "--help"], {
        env: { ...Bun.env, HOME: home, CODEX_HOME: join(home, ".codex") },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [exitCode, stderr] = await Promise.all([
        codex.exited,
        new Response(codex.stderr).text(),
      ]);
      expect(stderr).not.toContain("Failed to load config");
      expect(exitCode).toBe(0);
    }

    if (Bun.which("opencode")) {
      const home = await createTemporaryHome();
      await runUnixCommand(createSetupCommand("unix", { ...values, client: "opencode" }), home);
      const opencode = Bun.spawn([Bun.which("opencode")!, "debug", "config"], {
        env: { ...Bun.env, HOME: home },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [exitCode, stdout, stderr] = await Promise.all([
        opencode.exited,
        new Response(opencode.stdout).text(),
        new Response(opencode.stderr).text(),
      ]);
      expect(stderr).toBe("");
      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toMatchObject({
        model: `config-studio/${values.model}`,
        provider: {
          "config-studio": {
            npm: "@ai-sdk/openai-compatible",
            options: { baseURL: values.baseUrl, apiKey: values.apiKey },
          },
        },
      });
    }
  });
});

describe("config mappings and static routes", () => {
  test("defines paths for every supported client", () => {
    expect(configPaths.claude.unix).toBe("~/.claude/settings.json");
    expect(configPaths.codex.unix).toBe("~/.codex/config.toml");
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
