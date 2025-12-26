/**
 * Leetion Popup Script
 *
 * Main controller for the Chrome extension popup interface.
 * Handles UI interactions, data scraping, and communication with background script.
 *
 * @author Leetion
 * @version 1.1.1
 */

// CONFIGURATION & CONSTANTS

/**
 * Maps LeetCode tag names to our standardized tag names.
 * Used for auto-selecting tags when scraping from the problem page.
 */
const TAG_MAPPING = {
  array: "Arrays",
  "hash table": "Hashing",
  "hash-table": "Hashing",
  hashtable: "Hashing",
  "two pointers": "Two Pointers",
  "two-pointers": "Two Pointers",
  "sliding window": "Sliding Window",
  "sliding-window": "Sliding Window",
  "binary search": "Binary Search",
  "binary-search": "Binary Search",
  stack: "Stack",
  "linked list": "Linked List",
  "linked-list": "Linked List",
  tree: "Trees",
  "binary tree": "Trees",
  "binary-tree": "Trees",
  heap: "Heap",
  "priority queue": "Heap",
  "priority-queue": "Heap",
  backtracking: "Backtracking",
  graph: "Graphs",
  "depth-first search": "Graphs",
  "breadth-first search": "Graphs",
  dfs: "Graphs",
  bfs: "Graphs",
  "dynamic programming": "Dynamic Programming",
  "dynamic-programming": "Dynamic Programming",
  dp: "Dynamic Programming",
  greedy: "Greedy",
  interval: "Intervals",
  intervals: "Intervals",
  math: "Math",
  "bit manipulation": "Bit Manipulation",
  "bit-manipulation": "Bit Manipulation",
  string: "String",
  recursion: "Recursion",
  sorting: "Sorting",
  sort: "Sorting",
  matrix: "Matrix",
};

// APPLICATION STATE

/** @type {Object} Current problem data from LeetCode */
let problemData = {
  number: null,
  title: null,
  difficulty: null,
  code: null,
  language: null,
  url: null,
  scrapedTags: [],
  acceptanceRate: null,
  totalSubmissions: null,
  userAttempts: null,
};

/** @type {string[]} Currently selected tags */
let selectedTags = [];

/** @type {string} Current expertise level */
let selectedExpertise = "Medium";

/** @type {string|null} Existing Notion page ID */
let existingPageId = null;

/** @type {string} Current view name */
let currentView = "not-leetcode";

/** @type {string} Previous view for back navigation */
let previousView = "not-leetcode";

/** @type {number} User's attempt count for this problem */
let userAttemptCount = 0;

// DOM ELEMENT REFERENCES

const DOM = {
  views: {
    notLeetcode: document.getElementById("view-not-leetcode"),
    settings: document.getElementById("view-settings"),
    main: document.getElementById("view-main"),
  },
  settings: {
    apiKeyInput: document.getElementById("input-api-key"),
    databaseIdInput: document.getElementById("input-database-id"),
    spacedRepInput: document.getElementById("input-spaced-rep"),
    toggleApiKeyBtn: document.getElementById("btn-toggle-api-key"),
    toggleDbIdBtn: document.getElementById("btn-toggle-db-id"),
    saveBtn: document.getElementById("btn-save-settings"),
    status: document.getElementById("settings-status"),
  },
  nav: {
    settingsEmpty: document.getElementById("btn-settings-empty"),
    settingsMain: document.getElementById("btn-settings-main"),
    back: document.getElementById("btn-back"),
    drawing: document.getElementById("btn-drawing"),
  },
  problem: {
    number: document.getElementById("problem-number"),
    title: document.getElementById("problem-title"),
    difficulty: document.getElementById("problem-difficulty"),
    codePreview: document.getElementById("code-preview"),
    codeLanguage: document.getElementById("code-language"),
    refreshBtn: document.getElementById("btn-refresh-code"),
    statsContainer: document.getElementById("problem-stats"),
    statAcceptance: document.getElementById("stat-acceptance"),
    statSubmissions: document.getElementById("stat-submissions"),
    statAttempts: document.getElementById("stat-attempts"),
  },
  snapshots: {
    btn: document.getElementById("btn-snapshot"),
    list: document.getElementById("snapshots-list"),
    count: document.getElementById("snapshot-count"),
  },
  quickActions: {
    card: document.getElementById("card-quick-actions"),
    markReview: document.getElementById("btn-mark-review"),
    revisit: document.getElementById("btn-revisit"),
  },
  complexity: {
    time: document.getElementById("input-time-complexity"),
    space: document.getElementById("input-space-complexity"),
    suggestion: document.getElementById("complexity-suggestion"),
  },
  form: {
    tagsContainer: document.getElementById("tags-container"),
    notes: document.getElementById("input-notes"),
    remark: document.getElementById("input-remark"),
    altMethods: document.getElementById("input-alt-methods"),
    done: document.getElementById("input-done"),
  },
  save: {
    btn: document.getElementById("btn-save"),
    status: document.getElementById("save-status"),
  },
};

