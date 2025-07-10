# CCScope 🔍

Claude Code Scope - Interactive terminal browser for Claude Code conversation transcripts

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Screenshots

### Session List View
Explore your Claude Code sessions with rich metadata and intuitive navigation.

```
🔍 Claude Code Scope
================================================================================
📊 42 Sessions | 💬 156 Convos | ⏱️ 2h30min
🔽 Filters: None | 📊 Sort: Last Activity ↓

No.  ID               Project              Conversations Duration   Started      Last Updated
────────────────────────────────────────────────────────────────────────────────────────────
▶ 1   abc123ef         ccscope              8            45min       07/10 14:30  07/10 15:15
  2   def456gh         sms-proto           12            1h20min     07/09 10:15  07/09 11:35
  3   ghi789jk         refactor-project     5            25min       07/08 16:20  07/08 16:45
  4   lmn012op         api-design          15            2h15min     07/07 09:30  07/07 11:45
  5   qrs345tu         debugging-session    3            18min       07/06 13:20  07/06 13:38

────────────────────────────────────────────────────────────────────────────────────────────
Selected: ccscope - abc123ef
📁 File: /Users/user/.claude/projects/ccscope/session-abc123ef.jsonl
📝 Recent Activity:
   1. Help me refactor the ViewRenderer component for better modularity
   2. Add support for full-width characters in terminal display
   3. Implement virtual scrolling for performance optimization
   4. Create comprehensive search and filter functionality
   5. Add multi-theme support with dark and light modes

↑/↓ to select · Enter to view details · f filter · s sort · h help · q exit
```

### Conversation Detail View
Deep dive into individual conversations with detailed analytics and tool usage tracking.

```
🔍 Claude Code Scope
================================================================================
💬 8 Convos | ⏱️ 45min
Selected: ccscope - abc123ef
📁 File: /Users/user/.claude/projects/ccscope/session-abc123ef.jsonl
📊 Sort: DateTime ↓

No. DateTime     Duration Tools  User Message
──────────────────────────────────────────────────────────────────────────────
▶ 1 07/10 14:30  12.3s    3t     Help me refactor the ViewRenderer component
  2 07/10 14:35  8.7s     1t     Add support for full-width characters
  3 07/10 14:42  15.2s    5t     Implement virtual scrolling for performance
  4 07/10 14:48  6.4s     2t     Create search functionality with live filtering
  5 07/10 14:55  22.1s    7t     Add comprehensive keyboard navigation
  6 07/10 15:02  9.8s     1t     Implement theme switching capabilities
  7 07/10 15:08  18.6s    4t     Optimize rendering for large datasets
  8 07/10 15:15  11.2s    2t     Add session bookmarking and export features

────────────────────────────────────────────────────────────────────────────────
👤 Help me refactor the ViewRenderer component for better modularity and maintainability
🤖 I'll help you refactor the ViewRenderer component to improve its modularity. Let me analyze the current structure and propose improvements...
🔧 Tools: Read×2, Edit×1

↑/↓ to select conversation · Enter to view detail · ←/→ switch session · s sort · Esc back · q exit
```

### Full Detail View
Comprehensive view of conversation flow with thinking process, tool execution, and results.

```
🔍 Claude Code Scope
================================================================================
Full Detail: ccscope
Conversation #1 of 8                                                    [1-25/45] 55%

📅 07/10 14:30
⏱️ Response Time: 12.3s
🧠 Thinking Rate: 23.4%

👤 USER MESSAGE:
────────────────────────────────────────────────────────────────────────────────
Help me refactor the ViewRenderer component for better modularity and maintainability.
I want to separate concerns and make it easier to add new view types in the future.

🧠 THINKING PROCESS:
────────────────────────────────────────────────────────────────────────────────
[Thinking 1]
The user wants to refactor the ViewRenderer component to improve modularity. Looking at the current structure, I can see that ViewRenderer handles multiple responsibilities:
1. Rendering different view types (session list, conversation detail, full detail)
2. Managing layout calculations
3. Handling terminal sizing and responsive design
4. Formatting content and applying themes

To improve modularity, I should suggest:
1. Extract each view type into separate renderer classes
2. Create a base renderer class with common functionality
3. Implement a factory pattern for view creation
4. Separate layout management from rendering logic
... (145 more characters)

🔧 TOOLS EXECUTION FLOW:
────────────────────────────────────────────────────────────────────────────────

[1] Read
  File: src/ViewRenderer.js
  
  ✅ Result:
  Successfully read ViewRenderer.js (1,402 lines). The file contains a large class with multiple responsibilities...

[2] Edit
  File: src/ViewRenderer.js
  Replace: "renderSessionList(viewData) {"
  With: "renderSessionList(viewData) {\n    // Extract to SessionListRenderer"
  
  ✅ Result:
  File updated successfully. Added extraction comment for future refactoring.

🤖 ASSISTANT RESPONSE:
────────────────────────────────────────────────────────────────────────────────
I'll help you refactor the ViewRenderer component to improve modularity. Based on my analysis, 
here's a comprehensive refactoring plan:

## Current Issues
- Single large class with multiple responsibilities
- View-specific logic mixed with layout calculations
- Hard to add new view types without modifying existing code

## Proposed Refactoring Structure

### 1. Extract View Renderers
Create separate renderer classes for each view type:
- SessionListRenderer
- ConversationDetailRenderer  
- FullDetailRenderer
- SearchRenderer
- FilterRenderer
- HelpRenderer

### 2. Create Base Renderer Class
Extract common functionality into BaseRenderer:
- Terminal dimension management
- Layout calculations
- Text wrapping and truncation
- Theme application

### 3. Implement Factory Pattern
Create ViewRendererFactory to manage renderer instances and provide a clean interface.

Let me implement this step by step...

↑/↓ 5-line scroll · Space/b page · g/G top/bottom · ←/→ prev/next conversation · Esc back · q exit
```

