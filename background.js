/**
 * Leetion Background Service Worker
 *
 * Handles Notion API communications for saving/updating problems.
 *
 * @author Leetion
 * @version 1.1.5
 */

// CONFIGURATION

const LANGUAGE_MAP = {
  Python: "python",
  Python3: "python",
  JavaScript: "javascript",
  TypeScript: "typescript",
  Java: "java",
  "C++": "c++",
  C: "c",
  "C#": "c#",
  Ruby: "ruby",
  Swift: "swift",
  Go: "go",
  Kotlin: "kotlin",
  Rust: "rust",
  Scala: "scala",
  PHP: "php",
  Dart: "dart",
  Racket: "racket",
  Erlang: "erlang",
  Elixir: "elixir",
  MySQL: "sql",
  "MS SQL Server": "sql",
  Oracle: "sql",
  PostgreSQL: "sql",
  Pandas: "python",
  React: "javascript",
};

const NOTION_API_VERSION = "2022-06-28";
const NOTION_TEXT_LIMIT = 1900;
const NOTION_RICH_TEXT_LIMIT = 2000; // Notion's limit for rich_text property content
let isDetectingDatabase = false;
const TEMPLATE_ORIGIN = "neelbansal.notion.site";

/**
 * Required database schema - will auto-create missing columns
 */
const DATABASE_SCHEMA = {
  Question: { type: "title" },
  "S No.": { type: "number", number: { format: "number" } },
  Level: {
    type: "select",
    select: {
      options: [
        { name: "Easy", color: "green" },
        { name: "Medium", color: "yellow" },
        { name: "Hard", color: "red" },
      ],
    },
  },
  Tag: { type: "multi_select", multi_select: { options: [] } },
  "My Expertise": {
    type: "select",
    select: {
      options: [
        { name: "Low", color: "red" },
        { name: "Medium", color: "yellow" },
        { name: "High", color: "green" },
      ],
    },
  },
  Done: { type: "checkbox", checkbox: {} },
  "Date (of first attempt)": { type: "date", date: {} },
  "Question Link": { type: "url", url: {} },
  Remark: { type: "rich_text", rich_text: {} },
  "Alternative Method Tags": {
    type: "multi_select",
    multi_select: { options: [] },
  },
  "Spaced Repetition": { type: "date", date: {} },
  "Time Complexity": {
    type: "select",
    select: {
      options: [
        { name: "O(1)", color: "green" },
        { name: "O(log n)", color: "green" },
        { name: "O(n)", color: "blue" },
        { name: "O(n log n)", color: "blue" },
        { name: "O(n²)", color: "yellow" },
        { name: "O(n³)", color: "orange" },
        { name: "O(2^n)", color: "red" },
        { name: "O(n!)", color: "red" },
      ],
    },
  },
  "Space Complexity": {
    type: "select",
    select: {
      options: [
        { name: "O(1)", color: "green" },
        { name: "O(log n)", color: "green" },
        { name: "O(n)", color: "blue" },
        { name: "O(n log n)", color: "blue" },
        { name: "O(n²)", color: "yellow" },
        { name: "O(n³)", color: "orange" },
        { name: "O(2^n)", color: "red" },
      ],
    },
  },
  Attempts: { type: "number", number: { format: "number" } },
};

// MESSAGE HANDLING

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Leetion Background: Received action:", request.action);
  handleMessage(request)
    .then((result) => {
      console.log("Leetion Background: Sending response:", result);
      sendResponse(result);
    })
    .catch((error) => {
      console.error("Leetion Background: Error:", error);
      sendResponse({ success: false, error: error.message });
    });
  return true;
});

// Listen for tab URL changes to detect database duplication
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isDetectingDatabase) return;
  if (!changeInfo.url) return;

  const url = changeInfo.url;

  // Check if URL is a Notion page (not the template)
  if (url.includes("notion.so") && !url.includes(TEMPLATE_ORIGIN)) {
    // Extract database ID from URL
    const patterns = [
      /notion\.so\/[^/]+\/[^/]+-([a-f0-9]{32})/i,
      /notion\.so\/[^/]+\/([a-f0-9]{32})/i,
      /notion\.so\/([a-f0-9]{32})/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const databaseId = match[1];

        // Send to onboarding page
        chrome.runtime.sendMessage({
          action: "databaseDetected",
          databaseId: databaseId,
        });

        isDetectingDatabase = false;
        break;
      }
    }
  }
});

