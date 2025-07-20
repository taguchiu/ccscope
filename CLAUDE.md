# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCScope (Claude Code Scope) is an interactive terminal-based browser for Claude Code conversation transcripts. It's a **pure Node.js application** with minimal dependencies (only Jest for testing) - built using Node.js standard library modules. The application provides a rich TUI (Terminal User Interface) for analyzing, exploring, and resuming Claude Code sessions.

## Essential Commands

### Primary Tools
```bash
npm start                           # Launch main interactive browser
node bin/ccscope                    # Direct execution

npm test                           # Run Jest test suite (489 tests)
npm run test:watch                 # Run tests in watch mode
npm run test:coverage              # Run tests with coverage report
```

### Development Commands
```bash
npm install                        # Install dependencies (Jest only)
npm run dev                        # Run with debug mode
ccscope --debug                    # Debug mode if globally installed

# Command-line utilities
ccscope daily                      # Daily conversation statistics
ccscope project                    # Project-grouped statistics
ccscope search "query"             # Search across all conversations
ccscope search "error OR warning"  # OR search
ccscope search --regex "pattern"   # Regex search
```

## Core Architecture

CCScope follows a modular MVC-like architecture with clear separation of concerns through service extraction.

### Main Components

#### Core Application Layer
1. **CCScope.js** - Main application orchestrator
   - Initializes components in dependency order
   - Handles application lifecycle and error management
   - Coordinates between all layers

2. **SessionManager.js** - Data layer orchestrator
   - Delegates to service classes for specific responsibilities
   - Manages caching with CacheManager
   - Coordinates file discovery, parsing, and conversation building

#### Service Layer (src/services/)
3. **ConversationBuilder.js** - Conversation processing engine
   - Builds conversation pairs from JSONL entries
   - **Compact Continuation Merging**: Automatically merges [Compact] continuation sessions into parent conversations
   - Handles sub-agent command detection and processing
   - Implements timestamp distribution for realistic timeline display
   - Post-processes conversations to merge compact continuations

4. **ContentExtractor.js** - Content parsing and extraction
   - Extracts user/assistant content from JSONL entries
   - Processes tool usage data and thinking content
   - Handles token usage extraction

5. **FileDiscoveryService.js** - File system operations
   - Discovers transcript files from `~/.claude/projects/` directory
   - Implements optimized recursive directory scanning
   - Handles file filtering and validation

6. **ProjectExtractor.js** - Project metadata extraction
   - Extracts project paths from `cwd` field in JSONL files
   - Determines project names from directory structures
   - Handles path normalization

7. **SessionStatisticsCalculator.js** - Metrics computation
   - Calculates response times, tool usage counts
   - Generates session summaries and statistics
   - Computes conversation duration and productivity metrics

#### Presentation and Interaction Layer
8. **StateManager.js** - Application state and business logic
   - Manages view state (session_list, conversation_detail, full_detail, search_results)
   - Implements virtual scrolling and navigation
   - Handles search state and filtering
   - Manages tool expansion state (expandedTools Map)

9. **ViewRenderer.js** - Presentation layer
   - Renders all UI views with responsive layouts
   - **Enhanced Display**: Shows Start Time → End Time format for conversations
   - Implements collapsible tool outputs (>20 lines, toggle with Ctrl+R)
   - Handles search highlighting and result formatting
   - Shows compact continuation markers in timeline

10. **InputHandler.js** - User interaction layer
    - Captures keyboard input and maps to actions
    - Implements session resume functionality (`r` key)
    - Handles search-aware navigation
    - Filters mouse events to prevent terminal artifacts

#### Support Components
11. **ThemeManager.js** - Visual styling and formatting
12. **MouseEventFilter.js** - Mouse event filtering for clean terminal output
13. **CacheManager.js** - Persistent caching for performance
14. **FastParser.js** - Optimized JSONL parser for large files

### Data Flow Architecture

```
File Discovery → JSONL Parsing → Conversation Building → Compact Merging → Caching
       ↓              ↓               ↓                    ↓             ↓
FileDiscoveryService → FastParser → ConversationBuilder → (Auto-merge) → CacheManager
                                          ↓
State Management ← View Rendering ← Content Processing
       ↓                ↓                ↓
StateManager → ViewRenderer ← ContentExtractor
       ↓
Input Handling
       ↓
InputHandler
```

### Key Implementation Features

**Compact Continuation Support**:
- **Automatic Merging**: [Compact] continuation sessions are automatically merged into parent conversations
- **Timeline Integration**: Shows compact continuation markers with timestamps in conversation timeline
- **UI Cleanup**: [Compact] prefix removed from session list and details, but preserved in conversation flow
- **Timestamp Distribution**: Realistic timeline progression across merged conversations

**Performance Optimizations**:
- **Persistent Caching**: CacheManager with version-based invalidation
- **Virtual Scrolling**: Limits rendered content to visible area
- **Optimized Parsing**: FastParser for efficient JSONL processing
- **Simple Loading**: Clean "Loading..." display without progress details

**Session Resume Integration**:
- Extracts full session ID from transcript filenames (UUID or hex format)
- Reads `cwd` field from JSONL to determine correct project directory
- Changes to project directory before executing `claude -r <session-id>`
- Available in all views via `r` key

**Enhanced User Experience**:
- **Dual Timestamps**: Shows both start and end times for each conversation
- **Tool Output Collapsing**: Long outputs (>20 lines) collapsed by default, Ctrl+R to toggle
- **Search-Aware Navigation**: Left/right arrows navigate search results when viewing from search
- **Responsive Layout**: Adapts to terminal size with wide/compact layouts

## Important Implementation Details

- **Pure Node.js**: Only external dependency is Jest for testing
- **No Build Process**: Direct execution of JavaScript files
- **Session ID Handling**: Full UUIDs extracted from filenames for accurate session resume
- **Project Path Detection**: Uses `cwd` field from JSONL for accurate directory context
- **Search Implementation**: Supports OR conditions and regex with result highlighting
- **Virtual Scrolling**: `contentHeight = terminalHeight - headerLines - footerLines - bufferLines`
- **Tool Usage Tracking**: Excludes Task tools from counts but shows in display
- **Response Time Indicators**: 🔴 >30s (slow), 🟡 10-30s (medium), 🟢 <10s (fast)

## Testing

Comprehensive Jest test suite with 489 tests across 10 test suites covering all major components. Tests include unit tests, integration tests, and edge case coverage with mock dependencies for file system and terminal I/O.

## Transcript Format

Expects Claude Code transcripts in JSONL format with:
- `type`: "user" or "assistant"
- `timestamp`: ISO timestamp
- `message.content`: Message content (string or array of objects)
- `cwd`: Current working directory for project context
- `isCompactSummary`: Boolean flag for compact continuation detection
- Tool usage and thinking content embedded in assistant messages