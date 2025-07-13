# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCScope (Claude Code Scope) is an interactive terminal-based browser for Claude Code conversation transcripts. It's a **pure Node.js application** with no external dependencies - built entirely using Node.js standard library modules. The application provides a rich TUI (Terminal User Interface) for analyzing, exploring, and resuming Claude Code sessions.

## Commands

### Running the Application
```bash
# Start interactive browser
npm start
# or
ccscope

# Run with debug mode
npm run dev
# or
ccscope --debug

# Command-line utilities
ccscope daily            # Daily conversation statistics
ccscope project          # Project-grouped statistics
ccscope search "query"   # Search across all conversations
ccscope search "error OR warning"  # OR search
ccscope search --regex "pattern"   # Regex search

# Show help
ccscope --help
```

### Development Commands
```bash
# No npm install needed - pure Node.js project!

# Run the application directly
node bin/ccscope

# Make binary executable (if needed)
chmod +x bin/ccscope
```

## Architecture

The application follows a modular MVC-like architecture with clear separation of concerns. **No build process or external dependencies required**.

### Core Components and Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│SessionManager│ ──> │StateManager │ ──> │ViewRenderer │ ──> │InputHandler │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
      ↑ (Data)         (State)             (UI)                 (Input)     │
      └───────────────────────────────────────────────────────────────────────┘
```

1. **CCScope.js** - Main application orchestrator
   - Initializes all components in correct order
   - Handles application lifecycle (startup, shutdown, error handling)
   - Coordinates between components

2. **SessionManager.js** - Data layer
   - Discovers transcript files from multiple directories (`~/.claude/projects/`, `~/.config/claude/transcripts/`, etc.)
   - Parses JSONL transcript files into structured session objects
   - Extracts project paths from `cwd` field in JSONL files
   - Extracts full session IDs from filenames (UUID or hex format)
   - Calculates metrics: response times, tool usage counts
   - Provides search functionality with OR operators and regex support
   - Caches parsed data for performance

3. **StateManager.js** - Application state and business logic
   - Manages current view state (session_list, conversation_detail, full_detail, search_results, help)
   - Tracks selection indices, scroll positions, and navigation history
   - Handles filtering (by project) and sorting (multiple criteria)
   - Manages search state and search-aware navigation
   - Implements virtual scrolling logic for large datasets
   - Maintains cache of filtered/sorted sessions

4. **ViewRenderer.js** - Presentation layer
   - Renders all UI views based on current state
   - Implements virtual scrolling for performance
   - Handles responsive layouts (wide/compact based on terminal width)
   - Manages fixed headers with proper scroll regions
   - Highlights search matches in conversation content
   - Formats session/conversation data with color coding
   - Shows [Continued] for resumed sessions

5. **InputHandler.js** - User interaction layer
   - Captures raw keyboard input using readline
   - Maps keys to actions based on current view context
   - Manages input modes (normal, search, filter, selection)
   - Handles search-aware navigation (navigates search results when coming from search)
   - Implements session resume functionality (`r` key)
   - Debounces rapid inputs for performance

6. **ThemeManager.js** - Visual styling
   - Provides color themes (default, dark, light, minimal)
   - Handles ANSI color formatting
   - Manages text width calculations for CJK characters
   - Provides consistent formatting methods for UI elements

### Key Features

**Session Resume** (`r` key):
- Extracts full session ID from transcript files (not the short display ID)
- Reads `cwd` field from JSONL to determine project directory
- Changes to project directory before executing `claude -r <session-id>`
- Available in all views (session list, conversation detail, full detail)

**Search Implementation**:
- Full-text search across all conversations
- OR conditions: `"error OR warning"` or `"error or warning"`
- Regex search: `--regex "import.*from"`
- Search results maintain context for navigation
- Left/right arrows navigate search results when viewing from search
- Highlighting preserves original search terms in detail views

**Performance Optimizations**:
- Virtual scrolling limits rendered content to visible area
- Caching at multiple levels (parsed sessions, filtered results, layouts)
- Debounced input handling prevents excessive re-renders
- Lazy loading of conversation details

### View Hierarchy and Navigation

```
Session List (default)
    ↓ Enter
Conversation Detail (for selected session)
    ↓ Enter
Full Detail (conversation content)
    ← Esc (returns to previous view)

Search Results (from any view via '/')
    ↓ Enter
Full Detail (with search highlighting)
    ← Esc (returns to search results)
```

### Data Structures

**Session Object**:
```javascript
{
  sessionId: string,           // Short display ID
  fullSessionId: string,       // Full UUID/hex for claude -r
  projectName: string,
  projectPath: string,         // Extracted from cwd field
  filePath: string,
  conversations: Conversation[],
  totalDuration: number,
  startTime: Date,
  lastActivity: Date,
  metrics: {
    avgResponseTime: number,
    toolUsageCount: number
  }
}
```

**Conversation Object**:
```javascript
{
  index: number,
  timestamp: Date,
  userMessage: string,
  assistantMessage: string,
  responseTime: number,
  tools: ToolUsage[]
}
```

## Important Implementation Details

- **No external dependencies**: Pure Node.js implementation, no npm install needed
- **Session ID extraction**: Full UUIDs extracted from filenames, not the short display IDs
- **Project path detection**: Reads `cwd` field from JSONL files for accurate directory
- **Header format**: Displays as "[sessionId] projectName" (e.g., "[52ccc342] ccscope")
- **Virtual scrolling window**: `contentHeight = terminalHeight - headerLines - footerLines - bufferLines`
- **Search-aware navigation**: When from search, left/right keys navigate search hits
- **Response time indicators**: 🔴 >30s (slow), 🟡 10-30s (medium), 🟢 <10s (fast)
- **Tool usage format**: "Read×3, Edit×2, Bash×1" shows count per tool type
- **Continuation sessions**: Shows [Continued] prefix for resumed sessions

## Transcript Format

The application expects Claude Code transcripts in JSONL format with entries containing:
- `type`: "user" or "assistant"
- `timestamp`: ISO timestamp
- `message.content`: Message content (can be string or array of objects)
- `cwd`: Current working directory (used for project path extraction)
- Tool usage data embedded in assistant messages
- Thinking content in assistant messages with `type: "thinking"`

## Testing and Linting

Currently no test framework or linting is configured. The test script exits with an error. The application is tested manually through interactive use.