async function handleMessage(request) {
  console.log("Leetion Background: Handling action:", request.action);
  switch (request.action) {
    case "saveToNotion":
      return await saveToNotion(request.data);
    case "checkExisting":
      return await checkExistingProblem(request.data);
    case "getStats":
      return await handleGetStats(request.data);
    case "startDatabaseDetection":
      isDetectingDatabase = true;
      return { success: true };
    case "verifyConnection":
      return await handleVerifyConnection(request.data);
    case "updateSpacedRepetition":
      console.log(
        "Leetion Background: updateSpacedRepetition called with:",
        request.data,
      );
      return await updateSpacedRepetition(request.data);
    default:
      throw new Error(`Unknown action: ${request.action}`);
  }
}

/**
 * Verify Notion connection works
 */
async function handleVerifyConnection(data) {
  const { apiKey, databaseId } = data;

  try {
    const response = await notionRequest(
      `databases/${databaseId}`,
      apiKey,
      "GET",
    );

    if (response && response.id) {
      let databaseName = "User's Leetion Template";
      if (response.title && response.title.length > 0) {
        databaseName = response.title.map((t) => t.plain_text).join("");
      }

      return {
        success: true,
        databaseName: databaseName,
      };
    } else {
      return {
        success: false,
        error: "Could not access database",
      };
    }
  } catch (error) {
    console.error("Verify connection error:", error);

    let errorMessage = error.message || "Connection failed";

    if (errorMessage.includes("unauthorized") || errorMessage.includes("401")) {
      errorMessage = "Invalid API key. Please check and try again.";
    } else if (
      errorMessage.includes("not_found") ||
      errorMessage.includes("404")
    ) {
      errorMessage =
        "Database not found. Make sure you added Leetion to connections.";
    } else if (
      errorMessage.includes("restricted") ||
      errorMessage.includes("403")
    ) {
      errorMessage =
        "Access denied. Please add Leetion integration to your database.";
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// NOTION API - QUERIES

/**
 * Ensures all required database columns exist, creating missing ones.
 */
async function ensureDatabaseSchema(apiKey, databaseId) {
  try {
    // Get current database schema
    const db = await notionRequest(`databases/${databaseId}`, apiKey, "GET");
    const existingProps = db.properties || {};

    // Find missing properties
    const missingProps = {};
    for (const [name, config] of Object.entries(DATABASE_SCHEMA)) {
      if (!existingProps[name]) {
        missingProps[name] = config;
        console.log(`Leetion: Will create missing column: ${name}`);
      }
    }

    // Create missing properties if any
    if (Object.keys(missingProps).length > 0) {
      console.log(
        `Leetion: Creating ${
          Object.keys(missingProps).length
        } missing columns...`,
      );
      await notionRequest(`databases/${databaseId}`, apiKey, "PATCH", {
        properties: missingProps,
      });
      console.log("Leetion: Database schema updated successfully");
    }

    return { success: true, created: Object.keys(missingProps) };
  } catch (error) {
    console.error("Leetion: Error ensuring schema:", error);
    // Don't throw - let the save continue and fail on specific properties if needed
    return { success: false, error: error.message };
  }
}

async function checkExistingProblem(data) {
  const { apiKey, databaseId, problemNumber } = data;
  if (!problemNumber) return { exists: false };

  try {
    const response = await notionRequest(
      `databases/${databaseId}/query`,
      apiKey,
      "POST",
      {
        filter: { property: "S No.", number: { equals: problemNumber } },
        page_size: 1,
      },
    );

    if (!response.results?.length) return { exists: false };

    const page = response.results[0];
    const props = page.properties;

    // Get existing page content
    const existingContent = await getPageContent(apiKey, page.id);

    return {
      exists: true,
      pageId: page.id,
      tags: extractMultiSelect(props["Tag"]),
      expertise: props["My Expertise"]?.select?.name || null,
      remark: extractRichText(props["Remark"]),
      altMethods: extractMultiSelect(props["Alternative Method Tags"]),
      done: props["Done"]?.checkbox || false,
      notes: existingContent.notes,
      existingCode: existingContent.code,
      timeComplexity: props["Time Complexity"]?.select?.name || "",
      spaceComplexity: props["Space Complexity"]?.select?.name || "",
      attempts: props["Attempts"]?.number || 1,
      hasQuestion: existingContent.hasQuestion,
    };
  } catch (error) {
    console.error("Leetion: Check existing error:", error);
    return { exists: false };
  }
}

/**
 * Gets existing page content (notes and code blocks by language).
 */
async function getPageContent(apiKey, pageId) {
  const content = {
    notes: "",
    codeBlocks: [], // Array of { language, code } objects
    hasQuestion: false,
  };

  try {
    const response = await notionRequest(
      `blocks/${pageId}/children?page_size=100`,
      apiKey,
      "GET",
    );

    let currentSection = "";

    for (const block of response.results || []) {
      if (block.type === "heading_2") {
        const heading = block.heading_2?.rich_text?.[0]?.plain_text || "";
        currentSection = heading.toLowerCase();

        if (heading === "Question") {
          content.hasQuestion = true;
        }
        continue;
      }

      if (currentSection === "notes") {
        if (block.type === "paragraph") {
          const text =
            block.paragraph?.rich_text?.map((t) => t.plain_text).join("") || "";
          if (text) content.notes += (content.notes ? "\n" : "") + text;
        } else if (block.type === "bulleted_list_item") {
          const text =
            block.bulleted_list_item?.rich_text
              ?.map((t) => t.plain_text)
              .join("") || "";
          if (text) content.notes += (content.notes ? "\n" : "") + "- " + text;
        } else if (block.type === "numbered_list_item") {
          const text =
            block.numbered_list_item?.rich_text
              ?.map((t) => t.plain_text)
              .join("") || "";
          if (text) content.notes += (content.notes ? "\n" : "") + "1. " + text;
        }
      }

      if (currentSection === "solution(s)" && block.type === "code") {
        const codeText =
          block.code?.rich_text?.map((t) => t.plain_text).join("") || "";
        let codeLang = block.code?.language || "plain text";
        // Normalize old invalid language codes
        if (codeLang === "cpp") codeLang = "c++";
        if (codeLang === "csharp") codeLang = "c#";
        const caption = block.code?.caption?.[0]?.plain_text || "";
        if (codeText) {
          content.codeBlocks.push({
            language: codeLang,
            caption: caption,
            code: codeText,
          });
        }
      }
    }

    return content;
  } catch (error) {
    console.error("Leetion: Error getting page content:", error);
    return content;
  }
}

// NOTION API - MUTATIONS

/**
 * Saves or updates a problem in Notion.
 * Smart update: preserves solutions in different languages.
 * Auto-creates missing database columns.
 */
async function saveToNotion(data) {
  const { apiKey, databaseId, problem, existingPageId, spacedRepetitionDays } =
    data;

  // Ensure all required columns exist (auto-create if missing)
  await ensureDatabaseSchema(apiKey, databaseId);

  const cleanedCode = cleanCode(problem.code);
  const properties = buildProperties(
    problem,
    existingPageId,
    spacedRepetitionDays,
  );

  // Determine if we have new content to save
  // Only snapshots count as "new code" - current editor code is just a preview
  try {
    let pageId;

    if (existingPageId) {
      // UPDATE existing page
      const updateResult = await updatePageContent(
        apiKey,
        existingPageId,
        databaseId,
        problem,
        spacedRepetitionDays,
      );
      pageId = updateResult.pageId;
      return updateResult;
    } else {
      // CREATE new page
      const children = buildPageContent({ ...problem, code: cleanedCode });
      pageId = await createPage(apiKey, databaseId, properties, children);
    }

    return {
      success: true,
      pageId,
      updated: !!existingPageId,
      contentUpdated: true, // For new pages, content is always new
    };
  } catch (error) {
    console.error("Leetion: Save error:", error);
    throw error;
  }
}

async function updatePageContent(
  apiKey,
  existingPageId,
  databaseId,
  problem,
  spacedRepetitionDays,
) {
  try {
    const cleanedCode = cleanCode(problem.code);
    const properties = buildProperties(
      problem,
      existingPageId,
      spacedRepetitionDays,
    );

    // Always update properties (Tags, Status, etc.)
    await notionRequest(`pages/${existingPageId}`, apiKey, "PATCH", {
      properties,
    });

    let pageId = existingPageId;

    // Handle Content Updates
    // We rebuild the content. If user has 'saveQuestion' true, we usually want to ensure Question is at top.
    const hasSnapshots = problem.snapshots && problem.snapshots.length > 0;
    const hasNotes = !!problem.notes;
    const hasNewContent = hasSnapshots || hasNotes || problem.saveQuestion;

    if (hasNewContent) {
      // Build the FULL intended content structure
      const intendedChildren = buildPageContent({
        ...problem,
        code: cleanedCode,
      });

      // Smart Overwrite:
      // 1. Fetch existing blocks
      // 2. Identify if "Question" section exists
      // 3. If "Question" exists and we are saving question -> Skip deleting it, Skip creating it

      const { blocksToDelete, blocksToCreate } = await prepareSmartUpdate(
        apiKey,
        existingPageId,
        intendedChildren,
        problem.saveQuestion,
      );

      if (blocksToDelete.length > 0) {
        await deleteBlocksList(apiKey, blocksToDelete);
      }

      if (blocksToCreate.length > 0) {
        await appendBlocksInBatches(apiKey, existingPageId, blocksToCreate);
      }

      console.log(
        `Leetion: Updated page. Deleted ${blocksToDelete.length}, Created ${blocksToCreate.length}`,
      );
    } else {
      console.log(
        "Leetion: No snapshots/notes, preserved existing page content",
      );
    }

    return {
      success: true,
      pageId,
      updated: true,
      contentUpdated: hasNewContent,
    };
  } catch (error) {
    console.error("Leetion: Save error:", error);
    throw error;
  }
}

async function createPage(apiKey, databaseId, properties, children) {
  const BATCH_SIZE = 100;

  const body = {
    parent: { database_id: databaseId },
    properties,
  };

  // Only include first 100 children in initial create
  if (children.length > 0) {
    body.children = children.slice(0, BATCH_SIZE);
  }

  const response = await notionRequest("pages", apiKey, "POST", body);
  const pageId = response.id;

  // Append remaining children in batches
  if (children.length > BATCH_SIZE) {
    const remaining = children.slice(BATCH_SIZE);
    await appendBlocksInBatches(apiKey, pageId, remaining);
  }

  return pageId;
}

async function prepareSmartUpdate(
  apiKey,
  pageId,
  intendedChildren,
  saveQuestion,
) {
  try {
    // Get all blocks
    let allBlocks = [];
    let cursor = undefined;
    do {
      const url = cursor
        ? `blocks/${pageId}/children?page_size=100&start_cursor=${cursor}`
        : `blocks/${pageId}/children?page_size=100`;
      const response = await notionRequest(url, apiKey, "GET");
      allBlocks = allBlocks.concat(response.results || []);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    // Find Headers
    // Notion API returns block objects. We check type and content.
    // Heading 2 is "heading_2". Content is in "rich_text".

    let questionHeaderIndex = -1;
    let solutionsHeaderIndex = -1;

    for (let i = 0; i < allBlocks.length; i++) {
      const b = allBlocks[i];
      if (b.type === "heading_2") {
        const text = b.heading_2?.rich_text?.[0]?.plain_text || "";
        if (text === "Question") questionHeaderIndex = i;
        if (text === "Solution(s)") solutionsHeaderIndex = i;
      }
    }

    // Logic:
    // If we are Saving Question, and Question Header Exists, and Solution Header Exists (so we know where it ends):
    // Then we KEEP everything before "Solution(s)".
    // We DELETE "Solution(s)" and everything after.
    // We CREATE only the "Solution(s)" part of intendedChildren.

    if (
      saveQuestion &&
      questionHeaderIndex !== -1 &&
      solutionsHeaderIndex !== -1 &&
      solutionsHeaderIndex > questionHeaderIndex
    ) {
      console.log("Leetion: Smart Update - Preserving Question Section");

      // Find split point in Intended Children
      // intendedChildren is an array of block objects we created in buildPageContent
      let intendedSplitIndex = -1;
      for (let i = 0; i < intendedChildren.length; i++) {
        const b = intendedChildren[i];
        if (
          b.type === "heading_2" &&
          b.heading_2?.rich_text?.[0]?.text?.content === "Solution(s)"
        ) {
          intendedSplitIndex = i;
          break;
        }
      }

      if (intendedSplitIndex !== -1) {
        return {
          blocksToDelete: allBlocks.slice(solutionsHeaderIndex), // Delete starting from "Solution(s)"
          blocksToCreate: intendedChildren.slice(intendedSplitIndex), // Add starting from "Solution(s)"
        };
      }
    }

    // Default: Delete everything, Create everything
    return {
      blocksToDelete: allBlocks,
      blocksToCreate: intendedChildren,
    };
  } catch (e) {
    console.error("Error in smart update prep", e);
    // Fallback
    return { blocksToDelete: [], blocksToCreate: intendedChildren };
  }
}

async function deleteBlocksList(apiKey, blocks) {
  // Delete in parallel batches. Since we have retry logic, we can be more aggressive.
  // Notion rate limit is ~3 req/sec. With retry, we can burst more.
  const PARALLEL_BATCH = 25;
  for (let i = 0; i < blocks.length; i += PARALLEL_BATCH) {
    const batch = blocks.slice(i, i + PARALLEL_BATCH);
    await Promise.all(
      batch.map((block) =>
        notionRequest(`blocks/${block.id}`, apiKey, "DELETE"),
      ),
    );
    // Minimal delay to allow other tasks or simple pacing, but rely on retry for backoff
    if (i + PARALLEL_BATCH < blocks.length) await sleep(20);
  }
}

/**
 * Appends blocks to a page in batches of 100 (Notion's limit).
 */
async function appendBlocksInBatches(apiKey, pageId, blocks) {
  const BATCH_SIZE = 100;

  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);
    await notionRequest(`blocks/${pageId}/children`, apiKey, "PATCH", {
      children: batch,
    });
  }
}

// NOTION API - HELPERS

async function notionRequest(endpoint, apiKey, method, body = null) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
    },
  };

  if (body) options.body = JSON.stringify(body);

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const response = await fetch(
        `https://api.notion.com/v1/${endpoint}`,
        options,
      );

      // Handle Rate Limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After") || "2"; // Default to 2s
        const waitTime = parseInt(retryAfter, 10) * 1000;
        console.warn(`Leetion: Rate limited. Retrying after ${waitTime}ms...`);
        await sleep(waitTime);
        attempt++;
        continue;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || `API error: ${response.status} - ${result.code}`,
        );
      }

      return result;
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) throw error; // Re-throw on last attempt
      console.warn(
        `Leetion: Request failed (attempt ${attempt + 1}). Retrying...`,
        error,
      );
      await sleep(1000 * Math.pow(2, attempt)); // Exponential backoff for other errors
      attempt++;
    }
  }
}

