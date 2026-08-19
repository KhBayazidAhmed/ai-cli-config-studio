/**
 * AI CLI Config Studio - Frontend Client Application
 */

import {
  configPaths,
  createSetupCommand,
  createTemporaryCommand,
  getRevertCommand,
} from "./commands.js";

// ============================================================================
// Constants & State
// ============================================================================

const CLIENT_LABELS = {
  claude: "Claude Code",
  codex: "Codex CLI",
  opencode: "OpenCode",
};

const MODEL_CAPABILITIES = [
  {
    id: "creative",
    title: "Creative & Strategy",
    audience: "Design, marketing, brand, and planning",
    description: "Strong all-round choices for concepts, campaigns, presentations, and thoughtful writing.",
  },
  {
    id: "everyday",
    title: "Fast Everyday Work",
    audience: "Quick drafts, summaries, and team tasks",
    description: "Optimized for speed when you need useful answers, rewrites, or meeting support quickly.",
  },
  {
    id: "research",
    title: "Research & Quality",
    audience: "Analysis, review, and important decisions",
    description: "Better for checking details, comparing options, and producing more considered work.",
  },
  {
    id: "technical",
    title: "Product & Technical",
    audience: "Code, specifications, data, and implementation",
    description: "Best suited to engineering, technical product work, debugging, and structured outputs.",
  },
];

const STORAGE_KEY = "ai-cli-config-studio:form-state";

const state = {
  loadedFingerprint: "",
  toastTimer: null,
};

// ============================================================================
// DOM Elements Registry
// ============================================================================

const elements = {
  form: document.querySelector("#models-form"),
  baseUrlInput: document.querySelector("#base-url"),
  apiKeyInput: document.querySelector("#api-key"),
  toggleKeyButton: document.querySelector("#toggle-key"),
  loadButton: document.querySelector("#load-models"),
  loadLabel: document.querySelector("#load-label"),
  modelSelect: document.querySelector("#models"),
  modelStatus: document.querySelector("#model-status"),
  connectionStatus: document.querySelector("#connection-status"),
  commandElement: document.querySelector("#command"),
  copyCommandButton: document.querySelector("#copy-command"),
  terminalTitle: document.querySelector("#terminal-title"),
  readyState: document.querySelector("#ready-state"),
  summaryClient: document.querySelector("#summary-client"),
  summaryModel: document.querySelector("#summary-model"),
  summaryPlatform: document.querySelector("#summary-platform"),
  revertCopy: document.querySelector("#revert-copy"),
  revertHeaderTitle: document.querySelector("#revert-header-title"),
  revertHeaderDesc: document.querySelector("#revert-header-desc"),
  revertCommandElement: document.querySelector("#revert-command"),
  copyRevertButton: document.querySelector("#copy-revert"),
  copyRevertText: document.querySelector("#copy-revert-text"),
  securityBannerText: document.querySelector("#security-banner-text"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toast .toast-message"),
  step1Badge: document.querySelector("#step-1-badge"),
  step2Badge: document.querySelector("#step-2-badge"),
  modelCountHint: document.querySelector("#model-count-hint"),
  presetButtons: document.querySelectorAll(".preset-btn"),
  clientChoiceName: document.querySelector("#client-choice-name"),
  clientConfigPath: document.querySelector("#client-config-path"),
  clientChoiceDescription: document.querySelector("#client-choice-description"),
  commandPanelDescription: document.querySelector("#command-panel-description"),
  revertPanel: document.querySelector("#revert-panel"),
  configModeToggle: document.querySelector("#config-mode-toggle"),
  configModeHint: document.querySelector("#config-mode-hint"),
};

// ============================================================================
// Helpers & Utilities
// ============================================================================

function getSelectedRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function getConfigMode() {
  return elements.configModeToggle.checked ? "permanent" : "temporary";
}

function getModelCapability(model) {
  const name = model.toLowerCase();
  if (/review|reason|deepseek-r1|(^|[\/_-])o[13]([\/_-]|$)|opus/.test(name)) {
    return MODEL_CAPABILITIES.find((group) => group.id === "research");
  }
  if (/mini|flash|haiku|luna|spark|small|fast|lite/.test(name)) {
    return MODEL_CAPABILITIES.find((group) => group.id === "everyday");
  }
  if (/codex|coder|code|devstral|starcoder/.test(name)) {
    return MODEL_CAPABILITIES.find((group) => group.id === "technical");
  }
  return MODEL_CAPABILITIES[0];
}

function renderModelPicker() {
  const models = Array.from(elements.modelSelect.options, (option) => option.value).filter(Boolean);
  if (models.length === 0) return;

  const selectedModel = elements.modelSelect.value;
  const groups = [];

  for (const capability of MODEL_CAPABILITIES) {
    const matchingModels = models.filter((model) => getModelCapability(model).id === capability.id);
    if (matchingModels.length === 0) continue;

    const group = document.createElement("optgroup");
    group.label = capability.title;
    for (const model of matchingModels) {
      group.append(new Option(model, model));
    }
    groups.push(group);
  }

  elements.modelSelect.replaceChildren(...groups);
  if (models.includes(selectedModel)) elements.modelSelect.value = selectedModel;
}

function getStoredFormState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveFormState() {
  const models = state.loadedFingerprint === getCredentialsFingerprint()
    ? Array.from(elements.modelSelect.options, (option) => option.value).filter(Boolean)
    : [];

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      baseUrl: elements.baseUrlInput.value,
      apiKey: elements.apiKeyInput.value,
      client: getSelectedRadioValue("client"),
      platform: getSelectedRadioValue("platform"),
      configMode: getConfigMode(),
      model: elements.modelSelect.value,
      models,
    }));
  } catch {
    // The studio remains usable when browser storage is disabled or full.
  }
}

