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
🔍 Claude Code Scope
========================================================================================================
📊 35 Sessions | 💬 1503 Convos | ⏱️ 4d 9h 23m

▶ 1  52ccc342  ccscope               48 convos   1h 51m   07/10 23:52  07/12 19:58
  2  14208db7  sms-proto              7 convos  24m 24s   07/12 19:23  07/12 19:55
  3  7726f0    mobile-documents      40 convos    1h 6m   07/12 15:25  07/12 19:22

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j to select · Enter to view details · r resume · / full-text search · f filter · s sort · h help · q exit
```

### Conversation Detail View
```
🔍 Claude Code Scope
========================================================================================================
💬 48 Convos | ⏱️ 1h 51m
Selected: [52ccc342] -Users-taguchiu-Documents-workspace-ccscope
📁 File: /Users/taguchiu/.claude/projects/...

▶ 1  07/10 14:30  12.3s  3t  Help me refactor ViewRenderer...
  2  07/10 14:35   8.7s  1t  Add full-width character support
  3  07/10 14:42  15.2s  5t  Implement virtual scrolling

────────────────────────────────────────────────────────────────────────────────────────────────────────  
↑/↓ or k/j to select conversation · Enter to view detail · ←/→ or h/l switch session · r resume · s sort · Esc back · q exit
```

### Full Detail View
```
[52ccc342] -Users-taguchiu-Documents-workspace-ccscope     [18-66/66] 100%
Conversation #15 of 48
========================================================================================================

👤 USER:
Help me refactor the ViewRenderer component...

🤖 ASSISTANT:
I'll help you refactor the ViewRenderer component...

⏺ Read(file: /src/ViewRenderer.js)
  ⎿ File content...
     ... +45 lines (ctrl+r to expand)

⏺ Edit(file: /src/ViewRenderer.js)
  ⎿ Applied changes successfully

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
npm install -g ccscope@1.2.1

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
│   ├── config.js       # Configuration
│   ├── SessionManager.js
│   ├── StateManager.js
│   ├── ViewRenderer.js
│   ├── InputHandler.js
│   ├── ThemeManager.js
│   └── CCScope.js
├── __tests__/          # Test files
│   ├── helpers/        # Test utilities
│   └── *.test.js       # Component tests
├── .github/            # GitHub Actions workflows
│   └── workflows/      # CI/CD pipelines
├── CLAUDE.md           # Claude Code integration guide
├── examples/           # Example files
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