/** @type {Array} Code snapshots for current problem */
let codeSnapshots = [];

// VIEW MANAGEMENT

/**
 * Shows the specified view and hides all others.
 * @param {string} viewName - View to show ('not-leetcode', 'settings', 'main')
 */
function showView(viewName) {
  previousView = currentView;
  currentView = viewName;

  Object.values(DOM.views).forEach((view) => {
    if (view) view.classList.add("hidden");
  });

  const viewMap = {
    "not-leetcode": DOM.views.notLeetcode,
    settings: DOM.views.settings,
    main: DOM.views.main,
  };

  if (viewMap[viewName]) {
    viewMap[viewName].classList.remove("hidden");
  }
}

// INITIALIZATION

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await checkCurrentTab();
  setupEventListeners();
});

/**
 * Loads saved settings from Chrome storage.
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      "notionApiKey",
      "notionDatabaseId",
      "spacedRepetitionDays",
    ]);
    if (result.notionApiKey)
      DOM.settings.apiKeyInput.value = result.notionApiKey;
    if (result.notionDatabaseId)
      DOM.settings.databaseIdInput.value = result.notionDatabaseId;
    // Default to 30 days if not set
    DOM.settings.spacedRepInput.value = result.spacedRepetitionDays ?? 30;
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

/**
 * Loads persisted form state for a problem.
 * @param {number} problemNumber - Problem number
 */
async function loadPersistedFormState(problemNumber) {
  if (!problemNumber) return;

  try {
    const key = `form_state_${problemNumber}`;
    const result = await chrome.storage.local.get([key]);
    const state = result[key];

    if (state) {
      // Restore form fields
      if (state.notes) DOM.form.notes.value = state.notes;
      if (state.remark) DOM.form.remark.value = state.remark;
      if (state.altMethods) DOM.form.altMethods.value = state.altMethods;
      if (state.timeComplexity)
        DOM.complexity.time.value = state.timeComplexity;
      if (state.spaceComplexity)
        DOM.complexity.space.value = state.spaceComplexity;
      if (typeof state.done === "boolean") DOM.form.done.checked = state.done;

      // Restore expertise
      if (state.expertise) {
        selectedExpertise = state.expertise;
        document.querySelectorAll(".expertise-btn").forEach((btn) => {
          btn.classList.remove(
            "selected-low",
            "selected-medium",
            "selected-high"
          );
          if (btn.dataset.expertise === state.expertise) {
            btn.classList.add(`selected-${state.expertise.toLowerCase()}`);
          }
        });
      }

      // Restore tags
      if (state.tags?.length) {
        state.tags.forEach((tag) => {
          if (!selectedTags.includes(tag)) {
            selectedTags.push(tag);
            const btn = document.querySelector(`[data-tag="${tag}"]`);
            if (btn) btn.classList.add("selected");
          }
        });
      }

      console.log("Leetion: Restored form state for problem", problemNumber);
    }
  } catch (error) {
    console.error("Error loading form state:", error);
  }
}

/**
 * Persists current form state for a problem.
 */
async function persistFormState() {
  if (!problemData.number) return;

  try {
    const key = `form_state_${problemData.number}`;
    const state = {
      notes: DOM.form.notes.value,
      remark: DOM.form.remark.value,
      altMethods: DOM.form.altMethods.value,
      timeComplexity: DOM.complexity.time.value,
      spaceComplexity: DOM.complexity.space.value,
      done: DOM.form.done.checked,
      expertise: selectedExpertise,
      tags: selectedTags,
      timestamp: Date.now(),
    };

    await chrome.storage.local.set({ [key]: state });
  } catch (error) {
    console.error("Error persisting form state:", error);
  }
}

/**
 * Clears persisted form state for a problem.
 * @param {number} problemNumber - Problem number
 */
async function clearPersistedFormState(problemNumber) {
  if (!problemNumber) return;

  try {
    const key = `form_state_${problemNumber}`;
    await chrome.storage.local.remove([key]);
  } catch (error) {
    console.error("Error clearing form state:", error);
  }
}

/**
 * Checks if current tab is a LeetCode problem page.
 */
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = tab?.url || "";
    const isLeetCode =
      url.includes("leetcode.com/problems/") ||
      url.includes("leetcode.cn/problems/");

    if (isLeetCode) {
      showView("main");
      await scrapeProblemData(tab.id);
    } else {
      showView("not-leetcode");
    }
  } catch (error) {
    console.error("Error checking tab:", error);
    showView("not-leetcode");
  }
}

