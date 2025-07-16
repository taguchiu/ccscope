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
      expect(filter.isMouseEventInput('\\x1b[M')).toBe(true);
      expect(filter.isMouseEventInput('\\x1b[<0;10;20M')).toBe(true);
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
      expect(filter.matchesPattern('\\x1b[', 'ansiEscape')).toBe(true);
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
  });
});