function restoreFormState() {
  const stored = getStoredFormState();
  if (!stored || typeof stored !== "object") return;

  if (typeof stored.baseUrl === "string") {
    elements.baseUrlInput.value = stored.baseUrl;
  }
  if (typeof stored.apiKey === "string") {
    elements.apiKeyInput.value = stored.apiKey;
  }

  for (const name of ["client", "platform"]) {
    const value = stored[name];
    if (typeof value !== "string") continue;
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  }
  if (stored.configMode === "temporary" || stored.configMode === "permanent") {
    elements.configModeToggle.checked = stored.configMode === "permanent";
  }

  const models = Array.isArray(stored.models)
    ? stored.models.filter((model) => typeof model === "string" && model)
    : [];
  if (models.length > 0) {
    elements.modelSelect.replaceChildren(
      ...models.map((model) => new Option(model, model)),
    );
    elements.modelSelect.disabled = false;
    if (typeof stored.model === "string" && models.includes(stored.model)) {
      elements.modelSelect.value = stored.model;
    }
    state.loadedFingerprint = getCredentialsFingerprint();
    if (elements.modelCountHint) {
      elements.modelCountHint.textContent = `${models.length} models available`;
    }
    setConnectionState("success", `${models.length} models restored from this browser.`);
  }

  renderModelPicker();

  const currentUrl = elements.baseUrlInput.value.trim();
  elements.presetButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.url === currentUrl);
  });
}

function getCredentialsFingerprint() {
  return `${elements.baseUrlInput.value.trim()}\n${elements.apiKeyInput.value.trim()}`;
}

function getCommandValues(apiKey = elements.apiKeyInput.value.trim()) {
  return {
    baseUrl: elements.baseUrlInput.value.trim(),
    apiKey,
    model: elements.modelSelect.value,
    client: getSelectedRadioValue("client"),
  };
}

function getCurrentCommand() {
  if (!elements.modelSelect.value) return "";
  const createCommand = getConfigMode() === "temporary"
    ? createTemporaryCommand
    : createSetupCommand;
  return createCommand(getSelectedRadioValue("platform"), getCommandValues());
}

function getPreviewCommand() {
  if (!elements.modelSelect.value) return "";
  const createCommand = getConfigMode() === "temporary"
    ? createTemporaryCommand
    : createSetupCommand;
  return createCommand(
    getSelectedRadioValue("platform"),
    getCommandValues("********"),
  );
}

function setConnectionState(stateName, message) {
  elements.connectionStatus.dataset.state = stateName;
  elements.modelStatus.textContent = message;
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  if (elements.toastMessage) {
    elements.toastMessage.textContent = message;
  }
  if (elements.toast) {
    elements.toast.classList.add("is-visible");
    state.toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
    }, 2200);
  }
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
}

// ============================================================================
// UI Renderers & Updaters
// ============================================================================