// DATA SCRAPING

/**
 * Scrapes problem data from the LeetCode page.
 * @param {number} tabId - Chrome tab ID
 */
async function scrapeProblemData(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractProblemDataFromPage,
      world: "MAIN", // Run in page context to access monaco global
    });

    if (results?.[0]?.result) {
      problemData = results[0].result;
      updateProblemUI();
      autoSelectScrapedTags(problemData.scrapedTags);

      // Load snapshots and form state for this problem
      await loadSnapshots(problemData.number);
      await loadPersistedFormState(problemData.number);

      await checkExistingEntry();
    }
  } catch (error) {
    console.error("Error scraping:", error);
  }
}

/**
 * Injected function to extract problem data from page.
 * @returns {Object} Problem data
 */
function extractProblemDataFromPage() {
  const data = {
    number: null,
    title: null,
    difficulty: null,
    code: null,
    language: null,
    url: window.location.href,
    scrapedTags: [],
  };

  // Extract title/number
  const titleSelectors = [
    '[data-cy="question-title"]',
    'a[href*="/problems/"][class*="text-title-large"]',
    'div[class*="text-title-large"]',
  ];

  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const match = el.textContent.trim().match(/^(\d+)\.\s*(.+)$/);
      if (match) {
        data.number = parseInt(match[1]);
        data.title = match[2];
        break;
      }
    }
  }

  // Fallback to document title
  if (!data.number) {
    const match = document.title.match(/^(\d+)\.\s*([^-|]+)/);
    if (match) {
      data.number = parseInt(match[1]);
      data.title = match[2].trim();
    }
  }

  // Extract difficulty
  const diffMap = { easy: "Easy", medium: "Medium", hard: "Hard" };
  const diffSelectors = [
    'div[class*="text-difficulty-easy"]',
    'div[class*="text-difficulty-medium"]',
    'div[class*="text-difficulty-hard"]',
    'div[class*="text-olive"]',
    'div[class*="text-yellow"]',
    'div[class*="text-pink"]',
  ];

  for (const sel of diffSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.textContent.toLowerCase().trim();
      for (const [key, val] of Object.entries(diffMap)) {
        if (text.includes(key) || sel.includes(key)) {
          data.difficulty = val;
          break;
        }
      }
      if (data.difficulty) break;
    }
  }

  // Extract code - Monaco is available globally as window.monaco
  // Use monaco.editor.getModels()[0].getValue() to get full code
  try {
    const models = monaco.editor.getModels();
    if (models && models.length > 0) {
      // Find the model with actual code (usually the first one with substantial content)
      for (const model of models) {
        const value = model.getValue();
        if (value && value.length > 10) {
          data.code = value;
          console.log(
            "Leetion: Got code via monaco.editor.getModels(), length:",
            value.length
          );
          break;
        }
      }
    }
  } catch (e) {
    console.log("Leetion: monaco.editor.getModels() failed:", e);
  }

  // Fallback: just get visible lines from DOM (incomplete but better than nothing)
  if (!data.code) {
    const linesContent = document.querySelector(".monaco-editor .view-lines");
    if (linesContent) {
      const lines = linesContent.querySelectorAll(".view-line");
      const lineData = Array.from(lines).map((line) => {
        const style = line.getAttribute("style") || "";
        const topMatch = style.match(/top:\s*([\d.]+)px/);
        const top = topMatch ? parseFloat(topMatch[1]) : 0;

        let text = line.innerText || "";
        text = text.replace(
          /[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g,
          " "
        );
        text = text.replace(/·/g, " ");
        text = text.replace(/[\u200B\u200C\u200D]/g, "");

        return { top, text };
      });

      lineData.sort((a, b) => a.top - b.top);
      data.code = lineData.map((l) => l.text).join("\n");
      console.log(
        "Leetion: Got code via DOM fallback (may be incomplete), lines:",
        lineData.length
      );
    }
  }

  // Extract language
  const languages = [
    "Python3",
    "Python",
    "JavaScript",
    "TypeScript",
    "Java",
    "C++",
    "C",
    "C#",
    "Go",
    "Ruby",
    "Swift",
    "Kotlin",
    "Rust",
    "Scala",
  ];
  for (const btn of document.querySelectorAll('button, div[role="button"]')) {
    if (languages.includes(btn.textContent.trim())) {
      data.language = btn.textContent.trim();
      break;
    }
  }
  if (!data.language) data.language = "Python3";

  // Extract tags
  document
    .querySelectorAll('a[href*="/tag/"], a[href*="/topics/"]')
    .forEach((el) => {
      const t = el.textContent.trim();
      if (t && t.length > 1 && t.length < 30 && !data.scrapedTags.includes(t)) {
        data.scrapedTags.push(t);
      }
    });

  return data;
}