/**
 * Splits text into rich_text array for Notion properties.
 * Notion limits each rich_text block to 2000 characters.
 */
function splitRichText(text, maxLength = NOTION_RICH_TEXT_LIMIT) {
  if (!text) return [];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push({ type: "text", text: { content: remaining } });
      break;
    }

    // Find a good break point (prefer newline, then space)
    let breakPoint = maxLength;
    const newlineIndex = remaining.lastIndexOf("\n", maxLength);
    const spaceIndex = remaining.lastIndexOf(" ", maxLength);

    if (newlineIndex > maxLength * 0.5) {
      breakPoint = newlineIndex + 1;
    } else if (spaceIndex > maxLength * 0.5) {
      breakPoint = spaceIndex + 1;
    }

    chunks.push({
      type: "text",
      text: { content: remaining.substring(0, breakPoint) },
    });
    remaining = remaining.substring(breakPoint);
  }

  return chunks;
}

function buildProperties(problem, existingPageId, spacedRepetitionDays) {
  const properties = {
    Question: {
      title: [{ text: { content: problem.title || "Untitled Problem" } }],
    },
  };

  if (problem.number) properties["S No."] = { number: problem.number };
  if (problem.url) properties["Question Link"] = { url: problem.url };

  if (problem.tags?.length > 0) {
    properties["Tag"] = {
      multi_select: problem.tags.map((t) => ({ name: t })),
    };
  }

  if (problem.difficulty)
    properties["Level"] = { select: { name: problem.difficulty } };
  if (problem.expertise)
    properties["My Expertise"] = { select: { name: problem.expertise } };

  // Use splitRichText for Remark to handle content > 2000 chars
  if (problem.remark) {
    properties["Remark"] = {
      rich_text: splitRichText(problem.remark),
    };
  }

  if (problem.altMethods) {
    const methods = parseAltMethods(problem.altMethods);
    if (methods.length > 0) {
      properties["Alternative Method Tags"] = {
        multi_select: methods.map((m) => ({ name: m })),
      };
    }
  }

  properties["Done"] = { checkbox: problem.done || false };

  if (!existingPageId) {
    properties["Date (of first attempt)"] = {
      date: { start: new Date().toISOString().split("T")[0] },
    };
  }

  // Add complexity analysis
  if (problem.timeComplexity) {
    properties["Time Complexity"] = {
      select: { name: problem.timeComplexity },
    };
  }
  if (problem.spaceComplexity) {
    properties["Space Complexity"] = {
      select: { name: problem.spaceComplexity },
    };
  }

  // Add attempt count
  if (problem.attempts) {
    properties["Attempts"] = { number: problem.attempts };
  }

  // Add spaced repetition date
  console.log(
    "Leetion: spacedRepetitionDays received:",
    spacedRepetitionDays,
    typeof spacedRepetitionDays,
  );
  if (spacedRepetitionDays && spacedRepetitionDays > 0) {
    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + spacedRepetitionDays);
    const dateStr = reviewDate.toISOString().split("T")[0];
    console.log("Leetion: Setting Spaced Repetition to:", dateStr);
    properties["Spaced Repetition"] = { date: { start: dateStr } };
  } else {
    console.log("Leetion: Spaced repetition disabled or invalid");
  }

  return properties;
}

