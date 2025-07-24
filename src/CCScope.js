#!/usr/bin/env node

/**
 * CCScope - Interactive Conversation Browser
 * A modular, user-friendly browser for Claude Code conversations
 */

const SessionManager = require('./SessionManager');
const ThemeManager = require('./ThemeManager');
const StateManager = require('./StateManager');
const ViewRenderer = require('./ViewRenderer');
const InputHandler = require('./InputHandler');
const config = require('./config');

class CCScopeApplication {
  constructor() {
    this.isInitialized = false;
    this.isRunning = false;
    
    // Initialize core components
    this.sessionManager = new SessionManager();
    this.themeManager = new ThemeManager();
    this.stateManager = new StateManager(this.sessionManager);
    this.viewRenderer = new ViewRenderer(this.sessionManager, this.themeManager, this.stateManager);
    this.inputHandler = new InputHandler(this.stateManager, this.sessionManager, this.viewRenderer, this.themeManager);
    
    // Bind methods
    this.handleExit = this.handleExit.bind(this);
    this.handleError = this.handleError.bind(this);
    
    // Setup error handling
    process.on('uncaughtException', this.handleError);
    process.on('unhandledRejection', this.handleError);
    process.on('SIGINT', this.handleExit);
    process.on('SIGTERM', this.handleExit);
  }

  /**
   * Initialize the application
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Performance measurement
      const totalStartTime = Date.now();
      const timings = {};
      
      // Clear screen and show loading immediately
      console.clear();
      process.stdout.write('Loading...');
      
      // Track loading start time
      const loadingStartTime = Date.now();
      timings.loadingScreen = loadingStartTime - totalStartTime;
      
      // Initialize session manager with progress callback
      const sessionStartTime = Date.now();
      await this.sessionManager.discoverSessions((status) => {
        // Clear line and update status
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        process.stdout.write(`Loading... ${status}`);
      });
      timings.sessionDiscovery = Date.now() - sessionStartTime;
      
      timings.totalLoadingDelay = Date.now() - loadingStartTime;
      
      // Clear loading message
      console.clear();
      
      // Initialize theme
      const themeStartTime = Date.now();
      this.themeManager.setTheme(config.theme || 'default');
      timings.themeInit = Date.now() - themeStartTime;
      
      // Initialize state
      const stateStartTime = Date.now();
      this.stateManager.resetState();
      timings.stateInit = Date.now() - stateStartTime;
      
      // Hide cursor for better UI
      process.stdout.write('\x1b[?25l');
      
      // Calculate total time
      timings.total = Date.now() - totalStartTime;
      
      this.isInitialized = true;
      
    } catch (error) {
      console.clear();
      console.error('❌ Failed to initialize Claude Code Scope:', error);
      process.exit(1);
    }
  }

  /**
   * Show loading screen with optional progress message
   * @param {string} message - Optional progress message
   */
  showLoadingScreen(message = null) {
    console.clear();
    if (message) {
      process.stdout.write(`Loading... ${message}`);
    } else {
      process.stdout.write('Loading...');
    }
  }

  // Spinner methods removed - using simple static loading message instead

