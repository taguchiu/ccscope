const { EventEmitter } = require('events');

class MockReadline extends EventEmitter {
  constructor() {
    super();
    this.closed = false;
    this.output = [];
    this.cursorPos = { rows: 0, cols: 0 };
  }

  close() {
    this.closed = true;
    this.emit('close');
  }

  write(data) {
    this.output.push(data);
  }

  clearLine(dir) {
    // Mock implementation
  }

  moveCursor(dx, dy) {
    this.cursorPos.cols += dx;
    this.cursorPos.rows += dy;
  }

  cursorTo(x, y) {
    this.cursorPos.cols = x;
    if (y !== undefined) {
      this.cursorPos.rows = y;
    }
  }

  getCursorPos() {
    return this.cursorPos;
  }

  getOutput() {
    return this.output.join('');
  }

  clearOutput() {
    this.output = [];
  }

  simulateKeypress(key, modifiers = {}) {
    const keyData = {
      name: key,
      ctrl: modifiers.ctrl || false,
      meta: modifiers.meta || false,
      shift: modifiers.shift || false,
      ...modifiers
    };
    this.emit('keypress', key, keyData);
  }
}

function createMockTerminal(rows = 24, cols = 80) {
  const output = {
    rows,
    columns: cols,
    write: jest.fn(),
    clearLine: jest.fn(),
    moveCursor: jest.fn(),
    cursorTo: jest.fn()
  };

  const input = {
    setRawMode: jest.fn(),
    resume: jest.fn(),
    pause: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn()
  };

  return { input, output };
}

module.exports = {
  MockReadline,
  createMockTerminal
};