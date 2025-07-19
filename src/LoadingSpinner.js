/**
 * LoadingSpinner
 * Simple animated loading spinner for terminal
 */

class LoadingSpinner {
  constructor() {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.currentFrame = 0;
    this.interval = null;
    this.message = 'Loading';
  }

  /**
   * Start the spinner with optional message
   */
  start(message = 'Loading') {
    this.message = message;
    this.currentFrame = 0;
    
    // Hide cursor
    process.stdout.write('\x1b[?25l');
    
    // Initial render
    this.render();
    
    // Start animation
    this.interval = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      this.render();
    }, 80);
  }

  /**
   * Render current frame
   */
  render() {
    const frame = this.frames[this.currentFrame];
    process.stdout.write(`\r${frame} ${this.message}... `);
  }

  /**
   * Stop the spinner and clear the line
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    // Clear the line
    process.stdout.write('\r' + ' '.repeat(this.message.length + 10) + '\r');
    
    // Show cursor
    process.stdout.write('\x1b[?25h');
  }
}

module.exports = LoadingSpinner;