  /**
   * Start the application
   */
  async start() {
    if (this.isRunning) return;
    
    try {
      // Initialize if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      this.isRunning = true;
      
      // Show welcome message
      this.showWelcomeMessage();
      
      // Start main render loop
      this.startRenderLoop();
      
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Show welcome message
   */
  showWelcomeMessage() {
    // Don't show welcome message - go directly to the interface
    // The initial render will be handled by startRenderLoop
  }

  /**
   * Start render loop
   */
  startRenderLoop() {
    // Initial render
    this.viewRenderer.render();
    
    // The InputHandler will handle subsequent renders
    // This keeps the application responsive
  }

  /**
   * Handle application errors
   */
  handleError(error) {
    console.error('\\n❌ Application Error:', error);
    
    if (config.debug.enabled) {
      console.error('Stack trace:', error.stack);
    }
    
    // Try to gracefully shutdown
    this.handleExit();
  }

  /**
   * Handle application exit
   */
  handleExit() {
    console.log('\\n');
    console.log(this.themeManager.formatInfo('🔄 Shutting down Claude Code Scope...'));
    
    // Cleanup components
    if (this.inputHandler) {
      this.inputHandler.cleanup();
    }
    
    // Show cursor
    process.stdout.write('\x1b[?25h');
    
    // Reset terminal colors
    process.stdout.write('\x1b[0m');
    
    // Show exit message
    console.log(this.themeManager.formatSuccess('👋 Thanks for using Claude Code Scope!'));
    console.log(this.themeManager.formatMuted('Find more tools at https://github.com/your-repo/ccscope'));
    
    process.exit(0);
  }

  /**
   * Get application statistics
   */
  getStatistics() {
    return {
      session: this.sessionManager.getStatistics(),
      state: this.stateManager.getStateStatistics(),
      runtime: {
        isInitialized: this.isInitialized,
        isRunning: this.isRunning,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    };
  }

  /**
   * Enable debug mode
   */
  enableDebug() {
    config.debug.enabled = true;
    config.debug.showTimings = true;
    config.debug.showMemoryUsage = true;
    
    console.log(this.themeManager.formatWarning('🐛 Debug mode enabled'));
  }

  /**
   * Hot reload configuration
   */
  reloadConfig() {
    try {
      // Clear require cache
      delete require.cache[require.resolve('./config')];
      
      // Reload config
      const newConfig = require('./config');
      Object.assign(config, newConfig);
      
      console.log(this.themeManager.formatSuccess('🔄 Configuration reloaded'));
      
    } catch (error) {
      console.error(this.themeManager.formatError('❌ Failed to reload configuration:'), error);
    }
  }

  /**
   * Show daily statistics
   */
  async showDailyStatistics() {
    try {
      // Clear screen and show loading immediately
      console.clear();
      process.stdout.write('Loading...');
      
      // Initialize session manager with progress callback
      await this.sessionManager.discoverSessions((status) => {
        // Clear line and update status
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        process.stdout.write(`Loading... ${status}`);
      });
      
      // Clear loading screen
      console.clear();
      
      // Get daily statistics
      const dailyStatsResult = this.sessionManager.getDailyStatistics();
      
      // Render
      this.viewRenderer.renderDailyStatistics(dailyStatsResult);
      
    } catch (error) {
      console.error(this.themeManager.formatError('❌ Failed to show daily statistics:'), error);
    }
  }

  /**
   * Show project statistics
   */
  async showProjectStatistics() {
    try {
      // Clear screen and show loading immediately
      console.clear();
      process.stdout.write('Loading...');
      
      // Initialize session manager with progress callback
      await this.sessionManager.discoverSessions((status) => {
        // Clear line and update status
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        process.stdout.write(`Loading... ${status}`);
      });
      
      // Clear loading screen
      console.clear();
      
      // Get project statistics
      const projectStats = this.sessionManager.getProjectStatistics();
      
      // Render
      this.viewRenderer.renderProjectStatistics(projectStats);
      
    } catch (error) {
      console.error(this.themeManager.formatError('❌ Failed to show project statistics:'), error);
    }
  }


  /**
   * Show search results
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async showSearchResults(query, options = {}) {
    try {
      // Clear screen and show loading immediately
      console.clear();
      process.stdout.write('Loading...');
      
      // Initialize session manager with progress callback
      await this.sessionManager.discoverSessions((status) => {
        // Clear line and update status
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        process.stdout.write(`Loading... ${status}`);
      });
      
      // Clear loading screen
      console.clear();
      
      // Search conversations
      const results = this.sessionManager.searchConversations(query, options);
      
      // Store search results in state with command-line flag
      const searchOptions = { ...options, isCommandLineSearch: true };
      this.stateManager.setSearchResults(query, results, searchOptions);
      
      // Enter search results view
      this.stateManager.setView('search_results');
      
      // Initialize if not already done
      if (!this.isInitialized) {
        this.themeManager.setTheme(config.theme || 'default');
        process.stdout.write('\x1b[?25l'); // Hide cursor
        this.isInitialized = true;
      }
      
      // Start interactive mode
      this.isRunning = true;
      this.startRenderLoop();
      
    } catch (error) {
      console.error(this.themeManager.formatError('❌ Failed to show search results:'), error);
    }
  }

}

/**
 * CLI argument parsing
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    debug: false,
    theme: 'default',
    language: 'en',
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--debug':
      case '-d':
        options.debug = true;
        break;
      case '--theme':
      case '-t':
        options.theme = args[++i] || 'default';
        break;
      case '--language':
      case '-l':
        options.language = args[++i] || 'en';
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }
  
  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
🔍 Claude Code Scope - Interactive Conversation Browser

Usage: node interactive-conversation-browser-refactored.js [options]

Options:
  -d, --debug              Enable debug mode
  -t, --theme <theme>      Set theme (default, dark, light, minimal)
  -l, --language <lang>    Set language (en, ja)
  -h, --help              Show this help message

Examples:
  node interactive-conversation-browser-refactored.js
  node interactive-conversation-browser-refactored.js --debug
  node interactive-conversation-browser-refactored.js --theme dark
  node interactive-conversation-browser-refactored.js --language ja

Navigation:
  ↑/↓ or k/j    Navigate up/down
  ←/→ or h/l    Navigate left/right
  Enter         Select/Enter view
  Esc or q      Back/Exit
  h or ?        Help
  /             Search
  f             Filter
  s             Sort

More information: https://github.com/your-repo/ccscope
  `);
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArguments();
  
  if (options.help) {
    showHelp();
    return;
  }
  
  try {
    const app = new CCScopeApplication();
    
    // Apply CLI options
    if (options.debug) {
      app.enableDebug();
    }
    
    if (options.theme !== 'default') {
      app.themeManager.setTheme(options.theme);
    }
    
    if (options.language !== 'en') {
      app.stateManager.setLanguage(options.language);
    }
    
    // Start the application
    await app.start();
    
  } catch (error) {
    console.error('❌ Failed to start Claude Code Scope:', error);
    process.exit(1);
  }
}

// Run the application
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = CCScopeApplication;