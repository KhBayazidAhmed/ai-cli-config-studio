/**
 * AI CLI Config Studio - Terminal Command Generators
 * Generates platform-specific setup and rollback commands that safely merge
 * configurations directly into client config files with timestamped backups.
 */

// ============================================================================
// 1. Claude Code (~/.claude/settings.json)
// ============================================================================

function claudeUnixCommand({ baseUrl, apiKey, model }) {
  const safeBaseUrl = JSON.stringify(baseUrl);
  const safeApiKey = JSON.stringify(apiKey);
  const safeModel = JSON.stringify(model);

  return `mkdir -p "$HOME/.claude" && if [ -f "$HOME/.claude/settings.json" ]; then cp "$HOME/.claude/settings.json" "$HOME/.claude/settings.json.bak-$(date +%Y%m%d-%H%M%S)"; fi && node -e '
const fs = require("fs"), p = require("path").join(process.env.HOME || "", ".claude/settings.json");
let c = {}; try { c = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
c.env = Object.assign({}, c.env, {
  ANTHROPIC_BASE_URL: ${safeBaseUrl},
  ANTHROPIC_AUTH_TOKEN: ${safeApiKey},
  ANTHROPIC_MODEL: ${safeModel}
});
fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\\n");
'`;
}

function claudeWindowsCommand({ baseUrl, apiKey, model }) {
  const psBaseUrl = baseUrl.replaceAll("'", "''");
  const psApiKey = apiKey.replaceAll("'", "''");
  const psModel = model.replaceAll("'", "''");

  return `$configDir = Join-Path $HOME '.claude'; $config = Join-Path $configDir 'settings.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; $data = [PSCustomObject]@{}; if (Test-Path $config) { try { $data = Get-Content $config -Raw | ConvertFrom-Json } catch {} }; if (-not ($data.PSObject.Properties['env'])) { $data | Add-Member -MemberType NoteProperty -Name 'env' -Value ([PSCustomObject]@{}) -Force }; $data.env | Add-Member -MemberType NoteProperty -Name 'ANTHROPIC_BASE_URL' -Value '${psBaseUrl}' -Force; $data.env | Add-Member -MemberType NoteProperty -Name 'ANTHROPIC_AUTH_TOKEN' -Value '${psApiKey}' -Force; $data.env | Add-Member -MemberType NoteProperty -Name 'ANTHROPIC_MODEL' -Value '${psModel}' -Force; $data | ConvertTo-Json -Depth 10 | Set-Content -Path $config -Encoding UTF8`;
}

// ============================================================================
// 2. Codex CLI (~/.config/codex/config.json)
// ============================================================================

function codexUnixCommand({ baseUrl, apiKey, model }) {
  const safeBaseUrl = JSON.stringify(baseUrl);
  const safeApiKey = JSON.stringify(apiKey);
  const safeModel = JSON.stringify(model);

  return `mkdir -p "$HOME/.config/codex" && if [ -f "$HOME/.config/codex/config.json" ]; then cp "$HOME/.config/codex/config.json" "$HOME/.config/codex/config.json.bak-$(date +%Y%m%d-%H%M%S)"; fi && node -e '
const fs = require("fs"), p = require("path").join(process.env.HOME || "", ".config/codex/config.json");
let c = {}; try { c = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
Object.assign(c, {
  baseUrl: ${safeBaseUrl},
  apiKey: ${safeApiKey},
  model: ${safeModel}
});
fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\\n");
'`;
}

function codexWindowsCommand({ baseUrl, apiKey, model }) {
  const psBaseUrl = baseUrl.replaceAll("'", "''");
  const psApiKey = apiKey.replaceAll("'", "''");
  const psModel = model.replaceAll("'", "''");

  return `$configDir = Join-Path $HOME '.config\\codex'; $config = Join-Path $configDir 'config.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; $data = [PSCustomObject]@{}; if (Test-Path $config) { try { $data = Get-Content $config -Raw | ConvertFrom-Json } catch {} }; $data | Add-Member -MemberType NoteProperty -Name 'baseUrl' -Value '${psBaseUrl}' -Force; $data | Add-Member -MemberType NoteProperty -Name 'apiKey' -Value '${psApiKey}' -Force; $data | Add-Member -MemberType NoteProperty -Name 'model' -Value '${psModel}' -Force; $data | ConvertTo-Json -Depth 10 | Set-Content -Path $config -Encoding UTF8`;
}

