/**
 * StateManager
 * Manages application state and view transitions
 */

const config = require('./config');

class StateManager {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    
    // View state
    this.currentView = 'session_list';
    this.previousView = null;
    this.viewHistory = [];
    
    // Selection state
    this.selectedSessionIndex = 0;
    this.selectedConversationIndex = 0;
    this.scrollOffset = 0;
    this.scrollToEnd = true; // Start at the end for full detail view
    this.maxScrollOffset = 0;
    
    // Search and filter state
    this.searchQuery = '';
    this.activeFilters = {
      project: null
    };
    
    // Display state
    this.sortOrder = 'lastActivity'; // lastActivity, duration, conversations
    this.sortDirection = 'desc';
    this.contextRange = config.contextFlow.defaultRange;
    
    // Conversation sorting (for detail view)
    this.conversationSortOrder = 'dateTime'; // dateTime, duration, tools
    this.conversationSortDirection = 'desc';
    
    // UI state
    this.language = config.localization.defaultLanguage;
    this.theme = 'default';
    this.isLoading = false;
    
    // Bookmarks
    this.bookmarkedSessions = new Set();
    
    // Navigation state
    this.navigationStack = [];
    
    // Performance tracking
    this.lastStateChange = Date.now();
    this.stateChangeCount = 0;
    
    // Cache for filtered sessions
    this.filteredSessionsCache = null;
    this.cacheInvalidated = true;
    
    // Search results state
    this.searchResults = [];
    this.searchQuery = '';
    this.searchOptions = {};
    this.selectedSearchResultIndex = 0;
    this.previousSearchState = null;
    
