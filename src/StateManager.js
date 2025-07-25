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
    this.scrollToEnd = false; // Start at the top for full detail view
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
    this.conversationSortOrder = 'dateTime'; // dateTime, duration, tools, tokens
    this.conversationSortDirection = 'desc';
    
    // Conversation tree state
    this.selectedTreeNodeUuid = null;
    this.expandedTreeNodes = new Set();
    this.treeMode = 'full'; // 'full' shows all nodes, 'path' shows path to selected node
    
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
    
    // Tool result expansion state
    // Maps toolId to expansion state
    this.expandedTools = new Map();
    this.currentToolId = null; // Track current tool for Ctrl+R
    this.visibleToolIds = new Set(); // Track visible tools in viewport
    this.allToolIds = new Set(); // Track all tool IDs in current conversation
    
    // Sub-agent selection state
    this.selectedSubAgent = null; // Format: "task-{taskId}-subagent-{index}"
    this.currentTaskId = null;
    this.selectedSubAgentData = null; // Store selected sub-agent data for detail view
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
    this.scrollToEnd = false; // Always start at the top
    
    // Clear tool expansions when leaving full_detail view
    if (this.previousView === 'full_detail') {
      this.clearToolExpansions();
    }
    
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
        
        // Calculate the original conversation number for display
        let originalConversationNumber = this.selectedConversationIndex + 1;
        if (selectedSession && sortedConversations.length > 0 && this.selectedConversationIndex < sortedConversations.length) {
          const selectedConversation = sortedConversations[this.selectedConversationIndex];
          const originalIndex = selectedSession.conversationPairs.findIndex(conv => 
            conv.userTime && selectedConversation.userTime &&
            new Date(conv.userTime).getTime() === new Date(selectedConversation.userTime).getTime()
          );
          if (originalIndex !== -1) {
            originalConversationNumber = originalIndex + 1;
          }
        }
        
        return {
          session: selectedSession,
          conversations: sortedConversations,
          selectedConversationIndex: this.selectedConversationIndex,
          originalConversationNumber: originalConversationNumber,
          scrollOffset: this.scrollOffset,
          conversationSortOrder: this.conversationSortOrder,
          conversationSortDirection: this.conversationSortDirection,
          highlightQuery: this.highlightQuery,
          highlightOptions: this.highlightOptions
        };
        
      case 'full_detail':
        const detailSession = sessions[this.selectedSessionIndex];
        const detailSortedConversations = detailSession ? this.sortConversations(detailSession.conversationPairs) : [];
        
        // Calculate the original conversation number for display
        let detailOriginalConversationNumber = this.selectedConversationIndex + 1;
        if (detailSession && detailSortedConversations.length > 0 && this.selectedConversationIndex < detailSortedConversations.length) {
          const selectedConversation = detailSortedConversations[this.selectedConversationIndex];
          const originalIndex = detailSession.conversationPairs.findIndex(conv => 
            conv.userTime && selectedConversation.userTime &&
            new Date(conv.userTime).getTime() === new Date(selectedConversation.userTime).getTime()
          );
          if (originalIndex !== -1) {
            detailOriginalConversationNumber = originalIndex + 1;
          }
        }
        
        return {
          session: detailSession,
          conversations: detailSortedConversations,
          selectedConversationIndex: this.selectedConversationIndex,
          originalConversationNumber: detailOriginalConversationNumber,
          scrollOffset: this.scrollOffset,
          scrollToEnd: this.scrollToEnd,
          highlightQuery: this.highlightQuery,
          highlightOptions: this.highlightOptions
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
        
      case 'conversation_tree':
        const treeSession = sessions[this.selectedSessionIndex];
        if (treeSession) {
          const conversationTree = this.sessionManager.buildConversationTree(treeSession.conversationPairs);
          return {
            session: treeSession,
            conversationTree: conversationTree,
            selectedNodeUuid: this.selectedTreeNodeUuid,
            expandedNodes: this.expandedTreeNodes,
            treeMode: this.treeMode,
            scrollOffset: this.scrollOffset
          };
        }
        return { session: null, conversationTree: null };
        
      case 'subagent_detail':
        return {
          selectedSubAgentData: this.selectedSubAgentData,
          sessions,
          selectedIndex: this.selectedSessionIndex
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
        case 'tokens':
          aValue = a.totalTokens || 0;
          bValue = b.totalTokens || 0;
          break;
        case 'tools':
          aValue = a.toolUsageCount || 0;
          bValue = b.toolUsageCount || 0;
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
          this.scrollToEnd = false; // Start at top for new conversation
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
          this.scrollToEnd = false; // Start at top for new conversation
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
      
      // Find the conversation by timestamp in the sorted list
      const session = sessions[sessionIndex];
      const sortedConversations = this.sortConversations(session.conversationPairs);
      
      // Find the conversation with matching timestamp
      const sortedIndex = sortedConversations.findIndex(conv => 
        conv.userTime && 
        new Date(conv.userTime).getTime() === new Date(result.userTime).getTime()
      );
      
      if (sortedIndex !== -1) {
        this.selectedConversationIndex = sortedIndex;
      } else {
        // Fallback to original index if timestamp matching fails
        this.selectedConversationIndex = result.conversationIndex;
      }
      
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
    // Set a flag to scroll to bottom on next render
    // The actual max offset will be calculated by ViewRenderer
    this.scrollToEnd = true;
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
    const sortOrders = ['conversations', 'duration', 'tools', 'tokens', 'startTime', 'lastActivity'];
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
    const sortOrders = ['dateTime', 'duration', 'tools', 'tokens'];
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
          aValue = new Date(a.timestamp || a.userTime || 0);
          bValue = new Date(b.timestamp || b.userTime || 0);
          break;
        case 'duration':
          aValue = a.responseTime || 0;
          bValue = b.responseTime || 0;
          break;
        case 'tools':
          aValue = (a.toolsUsed && a.toolsUsed.length) || 0;
          bValue = (b.toolsUsed && b.toolsUsed.length) || 0;
          break;
        case 'tokens':
          aValue = (a.tokenUsage && a.tokenUsage.totalTokens) || 0;
          bValue = (b.tokenUsage && b.tokenUsage.totalTokens) || 0;
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
    this.scrollToEnd = false;
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
    if (this.selectedSessionIndex < 0) {
      this.selectedSessionIndex = 0;
    }
    if (this.selectedSessionIndex >= sessions.length) {
      this.selectedSessionIndex = Math.max(0, sessions.length - 1);
    }
    
    // Ensure selected conversation index is valid
    if (this.selectedConversationIndex < 0) {
      this.selectedConversationIndex = 0;
    }
    const currentSession = sessions[this.selectedSessionIndex];
    if (currentSession && currentSession.conversationPairs) {
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
   * Navigate directly to a specific session and conversation
   */
  navigateToSessionConversation(sessionId, conversationIndex, conversationTimestamp = null) {
    // Get the current filtered and sorted sessions
    const sessions = this.getFilteredSessions();
    
    // Find the session index in the current list
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    
    if (sessionIndex !== -1) {
      this.selectedSessionIndex = sessionIndex;
      
      // If we have a timestamp, find the conversation by timestamp in the sorted list
      if (conversationTimestamp) {
        const session = sessions[sessionIndex];
        const sortedConversations = this.sortConversations(session.conversationPairs);
        
        // Find the conversation with matching timestamp
        const sortedIndex = sortedConversations.findIndex(conv => 
          conv.userTime && 
          new Date(conv.userTime).getTime() === new Date(conversationTimestamp).getTime()
        );
        
        if (sortedIndex !== -1) {
          this.selectedConversationIndex = sortedIndex;
          return true;
        }
      }
      
      // Fallback to original index if timestamp matching fails
      this.selectedConversationIndex = conversationIndex;
      return true;
    }
    
    return false;
  }

  /**
   * Toggle tool expansion state
   */
  toggleToolExpansion(toolId) {
    const currentState = this.expandedTools.get(toolId) || false;
    this.expandedTools.set(toolId, !currentState);
    this.trackStateChange();
  }

  /**
   * Clear all tool expansions
   */
  clearToolExpansions() {
    this.expandedTools.clear();
    this.clearAllToolIds();
    this.trackStateChange();
  }

  /**
   * Check if tool is expanded
   */
  isToolExpanded(toolId) {
    return this.expandedTools.get(toolId) || false;
  }

  /**
   * Set current tool ID (for Ctrl+R focus)
   */
  setCurrentToolId(toolId) {
    this.currentToolId = toolId;
  }

  /**
   * Toggle current tool expansion
   */
  toggleCurrentToolExpansion() {
    if (this.currentToolId) {
      this.toggleToolExpansion(this.currentToolId);
      return true;
    }
    return false;
  }

  /**
   * Toggle all tool expansions
   */
  toggleAllToolExpansions() {
    // If any tools are expanded, collapse all
    // If all are collapsed, expand all registered tools
    const hasExpanded = Array.from(this.expandedTools.values()).some(expanded => expanded);
    
    if (hasExpanded) {
      // Collapse all
      this.expandedTools.clear();
    } else {
      // Expand all registered tools
      this.allToolIds.forEach(toolId => {
        this.expandedTools.set(toolId, true);
      });
    }
    
    this.trackStateChange();
    return true;
  }

  /**
   * Register a tool ID
   */
  registerToolId(toolId) {
    if (!this.allToolIds) {
      this.allToolIds = new Set();
    }
    this.allToolIds.add(toolId);
  }

  /**
   * Toggle sub-agent expansion
   */
  toggleSubAgentExpansion(subAgentId) {
    const currentState = this.expandedTools.get(subAgentId) || false;
    this.expandedTools.set(subAgentId, !currentState);
    return !currentState;
  }

  /**
   * Set selected sub-agent
   */
  setSelectedSubAgent(subAgentId) {
    this.selectedSubAgent = subAgentId;
  }

  /**
   * Get current selected sub-agent
   */
  getSelectedSubAgent() {
    return this.selectedSubAgent;
  }

  /**
   * Clear sub-agent selection
   */
  clearSubAgentSelection() {
    this.selectedSubAgent = null;
    this.selectedSubAgentData = null;
  }

  /**
   * Navigate to sub-agent detail view
   */
  navigateToSubAgentDetail(subAgentIndex, conversation) {
    if (conversation && conversation.subAgentCommands && 
        subAgentIndex >= 0 && subAgentIndex < conversation.subAgentCommands.length) {
      
      const subAgentPair = conversation.subAgentCommands[subAgentIndex];
      this.selectedSubAgentData = {
        index: subAgentIndex,
        command: subAgentPair.command,
        response: subAgentPair.response,
        conversation: conversation
      };
      
      this.setPreviousView();
      this.setView('subagent_detail');
      return true;
    }
    return false;
  }

  /**
   * Clear all tool IDs
   */
  clearAllToolIds() {
    if (this.allToolIds) {
      this.allToolIds.clear();
    }
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
    this.scrollToEnd = false;
    this.maxScrollOffset = 0;
    this.searchQuery = '';
    this.activeFilters = {
      project: null
    };
    this.sortOrder = 'lastActivity';
    this.sortDirection = 'desc';
    this.contextRange = config.contextFlow.defaultRange;
    
    // Clear cache
    this.filteredSessionsCache = null;
    this.cacheInvalidated = true;
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
    this.scrollOffset = state.scrollOffset || 0;
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
    // Track if this is from command-line search
    this.isCommandLineSearch = options.isCommandLineSearch || false;
    this.trackStateChange();
  }

  // Conversation tree navigation methods

  /**
   * Navigate to tree view for current session
   */
  navigateToTreeView() {
    const sessions = this.getFilteredSessions();
    const currentSession = sessions[this.selectedSessionIndex];
    
    if (currentSession && currentSession.conversationPairs.length > 0) {
      this.previousView = this.currentView;
      this.currentView = 'conversation_tree';
      
      // Initialize tree selection if not set
      if (!this.selectedTreeNodeUuid) {
        const tree = this.sessionManager.buildConversationTree(currentSession.conversationPairs);
        if (tree.roots.length > 0) {
          this.selectedTreeNodeUuid = tree.roots[0];
        }
      }
      
      this.scrollOffset = 0;
      this.trackStateChange();
    }
  }

  /**
   * Navigate tree nodes up/down
   */
  navigateTreeVertical(direction) {
    if (this.currentView !== 'conversation_tree') return;
    
    const sessions = this.getFilteredSessions();
    const currentSession = sessions[this.selectedSessionIndex];
    if (!currentSession) return;
    
    const tree = this.sessionManager.buildConversationTree(currentSession.conversationPairs);
    const visibleNodes = this.getVisibleTreeNodes(tree);
    
    if (visibleNodes.length === 0) return;
    
    const currentIndex = visibleNodes.findIndex(node => node.uuid === this.selectedTreeNodeUuid);
    let newIndex;
    
    if (direction === 'up') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : visibleNodes.length - 1;
    } else {
      newIndex = currentIndex < visibleNodes.length - 1 ? currentIndex + 1 : 0;
    }
    
    this.selectedTreeNodeUuid = visibleNodes[newIndex].uuid;
    this.trackStateChange();
  }

  /**
   * Get visible nodes in tree (respecting collapsed states)
   */
  getVisibleTreeNodes(tree) {
    const visibleNodes = [];
    
    const addNodeAndChildren = (nodeUuid, depth = 0) => {
      const node = tree.nodes.get(nodeUuid);
      if (!node) return;
      
      // Add current node
      visibleNodes.push({
        ...node,
        depth: depth
      });
      
      // Add children if node is expanded
      if (this.expandedTreeNodes.has(nodeUuid)) {
        const children = tree.children.get(nodeUuid) || [];
        for (const childUuid of children) {
          addNodeAndChildren(childUuid, depth + 1);
        }
      }
    };
    
    // Start with root nodes
    for (const rootUuid of tree.roots) {
      addNodeAndChildren(rootUuid);
    }
    
    return visibleNodes;
  }

  /**
   * Toggle tree node expansion
   */
  toggleTreeNodeExpansion(nodeUuid) {
    if (!nodeUuid) nodeUuid = this.selectedTreeNodeUuid;
    if (!nodeUuid) return;
    
    if (this.expandedTreeNodes.has(nodeUuid)) {
      this.expandedTreeNodes.delete(nodeUuid);
    } else {
      this.expandedTreeNodes.add(nodeUuid);
    }
    
    this.trackStateChange();
  }

  /**
   * Expand all tree nodes
   */
  expandAllTreeNodes() {
    const sessions = this.getFilteredSessions();
    const currentSession = sessions[this.selectedSessionIndex];
    if (!currentSession) return;
    
    const tree = this.sessionManager.buildConversationTree(currentSession.conversationPairs);
    
    // Add all nodes that have children to expanded set
    for (const [nodeUuid, children] of tree.children) {
      if (children.length > 0) {
        this.expandedTreeNodes.add(nodeUuid);
      }
    }
    
    this.trackStateChange();
  }

  /**
   * Collapse all tree nodes
   */
  collapseAllTreeNodes() {
    this.expandedTreeNodes.clear();
    this.trackStateChange();
  }

  /**
   * Switch tree mode (full/path)
   */
  switchTreeMode() {
    this.treeMode = this.treeMode === 'full' ? 'path' : 'full';
    this.trackStateChange();
  }

  /**
   * Navigate to selected tree node's conversation
   */
  navigateToTreeNodeConversation() {
    if (!this.selectedTreeNodeUuid) return;
    
    const sessions = this.getFilteredSessions();
    const currentSession = sessions[this.selectedSessionIndex];
    if (!currentSession) return;
    
    // Find the conversation pair that contains this node
    const selectedNode = currentSession.conversationPairs.find(conv => 
      conv.userUuid === this.selectedTreeNodeUuid || 
      conv.assistantUuid === this.selectedTreeNodeUuid
    );
    
    if (selectedNode) {
      // Find the index of this conversation
      const conversationIndex = currentSession.conversationPairs.indexOf(selectedNode);
      if (conversationIndex !== -1) {
        this.selectedConversationIndex = conversationIndex;
        this.previousView = this.currentView;
        this.currentView = 'full_detail';
        this.scrollOffset = 0;
        this.trackStateChange();
      }
    }
  }
}

module.exports = StateManager;