function updateOutput() {
  const platform = getSelectedRadioValue("platform") || "unix";
  const client = getSelectedRadioValue("client") || "claude";
  const configMode = getConfigMode();
  const isTemporary = configMode === "temporary";
  const command = getCurrentCommand();

  elements.terminalTitle.textContent = platform === "windows" ? "PowerShell" : "zsh";

  const preview = getPreviewCommand();
  elements.commandElement.textContent = preview
    ? preview
    : "# Step 1: Connect provider above and select a model.";

  const isReady = Boolean(command);
  elements.copyCommandButton.disabled = !isReady;
  elements.readyState.classList.toggle("is-ready", isReady);

  const badgeText = elements.readyState.querySelector(".badge-text");
  if (badgeText) {
    badgeText.textContent = isReady ? "Ready" : "Waiting";
  }

  const clientName = CLIENT_LABELS[client] || "Claude Code";
  elements.summaryClient.textContent = clientName;
  if (elements.clientChoiceName) {
    elements.clientChoiceName.textContent = `${clientName} selected`;
  }
  elements.summaryModel.textContent = elements.modelSelect.value || "Not selected";
  elements.summaryPlatform.textContent =
    platform === "windows" ? "Windows" : "macOS / Linux";

  // Revert / Restore command
  const revertCmd = getRevertCommand(platform, client);
  if (elements.revertCommandElement) {
    elements.revertCommandElement.textContent = revertCmd;
  }

  const pathInfo =
    configPaths[client]?.[platform === "windows" ? "windows" : "unix"] || "";

  if (elements.clientConfigPath) {
    elements.clientConfigPath.textContent = pathInfo;
  }
  if (elements.clientChoiceDescription) {
    elements.clientChoiceDescription.innerHTML = isTemporary
      ? "Opens the CLI with the selected model in this terminal session"
      : `Writes to <code id="client-config-path">${pathInfo}</code>, then opens the CLI`;
    elements.clientConfigPath = document.querySelector("#client-config-path");
  }

  if (elements.commandPanelDescription) {
    elements.commandPanelDescription.textContent = isTemporary
      ? "Run this to open the CLI with the selected model for this session."
      : "Run this to save the configuration and open the CLI with the selected model.";
  }
  if (elements.configModeHint) {
    elements.configModeHint.textContent = isTemporary
      ? "Opens the CLI with the selected model"
      : "Saves, then opens the CLI";
  }
  if (elements.revertPanel) {
    elements.revertPanel.hidden = isTemporary;
  }

  if (elements.revertCopy && elements.revertHeaderTitle && elements.revertHeaderDesc) {
    elements.revertHeaderTitle.textContent = `Restore Previous ${clientName} Config`;
    elements.revertHeaderDesc.textContent = "Revert to your newest backup";
    elements.revertCopy.innerHTML = `Run this command in your ${
      platform === "windows" ? "PowerShell" : "terminal"
    } to restore the previous backup of <code>${pathInfo}</code>.`;
    if (elements.copyRevertText) {
      elements.copyRevertText.textContent = "Copy Restore Command";
    }
  }

  // Security banner details
  if (elements.securityBannerText) {
    elements.securityBannerText.innerHTML = isTemporary
      ? "<strong>Temporary Configuration:</strong> Exports the gateway settings and opens the CLI with the selected model. No configuration files are changed."
      : `<strong>Permanent Configuration:</strong> Creates a timestamped backup, writes settings to <code>${pathInfo}</code>, and opens the CLI with the selected model. The settings persist across terminal sessions.`;
  }

  const copyBtnText = elements.copyCommandButton.querySelector(".copy-btn-text");
  if (copyBtnText && copyBtnText.textContent !== "Copied to Clipboard") {
    copyBtnText.textContent = isTemporary ? "Copy Session Command" : "Copy Terminal Command";
  }

  // Step badges
  const hasModels = elements.modelSelect.options.length > 1 && !elements.modelSelect.disabled;
  elements.step1Badge.classList.toggle("completed", hasModels);
  elements.step2Badge.classList.toggle("completed", Boolean(elements.modelSelect.value));
}

function invalidateModels() {
  if (!state.loadedFingerprint || state.loadedFingerprint === getCredentialsFingerprint()) {
    updateOutput();
    return;
  }

  state.loadedFingerprint = "";
  elements.modelSelect.replaceChildren(
    new Option("Credentials changed — fetch models to reload", "")
  );
  elements.modelSelect.disabled = true;
  renderModelPicker();
  if (elements.modelCountHint) {
    elements.modelCountHint.textContent = "Connect provider first";
  }
  setConnectionState("idle", "Credentials changed. Fetch models to update.");
  updateOutput();
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handleFetchModels(event) {
  event.preventDefault();
  elements.loadButton.disabled = true;
  elements.loadButton.classList.add("is-loading");
  elements.loadLabel.textContent = "Fetching...";
  setConnectionState("loading", "Querying provider models...");

  try {
    const response = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: elements.baseUrlInput.value,
        apiKey: elements.apiKeyInput.value,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not load models.");
    }

    if (!payload.models || payload.models.length === 0) {
      throw new Error("The gateway returned no models.");
    }

    elements.modelSelect.replaceChildren(
      ...payload.models.map((model) => new Option(model, model)),
    );
    elements.modelSelect.disabled = false;
    state.loadedFingerprint = getCredentialsFingerprint();
    renderModelPicker();

    if (elements.modelCountHint) {
      elements.modelCountHint.textContent = `${payload.models.length} models available`;
    }
    setConnectionState("success", `${payload.models.length} models loaded successfully.`);
    showToast(`${payload.models.length} models loaded`);
    saveFormState();
  } catch (error) {
    state.loadedFingerprint = "";
    elements.modelSelect.replaceChildren(
      new Option("No models available. Check URL & key.", "")
    );
    elements.modelSelect.disabled = true;
    renderModelPicker();

    if (elements.modelCountHint) {
      elements.modelCountHint.textContent = "Failed to load";
    }
    setConnectionState(
      "error",
      error instanceof Error ? error.message : "Could not load models.",
    );
  } finally {
    elements.loadButton.disabled = false;
    elements.loadButton.classList.remove("is-loading");
    elements.loadLabel.textContent = "Fetch Models";
    updateOutput();
  }
}

