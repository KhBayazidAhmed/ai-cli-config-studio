# AI CLI Config Studio

A fast, lightweight, dependency-free Bun web app that discovers models from any public OpenAI-compatible gateway (e.g. 9Router, OpenRouter, DeepSeek, Groq, Together AI) and generates **permanent configuration commands** with **automatic timestamped backups** for popular AI coding CLIs:

- 🟣 **Claude Code (`claude`)** → `~/.claude/settings.json`
- 🟢 **OpenAI Codex CLI (`codex`)** → `~/.config/codex/config.json`
- 🔵 **Aider (`aider`)** → `~/.aider.conf.yml`
- 🟠 **OpenCode (`opencode`)** → `~/.config/opencode/opencode.json`

---

## 🚀 Getting Started

### Local Development (Bun)

Start the local development server:

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Run with Docker

### Option 1: Using Docker Compose (Cloned Repo)

```bash
docker compose up -d
```

### Option 2: Run directly from GitHub without cloning

```bash
# Pull and run directly from GitHub repository with Docker Compose
docker compose -f docker-compose.git.yml up -d
```

Or using standard Docker CLI:

```bash
docker build -t ai-cli-config-studio https://github.com/KhBayazidAhmed/ai-cli-config-studio.git#main
docker run -d -p 3000:3000 --name ai-cli-config-studio ai-cli-config-studio
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.


---

## ✨ Features & Permanent Configuration

1. **Step 1: Connect your AI Provider**
   - Click a quick preset (9Router, OpenRouter, DeepSeek, Groq, Together AI) or enter your custom API Base URL.
   - Enter your API Key and click **Fetch Models**.
   - *Privacy Guarantee:* Your API Key is only used in memory to discover models and generate your local terminal command. It is never saved or logged in any remote database.

2. **Step 2: Choose your Target AI CLI**
   - **Claude Code (`claude`)**: Writes to `~/.claude/settings.json` under the `env` block (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL`).
   - **Codex CLI (`codex`)**: Writes to `~/.config/codex/config.json` (`baseUrl`, `apiKey`, `model`).
   - **Aider (`aider`)**: Writes persistent YAML configuration to `~/.aider.conf.yml` (`openai-api-base`, `openai-api-key`, `model`).
   - **OpenCode (`opencode`)**: Writes to `~/.config/opencode/opencode.json` with provider configuration.

3. **Step 3: Safe, Timestamped Backups & Instant Restore**
   - **Automatic Backup:** Before writing or overwriting any configuration file, the generated script checks if an existing file is present and makes a timestamped copy:
     - macOS/Linux: `config.json.bak-$(date +%Y%m%d-%H%M%S)`
     - Windows: `$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')`
   - **One-Click Restore:** If you ever need to rollback, copy the one-click Restore Command from the accordion to restore your newest `.bak` file.

---

## 🧪 Testing & Verification

```bash
# Run unit tests
bun test

# Run build bundle check
bun run check
```
