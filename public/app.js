import { createSetupCommand, getRevertCommand } from "./commands.js";

const form = document.querySelector("#models-form");
const baseUrlInput = document.querySelector("#base-url");
const apiKeyInput = document.querySelector("#api-key");
const toggleKeyButton = document.querySelector("#toggle-key");
const loadButton = document.querySelector("#load-models");
const loadLabel = document.querySelector("#load-label");
const modelSelect = document.querySelector("#models");
const modelStatus = document.querySelector("#model-status");
const connectionStatus = document.querySelector("#connection-status");
const commandElement = document.querySelector("#command");
const copyCommandButton = document.querySelector("#copy-command");
const terminalTitle = document.querySelector("#terminal-title");
const readyState = document.querySelector("#ready-state");
const summaryClient = document.querySelector("#summary-client");
const summaryModel = document.querySelector("#summary-model");
const summaryPlatform = document.querySelector("#summary-platform");
const revertCopy = document.querySelector("#revert-copy");
const revertHeaderTitle = document.querySelector("#revert-header-title");
const revertHeaderDesc = document.querySelector("#revert-header-desc");
const revertCommandElement = document.querySelector("#revert-command");
const copyRevertButton = document.querySelector("#copy-revert");
const copyRevertText = document.querySelector("#copy-revert-text");
const securityBannerText = document.querySelector("#security-banner-text");
const toast = document.querySelector("#toast");
const toastMessage = toast ? toast.querySelector(".toast-message") : null;

// Badges & Presets
const step1Badge = document.querySelector("#step-1-badge");
const step2Badge = document.querySelector("#step-2-badge");
const modelCountHint = document.querySelector("#model-count-hint");
const presetButtons = document.querySelectorAll(".preset-btn");

let loadedFingerprint = "";
let toastTimer;

const clientLabels = {
  claude: "Claude Code",
  codex: "Codex CLI",
  aider: "Aider",
  opencode: "OpenCode",
};

function selectedValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function credentialsFingerprint() {
  return `${baseUrlInput.value.trim()}\n${apiKeyInput.value.trim()}`;
}

function commandValues(apiKey = apiKeyInput.value.trim()) {
  return {
    baseUrl: baseUrlInput.value.trim(),
    apiKey,
    model: modelSelect.value,
    client: selectedValue("client"),
  };
}

function currentCommand() {
  if (!modelSelect.value) return "";
  return createSetupCommand(selectedValue("platform"), commandValues());
}

function previewCommand() {
  if (!modelSelect.value) return "";
  return createSetupCommand(
    selectedValue("platform"),
    commandValues("********"),
  );
}

function setConnectionState(state, message) {
  connectionStatus.dataset.state = state;
  modelStatus.textContent = message;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  if (toastMessage) {
    toastMessage.textContent = message;
  } else if (toast) {
    toast.textContent = message;
  }
  if (toast) {
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2200);
  }
}

function updateOutput() {
  const platform = selectedValue("platform") || "unix";
  const client = selectedValue("client") || "claude";
  const command = currentCommand();

  terminalTitle.textContent = platform === "windows" ? "PowerShell" : "zsh";

  const preview = previewCommand();
  if (preview) {
    commandElement.textContent = preview;
  } else {
    commandElement.textContent =
      "# Step 1: Connect provider above and select a model.";
  }

  const isReady = Boolean(command);
  copyCommandButton.disabled = !isReady;
  readyState.classList.toggle("is-ready", isReady);

  const badgeText = readyState.querySelector(".badge-text");
  if (badgeText) {
    badgeText.textContent = isReady ? "Ready" : "Waiting";
  }

  summaryClient.textContent = clientLabels[client] || "Claude Code";
  summaryModel.textContent = modelSelect.value || "Not selected";
  summaryPlatform.textContent =
    platform === "windows" ? "Windows" : "macOS / Linux";

  // Revert / Reset command
  const revertCmd = getRevertCommand(platform, client);
  if (revertCommandElement) {
    revertCommandElement.textContent = revertCmd;
  }

  if (revertCopy && revertHeaderTitle && revertHeaderDesc) {
    if (client === "aider") {
      revertHeaderTitle.textContent = "Reset Environment";
      revertHeaderDesc.textContent = "Aider flags are self-contained";
      revertCopy.textContent =
        "Aider is executed directly with CLI parameters. No persistent environment variables need to be cleared.";
      if (copyRevertText) copyRevertText.textContent = "Copy Reset Note";
    } else {
      const name = clientLabels[client] || "AI CLI";
      revertHeaderTitle.textContent = `Reset ${name} Environment`;
      revertHeaderDesc.textContent = "Unset session environment variables";
      revertCopy.textContent = `Run this command in your ${
        platform === "windows" ? "PowerShell" : "terminal"
      } to unset session environment variables for ${name}.`;
      if (copyRevertText) copyRevertText.textContent = "Copy Reset Command";
    }
  }

  // Banner details
  if (securityBannerText) {
    if (client === "claude") {
      securityBannerText.innerHTML =
        "<strong>Session Setup:</strong> Exports <code>ANTHROPIC_BASE_URL</code> and auth token for your terminal session, then launches Claude Code.";
    } else if (client === "codex") {
      securityBannerText.innerHTML =
        "<strong>Session Setup:</strong> Exports <code>OPENAI_BASE_URL</code> and API key for your terminal session, then launches Codex CLI.";
    } else if (client === "aider") {
      securityBannerText.innerHTML =
        "<strong>Direct Invocation:</strong> Passes gateway base URL and API key directly as command arguments to Aider.";
    } else {
      securityBannerText.innerHTML =
        "<strong>Session Setup:</strong> Exports <code>OPENAI_BASE_URL</code> and API key for your terminal session, then launches OpenCode.";
    }
  }

  // Step badges
  const hasModels = modelSelect.options.length > 1 && !modelSelect.disabled;
  if (hasModels) {
    step1Badge.classList.add("completed");
  } else {
    step1Badge.classList.remove("completed");
  }

  if (modelSelect.value) {
    step2Badge.classList.add("completed");
  } else {
    step2Badge.classList.remove("completed");
  }
}

