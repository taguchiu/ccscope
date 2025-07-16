const StateManager = require('../src/StateManager');
const config = require('../src/config');

jest.mock('../src/config', () => ({
  contextFlow: {
    defaultRange: 3,
    minRange: 1,
    maxRange: 10
  },
  performance: {
    maxVisibleSessions: 50
  },
  localization: {
    supportedLanguages: ['en', 'ja']
  }
}));

describe('StateManager Extended Tests', () => {
  let stateManager;
  let mockSessionManager;

  beforeEach(() => {
    mockSessionManager = {
      sessions: [
        {
          sessionId: 'session1',
          projectName: 'project1',
          conversationPairs: [
            { timestamp: new Date('2024-01-01T10:00:00Z'), index: 0 },
            { timestamp: new Date('2024-01-01T11:00:00Z'), index: 1 }
          ],
          lastActivity: new Date('2024-01-01T11:00:00Z'),
          totalDuration: 3600000,
          totalResponseTime: 1800000
        },
        {
          sessionId: 'session2',
          projectName: 'project2',
          conversationPairs: [
            { timestamp: new Date('2024-01-02T10:00:00Z'), index: 0 }
          ],
          lastActivity: new Date('2024-01-02T10:00:00Z'),
          totalDuration: 1800000,
          totalResponseTime: 900000
        }
      ]
    };

    stateManager = new StateManager(mockSessionManager);
  });

  describe('advanced navigation', () => {
    test('navigates to specific conversation by timestamp', () => {
      const timestamp = new Date('2024-01-01T11:00:00Z');
      const result = stateManager.navigateToSessionConversation('session1', 1, timestamp);
      
      expect(result).toBe(true);
      expect(stateManager.selectedSessionIndex).toBe(0);
      expect(stateManager.selectedConversationIndex).toBe(1);
      expect(stateManager.currentView).toBe('full_detail');
    });

    test('handles navigation to non-existent session', () => {
      const result = stateManager.navigateToSessionConversation('nonexistent', 0);
      expect(result).toBe(false);
    });

    test('handles navigation with search context', () => {
      stateManager.previousSearchState = {
        results: [
          { sessionIndex: 0, conversationIndex: 1 },
          { sessionIndex: 1, conversationIndex: 0 }
        ],
        selectedIndex: 0,
        query: 'test'
      };

      stateManager.navigateSearchResultRight();
      
      expect(stateManager.previousSearchState.selectedIndex).toBe(1);
      expect(stateManager.selectedSessionIndex).toBe(1);
      expect(stateManager.selectedConversationIndex).toBe(0);
    });

    test('wraps around when navigating search results', () => {
      stateManager.previousSearchState = {
        results: [
          { sessionIndex: 0, conversationIndex: 0 },
          { sessionIndex: 1, conversationIndex: 0 }
        ],
        selectedIndex: 1,
        query: 'test'
      };

      stateManager.navigateSearchResultRight();
      
      expect(stateManager.previousSearchState.selectedIndex).toBe(0);
    });
  });

  describe('filtering with complex queries', () => {
    test('filters by multiple criteria', () => {
      stateManager.setFilter('project', 'project1');
      stateManager.setFilter('minDuration', 3000000);
      
      const filtered = stateManager.getFilteredSessions();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sessionId).toBe('session1');
    });

    test('maintains filter when sorting changes', () => {
      stateManager.setFilter('project', 'project1');
      stateManager.setSortOrder('duration');
      
      const filtered = stateManager.getFilteredSessions();
      expect(filtered).toHaveLength(1);
    });

    test('clears specific filter', () => {
      stateManager.setFilter('project', 'project1');
      stateManager.setFilter('minDuration', 3000000);
      
      stateManager.clearFilter('project');
      
      expect(stateManager.filters.project).toBeUndefined();
      expect(stateManager.filters.minDuration).toBe(3000000);
    });
  });

  describe('bookmarks management', () => {
    test('maintains bookmark order', () => {
      const session1 = mockSessionManager.sessions[0];
      const session2 = mockSessionManager.sessions[1];
      
      stateManager.bookmarkSession(session1);
      stateManager.bookmarkSession(session2);
      
      const bookmarks = stateManager.getBookmarkedSessions();
      expect(bookmarks[0]).toBe(session1);
      expect(bookmarks[1]).toBe(session2);
    });

    test('prevents duplicate bookmarks', () => {
      const session = mockSessionManager.sessions[0];
      
      stateManager.bookmarkSession(session);
      stateManager.bookmarkSession(session);
      
      const bookmarks = stateManager.getBookmarkedSessions();
      expect(bookmarks).toHaveLength(1);
    });

    test('removes bookmark correctly', () => {
      const session = mockSessionManager.sessions[0];
      
      stateManager.bookmarkSession(session);
      expect(stateManager.isBookmarked(session)).toBe(true);
      
      stateManager.unbookmarkSession(session);
      expect(stateManager.isBookmarked(session)).toBe(false);
    });
  });

  describe('state persistence', () => {
    test('exports complete state', () => {
      stateManager.selectedSessionIndex = 1;
      stateManager.selectedConversationIndex = 0;
      stateManager.currentView = 'conversation_detail';
      stateManager.searchQuery = 'test';
      stateManager.filters = { project: 'project1' };
      stateManager.bookmarkSession(mockSessionManager.sessions[0]);
      
      const exported = stateManager.exportState();
      
      expect(exported.selectedSessionIndex).toBe(1);
      expect(exported.currentView).toBe('conversation_detail');
      expect(exported.searchQuery).toBe('test');
      expect(exported.filters).toEqual({ project: 'project1' });
      expect(exported.bookmarkedSessions).toHaveLength(1);
    });

    test('imports state with validation', () => {
      const state = {
        selectedSessionIndex: 10, // Invalid index
        selectedConversationIndex: -1, // Invalid index
        currentView: 'invalid_view',
        searchQuery: 'imported',
        contextRange: 20 // Out of bounds
      };
      
      stateManager.importState(state);
      
      // Should validate and correct invalid values
      expect(stateManager.selectedSessionIndex).toBe(1); // Clamped to valid range
      expect(stateManager.selectedConversationIndex).toBe(0); // Corrected to 0
      expect(stateManager.currentView).toBe('session_list'); // Reset to default
      expect(stateManager.searchQuery).toBe('imported');
      expect(stateManager.contextRange).toBe(10); // Clamped to max
    });

    test('handles partial state import', () => {
      const partialState = {
        searchQuery: 'partial',
        sortOrder: 'duration'
      };
      
      stateManager.importState(partialState);
      
      expect(stateManager.searchQuery).toBe('partial');
      expect(stateManager.sortOrder).toBe('duration');
      expect(stateManager.currentView).toBe('session_list'); // Unchanged
    });
  });

  describe('sorting edge cases', () => {
    test('sorts by response time with null values', () => {
      mockSessionManager.sessions.push({
        sessionId: 'session3',
        projectName: 'project3',
        conversationPairs: [],
        lastActivity: new Date(),
        totalDuration: 0,
        totalResponseTime: null
      });
      
      stateManager.setSortOrder('responseTime');
      const sorted = stateManager.sortSessions(mockSessionManager.sessions);
      
      // Null values should be sorted last
      expect(sorted[sorted.length - 1].sessionId).toBe('session3');
    });

    test('maintains stable sort for equal values', () => {
      mockSessionManager.sessions[0].totalDuration = 1000;
      mockSessionManager.sessions[1].totalDuration = 1000;
      
      stateManager.setSortOrder('duration');
      const sorted = stateManager.sortSessions(mockSessionManager.sessions);
      
      // Should maintain original order for equal values
      expect(sorted[0].sessionId).toBe('session1');
      expect(sorted[1].sessionId).toBe('session2');
    });
  });

  describe('view data computation', () => {
    test('computes correct data for conversation flow view', () => {
      stateManager.currentView = 'conversation_flow';
      stateManager.contextRange = 2;
      stateManager.selectedConversationIndex = 1;
      
      const viewData = stateManager.getViewData();
      
      expect(viewData.view).toBe('conversation_flow');
      expect(viewData.contextRange).toBe(2);
      expect(viewData.centerIndex).toBe(1);
    });

    test('handles empty search results', () => {
      stateManager.currentView = 'search_results';
      stateManager.searchResults = [];
      
      const viewData = stateManager.getViewData();
      
      expect(viewData.searchResults).toEqual([]);
      expect(viewData.selectedIndex).toBe(0);
    });
  });

  describe('scroll behavior', () => {
    test('scrolls to end correctly', () => {
      stateManager.scrollToBottom();
      expect(stateManager.scrollToEnd).toBe(true);
      
      // Should reset after render
      stateManager.maxScrollOffset = 100;
      stateManager.setMaxScrollOffset(100);
      expect(stateManager.scrollOffset).toBe(100);
      expect(stateManager.scrollToEnd).toBe(false);
    });

    test('maintains scroll position within bounds', () => {
      stateManager.maxScrollOffset = 50;
      
      stateManager.scrollOffset = 30;
      stateManager.scrollDown(40); // Try to scroll beyond max
      
      expect(stateManager.scrollOffset).toBe(50);
    });

    test('calculates page size correctly', () => {
      stateManager.pageSize = 20;
      expect(stateManager.getPageSize()).toBe(20);
      
      stateManager.pageSize = 0;
      expect(stateManager.getPageSize()).toBe(24); // Default terminal height
    });
  });

  describe('tool expansion state', () => {
    test('tracks individual tool expansions', () => {
      stateManager.registerToolId('tool1');
      stateManager.registerToolId('tool2');
      
      stateManager.toggleToolExpansion('tool1');
      
      expect(stateManager.isToolExpanded('tool1')).toBe(true);
      expect(stateManager.isToolExpanded('tool2')).toBe(false);
    });

    test('expands all tools when none expanded', () => {
      stateManager.registerToolId('tool1');
      stateManager.registerToolId('tool2');
      stateManager.registerToolId('tool3');
      
      const changed = stateManager.toggleAllToolExpansions();
      
      expect(changed).toBe(true);
      expect(stateManager.expandedTools.size).toBe(3);
    });

    test('collapses all tools when some expanded', () => {
      stateManager.registerToolId('tool1');
      stateManager.registerToolId('tool2');
      stateManager.toggleToolExpansion('tool1');
      
      const changed = stateManager.toggleAllToolExpansions();
      
      expect(changed).toBe(true);
      expect(stateManager.expandedTools.size).toBe(0);
    });

    test('clears tool state when changing views', () => {
      stateManager.currentView = 'full_detail';
      stateManager.registerToolId('tool1');
      stateManager.toggleToolExpansion('tool1');
      
      stateManager.setView('session_list');
      
      expect(stateManager.expandedTools.size).toBe(0);
      expect(stateManager.allToolIds.size).toBe(0);
    });
  });

  describe('language management', () => {
    test('toggles between supported languages', () => {
      stateManager.currentLanguage = 'en';
      stateManager.toggleLanguage();
      expect(stateManager.currentLanguage).toBe('ja');
      
      stateManager.toggleLanguage();
      expect(stateManager.currentLanguage).toBe('en');
    });

    test('validates language on set', () => {
      const result1 = stateManager.setLanguage('ja');
      expect(result1).toBe(true);
      expect(stateManager.currentLanguage).toBe('ja');
      
      const result2 = stateManager.setLanguage('invalid');
      expect(result2).toBe(false);
      expect(stateManager.currentLanguage).toBe('ja');
    });
  });

  describe('performance optimizations', () => {
    test('uses cache for filtered sessions', () => {
      stateManager.searchQuery = 'test';
      
      // First call computes
      const filtered1 = stateManager.getFilteredSessions();
      
      // Second call uses cache
      const filtered2 = stateManager.getFilteredSessions();
      
      expect(filtered1).toBe(filtered2);
    });

    test('invalidates cache on state change', () => {
      stateManager.searchQuery = 'test';
      const filtered1 = stateManager.getFilteredSessions();
      
      stateManager.setSearchQuery('new');
      const filtered2 = stateManager.getFilteredSessions();
      
      expect(filtered1).not.toBe(filtered2);
    });

    test('tracks state changes', () => {
      const initialCount = stateManager.stateChangeCount;
      
      stateManager.setView('conversation_detail');
      stateManager.navigateDown();
      stateManager.setSearchQuery('test');
      
      expect(stateManager.stateChangeCount).toBe(initialCount + 3);
    });
  });

  describe('error recovery', () => {
    test('handles invalid conversation index gracefully', () => {
      stateManager.selectedConversationIndex = 999;
      stateManager.validateState();
      
      expect(stateManager.selectedConversationIndex).toBe(0);
    });

    test('handles empty sessions array', () => {
      mockSessionManager.sessions = [];
      stateManager = new StateManager(mockSessionManager);
      
      stateManager.navigateDown();
      expect(stateManager.selectedSessionIndex).toBe(0);
      
      const viewData = stateManager.getViewData();
      expect(viewData.sessions).toEqual([]);
    });

    test('recovers from corrupted state', () => {
      stateManager.selectedSessionIndex = -5;
      stateManager.selectedConversationIndex = -10;
      stateManager.contextRange = -1;
      stateManager.scrollOffset = -100;
      
      stateManager.validateState();
      
      expect(stateManager.selectedSessionIndex).toBe(0);
      expect(stateManager.selectedConversationIndex).toBe(0);
      expect(stateManager.contextRange).toBe(1);
      expect(stateManager.scrollOffset).toBe(0);
    });
  });
});