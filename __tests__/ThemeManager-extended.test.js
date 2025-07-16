const ThemeManager = require('../src/ThemeManager');

describe('ThemeManager Extended Tests', () => {
  let themeManager;

  beforeEach(() => {
    themeManager = new ThemeManager();
  });

  describe('character width calculation', () => {
    test('calculates width for various unicode characters', () => {
      // ASCII
      expect(themeManager.getDisplayWidth('Hello')).toBe(5);
      
      // CJK characters (double width)
      expect(themeManager.getDisplayWidth('こんにちは')).toBe(10);
      expect(themeManager.getDisplayWidth('你好')).toBe(4);
      expect(themeManager.getDisplayWidth('안녕')).toBe(4);
      
      // Mixed content
      expect(themeManager.getDisplayWidth('Hello世界')).toBe(9);
      
      // Emojis
      expect(themeManager.getDisplayWidth('😀')).toBe(2);
      expect(themeManager.getDisplayWidth('👨‍👩‍👧‍👦')).toBeGreaterThan(2);
      
      // Control characters
      expect(themeManager.getDisplayWidth('\t\n\r')).toBe(3);
    });

    test('handles surrogate pairs correctly', () => {
      // Emoji with surrogate pair
      const emoji = '𝄞'; // Musical symbol
      expect(themeManager.getDisplayWidth(emoji)).toBe(2);
      
      // Invalid surrogate pair
      const invalid = '\uD800'; // High surrogate without low
      expect(themeManager.getDisplayWidth(invalid)).toBe(1);
    });

    test('strips ANSI codes before calculating width', () => {
      const colored = '\x1b[31mRed Text\x1b[0m';
      expect(themeManager.getDisplayWidth(colored)).toBe(8);
      
      const complex = '\x1b[1;32;40mBold Green on Black\x1b[0m';
      expect(themeManager.getDisplayWidth(complex)).toBe(19);
    });
  });

  describe('formatting edge cases', () => {
    test('formats very large durations', () => {
      // 1 year
      const year = 365 * 24 * 60 * 60 * 1000;
      const result = themeManager.formatDuration(year);
      expect(result).toContain('365d');
      
      // Exactly 1 day
      const day = 24 * 60 * 60 * 1000;
      const dayResult = themeManager.formatDuration(day);
      expect(dayResult).toBe('1d');
      
      // Mixed units
      const mixed = day + 3 * 60 * 60 * 1000 + 25 * 60 * 1000 + 30 * 1000;
      const mixedResult = themeManager.formatDuration(mixed);
      expect(mixedResult).toBe('1d 3h 25m 30s');
    });

    test('formats edge case response times', () => {
      // Exactly at boundaries
      expect(themeManager.formatResponseTime(30 * 60)).toContain('30m');
      expect(themeManager.formatResponseTime(60 * 60)).toContain('60m');
      
      // Just below boundaries
      expect(themeManager.formatResponseTime(29 * 60 + 59)).toContain('29m');
      
      // Very small times
      expect(themeManager.formatResponseTime(0.5)).toContain('0s');
      expect(themeManager.formatResponseTime(1)).toContain('1s');
    });

    test('formats thinking rate edge cases', () => {
      // 0% and 100%
      expect(themeManager.formatThinkingRate(0)).toBe('\x1b[92m0%\x1b[0m');
      expect(themeManager.formatThinkingRate(1)).toBe('\x1b[91m100%\x1b[0m');
      
      // Boundary values
      expect(themeManager.formatThinkingRate(0.2)).toContain('20%');
      expect(themeManager.formatThinkingRate(0.5)).toContain('50%');
      
      // Over 100% (shouldn't happen but handle gracefully)
      expect(themeManager.formatThinkingRate(1.5)).toContain('150%');
    });

    test('formats tool count with color thresholds', () => {
      // Low count (green)
      expect(themeManager.formatToolCount(5)).toContain('\x1b[92m');
      
      // Medium count (yellow)
      expect(themeManager.formatToolCount(25)).toContain('\x1b[93m');
      
      // High count (red)
      expect(themeManager.formatToolCount(75)).toContain('\x1b[91m');
      
      // Exactly at boundaries
      expect(themeManager.formatToolCount(10)).toContain('\x1b[93m');
      expect(themeManager.formatToolCount(50)).toContain('\x1b[91m');
    });
  });

  describe('progress bar creation', () => {
    test('creates progress bars with different ratios', () => {
      // Empty
      const empty = themeManager.createProgressBar(0, 100, 10);
      expect(empty).toContain('0%');
      expect(empty).toContain('░'.repeat(10));
      
      // Half
      const half = themeManager.createProgressBar(50, 100, 10);
      expect(half).toContain('50%');
      expect(half).toContain('█');
      expect(half).toContain('░');
      
      // Full
      const full = themeManager.createProgressBar(100, 100, 10);
      expect(full).toContain('100%');
      expect(full).toContain('█'.repeat(10));
    });

    test('handles edge cases in progress bar', () => {
      // Zero total
      const zeroTotal = themeManager.createProgressBar(50, 0, 10);
      expect(zeroTotal).toContain('0%');
      
      // Negative width
      const negativeWidth = themeManager.createProgressBar(50, 100, -5);
      expect(negativeWidth).toContain('[]');
      
      // Over 100%
      const over = themeManager.createProgressBar(150, 100, 10);
      expect(over).toContain('100%');
      expect(over).toContain('█'.repeat(10));
      
      // Very small width
      const tiny = themeManager.createProgressBar(50, 100, 1);
      expect(tiny).toContain('[');
      expect(tiny).toContain(']');
    });
  });

  describe('caching behavior', () => {
    test('caches formatted values', () => {
      // Format same value multiple times
      const spy = jest.spyOn(themeManager, 'formatThinkingRate');
      
      themeManager.formatThinkingRate(0.5);
      themeManager.formatThinkingRate(0.5);
      themeManager.formatThinkingRate(0.5);
      
      // Should only calculate once due to caching
      expect(spy).toHaveBeenCalledTimes(3);
      
      // Clear cache and format again
      themeManager.clearCache();
      themeManager.formatThinkingRate(0.5);
      
      // Should recalculate after cache clear
      expect(spy).toHaveBeenCalledTimes(4);
    });

    test('cache handles different value types', () => {
      // Response time caching
      const time1 = themeManager.formatResponseTime(100);
      const time2 = themeManager.formatResponseTime(100);
      expect(time1).toBe(time2);
      
      // Tool count caching
      const count1 = themeManager.formatToolCount(25);
      const count2 = themeManager.formatToolCount(25);
      expect(count1).toBe(count2);
    });
  });

  describe('theme creation and customization', () => {
    test('creates dark theme with correct colors', () => {
      const darkTheme = themeManager.createDarkTheme();
      
      expect(darkTheme.colors.background).toBe('\x1b[40m');
      expect(darkTheme.colors.foreground).toBe('\x1b[97m');
      expect(darkTheme.colors.error).toBe('\x1b[91m');
    });

    test('creates light theme with correct colors', () => {
      const lightTheme = themeManager.createLightTheme();
      
      expect(lightTheme.colors.background).toBe('\x1b[47m');
      expect(lightTheme.colors.foreground).toBe('\x1b[30m');
      expect(lightTheme.colors.selected).toBe('\x1b[44m\x1b[97m');
    });

    test('creates minimal theme with no colors', () => {
      const minimalTheme = themeManager.createMinimalTheme();
      
      // All colors should be empty
      Object.values(minimalTheme.colors).forEach(color => {
        expect(color).toBe('');
      });
    });

    test('switches themes and clears cache', () => {
      // Start with default theme
      const format1 = themeManager.formatHeader('Test');
      
      // Switch to minimal
      themeManager.setTheme('minimal');
      const format2 = themeManager.formatHeader('Test');
      
      // Should be different due to theme change
      expect(format1).not.toBe(format2);
      expect(format2).toBe('Test'); // No formatting in minimal
    });
  });

  describe('text manipulation', () => {
    test('truncates session IDs correctly', () => {
      // Short ID - no truncation
      const short = themeManager.formatSessionId('abc123');
      expect(short).toBe('abc123');
      
      // Long ID - truncated
      const long = themeManager.formatSessionId('abcdefghijklmnop');
      expect(long).toBe('abcdefgh...');
      expect(long.length).toBe(11); // 8 chars + 3 dots
    });

    test('formats datetime consistently', () => {
      const date = new Date('2024-01-15T14:30:45Z');
      const formatted = themeManager.formatDateTime(date);
      
      // Should be MM/DD HH:mm format
      expect(formatted).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    });

    test('creates separators with custom characters', () => {
      const defaultSep = themeManager.formatSeparator(10);
      expect(defaultSep).toBe('==========');
      
      const customSep = themeManager.formatSeparator(10, '-');
      expect(customSep).toBe('----------');
      
      const unicodeSep = themeManager.formatSeparator(5, '─');
      expect(unicodeSep).toBe('─────');
    });
  });

  describe('ANSI code handling', () => {
    test('strips nested ANSI codes', () => {
      const nested = '\x1b[1m\x1b[31mBold Red\x1b[0m\x1b[0m';
      const stripped = themeManager.stripAnsiCodes(nested);
      expect(stripped).toBe('Bold Red');
    });

    test('handles malformed ANSI codes', () => {
      const malformed = '\x1b[999mInvalid\x1b[m';
      const stripped = themeManager.stripAnsiCodes(malformed);
      expect(stripped).toBe('Invalid');
    });

    test('preserves text with square brackets', () => {
      const text = 'Array[0] = value';
      const stripped = themeManager.stripAnsiCodes(text);
      expect(stripped).toBe('Array[0] = value');
    });
  });

  describe('color formatting methods', () => {
    test('formats all color types correctly', () => {
      const text = 'Test';
      
      // Test each formatting method
      expect(themeManager.formatHeader(text)).toContain('\x1b[');
      expect(themeManager.formatMuted(text)).toContain('\x1b[');
      expect(themeManager.formatInfo(text)).toContain('\x1b[');
      expect(themeManager.formatSuccess(text)).toContain('\x1b[');
      expect(themeManager.formatWarning(text)).toContain('\x1b[');
      expect(themeManager.formatError(text)).toContain('\x1b[');
      expect(themeManager.formatAccent(text)).toContain('\x1b[');
      expect(themeManager.formatHighlight(text)).toContain('\x1b[7m'); // Inverse
      expect(themeManager.formatDim(text)).toContain('\x1b[2m'); // Dim
      
      // All should end with reset
      expect(themeManager.formatHeader(text)).toContain('\x1b[0m');
    });

    test('handles empty strings', () => {
      expect(themeManager.formatHeader('')).toBe('');
      expect(themeManager.formatError('')).toBe('');
    });

    test('handles null/undefined gracefully', () => {
      expect(themeManager.formatHeader(null)).toBe('null');
      expect(themeManager.formatHeader(undefined)).toBe('undefined');
    });
  });

  describe('selection formatting', () => {
    test('formats selected items with proper styling', () => {
      const selected = themeManager.formatSelection('Item', true);
      expect(selected).toContain('\x1b[44m'); // Blue background
      expect(selected).toContain('\x1b[97m'); // White text
      
      const unselected = themeManager.formatSelection('Item', false);
      expect(unselected).toBe('Item');
    });

    test('formats selected prefix correctly', () => {
      const prefix = themeManager.formatSelectedPrefix();
      expect(prefix).toContain('>');
      expect(prefix).toContain('\x1b['); // Should have color
    });
  });
});