/**
 * Updates only the spaced repetition date for a page.
 */
async function updateSpacedRepetition(data) {
  const { apiKey, pageId, days, attempts } = data;

  try {
    const properties = {};

    // Set new spaced repetition date
    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + days);
    const dateStr = reviewDate.toISOString().split("T")[0];
    properties["Spaced Repetition"] = { date: { start: dateStr } };

    console.log("Leetion: Updating Spaced Repetition to:", dateStr);

    // Update attempts if provided
    if (attempts !== undefined) {
      properties["Attempts"] = { number: attempts };
      console.log("Leetion: Updating Attempts to:", attempts);
    }

    await notionRequest(`pages/${pageId}`, apiKey, "PATCH", { properties });

    console.log("Leetion: Spaced repetition updated successfully");
    return { success: true, date: dateStr };
  } catch (error) {
    console.error("Leetion: Failed to update spaced repetition:", error);
    return { success: false, error: error.message };
  }
}

function buildPageContent(problem) {
  const blocks = [];

  // 1. Question Section (if toggle enabled)
  if (problem.saveQuestion && problem.questionContent?.content) {
    blocks.push(createHeading("Question"));

    // Use trimmed description from popup if available, otherwise try to trim here
    let description = problem.questionContent.description;
    if (!description && problem.questionContent.content) {
      description = problem.questionContent.content;
      const exampleIndex = description.search(/Example\s*\d+|Example\s*:/i);
      if (exampleIndex > 0) {
        description = description.substring(0, exampleIndex).trim();
      }
    }

    // Description text (limit to reasonable length if it's huge, though splitRichText handles blocks)
    // We use createRichParagraphBlocks to handle text > 2000 chars automatically
    const descBlocks = createRichParagraphBlocks(description || "");
    blocks.push(...descBlocks);

    // Examples
    if (problem.questionContent.examples?.length > 0) {
      blocks.push(createSubheading("Examples"));
      problem.questionContent.examples.forEach((ex) => {
        // Use direct bold construction instead of markdown parsing to ensure it works
        blocks.push(createBoldParagraph(`Example ${ex.number}:`));

        // Input as Code Block
        blocks.push(createParagraph("Input:"));
        blocks.push(createCodeBlock(ex.input, "plain text"));

        // Output as Code Block
        blocks.push(createParagraph("Output:"));
        blocks.push(createCodeBlock(ex.output, "plain text"));

        // Explanation as Quote Block
        if (ex.explanation) {
          blocks.push(createParagraph("Explanation:"));
          blocks.push(createQuoteBlock(ex.explanation));
        }

        // Add a spacer (empty paragraph) between examples
        blocks.push(createParagraph(""));
      });
    }

    // Constraints
    if (problem.questionContent.constraints?.length > 0) {
      blocks.push(createSubheading("Constraints"));
      problem.questionContent.constraints.forEach((c) => {
        // Format constraints as code if they contain variable names (often inside ` ` in markdown)
        // But for now, bullet list is standard and clean.
        // User asked for "nicer" - maybe code blocks for the constraints themselves?
        // Usually constraints are short one-liners. Bullet list is best.
        blocks.push(createBulletedListItem(c));
      });
    }
  }

  // 2. Solutions Section
  const hasSnapshots = problem.snapshots && problem.snapshots.length > 0;

  // Only save snapshots - the "current code" is just a preview
  // Users must click "Save Snapshot" to add code to their Notion page
  if (hasSnapshots) {
    blocks.push(createHeading("Solution(s)"));

    for (let i = 0; i < problem.snapshots.length; i++) {
      const snapshot = problem.snapshots[i];
      // Skip question snapshots if we are using the new toggle method
      if (snapshot.type === "question") continue;

      const snapshotLang = LANGUAGE_MAP[snapshot.language] || "plain text";
      const date = new Date(snapshot.timestamp);
      const dateStr = date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      // Label: "Python3 - Solution 1 (Dec 26, 2025)"
      blocks.push(
        createSubheading(
          `${snapshot.language} - Solution ${i + 1} (${dateStr})`,
        ),
      );
      for (const chunk of splitIntoChunks(snapshot.code, NOTION_TEXT_LIMIT)) {
        blocks.push(createCodeBlock(chunk, snapshotLang, snapshot.language));
      }
    }
  } else if (problem.code && problem.code.trim()) {
    // Fallback: if no snapshots but there's code, save it (for backwards compatibility)
    const lang = LANGUAGE_MAP[problem.language] || "plain text";
    blocks.push(createHeading("Solution(s)"));
    for (const chunk of splitIntoChunks(problem.code, NOTION_TEXT_LIMIT)) {
      blocks.push(createCodeBlock(chunk, lang, problem.language));
    }
  }

  // Only add Notes section if there are notes
  if (problem.notes?.trim()) {
    blocks.push(createHeading("Notes"));
    const noteBlocks = parseNotesToBlocks(problem.notes);
    blocks.push(...noteBlocks);
  }

  return blocks;
}