// ============================================================================
// 3. Aider (~/.aider.conf.yml)
// ============================================================================

function aiderUnixCommand({ baseUrl, apiKey, model }) {
  const modelName = model.startsWith("openai/") ? model : `openai/${model}`;
  const yamlContent = `openai-api-base: ${baseUrl}\nopenai-api-key: ${apiKey}\nmodel: ${modelName}`;

  return `if [ -f "$HOME/.aider.conf.yml" ]; then cp "$HOME/.aider.conf.yml" "$HOME/.aider.conf.yml.bak-$(date +%Y%m%d-%H%M%S)"; grep -v -E '^(openai-api-base|openai-api-key|model):' "$HOME/.aider.conf.yml" > "$HOME/.aider.conf.yml.tmp" 2>/dev/null && mv "$HOME/.aider.conf.yml.tmp" "$HOME/.aider.conf.yml"; fi && cat << 'EOF' >> "$HOME/.aider.conf.yml"\n${yamlContent}\nEOF`;
}

function aiderWindowsCommand({ baseUrl, apiKey, model }) {
  const modelName = model.startsWith("openai/") ? model : `openai/${model}`;
  const yamlContent = `openai-api-base: ${baseUrl}\nopenai-api-key: ${apiKey}\nmodel: ${modelName}`;

  return `$config = Join-Path $HOME '.aider.conf.yml'; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"; (Get-Content $config | Where-Object { $_ -notmatch '^(openai-api-base|openai-api-key|model):' }) | Set-Content $config -Encoding UTF8 }; Add-Content -Path $config -Value @'\n${yamlContent}\n'@ -Encoding UTF8`;
}

// ============================================================================
// 4. OpenCode (~/.config/opencode/opencode.json)
// ============================================================================

function opencodeUnixCommand({ baseUrl, apiKey, model }) {
  const safeBaseUrl = JSON.stringify(baseUrl);
  const safeApiKey = JSON.stringify(apiKey);
  const safeModel = JSON.stringify(model);

  return `mkdir -p "$HOME/.config/opencode" && if [ -f "$HOME/.config/opencode/opencode.json" ]; then cp "$HOME/.config/opencode/opencode.json" "$HOME/.config/opencode/opencode.json.bak-$(date +%Y%m%d-%H%M%S)"; fi && node -e '
const fs = require("fs"), p = require("path").join(process.env.HOME || "", ".config/opencode/opencode.json");
let c = {}; try { c = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
c.model = ${safeModel};
c.provider = Object.assign({}, c.provider, {
  openai: Object.assign({}, c.provider && c.provider.openai, {
    baseUrl: ${safeBaseUrl},
    apiKey: ${safeApiKey}
  })
});
fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\\n");
'`;
}

function opencodeWindowsCommand({ baseUrl, apiKey, model }) {
  const psBaseUrl = baseUrl.replaceAll("'", "''");
  const psApiKey = apiKey.replaceAll("'", "''");
  const psModel = model.replaceAll("'", "''");

  return `$configDir = Join-Path $HOME '.config\\opencode'; $config = Join-Path $configDir 'opencode.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; $data = [PSCustomObject]@{}; if (Test-Path $config) { try { $data = Get-Content $config -Raw | ConvertFrom-Json } catch {} }; $data | Add-Member -MemberType NoteProperty -Name 'model' -Value '${psModel}' -Force; if (-not ($data.PSObject.Properties['provider'])) { $data | Add-Member -MemberType NoteProperty -Name 'provider' -Value ([PSCustomObject]@{}) -Force }; if (-not ($data.provider.PSObject.Properties['openai'])) { $data.provider | Add-Member -MemberType NoteProperty -Name 'openai' -Value ([PSCustomObject]@{}) -Force }; $data.provider.openai | Add-Member -MemberType NoteProperty -Name 'baseUrl' -Value '${psBaseUrl}' -Force; $data.provider.openai | Add-Member -MemberType NoteProperty -Name 'apiKey' -Value '${psApiKey}' -Force; $data | ConvertTo-Json -Depth 10 | Set-Content -Path $config -Encoding UTF8`;
}

