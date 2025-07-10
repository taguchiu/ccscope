/**
 * CC Lens Configuration
 * Centralized configuration for the interactive conversation browser
 */

module.exports = {
  // Terminal & Display Settings
  terminal: {
    defaultWidth: 120,
    defaultHeight: 40,
    wideThreshold: 90,
    compactThreshold: 80,
    minWidth: 60,
    minHeight: 20
  },

  // Thinking Rate Thresholds
  thinkingRates: {
    ultra: 1.0,        // 100%+ - Ultra ultrathink
    ultrathink: 0.8,   // 80%+ - Ultrathink
    high: 0.5,         // 50%+ - High thinking
    medium: 0.2,       // 20%+ - Medium thinking
    low: 0.0           // 0%+ - Low thinking
  },

  // Response Time Thresholds (seconds)
  responseTime: {
    slow: 300,         // 5 minutes
    medium: 180,       // 3 minutes
    fast: 60           // 1 minute
  },

  // Context Flow Settings
  contextFlow: {
    defaultRange: 3,
    minRange: 1,
    maxRange: 10,
    stepSize: 1
  },

  // Layout Settings
  layout: {
    headerHeight: 9,
    footerHeight: 9,
    sessionIdLength: 16,
    projectNameLength: 75,
    durationLength: 10,
    responseTimeLength: 8,
    conversationPadding: 13,
    toolCountWidth: 5,
    previewHeight: 5
  },

  // Performance Settings
  performance: {
    maxVisibleSessions: 50,
    cacheSize: 100,
    virtualScrollBuffer: 10,
    debounceDelay: 50
  },

  // File System Settings
  filesystem: {
    transcriptDirectories: [
      '~/.claude/projects/',
      '~/.config/claude/transcripts/',
      './transcripts/',
      './'
    ],
    transcriptExtension: '.jsonl',
    backupExtension: '.backup'
  },

  // Keyboard Shortcuts
  keyBindings: {
    navigation: {
      up: ['k', 'up'],
      down: ['j', 'down'],
      left: ['h', 'left'],
      right: ['l', 'right'],
      enter: ['return', 'enter', ' '],
      escape: ['escape'],
      quit: ['q'],
      home: ['home', 'g'],
      end: ['end', 'G']
    },
    actions: {
      help: ['h', '?'],
      search: ['/'],
      filter: ['f', 'F'],
      sort: ['s', 'S'],
      refresh: ['r', 'R'],
      bookmark: ['b', 'B'],
      export: ['e', 'E'],
      copy: ['c', 'C'],
      language: ['L'],
      fullDetail: ['f'],
      contextIncrease: ['+', '='],
      contextDecrease: ['-', '_'],
      quit: ['q']
    }
  },

  // Theme Settings
  theme: {
    colors: {
      // Thinking rate colors
      ultraUltraThink: '\x1b[91m\x1b[1m\x1b[5m', // Red, bold, blinking
      ultraThink: '\x1b[91m\x1b[1m',              // Red, bold
      highThink: '\x1b[91m',                       // Red
      mediumThink: '\x1b[93m',                     // Yellow
      lowThink: '\x1b[92m',                        // Green
      noThink: '\x1b[90m',                         // Gray
      
      // Response time colors
      slowResponse: '\x1b[91m',                    // Red
      mediumResponse: '\x1b[93m',                  // Yellow
      fastResponse: '\x1b[92m',                    // Green
      
      // UI colors
      selected: '\x1b[44m\x1b[97m',               // Blue background, white text
      selectedUltraThink: '\x1b[41m\x1b[97m',     // Red background, white text
      header: '\x1b[1m\x1b[94m',                  // Bold blue
      separator: '\x1b[97m',                       // White
      prefix: '\x1b[92m',                          // Green
      accent: '\x1b[95m',                          // Magenta
      muted: '\x1b[90m',                           // Gray
      info: '\x1b[96m',                            // Cyan
      warning: '\x1b[93m',                         // Yellow
      error: '\x1b[91m',                           // Red
      success: '\x1b[92m',                         // Green
      reset: '\x1b[0m'                             // Reset
    },
    
    // Emoji/Icons
    icons: {
      thinking: {
        ultra: '🔥',
        ultrathink: '🧠',
        high: '💭',
        medium: '  ',
        low: '  ',
        none: '  '
      },
      ui: {
        selected: '▶',
        unselected: ' ',
        bullet: '•',
        arrow: '→',
        separator: '─',
        loading: '⏳',
        search: '🔍',
        filter: '🔽',
        bookmark: '🔖',
        export: '📤'
      }
    }
  },

  // Localization Settings
  localization: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'ja'],
    dateFormat: {
      en: 'MM/DD',
      ja: 'MM/DD'
    },
    timeFormat: {
      en: 'HH:mm',
      ja: 'HH:mm'
    }
  },

  // Debug Settings
  debug: {
    enabled: false,
    logLevel: 'info',
    showTimings: false,
    showMemoryUsage: false
  }
};