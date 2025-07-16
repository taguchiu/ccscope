const StateManager = require('../src/StateManager');
const { createMockSessionData } = require('./helpers/testHelpers');

jest.mock('../src/config', () => ({
  contextFlow: {
    defaultRange: 3,
    minRange: 1,
    maxRange: 10
  },
  localization: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'ja']
  },
  ui: {
    pageSize: 20
  }
}));

describe('StateManager', () => {
  let stateManager;
  let mockSessionManager;

  beforeEach(() => {
    mockSessionManager = {
      sessions: [
        createMockSessionData(),
        {
          ...createMockSessionData(),
          sessionId: '12345678',
          projectName: 'another-project',
          lastActivity: new Date('2024-01-02T10:00:00Z')
        }
      ],
      searchSessions: jest.fn((query) => mockSessionManager.sessions.filter(s => 
        s.projectName.includes(query) || s.sessionId.includes(query)
      )),
      filterSessions: jest.fn(() => mockSessionManager.sessions)
    };
    
    stateManager = new StateManager(mockSessionManager);
  });

  describe('constructor', () => {
    test('initializes with default state', () => {
      expect(stateManager.currentView).toBe('session_list');
      expect(stateManager.selectedSessionIndex).toBe(0);
      expect(stateManager.selectedConversationIndex).toBe(0);
      expect(stateManager.scrollOffset).toBe(0);
      expect(stateManager.sortOrder).toBe('lastActivity');
      expect(stateManager.language).toBe('en');
      expect(stateManager.theme).toBe('default');
    });

    test('initializes search state', () => {
      expect(stateManager.searchQuery).toBe('');
      expect(stateManager.searchResults).toEqual([]);
      expect(stateManager.highlightQuery).toBe('');
    });

    test('initializes tool expansion state', () => {
      expect(stateManager.expandedTools).toBeInstanceOf(Map);
      expect(stateManager.allToolIds).toBeInstanceOf(Set);
    });
  });

  describe('view management', () => {
    test('setView changes current view', () => {
      stateManager.setView('conversation_detail');
      
      expect(stateManager.currentView).toBe('conversation_detail');
      expect(stateManager.previousView).toBe('session_list');
      expect(stateManager.viewHistory).toContain('session_list');
    });

    test('setView resets scroll offset', () => {
      stateManager.scrollOffset = 10;
      stateManager.setView('conversation_detail');
      
      expect(stateManager.scrollOffset).toBe(0);
    });

    test('setView clears tool expansions when leaving full_detail', () => {
      stateManager.setView('full_detail');
      stateManager.expandedTools.set('tool1', true);
      stateManager.setView('session_list');
      
      expect(stateManager.expandedTools.size).toBe(0);
    });

    test('setPreviousView navigates back in history', () => {
      stateManager.setView('conversation_detail');
      stateManager.setView('full_detail');
      stateManager.setPreviousView();
      
      expect(stateManager.currentView).toBe('conversation_detail');
      expect(stateManager.viewHistory).toHaveLength(1);
    });

    test('getCurrentView returns current view', () => {
      expect(stateManager.getCurrentView()).toBe('session_list');
      stateManager.setView('search_results');
      expect(stateManager.getCurrentView()).toBe('search_results');
    });
  });

  describe('getViewData', () => {
    test('returns session list data', () => {
      const data = stateManager.getViewData();
      
      expect(data.sessions).toHaveLength(2);
      expect(data.selectedIndex).toBe(0);
      expect(data.sortOrder).toBe('lastActivity');
    });

    test('returns conversation detail data', () => {
      stateManager.setView('conversation_detail');
      const data = stateManager.getViewData();
      
      expect(data.session).toBeDefined();
      expect(data.conversations).toHaveLength(2);
      expect(data.selectedConversationIndex).toBe(0);
    });

    test('returns full detail data', () => {
      stateManager.setView('full_detail');
      const data = stateManager.getViewData();
      
      expect(data.session).toBeDefined();
      expect(data.conversations).toHaveLength(2);
      expect(data.scrollOffset).toBe(0);
      expect(data.scrollToEnd).toBe(false);
    });

    test('returns search results data', () => {
      stateManager.setView('search_results');
      stateManager.searchResults = [{ sessionId: 'test', conversationIndex: 0 }];
      const data = stateManager.getViewData();
      
      expect(data.searchResults).toHaveLength(1);
      expect(data.selectedIndex).toBe(0);
    });
  });

  describe('filtering and sorting', () => {
    test('getFilteredSessions returns all sessions by default', () => {
      const sessions = stateManager.getFilteredSessions();
      expect(sessions).toHaveLength(2);
    });

    test('getFilteredSessions applies search filter', () => {
      stateManager.searchQuery = 'test-project';
      const sessions = stateManager.getFilteredSessions();
      expect(mockSessionManager.searchSessions).toHaveBeenCalledWith('test-project');
    });

    test('getFilteredSessions caches results', () => {
      const sessions1 = stateManager.getFilteredSessions();
      const sessions2 = stateManager.getFilteredSessions();
      
      expect(sessions1).toBe(sessions2);
      expect(mockSessionManager.filterSessions).toHaveBeenCalledTimes(1);
    });

    test('sortSessions sorts by lastActivity descending by default', () => {
      const sorted = stateManager.sortSessions([...mockSessionManager.sessions]);
      
      expect(sorted[0].sessionId).toBe('12345678');
      expect(sorted[1].sessionId).toBe('52ccc342');
    });

    test('sortSessions respects sort direction', () => {
      stateManager.sortDirection = 'asc';
      const sorted = stateManager.sortSessions([...mockSessionManager.sessions]);
      
      expect(sorted[0].sessionId).toBe('52ccc342');
      expect(sorted[1].sessionId).toBe('12345678');
    });

    test('setSortOrder changes sort order', () => {
      const originalTrackStateChange = stateManager.trackStateChange;
      let cacheWasInvalidated = false;
      
      // Mock trackStateChange to capture the moment cache is invalidated
      stateManager.trackStateChange = function() {
        cacheWasInvalidated = this.cacheInvalidated;
        // Call original method
        originalTrackStateChange.call(this);
      };
      
      stateManager.setSortOrder('projectName');
      expect(stateManager.sortOrder).toBe('projectName');
      expect(cacheWasInvalidated).toBe(true);
      
      // Restore original method
      stateManager.trackStateChange = originalTrackStateChange;
    });

    test('setSortOrder toggles direction for same order', () => {
      stateManager.setSortOrder('lastActivity');
      expect(stateManager.sortDirection).toBe('asc');
      
      stateManager.setSortOrder('lastActivity');
      expect(stateManager.sortDirection).toBe('desc');
    });
  });

  describe('navigation', () => {
    test('navigateUp decreases selected index', () => {
      stateManager.selectedSessionIndex = 1;
      stateManager.navigateUp();
      expect(stateManager.selectedSessionIndex).toBe(0);
    });

    test('navigateUp clamps to beginning', () => {
      stateManager.selectedSessionIndex = 0;
      stateManager.navigateUp();
      expect(stateManager.selectedSessionIndex).toBe(0);
    });

    test('navigateDown increases selected index', () => {
      stateManager.selectedSessionIndex = 0;
      stateManager.navigateDown();
      expect(stateManager.selectedSessionIndex).toBe(1);
    });

    test('navigateDown clamps to end', () => {
      stateManager.selectedSessionIndex = 1;
      stateManager.navigateDown();
      expect(stateManager.selectedSessionIndex).toBe(1);
    });

    test('navigateToFirst sets index to 0', () => {
      stateManager.selectedSessionIndex = 1;
      stateManager.navigateToFirst();
      expect(stateManager.selectedSessionIndex).toBe(0);
    });

    test('navigateToLast sets index to end', () => {
      stateManager.selectedSessionIndex = 0;
      stateManager.navigateToLast();
      expect(stateManager.selectedSessionIndex).toBe(1);
    });
  });

  describe('scrolling', () => {
    test('scrollUp decreases scroll offset', () => {
      stateManager.scrollOffset = 5;
      stateManager.scrollUp(2);
      expect(stateManager.scrollOffset).toBe(3);
    });

    test('scrollUp clamps to 0', () => {
      stateManager.scrollOffset = 1;
      stateManager.scrollUp(5);
      expect(stateManager.scrollOffset).toBe(0);
    });

    test('scrollDown increases scroll offset', () => {
      stateManager.scrollOffset = 0;
      stateManager.maxScrollOffset = 10;
      stateManager.scrollDown(3);
      expect(stateManager.scrollOffset).toBe(3);
    });

    test('scrollDown clamps to max', () => {
      stateManager.scrollOffset = 8;
      stateManager.maxScrollOffset = 10;
      stateManager.scrollDown(5);
      expect(stateManager.scrollOffset).toBe(10);
    });

    test('scrollToTop sets offset to 0', () => {
      stateManager.scrollOffset = 10;
      stateManager.scrollToTop();
      expect(stateManager.scrollOffset).toBe(0);
    });

    test('scrollToBottom sets scrollToEnd flag', () => {
      stateManager.scrollToBottom();
      expect(stateManager.scrollToEnd).toBe(true);
    });
  });

  describe('search functionality', () => {
    test('setSearchQuery updates query and invalidates cache', () => {
      const originalTrackStateChange = stateManager.trackStateChange;
      let cacheWasInvalidated = false;
      
      // Mock trackStateChange to capture the moment cache is invalidated
      stateManager.trackStateChange = function() {
        cacheWasInvalidated = this.cacheInvalidated;
        // Call original method
        originalTrackStateChange.call(this);
      };
      
      stateManager.setSearchQuery('test');
      expect(stateManager.searchQuery).toBe('test');
      expect(cacheWasInvalidated).toBe(true);
      
      // Restore original method
      stateManager.trackStateChange = originalTrackStateChange;
    });

    test('clearSearch resets search state', () => {
      stateManager.setSearchQuery('test');
      
      const originalTrackStateChange = stateManager.trackStateChange;
      let cacheWasInvalidated = false;
      
      // Mock trackStateChange to capture the moment cache is invalidated
      stateManager.trackStateChange = function() {
        cacheWasInvalidated = this.cacheInvalidated;
        // Call original method
        originalTrackStateChange.call(this);
      };
      
      stateManager.clearSearch();
      
      expect(stateManager.searchQuery).toBe('');
      expect(cacheWasInvalidated).toBe(true);
      
      // Restore original method
      stateManager.trackStateChange = originalTrackStateChange;
    });

    test('setSearchResults stores search results', () => {
      const results = [{ sessionId: 'test', conversationIndex: 0 }];
      stateManager.setSearchResults('query', results, { regex: true });
      
      expect(stateManager.searchResults).toEqual(results);
      expect(stateManager.searchQuery).toBe('query');
      expect(stateManager.searchOptions.regex).toBe(true);
    });
  });

  describe('tool expansion', () => {
    test('toggleToolExpansion toggles tool state', () => {
      stateManager.toggleToolExpansion('tool1');
      expect(stateManager.expandedTools.get('tool1')).toBe(true);
      
      stateManager.toggleToolExpansion('tool1');
      expect(stateManager.expandedTools.get('tool1')).toBe(false);
    });

    test('clearToolExpansions clears all expansions', () => {
      stateManager.expandedTools.set('tool1', true);
      stateManager.expandedTools.set('tool2', true);
      stateManager.clearToolExpansions();
      
      expect(stateManager.expandedTools.size).toBe(0);
    });

    test('isToolExpanded returns expansion state', () => {
      stateManager.expandedTools.set('tool1', true);
      
      expect(stateManager.isToolExpanded('tool1')).toBe(true);
      expect(stateManager.isToolExpanded('tool2')).toBe(false);
    });

    test('toggleAllToolExpansions expands all when none expanded', () => {
      stateManager.allToolIds.add('tool1');
      stateManager.allToolIds.add('tool2');
      
      stateManager.toggleAllToolExpansions();
      
      expect(stateManager.expandedTools.get('tool1')).toBe(true);
      expect(stateManager.expandedTools.get('tool2')).toBe(true);
    });

    test('toggleAllToolExpansions collapses all when some expanded', () => {
      stateManager.allToolIds.add('tool1');
      stateManager.allToolIds.add('tool2');
      stateManager.expandedTools.set('tool1', true);
      
      stateManager.toggleAllToolExpansions();
      
      expect(stateManager.expandedTools.size).toBe(0);
    });
  });

  describe('state persistence', () => {
    test('exportState exports current state', () => {
      stateManager.setView('conversation_detail');
      stateManager.setSearchQuery('test');
      stateManager.selectedSessionIndex = 1; // Set after search query to avoid reset
      
      const exported = stateManager.exportState();
      
      expect(exported.currentView).toBe('conversation_detail');
      expect(exported.selectedSessionIndex).toBe(1);
      expect(exported.searchQuery).toBe('test');
    });

    test('importState restores state', () => {
      const state = {
        currentView: 'full_detail',
        selectedSessionIndex: 1,
        selectedConversationIndex: 1,
        scrollOffset: 5,
        searchQuery: 'imported',
        sortOrder: 'duration'
      };
      
      stateManager.importState(state);
      
      expect(stateManager.currentView).toBe('full_detail');
      expect(stateManager.selectedSessionIndex).toBe(1);
      expect(stateManager.selectedConversationIndex).toBe(1);
      expect(stateManager.scrollOffset).toBe(5);
      expect(stateManager.searchQuery).toBe('imported');
      expect(stateManager.sortOrder).toBe('duration');
    });

    test('resetState resets to defaults', () => {
      stateManager.setView('full_detail');
      stateManager.selectedSessionIndex = 5;
      stateManager.setSearchQuery('test');
      
      stateManager.resetState();
      
      expect(stateManager.currentView).toBe('session_list');
      expect(stateManager.selectedSessionIndex).toBe(0);
      expect(stateManager.searchQuery).toBe('');
    });
  });

  describe('context range', () => {
    test('increaseContextRange increases within bounds', () => {
      stateManager.contextRange = 3;
      stateManager.increaseContextRange();
      expect(stateManager.contextRange).toBe(4);
    });

    test('increaseContextRange clamps to max', () => {
      stateManager.contextRange = 10;
      stateManager.increaseContextRange();
      expect(stateManager.contextRange).toBe(10);
    });

    test('decreaseContextRange decreases within bounds', () => {
      stateManager.contextRange = 3;
      stateManager.decreaseContextRange();
      expect(stateManager.contextRange).toBe(2);
    });

    test('decreaseContextRange clamps to min', () => {
      stateManager.contextRange = 1;
      stateManager.decreaseContextRange();
      expect(stateManager.contextRange).toBe(1);
    });
  });

  describe('conversation sorting', () => {
    test('sortConversations sorts by dateTime descending by default', () => {
      const conversations = [
        { userTime: '2024-01-01T10:00:00Z' },
        { userTime: '2024-01-01T11:00:00Z' }
      ];
      
      const sorted = stateManager.sortConversations(conversations);
      
      expect(sorted[0].userTime).toBe('2024-01-01T11:00:00Z');
      expect(sorted[1].userTime).toBe('2024-01-01T10:00:00Z');
    });

    test('setConversationSortOrder changes sort order', () => {
      stateManager.setConversationSortOrder('duration');
      expect(stateManager.conversationSortOrder).toBe('duration');
    });

    test('cycleConversationSortOrder cycles through orders', () => {
      expect(stateManager.conversationSortOrder).toBe('dateTime');
      
      stateManager.cycleConversationSortOrder();
      expect(stateManager.conversationSortOrder).toBe('duration');
      
      stateManager.cycleConversationSortOrder();
      expect(stateManager.conversationSortOrder).toBe('tools');
      
      stateManager.cycleConversationSortOrder();
      expect(stateManager.conversationSortOrder).toBe('dateTime');
    });
  });

  describe('validateState', () => {
    test('validates and corrects invalid session index', () => {
      stateManager.selectedSessionIndex = 10;
      stateManager.validateState();
      expect(stateManager.selectedSessionIndex).toBe(1);
    });

    test('validates and corrects invalid conversation index', () => {
      stateManager.selectedConversationIndex = 10;
      stateManager.validateState();
      expect(stateManager.selectedConversationIndex).toBe(1);
    });

    test('validates and corrects invalid context range', () => {
      stateManager.contextRange = 0;
      stateManager.validateState();
      expect(stateManager.contextRange).toBe(1);
      
      stateManager.contextRange = 100;
      stateManager.validateState();
      expect(stateManager.contextRange).toBe(10);
    });
  });

  describe('edge cases and branching logic', () => {
    test('handles navigation with empty sessions', () => {
      stateManager.sessionManager.sessions = [];
      
      stateManager.navigateUp();
      expect(stateManager.selectedSessionIndex).toBe(0);
      
      stateManager.navigateDown();
      expect(stateManager.selectedSessionIndex).toBe(-1); // Current behavior: Math.min(-1, index+1)
      
      stateManager.navigateToLast();
      expect(stateManager.selectedSessionIndex).toBe(0); // Math.max(0, sessions.length - 1) = Math.max(0, -1) = 0
    });

    test('handles conversation navigation with no conversations', () => {
      const session = { ...createMockSessionData(), conversationPairs: [] };
      stateManager.sessionManager.sessions = [session];
      stateManager.selectedSessionIndex = 0;
      
      stateManager.setView('conversation_detail');
      stateManager.navigateUp();
      expect(stateManager.selectedConversationIndex).toBe(0);
      
      stateManager.navigateDown();
      expect(stateManager.selectedConversationIndex).toBe(0);
    });

    test('handles scroll operations at boundaries', () => {
      stateManager.scrollOffset = 0;
      stateManager.scrollUp(10);
      expect(stateManager.scrollOffset).toBe(0);
      
      stateManager.maxScrollOffset = 100;
      stateManager.scrollOffset = 100;
      stateManager.scrollDown(10);
      expect(stateManager.scrollOffset).toBe(100);
    });

    test('handles sort order edge cases', () => {
      // Test unknown sort order
      stateManager.sortOrder = 'unknown';
      const sessions = [createMockSessionData()];
      const sorted = stateManager.sortSessions(sessions);
      expect(sorted).toEqual(sessions);
      
      // Test with equal values
      const session1 = { ...createMockSessionData(), lastActivity: '2024-01-01' };
      const session2 = { ...createMockSessionData(), lastActivity: '2024-01-01' };
      const equalSessions = [session1, session2];
      const sortedEqual = stateManager.sortSessions(equalSessions);
      expect(sortedEqual.length).toBe(2);
    });

    test('handles conversation sorting edge cases', () => {
      // Test with no conversations
      const result = stateManager.sortConversations([]);
      expect(result).toEqual([]);
      
      // Test with null conversations
      const resultNull = stateManager.sortConversations(null);
      expect(resultNull).toEqual([]);
      
      // Test unknown sort order
      stateManager.conversationSortOrder = 'unknown';
      const conversations = [{ timestamp: '2024-01-01' }];
      const sorted = stateManager.sortConversations(conversations);
      expect(sorted).toEqual(conversations);
    });

    test('handles search results navigation edge cases', () => {
      stateManager.searchResults = [];
      stateManager.selectedSearchResultIndex = 0;
      
      stateManager.setView('search_results');
      stateManager.navigateUp();
      expect(stateManager.selectedSearchResultIndex).toBe(0);
      
      stateManager.navigateDown();
      expect(stateManager.selectedSearchResultIndex).toBe(-1); // Math.min(-1, index+1) when searchResults.length = 0
    });

    test('handles navigation to session conversation with various cases', () => {
      const session = { 
        sessionId: 'test-session',
        conversationPairs: [
          { userTime: '2024-01-01T10:00:00Z' },
          { userTime: '2024-01-01T11:00:00Z' }
        ]
      };
      stateManager.sessionManager.sessions = [session];
      
      // Test with timestamp
      const success1 = stateManager.navigateToSessionConversation('test-session', 0, '2024-01-01T10:00:00Z');
      expect(success1).toBe(true);
      
      // Test without timestamp
      const success2 = stateManager.navigateToSessionConversation('test-session', 1);
      expect(success2).toBe(true);
      
      // Test with non-existent session
      const success3 = stateManager.navigateToSessionConversation('nonexistent', 0);
      expect(success3).toBe(false);
    });

    test('handles search result navigation', () => {
      const results = [
        { sessionId: 'test-session', conversationIndex: 0, userTime: '2024-01-01T10:00:00Z' },
        { sessionId: 'test-session', conversationIndex: 1, userTime: '2024-01-01T11:00:00Z' }
      ];
      
      stateManager.previousSearchState = {
        results: results,
        selectedIndex: 0,
        query: 'test',
        options: {}
      };
      
      // Test left navigation
      stateManager.navigateSearchResultLeft();
      expect(stateManager.previousSearchState.selectedIndex).toBe(0);
      
      // Test right navigation
      stateManager.navigateSearchResultRight();
      expect(stateManager.previousSearchState.selectedIndex).toBe(1);
      
      // Test navigation at boundary
      stateManager.navigateSearchResultRight();
      expect(stateManager.previousSearchState.selectedIndex).toBe(1);
    });

    test('handles filter edge cases', () => {
      // Test clearing specific filter
      stateManager.activeFilters.project = 'test';
      stateManager.clearFilter('project');
      expect(stateManager.activeFilters.project).toBeNull();
      
      // Test clearing non-existent filter - clearFilter sets it to null
      stateManager.clearFilter('nonexistent');
      expect(stateManager.activeFilters.nonexistent).toBeNull();
    });

    test('handles tool expansion edge cases', () => {
      // Test toggling non-existent tool
      stateManager.toggleToolExpansion('nonexistent');
      expect(stateManager.isToolExpanded('nonexistent')).toBe(true);
      
      // Test current tool expansion when no current tool
      stateManager.currentToolId = null;
      const result = stateManager.toggleCurrentToolExpansion();
      expect(result).toBe(false);
      
      // Test with current tool
      stateManager.currentToolId = 'test-tool';
      const result2 = stateManager.toggleCurrentToolExpansion();
      expect(result2).toBe(true);
    });

    test('handles page size calculation edge cases', () => {
      // Mock process.stdout.rows
      const originalRows = process.stdout.rows;
      
      process.stdout.rows = undefined;
      const pageSize1 = stateManager.getPageSize();
      expect(pageSize1).toBeGreaterThan(0);
      
      process.stdout.rows = 5;
      const pageSize2 = stateManager.getPageSize();
      expect(pageSize2).toBe(1);
      
      process.stdout.rows = originalRows;
    });

    test('handles basic view operations', () => {
      // Test view changes
      stateManager.setView('conversation_detail');
      expect(stateManager.currentView).toBe('conversation_detail');
      
      stateManager.setView('full_detail');
      expect(stateManager.currentView).toBe('full_detail');
      
      stateManager.setPreviousView();
      expect(stateManager.currentView).toBe('conversation_detail');
    });

    test('handles additional state scenarios', () => {
      // Test search state management
      const searchResults = [
        { sessionId: 'session1', conversationIndex: 0, userTime: '2024-01-01T10:00:00Z' }
      ];
      
      stateManager.setSearchResults('test query', searchResults, { regex: false });
      expect(stateManager.searchResults).toEqual(searchResults);
      expect(stateManager.searchQuery).toBe('test query');
      
      // Test basic tool expansion
      stateManager.toggleToolExpansion('tool1');
      expect(stateManager.isToolExpanded('tool1')).toBe(true);
      
      stateManager.toggleToolExpansion('tool1');
      expect(stateManager.isToolExpanded('tool1')).toBe(false);
    });

    test('handles conditional navigation branches', () => {
      // Test navigation with different view states
      stateManager.currentView = 'session_list';
      stateManager.selectedSessionIndex = 1;
      
      // Test navigateUp at boundary
      stateManager.selectedSessionIndex = 0;
      stateManager.navigateUp();
      expect(stateManager.selectedSessionIndex).toBe(0); // Should clamp
      
      // Test navigateDown at boundary  
      stateManager.selectedSessionIndex = 1; // Last index
      stateManager.navigateDown();
      expect(stateManager.selectedSessionIndex).toBe(1); // Should clamp
      
      // Test in conversation_detail view
      stateManager.setView('conversation_detail');
      stateManager.selectedConversationIndex = 0;
      
      const mockSession = createMockSessionData();
      stateManager.sessionManager.sessions = [mockSession];
      
      stateManager.navigateUp();
      expect(stateManager.selectedConversationIndex).toBe(0); // Should clamp
      
      stateManager.navigateDown();
      expect(stateManager.selectedConversationIndex).toBeGreaterThanOrEqual(0);
    });

    test('handles sorting with different criteria', () => {
      const sessions = [
        { ...createMockSessionData(), sessionId: 'a', lastActivity: new Date('2024-01-01'), duration: 1000 },
        { ...createMockSessionData(), sessionId: 'b', lastActivity: new Date('2024-01-02'), duration: 2000 },
        { ...createMockSessionData(), sessionId: 'c', lastActivity: new Date('2024-01-03'), duration: 500 }
      ];
      
      // Test different sort orders
      stateManager.sortOrder = 'lastActivity';
      stateManager.sortDirection = 'desc';
      const sorted1 = stateManager.sortSessions([...sessions]);
      expect(sorted1[0].sessionId).toBe('c');
      
      stateManager.sortOrder = 'duration';
      stateManager.sortDirection = 'asc';
      const sorted2 = stateManager.sortSessions([...sessions]);
      expect(sorted2[0].sessionId).toBe('c');
      
      stateManager.sortOrder = 'projectName';
      const sorted3 = stateManager.sortSessions([...sessions]);
      expect(sorted3).toHaveLength(3);
      
      // Test unknown sort order branch
      stateManager.sortOrder = 'unknown';
      const sorted4 = stateManager.sortSessions([...sessions]);
      expect(sorted4).toEqual(sessions); // Should return unchanged
    });

    test('handles view data with different states', () => {
      // Test session_list view data
      stateManager.currentView = 'session_list';
      const listData = stateManager.getViewData();
      expect(listData.sessions).toBeDefined();
      
      // Test conversation_detail view data
      stateManager.currentView = 'conversation_detail';
      stateManager.selectedSessionIndex = 0;
      const detailData = stateManager.getViewData();
      expect(detailData.session).toBeDefined();
      
      // Test full_detail view data
      stateManager.currentView = 'full_detail';
      const fullData = stateManager.getViewData();
      expect(fullData.session).toBeDefined();
      expect(fullData.scrollOffset).toBeDefined();
      
      // Test search_results view data
      stateManager.currentView = 'search_results';
      stateManager.searchResults = [{ sessionId: 'test', conversationIndex: 0 }];
      const searchData = stateManager.getViewData();
      expect(searchData.searchResults).toBeDefined();
      
      // Test help view data
      stateManager.currentView = 'help';
      const helpData = stateManager.getViewData();
      expect(helpData).toBeDefined();
    });

    test('handles scroll operations with boundaries', () => {
      // Test scrollDown with maxScrollOffset
      stateManager.scrollOffset = 5;
      stateManager.maxScrollOffset = 10;
      stateManager.scrollDown(3);
      expect(stateManager.scrollOffset).toBe(8);
      
      // Test scrollDown at max boundary
      stateManager.scrollOffset = 10;
      stateManager.maxScrollOffset = 10;
      stateManager.scrollDown(5);
      expect(stateManager.scrollOffset).toBe(10); // Should clamp
      
      // Test scrollUp with boundary
      stateManager.scrollOffset = 2;
      stateManager.scrollUp(5);
      expect(stateManager.scrollOffset).toBe(0); // Should clamp
    });

    test('handles context range boundaries', () => {
      // Test increaseContextRange at max
      stateManager.contextRange = 10; // Max from config
      stateManager.increaseContextRange();
      expect(stateManager.contextRange).toBe(10); // Should not exceed max
      
      // Test decreaseContextRange at min
      stateManager.contextRange = 1; // Min from config
      stateManager.decreaseContextRange();
      expect(stateManager.contextRange).toBe(1); // Should not go below min
    });

    test('handles search with different options', () => {
      // Test setSearchQuery with different values
      stateManager.setSearchQuery('test query');
      expect(stateManager.searchQuery).toBe('test query');
      
      stateManager.setSearchQuery('');
      expect(stateManager.searchQuery).toBe('');
      
      // Test setSearchResults with different options
      const results = [{ sessionId: 'test', conversationIndex: 0 }];
      
      stateManager.setSearchResults('query1', results, { regex: true });
      expect(stateManager.searchOptions.regex).toBe(true);
      
      stateManager.setSearchResults('query2', results, { caseSensitive: true });
      expect(stateManager.searchOptions.caseSensitive).toBe(true);
      
      stateManager.setSearchResults('query3', results, {});
      expect(stateManager.searchOptions).toEqual({});
    });

    test('handles tool expansion with different scenarios', () => {
      // Test toggleAllToolExpansions when some tools are expanded
      stateManager.allToolIds.add('tool1');
      stateManager.allToolIds.add('tool2');
      stateManager.allToolIds.add('tool3');
      
      stateManager.expandedTools.set('tool1', true);
      stateManager.expandedTools.set('tool2', false);
      
      // Should collapse all when some are expanded
      stateManager.toggleAllToolExpansions();
      expect(stateManager.expandedTools.size).toBe(0);
      
      // Should expand all when none are expanded
      stateManager.toggleAllToolExpansions();
      expect(stateManager.expandedTools.get('tool1')).toBe(true);
      expect(stateManager.expandedTools.get('tool2')).toBe(true);
      expect(stateManager.expandedTools.get('tool3')).toBe(true);
    });

    test('handles conversation sorting edge cases', () => {
      // Test with null conversations
      const nullResult = stateManager.sortConversations(null);
      expect(nullResult).toEqual([]);
      
      // Test with empty array
      const emptyResult = stateManager.sortConversations([]);
      expect(emptyResult).toEqual([]);
      
      // Test with unknown sort order
      stateManager.conversationSortOrder = 'unknown';
      const conversations = [{ timestamp: '2024-01-01' }];
      const unknownResult = stateManager.sortConversations(conversations);
      expect(unknownResult).toEqual(conversations);
    });

    test('handles advanced navigation scenarios', () => {
      // Test different navigation paths
      stateManager.setView('session_list');
      expect(stateManager.currentView).toBe('session_list');
      
      stateManager.setView('conversation_detail');
      expect(stateManager.currentView).toBe('conversation_detail');
      
      stateManager.setView('full_detail');
      expect(stateManager.currentView).toBe('full_detail');
      
      // Test navigation with state restoration
      stateManager.setPreviousView();
      expect(stateManager.currentView).toBe('conversation_detail');
      
      stateManager.setPreviousView();
      expect(stateManager.currentView).toBe('session_list');
    });

    test('handles state validation and error recovery', () => {
      // Test state validation
      stateManager.selectedSessionIndex = -1;
      stateManager.validateState();
      expect(stateManager.selectedSessionIndex).toBe(0);
      
      stateManager.selectedSessionIndex = 999;
      stateManager.validateState();
      expect(stateManager.selectedSessionIndex).toBeLessThan(mockSessionManager.sessions.length);
      
      // Test error recovery
      stateManager.selectedConversationIndex = -1;
      stateManager.validateState();
      expect(stateManager.selectedConversationIndex).toBe(0);
    });

    test('handles search state transitions', () => {
      // Test search state transitions
      stateManager.setSearchQuery('test');
      expect(stateManager.searchQuery).toBe('test');
      
      stateManager.setView('search_results');
      expect(stateManager.currentView).toBe('search_results');
      
      stateManager.clearSearch();
      expect(stateManager.searchQuery).toBe('');
      
      stateManager.setView('session_list');
      expect(stateManager.currentView).toBe('session_list');
    });

    test('handles complex sort operations', () => {
      // Test complex sort operations
      const complexSessions = [
        { 
          ...createMockSessionData(), 
          sessionId: 'a', 
          lastActivity: new Date('2024-01-01'), 
          duration: 1000,
          projectName: 'project-a'
        },
        { 
          ...createMockSessionData(), 
          sessionId: 'b', 
          lastActivity: new Date('2024-01-02'), 
          duration: 2000,
          projectName: 'project-b'
        },
        { 
          ...createMockSessionData(), 
          sessionId: 'c', 
          lastActivity: new Date('2024-01-03'), 
          duration: 500,
          projectName: 'project-c'
        }
      ];
      
      mockSessionManager.sessions = complexSessions;
      
      // Test different sort combinations
      stateManager.sortOrder = 'lastActivity';
      stateManager.sortDirection = 'desc';
      const sorted1 = stateManager.getFilteredSessions();
      expect(sorted1[0].sessionId).toBe('c');
      
      stateManager.sortOrder = 'duration';
      stateManager.sortDirection = 'asc';
      const sorted2 = stateManager.getFilteredSessions();
      expect(sorted2[0].sessionId).toBe('c');
      
      stateManager.sortOrder = 'projectName';
      stateManager.sortDirection = 'asc';
      const sorted3 = stateManager.getFilteredSessions();
      expect(sorted3[0].projectName).toBe('project-a');
    });

    test('handles tool expansion state management', () => {
      // Test tool expansion state
      stateManager.allToolIds.add('tool1');
      stateManager.allToolIds.add('tool2');
      stateManager.allToolIds.add('tool3');
      
      // Test expanding individual tools
      stateManager.toggleToolExpansion('tool1');
      expect(stateManager.isToolExpanded('tool1')).toBe(true);
      
      stateManager.toggleToolExpansion('tool2');
      expect(stateManager.isToolExpanded('tool2')).toBe(true);
      
      // Test expanding all tools
      stateManager.toggleAllToolExpansions();
      expect(stateManager.expandedTools.size).toBe(0); // Should collapse all
      
      // Test expanding all when none are expanded
      stateManager.toggleAllToolExpansions();
      expect(stateManager.expandedTools.get('tool1')).toBe(true);
      expect(stateManager.expandedTools.get('tool2')).toBe(true);
      expect(stateManager.expandedTools.get('tool3')).toBe(true);
    });

    test('handles cache invalidation scenarios', () => {
      // Test cache invalidation
      stateManager.getFilteredSessions(); // Populate cache
      expect(stateManager.cacheInvalidated).toBe(false);
      
      stateManager.setSortOrder('duration');
      expect(stateManager.cacheInvalidated).toBe(true);
      
      stateManager.getFilteredSessions(); // Repopulate cache
      expect(stateManager.cacheInvalidated).toBe(false);
      
      stateManager.setSearchQuery('test');
      expect(stateManager.cacheInvalidated).toBe(true);
    });

    test('handles boundary conditions in navigation', () => {
      // Test boundary conditions
      stateManager.sessionManager.sessions = [];
      
      stateManager.navigateUp();
      expect(stateManager.selectedSessionIndex).toBe(0);
      
      stateManager.navigateDown();
      expect(stateManager.selectedSessionIndex).toBe(-1);
      
      stateManager.navigateToFirst();
      expect(stateManager.selectedSessionIndex).toBe(0);
      
      stateManager.navigateToLast();
      expect(stateManager.selectedSessionIndex).toBe(0);
    });

    test('handles view data computation with different states', () => {
      // Test view data computation
      stateManager.currentView = 'session_list';
      const listData = stateManager.getViewData();
      expect(listData).toHaveProperty('sessions');
      expect(listData).toHaveProperty('selectedIndex');
      expect(listData).toHaveProperty('sortOrder');
      
      stateManager.currentView = 'conversation_detail';
      const detailData = stateManager.getViewData();
      expect(detailData).toHaveProperty('session');
      expect(detailData).toHaveProperty('conversations');
      
      stateManager.currentView = 'full_detail';
      const fullData = stateManager.getViewData();
      expect(fullData).toHaveProperty('session');
      expect(fullData).toHaveProperty('scrollOffset');
      
      stateManager.currentView = 'search_results';
      const searchData = stateManager.getViewData();
      expect(searchData).toHaveProperty('searchResults');
      
      stateManager.currentView = 'help';
      const helpData = stateManager.getViewData();
      expect(helpData).toBeDefined();
    });
  });
});