/**
 * Creates a subheading block (H3).
 */
function createSubheading(text) {
  return {
    object: "block",
    type: "heading_3",
    heading_3: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

/**
 * Parses notes text into Notion blocks with rich text support.
 * Supports:
 * - Headings: # H1, ## H2, ### H3
 * - Bullet lists: - or *
 * - Numbered lists: 1. or 1)
 * - Bold: **text**
 * - Italic: *text* or _text_
 */
function parseNotesToBlocks(notes) {
  const blocks = [];
  const lines = notes.split("\n");
  let currentTextBuffer = "";

  const flushBuffer = () => {
    if (currentTextBuffer.trim()) {
      blocks.push(...createRichParagraphBlocks(currentTextBuffer));
    }
    currentTextBuffer = "";
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      // Empty line -> flush buffer, add empty paragraph
      flushBuffer();
      blocks.push(createParagraph(""));
      continue;
    }

    // Check for special block types
    const isHeading = /^#{1,3}\s+/.test(trimmed);
    const isList = /^([-*]|\d+[.)])\s+/.test(trimmed);

    if (isHeading || isList) {
      // Special block found. Flush any buffered text first.
      flushBuffer();

      // Heading 1: # text
      const h1Match = trimmed.match(/^#\s+(.+)$/);
      if (h1Match) {
        blocks.push(createHeading1(h1Match[1]));
        continue;
      }

      // Heading 2: ## text
      const h2Match = trimmed.match(/^##\s+(.+)$/);
      if (h2Match) {
        blocks.push(createHeading2(h2Match[1]));
        continue;
      }

      // Heading 3: ### text
      const h3Match = trimmed.match(/^###\s+(.+)$/);
      if (h3Match) {
        blocks.push(createHeading3(h3Match[1]));
        continue;
      }

      // Bullet list: starts with - or *
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        blocks.push(createBulletedListItem(bulletMatch[1]));
        continue;
      }

      // Numbered list: starts with digit(s) followed by . or )
      const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (numberedMatch) {
        blocks.push(createNumberedListItem(numberedMatch[1]));
        continue;
      }
    } else {
      // Regular text line. Append to buffer.
      // If adding this line exceeds Notion limit (extremely rare for single updates),
      // createRichParagraphBlocks will handle splitting later.
      // We add a space if buffer not empty to preserve word separation (though markdown usually needs 2 spaces or newline)
      // Notion treats newline in paragraph as shift+enter.
      // User requested "group them up". Let's join with \n to keep visual structure but single block.
      if (currentTextBuffer) {
        // Check if adding more would explode the buffer too much?
        // createRichParagraphBlocks handles splitting, so we can just accumulate.
        currentTextBuffer += "\n" + trimmed;
      } else {
        currentTextBuffer = trimmed;
      }
    }
  }

  // Final flush
  flushBuffer();

  return blocks;
}

// BLOCK CREATORS

function createHeading(text) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function createHeading1(text) {
  return {
    object: "block",
    type: "heading_1",
    heading_1: { rich_text: parseRichText(text) },
  };
}

function createHeading2(text) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: parseRichText(text) },
  };
}

