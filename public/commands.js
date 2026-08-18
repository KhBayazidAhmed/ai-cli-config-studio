// 1. Claude Code (~/.claude/settings.json)
function claudeUnixCommand({ baseUrl, apiKey, model }) {
  const jsonContent = JSON.stringify(
    {
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_MODEL: model,
      },
    },
    null,
    2,
  );
  return `mkdir -p "$HOME/.claude" && if [ -f "$HOME/.claude/settings.json" ]; then cp "$HOME/.claude/settings.json" "$HOME/.claude/settings.json.bak-$(date +%Y%m%d-%H%M%S)"; fi && cat << 'EOF' > "$HOME/.claude/settings.json"\n${jsonContent}\nEOF`;
}

function claudeWindowsCommand({ baseUrl, apiKey, model }) {
  const jsonContent = JSON.stringify(
    {
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_MODEL: model,
      },
    },
    null,
    2,
  );
  return `$configDir = Join-Path $HOME '.claude'; $config = Join-Path $configDir 'settings.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; @'\n${jsonContent}\n'@ | Set-Content -Path $config -Encoding UTF8`;
}

// 2. Codex CLI (~/.config/codex/config.json)
function codexUnixCommand({ baseUrl, apiKey, model }) {
  const jsonContent = JSON.stringify(
    {
      baseUrl,
      apiKey,
      model,
    },
    null,
    2,
  );
  return `mkdir -p "$HOME/.config/codex" && if [ -f "$HOME/.config/codex/config.json" ]; then cp "$HOME/.config/codex/config.json" "$HOME/.config/codex/config.json.bak-$(date +%Y%m%d-%H%M%S)"; fi && cat << 'EOF' > "$HOME/.config/codex/config.json"\n${jsonContent}\nEOF`;
}

function codexWindowsCommand({ baseUrl, apiKey, model }) {
  const jsonContent = JSON.stringify(
    {
      baseUrl,
      apiKey,
      model,
    },
    null,
    2,
  );
  return `$configDir = Join-Path $HOME '.config\\codex'; $config = Join-Path $configDir 'config.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; @'\n${jsonContent}\n'@ | Set-Content -Path $config -Encoding UTF8`;
}

// 3. Aider (~/.aider.conf.yml)
function aiderUnixCommand({ baseUrl, apiKey, model }) {
  const modelName = model.startsWith("openai/") ? model : `openai/${model}`;
  const yamlContent = `openai-api-base: ${baseUrl}\nopenai-api-key: ${apiKey}\nmodel: ${modelName}`;
  return `if [ -f "$HOME/.aider.conf.yml" ]; then cp "$HOME/.aider.conf.yml" "$HOME/.aider.conf.yml.bak-$(date +%Y%m%d-%H%M%S)"; fi && cat << 'EOF' > "$HOME/.aider.conf.yml"\n${yamlContent}\nEOF`;
}

function aiderWindowsCommand({ baseUrl, apiKey, model }) {
  const modelName = model.startsWith("openai/") ? model : `openai/${model}`;
  const yamlContent = `openai-api-base: ${baseUrl}\nopenai-api-key: ${apiKey}\nmodel: ${modelName}`;
  return `$config = Join-Path $HOME '.aider.conf.yml'; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; @'\n${yamlContent}\n'@ | Set-Content -Path $config -Encoding UTF8`;
}

// 4. OpenCode (~/.config/opencode/opencode.json)
function opencodeUnixCommand({ baseUrl, apiKey, model }) {
  const jsonContent = JSON.stringify(
    {
      model,
      provider: {
        openai: {
          baseUrl,
          apiKey,
        },
      },
    },
    null,
    2,
  );
  return `mkdir -p "$HOME/.config/opencode" && if [ -f "$HOME/.config/opencode/opencode.json" ]; then cp "$HOME/.config/opencode/opencode.json" "$HOME/.config/opencode/opencode.json.bak-$(date +%Y%m%d-%H%M%S)"; fi && cat << 'EOF' > "$HOME/.config/opencode/opencode.json"\n${jsonContent}\nEOF`;
}

function opencodeWindowsCommand({ baseUrl, apiKey, model }) {
  const jsonContent = JSON.stringify(
    {
      model,
      provider: {
        openai: {
          baseUrl,
          apiKey,
        },
      },
    },
    null,
    2,
  );
  return `$configDir = Join-Path $HOME '.config\\opencode'; $config = Join-Path $configDir 'opencode.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; @'\n${jsonContent}\n'@ | Set-Content -Path $config -Encoding UTF8`;
}

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

export function getRevertCommand(platform, client = "claude") {
  const target = revertCommands[client] || revertCommands.claude;
  return target[platform] || "";
}
