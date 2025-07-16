const ThemeManager = require('../src/ThemeManager');

// Mock config
jest.mock('../src/config', () => ({
  theme: {
    colors: {
      slowResponse: '\x1b[91m',
      mediumResponse: '\x1b[93m',
      fastResponse: '\x1b[92m',
      selected: '\x1b[44m\x1b[97m',
      header: '\x1b[1m\x1b[94m',
      separator: '\x1b[97m',
      prefix: '\x1b[92m',
      accent: '\x1b[95m',
      muted: '\x1b[90m',
      info: '\x1b[96m',
      warning: '\x1b[93m',
      error: '\x1b[91m',
      success: '\x1b[92m',
      reset: '\x1b[0m'
    },
    icons: {
      thinking: {
        high: '🔴',
        medium: '🟡',
        low: '🟢',
        none: '⚪'
      },
      ui: {
        selected: '▶',
        unselected: ' ',
        bullet: '•',
        arrow: '→',
        separator: '─',
        loading: '⋯',
        search: '🔍',
        filter: '🔽',
        bookmark: '🔖',
        export: '📤'
      }
    }
  }
}));

describe('ThemeManager', () => {
  let themeManager;

  beforeEach(() => {
    themeManager = new ThemeManager();
  });

  describe('constructor', () => {
    test('initializes with default theme', () => {
      expect(themeManager.currentTheme).toBe('default');
      expect(themeManager.themes).toHaveProperty('default');
      expect(themeManager.themes).toHaveProperty('dark');
      expect(themeManager.themes).toHaveProperty('light');
      expect(themeManager.themes).toHaveProperty('minimal');
    });

    test('initializes format cache', () => {
      expect(themeManager.formatCache).toBeInstanceOf(Map);
    });
  });

  describe('theme management', () => {
    test('getTheme returns current theme', () => {
      const theme = themeManager.getTheme();
      expect(theme).toBe(themeManager.themes.default);
    });

    test('setTheme changes theme', () => {
      const result = themeManager.setTheme('dark');
      expect(result).toBe(true);
      expect(themeManager.currentTheme).toBe('dark');
    });

    test('setTheme returns false for invalid theme', () => {
      const result = themeManager.setTheme('invalid');
      expect(result).toBe(false);
      expect(themeManager.currentTheme).toBe('default');
    });

    test('setTheme clears cache', () => {
      themeManager.formatCache.set('test', 'value');
      themeManager.setTheme('dark');
      expect(themeManager.formatCache.size).toBe(0);
    });

    test('getAvailableThemes returns all theme names', () => {
      const themes = themeManager.getAvailableThemes();
      expect(themes).toEqual(['default', 'dark', 'light', 'minimal']);
    });
  });

  describe('formatThinkingRate', () => {
    test('formats thinking rate as percentage', () => {
      expect(themeManager.formatThinkingRate(0.5)).toBe(' 50%');
      expect(themeManager.formatThinkingRate(0.25)).toBe(' 25%');
      expect(themeManager.formatThinkingRate(1)).toBe('100%');
    });

    test('caches formatted values', () => {
      const rate = 0.75;
      const result1 = themeManager.formatThinkingRate(rate);
      const result2 = themeManager.formatThinkingRate(rate);
      
      expect(result1).toBe(result2);
      expect(themeManager.formatCache.has('thinking_0.75')).toBe(true);
    });
  });

  describe('formatResponseTime', () => {
    test('formats seconds with appropriate color', () => {
      // Less than 10 minutes - no color
      const fast = themeManager.formatResponseTime(300);
      expect(fast).not.toContain('\x1b[91m');
      expect(fast).not.toContain('\x1b[93m');
      
      // 10-30 minutes - yellow
      const medium = themeManager.formatResponseTime(900);
      expect(medium).toContain('\x1b[93m');
      
      // 30+ minutes - red
      const slow = themeManager.formatResponseTime(2000);
      expect(slow).toContain('\x1b[91m');
    });

    test('formats time display correctly', () => {
      expect(themeManager.formatResponseTime(45).trim()).toMatch(/45\.0s/);
      expect(themeManager.formatResponseTime(90).trim()).toMatch(/1m30s/);
      expect(themeManager.formatResponseTime(3665).trim()).toMatch(/61m5s/);
    });

    test('pads time string to fixed width', () => {
      const result = themeManager.stripAnsiCodes(themeManager.formatResponseTime(5));
      expect(result.length).toBe(8);
    });

    test('caches formatted values', () => {
      const time = 150;
      const result1 = themeManager.formatResponseTime(time);
      const result2 = themeManager.formatResponseTime(time);
      
      expect(result1).toBe(result2);
      expect(themeManager.formatCache.has('response_150')).toBe(true);
    });
  });

  describe('formatToolCount', () => {
    test('formats tool count with color', () => {
      // Less than 20 - no special color
      const few = themeManager.formatToolCount(10);
      expect(few).toContain('  10t ');
      
      // 20-49 - yellow
      const moderate = themeManager.formatToolCount(30);
      expect(moderate).toContain('\x1b[93m');
      
      // 50+ - red
      const many = themeManager.formatToolCount(75);
      expect(many).toContain('\x1b[91m');
    });

    test('right-aligns tool count', () => {
      expect(themeManager.stripAnsiCodes(themeManager.formatToolCount(5))).toBe('   5t ');
      expect(themeManager.stripAnsiCodes(themeManager.formatToolCount(50))).toBe('  50t ');
      expect(themeManager.stripAnsiCodes(themeManager.formatToolCount(100))).toBe(' 100t ');
    });

    test('caches formatted values', () => {
      const count = 25;
      const result1 = themeManager.formatToolCount(count);
      const result2 = themeManager.formatToolCount(count);
      
      expect(result1).toBe(result2);
      expect(themeManager.formatCache.has('tool_25')).toBe(true);
    });
  });

  describe('text formatting methods', () => {
    test('formatSelection adds selection colors', () => {
      const result = themeManager.formatSelection('test', true);
      expect(result).toBe('\x1b[44m\x1b[97mtest\x1b[0m');
      
      const notSelected = themeManager.formatSelection('test', false);
      expect(notSelected).toBe('test');
    });

    test('formatHeader adds header colors', () => {
      const result = themeManager.formatHeader('Header');
      expect(result).toBe('\x1b[1m\x1b[94mHeader\x1b[0m');
    });

    test('formatSeparator creates colored separator', () => {
      const result = themeManager.formatSeparator(5, '=');
      expect(result).toBe('\x1b[97m=====\x1b[0m');
    });

    test('formatMuted adds muted colors', () => {
      const result = themeManager.formatMuted('muted text');
      expect(result).toBe('\x1b[90mmuted text\x1b[0m');
    });

    test('formatInfo adds info colors', () => {
      const result = themeManager.formatInfo('info');
      expect(result).toBe('\x1b[96minfo\x1b[0m');
    });

    test('formatSuccess adds success colors', () => {
      const result = themeManager.formatSuccess('success');
      expect(result).toBe('\x1b[92msuccess\x1b[0m');
    });

    test('formatWarning adds warning colors', () => {
      const result = themeManager.formatWarning('warning');
      expect(result).toBe('\x1b[93mwarning\x1b[0m');
    });

    test('formatError adds error colors', () => {
      const result = themeManager.formatError('error');
      expect(result).toBe('\x1b[91merror\x1b[0m');
    });

    test('formatAccent adds accent colors', () => {
      const result = themeManager.formatAccent('accent');
      expect(result).toBe('\x1b[95maccent\x1b[0m');
    });

    test('formatHighlight uses inverse video', () => {
      const result = themeManager.formatHighlight('highlighted');
      expect(result).toBe('\x1b[7mhighlighted\x1b[27m');
    });

    test('formatDim adds dim colors', () => {
      const result = themeManager.formatDim('dim');
      expect(result).toContain('dim');
      expect(result).toContain('\x1b[0m');
    });
  });

  describe('stripAnsiCodes', () => {
    test('removes ANSI color codes', () => {
      const colored = '\x1b[91mRed Text\x1b[0m';
      const stripped = themeManager.stripAnsiCodes(colored);
      expect(stripped).toBe('Red Text');
    });

    test('removes multiple ANSI codes', () => {
      const colored = '\x1b[1m\x1b[94mBold Blue\x1b[0m\x1b[91mRed\x1b[0m';
      const stripped = themeManager.stripAnsiCodes(colored);
      expect(stripped).toBe('Bold BlueRed');
    });

    test('handles text without ANSI codes', () => {
      const plain = 'Plain text';
      const stripped = themeManager.stripAnsiCodes(plain);
      expect(stripped).toBe('Plain text');
    });
  });

  describe('getDisplayWidth', () => {
    test('calculates normal character width', () => {
      expect(themeManager.getDisplayWidth('Hello')).toBe(5);
      expect(themeManager.getDisplayWidth('Test 123')).toBe(8);
    });

    test('calculates CJK character width', () => {
      expect(themeManager.getDisplayWidth('你好')).toBe(4); // 2 chars × 2 width
      expect(themeManager.getDisplayWidth('こんにちは')).toBe(10); // 5 chars × 2 width
      expect(themeManager.getDisplayWidth('안녕')).toBe(4); // 2 chars × 2 width
    });

    test('calculates emoji width', () => {
      expect(themeManager.getDisplayWidth('🔍')).toBe(2);
      expect(themeManager.getDisplayWidth('👍')).toBe(2);
    });

    test('handles mixed content', () => {
      expect(themeManager.getDisplayWidth('Hello 你好')).toBe(10); // 6 + 4
      expect(themeManager.getDisplayWidth('Test 🔍')).toBe(7); // 5 + 2
    });

    test('strips ANSI codes before calculating', () => {
      const colored = '\x1b[91mHello\x1b[0m';
      expect(themeManager.getDisplayWidth(colored)).toBe(5);
    });
  });

  describe('formatDuration', () => {
    test('formats seconds', () => {
      expect(themeManager.formatDuration(5000)).toBe('5s');
      expect(themeManager.formatDuration(45000)).toBe('45s');
    });

    test('formats minutes', () => {
      expect(themeManager.formatDuration(60000)).toBe('1m');
      expect(themeManager.formatDuration(90000)).toBe('1m 30s');
      expect(themeManager.formatDuration(180000)).toBe('3m');
    });

    test('formats hours', () => {
      expect(themeManager.formatDuration(3600000)).toBe('1h');
      expect(themeManager.formatDuration(5400000)).toBe('1h 30m');
      expect(themeManager.formatDuration(7200000)).toBe('2h');
    });

    test('formats days', () => {
      expect(themeManager.formatDuration(86400000)).toBe('1d');
      expect(themeManager.formatDuration(90000000)).toBe('1d 1h');
      expect(themeManager.formatDuration(93600000)).toBe('1d 2h');
      expect(themeManager.formatDuration(88200000)).toBe('1d 30m');
    });
  });

  describe('formatSessionId', () => {
    test('shows short IDs in full', () => {
      expect(themeManager.formatSessionId('abc123')).toBe('abc123');
      expect(themeManager.formatSessionId('12345678')).toBe('12345678');
    });

    test('truncates long IDs', () => {
      const uuid = '12345678-1234-5678-9012-345678901234';
      const result = themeManager.formatSessionId(uuid);
      expect(result).toBe('12345678...1234');
    });
  });

  describe('formatDateTime', () => {
    test('formats date and time correctly', () => {
      const date = new Date('2024-01-15T14:30:00');
      const result = themeManager.formatDateTime(date);
      expect(result).toBe('01/15 14:30');
    });

    test('pads single digit values', () => {
      const date = new Date('2024-05-05T05:05:00');
      const result = themeManager.formatDateTime(date);
      expect(result).toBe('05/05 05:05');
    });
  });

  describe('createProgressBar', () => {
    test('creates progress bar with percentage', () => {
      const result = themeManager.createProgressBar(50, 100, 10);
      expect(result).toContain('█████░░░░░');
      expect(result).toContain('50%');
    });

    test('handles 0% progress', () => {
      const result = themeManager.createProgressBar(0, 100, 10);
      expect(result).toContain('░░░░░░░░░░');
      expect(result).toContain('0%');
    });

    test('handles 100% progress', () => {
      const result = themeManager.createProgressBar(100, 100, 10);
      expect(result).toContain('██████████');
      expect(result).toContain('100%');
    });

    test('clamps values above 100%', () => {
      const result = themeManager.createProgressBar(150, 100, 10);
      expect(result).toContain('██████████');
      expect(result).toContain('100%');
    });
  });

  describe('theme variants', () => {
    test('dark theme has darker colors', () => {
      const darkTheme = themeManager.createDarkTheme();
      expect(darkTheme.colors.selected).toBe('\x1b[100m\x1b[97m');
      expect(darkTheme.colors.header).toBe('\x1b[1m\x1b[96m');
      expect(darkTheme.colors.separator).toBe('\x1b[90m');
    });

    test('light theme has lighter colors', () => {
      const lightTheme = themeManager.createLightTheme();
      expect(lightTheme.colors.selected).toBe('\x1b[47m\x1b[30m');
      expect(lightTheme.colors.header).toBe('\x1b[1m\x1b[34m');
      expect(lightTheme.colors.muted).toBe('\x1b[37m');
    });

    test('minimal theme has no colors', () => {
      const minimalTheme = themeManager.createMinimalTheme();
      expect(minimalTheme.colors.slowResponse).toBe('');
      expect(minimalTheme.colors.mediumResponse).toBe('');
      expect(minimalTheme.colors.selected).toBe('\x1b[7m'); // Only reverse video
      expect(minimalTheme.icons.ui.selected).toBe('>');
    });
  });

  describe('clearCache', () => {
    test('clears format cache', () => {
      themeManager.formatCache.set('test1', 'value1');
      themeManager.formatCache.set('test2', 'value2');
      
      themeManager.clearCache();
      
      expect(themeManager.formatCache.size).toBe(0);
    });
  });
});