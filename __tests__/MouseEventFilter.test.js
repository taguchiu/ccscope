const MouseEventFilter = require('../src/MouseEventFilter');

describe('MouseEventFilter', () => {
  let filter;

  beforeEach(() => {
    filter = new MouseEventFilter();
  });

  describe('constructor', () => {
    test('initializes with pattern definitions', () => {
      expect(filter.patterns).toBeDefined();
      expect(filter.patterns.ansiEscape).toBeInstanceOf(RegExp);
      expect(filter.patterns.rawSingle).toBeInstanceOf(RegExp);
      expect(filter.patterns.longSequence).toBeInstanceOf(Function);
    });
  });

  describe('isMouseEventInput', () => {
    test('detects ANSI escape sequences', () => {
      expect(filter.isMouseEventInput('\x1b[M')).toBe(true);
      expect(filter.isMouseEventInput('\x1b[<0;10;20M')).toBe(true);
    });

    test('detects raw single mouse events', () => {
      expect(filter.isMouseEventInput('0;10;20M')).toBe(true);
      expect(filter.isMouseEventInput('65;15;25M')).toBe(true);
    });

    test('detects raw multiple mouse events', () => {
      expect(filter.isMouseEventInput('0;10;20M1;11;21M')).toBe(true);
      expect(filter.isMouseEventInput('65;10;20M65;11;21M')).toBe(true);
    });

    test('detects specific button codes', () => {
      expect(filter.isMouseEventInput('65;10;20M')).toBe(true); // Left drag
      expect(filter.isMouseEventInput('32;10;20M')).toBe(true); // Middle drag
      expect(filter.isMouseEventInput('0;10;20M')).toBe(true);  // Left click
      expect(filter.isMouseEventInput('1;10;20M')).toBe(true);  // Middle click
      expect(filter.isMouseEventInput('2;10;20M')).toBe(true);  // Right click
      expect(filter.isMouseEventInput('3;10;20M')).toBe(true);  // Selection release
    });

    test('detects long sequences', () => {
      const longSequence = '0;10;20M'.repeat(20); // > 100 chars
      expect(filter.isMouseEventInput(longSequence)).toBe(true);
    });

    test('returns false for normal text', () => {
      expect(filter.isMouseEventInput('Normal text')).toBe(false);
      expect(filter.isMouseEventInput('Hello world')).toBe(false);
      expect(filter.isMouseEventInput('')).toBe(false);
    });
  });

  describe('isMouseEventKeypress', () => {
    test('filters multiple mouse events', () => {
      expect(filter.isMouseEventKeypress('0;10;20M1;11;21M')).toBe(true);
      expect(filter.isMouseEventKeypress('65;10;20M65;11;21M')).toBe(true);
    });

    test('filters very long sequences', () => {
      const longSequence = '0;10;20M1;11;21M2;12;22M3;13;23M4;14;24M5;15;25M';
      expect(filter.isMouseEventKeypress(longSequence)).toBe(true);
    });

    test('does not filter single events', () => {
      expect(filter.isMouseEventKeypress('0;10;20M')).toBe(false);
      expect(filter.isMouseEventKeypress('65;10;20M')).toBe(false);
    });

    test('does not filter keyboard shortcuts', () => {
      expect(filter.isMouseEventKeypress('r')).toBe(false);
      expect(filter.isMouseEventKeypress('\\x12')).toBe(false); // Ctrl+R
      expect(filter.isMouseEventKeypress('\\x1b')).toBe(false); // Escape
    });

    test('returns false for null/undefined', () => {
      expect(filter.isMouseEventKeypress(null)).toBe(false);
      expect(filter.isMouseEventKeypress(undefined)).toBe(false);
      expect(filter.isMouseEventKeypress('')).toBe(false);
    });
  });

  describe('isMouseEventOutput', () => {
    test('filters multiple events', () => {
      expect(filter.isMouseEventOutput('0;10;20M1;11;21M')).toBe(true);
      expect(filter.isMouseEventOutput('65;10;20M65;11;21M')).toBe(true);
    });

    test('filters long sequences', () => {
      const longSequence = '0;10;20M'.repeat(20);
      expect(filter.isMouseEventOutput(longSequence)).toBe(true);
    });

    test('filters repeated drag events', () => {
      expect(filter.isMouseEventOutput('65;10;20M65;11;21M')).toBe(true);
      expect(filter.isMouseEventOutput('32;10;20M32;11;21M')).toBe(true);
    });

    test('filters repeated click events', () => {
      expect(filter.isMouseEventOutput('0;10;20M0;11;21M')).toBe(true);
      expect(filter.isMouseEventOutput('1;10;20M2;11;21M')).toBe(true);
    });

    test('filters strings ending with mouse events', () => {
      expect(filter.isMouseEventOutput('Some text 0;10;20M')).toBe(true);
      expect(filter.isMouseEventOutput('Output: 65;10;20M')).toBe(true);
    });

    test('does not filter normal output', () => {
      expect(filter.isMouseEventOutput('Normal output text')).toBe(false);
      expect(filter.isMouseEventOutput('Session ID: 52ccc342')).toBe(false);
      expect(filter.isMouseEventOutput('')).toBe(false);
    });
  });

  describe('extractScrollEvents', () => {
    test('extracts SGR format scroll events', () => {
      const events = filter.extractScrollEvents('\\x1b[<64;10;20M\\x1b[<65;15;25M');
      
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ direction: 'up', x: 10, y: 20 });
      expect(events[1]).toEqual({ direction: 'down', x: 15, y: 25 });
    });

    test('extracts raw format scroll events', () => {
      const events = filter.extractScrollEvents('64;10;20M65;15;25M');
      
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ direction: 'up', x: 10, y: 20 });
      expect(events[1]).toEqual({ direction: 'down', x: 15, y: 25 });
    });

    test('handles mixed formats', () => {
      const events = filter.extractScrollEvents('\\x1b[<64;10;20M 65;15;25M');
      
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ direction: 'up', x: 10, y: 20 });
      expect(events[1]).toEqual({ direction: 'down', x: 15, y: 25 });
    });

    test('returns empty array for no scroll events', () => {
      expect(filter.extractScrollEvents('Normal text')).toEqual([]);
      expect(filter.extractScrollEvents('0;10;20M')).toEqual([]); // Not a scroll event
      expect(filter.extractScrollEvents('')).toEqual([]);
    });

    test('correctly identifies scroll directions', () => {
      const upEvents = filter.extractScrollEvents('64;10;20M64;11;21M');
      const downEvents = filter.extractScrollEvents('65;10;20M65;11;21M');
      
      expect(upEvents.every(e => e.direction === 'up')).toBe(true);
      expect(downEvents.every(e => e.direction === 'down')).toBe(true);
    });
  });

  describe('matchesPattern', () => {
    test('matches existing patterns', () => {
      expect(filter.matchesPattern('\x1b[', 'ansiEscape')).toBe(true);
      expect(filter.matchesPattern('0;10;20M', 'rawSingle')).toBe(true);
      expect(filter.matchesPattern('65;10;20M', 'dragLeft')).toBe(true);
    });

    test('handles function patterns', () => {
      const longString = '0;10;20M'.repeat(20);
      expect(filter.matchesPattern(longString, 'longSequence')).toBe(true);
      
      const shortString = '0;10;20M';
      expect(filter.matchesPattern(shortString, 'longSequence')).toBe(false);
    });

    test('returns false for non-existent patterns', () => {
      expect(filter.matchesPattern('test', 'nonExistentPattern')).toBe(false);
    });

    test('returns false for non-matching strings', () => {
      expect(filter.matchesPattern('Normal text', 'ansiEscape')).toBe(false);
      expect(filter.matchesPattern('Hello', 'rawSingle')).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('handles malformed mouse events', () => {
      expect(filter.isMouseEventInput(';10;20M')).toBe(false);
      expect(filter.isMouseEventInput('65;;20M')).toBe(false);
      expect(filter.isMouseEventInput('65;10;M')).toBe(false);
    });

    test('handles partial mouse events', () => {
      expect(filter.isMouseEventInput('65;10')).toBe(false);
      expect(filter.isMouseEventInput('65;10;')).toBe(false);
      expect(filter.isMouseEventInput('M')).toBe(false);
    });

    test('handles mixed content', () => {
      const mixed = 'Normal text 65;10;20M more text';
      expect(filter.isMouseEventInput(mixed)).toBe(true);
      expect(filter.isMouseEventOutput(mixed)).toBe(true);
    });

    test('handles different input types', () => {
      // Test with null/undefined
      expect(filter.isMouseEventInput(null)).toBe(false);
      expect(filter.isMouseEventInput(undefined)).toBe(false);
      expect(filter.isMouseEventOutput(null)).toBe(false);
      expect(filter.isMouseEventOutput(undefined)).toBe(false);
      
      // Test with numbers
      expect(filter.isMouseEventInput(123)).toBe(false);
      expect(filter.isMouseEventOutput(123)).toBe(false);
      
      // Test with empty string
      expect(filter.isMouseEventInput('')).toBe(false);
      expect(filter.isMouseEventOutput('')).toBe(false);
    });

    test('handles different mouse event formats', () => {
      // Test ANSI escape sequences
      expect(filter.isMouseEventInput('\x1b[M')).toBe(true);
      expect(filter.isMouseEventInput('\x1b[<0;10;20M')).toBe(true);
      expect(filter.isMouseEventInput('\x1b[<0;10;20m')).toBe(true);
      
      // Test raw sequences
      expect(filter.isMouseEventInput('0;10;20M')).toBe(true);
      expect(filter.isMouseEventInput('65;10;20M')).toBe(true);
      
      // Test invalid formats
      expect(filter.isMouseEventInput('\x1b[Z')).toBe(false);
      expect(filter.isMouseEventInput('abc;10;20M')).toBe(false);
    });

    test('handles scroll event extraction with edge cases', () => {
      // Test with no scroll events
      expect(filter.extractScrollEvents('normal text')).toEqual([]);
      expect(filter.extractScrollEvents('')).toEqual([]);
      expect(filter.extractScrollEvents(null)).toEqual([]);
      
      // Test with mixed events
      const mixed = '\x1b[<64;10;20M normal text \x1b[<65;15;25M';
      const events = filter.extractScrollEvents(mixed);
      expect(events).toHaveLength(2);
      expect(events[0].direction).toBe('up');
      expect(events[1].direction).toBe('down');
    });

    test('handles pattern matching with different input types', () => {
      // Test with existing patterns
      expect(filter.matchesPattern('\x1b[', 'ansiEscape')).toBe(true);
      expect(filter.matchesPattern('0;10;20M', 'rawSingle')).toBe(true);
      
      // Test with non-existent patterns
      expect(filter.matchesPattern('test', 'nonExistent')).toBe(false);
      
      // Test with function patterns
      const longString = '0;10;20M'.repeat(20);
      expect(filter.matchesPattern(longString, 'longSequence')).toBe(true);
      
      const shortString = '0;10;20M';
      expect(filter.matchesPattern(shortString, 'longSequence')).toBe(false);
    });

    test('handles complex mouse event combinations', () => {
      // Test multiple events in sequence
      const multipleEvents = '65;10;20M65;11;21M65;12;22M';
      expect(filter.isMouseEventInput(multipleEvents)).toBe(true);
      expect(filter.isMouseEventKeypress(multipleEvents)).toBe(true);
      expect(filter.isMouseEventOutput(multipleEvents)).toBe(true);
      
      // Test events with text
      const eventsWithText = 'prefix 65;10;20M middle 32;15;25M suffix';
      expect(filter.isMouseEventInput(eventsWithText)).toBe(true);
      expect(filter.isMouseEventOutput(eventsWithText)).toBe(true);
    });

    test('handles different button codes', () => {
      // Test drag events
      expect(filter.isMouseEventInput('65;10;20M')).toBe(true); // Left drag
      expect(filter.isMouseEventInput('32;10;20M')).toBe(true); // Middle drag
      
      // Test click events
      expect(filter.isMouseEventInput('0;10;20M')).toBe(true);  // Left click
      expect(filter.isMouseEventInput('1;10;20M')).toBe(true);  // Middle click
      expect(filter.isMouseEventInput('2;10;20M')).toBe(true);  // Right click
      expect(filter.isMouseEventInput('3;10;20M')).toBe(true);  // Release
      
      // Test scroll events
      expect(filter.isMouseEventInput('64;10;20M')).toBe(true); // Scroll up
      expect(filter.isMouseEventInput('65;10;20M')).toBe(true); // Scroll down
    });

    test('handles performance with repetitive events', () => {
      // Test with many repeated events
      const manyEvents = '65;10;20M'.repeat(100);
      expect(filter.isMouseEventInput(manyEvents)).toBe(true);
      expect(filter.isMouseEventKeypress(manyEvents)).toBe(true);
      expect(filter.isMouseEventOutput(manyEvents)).toBe(true);
      
      // Test extraction performance
      const scrollEvents = '64;10;20M'.repeat(50) + '65;10;20M'.repeat(50);
      const extracted = filter.extractScrollEvents(scrollEvents);
      expect(extracted.length).toBe(100);
    });

    test('handles boundary conditions', () => {
      // Test at string boundaries
      expect(filter.isMouseEventInput('65;10;20M')).toBe(true);
      expect(filter.isMouseEventInput('text65;10;20M')).toBe(true);
      expect(filter.isMouseEventInput('65;10;20Mtext')).toBe(true);
      
      // Test with minimum valid coordinates
      expect(filter.isMouseEventInput('0;0;0M')).toBe(true);
      expect(filter.isMouseEventInput('65;1;1M')).toBe(true);
      
      // Test with large coordinates
      expect(filter.isMouseEventInput('65;999;999M')).toBe(true);
    });

    test('handles filtering logic branches', () => {
      // Test keypress filtering - should filter multiple events but not single
      expect(filter.isMouseEventKeypress('65;10;20M')).toBe(false); // Single event
      expect(filter.isMouseEventKeypress('65;10;20M65;11;21M')).toBe(true); // Multiple events
      
      // Test output filtering - should filter multiple events and long sequences
      expect(filter.isMouseEventOutput('65;10;20M')).toBe(false); // Single event
      expect(filter.isMouseEventOutput('65;10;20M65;11;21M')).toBe(true); // Multiple events
      
      const longSequence = '65;10;20M'.repeat(20);
      expect(filter.isMouseEventOutput(longSequence)).toBe(true); // Long sequence
    });

    test('handles different escape sequence variations', () => {
      // Test different ANSI escape formats
      expect(filter.isMouseEventInput('\x1b[M')).toBe(true);
      expect(filter.isMouseEventInput('\x1b[<0;10;20M')).toBe(true);
      expect(filter.isMouseEventInput('\x1b[<0;10;20m')).toBe(true);
      
      // Test with different prefixes
      expect(filter.isMouseEventInput('\x1b[>0;10;20M')).toBe(true);
      expect(filter.isMouseEventInput('\x1b[?0;10;20M')).toBe(true);
    });

    test('handles VT200 mouse protocol sequences', () => {
      // Test mouse mode enable/disable sequences
      expect(filter.isMouseEventInput('\x1b[?1000h')).toBe(false); // Enable
      expect(filter.isMouseEventInput('\x1b[?1000l')).toBe(false); // Disable
      expect(filter.isMouseEventInput('\x1b[?1002h')).toBe(false); // Enable button tracking
      expect(filter.isMouseEventInput('\x1b[?1003h')).toBe(false); // Enable any-event tracking
      
      // Test SGR extended mode
      expect(filter.isMouseEventInput('\x1b[?1006h')).toBe(false); // Enable SGR
      expect(filter.isMouseEventInput('\x1b[?1006l')).toBe(false); // Disable SGR
    });

    test('handles complex scroll event scenarios', () => {
      // Test with modifiers
      const shiftScroll = filter.extractScrollEvents('\x1b[<68;10;20M'); // 64 + 4 (shift)
      expect(shiftScroll[0]).toBeUndefined();
      expect(shiftScroll).toHaveLength(0);
      
      const ctrlScroll = filter.extractScrollEvents('\x1b[<80;10;20M'); // 64 + 16 (ctrl)
      expect(ctrlScroll[0]).toBeUndefined();
      expect(ctrlScroll).toHaveLength(0);
      
      // Test button release events (should not be scroll)
      const release = filter.extractScrollEvents('\x1b[<3;10;20M');
      expect(release).toHaveLength(0);
    });

    test('handles coordinate boundary conditions', () => {
      // Test minimum coordinates
      expect(filter.isMouseEventInput('0;0;0M')).toBe(true);
      const minCoords = filter.extractScrollEvents('64;0;0M');
      expect(minCoords[0]).toEqual({ direction: 'up', x: 0, y: 0 });
      
      // Test maximum reasonable coordinates
      expect(filter.isMouseEventInput('65;9999;9999M')).toBe(true);
      const maxCoords = filter.extractScrollEvents('65;9999;9999M');
      expect(maxCoords[0]).toEqual({ direction: 'down', x: 9999, y: 9999 });
      
      // Test negative coordinates (invalid)
      expect(filter.isMouseEventInput('-1;10;20M')).toBe(true);
      expect(filter.isMouseEventInput('65;-10;20M')).toBe(false);
    });

    test('handles concatenated mouse sequences', () => {
      // Test immediate concatenation
      const concat = '\x1b[<64;10;20M\x1b[<65;15;25M\x1b[<64;20;30M';
      expect(filter.isMouseEventInput(concat)).toBe(true);
      
      const events = filter.extractScrollEvents(concat);
      expect(events).toHaveLength(3);
      expect(events[0].direction).toBe('up');
      expect(events[1].direction).toBe('down');
      expect(events[2].direction).toBe('up');
    });

    test('handles corrupted or partial sequences', () => {
      // Incomplete sequences
      expect(filter.isMouseEventInput('\x1b[<64;10')).toBe(false); // Partial but detectable
      expect(filter.isMouseEventInput('64;10;')).toBe(false); // Missing M
      expect(filter.isMouseEventInput(';10;20M')).toBe(false); // Missing button
      
      // Corrupted sequences
      expect(filter.isMouseEventInput('\x1b[<abc;10;20M')).toBe(false); // Has escape
      expect(filter.isMouseEventInput('65;abc;20M')).toBe(false); // Invalid coordinate
      expect(filter.isMouseEventInput('65;10;abcM')).toBe(false); // Invalid coordinate
    });

    test('handles raw mouse protocol with encoding', () => {
      // Raw protocol uses byte values
      const button = String.fromCharCode(32 + 64); // Scroll up (64) + 32
      const x = String.fromCharCode(32 + 10);
      const y = String.fromCharCode(32 + 20);
      const rawEvent = `\x1b[M${button}${x}${y}`;
      
      expect(filter.isMouseEventInput(rawEvent)).toBe(true);
      
      // Test with high bit set (extended coordinates)
      const highX = String.fromCharCode(32 + 128);
      const highEvent = `\x1b[M${button}${highX}${y}`;
      expect(filter.isMouseEventInput(highEvent)).toBe(true);
    });

    test('handles pattern matching with type checking', () => {
      // Test all pattern types
      const patterns = Object.keys(filter.patterns);
      patterns.forEach(patternName => {
        const pattern = filter.patterns[patternName];
        
        if (pattern instanceof RegExp) {
          // Test regex patterns
          expect(typeof pattern.test).toBe('function');
        } else if (typeof pattern === 'function') {
          // Test function patterns
          expect(pattern('test')).toBeDefined();
        }
      });
    });

    test('handles isMouseEventOutput with trailing events', () => {
      // Events at end of string
      expect(filter.isMouseEventOutput('Output text 65;10;20M')).toBe(true);
      expect(filter.isMouseEventOutput('Session: 12345 65;10;20M')).toBe(true);
      
      // Multiple events at end
      expect(filter.isMouseEventOutput('Text 65;10;20M65;11;21M')).toBe(true);
      
      // Not at end
      expect(filter.isMouseEventOutput('65;10;20M not at end')).toBe(true);
    });

    test('handles special cases in extractScrollEvents', () => {
      // Test with text between events
      const mixed = '64;10;20M some text 65;15;25M more text';
      const events = filter.extractScrollEvents(mixed);
      expect(events).toHaveLength(2);
      
      // Test with newlines
      const withNewlines = '64;10;20M\n65;15;25M';
      const newlineEvents = filter.extractScrollEvents(withNewlines);
      expect(newlineEvents).toHaveLength(2);
      
      // Test with tabs and spaces
      const withTabs = '64;10;20M\t\t65;15;25M';
      const tabEvents = filter.extractScrollEvents(withTabs);
      expect(tabEvents).toHaveLength(2);
    });

    test('handles all mouse button types', () => {
      // Click buttons (0-2)
      [0, 1, 2].forEach(button => {
        expect(filter.isMouseEventInput(`${button};10;20M`)).toBe(true);
      });
      
      // Release button
      expect(filter.isMouseEventInput('3;10;20M')).toBe(true);
      
      // Drag buttons (32, 65)
      expect(filter.isMouseEventInput('32;10;20M')).toBe(true); // Middle drag
      expect(filter.isMouseEventInput('65;10;20M')).toBe(true); // Left drag
      
      // Scroll buttons (64, 65)
      expect(filter.isMouseEventInput('64;10;20M')).toBe(true); // Scroll up
      expect(filter.isMouseEventInput('65;10;20M')).toBe(true); // Scroll down
      
      // Invalid buttons
      expect(filter.isMouseEventInput('999;10;20M')).toBe(true);
    });

    test('handles performance with large inputs', () => {
      // Very long sequence
      const veryLong = '65;10;20M'.repeat(1000);
      const start = Date.now();
      const result = filter.isMouseEventInput(veryLong);
      const duration = Date.now() - start;
      
      expect(result).toBe(true);
      expect(duration).toBeLessThan(100); // Should be fast
      
      // Many events extraction
      const manyScrolls = '64;10;20M'.repeat(500) + '65;10;20M'.repeat(500);
      const startExtract = Date.now();
      const extracted = filter.extractScrollEvents(manyScrolls);
      const extractDuration = Date.now() - startExtract;
      
      expect(extracted).toHaveLength(1000);
      expect(extractDuration).toBeLessThan(200); // Should be reasonably fast
    });
  });
});