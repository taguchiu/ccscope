# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCScope (Claude Code Scope) is an interactive terminal-based browser for Claude Code conversation transcripts. It's built in Node.js and provides a rich TUI (Terminal User Interface) for analyzing and exploring Claude Code session data.

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
ccscope search --regex "pattern"  # Regex search

# Show help
ccscope --help
```

### Development Commands
```bash
# Install dependencies (if any added in future)
npm install

# Run the application directly
node bin/ccscope

# Make binary executable (already done in setup)
chmod +x bin/ccscope
```

## Architecture

The application follows a modular MVC-like architecture with clear separation of concerns between data management, state control, view rendering, and input handling.

### Core Components and Data Flow

1. **CCScope.js** - Main application orchestrator
   - Initializes all components in correct order
   - Handles application lifecycle (startup, shutdown, error handling)
   - Coordinates between SessionManager → StateManager → ViewRenderer → InputHandler

2. **SessionManager.js** - Data layer
   - Discovers transcript files from multiple directories (`~/.claude/projects/`, `~/.config/claude/transcripts/`, etc.)
   - Parses JSONL transcript files into structured session objects
   - Calculates metrics: thinking rates, response times, tool usage counts
   - Provides search functionality across all conversations
   - Caches parsed data for performance

3. **StateManager.js** - Application state and business logic
   - Manages current view state (session_list, conversation_detail, full_detail, search_results, help)
   - Tracks selection indices, scroll positions, and navigation history
   - Handles filtering (by project) and sorting (multiple criteria)
   - Manages search state and results navigation
   - Implements virtual scrolling logic for large datasets
   - Maintains cache of filtered/sorted sessions

4. **ViewRenderer.js** - Presentation layer
   - Renders all UI views based on current state
   - Implements virtual scrolling for performance
   - Handles responsive layouts (wide/compact based on terminal width)
   - Manages fixed headers with proper scroll regions
   - Highlights search matches in conversation content
   - Formats session/conversation data with color coding

5. **InputHandler.js** - User interaction layer
   - Captures raw keyboard input using readline
   - Maps keys to actions based on current view context
   - Manages input modes (normal, search, filter, selection)
   - Handles search-aware navigation (navigates search results when coming from search)
   - Debounces rapid inputs for performance

6. **ThemeManager.js** - Visual styling
   - Provides color themes (default, dark, light, minimal)
   - Handles ANSI color formatting
   - Manages text width calculations for CJK characters
   - Provides consistent formatting methods for UI elements

### Key Architectural Patterns

**Event Flow**: User Input → InputHandler → StateManager → ViewRenderer → Terminal Output

**State Management**: 
- StateManager is the single source of truth for all UI state
- View changes trigger re-renders through ViewRenderer
- State changes are tracked for performance optimization

**Performance Optimizations**:
- Virtual scrolling limits rendered content to visible area
- Caching at multiple levels (parsed sessions, filtered results, layouts)
- Debounced input handling prevents excessive re-renders
- Lazy loading of conversation details

**Search Implementation**:
- Full-text search across all conversations
- Supports OR conditions ("error OR warning" or "error or warning")
- Regex search with --regex flag
- Search results maintain context for navigation
- Highlighting preserves original search terms in detail views

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
  sessionId: string,
  projectName: string,
  filePath: string,
  conversations: Conversation[],
  totalDuration: number,
  startTime: Date,
  lastActivity: Date,
  metrics: {
    avgResponseTime: number,
    totalThinkingTime: number,
    thinkingRate: number,
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
  thinkingTime: number,
  thinkingRate: number,
  tools: ToolUsage[],
  hasThinking: boolean
}
```

## Important Implementation Details

- Header format displays as "[sessionId] projectName" (e.g., "[52ccc342] ccscope")
- Virtual scrolling window is calculated as: `contentHeight = terminalHeight - headerLines - footerLines - bufferLines`
- Search-aware navigation: When viewing from search results, left/right keys navigate between search hits rather than conversations
- Thinking rate indicators: 🔴 >50% (ultra), 🟡 20-50% (high), 🟢 <20% (normal)
- Response time indicators: 🔴 >30s (slow), 🟡 10-30s (medium), 🟢 <10s (fast)
- Tool usage format: "Read×3, Edit×2, Bash×1" shows count per tool type

## Transcript Format

The application expects Claude Code transcripts in JSONL format with entries containing:
- `type`: "user" or "assistant"
- `timestamp`: ISO timestamp
- `message.content`: Message content (can be string or array of objects)
- Tool usage data embedded in assistant messages
- Thinking content in assistant messages with `type: "thinking"`