/**
 * Auto-selects tags based on scraped data.
 * @param {string[]} scrapedTags - Tags from page
 */
function autoSelectScrapedTags(scrapedTags) {
  if (!scrapedTags?.length) return;

  scrapedTags.forEach((tag) => {
    const normalized = tag.toLowerCase().trim();
    const mapped = TAG_MAPPING[normalized];

    if (mapped && !selectedTags.includes(mapped)) {
      selectedTags.push(mapped);
      const btn = document.querySelector(`[data-tag="${mapped}"]`);
      if (btn) btn.classList.add("selected");
    }
  });
}

// UI UPDATES

/**
 * Updates UI with problem data.
 */
function updateProblemUI() {
  if (problemData.number)
    DOM.problem.number.textContent = `#${problemData.number}`;
  if (problemData.title) DOM.problem.title.textContent = problemData.title;

  if (problemData.difficulty) {
    DOM.problem.difficulty.textContent = problemData.difficulty;
    DOM.problem.difficulty.className =
      "difficulty-badge " + problemData.difficulty.toLowerCase();
  }

  if (problemData.code) {
    // Display code with HTML escaping only - no syntax highlighting to avoid issues
    const escaped = problemData.code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    DOM.problem.codePreview.innerHTML = escaped;
  }

  if (problemData.language)
    DOM.problem.codeLanguage.textContent = problemData.language;

  // Update problem stats if available
  updateProblemStats();
}

/**
 * Cleans code of Unicode artifacts.
 * @param {string} code - Raw code
 * @returns {string} Cleaned code
 */
function cleanCodeString(code) {
  if (!code) return "";
  return code
    .replace(/[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/·/g, " ");
}

/**
 * Populates form with existing entry data.
 * @param {Object} data - Existing data
 */
function populateExistingData(data) {
  if (data.tags?.length) {
    data.tags.forEach((tag) => {
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
        const btn = document.querySelector(`[data-tag="${tag}"]`);
        if (btn) btn.classList.add("selected");
      }
    });
  }

  if (data.expertise) {
    selectedExpertise = data.expertise;
    document.querySelectorAll(".expertise-btn").forEach((btn) => {
      btn.classList.remove("selected-low", "selected-medium", "selected-high");
      if (btn.dataset.expertise === data.expertise) {
        btn.classList.add(`selected-${data.expertise.toLowerCase()}`);
      }
    });
  }

  if (data.remark) DOM.form.remark.value = data.remark;
  if (data.notes) DOM.form.notes.value = data.notes;
  if (data.altMethods?.length)
    DOM.form.altMethods.value = data.altMethods.join(", ");
  DOM.form.done.checked = data.done || false;
}

// NOTION INTEGRATION

/**
 * Checks if problem exists in Notion.
 * Only populates form with Notion data if there's no local state saved.
 */
async function checkExistingEntry() {
  const settings = await chrome.storage.sync.get([
    "notionApiKey",
    "notionDatabaseId",
  ]);
  if (
    !settings.notionApiKey ||
    !settings.notionDatabaseId ||
    !problemData.number
  )
    return;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "checkExisting",
      data: {
        apiKey: settings.notionApiKey,
        databaseId: settings.notionDatabaseId,
        problemNumber: problemData.number,
      },
    });

    if (response?.exists) {
      existingPageId = response.pageId;

      // Check if we have local form state - if so, don't overwrite with Notion data
      const formStateKey = `form_state_${problemData.number}`;
      const localState = await chrome.storage.local.get([formStateKey]);
      const hasLocalState = !!localState[formStateKey];

      if (!hasLocalState) {
        // No local changes, safe to load from Notion
        populateExistingData(response);
      }

      updateSaveButton(true);

      // Show quick actions for existing entries
      DOM.quickActions.card?.classList.remove("hidden");

      // Load attempt count (always load this)
      if (response.attempts) {
        userAttemptCount = response.attempts;
        updateAttemptDisplay();
      }

      // Only load complexity from Notion if no local state
      if (!hasLocalState) {
        if (response.timeComplexity && DOM.complexity.time) {
          DOM.complexity.time.value = response.timeComplexity;
        }
        if (response.spaceComplexity && DOM.complexity.space) {
          DOM.complexity.space.value = response.spaceComplexity;
        }
      }

      showStatus(
        DOM.save.status,
        "Found existing entry - will update on save",
        "success"
      );
    }
  } catch (error) {
    console.error("Error checking existing:", error);
  }
}

/**
 * Saves problem to Notion.
 */
