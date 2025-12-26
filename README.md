# Leetion

Save your LeetCode solutions directly to Notion with one click.

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/leetion/jecnakakffleikibkbkdchdipmgeahpm)

## Features

- **One-Click Save** - Capture your LeetCode solutions directly to Notion
- **Multiple Snapshots** - Save different versions/approaches of your solution
- **Auto-Tagging** - Automatically detects problem tags (Arrays, DP, Trees, etc.)
- **Spaced Repetition** - Get reminded to review problems for better retention
- **Complexity Tracking** - Record time and space complexity with suggestions
- **Rich Notes** - Add personal notes, alternative methods, and remarks
- **Form Persistence** - Your unsaved work is preserved across sessions

## Installation

### Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store page](https://chromewebstore.google.com/detail/leetion/jecnakakffleikibkbkdchdipmgeahpm)
2. Click "Add to Chrome"
3. Follow the setup instructions below

### Manual Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the repository folder

## Setup

### 1. Get Your Notion API Key

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Name it "Leetion" and select your workspace
4. Copy the "Internal Integration Token"

### 2. Create Your Notion Database

Create a new database in Notion with these properties:

| Property            | Type                      | Required |
| ------------------- | ------------------------- | -------- |
| Name                | Title                     | Yes      |
| Number              | Number                    | Yes      |
| Difficulty          | Select (Easy/Medium/Hard) | Yes      |
| Tags                | Multi-select              | Yes      |
| Status              | Checkbox                  | Yes      |
| Expertise           | Select (Low/Medium/High)  | Yes      |
| Time Complexity     | Rich Text                 | Optional |
| Space Complexity    | Rich Text                 | Optional |
| Attempts            | Number                    | Optional |
| Notes               | Rich Text                 | Optional |
| Remark              | Rich Text                 | Optional |
| Alternative Methods | Rich Text                 | Optional |
| Date                | Date                      | Optional |
| Review              | Date                      | Optional |
| URL                 | URL                       | Optional |

### 3. Connect the Database

1. Open your Notion database
2. Click "..." menu → "Connections" → Add your "Leetion" integration
3. Copy the database ID from the URL:
   ```
   https://notion.so/workspace/DATABASE_ID?v=...
   ```

### 4. Configure Leetion

1. Click the Leetion extension icon
2. Enter your API key and Database ID
3. Click "Save Settings"

## Usage

1. Navigate to any LeetCode problem
2. Write your solution in the editor
3. Click the Leetion extension icon
4. Click "Save Solution" to capture your current code
5. Fill in optional details (complexity, notes, etc.)
6. Click "Save to Notion" to sync everything

**Tips:**

- Use multiple snapshots to save different approaches
- The form auto-saves locally, so you won't lose work
- Spaced repetition dates are calculated automatically
- Tags are auto-detected from LeetCode's problem tags

## File Structure

```
leetion/
├── manifest.json      # Extension configuration
├── popup.html         # Popup UI markup
├── popup.js           # Main popup logic & event handling
├── background.js      # Service worker for Notion API calls
├── content.js         # Content script
├── styles.css         # Styling
└── icons/             # Extension icons
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**If you fork this project or create a derivative work, please credit the original author (Neel).**
