# AI CLI Config Studio

A fast, lightweight, dependency-free Bun web app that discovers models from any public OpenAI-compatible gateway (e.g. 9Router, OpenRouter, DeepSeek, Groq, Together AI) and generates **permanent configuration commands** with **automatic timestamped backups** for popular AI coding CLIs:

- 🟣 **Claude Code (`claude`)** → `~/.claude/settings.json`
- 🟢 **OpenAI Codex CLI (`codex`)** → `~/.codex/config.toml`
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
docker build -t ai-cli-config-studio https://github.com/KhBayazidAhmed/ai-cli-config-studio.git#main
docker run -d -p 3000:3000 --name ai-cli-config-studio ai-cli-config-studio
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Deploy or Update on a VPS

Push the latest code to GitHub from your development computer:

```bash
git push origin main
```

On the VPS, change to the directory containing `docker-compose.yml`. For example:

```bash
cd /docker/ai-cli-config-studio
```

Run each deployment command separately and wait for it to finish before running the next one:

```bash
docker compose build --pull --no-cache
docker compose up -d --force-recreate
docker compose ps
docker compose logs --tail=100
```

The Compose configuration builds the application directly from the latest `main` branch on GitHub. The VPS directory therefore only needs the `docker-compose.yml` file; it does not need to be a Git clone. Do not split options such as `--pull`, `--no-cache`, `--force-recreate`, or `--tail=100` onto separate shell commands.

For future updates, push the changes to GitHub and repeat the `docker compose build` and `docker compose up` commands on the VPS.

---

## 📚 Documentation & Key Features

For detailed architectural information, see the [In-App Documentation (`/docs`)](http://localhost:3000/docs).

### 1. Model Discovery & Gateway Integration
- Connects to any public HTTPS OpenAI-compatible provider serving a `GET /models` endpoint (e.g., 9Router, OpenRouter, DeepSeek, Groq, Together AI, custom gateways).
- *Privacy Guarantee:* Your API key is persisted only in the current browser's local storage and is never logged or sent to an external database.

### 2. Temporary & Permanent Configuration
Permanent commands write directly to persistent tool configuration files:
- **Claude Code (`claude`)**: Safely merges the Anthropic gateway root, bearer token, selected model, and gateway model discovery into `~/.claude/settings.json`.
- **Codex CLI (`codex`)**: Updates `~/.codex/config.toml` with a `config-studio` model provider using the Responses API and the selected model.
- **OpenCode (`opencode`)**: Adds a `config-studio` OpenAI-compatible provider under `provider.config-studio` in `~/.config/opencode/opencode.json`.
- **Non-Destructive:** Retains any existing user preferences, custom themes, allowed tools, and hooks.
- **Temporary Mode:** Generates a readable command that exports session-only environment variables and immediately opens the selected CLI with the chosen model, without changing configuration files or sending an automatic prompt.
- **No Node Setup:** End users do not need Node.js, npm, Bun, or project dependencies. Temporary macOS/Linux commands use the shell only; permanent commands automatically use Python 3, system Perl, or the built-in macOS JavaScript runtime. Windows commands use PowerShell.
- **Readable Permanent Setup:** Permanent commands show numbered progress logs, back up and update the configuration, then open the selected CLI interactively with the chosen model. They do not send an automatic prompt.

### 3. Automatic Backup & 1-Click Rollback
- **Timestamped Backup:** Before updating any file, the generated command creates a backup:
  - macOS / Linux: `<config-file>.bak-$(date +%Y%m%d-%H%M%S)`
  - Windows (PowerShell): `$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')`
- **Instant Restore:** A matching one-click restore command is generated in the studio to immediately revert to the latest backup.

---

## 🧪 Testing & Verification

```bash
# Run unit/integration tests
bun test

# Run browser end-to-end tests
bun run test:e2e

# Run every test suite
bun run test:all

# Run build bundle check
bun run check
```

The E2E suite starts an isolated Bun server automatically and covers the complete browser-to-API
Studio workflow, all supported CLI command variants, clipboard actions, gateway errors,
documentation, API safety checks, and mobile layout. It runs with installed Google Chrome.
