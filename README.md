# AI CLI Config Studio

A fast, lightweight, dependency-free Bun web app that discovers models from any public OpenAI-compatible gateway (e.g. 9Router, OpenRouter, DeepSeek, Groq, Together AI) and generates exact, ready-to-run terminal commands for popular AI coding CLIs:

- 🟣 **Claude Code (`claude`)**
- 🟢 **OpenAI Codex CLI (`codex`)**
- 🔵 **Aider (`aider`)**
- 🟠 **OpenCode (`opencode`)**

---

## 🚀 Getting Started

Start the local development server:

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ✨ Features & How It Works

1. **Step 1: Connect your AI Provider**
   - Click a quick preset (9Router, OpenRouter, DeepSeek, Groq, Together AI) or enter your custom API Base URL.
   - Enter your API Key and click **Fetch Models**.
   - *Privacy Guarantee:* Your API Key is only used in memory to discover models and generate your local terminal command. It is never saved or logged in any database.

2. **Step 2: Configure Preferences**
   - **AI Coding CLI:** Choose your target assistant:
     - **Claude Code (`claude`)**: Exports `ANTHROPIC_BASE_URL` & `ANTHROPIC_AUTH_TOKEN` and launches `claude`.
     - **Codex CLI (`codex`)**: Exports `OPENAI_BASE_URL` & `OPENAI_API_KEY` and launches `codex`.
     - **Aider (`aider`)**: Passes gateway parameters via `--openai-api-base` and `--openai-api-key`.
     - **OpenCode (`opencode`)**: Exports `OPENAI_BASE_URL` & `OPENAI_API_KEY` and launches `opencode`.
   - **Target Model:** Select from the models retrieved from your provider.
   - **Operating System:** Pick **macOS / Linux** (`bash`/`zsh`) or **Windows** (`PowerShell`).

3. **Step 3: Copy & Run in Terminal**
   - Generates the exact, copy-paste terminal command with shell quoting and proper escaping.
   - Includes one-click **Reset Commands** to quickly unset session environment variables when you are done.

---

## 🧪 Testing & Verification

```bash
# Run unit tests
bun test

# Run build bundle check
bun run check
```
