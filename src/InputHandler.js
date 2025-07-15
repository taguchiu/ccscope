/**
 * InputHandler
 * Handles keyboard input processing, key bindings, and mouse event filtering
 * Uses MouseEventFilter for centralized mouse event detection and filtering
 */

const readline = require('readline');
const config = require('./config');
const MouseEventFilter = require('./MouseEventFilter');

class InputHandler {
  constructor(stateManager, sessionManager, viewRenderer, themeManager) {
    this.state = stateManager;
    this.sessionManager = sessionManager;
    this.viewRenderer = viewRenderer;
    this.theme = themeManager;
    
    // Setup readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Enable keypress events
    readline.emitKeypressEvents(process.stdin);
    
    // Enable raw mode if TTY
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    
    // Enable mouse events
    this.enableMouseEvents();
    
    // Input state
    this.inputBuffer = '';
    this.inputMode = 'normal'; // normal, search, filter, select_project
    this.inputHistory = [];
    this.historyIndex = 0;
    
    // Selection state for filters
    this.selectionIndex = 0;
    this.selectionOptions = [];
    
    // Key bindings
    this.keyBindings = config.keyBindings;
    
    // Debounce timer
    this.debounceTimer = null;
    
    // Mouse event filter for centralized mouse event detection
    // Handles all mouse event patterns (scroll, drag, click, selection)
    this.mouseFilter = new MouseEventFilter();
    
    // Setup output filtering
    this.setupOutputFiltering();
    
    // Bind event listeners
    this.setupEventListeners();
  }

  /**
   * Setup output filtering to prevent mouse events from appearing
   * Intercepts stdout.write to filter out mouse event artifacts
   */
  setupOutputFiltering() {
    // Store original stdout.write
    const originalWrite = process.stdout.write;
    const mouseFilter = this.mouseFilter;
    
    // Override stdout.write to filter mouse events
    process.stdout.write = function(chunk, encoding, callback) {
      if (typeof chunk === 'string' || chunk instanceof Buffer) {
        const str = chunk.toString();
        
        // Use centralized mouse event detection for output filtering
        if (mouseFilter.isMouseEventOutput(str)) {
          // Don't write mouse event output to stdout
          return true;
        }
      }
      
      // Call original write for non-mouse events
      return originalWrite.call(this, chunk, encoding, callback);
    };
  }

  /**
   * Enable mouse events
   */
  enableMouseEvents() {
    if (process.stdin.isTTY) {
      // Enable mouse tracking
      process.stdout.write('\x1b[?1000h'); // Enable mouse button tracking
      process.stdout.write('\x1b[?1002h'); // Enable mouse button and drag tracking
      process.stdout.write('\x1b[?1015h'); // Enable urxvt mouse mode
      process.stdout.write('\x1b[?1006h'); // Enable SGR mouse mode
    }
  }

