import { expect, test, type Page } from "@playwright/test";

async function loadModels(page: Page, apiKey = "sk-e2e-secret") {
  await page.goto("/");
  await page.getByLabel("API Key").fill(apiKey);
  await page.getByRole("button", { name: "Fetch Models" }).click();
  await expect(page.locator("#model-status")).toHaveText("3 models loaded successfully.");
}

test("loads the studio in its safe initial state", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/AI CLI Config Studio/);
  await expect(page.getByRole("heading", { name: "Configure AI Coding CLIs" })).toBeVisible();
  await expect(page.locator("#models")).toBeDisabled();
  await expect(page.locator("#copy-command")).toBeDisabled();
  await expect(page.locator("#command")).toContainText("Connect provider");
  await expect(page.locator("#summary-client")).toHaveText("Claude Code");
  await expect(page.locator("#summary-platform")).toHaveText("macOS / Linux");
});

test("provider presets and API-key visibility controls work", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "OpenRouter" }).click();
  await expect(page.getByLabel("Base URL")).toHaveValue("https://openrouter.ai/api/v1");
  await expect(page.getByRole("button", { name: "OpenRouter" })).toHaveClass(/active/);

  const apiKey = page.getByLabel("API Key");
  await apiKey.fill("sk-visible-check");
  await expect(apiKey).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Toggle password visibility" }).click();
  await expect(apiKey).toHaveAttribute("type", "text");
  await expect(page.locator("#toggle-key .toggle-text")).toHaveText("Hide");
});

test("discovers models and generates masked command previews for every client", async ({ page }) => {
  await loadModels(page);

  await expect(page.locator("#models")).toBeEnabled();
  await expect(page.locator("#models option")).toHaveCount(3);
  await expect(page.locator("#model-count-hint")).toHaveText("3 models available");
  await expect(page.locator("#ready-state .badge-text")).toHaveText("Ready");
  await expect(page.locator("#command")).toContainText("ANTHROPIC_AUTH_TOKEN");
  await expect(page.locator("#command")).not.toContainText("sk-e2e-secret");

  const cases = [
    { client: "codex", label: "Codex CLI", command: ".config/codex/config.json" },
    { client: "aider", label: "Aider", command: ".aider.conf.yml" },
    { client: "opencode", label: "OpenCode", command: ".config/opencode/opencode.json" },
  ];

  for (const item of cases) {
    await page.locator(`label:has(input[name="client"][value="${item.client}"])`).click();
    await expect(page.locator("#summary-client")).toHaveText(item.label);
    await expect(page.locator("#command")).toContainText(item.command);
    await expect(page.locator("#revert-command")).toContainText(item.command);
  }

  await page.locator('label:has(input[name="platform"][value="windows"])').click();
  await expect(page.locator("#terminal-title")).toHaveText("PowerShell");
  await expect(page.locator("#summary-platform")).toHaveText("Windows");
  await expect(page.locator("#command")).toContainText("Join-Path $HOME");
});

test("copies the real setup and restore commands", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await loadModels(page);

  await page.locator("#copy-command").click();
  await expect(page.locator("#copy-command .copy-btn-text")).toHaveText("Copied to Clipboard");
  const setupCommand = await page.evaluate(() => navigator.clipboard.readText());
  expect(setupCommand).not.toContain("sk-e2e-secret");
  expect(setupCommand).toContain(Buffer.from("sk-e2e-secret").toString("base64"));
  expect(setupCommand).toContain(Buffer.from("cx/gpt-5.6-sol").toString("base64"));

  await page.locator("details").first().locator("summary").click();
  await page.locator("#copy-revert").click();
  await expect(page.locator("#copy-revert-text")).toHaveText("Restore Command Copied");
  const restoreCommand = await page.evaluate(() => navigator.clipboard.readText());
  expect(restoreCommand).toContain("settings.json.bak-*");
});

test("shows gateway failures and invalidates stale models when credentials change", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("API Key").fill("bad-key");
  await page.getByRole("button", { name: "Fetch Models" }).click();

  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "error");
  await expect(page.locator("#model-status")).toHaveText("Gateway returned 401: Invalid API key");
  await expect(page.locator("#models")).toBeDisabled();

  await page.getByLabel("API Key").fill("working-key");
  await page.getByRole("button", { name: "Fetch Models" }).click();
  await expect(page.locator("#models")).toBeEnabled();

  await page.getByLabel("API Key").fill("changed-key");
  await expect(page.locator("#models")).toBeDisabled();
  await expect(page.locator("#model-status")).toHaveText("Credentials changed. Fetch models to update.");
  await expect(page.locator("#copy-command")).toBeDisabled();
});

test("serves documentation and rejects unknown or unsafe API requests", async ({ page, request }) => {
  await page.goto("/docs");
  await expect(page).toHaveTitle(/Documentation/);
  await expect(page.getByRole("heading", { name: /User Guide & Documentation/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Studio", exact: true })).toHaveAttribute("href", "/");

  const unsafe = await request.post("/api/models", {
    data: { baseUrl: "https://127.0.0.1:9000/v1", apiKey: "test" },
  });
  expect(unsafe.status()).toBe(400);
  expect(await unsafe.json()).toEqual({
    error: "Local and private network gateway URLs are not allowed.",
  });

  const missing = await request.get("/missing-page");
  expect(missing.status()).toBe(404);
});
