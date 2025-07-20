# ccscope 🔍

[English](README.md) | [日本語](README.ja.md)

Claude Code Scope - Interactive terminal browser for Claude Code conversation transcripts

[![npm version](https://img.shields.io/npm/v/ccscope.svg)](https://www.npmjs.com/package/ccscope)
[![Downloads](https://img.shields.io/npm/dm/ccscope.svg)](https://npmjs.org/package/ccscope)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

ccscope (Claude Code Scope) is a powerful terminal-based application that allows you to browse, analyze, and explore your Claude Code conversation logs. It provides an intuitive interface for navigating through sessions, response times, and tool usage analysis.

## Features

- 🔍 **Interactive Browsing**: Navigate through sessions and conversations with vim-like keybindings
- 📊 **Rich Analytics**: View response times and tool usage statistics
- 🔎 **Full-text Search**: Search across all conversations with highlighting, OR conditions, and regex support
- 🔄 **Search Results Navigation**: Navigate search results with left/right keys when viewing from search
- 🔎 **Search & Filter**: Find specific conversations or filter by project
- 📱 **Responsive Design**: Adapts to your terminal size with wide and compact layouts
- 🔧 **Tool Analysis**: Detailed breakdown of tool usage and execution flow
- 📈 **Session Metrics**: Track conversation duration, response times, and productivity
- 🚀 **Session Resume**: Resume Claude Code sessions directly from ccscope with 'r' key
- 📑 **Collapsible Tool Output**: Long tool outputs (>20 lines) are collapsed by default, toggle with Ctrl+R

## Screenshots

### Session List View
```
📊 90 Sessions | ⏱️ 10d 15h 50m Duration | 💬 1757 Convos | 🔧 37.2k Tools | 🎯 14.2m Tokens
🔽 Filters: None | 📊 Sort: Last Activity ↓

No.   ID               Project                                 Conv. Duration        Tools   Tokens Start Time   End Time
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
▶ 1   52ee85b2         ccscope                                    22 4h 4m             649  251.4k  07/19 20:57  07/20 19:07
  2   585c655b         sms_proto                                   1 13m 49s            60   17.7k  07/20 18:49  07/20 19:03
  3   5b09d466         sms_proto                                  12 5h 30m            878  956.8k  07/20 12:10  07/20 18:47

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j to select · Enter to view details · r resume · / full-text search · f filter · s sort · h help · q exit
```

### Conversation Detail View
```
💬 22 Convos | ⏱️ 4h 4m
Selected: [52ee85b2] ccscope
📁 File: /Users/taguchiu/.claude/projects/-Users-taguchiu-Documents-workspace-ccscope/52ee85b2c94a1ee604f8e1e58328ad7db75e7330.jsonl

▶ 1  📅 07/19 20:57 → 07/19 21:06  🕐 8m 39s  🔧 30   Help me refactor the ViewRenderer component...
  2  📅 07/19 21:06 → 07/19 21:15  🕐 8m 51s  🔧 25   Add support for full-width character display...
  3  📅 07/19 21:15 → 07/19 21:25  🕐 9m 48s  🔧 35   Implement virtual scrolling for large datasets...

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j to select conversation · Enter to view detail · ←/→ or h/l switch session · r resume · s sort · Esc back · q exit
```

### Full Detail View
```
[52ee85b2] ccscope     [18-66/66] 100%
Conversation #15 of 22
========================================================================================================

👤 USER [07/19 20:57]:
Help me refactor the ViewRenderer component...

🤖 ASSISTANT [07/19 21:06]:
I'll help you refactor the ViewRenderer component...

⏺ Read(file: /src/ViewRenderer.js) [20:58]
  ⎿ File content...
     ... +45 lines (ctrl+r to expand)

⏺ Edit(file: /src/ViewRenderer.js) [21:02]
  ⎿ Applied changes successfully

[Compact Continuation at 2024-07-19 21:25:30]

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j 5-line scroll · Space/b page down/up · g/G top/bottom · ←/→ or h/l prev/next conversation · r resume · Esc back · q exit
```

## Installation

### Global Installation (Recommended)

```bash
npm install -g ccscope
```

Once installed, you can run `ccscope` from anywhere in your terminal.

## Quick Start

```bash
# Install globally
npm install -g ccscope

# Run ccscope
ccscope

# Or run without installation using npx
npx ccscope@latest

# That's it! ccscope will automatically find your Claude Code transcripts
```

### Local Installation

```bash
git clone https://github.com/taguchiu/ccscope.git
cd ccscope
npm install
npm link
```

### Alternative Installation Methods

```bash
# Install from GitHub directly
npm install -g git+https://github.com/taguchiu/ccscope.git

# Install specific version
npm install -g ccscope@1.2.2

# Install locally for development
npm install ccscope
```

## Usage

### Basic Usage

```bash
# Interactive browser mode
ccscope

# Run with npx (no installation required)
npx ccscope

# Show statistics commands
ccscope daily            # Daily conversation statistics
ccscope project          # Project-grouped statistics
ccscope search "query"   # Search across all conversations

# Options
ccscope --help           # Show help

# Search examples
ccscope search "async await"
ccscope search "error or warning"     # OR search
ccscope search --regex "import.*from" # Regex search
ccscope search --regex "\berror\b"    # Word boundary search
```

### Resume Claude Code Sessions

Press `r` in any view to resume a Claude Code session:
- Executes `claude -r <session-id>` to continue the conversation

This feature allows you to seamlessly continue conversations discovered through ccscope.

### Navigation

#### Session List View
- `↑/↓` or `k/j`: Navigate up/down
- `Enter`: View session conversations
- `r`: Resume session with `claude -r`
- `f`: Filter by project
- `s`: Sort sessions (last activity, duration, conversations, start time, project name)
- `/`: Search sessions
- `h` or `?`: Show help
- `q`: Exit

#### Conversation Detail View
- `↑/↓` or `k/j`: Navigate conversations
- `←/→` or `h/l`: Switch sessions
- `Enter`: View full conversation detail
- `r`: Resume session with `claude -r`
- `s`: Sort conversations (date/time, duration, tools)
- `Esc`: Back to session list

#### Full Detail View
- `↑/↓` or `k/j`: Scroll content (5-line increments)
- `Space/b` or `PgDn/PgUp`: Page down/up
- `Ctrl+F/Ctrl+B`: Page forward/back (vim-style)
- `Ctrl+D/Ctrl+U`: Half-page down/up
- `g/G`: Jump to top/bottom
- `←/→`: Previous/next conversation (or navigate search results if from search)
- `Ctrl+R`: Toggle all tool output expansion/collapse
- `r`: Resume session with `claude -r`
- `Esc`: Back to conversation list

#### Search Results View
- `↑/↓` or `k/j`: Navigate search results
- `Enter`: View conversation detail
- `Esc`: Back to session list
- `q`: Exit application

## Configuration

ccscope automatically discovers Claude Code transcripts in this directory:
- `~/.claude/projects/`

### Supported Formats

ccscope reads Claude Code transcript files in JSONL format (`.jsonl` extension).

## Development

### Project Structure

```
ccscope/
├── bin/                # Executable scripts
│   └── ccscope         # Main CLI entry point
├── src/                # Source code
│   ├── services/       # Service classes
│   │   ├── ContentExtractor.js
│   │   ├── ConversationBuilder.js
│   │   ├── FileDiscoveryService.js
│   │   ├── ProjectExtractor.js
│   │   └── SessionStatisticsCalculator.js
│   ├── utils/          # Utility functions
│   │   └── formatters.js
│   ├── config.js       # Configuration
│   ├── CacheManager.js # Cache management
│   ├── FastParser.js   # Optimized JSONL parser
│   ├── SessionManager.js
│   ├── StateManager.js
│   ├── ViewRenderer.js
│   ├── InputHandler.js
│   ├── ThemeManager.js
│   ├── MouseEventFilter.js
│   └── CCScope.js
├── __tests__/          # Test files
│   ├── helpers/        # Test utilities
│   └── *.test.js       # Component tests
├── .github/            # GitHub Actions workflows
│   └── workflows/      # CI/CD pipelines
├── CLAUDE.md           # Claude Code integration guide
├── package.json
├── jest.config.js      # Jest configuration
├── README.md
├── README.ja.md
└── LICENSE
```

### Architecture

ccscope follows a modular architecture:

- **CCScope**: Main application orchestrator
- **SessionManager**: Handles transcript discovery and parsing
- **StateManager**: Manages application state and navigation
- **ViewRenderer**: Handles UI rendering and display logic
- **InputHandler**: Processes keyboard input and key bindings
- **ThemeManager**: Manages color themes and text formatting
- **MouseEventFilter**: Prevents mouse event artifacts in terminal output
- **CacheManager**: Manages persistent caching for improved performance
- **FastParser**: Optimized JSONL parser for large transcript files
- **ConversationBuilder**: Builds conversation pairs and merges compact continuations
- **ContentExtractor**: Extracts and processes message content
- **FileDiscoveryService**: Discovers transcript files efficiently
- **ProjectExtractor**: Extracts project information from transcripts
- **SessionStatisticsCalculator**: Calculates session metrics and statistics

## Testing

ccscope includes a comprehensive test suite built with Jest. All major components have unit tests to ensure reliability and maintainability.

### Running Tests

```bash
# Install dependencies (including dev dependencies)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

```
__tests__/
├── helpers/              # Test utilities and mocks
│   ├── testHelpers.js   # Common test data and utilities
│   └── mockTerminal.js  # Mock terminal interface
├── SessionManager.test.js
├── StateManager.test.js
├── ViewRenderer.test.js
├── InputHandler.test.js
├── MouseEventFilter.test.js
├── ThemeManager.test.js
└── setup.js             # Jest setup configuration
```

### Writing Tests

When contributing new features or fixes, please include tests:

1. Unit tests for new functions/methods
2. Integration tests for component interactions
3. Edge case coverage
4. Mock external dependencies (file system, terminal I/O)

### Coverage Requirements

The project aims for:
- **80%** overall code coverage
- **70%** branch coverage
- **80%** function coverage

Run `npm run test:coverage` to check current coverage levels.

### Continuous Integration

All pull requests are automatically tested via GitHub Actions:
- Tests run on multiple Node.js versions (14.x, 16.x, 18.x, 20.x)
- Tests run on multiple platforms (Ubuntu, macOS, Windows)
- Coverage reports are generated and checked against thresholds
- Security audits are performed on dependencies

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
- 📦 [npm Package](https://www.npmjs.com/package/ccscope)