// ============================================================================
// Factory & Path Registries
// ============================================================================

/**
 * Creates the setup command based on the target platform and client.
 */
export function createSetupCommand(platform, values = {}) {
  const client = values.client || "claude";
  const isWindows = platform === "windows";

  switch (client) {
    case "claude":
      return isWindows ? claudeWindowsCommand(values) : claudeUnixCommand(values);
    case "codex":
      return isWindows ? codexWindowsCommand(values) : codexUnixCommand(values);
    case "aider":
      return isWindows ? aiderWindowsCommand(values) : aiderUnixCommand(values);
    case "opencode":
      return isWindows ? opencodeWindowsCommand(values) : opencodeUnixCommand(values);
    default:
      return isWindows ? claudeWindowsCommand(values) : claudeUnixCommand(values);
  }
}

/**
 * File path mappings for each supported client across OS platforms.
 */
export const configPaths = {
  claude: {
    unix: "~/.claude/settings.json",
    windows: "$HOME\\.claude\\settings.json",
  },
  codex: {
    unix: "~/.config/codex/config.json",
    windows: "$HOME\\.config\\codex\\config.json",
  },
  aider: {
    unix: "~/.aider.conf.yml",
    windows: "$HOME\\.aider.conf.yml",
  },
  opencode: {
    unix: "~/.config/opencode/opencode.json",
    windows: "$HOME\\.config\\opencode\\opencode.json",
  },
};

/**
 * Rollback commands to restore the latest backup for each client.
 */
export const revertCommands = {
  claude: {
    unix:
      'latest=$(ls -t "$HOME"/.claude/settings.json.bak-* 2>/dev/null | head -n 1) && [ -n "$latest" ] && cp "$latest" "$HOME/.claude/settings.json"',
    windows:
      "$config = Join-Path $HOME '.claude\\settings.json'; $latest = Get-ChildItem \"$config.bak-*\" | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($latest) { Copy-Item $latest.FullName $config -Force }",
  },
  codex: {
    unix:
      'latest=$(ls -t "$HOME"/.config/codex/config.json.bak-* 2>/dev/null | head -n 1) && [ -n "$latest" ] && cp "$latest" "$HOME/.config/codex/config.json"',
    windows:
      "$config = Join-Path $HOME '.config\\codex\\config.json'; $latest = Get-ChildItem \"$config.bak-*\" | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($latest) { Copy-Item $latest.FullName $config -Force }",
  },
  aider: {
    unix:
      'latest=$(ls -t "$HOME"/.aider.conf.yml.bak-* 2>/dev/null | head -n 1) && [ -n "$latest" ] && cp "$latest" "$HOME/.aider.conf.yml"',
    windows:
      "$config = Join-Path $HOME '.aider.conf.yml'; $latest = Get-ChildItem \"$config.bak-*\" | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($latest) { Copy-Item $latest.FullName $config -Force }",
  },
  opencode: {
    unix:
      'latest=$(ls -t "$HOME"/.config/opencode/opencode.json.bak-* 2>/dev/null | head -n 1) && [ -n "$latest" ] && cp "$latest" "$HOME/.config/opencode/opencode.json"',
    windows:
      "$config = Join-Path $HOME '.config\\opencode\\opencode.json'; $latest = Get-ChildItem \"$config.bak-*\" | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($latest) { Copy-Item $latest.FullName $config -Force }",
  },
  // Backward compatibility fallback
  unix:
    'latest=$(ls -t "$HOME"/.claude/settings.json.bak-* 2>/dev/null | head -n 1) && [ -n "$latest" ] && cp "$latest" "$HOME/.claude/settings.json"',
  windows:
    "$config = Join-Path $HOME '.claude\\settings.json'; $latest = Get-ChildItem \"$config.bak-*\" | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($latest) { Copy-Item $latest.FullName $config -Force }",
};

/**
 * Retrieves the rollback command for a given platform and client.
 */
export function getRevertCommand(platform, client = "claude") {
  const target = revertCommands[client] || revertCommands.claude;
  return target[platform] || "";
}
