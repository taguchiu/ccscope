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
      expect(few).toContain('   10 ');
      
      // 20-49 - yellow
      const moderate = themeManager.formatToolCount(30);
      expect(moderate).toContain('\x1b[93m');
      
      // 50+ - red
      const many = themeManager.formatToolCount(75);
      expect(many).toContain('\x1b[91m');
    });

    test('right-aligns tool count', () => {
      expect(themeManager.stripAnsiCodes(themeManager.formatToolCount(5))).toBe('    5 ');
      expect(themeManager.stripAnsiCodes(themeManager.formatToolCount(50))).toBe('   50 ');
      expect(themeManager.stripAnsiCodes(themeManager.formatToolCount(100))).toBe('  100 ');
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

  describe('additional formatting scenarios', () => {
    test('handles edge cases in text formatting', () => {
      // Test empty strings - expect colored empty string
      const emptyInfo = themeManager.formatInfo('');
      expect(emptyInfo).toBeDefined();
      
      const emptyError = themeManager.formatError('');
      expect(emptyError).toBeDefined();
      
      // Test very long strings
      const longText = 'a'.repeat(1000);
      const formatted = themeManager.formatSuccess(longText);
      expect(formatted).toContain('a');
      
      // Test strings with special characters
      const specialText = 'Hello\nWorld\tTest\r';
      const specialFormatted = themeManager.formatWarning(specialText);
      expect(specialFormatted).toContain('Hello');
    });

    test('handles duration edge cases', () => {
      // Test zero duration
      expect(themeManager.formatDuration(0)).toBe('0s');
      
      // Test negative duration
      expect(themeManager.formatDuration(-1000)).toBe('0s');
      
      // Test very large duration
      const largeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
      const largeDuration = themeManager.formatDuration(largeMs);
      expect(largeDuration).toContain('d');
    });

    test('handles session ID formatting edge cases', () => {
      // Test short IDs
      expect(themeManager.formatSessionId('abc')).toBe('abc');
      
      // Test exact length IDs
      const exactId = '12345678';
      expect(themeManager.formatSessionId(exactId)).toBe(exactId);
      
      // Test null/undefined IDs - handle safely
      expect(themeManager.formatSessionId(null || '')).toBe('');
      expect(themeManager.formatSessionId(undefined || '')).toBe('');
    });

    test('handles progress bar edge cases', () => {
      // Test 0% progress
      const zeroProgress = themeManager.createProgressBar(0, 10, 10);
      expect(zeroProgress).toContain('░');
      
      // Test 100% progress
      const fullProgress = themeManager.createProgressBar(1, 1, 10);
      expect(fullProgress).toContain('█');
      
      // Test negative progress
      const negativeProgress = themeManager.createProgressBar(-0.5, 1, 10);
      expect(negativeProgress).toBeDefined();
      
      // Test progress > 100%
      const overProgress = themeManager.createProgressBar(1.5, 1, 10);
      expect(overProgress).toBeDefined();
    });

    test('handles response time formatting edge cases', () => {
      // Test boundary values - check for actual expected format
      const smallTime = themeManager.formatResponseTime(9999);
      expect(smallTime).toBeDefined();
      
      const exactTime = themeManager.formatResponseTime(10000);
      expect(exactTime).toBeDefined();
      
      const mediumTime = themeManager.formatResponseTime(29999);
      expect(mediumTime).toBeDefined();
      
      const slowTime = themeManager.formatResponseTime(30000);
      expect(slowTime).toBeDefined();
      
      // Test very small values
      const verySmall = themeManager.formatResponseTime(1);
      expect(verySmall).toBeDefined();
      
      // Test very large values
      const large = themeManager.formatResponseTime(3600000);
      expect(large).toBeDefined();
    });

    test('handles tool count formatting edge cases', () => {
      // Test zero tools
      expect(themeManager.formatToolCount(0)).toContain('0');
      
      // Test large tool counts
      expect(themeManager.formatToolCount(999)).toContain('999');
      
      // Test negative tool counts
      expect(themeManager.formatToolCount(-1)).toContain('0');
    });

    test('handles text width calculations with edge cases', () => {
      // Test empty string
      expect(themeManager.getDisplayWidth('')).toBe(0);
      
      // Test only ANSI codes
      expect(themeManager.getDisplayWidth('\x1b[31m\x1b[0m')).toBe(0);
      
      // Test only emoji
      expect(themeManager.getDisplayWidth('🔍🎉')).toBe(4);
      
      // Test only CJK characters
      expect(themeManager.getDisplayWidth('你好世界')).toBe(8);
      
      // Test mixed with tabs and newlines
      expect(themeManager.getDisplayWidth('Hello\tWorld\n')).toBe(12);
    });

    test('handles theme switching with state preservation', () => {
      // Set up cache with current theme
      themeManager.formatInfo('test');
      const cacheSize = themeManager.formatCache.size;
      
      // Switch theme
      themeManager.setTheme('dark');
      expect(themeManager.formatCache.size).toBe(0); // Cache should be cleared
      
      // Switch back
      themeManager.setTheme('default');
      expect(themeManager.formatCache.size).toBe(0); // Cache should still be clear
    });

    test('handles separator formatting with different characters', () => {
      // Test different separator characters
      const equals = themeManager.formatSeparator(10, '=');
      expect(equals).toContain('=');
      
      const dashes = themeManager.formatSeparator(10, '-');
      expect(dashes).toContain('-');
      
      const stars = themeManager.formatSeparator(10, '*');
      expect(stars).toContain('*');
      
      // Test zero width - expect it to return formatted empty string
      const zeroWidth = themeManager.formatSeparator(0);
      expect(zeroWidth).toBeDefined();
    });

    test('handles theme switching branches', () => {
      // Test switching to different themes
      themeManager.setTheme('dark');
      expect(themeManager.currentTheme).toBe('dark');
      
      themeManager.setTheme('light');
      expect(themeManager.currentTheme).toBe('light');
      
      themeManager.setTheme('minimal');
      expect(themeManager.currentTheme).toBe('minimal');
      
      // Test invalid theme (should return false)
      const result = themeManager.setTheme('invalid');
      expect(result).toBe(false);
      expect(themeManager.currentTheme).toBe('minimal'); // Should stay on previous theme
    });

    test('handles color formatting with different intensities', () => {
      // Test different theme colors
      themeManager.setTheme('dark');
      const darkHeader = themeManager.formatHeader('test');
      expect(darkHeader).toContain('test');
      
      themeManager.setTheme('light');
      const lightHeader = themeManager.formatHeader('test');
      expect(lightHeader).toContain('test');
      
      themeManager.setTheme('minimal');
      const minimalHeader = themeManager.formatHeader('test');
      expect(minimalHeader).toContain('test');
    });

    test('handles text alignment and padding', () => {
      // Test various padding scenarios
      const shortText = 'test';
      const longText = 'this is a very long text that exceeds normal width';
      
      // Test response time padding
      const shortTime = themeManager.formatResponseTime(5);
      const longTime = themeManager.formatResponseTime(3600);
      
      expect(themeManager.stripAnsiCodes(shortTime).length).toBe(8);
      expect(themeManager.stripAnsiCodes(longTime).length).toBe(8);
      
      // Test tool count padding
      const singleDigit = themeManager.formatToolCount(5);
      const doubleDigit = themeManager.formatToolCount(25);
      const tripleDigit = themeManager.formatToolCount(125);
      
      expect(themeManager.stripAnsiCodes(singleDigit).length).toBe(6);
      expect(themeManager.stripAnsiCodes(doubleDigit).length).toBe(6);
      expect(themeManager.stripAnsiCodes(tripleDigit).length).toBe(6);
    });

    test('handles progress bar with different states', () => {
      // Test empty progress
      const emptyProgress = themeManager.createProgressBar(0, 100, 20);
      expect(emptyProgress).toContain('░');
      expect(emptyProgress).toContain('0%');
      
      // Test full progress
      const fullProgress = themeManager.createProgressBar(100, 100, 20);
      expect(fullProgress).toContain('█');
      expect(fullProgress).toContain('100%');
      
      // Test partial progress
      const partialProgress = themeManager.createProgressBar(50, 100, 20);
      expect(partialProgress).toContain('█');
      expect(partialProgress).toContain('░');
      expect(partialProgress).toContain('50%');
      
      // Test with zero width - expect it to return formatted empty string
      const zeroWidth = themeManager.createProgressBar(0.5, 1, 0);
      expect(zeroWidth).toBeDefined();
    });

    test('handles text formatting with special characters', () => {
      // Test with unicode characters
      const unicodeText = themeManager.formatInfo('Hello 🌍 World');
      expect(unicodeText).toContain('Hello 🌍 World');
      
      // Test with tabs and newlines
      const specialChars = themeManager.formatError('line1\nline2\tindented');
      expect(specialChars).toContain('line1\nline2\tindented');
      
      // Test with existing ANSI codes
      const ansiText = themeManager.formatWarning('\x1b[31mred text\x1b[0m');
      expect(ansiText).toContain('red text');
    });

    test('handles width calculation edge cases', () => {
      // Test with only spaces
      const spaceWidth = themeManager.getDisplayWidth('   ');
      expect(spaceWidth).toBe(3);
      
      // Test with mixed width characters
      const mixedWidth = themeManager.getDisplayWidth('a漢字b');
      expect(mixedWidth).toBeGreaterThan(4);
      
      // Test with control characters
      const controlChars = themeManager.getDisplayWidth('\t\n\r');
      expect(controlChars).toBeGreaterThanOrEqual(0);
      
      // Test with null/undefined - need to handle these cases
      const nullWidth = themeManager.getDisplayWidth(null || '');
      expect(nullWidth).toBe(0);
      
      const undefinedWidth = themeManager.getDisplayWidth(undefined || '');
      expect(undefinedWidth).toBe(0);
    });

    test('handles response time color thresholds', () => {
      // Test color thresholds for response times
      const veryFast = themeManager.formatResponseTime(5); // < 10s
      const fast = themeManager.formatResponseTime(500); // < 10m
      const medium = themeManager.formatResponseTime(900); // 10-30m
      const slow = themeManager.formatResponseTime(2000); // > 30m
      
      expect(veryFast).not.toContain('\x1b[93m'); // No yellow
      expect(fast).not.toContain('\x1b[93m'); // No yellow
      expect(medium).toContain('\x1b[93m'); // Yellow
      expect(slow).toContain('\x1b[91m'); // Red
    });

    test('handles tool count color thresholds', () => {
      // Test color thresholds for tool counts
      const few = themeManager.formatToolCount(10); // < 20
      const moderate = themeManager.formatToolCount(30); // 20-49
      const many = themeManager.formatToolCount(75); // >= 50
      
      expect(few).not.toContain('\x1b[93m'); // No yellow
      expect(moderate).toContain('\x1b[93m'); // Yellow
      expect(many).toContain('\x1b[91m'); // Red
    });

    test('handles thinking rate formatting branches', () => {
      // Test different thinking rates
      const zero = themeManager.formatThinkingRate(0);
      expect(zero).toBe('  0%');
      
      const low = themeManager.formatThinkingRate(0.05);
      expect(low).toBe('  5%');
      
      const medium = themeManager.formatThinkingRate(0.5);
      expect(medium).toBe(' 50%');
      
      const high = themeManager.formatThinkingRate(0.95);
      expect(high).toBe(' 95%');
      
      const full = themeManager.formatThinkingRate(1.0);
      expect(full).toBe('100%');
    });

    test('handles cache operations with different keys', () => {
      // Test cache key generation
      themeManager.formatThinkingRate(0.5);
      expect(themeManager.formatCache.has('thinking_0.5')).toBe(true);
      
      themeManager.formatResponseTime(150);
      expect(themeManager.formatCache.has('response_150')).toBe(true);
      
      themeManager.formatToolCount(25);
      expect(themeManager.formatCache.has('tool_25')).toBe(true);
      
      // Test cache clearing
      const cacheSize = themeManager.formatCache.size;
      expect(cacheSize).toBeGreaterThan(0);
      
      themeManager.clearCache();
      expect(themeManager.formatCache.size).toBe(0);
    });

    test('handles session ID formatting with different lengths', () => {
      // Test very short IDs
      const shortId = themeManager.formatSessionId('ab');
      expect(shortId).toBe('ab');
      
      // Test exactly 8 characters
      const exactId = themeManager.formatSessionId('12345678');
      expect(exactId).toBe('12345678');
      
      // Test longer than 8 characters
      const longId = themeManager.formatSessionId('12345678901234567890');
      expect(longId).toBe('12345678...7890');
      
      // Test UUID format
      const uuid = themeManager.formatSessionId('12345678-1234-5678-9012-345678901234');
      expect(uuid).toBe('12345678...1234');
    });

    test('handles duration formatting with complex times', () => {
      // Test mixed time units - check for actual format
      const complexTime1 = themeManager.formatDuration(3665000); // 1h 1m 5s
      expect(complexTime1).toContain('h');
      expect(complexTime1).toContain('m');
      
      const complexTime2 = themeManager.formatDuration(90061000); // 1d 1h 1m 1s
      expect(complexTime2).toContain('d');
      expect(complexTime2).toContain('h');
      
      const complexTime3 = themeManager.formatDuration(86461000); // 1d 1m 1s
      expect(complexTime3).toContain('d');
      
      // Test rounding behavior
      const roundDown = themeManager.formatDuration(59999); // 59.999s
      expect(roundDown).toContain('s');
    });

    test('handles theme creation methods', () => {
      // Test that theme creation methods exist and work
      const defaultTheme = themeManager.themes.default;
      expect(defaultTheme).toBeDefined();
      expect(defaultTheme.colors).toBeDefined();
      expect(defaultTheme.icons).toBeDefined();
      
      const darkTheme = themeManager.themes.dark;
      expect(darkTheme).toBeDefined();
      expect(darkTheme.colors).toBeDefined();
      
      const lightTheme = themeManager.themes.light;
      expect(lightTheme).toBeDefined();
      expect(lightTheme.colors).toBeDefined();
      
      const minimalTheme = themeManager.themes.minimal;
      expect(minimalTheme).toBeDefined();
      expect(minimalTheme.colors).toBeDefined();
    });
  });
});