/**
 * Leetion Onboarding Script
 * Handles the setup wizard flow and auto-detection
 * @version 1.0.0
 */

// Constants
const TEMPLATE_URL =
  "https://neelbansal.notion.site/2d87eb1c8c8a80538d0cf2f3aaf00e60?v=2d87eb1c8c8a81b4a9ab000c634980fa";
const INTEGRATIONS_URL = "https://www.notion.so/my-integrations";

// State
let currentStep = 1;
let apiKey = "";
let databaseId = "";
let isDetecting = false;

// DOM Elements
const elements = {
  // Progress
  progressSteps: document.querySelectorAll(".progress-step"),
  progressLines: document.querySelectorAll(".progress-line"),

  // Step cards
  step1: document.getElementById("step-1"),
  step2: document.getElementById("step-2"),
  step3: document.getElementById("step-3"),
  stepSuccess: document.getElementById("step-success"),

  // Step 1 elements
  btnOpenIntegrations: document.getElementById("btn-open-integrations"),
  inputApiKey: document.getElementById("input-api-key"),
  btnToggleKey: document.getElementById("btn-toggle-key"),
  apiKeyStatus: document.getElementById("api-key-status"),
  btnNext1: document.getElementById("btn-next-1"),

  // Step 2 elements
  btnOpenTemplate: document.getElementById("btn-open-template"),
  btnDetectDatabase: document.getElementById("btn-detect-database"),
  detectionWaiting: document.getElementById("detection-waiting"),
  detectionSuccess: document.getElementById("detection-success"),
  detectionError: document.getElementById("detection-error"),
  detectedDbId: document.getElementById("detected-db-id"),
  inputDatabaseId: document.getElementById("input-database-id"),
  btnBack2: document.getElementById("btn-back-2"),
  btnNext2: document.getElementById("btn-next-2"),

  // Step 3 elements
  btnVerify: document.getElementById("btn-verify"),
  verifyStatus: document.getElementById("verify-status"),
  btnBack3: document.getElementById("btn-back-3"),
  btnFinish: document.getElementById("btn-finish"),

  // Success
  btnStart: document.getElementById("btn-start"),
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkExistingSettings();
});

/**
 * Check if user already has settings configured
 */
async function checkExistingSettings() {
  try {
    const settings = await chrome.storage.sync.get([
      "notionApiKey",
      "notionDatabaseId",
    ]);

    if (settings.notionApiKey && settings.notionDatabaseId) {
      // Already configured, show success or redirect
      apiKey = settings.notionApiKey;
      databaseId = settings.notionDatabaseId;

      // Optionally skip to success
      // goToStep(4);
    }
  } catch (error) {
    console.error("Error checking settings:", error);
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Step 1
  elements.btnOpenIntegrations?.addEventListener("click", openIntegrations);
  elements.inputApiKey?.addEventListener("input", validateApiKey);
  elements.btnToggleKey?.addEventListener("click", toggleApiKeyVisibility);
  elements.btnNext1?.addEventListener("click", () => goToStep(2));

  // Step 2
  elements.btnOpenTemplate?.addEventListener("click", openTemplate);
  elements.btnDetectDatabase?.addEventListener("click", detectDatabaseFromTab);
  elements.inputDatabaseId?.addEventListener("input", validateDatabaseId);
  elements.btnBack2?.addEventListener("click", () => goToStep(1));
  elements.btnNext2?.addEventListener("click", () => goToStep(3));

  // Step 3
  elements.btnVerify?.addEventListener("click", verifyConnection);
  elements.btnBack3?.addEventListener("click", () => goToStep(2));
  elements.btnFinish?.addEventListener("click", finishSetup);

  // Success
  elements.btnStart?.addEventListener("click", startUsingExtension);

  // Listen for database ID detection from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "databaseDetected" && message.databaseId) {
      handleDatabaseDetected(message.databaseId);
    }
  });
}

/**
 * Navigate to a specific step
 */
