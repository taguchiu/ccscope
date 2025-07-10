# CCScope 🔍

Claude Code Scope - Interactive terminal browser for Claude Code conversation transcripts

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
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

## Installation

### Global Installation (Recommended)

```bash
npm install -g ccscope
```

### Local Installation

```bash
git clone https://github.com/your-username/ccscope.git
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
- `s`: Sort sessions
- `/`: Search sessions
- `h` or `?`: Show help
- `q`: Exit

#### Conversation Detail View
- `↑/↓` or `k/j`: Navigate conversations
- `←/→` or `h/l`: Switch sessions
- `Enter`: View full conversation detail
- `s`: Sort conversations
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
├── docs/               # Documentation
│   └── CLAUDE.md       # Claude Code integration guide
├── examples/           # Example files
├── package.json
├── README.md
└── LICENSE
```

### Architecture

CCScope follows a modular architecture:

- **CCLensApplication**: Main application orchestrator
- **SessionManager**: Handles transcript discovery and parsing
- **StateManager**: Manages application state and navigation
- **ViewRenderer**: Handles UI rendering and display logic
- **InputHandler**: Processes keyboard input and key bindings
- **ThemeManager**: Manages visual themes and styling

### Building from Source

```bash
git clone https://github.com/your-username/ccscope.git
cd ccscope
npm install
npm start
```

## Screenshots

### Session List View
```
🔍 CCScope (Claude Code Scope) - Interactive Conversation Browser v3
================================================================================
📊 42 Sessions | 💬 156 Convos | ⏱️ 2h30min

🔽 Filters: None | 📊 Sort: Last Activity ↓

No.  ID               Project              Conversations Duration   Started      Last Updated
────────────────────────────────────────────────────────────────────────────────────────────
▶ 1   abc123ef         ccscope              8            45min       07/10 14:30  07/10 15:15
  2   def456gh         sms-proto           12            1h20min     07/09 10:15  07/09 11:35
  3   ghi789jk         refactor-project     5            25min       07/08 16:20  07/08 16:45
```

### Conversation Detail View
```
🔍 CCScope (Claude Code Scope) - Interactive Conversation Browser v3
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

- 🐛 [Report Issues](https://github.com/your-username/ccscope/issues)
- 💬 [Discussions](https://github.com/your-username/ccscope/discussions)
- 📧 Email: your.email@example.com

## Acknowledgments

- Built for the [Claude Code](https://claude.ai/code) community
- Inspired by terminal-based file browsers and analysis tools
- Special thanks to all contributors and users

---

Made with ❤️ for Claude Code users