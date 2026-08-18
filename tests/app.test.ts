import { afterAll, describe, expect, test } from "bun:test";
import {
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

describe("generated commands for Claude Code", () => {
  const values = {
    baseUrl: "https://9router.eminai.cloud/v1",
    apiKey: "sk-ant-test",
    model: "claude-3-7-sonnet",
    client: "claude",
  };

  test("generates Claude Code environment command on macOS/Linux", () => {
    const command = createSetupCommand("unix", values);

    expect(command).toBe(
      "export ANTHROPIC_BASE_URL='https://9router.eminai.cloud/v1' && export ANTHROPIC_AUTH_TOKEN='sk-ant-test' && claude --model 'claude-3-7-sonnet'",
    );
    expect(getRevertCommand("unix", "claude")).toBe(
      "unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN",
    );
  });

  test("generates Claude Code environment command on Windows", () => {
    const command = createSetupCommand("windows", values);

    expect(command).toBe(
      "$env:ANTHROPIC_BASE_URL = 'https://9router.eminai.cloud/v1'; $env:ANTHROPIC_AUTH_TOKEN = 'sk-ant-test'; claude --model 'claude-3-7-sonnet'",
    );
    expect(getRevertCommand("windows", "claude")).toBe(
      "Remove-Item env:ANTHROPIC_BASE_URL, env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue",
    );
  });
});

describe("generated commands for Codex CLI", () => {
  const values = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-openai-test",
    model: "gpt-4o",
    client: "codex",
  };

  test("generates Codex CLI environment command on macOS/Linux", () => {
    const command = createSetupCommand("unix", values);

    expect(command).toBe(
      "export OPENAI_BASE_URL='https://api.openai.com/v1' && export OPENAI_API_KEY='sk-openai-test' && codex --model 'gpt-4o'",
    );
    expect(getRevertCommand("unix", "codex")).toBe(
      "unset OPENAI_BASE_URL OPENAI_API_KEY",
    );
  });

  test("generates Codex CLI environment command on Windows", () => {
    const command = createSetupCommand("windows", values);

    expect(command).toBe(
      "$env:OPENAI_BASE_URL = 'https://api.openai.com/v1'; $env:OPENAI_API_KEY = 'sk-openai-test'; codex --model 'gpt-4o'",
    );
    expect(getRevertCommand("windows", "codex")).toBe(
      "Remove-Item env:OPENAI_BASE_URL, env:OPENAI_API_KEY -ErrorAction SilentlyContinue",
    );
  });
});

describe("generated commands for Aider", () => {
  const values = {
    baseUrl: "https://9router.eminai.cloud/v1",
    apiKey: "sk-aider-test",
    model: "cx/gpt-5.3-codex-spark",
    client: "aider",
  };

  test("generates Aider command with direct flags on macOS/Linux", () => {
    const command = createSetupCommand("unix", values);

    expect(command).toBe(
      "aider --openai-api-base 'https://9router.eminai.cloud/v1' --openai-api-key 'sk-aider-test' --model 'cx/gpt-5.3-codex-spark'",
    );
  });

  test("generates Aider command with direct flags on Windows", () => {
    const command = createSetupCommand("windows", values);

    expect(command).toBe(
      "aider --openai-api-base 'https://9router.eminai.cloud/v1' --openai-api-key 'sk-aider-test' --model 'cx/gpt-5.3-codex-spark'",
    );
  });
});

describe("generated commands for OpenCode", () => {
  const values = {
    baseUrl: "https://api.together.xyz/v1",
    apiKey: "sk-together-test",
    model: "meta-llama/llama-3.3-70b-instruct",
    client: "opencode",
  };

  test("generates OpenCode command on macOS/Linux", () => {
    const command = createSetupCommand("unix", values);

    expect(command).toBe(
      "export OPENAI_BASE_URL='https://api.together.xyz/v1' && export OPENAI_API_KEY='sk-together-test' && opencode --model 'meta-llama/llama-3.3-70b-instruct'",
    );
  });

  test("generates OpenCode command on Windows", () => {
    const command = createSetupCommand("windows", values);

    expect(command).toBe(
      "$env:OPENAI_BASE_URL = 'https://api.together.xyz/v1'; $env:OPENAI_API_KEY = 'sk-together-test'; opencode --model 'meta-llama/llama-3.3-70b-instruct'",
    );
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
