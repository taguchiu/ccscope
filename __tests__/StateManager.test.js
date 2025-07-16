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
});