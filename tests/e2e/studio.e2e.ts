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
  await expect(page.locator('input[name="client"][value="aider"]')).toHaveCount(0);
  await expect(page.locator('#step-2-panel input[name="platform"]')).toHaveCount(0);
  await expect(page.locator('#step-3-panel input[name="platform"]')).toHaveCount(2);

  const modelPosition = await page.locator(".preference-model-field").boundingBox();
  const clientPosition = await page.locator(".client-grid").boundingBox();
  expect(modelPosition?.y).toBeLessThan(clientPosition?.y ?? 0);
});

test("keeps an open restore accordion inside the responsive output column", async ({ page }) => {
  await page.setViewportSize({ width: 1003, height: 900 });
  await page.goto("/");
  await page.locator("#revert-panel summary").click();

  const layout = await page.evaluate(() => {
    const panel = document.querySelector("#revert-panel")?.getBoundingClientRect();
    const output = document.querySelector(".output-column")?.getBoundingClientRect();

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      panelWidth: panel?.width ?? 0,
      outputWidth: output?.width ?? 0,
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.panelWidth).toBeLessThanOrEqual(layout.outputWidth + 1);
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

test("persists form values and loaded models across reloads", async ({ page }) => {
  await loadModels(page, "sk-persisted-secret");
  await page.locator('label:has(input[name="client"][value="codex"])').click();
  await page.locator('label:has(input[name="platform"][value="windows"])').click();
  await page.locator("#models").selectOption("qwen/qwen3-coder");

  await page.reload();

  await expect(page.getByLabel("Base URL")).toHaveValue("https://9router.eminai.cloud/v1");
  await expect(page.getByLabel("API Key")).toHaveValue("sk-persisted-secret");
  await expect(page.locator('input[name="client"][value="codex"]')).toBeChecked();
  await expect(page.locator('input[name="platform"][value="windows"]')).toBeChecked();
  await expect(page.locator("#models")).toHaveValue("qwen/qwen3-coder");
  await expect(page.locator("#models")).toBeEnabled();
  await expect(page.locator("#copy-command")).toBeEnabled();
});

test("shows a simple model select grouped by capability", async ({ page }) => {
  await loadModels(page);

  await expect(page.locator('#models optgroup[label="Creative & Strategy"]')).toHaveCount(1);
  await expect(page.locator('#models optgroup[label="Fast Everyday Work"]')).toHaveCount(1);
  await expect(page.locator('#models optgroup[label="Product & Technical"]')).toHaveCount(1);

  await page.locator("#models").selectOption("qwen/qwen3-coder");
  await expect(page.locator("#models")).toHaveValue("qwen/qwen3-coder");
  await expect(page.locator("#summary-model")).toHaveText("qwen/qwen3-coder");
});

test("switches between temporary and permanent commands", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await loadModels(page, "sk-temporary-secret");

  await page.locator("#config-mode-toggle").uncheck();
  await expect(page.locator("#security-banner-text")).toContainText("Temporary Configuration");
  await expect(page.locator("#security-banner-text")).toContainText("No configuration files are changed");
  await expect(page.locator("#revert-panel")).toBeHidden();
  await expect(page.locator("#command")).toContainText("export ANTHROPIC_BASE_URL");
  await expect(page.locator("#command")).not.toContainText("settings.json");

  await page.locator("#copy-command").click();
  const temporaryCommand = await page.evaluate(() => navigator.clipboard.readText());
  const selectedModel = await page.locator("#models").inputValue();
  expect(temporaryCommand).toContain("export ANTHROPIC_AUTH_TOKEN='sk-temporary-secret'");
  expect(temporaryCommand).toContain(`export ANTHROPIC_MODEL='${selectedModel}'`);
  expect(temporaryCommand).toContain('--settings');
  expect(temporaryCommand).toContain('--model "$ANTHROPIC_MODEL"');
  expect(temporaryCommand).not.toContain("claude -p");

  await page.locator('label:has(input[name="platform"][value="windows"])').click();
  await expect(page.locator("#command")).toContainText("$env:ANTHROPIC_BASE_URL");

  await page.locator("#config-mode-toggle").check();
  await expect(page.locator("#security-banner-text")).toContainText("Permanent Configuration");
  await expect(page.locator("#revert-panel")).toBeVisible();
  await expect(page.locator("#command")).toContainText("settings.json");
  await expect(page.locator("#command")).toContainText("[4/4] Configuration saved");
  await expect(page.locator("#command")).toContainText("claude --model");
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
    { client: "codex", label: "Codex CLI", command: ".codex/config.toml" },
    { client: "opencode", label: "OpenCode", command: ".config/opencode/opencode.json" },
  ];

  for (const item of cases) {
    await page.locator(`label:has(input[name="client"][value="${item.client}"])`).click();
    await expect(page.locator("#summary-client")).toHaveText(item.label);
    await expect(page.locator("#client-choice-name")).toHaveText(`${item.label} selected`);
    await expect(page.locator("#client-config-path")).toContainText(item.command);
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
  expect(setupCommand).toContain("export HC_KEY='sk-e2e-secret'");
  expect(setupCommand).toContain("export HC_MODEL='cx/gpt-5.6-sol'");
  expect(setupCommand).toContain("[4/4] Configuration saved");
  expect(setupCommand).toContain("claude --model 'cx/gpt-5.6-sol'");
  expect(setupCommand).not.toContain("claude -p");

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