async function saveToNotion() {
  const settings = await chrome.storage.sync.get([
    "notionApiKey",
    "notionDatabaseId",
    "spacedRepetitionDays",
  ]);

  if (!settings.notionApiKey || !settings.notionDatabaseId) {
    showStatus(DOM.save.status, "Configure Notion settings first", "error");
    showView("settings");
    return;
  }

  if (!problemData.title) {
    showStatus(DOM.save.status, "No problem data. Try refreshing.", "error");
    return;
  }

  setSaveButtonLoading(true);

  try {
    const cleanedCode = cleanCodeString(problemData.code);
    const spacedRepDays = settings.spacedRepetitionDays ?? 30;
    console.log("Leetion: Sending spacedRepetitionDays:", spacedRepDays);

    // Include snapshots in save
    const snapshotsToSave = getSnapshotsForSave();

    const response = await chrome.runtime.sendMessage({
      action: "saveToNotion",
      data: {
        apiKey: settings.notionApiKey,
        databaseId: settings.notionDatabaseId,
        existingPageId,
        spacedRepetitionDays: spacedRepDays,
        problem: {
          number: problemData.number,
          title: problemData.title,
          difficulty: problemData.difficulty,
          code: cleanedCode,
          language: problemData.language,
          url: problemData.url,
          tags: selectedTags,
          expertise: selectedExpertise,
          notes: DOM.form.notes.value,
          remark: DOM.form.remark.value,
          altMethods: DOM.form.altMethods.value,
          done: DOM.form.done.checked,
          timeComplexity: DOM.complexity.time?.value || "",
          spaceComplexity: DOM.complexity.space?.value || "",
          attempts: userAttemptCount || 1,
          snapshots: snapshotsToSave,
        },
      },
    });

    if (response.success) {
      let message;
      if (response.updated) {
        if (response.contentUpdated) {
          message = "Updated with new code/notes!";
        } else {
          message = "Updated properties (code/notes preserved)";
        }
      } else {
        message = "Saved to Notion!";
      }
      showStatus(DOM.save.status, message, "success");

      // Clear persisted form state after successful save
      await clearPersistedFormState(problemData.number);

      if (!existingPageId && response.pageId) {
        existingPageId = response.pageId;
        updateSaveButton(true);
        DOM.quickActions.card?.classList.remove("hidden");
      }
    } else {
      showStatus(DOM.save.status, response.error || "Failed", "error");
    }
  } catch (error) {
    console.error("Save error:", error);
    showStatus(DOM.save.status, "Error connecting to Notion", "error");
  } finally {
    setSaveButtonLoading(false);
  }
}

// UI HELPERS

/**
 * Shows status message.
 * @param {HTMLElement} el - Status element
 * @param {string} msg - Message
 * @param {string} type - 'success' or 'error'
 */
function showStatus(el, msg, type) {
  if (!el) return;
  el.classList.remove("hidden", "status-success", "status-error");
  el.classList.add(`status-${type}`);
  el.textContent = msg;
  setTimeout(() => el.classList.add("hidden"), 4000);
}

/**
 * Updates save button text.
 * @param {boolean} isUpdate - Is updating existing
 */
function updateSaveButton(isUpdate) {
  const span = DOM.save.btn.querySelector("span");
  if (span) span.textContent = isUpdate ? "Update in Notion" : "Save to Notion";
}

/**
 * Sets save button loading state.
 * @param {boolean} loading - Is loading
 */