## Overview

CCScope (Claude Code Scope) is a powerful terminal-based application that allows you to browse, analyze, and explore your Claude Code conversation transcripts. It provides an intuitive interface for navigating through sessions, analyzing thinking patterns, response times, and tool usage.

## Features

- 🔍 **Interactive Browsing**: Navigate through sessions and conversations with vim-like keybindings
- 📊 **Rich Analytics**: Analyze thinking rates, response times, and tool usage statistics
- 🎨 **Multiple Themes**: Choose from default, dark, light, or minimal themes
- 🔎 **Search & Filter**: Find specific conversations or filter by project
- 📱 **Responsive Design**: Adapts to your terminal size with wide and compact layouts
- 🌐 **Multi-language**: Support for English and Japanese
- ⚡ **Performance**: Virtual scrolling and caching for large datasets
- 🔧 **Tool Analysis**: Detailed breakdown of tool usage and execution flow
- 💭 **Thinking Process**: View and analyze Claude's thinking patterns
- 📈 **Session Metrics**: Track conversation duration, response times, and productivity

## Installation

### Global Installation (Recommended)

```bash
npm install -g ccscope
```

### Local Installation

```bash
git clone https://github.com/taguchiu/ccscope.git
cd ccscope
npm install
npm link
```

## Usage

### Basic Usage

```bash
# Start CCScope
ccscope

# Start with debug mode
ccscope --debug

# Use a specific theme
ccscope --theme dark

# Set language to Japanese
ccscope --language ja

# Show help
ccscope --help
```

### Navigation

#### Session List View
- `↑/↓` or `k/j`: Navigate up/down
- `Enter`: View session conversations
- `f`: Filter by project
- `s`: Sort sessions (last activity, duration, conversations, start time, project name)
- `/`: Search sessions
- `h` or `?`: Show help
- `q`: Exit

#### Conversation Detail View
- `↑/↓` or `k/j`: Navigate conversations
- `←/→` or `h/l`: Switch sessions
- `Enter`: View full conversation detail
- `s`: Sort conversations (date/time, duration, tools)
- `Esc`: Back to session list

#### Full Detail View
- `↑/↓`: Scroll content (5-line increments)
- `Space/b`: Page up/down
- `g/G`: Jump to top/bottom
- `←/→`: Previous/next conversation
- `Esc`: Back to conversation list

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `q` | Quit application |
| `h` or `?` | Show help |
| `/` | Search |
| `f` | Filter |
| `s` | Sort |
| `r` | Refresh |
| `Esc` | Go back |
| `Enter` | Select/Enter |

## Configuration

CCScope automatically discovers Claude Code transcripts in these directories:
- `~/.claude/projects/`
- `~/.config/claude/transcripts/`
- `./transcripts/`
- `./`

### Supported Formats

CCScope reads Claude Code transcript files in JSONL format (`.jsonl` extension).

### Themes

Available themes:
- `default`: Standard terminal colors
- `dark`: Dark theme with blue accents
- `light`: Light theme with subdued colors
- `minimal`: Minimalist black and white

### Languages

Supported languages:
- `en`: English (default)
- `ja`: Japanese

## Development

### Project Structure

```
ccscope/
├── bin/                 # Executable scripts
│   └── ccscope         # Main CLI entry point
├── src/                # Source code
│   ├── config.js       # Configuration
│   ├── SessionManager.js
│   ├── StateManager.js
│   ├── ViewRenderer.js
│   ├── InputHandler.js
│   ├── ThemeManager.js
│   └── CCScope.js
├── CLAUDE.md           # Claude Code integration guide
├── examples/           # Example files
├── package.json
├── README.md
└── LICENSE
```

### Architecture

CCScope follows a modular architecture:

- **CCScope**: Main application orchestrator
- **SessionManager**: Handles transcript discovery and parsing
- **StateManager**: Manages application state and navigation
- **ViewRenderer**: Handles UI rendering and display logic
- **InputHandler**: Processes keyboard input and key bindings
- **ThemeManager**: Manages visual themes and styling

### Building from Source

```bash
git clone https://github.com/taguchiu/ccscope.git
cd ccscope
npm install
npm start
```

### Development Commands

```bash
# Run in development mode
npm run dev

# Start the application
npm start

# Make binary executable
chmod +x bin/ccscope
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 🐛 [Report Issues](https://github.com/taguchiu/ccscope/issues)
- 💬 [Discussions](https://github.com/taguchiu/ccscope/discussions)
- 📧 Email: your.email@example.com

## Acknowledgments

- Built for the [Claude Code](https://claude.ai/code) community
- Inspired by terminal-based file browsers and analysis tools
- Special thanks to all contributors and users

---

Made with ❤️ for Claude Code users