function invalidateModels() {
  if (!loadedFingerprint || loadedFingerprint === credentialsFingerprint()) {
    updateOutput();
    return;
  }

  loadedFingerprint = "";
  modelSelect.replaceChildren(
    new Option("Credentials changed — fetch models to reload", "")
  );
  modelSelect.disabled = true;
  if (modelCountHint) modelCountHint.textContent = "Connect provider first";
  setConnectionState("idle", "Credentials changed. Fetch models to update.");
  updateOutput();
}

async function writeClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
}

// Preset button handlers
presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    presetButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const targetUrl = btn.dataset.url;
    if (targetUrl) {
      baseUrlInput.value = targetUrl;
      invalidateModels();
      if (!apiKeyInput.value) {
        apiKeyInput.focus();
      }
    }
  });
});

// Update preset highlight on input change
baseUrlInput.addEventListener("input", () => {
  const currentVal = baseUrlInput.value.trim();
  presetButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.url === currentVal);
  });
  invalidateModels();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  loadButton.disabled = true;
  loadButton.classList.add("is-loading");
  loadLabel.textContent = "Fetching...";
  setConnectionState("loading", "Querying provider models...");

  try {
    const response = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: baseUrlInput.value,
        apiKey: apiKeyInput.value,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not load models.");
    }

    if (!payload.models || payload.models.length === 0) {
      throw new Error("The gateway returned no models.");
    }

    modelSelect.replaceChildren(
      ...payload.models.map((model) => new Option(model, model)),
    );
    modelSelect.disabled = false;
    loadedFingerprint = credentialsFingerprint();
    if (modelCountHint) {
      modelCountHint.textContent = `${payload.models.length} models available`;
    }
    setConnectionState("success", `${payload.models.length} models loaded successfully.`);
    showToast(`${payload.models.length} models loaded`);
  } catch (error) {
    loadedFingerprint = "";
    modelSelect.replaceChildren(
      new Option("No models available. Check URL & key.", "")
    );
    modelSelect.disabled = true;
    if (modelCountHint) modelCountHint.textContent = "Failed to load";
    setConnectionState(
      "error",
      error instanceof Error ? error.message : "Could not load models.",
    );
  } finally {
    loadButton.disabled = false;
    loadButton.classList.remove("is-loading");
    loadLabel.textContent = "Fetch Models";
    updateOutput();
  }
});

toggleKeyButton.addEventListener("click", () => {
  const show = apiKeyInput.type === "password";
  apiKeyInput.type = show ? "text" : "password";
  const eyeIcon = toggleKeyButton.querySelector(".icon-eye");
  const eyeOffIcon = toggleKeyButton.querySelector(".icon-eye-off");
  const toggleText = toggleKeyButton.querySelector(".toggle-text");
  if (eyeIcon && eyeOffIcon) {
    eyeIcon.classList.toggle("hidden", show);
    eyeOffIcon.classList.toggle("hidden", !show);
  }
  if (toggleText) {
    toggleText.textContent = show ? "Hide" : "Show";
  }
});

document
  .querySelectorAll('input[name="client"], input[name="platform"]')
  .forEach((input) => input.addEventListener("change", updateOutput));

modelSelect.addEventListener("change", updateOutput);
apiKeyInput.addEventListener("input", invalidateModels);

copyCommandButton.addEventListener("click", async () => {
  const command = currentCommand();
  if (!command) return;
  await writeClipboard(command);

  const copyIcon = copyCommandButton.querySelector(".icon-copy");
  const checkIcon = copyCommandButton.querySelector(".icon-check");
  const copyBtnText = copyCommandButton.querySelector(".copy-btn-text");

  if (copyIcon && checkIcon) {
    copyIcon.classList.add("hidden");
    checkIcon.classList.remove("hidden");
  }
  if (copyBtnText) copyBtnText.textContent = "Copied to Clipboard";

  setTimeout(() => {
    if (copyIcon && checkIcon) {
      copyIcon.classList.remove("hidden");
      checkIcon.classList.add("hidden");
    }
    if (copyBtnText) copyBtnText.textContent = "Copy Terminal Command";
  }, 1800);

  showToast("Setup command copied to clipboard");
});

copyRevertButton.addEventListener("click", async () => {
  const revertCmd = getRevertCommand(selectedValue("platform"), selectedValue("client"));
  if (!revertCmd) return;
  await writeClipboard(revertCmd);

  const copyIcon = copyRevertButton.querySelector(".icon-copy");
  const checkIcon = copyRevertButton.querySelector(".icon-check");
  const btnText = copyRevertButton.querySelector(".secondary-btn-text");

  if (copyIcon && checkIcon) {
    copyIcon.classList.add("hidden");
    checkIcon.classList.remove("hidden");
  }
  if (btnText) btnText.textContent = "Command Copied";

  setTimeout(() => {
    if (copyIcon && checkIcon) {
      copyIcon.classList.remove("hidden");
      checkIcon.classList.add("hidden");
    }
    if (btnText) {
      btnText.textContent = copyRevertText ? copyRevertText.textContent : "Copy Reset Command";
    }
  }, 1800);

  showToast("Reset command copied");
});

// Initial update
updateOutput();