function setSaveButtonLoading(loading) {
  DOM.save.btn.disabled = loading;

  if (loading) {
    DOM.save.btn.innerHTML = `
      <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span>Saving...</span>
    `;
  } else {
    DOM.save.btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17,21 17,13 7,13 7,21"/>
        <polyline points="7,3 7,8 15,8"/>
      </svg>
      <span>${existingPageId ? "Update in Notion" : "Save to Notion"}</span>
    `;
  }
}

// EVENT LISTENERS

function setupEventListeners() {
  // Navigation
  DOM.nav.settingsEmpty?.addEventListener("click", () => showView("settings"));
  DOM.nav.settingsMain?.addEventListener("click", () => showView("settings"));
  DOM.nav.back?.addEventListener("click", () =>
    showView(previousView === "settings" ? "main" : previousView)
  );

  // Settings toggles
  DOM.settings.toggleApiKeyBtn?.addEventListener("click", () =>
    toggleInputVisibility(
      DOM.settings.apiKeyInput,
      DOM.settings.toggleApiKeyBtn
    )
  );
  DOM.settings.toggleDbIdBtn?.addEventListener("click", () =>
    toggleInputVisibility(
      DOM.settings.databaseIdInput,
      DOM.settings.toggleDbIdBtn
    )
  );

  // Save settings
  DOM.settings.saveBtn?.addEventListener("click", saveSettings);

  // Refresh code
  DOM.problem.refreshBtn?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await scrapeProblemData(tab.id);
  });

  // Drawing canvas
  DOM.nav.drawing?.addEventListener("click", openDrawingCanvas);

  // Snapshot button
  DOM.snapshots.btn?.addEventListener("click", saveSnapshot);

  // Tags - with form persistence
  DOM.form.tagsContainer?.querySelectorAll(".tag-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleTag(btn);
      persistFormState();
    });
  });

  // Expertise - with form persistence
  document.querySelectorAll(".expertise-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectExpertise(btn);
      persistFormState();
    });
  });

  // Quick Actions
  DOM.quickActions.markReview?.addEventListener("click", markForReviewTomorrow);
  DOM.quickActions.revisit?.addEventListener("click", revisitProblem);

  // Complexity - auto-suggest and persist
  DOM.complexity.time?.addEventListener("change", () => {
    suggestComplexity();
    persistFormState();
  });
  DOM.complexity.space?.addEventListener("change", () => {
    suggestComplexity();
    persistFormState();
  });

  // Form inputs - persist on input (debounced) AND blur (immediate)
  DOM.form.notes?.addEventListener("input", debounce(persistFormState, 500));
  DOM.form.notes?.addEventListener("blur", persistFormState);
  DOM.form.remark?.addEventListener("input", debounce(persistFormState, 500));
  DOM.form.remark?.addEventListener("blur", persistFormState);
  DOM.form.altMethods?.addEventListener(
    "input",
    debounce(persistFormState, 500)
  );
  DOM.form.altMethods?.addEventListener("blur", persistFormState);
  DOM.form.done?.addEventListener("change", persistFormState);

  // Save
  DOM.save.btn?.addEventListener("click", saveToNotion);
}

/**
 * Debounce helper function.
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function toggleInputVisibility(input, btn) {
  const isPass = input.type === "password";
  input.type = isPass ? "text" : "password";
  btn.classList.toggle("showing", isPass);
}

async function saveSettings() {
  const apiKey = DOM.settings.apiKeyInput.value.trim();
  const dbId = DOM.settings.databaseIdInput.value.trim();
  const spacedRep = parseInt(DOM.settings.spacedRepInput.value) || 0;

  const toSave = { spacedRepetitionDays: spacedRep };
  if (apiKey) toSave.notionApiKey = apiKey;
  if (dbId) toSave.notionDatabaseId = dbId;

  await chrome.storage.sync.set(toSave);
  showStatus(DOM.settings.status, "Settings saved!", "success");
}

/**
 * Opens the drawing canvas on the LeetCode page.
 */
async function openDrawingCanvas() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (e) {
    // Content script may already be loaded
  }

  setTimeout(() => {
    chrome.tabs.sendMessage(tab.id, { action: "openFloatingCanvas" }, () => {
      if (!chrome.runtime.lastError) window.close();
    });
  }, 100);
}

function toggleTag(btn) {
  const tag = btn.dataset.tag;
  if (selectedTags.includes(tag)) {
    selectedTags = selectedTags.filter((t) => t !== tag);
    btn.classList.remove("selected");
  } else {
    selectedTags.push(tag);
    btn.classList.add("selected");
  }
}

function selectExpertise(btn) {
  document.querySelectorAll(".expertise-btn").forEach((b) => {
    b.classList.remove("selected-low", "selected-medium", "selected-high");
  });
  selectedExpertise = btn.dataset.expertise;
  btn.classList.add(`selected-${selectedExpertise.toLowerCase()}`);
}

// QUICK ACTIONS

/**
 * Sets spaced repetition to tomorrow.
 */
async function markForReviewTomorrow() {
  console.log(
    "Leetion: markForReviewTomorrow called, existingPageId:",
    existingPageId
  );
  if (!existingPageId) {
    console.log("Leetion: No existingPageId, returning");
    return;
  }

  const settings = await chrome.storage.sync.get(["notionApiKey"]);
  console.log("Leetion: Got API key:", settings.notionApiKey ? "yes" : "no");
  if (!settings.notionApiKey) {
    showStatus(DOM.save.status, "Configure API key first", "error");
    return;
  }

  try {
    DOM.quickActions.markReview.disabled = true;
    DOM.quickActions.markReview.textContent = "Setting...";

    console.log("Leetion: Sending updateSpacedRepetition message...");
    const response = await chrome.runtime.sendMessage({
      action: "updateSpacedRepetition",
      data: {
        apiKey: settings.notionApiKey,
        pageId: existingPageId,
        days: 1,
      },
    });

    console.log("Leetion: Got response:", response);

    if (response?.success) {
      // Show success state with highlight
      DOM.quickActions.markReview.classList.add("quick-btn-success");
      DOM.quickActions.revisit.classList.remove("quick-btn-success");
      showStatus(DOM.save.status, "Review set for tomorrow!", "success");
    } else {
      showStatus(
        DOM.save.status,
        response?.error || "Failed to update",
        "error"
      );
    }
  } catch (error) {
    console.error("Leetion: Error in markForReviewTomorrow:", error);
    showStatus(DOM.save.status, "Failed to update", "error");
  } finally {
    DOM.quickActions.markReview.disabled = false;
    DOM.quickActions.markReview.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M9 16l2 2 4-4"/>
      </svg>
      Review Tomorrow
    `;
  }
}

