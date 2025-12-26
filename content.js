/**
 * Leetion Content Script
 *
 * Injected into LeetCode pages to provide:
 * - Problem data extraction
 * - Floating drawing canvas overlay
 *
 * @author Leetion
 * @version 1.1.1
 */

(function () {
  "use strict";

  if (window.leetionContentLoaded) return;
  window.leetionContentLoaded = true;

  // MODULE STATE

  let canvasOverlay = null;
  let toolbar = null;
  let canvas = null;
  let ctx = null;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentColor = "#ff9500";
  let currentSize = 3;
  let currentTool = "pen";
  let history = [];
  let historyIndex = -1;
  let drawingModeEnabled = false;

  // MESSAGE HANDLING

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (
      request.action === "openFloatingCanvas" ||
      request.action === "toggleDrawingSidebar"
    ) {
      toggleCanvas();
      sendResponse({ success: true });
    } else if (request.action === "getProblemData") {
      sendResponse(extractProblemData());
    } else {
      sendResponse({ success: false });
    }
    return true;
  });

  // CANVAS MANAGEMENT

  function toggleCanvas() {
    if (canvasOverlay) {
      const isHidden = canvasOverlay.style.display === "none";
      canvasOverlay.style.display = isHidden ? "block" : "none";
      toolbar.style.display = isHidden ? "flex" : "none";
      if (!isHidden) setDrawingMode(false);
    } else {
      createCanvas();
    }
  }

  function createCanvas() {
    injectStyles();
    createCanvasOverlay();
    createToolbar();
    createHelpText();
    setupCanvasEvents();
    saveHistoryState();
    showHelp();
  }

  function injectStyles() {
    if (document.getElementById("leetion-styles")) return;

    const style = document.createElement("style");
    style.id = "leetion-styles";
    style.textContent = `
      #leetion-canvas-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2147483646;
        pointer-events: none;
        background: transparent;
      }
      #leetion-canvas-overlay.drawing-mode {
        pointer-events: auto;
        cursor: crosshair;
      }
      #leetion-canvas-overlay canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
      #leetion-toolbar {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        background: rgba(28, 28, 30, 0.98);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 14px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      }
      #leetion-toolbar * {
        box-sizing: border-box;
      }
      .lt-mode {
        font-size: 12px;
        font-weight: 500;
        color: rgba(255,255,255,0.5);
        padding: 6px 10px;
        background: rgba(255,255,255,0.08);
        border-radius: 6px;
        min-width: 70px;
        text-align: center;
      }
      .lt-mode.active {
        color: #ff9500;
        background: rgba(255,149,0,0.15);
      }
      .lt-divider {
        width: 1px;
        height: 28px;
        background: rgba(255,255,255,0.15);
        flex-shrink: 0;
      }
      .lt-btn {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        border: none;
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.8);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        flex-shrink: 0;
        padding: 0;
      }
      .lt-btn:hover {
        background: rgba(255,255,255,0.15);
        color: #fff;
      }
      .lt-btn.active {
        background: #ff9500;
        color: #000;
      }
      .lt-btn svg {
        width: 20px;
        height: 20px;
        pointer-events: none;
      }
      .lt-btn-text {
        height: 36px;
        padding: 0 14px;
        border-radius: 8px;
        border: none;
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.8);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
        font-family: inherit;
        transition: all 0.15s ease;
        flex-shrink: 0;
      }
      .lt-btn-text:hover {
        background: rgba(255,255,255,0.15);
        color: #fff;
      }
      .lt-btn-text svg {
        width: 16px;
        height: 16px;
        pointer-events: none;
      }
      .lt-btn-text.primary {
        background: #ff9500;
        color: #000;
      }
      .lt-btn-text.primary:hover {
        background: #ffaa33;
      }
      .lt-btn-text.danger {
        background: #ff453a;
        color: #fff;
      }
      .lt-btn-text.danger:hover {
        background: #ff6961;
      }
      .lt-color {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.15s ease;
        flex-shrink: 0;
        padding: 0;
      }
      .lt-color:hover {
        transform: scale(1.1);
      }
      .lt-color.active {
        border-color: #fff;
        box-shadow: 0 0 0 2px rgba(255,149,0,0.5);
      }
      .lt-slider {
        width: 80px;
        height: 6px;
        -webkit-appearance: none;
        appearance: none;
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
        outline: none;
        cursor: pointer;
      }
      .lt-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #ff9500;
        cursor: pointer;
        border: 2px solid #fff;
      }
      .lt-slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #ff9500;
        cursor: pointer;
        border: 2px solid #fff;
      }
      #leetion-help {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        background: rgba(28, 28, 30, 0.95);
        color: #fff;
        padding: 12px 20px;
        border-radius: 10px;
        font-size: 13px;
        font-family: -apple-system, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
      #leetion-help.visible {
        opacity: 1;
      }
      #leetion-help kbd {
        background: rgba(255,255,255,0.15);
        padding: 2px 8px;
        border-radius: 4px;
        margin: 0 3px;
        font-family: inherit;
      }
    `;
    document.head.appendChild(style);
  }

  function createCanvasOverlay() {
    canvasOverlay = document.createElement("div");
    canvasOverlay.id = "leetion-canvas-overlay";

    canvas = document.createElement("canvas");
    canvas.id = "leetion-canvas";
    canvasOverlay.appendChild(canvas);

    document.body.appendChild(canvasOverlay);

    ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
  }

  function createToolbar() {
    toolbar = document.createElement("div");
    toolbar.id = "leetion-toolbar";

    // Build toolbar HTML
    toolbar.innerHTML = `
      <span class="lt-mode" id="lt-mode">View</span>
      <div class="lt-divider"></div>
      <button type="button" class="lt-btn" id="lt-draw" title="Draw (D)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        </svg>
      </button>
      <button type="button" class="lt-btn" id="lt-eraser" title="Eraser (E)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.5 2.7c.8-.8 2-.8 2.8 0l5 5c.8.8.8 2 0 2.8L12 20"/>
        </svg>
      </button>
      <div class="lt-divider"></div>
      <button type="button" class="lt-color active" data-color="#ff9500" style="background:#ff9500" title="Orange"></button>
      <button type="button" class="lt-color" data-color="#ff453a" style="background:#ff453a" title="Red"></button>
      <button type="button" class="lt-color" data-color="#30d158" style="background:#30d158" title="Green"></button>
      <button type="button" class="lt-color" data-color="#0a84ff" style="background:#0a84ff" title="Blue"></button>
      <button type="button" class="lt-color" data-color="#ffffff" style="background:#ffffff" title="White"></button>
      <div class="lt-divider"></div>
      <input type="range" class="lt-slider" id="lt-size" min="1" max="20" value="3" title="Brush Size">
      <div class="lt-divider"></div>
      <button type="button" class="lt-btn" id="lt-undo" title="Undo (Ctrl+Z)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
        </svg>
      </button>
      <button type="button" class="lt-btn" id="lt-clear" title="Clear All">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3,6 5,6 21,6"/>
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
      <div class="lt-divider"></div>
      <button type="button" class="lt-btn-text" id="lt-download" title="Save to Downloads">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download
      </button>
      <button type="button" class="lt-btn-text primary" id="lt-done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        Done
      </button>
      <button type="button" class="lt-btn" id="lt-close" title="Close" style="background:#ff453a;color:#fff;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    document.body.appendChild(toolbar);
    setupToolbarEvents();
  }

  function createHelpText() {
    const help = document.createElement("div");
    help.id = "leetion-help";
    help.innerHTML = `Press <kbd>D</kbd> to draw, <kbd>E</kbd> for eraser, <kbd>Esc</kbd> to exit`;
    document.body.appendChild(help);
  }

  function resizeCanvas() {
    const currentImage = historyIndex >= 0 ? history[historyIndex] : null;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (currentImage) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = currentImage;
    }
  }

  // DRAWING FUNCTIONALITY

  function setDrawingMode(enabled) {
    drawingModeEnabled = enabled;
    const modeEl = document.getElementById("lt-mode");
    const drawBtn = document.getElementById("lt-draw");
    const eraserBtn = document.getElementById("lt-eraser");

    if (enabled) {
      canvasOverlay.classList.add("drawing-mode");
      modeEl.textContent = currentTool === "eraser" ? "Eraser" : "Draw";
      modeEl.classList.add("active");

      if (currentTool === "pen") {
        drawBtn.classList.add("active");
        eraserBtn.classList.remove("active");
      } else {
        drawBtn.classList.remove("active");
        eraserBtn.classList.add("active");
      }
    } else {
      canvasOverlay.classList.remove("drawing-mode");
      modeEl.textContent = "View";
      modeEl.classList.remove("active");
      drawBtn.classList.remove("active");
      eraserBtn.classList.remove("active");
    }
  }

  function setTool(tool) {
    currentTool = tool;
    const drawBtn = document.getElementById("lt-draw");
    const eraserBtn = document.getElementById("lt-eraser");
    const modeEl = document.getElementById("lt-mode");

    if (tool === "pen") {
      drawBtn.classList.add("active");
      eraserBtn.classList.remove("active");
      if (drawingModeEnabled) modeEl.textContent = "Draw";
    } else {
      drawBtn.classList.remove("active");
      eraserBtn.classList.add("active");
      if (drawingModeEnabled) modeEl.textContent = "Eraser";
    }
  }

  function saveHistoryState() {
    historyIndex++;
    history = history.slice(0, historyIndex);
    history.push(canvas.toDataURL());
  }

  function getCoordinates(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function startDrawing(e) {
    if (!drawingModeEnabled) return;
    isDrawing = true;
    const { x, y } = getCoordinates(e);
    lastX = x;
    lastY = y;
  }

  function draw(e) {
    if (!isDrawing || !drawingModeEnabled) return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);

    if (currentTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = currentSize * 4;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastX = x;
    lastY = y;
  }

  function stopDrawing() {
    if (isDrawing) {
      isDrawing = false;
      ctx.globalCompositeOperation = "source-over";
      saveHistoryState();
    }
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = history[historyIndex];
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      historyIndex = -1;
    }
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveHistoryState();
  }

  // EVENT SETUP

  function setupCanvasEvents() {
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseout", stopDrawing);
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);
    document.addEventListener("keydown", handleKeyboard);
  }

  function setupToolbarEvents() {
    // Draw button
    document.getElementById("lt-draw").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (currentTool === "pen" && drawingModeEnabled) {
        setDrawingMode(false);
      } else {
        setTool("pen");
        setDrawingMode(true);
      }
    });

    // Eraser button
    document
      .getElementById("lt-eraser")
      .addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentTool === "eraser" && drawingModeEnabled) {
          setDrawingMode(false);
        } else {
          setTool("eraser");
          setDrawingMode(true);
        }
      });

    // Color buttons
    document.querySelectorAll(".lt-color").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll(".lt-color").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        currentColor = btn.getAttribute("data-color");
        setTool("pen");
        if (!drawingModeEnabled) setDrawingMode(true);
      });
    });

    // Size slider
    document.getElementById("lt-size").addEventListener("input", function (e) {
      currentSize = parseInt(e.target.value);
    });

    // Undo
    document.getElementById("lt-undo").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      undo();
    });

    // Clear
    document.getElementById("lt-clear").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      clearCanvas();
    });

    // Download
    document
      .getElementById("lt-download")
      .addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        downloadImage();
      });

    // Done
    document.getElementById("lt-done").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      saveAndClose();
    });

    // Close
    document.getElementById("lt-close").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeCanvas();
    });
  }

  function handleKeyboard(e) {
    if (!canvasOverlay || canvasOverlay.style.display === "none") return;

    const key = e.key.toLowerCase();

    if (key === "escape") {
      if (drawingModeEnabled) {
        setDrawingMode(false);
      } else {
        closeCanvas();
      }
    } else if (key === "d") {
      setTool("pen");
      setDrawingMode(true);
    } else if (key === "e") {
      setTool("eraser");
      setDrawingMode(true);
    } else if (key === "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undo();
    }
  }

  // CANVAS ACTIONS

  function showHelp() {
    const help = document.getElementById("leetion-help");
    if (help) {
      help.classList.add("visible");
      setTimeout(function () {
        help.classList.remove("visible");
      }, 4000);
    }
  }

  function downloadImage() {
    if (!checkCanvasHasContent()) {
      alert("No drawing to save!");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "leetion-drawing-" + Date.now() + ".png";
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Visual feedback
    const btn = document.getElementById("lt-download");
    const originalText = btn.innerHTML;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg> Saved!';
    btn.style.background = "#30d158";
    btn.style.color = "#fff";
    setTimeout(function () {
      btn.innerHTML = originalText;
      btn.style.background = "";
      btn.style.color = "";
    }, 2000);
  }

  function saveAndClose() {
    if (checkCanvasHasContent()) {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      chrome.storage.local.set({ pendingDrawing: base64 });
    }
    closeCanvas();
  }

  function closeCanvas() {
    canvasOverlay.style.display = "none";
    toolbar.style.display = "none";
    setDrawingMode(false);
    const help = document.getElementById("leetion-help");
    if (help) help.classList.remove("visible");
  }

  function checkCanvasHasContent() {
    if (historyIndex > 0) return true;
    try {
      const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data;
      for (let i = 3; i < imageData.length; i += 4) {
        if (imageData[i] > 0) return true;
      }
    } catch (e) {
      return historyIndex > 0;
    }
    return false;
  }

  // PROBLEM DATA EXTRACTION

  function extractProblemData() {
    const data = {
      number: null,
      title: null,
      difficulty: null,
      code: null,
      language: null,
      url: window.location.href,
      scrapedTags: [],
      acceptanceRate: null,
      totalSubmissions: null,
    };

    try {
      // Extract title and number
      const titleSelectors = [
        '[data-cy="question-title"]',
        'a[href*="/problems/"][class*="text-title-large"]',
        'div[class*="text-title-large"]',
        'span[class*="text-title-large"]',
      ];

      for (let i = 0; i < titleSelectors.length; i++) {
        const el = document.querySelector(titleSelectors[i]);
        if (el) {
          const text = el.textContent.trim();
          const match = text.match(/^(\d+)\.\s*(.+)$/);
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
      const difficultySelectors = [
        'div[class*="text-difficulty-easy"]',
        'div[class*="text-difficulty-medium"]',
        'div[class*="text-difficulty-hard"]',
        'span[class*="text-difficulty"]',
        'div[class*="text-olive"]',
        'div[class*="text-yellow"]',
        'div[class*="text-pink"]',
      ];

      for (let i = 0; i < difficultySelectors.length; i++) {
        const el = document.querySelector(difficultySelectors[i]);
        if (el) {
          const text = el.textContent.toLowerCase().trim();
          if (
            text.indexOf("easy") >= 0 ||
            difficultySelectors[i].indexOf("easy") >= 0 ||
            difficultySelectors[i].indexOf("olive") >= 0
          ) {
            data.difficulty = "Easy";
            break;
          } else if (
            text.indexOf("medium") >= 0 ||
            difficultySelectors[i].indexOf("medium") >= 0 ||
            difficultySelectors[i].indexOf("yellow") >= 0
          ) {
            data.difficulty = "Medium";
            break;
          } else if (
            text.indexOf("hard") >= 0 ||
            difficultySelectors[i].indexOf("hard") >= 0 ||
            difficultySelectors[i].indexOf("pink") >= 0
          ) {
            data.difficulty = "Hard";
            break;
          }
        }
      }

      // Extract code using innerText
      const monacoEditor = document.querySelector(".monaco-editor");
      if (monacoEditor) {
        const linesContent = monacoEditor.querySelector(".view-lines");
        if (linesContent) {
          const lines = linesContent.querySelectorAll(".view-line");
          if (lines.length > 0) {
            const codeLines = [];
            for (let i = 0; i < lines.length; i++) {
              let text = lines[i].innerText || "";
              // Clean Unicode
              text = text.replace(
                /[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g,
                " "
              );
              text = text.replace(/·/g, " ");
              text = text.replace(/[\u200B\u200C\u200D]/g, "");
              codeLines.push(text);
            }
            data.code = codeLines.join("\n");
          }
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
      const buttons = document.querySelectorAll('button, div[role="button"]');
      for (let i = 0; i < buttons.length; i++) {
        const text = buttons[i].textContent.trim();
        if (languages.indexOf(text) >= 0) {
          data.language = text;
          break;
        }
      }
      if (!data.language) data.language = "Python3";

      // Extract tags
      const tagEls = document.querySelectorAll(
        'a[href*="/tag/"], a[href*="/topics/"]'
      );
      for (let i = 0; i < tagEls.length; i++) {
        const text = tagEls[i].textContent.trim();
        if (
          text &&
          text.length > 1 &&
          text.length < 30 &&
          data.scrapedTags.indexOf(text) < 0
        ) {
          data.scrapedTags.push(text);
        }
      }

      // Extract acceptance rate
      const allText = document.body.innerText;
      const acceptMatch = allText.match(
        /(?:Acceptance|Accepted)[:\s]*(\d+\.?\d*%)/i
      );
      if (acceptMatch) {
        data.acceptanceRate = acceptMatch[1];
      }

      const subMatch = allText.match(/(?:Submissions?)[:\s]*([\d,]+)/i);
      if (subMatch) {
        data.totalSubmissions = parseInt(subMatch[1].replace(/,/g, ""));
      }
    } catch (err) {
      console.error("Leetion: Error extracting data:", err);
    }

    return data;
  }

  console.log("Leetion: Content script loaded");
})();
