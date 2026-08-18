# AI CLI Config Studio

A fast, lightweight, dependency-free Bun web app that discovers models from any public OpenAI-compatible gateway (e.g. 9Router, OpenRouter, DeepSeek, Groq, Together AI) and generates **permanent configuration commands** with **automatic timestamped backups** for popular AI coding CLIs:

- 🟣 **Claude Code (`claude`)** → `~/.claude/settings.json`
- 🟢 **OpenAI Codex CLI (`codex`)** → `~/.config/codex/config.json`
- 🔵 **Aider (`aider`)** → `~/.aider.conf.yml`
- 🟠 **OpenCode (`opencode`)** → `~/.config/opencode/opencode.json`

📖 **Full In-App Documentation:** Available directly at [`/docs`](http://localhost:3000/docs) when running locally or on the web app header.

---

## 🚀 Getting Started

### Local Development (Bun)

Start the local development server:

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000) (or [http://localhost:3000/docs](http://localhost:3000/docs)) in your browser.

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

## 📚 Documentation & Key Features

For detailed architectural information, see the [In-App Documentation (`/docs`)](http://localhost:3000/docs).

### 1. Model Discovery & Gateway Integration
- Connects to any OpenAI-compatible provider serving a `GET /models` endpoint (e.g., 9Router, OpenRouter, DeepSeek, Groq, Together AI, custom gateways).
- *Privacy Guarantee:* Your API Key is used strictly in memory by the local proxy and never persisted, logged, or sent to external databases.

### 2. Direct Configuration File Merging
Commands write directly to persistent tool configuration files without session-only environment variables:
- **Claude Code (`claude`)**: Safely merges into `~/.claude/settings.json` under the `env` block (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL`).
- **Codex CLI (`codex`)**: Merges into `~/.config/codex/config.json` (`baseUrl`, `apiKey`, `model`).
- **Aider (`aider`)**: Appends/updates persistent YAML configuration in `~/.aider.conf.yml` (`openai-api-base`, `openai-api-key`, `model`).
- **OpenCode (`opencode`)**: Merges into `~/.config/opencode/opencode.json` (`model`, `provider.openai`).
- **Non-Destructive:** Retains any existing user preferences, custom themes, allowed tools, and hooks.

### 3. Automatic Backup & 1-Click Rollback
- **Timestamped Backup:** Before updating any file, the generated command creates a backup:
  - macOS / Linux: `config.json.bak-$(date +%Y%m%d-%H%M%S)`
  - Windows (PowerShell): `$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')`
- **Instant Restore:** A matching one-click restore command is generated in the studio to immediately revert to the latest backup.

---

## 🧪 Testing & Verification

```bash
# Run test suite
bun test

# Run build bundle check
bun run check
```
