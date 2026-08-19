/**
 * AI CLI Config Studio - Terminal Command Generators
 * Generates platform-specific setup and rollback commands that safely merge
 * configurations directly into client config files with timestamped backups.
 */

// ============================================================================
// 1. Claude Code (~/.claude/settings.json)
// ============================================================================

function encodeValue(value = "") {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function unixValueDeclarations({ baseUrl = "", apiKey = "", model = "" }) {
  return `const decode = (value) => Buffer.from(value, "base64").toString("utf8");
const baseUrl = decode("${encodeValue(baseUrl)}");
const apiKey = decode("${encodeValue(apiKey)}");
const model = decode("${encodeValue(model)}");`;
}

function powershellValueDeclarations({ baseUrl = "", apiKey = "", model = "" }) {
  const decode = (value) =>
    `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodeValue(value)}'))`;

  return `$baseUrl = ${decode(baseUrl)}; $apiKey = ${decode(apiKey)}; $model = ${decode(model)}`;
}

function claudeUnixCommand({ baseUrl, apiKey, model }) {
  return `mkdir -p "$HOME/.claude" && if [ -f "$HOME/.claude/settings.json" ]; then cp "$HOME/.claude/settings.json" "$HOME/.claude/settings.json.bak-$(date +%Y%m%d-%H%M%S)"; fi && node -e '
${unixValueDeclarations({ baseUrl, apiKey, model })}
const fs = require("fs"), p = require("path").join(process.env.HOME || "", ".claude/settings.json");
let c = {}; try { c = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
c.env = Object.assign({}, c.env, {
  ANTHROPIC_BASE_URL: baseUrl,
  ANTHROPIC_AUTH_TOKEN: apiKey,
  ANTHROPIC_MODEL: model
});
fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\\n");
'`;
}

function claudeWindowsCommand({ baseUrl, apiKey, model }) {
  return `${powershellValueDeclarations({ baseUrl, apiKey, model })}; $configDir = Join-Path $HOME '.claude'; $config = Join-Path $configDir 'settings.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; $data = [PSCustomObject]@{}; if (Test-Path $config) { try { $data = Get-Content $config -Raw | ConvertFrom-Json } catch {} }; if (-not ($data.PSObject.Properties['env'])) { $data | Add-Member -MemberType NoteProperty -Name 'env' -Value ([PSCustomObject]@{}) -Force }; $data.env | Add-Member -MemberType NoteProperty -Name 'ANTHROPIC_BASE_URL' -Value $baseUrl -Force; $data.env | Add-Member -MemberType NoteProperty -Name 'ANTHROPIC_AUTH_TOKEN' -Value $apiKey -Force; $data.env | Add-Member -MemberType NoteProperty -Name 'ANTHROPIC_MODEL' -Value $model -Force; $data | ConvertTo-Json -Depth 10 | Set-Content -Path $config -Encoding UTF8`;
}

// ============================================================================
// 2. Codex CLI (~/.config/codex/config.json)
// ============================================================================

function codexUnixCommand({ baseUrl, apiKey, model }) {
  return `mkdir -p "$HOME/.config/codex" && if [ -f "$HOME/.config/codex/config.json" ]; then cp "$HOME/.config/codex/config.json" "$HOME/.config/codex/config.json.bak-$(date +%Y%m%d-%H%M%S)"; fi && node -e '
${unixValueDeclarations({ baseUrl, apiKey, model })}
const fs = require("fs"), p = require("path").join(process.env.HOME || "", ".config/codex/config.json");
let c = {}; try { c = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
Object.assign(c, {
  baseUrl,
  apiKey,
  model
});
fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\\n");
'`;
}

function codexWindowsCommand({ baseUrl, apiKey, model }) {
  return `${powershellValueDeclarations({ baseUrl, apiKey, model })}; $configDir = Join-Path $HOME '.config\\codex'; $config = Join-Path $configDir 'config.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; $data = [PSCustomObject]@{}; if (Test-Path $config) { try { $data = Get-Content $config -Raw | ConvertFrom-Json } catch {} }; $data | Add-Member -MemberType NoteProperty -Name 'baseUrl' -Value $baseUrl -Force; $data | Add-Member -MemberType NoteProperty -Name 'apiKey' -Value $apiKey -Force; $data | Add-Member -MemberType NoteProperty -Name 'model' -Value $model -Force; $data | ConvertTo-Json -Depth 10 | Set-Content -Path $config -Encoding UTF8`;
}

// ============================================================================
// 3. Aider (~/.aider.conf.yml)
// ============================================================================

function aiderUnixCommand({ baseUrl, apiKey, model }) {
  const modelName = model.startsWith("openai/") ? model : `openai/${model}`;

  return `if [ -f "$HOME/.aider.conf.yml" ]; then cp "$HOME/.aider.conf.yml" "$HOME/.aider.conf.yml.bak-$(date +%Y%m%d-%H%M%S)"; fi && node -e '
${unixValueDeclarations({ baseUrl, apiKey, model: modelName })}
const fs = require("fs"), p = require("path").join(process.env.HOME || "", ".aider.conf.yml");
let lines = []; try { lines = fs.readFileSync(p, "utf8").split(/\\r?\\n/); } catch {}
lines = lines.filter((line) => !/^(openai-api-base|openai-api-key|model):/.test(line));
while (lines.length && !lines[lines.length - 1]) lines.pop();
if (lines.length) lines.push("");
lines.push("openai-api-base: " + JSON.stringify(baseUrl));
lines.push("openai-api-key: " + JSON.stringify(apiKey));
lines.push("model: " + JSON.stringify(model));
fs.writeFileSync(p, lines.join("\\n") + "\\n");
'`;
}

function aiderWindowsCommand({ baseUrl, apiKey, model }) {
  const modelName = model.startsWith("openai/") ? model : `openai/${model}`;

  return `${powershellValueDeclarations({ baseUrl, apiKey, model: modelName })}; $config = Join-Path $HOME '.aider.conf.yml'; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"; $lines = @(Get-Content $config | Where-Object { $_ -notmatch '^(openai-api-base|openai-api-key|model):' }) } else { $lines = @() }; $yaml = @('openai-api-base: ' + ($baseUrl | ConvertTo-Json -Compress), 'openai-api-key: ' + ($apiKey | ConvertTo-Json -Compress), 'model: ' + ($model | ConvertTo-Json -Compress)); @($lines + $yaml) | Set-Content $config -Encoding UTF8`;
}

// ============================================================================
// 4. OpenCode (~/.config/opencode/opencode.json)
// ============================================================================

function opencodeUnixCommand({ baseUrl, apiKey, model }) {
  return `mkdir -p "$HOME/.config/opencode" && if [ -f "$HOME/.config/opencode/opencode.json" ]; then cp "$HOME/.config/opencode/opencode.json" "$HOME/.config/opencode/opencode.json.bak-$(date +%Y%m%d-%H%M%S)"; fi && node -e '
${unixValueDeclarations({ baseUrl, apiKey, model })}
const fs = require("fs"), p = require("path").join(process.env.HOME || "", ".config/opencode/opencode.json");
let c = {}; try { c = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
c.model = model;
c.provider = Object.assign({}, c.provider, {
  openai: Object.assign({}, c.provider && c.provider.openai, {
    baseUrl,
    apiKey
  })
});
fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\\n");
'`;
}

function opencodeWindowsCommand({ baseUrl, apiKey, model }) {
  return `${powershellValueDeclarations({ baseUrl, apiKey, model })}; $configDir = Join-Path $HOME '.config\\opencode'; $config = Join-Path $configDir 'opencode.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; $data = [PSCustomObject]@{}; if (Test-Path $config) { try { $data = Get-Content $config -Raw | ConvertFrom-Json } catch {} }; $data | Add-Member -MemberType NoteProperty -Name 'model' -Value $model -Force; if (-not ($data.PSObject.Properties['provider'])) { $data | Add-Member -MemberType NoteProperty -Name 'provider' -Value ([PSCustomObject]@{}) -Force }; if (-not ($data.provider.PSObject.Properties['openai'])) { $data.provider | Add-Member -MemberType NoteProperty -Name 'openai' -Value ([PSCustomObject]@{}) -Force }; $data.provider.openai | Add-Member -MemberType NoteProperty -Name 'baseUrl' -Value $baseUrl -Force; $data.provider.openai | Add-Member -MemberType NoteProperty -Name 'apiKey' -Value $apiKey -Force; $data | ConvertTo-Json -Depth 10 | Set-Content -Path $config -Encoding UTF8`;
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
