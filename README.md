# CCScope 🔍

Claude Code Scope - Interactive terminal browser for Claude Code conversation transcripts

[![npm version](https://badge.fury.io/js/ccscope.svg)](https://badge.fury.io/js/ccscope)
[![Downloads](https://img.shields.io/npm/dm/ccscope.svg)](https://npmjs.org/package/ccscope)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

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

## Screenshots

### Session List View
```
🔍 Claude Code Scope
================================================================================
📊 42 Sessions | 💬 156 Convos | ⏱️ 2h30min

▶ 1  abc123ef  ccscope      8 convos   45min    07/10 14:30
  2  def456gh  sms-proto   12 convos  1h20min   07/09 10:15  
  3  ghi789jk  refactor     5 convos   25min    07/08 16:20

↑/↓ Navigate · Enter Details · f Filter · s Sort · q Exit
```

### Conversation Detail View
```
💬 8 Conversations | ⏱️ 45min | ccscope

▶ 1  07/10 14:30  12.3s  3t  Help me refactor ViewRenderer...
  2  07/10 14:35   8.7s  1t  Add full-width character support
  3  07/10 14:42  15.2s  5t  Implement virtual scrolling

↑/↓ Select · Enter Detail · ←/→ Switch Session · Esc Back
```

### Full Detail View
```
📅 07/10 14:30 | ⏱️ 12.3s | 🧠 23.4%

👤 USER:
Help me refactor the ViewRenderer component...

🤖 ASSISTANT:
I'll help you refactor the ViewRenderer component...

🔧 Tools: Read×2, Edit×1

↑/↓ Scroll · Space Page · ←/→ Prev/Next · Esc Back
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

# Run CCScope
ccscope

# Or run without installation using npx
npx ccscope

# That's it! CCScope will automatically find your Claude Code transcripts
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
npm install -g ccscope@1.0.0

# Install locally for development
npm install ccscope
```

## Usage

### Basic Usage

```bash
# Start CCScope
ccscope

# Run with npx (no installation required)
npx ccscope

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
- 📦 [npm Package](https://www.npmjs.com/package/ccscope)

## Acknowledgments

- Built for the [Claude Code](https://claude.ai/code) community
- Inspired by terminal-based file browsers and analysis tools
- Special thanks to all contributors and users

---

Made with ❤️ for Claude Code users