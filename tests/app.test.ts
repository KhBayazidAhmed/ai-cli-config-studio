import { afterAll, describe, expect, test } from "bun:test";
import {
  configPaths,
  createSetupCommand,
  getRevertCommand,
} from "../public/commands.js";
import { handleRequest } from "../server";

const originalFetch = globalThis.fetch;

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe("model discovery", () => {
  test("returns sorted, unique model names", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        Response.json({
          data: [{ id: "z-model" }, { id: "a-model" }, { id: "a-model" }],
        }),
      )) as typeof fetch;

    const response = await handleRequest(
      new Request("http://local/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: "https://api.9router.com/v1",
          apiKey: "test-key",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: ["a-model", "z-model"] });
  });

  test("accepts any public compatible gateway", async () => {
    const response = await handleRequest(
      new Request("http://local/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: "https://gateway.example.com/v1",
          apiKey: "test-key",
        }),
      }),
    );

    expect(response.status).toBe(200);
  });

  test("rejects local and private gateway URLs", async () => {
    const response = await handleRequest(
      new Request("http://local/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: "http://127.0.0.1:8080/v1",
          apiKey: "test-key",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Local and private network gateway URLs are not allowed.",
    });
  });
});

describe("permanent configuration for Claude Code", () => {
  const values = {
    baseUrl: "https://9router.eminai.cloud/v1",
    apiKey: "sk-ant-test",
    model: "claude-3-7-sonnet",
    client: "claude",
  };

  test("generates permanent backup & settings.json write on macOS/Linux", () => {
    const command = createSetupCommand("unix", values);

    expect(command).toContain('mkdir -p "$HOME/.claude"');
    expect(command).toContain("settings.json.bak-$(date");
    expect(command).toContain('cat << \'EOF\' > "$HOME/.claude/settings.json"');
    expect(command).toContain('"ANTHROPIC_BASE_URL": "https://9router.eminai.cloud/v1"');
    expect(command).toContain('"ANTHROPIC_AUTH_TOKEN": "sk-ant-test"');
    expect(command).toContain('"ANTHROPIC_MODEL": "claude-3-7-sonnet"');

    const revert = getRevertCommand("unix", "claude");
    expect(revert).toContain('settings.json.bak-*');
    expect(revert).toContain('cp "$latest" "$HOME/.claude/settings.json"');
  });

  test("generates permanent backup & settings.json write on Windows", () => {
    const command = createSetupCommand("windows", values);

    expect(command).toContain("Join-Path $HOME '.claude'");
    expect(command).toContain('"$config.bak-$(Get-Date');
    expect(command).toContain("Set-Content -Path $config -Encoding UTF8");
    expect(command).toContain('"ANTHROPIC_BASE_URL": "https://9router.eminai.cloud/v1"');

    const revert = getRevertCommand("windows", "claude");
    expect(revert).toContain('"$config.bak-*"');
    expect(revert).toContain("Copy-Item $latest.FullName $config -Force");
  });
});

describe("permanent configuration for Codex CLI", () => {
  const values = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-openai-test",
    model: "gpt-4o",
    client: "codex",
  };

  test("generates permanent backup & config.json write on macOS/Linux", () => {
    const command = createSetupCommand("unix", values);

    expect(command).toContain('mkdir -p "$HOME/.config/codex"');
    expect(command).toContain("config.json.bak-$(date");
    expect(command).toContain('"baseUrl": "https://api.openai.com/v1"');
    expect(command).toContain('"apiKey": "sk-openai-test"');
    expect(command).toContain('"model": "gpt-4o"');

    const revert = getRevertCommand("unix", "codex");
    expect(revert).toContain('config.json.bak-*');
  });

  test("generates permanent backup & config.json write on Windows", () => {
    const command = createSetupCommand("windows", values);

    expect(command).toContain("Join-Path $HOME '.config\\codex'");
    expect(command).toContain('"$config.bak-$(Get-Date');
    expect(command).toContain("Set-Content -Path $config -Encoding UTF8");

    const revert = getRevertCommand("windows", "codex");
    expect(revert).toContain("Copy-Item $latest.FullName $config -Force");
  });
});

describe("permanent configuration for Aider", () => {
  const values = {
    baseUrl: "https://9router.eminai.cloud/v1",
    apiKey: "sk-aider-test",
    model: "cx/gpt-5.3-codex-spark",
    client: "aider",
  };

  test("generates permanent backup & .aider.conf.yml write on macOS/Linux", () => {
    const command = createSetupCommand("unix", values);

    expect(command).toContain(".aider.conf.yml.bak-$(date");
    expect(command).toContain('cat << \'EOF\' > "$HOME/.aider.conf.yml"');
    expect(command).toContain("openai-api-base: https://9router.eminai.cloud/v1");
    expect(command).toContain("openai-api-key: sk-aider-test");
    expect(command).toContain("model: openai/cx/gpt-5.3-codex-spark");

    const revert = getRevertCommand("unix", "aider");
    expect(revert).toContain('.aider.conf.yml.bak-*');
  });

  test("generates permanent backup & .aider.conf.yml write on Windows", () => {
    const command = createSetupCommand("windows", values);

    expect(command).toContain("Join-Path $HOME '.aider.conf.yml'");
    expect(command).toContain('"$config.bak-$(Get-Date');
    expect(command).toContain("Set-Content -Path $config -Encoding UTF8");

    const revert = getRevertCommand("windows", "aider");
    expect(revert).toContain("Copy-Item $latest.FullName $config -Force");
  });
});

describe("permanent configuration for OpenCode", () => {
  const values = {
    baseUrl: "https://api.together.xyz/v1",
    apiKey: "sk-together-test",
    model: "meta-llama/llama-3.3-70b-instruct",
    client: "opencode",
  };

  test("generates permanent backup & opencode.json write on macOS/Linux", () => {
    const command = createSetupCommand("unix", values);

    expect(command).toContain('mkdir -p "$HOME/.config/opencode"');
    expect(command).toContain("opencode.json.bak-$(date");
    expect(command).toContain('"baseUrl": "https://api.together.xyz/v1"');
    expect(command).toContain('"apiKey": "sk-together-test"');

    const revert = getRevertCommand("unix", "opencode");
    expect(revert).toContain('opencode.json.bak-*');
  });

  test("generates permanent backup & opencode.json write on Windows", () => {
    const command = createSetupCommand("windows", values);

    expect(command).toContain("Join-Path $HOME '.config\\opencode'");
    expect(command).toContain('"$config.bak-$(Get-Date');
    expect(command).toContain("Set-Content -Path $config -Encoding UTF8");

    const revert = getRevertCommand("windows", "opencode");
    expect(revert).toContain("Copy-Item $latest.FullName $config -Force");
  });
});

describe("configPaths mapping", () => {
  test("defines paths for all supported clients", () => {
    expect(configPaths.claude.unix).toBe("~/.claude/settings.json");
    expect(configPaths.codex.unix).toBe("~/.config/codex/config.json");
    expect(configPaths.aider.unix).toBe("~/.aider.conf.yml");
    expect(configPaths.opencode.unix).toBe("~/.config/opencode/opencode.json");
  });
});

describe("static files", () => {
  test("serves index.html, styles.css, app.js, commands.js", async () => {
    const pages = ["/", "/styles.css", "/app.js", "/commands.js"];
    for (const page of pages) {
      const response = await handleRequest(new Request(`http://local${page}`));
      expect(response.status).toBe(200);
    }
  });
});