/**
 * Resets spaced repetition to configured days from now.
 */
async function revisitProblem() {
  if (!existingPageId) return;

  const settings = await chrome.storage.sync.get([
    "notionApiKey",
    "spacedRepetitionDays",
  ]);
  if (!settings.notionApiKey) {
    showStatus(DOM.save.status, "Configure API key first", "error");
    return;
  }

  const days = settings.spacedRepetitionDays ?? 30;

  try {
    DOM.quickActions.revisit.disabled = true;
    DOM.quickActions.revisit.textContent = "Resetting...";

    // Increment attempt count
    userAttemptCount++;

    const response = await chrome.runtime.sendMessage({
      action: "updateSpacedRepetition",
      data: {
        apiKey: settings.notionApiKey,
        pageId: existingPageId,
        days: days,
        attempts: userAttemptCount,
      },
    });

    if (response?.success) {
      // Show success state with highlight
      DOM.quickActions.revisit.classList.add("quick-btn-success");
      DOM.quickActions.markReview.classList.remove("quick-btn-success");
      // Update UI
      updateAttemptDisplay();
      showStatus(
        DOM.save.status,
        `Reset! Next review in ${days} days`,
        "success"
      );
    } else {
      // Revert attempt count on failure
      userAttemptCount--;
      showStatus(
        DOM.save.status,
        response?.error || "Failed to update",
        "error"
      );
    }
  } catch (error) {
    userAttemptCount--;
    showStatus(DOM.save.status, "Failed to update", "error");
  } finally {
    DOM.quickActions.revisit.disabled = false;
    DOM.quickActions.revisit.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6"/>
        <path d="M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>
      Revisit (Reset)
    `;
  }
}

/**
 * Updates the attempt count display.
 */
function updateAttemptDisplay() {
  const attemptSpan =
    DOM.problem.statAttempts?.querySelector("span:last-child");
  if (attemptSpan) {
    attemptSpan.textContent = userAttemptCount.toString();
  }
}

// COMPLEXITY SUGGESTIONS

/**
 * Suggests complexity based on selected tags.
 */
function suggestComplexity() {
  // Auto-suggestion based on common patterns
  const suggestions = [];

  if (selectedTags.includes("Binary Search")) {
    if (!DOM.complexity.time.value)
      suggestions.push("Binary Search typically has O(log n) time");
  }
  if (selectedTags.includes("Two Pointers")) {
    if (!DOM.complexity.time.value)
      suggestions.push("Two Pointers typically has O(n) time");
  }
  if (selectedTags.includes("Dynamic Programming")) {
    if (!DOM.complexity.space.value)
      suggestions.push("DP often uses O(n) or O(n²) space");
  }
  if (selectedTags.includes("Sorting")) {
    if (!DOM.complexity.time.value)
      suggestions.push("Sorting typically has O(n log n) time");
  }
  if (selectedTags.includes("Hashing")) {
    if (!DOM.complexity.time.value)
      suggestions.push("Hash operations are typically O(1)");
    if (!DOM.complexity.space.value)
      suggestions.push("Hash tables use O(n) space");
  }

  if (suggestions.length > 0 && DOM.complexity.suggestion) {
    DOM.complexity.suggestion.textContent = "💡 " + suggestions[0];
    DOM.complexity.suggestion.classList.remove("hidden");
  } else if (DOM.complexity.suggestion) {
    DOM.complexity.suggestion.classList.add("hidden");
  }
}

/**
 * Updates problem stats display.
 */
function updateProblemStats() {
  if (problemData.acceptanceRate || problemData.totalSubmissions) {
    DOM.problem.statsContainer?.classList.remove("hidden");

    if (problemData.acceptanceRate) {
      const accSpan =
        DOM.problem.statAcceptance?.querySelector("span:last-child");
      if (accSpan) accSpan.textContent = problemData.acceptanceRate;
    }

    if (problemData.totalSubmissions) {
      const subSpan =
        DOM.problem.statSubmissions?.querySelector("span:last-child");
      if (subSpan)
        subSpan.textContent = formatNumber(problemData.totalSubmissions);
    }

    const attSpan = DOM.problem.statAttempts?.querySelector("span:last-child");
    if (attSpan) attSpan.textContent = userAttemptCount.toString();
  }
}

/**
 * Formats large numbers with K/M suffix.
 */
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

// CODE SNAPSHOTS

/**
 * Loads snapshots for a problem from storage.
 * @param {number} problemNumber - Problem number
 */
async function loadSnapshots(problemNumber) {
  if (!problemNumber) return;

  try {
    const key = `snapshots_${problemNumber}`;
    const result = await chrome.storage.local.get([key]);
    codeSnapshots = result[key] || [];
    renderSnapshots();
  } catch (error) {
    console.error("Error loading snapshots:", error);
    codeSnapshots = [];
  }
}

/**
 * Saves a new code snapshot.
 */
async function saveSnapshot() {
  if (!problemData.code || !problemData.number) {
    showStatus(DOM.save.status, "No code to snapshot", "error");
    return;
  }

  const cleanedCode = cleanCodeString(problemData.code);

  // Check for duplicate
  const isDuplicate = codeSnapshots.some((s) => s.code === cleanedCode);
  if (isDuplicate) {
    showStatus(DOM.save.status, "This exact code is already saved", "error");
    return;
  }

  const snapshot = {
    id: Date.now().toString(),
    code: cleanedCode,
    language: problemData.language,
    timestamp: Date.now(),
    label: `Solution ${codeSnapshots.length + 1}`,
  };

  codeSnapshots.push(snapshot);

  try {
    const key = `snapshots_${problemData.number}`;
    await chrome.storage.local.set({ [key]: codeSnapshots });
    renderSnapshots();
    showStatus(DOM.save.status, "Solution saved!", "success");
  } catch (error) {
    console.error("Error saving snapshot:", error);
    codeSnapshots.pop(); // Revert
    showStatus(DOM.save.status, "Failed to save solution", "error");
  }
}

/**
 * Deletes a snapshot.
 * @param {string} snapshotId - Snapshot ID
 */
async function deleteSnapshot(snapshotId) {
  codeSnapshots = codeSnapshots.filter((s) => s.id !== snapshotId);

  try {
    const key = `snapshots_${problemData.number}`;
    await chrome.storage.local.set({ [key]: codeSnapshots });
    renderSnapshots();
    showStatus(DOM.save.status, "Solution deleted", "success");
  } catch (error) {
    console.error("Error deleting snapshot:", error);
  }
}

/**
 * Shows code preview modal.
 * @param {Object} snapshot - Snapshot to preview
 * @param {number} index - Snapshot index
 */
function showCodeModal(snapshot, index) {
  const escapedCode = snapshot.code.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const modal = document.createElement("div");
  modal.className = "code-modal-overlay";
  modal.innerHTML = `
    <div class="code-modal">
      <div class="code-modal-header">
        <span class="code-modal-title">${snapshot.language} - Solution ${
    index + 1
  }</span>
        <button class="code-modal-close" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="code-modal-body">
        <pre>${escapedCode}</pre>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal
    .querySelector(".code-modal-close")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

/**
 * Renders snapshots list in UI.
 */
function renderSnapshots() {
  if (!DOM.snapshots.list) return;

  // Update count
  if (DOM.snapshots.count) {
    DOM.snapshots.count.textContent = codeSnapshots.length.toString();
  }

  if (codeSnapshots.length === 0) {
    DOM.snapshots.list.innerHTML =
      '<p class="snapshots-empty">Click "Save Solution" above to save your code to Notion.</p>';
    return;
  }

  DOM.snapshots.list.innerHTML = codeSnapshots
    .map((snapshot, index) => {
      const date = new Date(snapshot.timestamp);
      const timeStr = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dateStr = date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });

      return `
      <div class="snapshot-item" data-id="${snapshot.id}" data-index="${index}">
        <div class="snapshot-header">
          <div class="snapshot-info">
            <span class="snapshot-lang">${snapshot.language} - Solution ${
        index + 1
      }</span>
            <span class="snapshot-meta">${dateStr} at ${timeStr} · ${
        snapshot.code.split("\n").length
      } lines</span>
          </div>
          <div class="snapshot-actions-btns">
            <button class="snapshot-btn preview" title="View Code" data-action="preview">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="snapshot-btn delete" title="Delete" data-action="delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  // Add event listeners
  DOM.snapshots.list.querySelectorAll(".snapshot-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = btn.closest(".snapshot-item");
      const id = item.dataset.id;
      const index = parseInt(item.dataset.index);
      const action = btn.dataset.action;

      if (action === "delete") {
        deleteSnapshot(id);
      } else if (action === "preview") {
        const snapshot = codeSnapshots.find((s) => s.id === id);
        if (snapshot) showCodeModal(snapshot, index + 1);
      }
    });
  });
}

/**
 * Gets all snapshots to save to Notion.
 * @returns {Array} Array of snapshot objects
 */
function getSnapshotsForSave() {
  return codeSnapshots;
}