function createHeading3(text) {
  return {
    object: "block",
    type: "heading_3",
    heading_3: { rich_text: parseRichText(text) },
  };
}

function createParagraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: text.trim() ? [{ type: "text", text: { content: text } }] : [],
    },
  };
}

function createBoldParagraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        { type: "text", text: { content: text }, annotations: { bold: true } },
      ],
    },
  };
}

/**
 * Creates paragraph block(s) for text, splitting if over 2000 chars.
 * Returns an array of blocks.
 */
function createRichParagraphBlocks(text) {
  if (!text || text.length <= NOTION_RICH_TEXT_LIMIT) {
    return [
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: parseRichText(text) },
      },
    ];
  }

  // Split long text into multiple paragraphs
  const blocks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= NOTION_RICH_TEXT_LIMIT) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: parseRichText(remaining) },
      });
      break;
    }

    // Find a good break point
    let breakPoint = NOTION_RICH_TEXT_LIMIT;
    const newlineIndex = remaining.lastIndexOf("\n", NOTION_RICH_TEXT_LIMIT);
    const spaceIndex = remaining.lastIndexOf(" ", NOTION_RICH_TEXT_LIMIT);

    if (newlineIndex > NOTION_RICH_TEXT_LIMIT * 0.5) {
      breakPoint = newlineIndex + 1;
    } else if (spaceIndex > NOTION_RICH_TEXT_LIMIT * 0.5) {
      breakPoint = spaceIndex + 1;
    }

    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: parseRichText(remaining.substring(0, breakPoint)),
      },
    });
    remaining = remaining.substring(breakPoint);
  }

  return blocks;
}