function goToStep(step) {
  currentStep = step;

  // Update progress indicators
  elements.progressSteps.forEach((el, index) => {
    const stepNum = index + 1;
    el.classList.remove("active", "completed");

    if (stepNum < step) {
      el.classList.add("completed");
    } else if (stepNum === step) {
      el.classList.add("active");
    }
  });

  // Update progress lines
  elements.progressLines.forEach((el, index) => {
    if (index < step - 1) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });

  // Show correct step card
  [
    elements.step1,
    elements.step2,
    elements.step3,
    elements.stepSuccess,
  ].forEach((card) => {
    card?.classList.remove("active");
  });

  if (step === 1) elements.step1?.classList.add("active");
  else if (step === 2) elements.step2?.classList.add("active");
  else if (step === 3) elements.step3?.classList.add("active");
  else if (step === 4) {
    elements.stepSuccess?.classList.remove("hidden");
    elements.stepSuccess?.classList.add("active");
  }
}

/**
 * Open Notion integrations page
 */
function openIntegrations() {
  chrome.tabs.create({ url: INTEGRATIONS_URL });
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
  const input = elements.inputApiKey;
  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
}

/**
 * Validate API key input
 */
function validateApiKey() {
  const value = elements.inputApiKey.value.trim();
  const isValid =
    (value.startsWith("secret_") || value.startsWith("ntn_")) &&
    value.length > 20;

  elements.inputApiKey.classList.remove("valid", "invalid");
  elements.apiKeyStatus.classList.remove("success", "error");
  elements.apiKeyStatus.innerHTML = "";

  if (value.length > 0) {
    if (isValid) {
      apiKey = value;
      elements.inputApiKey.classList.add("valid");
      elements.apiKeyStatus.classList.add("success");
      elements.apiKeyStatus.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        Valid API key format
      `;
      elements.btnNext1.disabled = false;
    } else {
      elements.inputApiKey.classList.add("invalid");
      elements.apiKeyStatus.classList.add("error");
      elements.apiKeyStatus.innerHTML = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
  API key should start with "secret_" or "ntn_"
`;
      elements.btnNext1.disabled = true;
    }
  } else {
    elements.btnNext1.disabled = true;
  }
}

/**
 * Open Notion template page
 */
function openTemplate() {
  chrome.tabs.create({ url: TEMPLATE_URL });
}

/**
 * Start listening for database duplication
 */
function startDatabaseDetection() {
  isDetecting = true;
  elements.detectionWaiting?.classList.remove("hidden");
  elements.detectionSuccess?.classList.add("hidden");

  // Tell background script to start listening
  chrome.runtime.sendMessage({ action: "startDatabaseDetection" });
}

/**
 * Handle detected database ID
 */
function handleDatabaseDetected(id) {
  if (!isDetecting) return;

  isDetecting = false;
  databaseId = id;

  // Update UI
  elements.detectionWaiting?.classList.add("hidden");
  elements.detectionSuccess?.classList.remove("hidden");
  elements.detectedDbId.textContent = formatDatabaseId(id);
  elements.inputDatabaseId.value = id;
  elements.btnNext2.disabled = false;
}

/**
 * Format database ID with dashes for readability
 */