function handleTogglePassword() {
  const isPassword = elements.apiKeyInput.type === "password";
  elements.apiKeyInput.type = isPassword ? "text" : "password";

  const eyeIcon = elements.toggleKeyButton.querySelector(".icon-eye");
  const eyeOffIcon = elements.toggleKeyButton.querySelector(".icon-eye-off");
  const toggleText = elements.toggleKeyButton.querySelector(".toggle-text");

  if (eyeIcon && eyeOffIcon) {
    eyeIcon.classList.toggle("hidden", isPassword);
    eyeOffIcon.classList.toggle("hidden", !isPassword);
  }
  if (toggleText) {
    toggleText.textContent = isPassword ? "Hide" : "Show";
  }
}

async function handleCopyCommand() {
  const command = getCurrentCommand();
  if (!command) return;
  await writeClipboard(command);

  const copyIcon = elements.copyCommandButton.querySelector(".icon-copy");
  const checkIcon = elements.copyCommandButton.querySelector(".icon-check");
  const copyBtnText = elements.copyCommandButton.querySelector(".copy-btn-text");

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
    if (copyBtnText) {
      copyBtnText.textContent = getConfigMode() === "temporary"
        ? "Copy Session Command"
        : "Copy Terminal Command";
    }
  }, 1800);

  showToast("Setup command copied to clipboard");
}

async function handleCopyRevert() {
  const revertCmd = getRevertCommand(
    getSelectedRadioValue("platform"),
    getSelectedRadioValue("client"),
  );
  if (!revertCmd) return;
  await writeClipboard(revertCmd);

  const copyIcon = elements.copyRevertButton.querySelector(".icon-copy");
  const checkIcon = elements.copyRevertButton.querySelector(".icon-check");
  const btnText = elements.copyRevertButton.querySelector(".secondary-btn-text");

  if (copyIcon && checkIcon) {
    copyIcon.classList.add("hidden");
    checkIcon.classList.remove("hidden");
  }
  if (btnText) btnText.textContent = "Restore Command Copied";

  setTimeout(() => {
    if (copyIcon && checkIcon) {
      copyIcon.classList.remove("hidden");
      checkIcon.classList.add("hidden");
    }
    if (btnText) {
      btnText.textContent = elements.copyRevertText
        ? elements.copyRevertText.textContent
        : "Copy Restore Command";
    }
  }, 1800);

  showToast("Restore command copied");
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
  restoreFormState();
  renderModelPicker();

  // Preset buttons
  elements.presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      elements.presetButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const targetUrl = btn.dataset.url;
      if (targetUrl) {
        elements.baseUrlInput.value = targetUrl;
        invalidateModels();
        saveFormState();
        if (!elements.apiKeyInput.value) {
          elements.apiKeyInput.focus();
        }
      }
    });
  });

  // Base URL input
  elements.baseUrlInput.addEventListener("input", () => {
    const currentVal = elements.baseUrlInput.value.trim();
    elements.presetButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.url === currentVal);
    });
    invalidateModels();
    saveFormState();
  });

  // Form submission
  elements.form.addEventListener("submit", handleFetchModels);

  // Toggle API key visibility
  elements.toggleKeyButton.addEventListener("click", handleTogglePassword);

  // Radio card options and select changes
  document
    .querySelectorAll('input[name="client"], input[name="platform"]')
    .forEach((input) => input.addEventListener("change", () => {
      updateOutput();
      saveFormState();
    }));
  elements.configModeToggle.addEventListener("change", () => {
    updateOutput();
    saveFormState();
  });

  elements.modelSelect.addEventListener("change", () => {
    updateOutput();
    saveFormState();
  });
  elements.apiKeyInput.addEventListener("input", () => {
    invalidateModels();
    saveFormState();
  });

  // Copy buttons
  elements.copyCommandButton.addEventListener("click", handleCopyCommand);
  elements.copyRevertButton.addEventListener("click", handleCopyRevert);

  // Initial render
  updateOutput();
}

// Run initialization
init();