// Legacy single-block version for short text
function createRichParagraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: parseRichText(text) },
  };
}

function createBulletedListItem(text) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: parseRichText(text) },
  };
}

function createNumberedListItem(text) {
  return {
    object: "block",
    type: "numbered_list_item",
    numbered_list_item: { rich_text: parseRichText(text) },
  };
}

function createQuoteBlock(text) {
  return {
    object: "block",
    type: "quote",
    quote: { rich_text: parseRichText(text) },
  };
}

function createCodeBlock(code, language, caption) {
  return {
    object: "block",
    type: "code",
    code: {
      rich_text: [{ type: "text", text: { content: code } }],
      language,
      caption: caption ? [{ type: "text", text: { content: caption } }] : [],
    },
  };
}

/**
 * Parses text into Notion rich_text array with bold and italic annotations.
 */
function parseRichText(text) {
  if (!text || !text.trim()) {
    return [];
  }

  const richText = [];
  const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plainText = text.slice(lastIndex, match.index);
      if (plainText) {
        richText.push({
          type: "text",
          text: { content: plainText },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
          },
        });
      }
    }

    let content,
      bold = false,
      italic = false;

    if (match[2]) {
      content = match[2];
      bold = true;
      italic = true;
    } else if (match[3]) {
      content = match[3];
      bold = true;
    } else if (match[4]) {
      content = match[4];
      italic = true;
    } else if (match[5]) {
      content = match[5];
      italic = true;
    }

    if (content) {
      richText.push({
        type: "text",
        text: { content },
        annotations: {
          bold,
          italic,
          strikethrough: false,
          underline: false,
          code: false,
        },
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      richText.push({
        type: "text",
        text: { content: remaining },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
        },
      });
    }
  }

  if (richText.length === 0) {
    return [{ type: "text", text: { content: text } }];
  }

  return richText;
}