    // Highlight state for detail views
    this.highlightQuery = '';
    this.highlightOptions = {};
    this.highlightMatchType = null;
    this.scrollToSearchMatch = false;
    this.searchMatchType = null;
  }

  /**
   * Get current view
   */
  getCurrentView() {
    return this.currentView;
  }

  /**
   * Set current view
   */
  setView(viewName) {
    this.previousView = this.currentView;
    this.viewHistory.push(this.currentView);
    this.currentView = viewName;
    
    // Reset scroll offset when changing views
    this.scrollOffset = 0;
    this.scrollToEnd = (viewName === 'full_detail'); // Start at end for full detail
    
    this.trackStateChange();
  }

  /**
   * Go to previous view
   */
  setPreviousView() {
    if (this.viewHistory.length > 0) {
      const targetView = this.viewHistory.pop();
      this.currentView = targetView;
      
      // Don't invalidate cache when just navigating back
      // The data hasn't changed, only the view
      this.trackStateChange();
    }
  }

  /**
   * Get view data for current view
   */
  getViewData() {
    const sessions = this.getFilteredSessions();
    
    switch (this.currentView) {
      case 'session_list':
        return {
          sessions,
          selectedIndex: this.selectedSessionIndex,
          searchQuery: this.searchQuery,
          filters: this.activeFilters,
          sortOrder: this.sortOrder,
          sortDirection: this.sortDirection
        };
        
      case 'conversation_detail':
        const selectedSession = sessions[this.selectedSessionIndex];
        const sortedConversations = selectedSession ? this.sortConversations(selectedSession.conversationPairs) : [];
        return {
          session: selectedSession,
          conversations: sortedConversations,
          selectedConversationIndex: this.selectedConversationIndex,
          scrollOffset: this.scrollOffset,
          conversationSortOrder: this.conversationSortOrder,
          conversationSortDirection: this.conversationSortDirection
        };
        
      case 'full_detail':
        const detailSession = sessions[this.selectedSessionIndex];
        return {
          session: detailSession,
          conversations: detailSession ? detailSession.conversationPairs : [],
          selectedConversationIndex: this.selectedConversationIndex,
          scrollOffset: this.scrollOffset,
          scrollToEnd: this.scrollToEnd
        };
        
      case 'filter':
        return {
          sessions,
          selectedIndex: this.selectedSessionIndex,
          searchQuery: this.searchQuery,
          filters: this.activeFilters,
          sortOrder: this.sortOrder,
          sortDirection: this.sortDirection
        };
        
      case 'search':
        return {
          sessions,
          selectedIndex: this.selectedSessionIndex,
          searchQuery: this.searchQuery,
          filters: this.activeFilters
        };
        
      case 'search_results':
        return {
          searchResults: this.searchResults,
          selectedIndex: this.selectedSearchResultIndex,
          searchQuery: this.searchQuery,
          searchOptions: this.searchOptions,
          scrollOffset: this.scrollOffset
        };
        
      default:
        return { sessions, selectedIndex: this.selectedSessionIndex };
    }
  }

  /**
   * Get filtered sessions
   */
  getFilteredSessions() {
    // Return cached sessions if available and not invalidated
    if (!this.cacheInvalidated && this.filteredSessionsCache) {
      return this.filteredSessionsCache;
    }
    
    let sessions = this.sessionManager.sessions;
    
    // Apply search filter
    if (this.searchQuery) {
      sessions = this.sessionManager.searchSessions(this.searchQuery);
    }
    
    // Apply filters
    sessions = this.sessionManager.filterSessions(this.activeFilters);
    
    // Apply sorting
    sessions = this.sortSessions(sessions);
    
    // Cache the result
    this.filteredSessionsCache = sessions;
    this.cacheInvalidated = false;
    
    return sessions;
  }

  /**
   * Sort sessions
   */
  sortSessions(sessions) {
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    
    return sessions.sort((a, b) => {
      let aValue, bValue;
      
      switch (this.sortOrder) {
        case 'lastActivity':
          aValue = new Date(a.lastActivity);
          bValue = new Date(b.lastActivity);
          break;
        case 'duration':
          aValue = a.duration;
          bValue = b.duration;
          break;
        case 'conversations':
          aValue = a.totalConversations;
          bValue = b.totalConversations;
          break;
        case 'startTime':
          aValue = new Date(a.startTime);
          bValue = new Date(b.startTime);
          break;
        case 'projectName':
          aValue = a.projectName.toLowerCase();
          bValue = b.projectName.toLowerCase();
          break;
        default:
          aValue = new Date(a.lastActivity);
          bValue = new Date(b.lastActivity);
      }
      
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
  }

  /**
   * Navigation methods
   */
  navigateUp() {
    const sessions = this.getFilteredSessions();
    
    if (this.currentView === 'session_list') {
      this.selectedSessionIndex = Math.max(0, this.selectedSessionIndex - 1);
    } else if (this.currentView === 'conversation_detail' || 
               this.currentView === 'full_detail') {
      const session = sessions[this.selectedSessionIndex];
      if (session && session.conversationPairs.length > 0) {
        this.selectedConversationIndex = Math.max(0, this.selectedConversationIndex - 1);
        // Reset scroll position when changing conversations
        if (this.currentView === 'full_detail') {
          this.scrollOffset = 0;
          this.scrollToEnd = true; // Start at end for new conversation
        }
      }
    } else if (this.currentView === 'search_results') {
      this.selectedSearchResultIndex = Math.max(0, this.selectedSearchResultIndex - 1);
    }
    
    this.trackStateChange();
  }

  navigateDown() {
    const sessions = this.getFilteredSessions();
    
    if (this.currentView === 'session_list') {
      this.selectedSessionIndex = Math.min(sessions.length - 1, this.selectedSessionIndex + 1);
    } else if (this.currentView === 'conversation_detail' || 
               this.currentView === 'full_detail') {
      const session = sessions[this.selectedSessionIndex];
      if (session && session.conversationPairs.length > 0) {
        this.selectedConversationIndex = Math.min(
          session.conversationPairs.length - 1, 
          this.selectedConversationIndex + 1
        );
        // Reset scroll position when changing conversations
        if (this.currentView === 'full_detail') {
          this.scrollOffset = 0;
          this.scrollToEnd = true; // Start at end for new conversation
        }
      }
    } else if (this.currentView === 'search_results') {
      this.selectedSearchResultIndex = Math.min(this.searchResults.length - 1, this.selectedSearchResultIndex + 1);
    }
    
    this.trackStateChange();
  }

  navigateLeft() {
    if (this.currentView === 'conversation_detail' || 
        this.currentView === 'full_detail') {
      this.navigateSessionLeft();
    }
  }

  navigateRight() {
    if (this.currentView === 'conversation_detail' || 
        this.currentView === 'full_detail') {
      this.navigateSessionRight();
    }
  }

  navigateSessionLeft() {
    // Check if we're in search mode and should navigate search results
    if (this.previousSearchState && this.previousSearchState.results.length > 0) {
      this.navigateSearchResultLeft();
      return;
    }
    
    const sessions = this.getFilteredSessions();
    this.selectedSessionIndex = Math.max(0, this.selectedSessionIndex - 1);
    this.selectedConversationIndex = 0; // Reset conversation selection
    this.trackStateChange();
  }

  navigateSessionRight() {
    // Check if we're in search mode and should navigate search results
    if (this.previousSearchState && this.previousSearchState.results.length > 0) {
      this.navigateSearchResultRight();
      return;
    }
    
    const sessions = this.getFilteredSessions();
    this.selectedSessionIndex = Math.min(sessions.length - 1, this.selectedSessionIndex + 1);
    this.selectedConversationIndex = 0; // Reset conversation selection
    this.trackStateChange();
  }

  /**
   * Navigate to previous search result when in search-originated detail view
   */
  navigateSearchResultLeft() {
    if (!this.previousSearchState || this.previousSearchState.results.length === 0) {
      return;
    }
    
    const currentIndex = this.previousSearchState.selectedIndex;
    const newIndex = Math.max(0, currentIndex - 1);
    
    if (newIndex !== currentIndex) {
      // Update the search state
      this.previousSearchState.selectedIndex = newIndex;
      
      // Navigate to the previous search result
      const result = this.previousSearchState.results[newIndex];
      this.navigateToSearchResult(result);
    }
  }

  /**
   * Navigate to next search result when in search-originated detail view
   */
  navigateSearchResultRight() {
    if (!this.previousSearchState || this.previousSearchState.results.length === 0) {
      return;
    }
    
    const currentIndex = this.previousSearchState.selectedIndex;
    const newIndex = Math.min(this.previousSearchState.results.length - 1, currentIndex + 1);
    
    if (newIndex !== currentIndex) {
      // Update the search state
      this.previousSearchState.selectedIndex = newIndex;
      
      // Navigate to the next search result
      const result = this.previousSearchState.results[newIndex];
      this.navigateToSearchResult(result);
    }
  }

  /**
   * Navigate to a specific search result
   */
  navigateToSearchResult(result) {
    // Find the session by ID
    const sessions = this.getFilteredSessions();
    const sessionIndex = sessions.findIndex(s => s.sessionId === result.sessionId);
    
    if (sessionIndex !== -1) {
      this.selectedSessionIndex = sessionIndex;
      this.selectedConversationIndex = result.conversationIndex;
      
      // Set up highlighting for the match
      this.highlightQuery = this.previousSearchState.query;
      this.highlightOptions = this.previousSearchState.options;
      this.scrollToSearchMatch = true;
      
      this.trackStateChange();
    }
  }

  navigateToFirst() {
    if (this.currentView === 'session_list') {
      this.selectedSessionIndex = 0;
    } else {
      this.selectedConversationIndex = 0;
    }
    this.trackStateChange();
  }

  navigateToLast() {
    const sessions = this.getFilteredSessions();
    
    if (this.currentView === 'session_list') {
      this.selectedSessionIndex = Math.max(0, sessions.length - 1);
    } else {
      const session = sessions[this.selectedSessionIndex];
      if (session && session.conversationPairs.length > 0) {
        this.selectedConversationIndex = session.conversationPairs.length - 1;
      }
    }
    this.trackStateChange();
  }

  /**
   * Scroll methods
   */
  scrollUp(lines = 1) {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines);
    this.scrollToEnd = false; // Clear auto-scroll flags on manual scroll
    this.scrollToSearchMatch = false;
    this.trackStateChange();
  }

  scrollDown(lines = 1) {
    this.scrollOffset = Math.min(this.getMaxScrollOffset(), this.scrollOffset + lines);
    this.scrollToEnd = false; // Clear auto-scroll flags on manual scroll
    this.scrollToSearchMatch = false;
    this.trackStateChange();
  }

  scrollPageUp() {
    const pageSize = this.getPageSize();
    this.scrollOffset = Math.max(0, this.scrollOffset - pageSize);
    this.scrollToEnd = false; // Clear auto-scroll flags on manual scroll
    this.scrollToSearchMatch = false;
    this.trackStateChange();
  }

  scrollPageDown() {
    const pageSize = this.getPageSize();
    this.scrollOffset = Math.min(this.getMaxScrollOffset(), this.scrollOffset + pageSize);
    this.scrollToEnd = false; // Clear auto-scroll flags on manual scroll
    this.scrollToSearchMatch = false;
    this.trackStateChange();
  }

  scrollHalfPageUp() {
    const halfPageSize = Math.floor(this.getPageSize() / 2);
    this.scrollOffset = Math.max(0, this.scrollOffset - halfPageSize);
    this.scrollToEnd = false; // Clear auto-scroll flags on manual scroll
    this.scrollToSearchMatch = false;
    this.trackStateChange();
  }

  scrollHalfPageDown() {
    const halfPageSize = Math.floor(this.getPageSize() / 2);
    this.scrollOffset = Math.min(this.getMaxScrollOffset(), this.scrollOffset + halfPageSize);
    this.scrollToEnd = false; // Clear auto-scroll flags on manual scroll
    this.scrollToSearchMatch = false;
    this.trackStateChange();
  }

  scrollToTop() {
    this.scrollOffset = 0;
    this.scrollToEnd = false; // Ensure we don't auto-scroll to end
    this.scrollToSearchMatch = false; // Clear search match auto-scroll
    this.trackStateChange();
  }

  scrollToBottom() {
    const maxOffset = this.getMaxScrollOffset();
    this.scrollOffset = maxOffset;
    this.scrollToEnd = false; // Ensure we don't auto-scroll to end
    this.scrollToSearchMatch = false; // Clear search match auto-scroll
    this.trackStateChange();
  }

  // Helper methods for scrolling
  getPageSize() {
    // Calculate visible content height (terminal height - header - footer)
    const headerLines = 3;
    const footerLines = 2;
    return Math.max(1, (process.stdout.rows || 40) - headerLines - footerLines);
  }

  getMaxScrollOffset() {
    // This will be set by ViewRenderer when content is built
    return this.maxScrollOffset || 0;
  }

  setMaxScrollOffset(maxOffset) {
    this.maxScrollOffset = maxOffset;
  }

  /**
   * Context range methods
   */
  increaseContextRange() {
    this.contextRange = Math.min(config.contextFlow.maxRange, this.contextRange + 1);
    this.trackStateChange();
  }

  decreaseContextRange() {
    this.contextRange = Math.max(config.contextFlow.minRange, this.contextRange - 1);
    this.trackStateChange();
  }

  /**
   * Search methods
   */
  setSearchQuery(query) {
    this.searchQuery = query;
    this.selectedSessionIndex = 0; // Reset selection
    this.cacheInvalidated = true; // Invalidate cache
    this.trackStateChange();
  }

  clearSearch() {
    this.searchQuery = '';
    this.selectedSessionIndex = 0;
    this.cacheInvalidated = true; // Invalidate cache
    this.trackStateChange();
  }

  /**
   * Filter methods
   */
  setFilter(filterType, value) {
    this.activeFilters[filterType] = value;
    this.selectedSessionIndex = 0; // Reset selection
    this.cacheInvalidated = true; // Invalidate cache
    this.trackStateChange();
  }

  clearFilters() {
    this.activeFilters = {
      project: null
    };
    this.selectedSessionIndex = 0;
    this.cacheInvalidated = true; // Invalidate cache
    this.trackStateChange();
  }

  clearFilter(filterType) {
    this.activeFilters[filterType] = null;
    this.cacheInvalidated = true; // Invalidate cache
    this.trackStateChange();
  }

  /**
   * Sort methods
   */
  setSortOrder(order) {
    if (this.sortOrder === order) {
      // Toggle direction if same order
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortOrder = order;
      this.sortDirection = 'desc'; // Default to descending
    }
    this.selectedSessionIndex = 0;
    this.cacheInvalidated = true; // Invalidate cache
    this.trackStateChange();
  }

  cycleSortOrder() {
    const sortOrders = ['conversations', 'duration', 'startTime', 'lastActivity'];
    const currentIndex = sortOrders.indexOf(this.sortOrder);
    const nextIndex = (currentIndex + 1) % sortOrders.length;
    
    this.setSortOrder(sortOrders[nextIndex]);
  }

  /**
   * Conversation sort methods
   */
  setConversationSortOrder(order) {
    if (this.conversationSortOrder === order) {
      // Toggle direction if same order
      this.conversationSortDirection = this.conversationSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.conversationSortOrder = order;
      this.conversationSortDirection = 'desc'; // Default to descending for conversations
    }
    this.selectedConversationIndex = 0; // Reset selection
    this.trackStateChange();
  }

  cycleConversationSortOrder() {
    const sortOrders = ['dateTime', 'duration', 'tools'];
    const currentIndex = sortOrders.indexOf(this.conversationSortOrder);
    const nextIndex = (currentIndex + 1) % sortOrders.length;
    
    this.setConversationSortOrder(sortOrders[nextIndex]);
  }

  sortConversations(conversations) {
    if (!conversations || conversations.length === 0) {
      return [];
    }

    const direction = this.conversationSortDirection === 'asc' ? 1 : -1;
    
    return [...conversations].sort((a, b) => {
      let aValue, bValue;
      
      switch (this.conversationSortOrder) {
        case 'dateTime':
          aValue = new Date(a.timestamp || 0);
          bValue = new Date(b.timestamp || 0);
          break;
        case 'duration':
          aValue = a.responseTime || 0;
          bValue = b.responseTime || 0;
          break;
        case 'tools':
          aValue = (a.toolsUsed && a.toolsUsed.length) || 0;
          bValue = (b.toolsUsed && b.toolsUsed.length) || 0;
          break;
        default:
          aValue = new Date(a.timestamp || 0);
          bValue = new Date(b.timestamp || 0);
      }
      
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
  }

  /**
   * Bookmark methods
   */
  bookmarkSession(session) {
    this.bookmarkedSessions.add(session.sessionId);
    this.trackStateChange();
  }

  unbookmarkSession(session) {
    this.bookmarkedSessions.delete(session.sessionId);
    this.trackStateChange();
  }

  isBookmarked(session) {
    return this.bookmarkedSessions.has(session.sessionId);
  }

  getBookmarkedSessions() {
    return this.sessionManager.sessions.filter(session => 
      this.bookmarkedSessions.has(session.sessionId)
    );
  }

  /**
   * Language methods
   */
  toggleLanguage() {
    this.language = this.language === 'en' ? 'ja' : 'en';
    this.trackStateChange();
  }

  setLanguage(language) {
    if (config.localization.supportedLanguages.includes(language)) {
      this.language = language;
      this.trackStateChange();
    }
  }

  /**
   * Theme methods
   */
  setTheme(theme) {
    this.theme = theme;
    this.trackStateChange();
  }

  /**
   * Loading state methods
   */
  setLoading(isLoading) {
    this.isLoading = isLoading;
    this.trackStateChange();
  }

  /**
   * Refresh sessions
   */
  refreshSessions() {
    this.selectedSessionIndex = 0;
    this.selectedConversationIndex = 0;
    this.scrollOffset = 0;
    this.scrollToEnd = true;
    this.maxScrollOffset = 0;
    this.cacheInvalidated = true; // Invalidate cache
    this.trackStateChange();
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    const sessions = this.getFilteredSessions();
    return sessions[this.selectedSessionIndex];
  }

  /**
   * Get current conversation
   */
  getCurrentConversation() {
    const session = this.getCurrentSession();
    if (session && session.conversationPairs.length > 0) {
      return session.conversationPairs[this.selectedConversationIndex];
    }
    return null;
  }

  /**
   * Validate state
   */
  validateState() {
    const sessions = this.getFilteredSessions();
    
    // Ensure selected session index is valid
    if (this.selectedSessionIndex >= sessions.length) {
      this.selectedSessionIndex = Math.max(0, sessions.length - 1);
    }
    
    // Ensure selected conversation index is valid
    const currentSession = sessions[this.selectedSessionIndex];
    if (currentSession) {
      if (this.selectedConversationIndex >= currentSession.conversationPairs.length) {
        this.selectedConversationIndex = Math.max(0, currentSession.conversationPairs.length - 1);
      }
    }
    
    // Ensure context range is valid
    if (this.contextRange < config.contextFlow.minRange) {
      this.contextRange = config.contextFlow.minRange;
    } else if (this.contextRange > config.contextFlow.maxRange) {
      this.contextRange = config.contextFlow.maxRange;
    }
  }

  /**
   * Get state statistics
   */
  getStateStatistics() {
    const sessions = this.getFilteredSessions();
    const currentSession = this.getCurrentSession();
    
    return {
      totalSessions: this.sessionManager.sessions.length,
      filteredSessions: sessions.length,
      selectedSessionIndex: this.selectedSessionIndex,
      selectedConversationIndex: this.selectedConversationIndex,
      currentView: this.currentView,
      hasSearch: !!this.searchQuery,
      hasFilters: Object.values(this.activeFilters).some(filter => filter !== null),
      bookmarkedCount: this.bookmarkedSessions.size,
      stateChangeCount: this.stateChangeCount,
      lastStateChange: this.lastStateChange,
      currentSession: currentSession ? {
        id: currentSession.sessionId,
        project: currentSession.projectName,
        conversations: currentSession.totalConversations,
        conversations: currentSession.totalConversations
      } : null
    };
  }

  /**
   * Track state change
   */
  trackStateChange() {
    this.lastStateChange = Date.now();
    this.stateChangeCount++;
    
    // Validate state after change
    this.validateState();
  }

  /**
   * Reset state
   */
  resetState() {
    this.currentView = 'session_list';
    this.previousView = null;
    this.viewHistory = [];
    this.selectedSessionIndex = 0;
    this.selectedConversationIndex = 0;
    this.scrollOffset = 0;
    this.scrollToEnd = true;
    this.maxScrollOffset = 0;
    this.searchQuery = '';
    this.activeFilters = {
      project: null
    };
    this.sortOrder = 'lastActivity';
    this.sortDirection = 'desc';
    this.contextRange = config.contextFlow.defaultRange;
    this.trackStateChange();
  }

  /**
   * Export state
   */
  exportState() {
    return {
      currentView: this.currentView,
      selectedSessionIndex: this.selectedSessionIndex,
      selectedConversationIndex: this.selectedConversationIndex,
      searchQuery: this.searchQuery,
      activeFilters: { ...this.activeFilters },
      sortOrder: this.sortOrder,
      sortDirection: this.sortDirection,
      contextRange: this.contextRange,
      language: this.language,
      theme: this.theme,
      bookmarkedSessions: Array.from(this.bookmarkedSessions)
    };
  }

  /**
   * Import state
   */
  importState(state) {
    this.currentView = state.currentView || 'session_list';
    this.selectedSessionIndex = state.selectedSessionIndex || 0;
    this.selectedConversationIndex = state.selectedConversationIndex || 0;
    this.searchQuery = state.searchQuery || '';
    this.activeFilters = state.activeFilters || {
      project: null
    };
    this.sortOrder = state.sortOrder || 'lastActivity';
    this.sortDirection = state.sortDirection || 'desc';
    this.contextRange = state.contextRange || config.contextFlow.defaultRange;
    this.language = state.language || config.localization.defaultLanguage;
    this.theme = state.theme || 'default';
    this.bookmarkedSessions = new Set(state.bookmarkedSessions || []);
    
    this.validateState();
    this.trackStateChange();
  }

  /**
   * Set search results
   * @param {string} query - Search query
   * @param {Array} results - Search results
   * @param {Object} options - Search options
   */
  setSearchResults(query, results, options = {}) {
    this.searchQuery = query;
    this.searchResults = results;
    this.searchOptions = options;
    this.selectedSearchResultIndex = 0;
    this.scrollOffset = 0;
    this.trackStateChange();
  }
}

module.exports = StateManager;