function formatDatabaseId(id) {
  if (id.length === 32) {
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(
      16,
      20
    )}-${id.slice(20)}`;
  }
  return id;
}

/**
 * Validate manual database ID input
 */
function validateDatabaseId() {
  const value = elements.inputDatabaseId.value.trim().replace(/-/g, "");
  const isValid = /^[a-f0-9]{32}$/i.test(value);

  if (isValid) {
    databaseId = value;
    elements.btnNext2.disabled = false;

    // Also show as detected
    elements.detectionWaiting?.classList.add("hidden");
    elements.detectionSuccess?.classList.remove("hidden");
    elements.detectedDbId.textContent = formatDatabaseId(value);
  } else {
    elements.btnNext2.disabled = true;
  }
}

/**
 * Verify the Notion connection works
 */
async function verifyConnection() {
  const btn = elements.btnVerify;
  const status = elements.verifyStatus;

  btn.disabled = true;
  btn.innerHTML = `
    <div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>
    Verifying...
  `;

  status.className = "verify-status";
  status.textContent = "";

  try {
    const response = await chrome.runtime.sendMessage({
      action: "verifyConnection",
      data: {
        apiKey: apiKey,
        databaseId: databaseId,
      },
    });

    if (response?.success) {
      status.className = "verify-status success";
      status.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:6px;">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        Connection successful! Found database "${
          response.databaseName || "LeetCode Tracker"
        }"
      `;
      elements.btnFinish.disabled = false;
    } else {
      throw new Error(response?.error || "Connection failed");
    }
  } catch (error) {
    status.className = "verify-status error";
    status.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:6px;">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      ${
        error.message ||
        "Failed to connect. Make sure you added Leetion to your database connections."
      }
    `;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <polyline points="22,4 12,14.01 9,11.01"/>
      </svg>
      Verify Connection
    `;
  }
}

/**
 * Save settings and finish setup
 */
async function finishSetup() {
  try {
    // Save to storage
    await chrome.storage.sync.set({
      notionApiKey: apiKey,
      notionDatabaseId: databaseId,
      onboardingComplete: true,
    });

    // Go to success screen
    goToStep(4);
  } catch (error) {
    console.error("Error saving settings:", error);
    alert("Failed to save settings. Please try again.");
  }
}

/**
 * Close onboarding and start using extension
 */
function startUsingExtension() {
  // Open LeetCode
  chrome.tabs.create({ url: "https://leetcode.com/problemset/" });

  // Close this tab
  window.close();
}

async function detectDatabaseFromTab() {
  const TEMPLATE_DB_ID = "2d87eb1c8c8a80538d0cf2f3aaf00e60";

  // Show the status container
  document.getElementById("detection-status")?.classList.remove("hidden");

  // Show loading, hide others
  elements.detectionWaiting?.classList.remove("hidden");
  elements.detectionSuccess?.classList.add("hidden");
  elements.detectionError?.classList.add("hidden");

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // Find the LAST (most recent) Notion tab
    const notionTab = tabs.findLast(
      (tab) =>
        tab.url &&
        (tab.url.includes("notion.so") || tab.url.includes("notion.site"))
    );

    if (!notionTab) {
      throw new Error("No Notion tab found");
    }

    const url = notionTab.url;
    console.log("Notion URL:", url);

    // Extract the 32-char hex ID from the URL
    // Handles: /username/ID, /username/Title-ID, /ID
    const match = url.match(/([a-f0-9]{32})/i);

    console.log("Match:", match);

    if (!match || !match[1]) {
      throw new Error("Could not find database ID in URL");
    }

    const detectedId = match[1];
    console.log("Detected ID:", detectedId);

    // Check if it's the template
    if (detectedId === TEMPLATE_DB_ID.replace(/-/g, "")) {
      elements.detectionWaiting?.classList.add("hidden");
      elements.detectionError?.classList.remove("hidden");
      elements.detectionError.querySelector("span").textContent =
        "This is the template, not your database. Please duplicate it first, then open your copy.";
      return;
    }

    // Success!
    databaseId = detectedId;
    elements.detectionWaiting?.classList.add("hidden");
    elements.detectionSuccess?.classList.remove("hidden");
    elements.detectedDbId.textContent = formatDatabaseId(detectedId);
    elements.inputDatabaseId.value = detectedId;
    elements.btnNext2.disabled = false;
  } catch (error) {
    console.error("Detection error:", error);
    elements.detectionWaiting?.classList.add("hidden");
    elements.detectionError?.classList.remove("hidden");
    elements.detectionError.querySelector("span").textContent =
      "No Notion tab found. Please open your duplicated database in another tab.";
  }
}