// UTILITIES

function cleanCode(code) {
  if (!code) return "";
  return code
    .replace(/[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/·/g, " ");
}

function splitIntoChunks(text, maxLength) {
  const chunks = [];
  let current = "";

  for (const line of text.split("\n")) {
    if ((current + line + "\n").length > maxLength) {
      if (current) chunks.push(current.trimEnd());
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }

  if (current) chunks.push(current.trimEnd());
  return chunks.length > 0 ? chunks : [""];
}

function parseAltMethods(methods) {
  if (Array.isArray(methods)) return methods;
  return methods
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractMultiSelect(prop) {
  return prop?.multi_select?.map((t) => t.name) || [];
}

function extractRichText(prop) {
  return prop?.rich_text?.[0]?.plain_text || "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

chrome.runtime.onInstalled.addListener((details) => {
  // Open onboarding on first install
  if (details.reason === "install") {
    chrome.storage.sync.get(["onboardingComplete"], (result) => {
      if (!result.onboardingComplete) {
        chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
      }
    });
  }

  // Setup alarms
  chrome.alarms.create("checkReviews", {
    periodInMinutes: 60,
  });
  checkDueReviews();
});

chrome.runtime.onStartup.addListener(() => {
  checkDueReviews();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name == "checkReviews") {
    checkDueReviews();
  }
});

async function checkDueReviews() {
  console.log("checkDueReviews started");

  try {
    const settings = await chrome.storage.sync.get([
      "notionApiKey",
      "notionDatabaseId",
    ]);
    console.log("Settings loaded:", {
      hasApiKey: !!settings.notionApiKey,
      hasDbId: !!settings.notionDatabaseId,
    });

    if (!settings.notionApiKey || !settings.notionDatabaseId) {
      console.log("Missing settings, returning early");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    console.log("Querying for date:", today);

    const response = await notionRequest(
      `databases/${settings.notionDatabaseId}/query`,
      settings.notionApiKey,
      "POST",
      {
        filter: {
          property: "Spaced Repetition",
          date: {
            on_or_before: today,
          },
        },
      },
    );

    console.log("Notion response:", response);

    const dueCount = response.results?.length || 0;
    console.log("Due count:", dueCount);

    if (dueCount > 0) {
      chrome.notifications.create(
        `reviewReminder-${today}`,
        {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "LeetCode Review Due",
          message: `You have ${dueCount} problem${
            dueCount > 1 ? "s" : ""
          } due for review today.`,
          priority: 2,
        },
        (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Notification error:",
              chrome.runtime.lastError.message,
            );
          } else {
            console.log("Notification created:", notificationId);
          }
        },
      );
    }
  } catch (error) {
    console.error("Error checking due reviews:", error);
  }
}

async function handleGetStats(data) {
  const { apiKey, databaseId } = data;

  try {
    const response = await notionRequest(
      `databases/${databaseId}/query`,
      apiKey,
      "POST",
      { page_size: 100 },
    );

    const results = response.results || [];
    let easy = 0,
      medium = 0,
      hard = 0,
      dueForReview = 0;
    const today = new Date().toISOString().split("T")[0];

    results.forEach((page) => {
      const props = page.properties;
      const difficulty = props.Level?.select?.name;

      if (difficulty === "Easy") easy++;
      else if (difficulty === "Medium") medium++;
      else if (difficulty === "Hard") hard++;

      const reviewDate = props["Spaced Repetition"]?.date?.start;
      if (reviewDate && reviewDate <= today) dueForReview++;
    });

    return {
      success: true,
      total: results.length,
      easy,
      medium,
      hard,
      dueForReview,
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return { success: false, error: error.message };
  }
}

console.log("Leetion: Background service worker loaded");
