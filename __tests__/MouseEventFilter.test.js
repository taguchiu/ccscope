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
  });
});