  /**
   * Disable mouse events
   */
  disableMouseEvents() {
    if (process.stdin.isTTY) {
      process.stdout.write('\x1b[?1006l'); // Disable SGR mouse mode
      process.stdout.write('\x1b[?1015l'); // Disable urxvt mouse mode
      process.stdout.write('\x1b[?1002l'); // Disable mouse button and drag tracking
      process.stdout.write('\x1b[?1000l'); // Disable mouse button tracking
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Handle keypress events
    process.stdin.on('keypress', (str, key) => {
      this.handleKeyPress(str, key);
    });
    
    // Handle raw data for mouse events with complete isolation
    process.stdin.on('data', (data) => {
      const dataStr = data.toString();
      
      // Use centralized mouse event detection for input filtering
      if (this.mouseFilter.isMouseEventInput(dataStr)) {
        this.handleMouseEvent(data);
        // Critical: consume completely to prevent leakage
        return;
      }
    });

    // Handle terminal resize
    process.stdout.on('resize', () => {
      this.viewRenderer.updateTerminalSize();
      this.debounceRender();
    });

    // Handle process exit
    process.on('SIGINT', () => {
      this.cleanup();
      process.exit();
    });
  }

  /**
   * Handle mouse events from raw data
   * Processes scroll events and consumes all mouse events to prevent artifacts
   */
  handleMouseEvent(data) {
    const dataStr = data.toString();
    
    // Use centralized scroll event extraction from MouseEventFilter
    const scrollEvents = this.mouseFilter.extractScrollEvents(dataStr);
    
    // Process scroll events
    for (const event of scrollEvents) {
      if (event.direction === 'up') {
        this.handleScrollUp();
      } else if (event.direction === 'down') {
        this.handleScrollDown();
      }
    }
    
    // Always consume all mouse events to prevent artifacts
    // This is critical to prevent mouse event strings from leaking to display
    return true;
  }

  /**
   * Handle scroll up event
   */
  handleScrollUp() {
    const currentView = this.state.getCurrentView();
    
    // Only handle scrolling in detail views
    if (currentView === 'full_detail') {
      this.state.scrollUp(3); // Scroll up 3 lines
      this.render();
    } else if (currentView === 'conversation_detail') {
      this.state.navigateUp();
      this.render();
    } else if (currentView === 'session_list') {
      this.state.navigateUp();
      this.render();
    } else if (currentView === 'search_results') {
      this.state.navigateUp();
      this.render();
    }
  }

  /**
   * Handle scroll down event
   */
  handleScrollDown() {
    const currentView = this.state.getCurrentView();
    
    // Only handle scrolling in detail views
    if (currentView === 'full_detail') {
      this.state.scrollDown(3); // Scroll down 3 lines
      this.render();
    } else if (currentView === 'conversation_detail') {
      this.state.navigateDown();
      this.render();
    } else if (currentView === 'session_list') {
      this.state.navigateDown();
      this.render();
    } else if (currentView === 'search_results') {
      this.state.navigateDown();
      this.render();
    }
  }

  /**
   * Handle key press events
   */
  handleKeyPress(str, key) {
    // Handle Ctrl+C
    if (key && key.ctrl && key.name === 'c') {
      this.cleanup();
      process.exit();
    }
    
    if (!key) return;
    
    // Filter out mouse events that might leak through
    if (this.mouseFilter.isMouseEventKeypress(str)) {
      return;
    }
    
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    const currentView = this.state.getCurrentView();
    
    // Handle input modes
    if (this.inputMode === 'search') {
      this.handleSearchInput(str, key);
      return;
    } else if (this.inputMode === 'filter') {
      this.handleFilterInput(str, key);
      return;
    } else if (this.inputMode.startsWith('select_')) {
      this.handleSelectionInput(str, key);
      return;
    }
    
    // Handle normal navigation
    this.handleNormalInput(str, key, currentView);
  }

  /**
   * Handle normal input mode
   */
  handleNormalInput(str, key, currentView) {
    const keyName = key.name || str;
    const keySequence = key.sequence;
    
    // Handle uppercase G specifically
    if (str === 'G') {
      if (currentView === 'session_list') {
        this.state.navigateToLast();
        this.render();
        return;
      } else if (currentView === 'conversation_detail') {
        this.state.navigateToLast();
        this.render();
        return;
      } else if (currentView === 'full_detail') {
        this.state.scrollToBottom();
        this.render();
        return;
      }
    }
    
    // Global shortcuts - 'q' always quits from any view
    if (this.isKey(keyName, this.keyBindings.actions.quit) || 
        this.isKey(keyName, this.keyBindings.navigation.quit)) {
      this.exitApplication();
      return;
    }
    
    // View-specific shortcuts
    switch (currentView) {
      case 'session_list':
        this.handleSessionListInput(keyName, key);
        break;
      case 'conversation_detail':
        this.handleConversationDetailInput(keyName, key);
        break;
      case 'full_detail':
        this.handleFullDetailInput(keyName, key);
        break;
      case 'search_results':
        this.handleSearchResultsInput(keyName, key);
        break;
      case 'help':
        this.handleHelpInput(keyName, key);
        break;
      default:
        this.handleSessionListInput(keyName, key);
    }
  }

  /**
   * Handle session list input
   */
  handleSessionListInput(keyName, key) {
    const viewData = this.state.getViewData();
    const { sessions, selectedIndex } = viewData;
    
    if (this.isKey(keyName, this.keyBindings.navigation.up)) {
      this.state.navigateUp();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.down)) {
      this.state.navigateDown();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.enter)) {
      this.state.setView('conversation_detail');
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.escape)) {
      this.exitApplication(); // From session list, Esc still exits
    } else if (this.isKey(keyName, this.keyBindings.actions.help)) {
      this.state.setView('help');
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.actions.search)) {
      this.enterSearchMode();
    } else if (this.isKey(keyName, this.keyBindings.actions.filter)) {
      this.enterFilterMode();
    } else if (this.isKey(keyName, this.keyBindings.actions.sort)) {
      this.cycleSorting();
    } else if (keyName === 'r') {
      this.resumeSession();
    } else if (this.isKey(keyName, this.keyBindings.actions.refresh)) {
      this.refreshSessions();
    } else if (this.isKey(keyName, this.keyBindings.actions.bookmark)) {
      this.bookmarkSession();
    } else if (this.isKey(keyName, this.keyBindings.actions.export)) {
      this.exportData();
    } else if (this.isKey(keyName, this.keyBindings.actions.copy)) {
      this.copySessionId();
    } else if (this.isKey(keyName, this.keyBindings.navigation.home)) {
      this.state.navigateToFirst();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.end)) {
      this.state.navigateToLast();
      this.render();
    }
  }

  /**
   * Handle conversation detail input
   */
  handleConversationDetailInput(keyName, key) {
    if (this.isKey(keyName, this.keyBindings.navigation.up)) {
      this.state.navigateUp();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.down)) {
      this.state.navigateDown();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.left)) {
      this.state.navigateSessionLeft();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.right)) {
      this.state.navigateSessionRight();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.enter)) {
      this.state.setView('full_detail');
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.escape)) {
      // Check if we came from search results
      if (this.state.previousSearchState) {
        // Restore search results state
        this.state.searchResults = this.state.previousSearchState.results;
        this.state.selectedSearchResultIndex = this.state.previousSearchState.selectedIndex;
        this.state.searchQuery = this.state.previousSearchState.query;
        this.state.searchOptions = this.state.previousSearchState.options;
        this.state.previousSearchState = null;
        
        // Clear highlight state
        this.state.highlightQuery = '';
        this.state.highlightMatchType = null;
        
        // Return to search results view
        this.state.setView('search_results');
        this.render();
      } else {
        this.state.setPreviousView();
        // Use setImmediate to render on next tick for smoother transition
        setImmediate(() => this.render());
      }
    } else if (this.isKey(keyName, this.keyBindings.actions.help)) {
      this.state.setView('help');
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.actions.sort)) {
      this.cycleConversationSorting();
    } else if (keyName === 'r') {
      this.resumeSession();
    }
  }

  /**
   * Handle full detail input
   */
  handleFullDetailInput(keyName, key) {
    // Smooth scrolling (5 lines)
    const smoothScrollLines = 5;
    
    // Line scrolling
    if (this.isKey(keyName, this.keyBindings.navigation.up)) {
      this.state.scrollUp(smoothScrollLines);
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.down)) {
      this.state.scrollDown(smoothScrollLines);
      this.render();
    }
    // Page scrolling
    else if (keyName === 'space' || keyName === 'pagedown') {
      this.state.scrollPageDown();
      this.render();
    } else if (keyName === 'b' || keyName === 'pageup') {
      this.state.scrollPageUp();
      this.render();
    }
    // Half page scrolling (Ctrl+D/Ctrl+U)
    else if (key && key.ctrl && keyName === 'd') {
      this.state.scrollHalfPageDown();
      this.render();
    } else if (key && key.ctrl && keyName === 'u') {
      this.state.scrollHalfPageUp();
      this.render();
    }
    // Toggle tool expansion (Ctrl+R)
    else if (key && key.ctrl && keyName === 'r') {
      if (this.state.toggleCurrentToolExpansion()) {
        this.render();
      }
    }
    // Jump to top/bottom
    else if (this.isKey(keyName, this.keyBindings.navigation.home)) {
      this.state.scrollToTop();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.end)) {
      this.state.scrollToBottom();
      this.render();
    }
    // Conversation navigation (within same session or search results)
    else if (this.isKey(keyName, this.keyBindings.navigation.left)) {
      // Check if we're in search mode - if so, navigate search results
      if (this.state.previousSearchState && this.state.previousSearchState.results.length > 0) {
        this.state.navigateSearchResultLeft();
      } else {
        this.state.navigateUp(); // Previous conversation
      }
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.right)) {
      // Check if we're in search mode - if so, navigate search results
      if (this.state.previousSearchState && this.state.previousSearchState.results.length > 0) {
        this.state.navigateSearchResultRight();
      } else {
        this.state.navigateDown(); // Next conversation
      }
      this.render();
    }
    // Exit and copy
    else if (this.isKey(keyName, this.keyBindings.navigation.escape)) {
      // Check if we came from search results
      if (this.state.previousSearchState) {
        // Restore search results state
        this.state.searchResults = this.state.previousSearchState.results;
        this.state.selectedSearchResultIndex = this.state.previousSearchState.selectedIndex;
        this.state.searchQuery = this.state.previousSearchState.query;
        this.state.searchOptions = this.state.previousSearchState.options;
        this.state.previousSearchState = null;
        
        // Clear highlight state
        this.state.highlightQuery = '';
        this.state.highlightMatchType = null;
        
        // Return to search results view
        this.state.setView('search_results');
        this.render();
      } else {
        this.state.setPreviousView();
        // Use setImmediate to render on next tick for smoother transition
        setImmediate(() => this.render());
      }
    } else if (keyName === 'r') {
      this.resumeSession();
    } else if (this.isKey(keyName, this.keyBindings.actions.help)) {
      this.state.setView('help');
      this.render();
    }
  }

  /**
   * Handle search results input
   */
  handleSearchResultsInput(keyName, key) {
    const viewData = this.state.getViewData();
    const { searchResults, selectedIndex } = viewData;
    
    if (this.isKey(keyName, this.keyBindings.navigation.up)) {
      this.state.navigateUp();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.down)) {
      this.state.navigateDown();
      this.render();
    } else if (this.isKey(keyName, this.keyBindings.navigation.enter)) {
      // Show the selected search result in detail
      const selectedResult = searchResults[selectedIndex];
      if (selectedResult) {
        // Store the current search results state before navigating
        this.state.previousSearchState = {
          results: searchResults,
          selectedIndex: selectedIndex,
          query: this.state.searchQuery,
          options: this.state.searchOptions
        };
        
        // Set highlight information for detail view
        this.state.highlightQuery = this.state.searchQuery;
        this.state.highlightOptions = this.state.searchOptions;
        this.state.highlightMatchType = selectedResult.matchType;
        
        // Clear any existing filters and search to show all sessions
        this.state.clearSearch();
        this.state.clearFilters();
        
        // Navigate to the specific session and conversation
        const navigationSuccess = this.state.navigateToSessionConversation(
          selectedResult.sessionId, 
          selectedResult.conversationIndex,
          selectedResult.userTime
        );
        
        if (navigationSuccess) {
          // Navigate directly to full detail view
          this.state.setView('full_detail');
          
          // Calculate initial scroll position to show the match
          this.calculateScrollToMatch(selectedResult);
          
          this.render();
        } else {
          console.error('Could not find session in current list');
        }
      }
    } else if (this.isKey(keyName, this.keyBindings.navigation.escape)) {
      // Exit search results and quit application
      this.exitApplication();
    } else if (this.isKey(keyName, this.keyBindings.actions.help)) {
      this.state.setView('help');
      this.render();
    }
  }

  /**
   * Handle help input
   */
  handleHelpInput(keyName, key) {
    // Any key exits help
    this.state.setPreviousView();
    this.render();
  }

  /**
   * Handle search input
   */
  handleSearchInput(str, key) {
    if (key.name === 'escape') {
      this.exitSearchMode();
      return;
    }
    
    if (key.name === 'return') {
      this.executeSearch();
      return;
    }
    
    if (key.name === 'backspace') {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
    } else if (str && str.length === 1) {
      this.inputBuffer += str;
    }
    
    // Live search
    this.performLiveSearch();
  }

  /**
   * Handle filter input
   */
  handleFilterInput(str, key) {
    if (key.name === 'escape') {
      this.exitFilterMode();
      return;
    }
    
    // Handle filter-specific keys
    if (str === 'p') {
      this.filterByProject();
    } else if (str === 'c') {
      this.clearFilters();
    }
  }

  /**
   * Enter search mode
   */
  enterSearchMode() {
    this.inputMode = 'search';
    this.inputBuffer = '';
    this.renderSearchPrompt();
  }

  /**
   * Exit search mode
   */
  exitSearchMode() {
    this.inputMode = 'normal';
    this.inputBuffer = '';
    this.render();
  }

  /**
   * Execute search
   */
  executeSearch() {
    const query = this.inputBuffer.trim();
    if (query) {
      this.inputHistory.push(query);
      this.state.setSearchQuery(query);
    }
    this.exitSearchMode();
  }

  /**
   * Perform live search
   */
  performLiveSearch() {
    const query = this.inputBuffer.trim();
    if (query.length > 0) {
      this.state.setSearchQuery(query);
    }
    this.renderSearchPrompt();
  }

  /**
   * Render search prompt
   */
  renderSearchPrompt() {
    // Clear last line and show search prompt
    process.stdout.write('\r\x1b[K');
    process.stdout.write(`🔍 Search: ${this.inputBuffer}_`);
  }

  /**
   * Enter filter mode
   */
  enterFilterMode() {
    // Skip the filter menu and go directly to project selection
    this.filterByProject();
  }

  /**
   * Exit filter mode
   */
  exitFilterMode() {
    this.inputMode = 'normal';
    this.state.setView('session_list');
    this.render();
  }


  /**
   * Check if key matches binding
   */
  isKey(keyName, bindings) {
    return bindings.includes(keyName);
  }

  /**
   * Cycle sorting
   */
  cycleSorting() {
    this.state.cycleSortOrder();
    this.render();
  }

  /**
   * Cycle conversation sorting
   */
  cycleConversationSorting() {
    this.state.cycleConversationSortOrder();
    this.render();
  }

  /**
   * Bookmark session
   */
  bookmarkSession() {
    const viewData = this.state.getViewData();
    const { sessions, selectedIndex } = viewData;
    
    if (sessions[selectedIndex]) {
      this.state.bookmarkSession(sessions[selectedIndex]);
      this.showNotification('Session bookmarked');
    }
  }

  /**
   * Export data
   */
  exportData() {
    // Implementation for data export
    this.showNotification('Export feature coming soon');
  }

  /**
   * Copy session ID
   */
  copySessionId() {
    const viewData = this.state.getViewData();
    const { sessions, selectedIndex } = viewData;
    
    if (sessions[selectedIndex]) {
      // Implementation for copying to clipboard
      this.showNotification(`Session ID: ${sessions[selectedIndex].sessionId}`);
    }
  }

  /**
   * Filter by project
   */
  filterByProject() {
    const projects = this.sessionManager.getProjects();
    this.inputMode = 'select_project';
    this.selectionIndex = 0;
    this.selectionOptions = projects;
    this.renderProjectSelection();
  }


  /**
   * Handle selection input
   */
  handleSelectionInput(str, key) {
    if (key.name === 'escape') {
      this.exitFilterMode();
      return;
    }
    
    if (key.name === 'up' || key.name === 'k') {
      this.selectionIndex = Math.max(0, this.selectionIndex - 1);
      this.renderCurrentSelection();
    } else if (key.name === 'down' || key.name === 'j') {
      const maxIndex = this.selectionOptions.length; // 'Clear Filter' + projects
      this.selectionIndex = Math.min(maxIndex, this.selectionIndex + 1);
      this.renderCurrentSelection();
    } else if (key.name === 'return') {
      this.executeSelection();
    }
  }

  /**
   * Execute selection
   */
  executeSelection() {
    if (this.inputMode === 'select_project') {
      const allOptions = ['Clear Filter', ...this.selectionOptions];
      const selectedOption = allOptions[this.selectionIndex];
      this.state.setFilter('project', selectedOption === 'Clear Filter' ? null : selectedOption);
    } else if (this.inputMode === 'select_duration') {
      const selectedOption = this.selectionOptions[this.selectionIndex];
      this.state.setFilter('duration', selectedOption.value);
    }
    
    this.exitFilterMode();
  }

  /**
   * Render current selection
   */
  renderCurrentSelection() {
    if (this.inputMode === 'select_project') {
      this.renderProjectSelection();
    } else if (this.inputMode === 'select_duration') {
      this.renderDurationSelection();
    }
  }

  /**
   * Render project selection
   */
  renderProjectSelection() {
    this.viewRenderer.clearScreen();
    console.log(this.theme.formatHeader('🔽 Filter by Project'));
    console.log(this.theme.formatSeparator(this.viewRenderer.terminalWidth));
    console.log('');
    
    const allOptions = ['Clear Filter', ...this.selectionOptions];
    allOptions.forEach((project, index) => {
      const isSelected = index === this.selectionIndex;
      const prefix = isSelected ? '▶ ' : '  ';
      const text = isSelected ? this.theme.formatSelection(project, true) : project;
      console.log(`${prefix}${text}`);
    });
    
    console.log('');
    console.log(this.theme.formatMuted('↑/↓ to navigate, Enter to select, Esc to cancel'));
  }


  /**
   * Clear filters
   */
  clearFilters() {
    this.state.clearFilters();
    this.showNotification('Filters cleared');
    this.exitFilterMode();
  }

  /**
   * Refresh sessions
   */
  refreshSessions() {
    this.showNotification('Refreshing sessions...');
    this.sessionManager.discoverSessions().then(() => {
      this.state.refreshSessions();
      this.render();
    });
  }

  /**
   * Show notification
   */
  showNotification(message) {
    const notification = this.theme.formatInfo(message);
    console.log(`\\n${notification}`);
    
    // Hide notification after 2 seconds
    setTimeout(() => {
      this.render();
    }, 2000);
  }

  /**
   * Debounce render
   */
  debounceRender() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.render();
    }, config.performance.debounceDelay);
  }

  /**
   * Render current view
   */
  render() {
    this.viewRenderer.render();
  }

  /**
   * Exit application
   */
  exitApplication() {
    this.cleanup();
    process.exit();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.rl) {
      this.rl.close();
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Disable mouse events
    this.disableMouseEvents();
    
    // Reset terminal
    process.stdout.write('\x1b[0m'); // Reset colors
    process.stdout.write('\x1b[?25h'); // Show cursor
    console.log('\n👋 Goodbye!');
  }

  /**
   * Calculate scroll position to show search match
   */
  calculateScrollToMatch(searchResult) {
    // This will be handled in the view renderer
    // Set a flag to indicate we need to scroll to match
    this.state.scrollToSearchMatch = true;
    this.state.searchMatchType = searchResult.matchType;
  }

  /**
   * Resume the current session using claude -r
   */
  resumeSession() {
    const viewData = this.state.getViewData();
    let sessionId = null;
    let projectPath = null;
    
    // Get session ID and project path based on current view
    const currentView = this.state.getCurrentView();
    if (currentView === 'conversation_detail' || currentView === 'full_detail') {
      const { session } = viewData;
      sessionId = session?.fullSessionId || session?.sessionId;
      projectPath = session?.projectPath;
    } else if (currentView === 'session_list') {
      const { sessions, selectedIndex } = viewData;
      const selectedSession = sessions[selectedIndex];
      sessionId = selectedSession?.fullSessionId || selectedSession?.sessionId;
      projectPath = selectedSession?.projectPath;
    }
    
    if (sessionId) {
      const { spawn } = require('child_process');
      
      // Save current directory
      const originalDir = process.cwd();
      
      // Clean up current UI
      this.cleanup();
      
      try {
        // Change to project directory if available
        if (projectPath && projectPath !== '/' && projectPath !== process.env.HOME) {
          console.log(`\nChanging to project directory: ${projectPath}`);
          process.chdir(projectPath);
        }
        
        // Execute claude -r with the session ID
        const claudeProcess = spawn('claude', ['-r', sessionId], {
          stdio: 'inherit', // Inherit stdin, stdout, stderr
          shell: true,
          cwd: projectPath || originalDir // Set working directory
        });
        
        claudeProcess.on('error', (error) => {
          console.error(`Error starting claude: ${error.message}`);
          // Restore original directory on error
          process.chdir(originalDir);
          process.exit(1);
        });
        
        claudeProcess.on('close', (code) => {
          // Restore original directory before exiting
          process.chdir(originalDir);
          // After claude session ends, exit CCScope
          process.exit(code);
        });
      } catch (error) {
        console.error(`Error changing directory: ${error.message}`);
        // Restore original directory on error
        process.chdir(originalDir);
        process.exit(1);
      }
    } else {
      this.showNotification('No session ID available');
    }
  }
}

module.exports = InputHandler;