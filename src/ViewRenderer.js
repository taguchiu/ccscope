/**
 * ViewRenderer
 * Handles all display logic and view rendering
 */

const config = require('./config');
const path = require('path');
const { formatWithUnit, formatLargeNumber } = require('./utils/formatters');
const textTruncator = require('./utils/textTruncator');

class ViewRenderer {
  constructor(sessionManager, themeManager, stateManager) {
    this.sessionManager = sessionManager;
    this.theme = themeManager;
    this.state = stateManager;
    
    // Terminal dimensions
    this.terminalWidth = process.stdout.columns || config.terminal.defaultWidth;
    this.terminalHeight = process.stdout.rows || config.terminal.defaultHeight;
    
    // Layout calculations
    this.leftWidth = Math.floor(this.terminalWidth * 0.6);
    this.rightWidth = this.terminalWidth - this.leftWidth - 1;
    
    // Performance tracking
    this.renderStartTime = 0;
    this.frameCount = 0;
    
    // Cache for computed layouts
    this.layoutCache = new Map();
  }

  /**
   * Update terminal dimensions
   */
  updateTerminalSize() {
    this.terminalWidth = process.stdout.columns || config.terminal.defaultWidth;
    this.terminalHeight = process.stdout.rows || config.terminal.defaultHeight;
    
    // Recalculate layout
    this.leftWidth = Math.floor(this.terminalWidth * 0.6);
    this.rightWidth = this.terminalWidth - this.leftWidth - 1;
    
    // Clear layout cache
    this.layoutCache.clear();
  }

  /**
   * Clear screen
   */
  clearScreen() {
    console.clear();
  }

  /**
   * Render current view
   */
  render() {
    this.renderStartTime = Date.now();
    
    const currentView = this.state.getCurrentView();
    
    // Skip render if terminal size is too small
    if (this.terminalHeight < config.terminal.minHeight || this.terminalWidth < config.terminal.minWidth) {
      console.clear();
      console.log('Terminal too small. Please resize.');
      return;
    }
    
    const viewData = this.state.getViewData();
    
    switch (currentView) {
      case 'session_list':
        this.renderSessionList(viewData);
        break;
      case 'conversation_detail':
        this.renderConversationDetail(viewData);
        break;
      case 'full_detail':
        this.renderFullDetail(viewData);
        break;
      case 'search':
        this.renderSearch(viewData);
        break;
      case 'filter':
        this.renderFilter(viewData);
        break;
      case 'search_results':
        this.renderSearchResultsInteractive(viewData);
        break;
      case 'conversation_tree':
        this.renderConversationTree(viewData);
        break;
      case 'help':
        this.renderHelp();
        break;
      case 'subagent_detail':
        this.renderSubAgentDetail(viewData);
        break;
      default:
        this.renderSessionList(viewData);
    }
    
    this.frameCount++;
    
    if (config.debug.showTimings) {
      console.log(`\n${this.theme.formatMuted(`Render time: ${Date.now() - this.renderStartTime}ms`)}`);
    }
  }

  /**
   * Render session list view
   */
  renderSessionList(viewData) {
    this.clearScreen();
    
    const { sessions, selectedIndex, searchQuery, filters, sortOrder, sortDirection } = viewData;
    
    // Calculate stats for filtered sessions
    const stats = this.calculateFilteredStats(sessions);
    
    // Render header
    this.renderHeader(stats, searchQuery, filters, sortOrder, sortDirection);
    
    // Render sessions
    if (this.terminalWidth > config.terminal.wideThreshold) {
      this.renderWideSessionList(sessions, selectedIndex);
    } else {
      this.renderCompactSessionList(sessions, selectedIndex);
    }
    
    // Render footer
    this.renderSessionListFooter(sessions, selectedIndex);
  }

  /**
   * Render header
   */
  renderHeader(stats, searchQuery = '', filters = {}, sortOrder = 'lastActivity', sortDirection = 'desc') {
    // Basic stats
    const statsLine = this.formatStatsLine(stats);
    console.log(statsLine);
    
    // Search/filter/sort info - always show sort status
    console.log(this.formatSearchFilterInfo(searchQuery, filters, sortOrder, sortDirection));
    
    console.log('');
  }


  /**
   * Format stats line
   */
  formatStatsLine(stats) {
    const sessions = this.theme.formatHeader(`${stats.totalSessions}`);
    const conversations = this.theme.formatHeader(`${stats.totalConversations}`);
    const tools = this.theme.formatHeader(formatWithUnit(stats.totalTools || 0));
    const tokens = this.theme.formatHeader(formatWithUnit(stats.totalTokens || 0));
    const duration = this.theme.formatHeader(this.theme.formatDuration(stats.totalDuration || 0));
    let line = `📊 ${sessions} Sessions | ⏱️ ${duration} Duration | 💬 ${conversations} Convos | 🔧 ${tools} Tools | 🎯 ${tokens} Tokens`;
    
    return line;
  }

  /**
   * Format session stats line (for conversation detail view)
   */
  formatSessionStatsLine(stats) {
    const conversations = this.theme.formatHeader(`${stats.totalConversations}`);
    const tools = this.theme.formatHeader(formatWithUnit(stats.totalTools || 0));
    const tokens = this.theme.formatHeader(formatWithUnit(stats.totalTokens || 0));
    const duration = this.theme.formatHeader(this.theme.formatDuration(stats.totalDuration || 0));
    let line = `💬 ${conversations} Convos | 🔧 ${tools} Tools | 🎯 ${tokens} Tokens | ⏱️ ${duration} Duration`;
    
    return line;
  }

  /**
   * Format search/filter/sort info
   */
  formatSearchFilterInfo(searchQuery, filters, sortOrder, sortDirection) {
    let info = '';
    
    // Don't show search query in session list view
    // (searchQuery is only shown in search results view)
    
    // Always show filter status for visibility
    const hasActiveFilters = filters && Object.keys(filters).some(key => filters[key] !== null);
    
    if (hasActiveFilters) {
      if (info) info += ' | ';
      info += this.theme.formatInfo('🔽 Filters: ');
      
      const activeFilters = [];
      if (filters.project) activeFilters.push(`Project: ${filters.project}`);
      if (filters.duration) {
        const hours = Math.floor(filters.duration / (1000 * 60 * 60));
        const minutes = Math.floor((filters.duration % (1000 * 60 * 60)) / (1000 * 60));
        let durationText = '';
        if (hours > 0) {
          durationText = minutes > 0 ? `${hours}h${minutes}min` : `${hours}h`;
        } else {
          durationText = `${minutes}min`;
        }
        activeFilters.push(`Duration: >${durationText}`);
      }
      
      info += activeFilters.join(', ');
    } else {
      if (info) info += ' | ';
      info += this.theme.formatMuted('🔽 Filters: None');
    }
    
    // Add sort info
    if (info) info += ' | ';
    const sortLabels = {
      'lastActivity': 'Last Activity',
      'duration': 'Duration',
      'conversations': 'Conversations',
      'startTime': 'Started',
      'projectName': 'Project Name',
      'tokens': 'Tokens'
    };
    const sortLabel = sortLabels[sortOrder] || sortOrder;
    const directionIcon = sortDirection === 'asc' ? '↑' : '↓';
    info += this.theme.formatInfo(`📊 Sort: ${sortLabel} ${directionIcon}`);
    
    return info;
  }

  /**
   * Render wide session list
   */
  renderWideSessionList(sessions, selectedIndex) {
    // Column headers
    this.renderSessionListHeaders();
    
    // Calculate visible range
    const { startIndex, endIndex } = this.getVisibleRange(sessions.length, selectedIndex);
    
    // Render sessions
    for (let i = startIndex; i < endIndex; i++) {
      const session = sessions[i];
      const isSelected = i === selectedIndex;
      
      this.renderWideSessionRow(session, i, isSelected);
    }
    
    // Fill remaining space
    const displayedSessions = endIndex - startIndex;
    const maxVisible = this.getMaxVisibleSessions();
    
    if (displayedSessions < maxVisible) {
      for (let i = displayedSessions; i < maxVisible; i++) {
        console.log('');
      }
    }
  }

  /**
   * Render session list headers
   */
  renderSessionListHeaders() {
    const headers = [
      'No.'.padEnd(5),
      'ID'.padEnd(16),
      'Project'.padEnd(config.layout.projectNameLength),
      'Conv.'.padStart(6),
      'Duration'.padEnd(config.layout.durationLength),
      'Tools'.padStart(8),
      'Tokens'.padStart(7),
      'Start Time'.padEnd(12),
      'End Time'.padEnd(12),
      'First Message'
    ];
    
    console.log(this.theme.formatMuted(headers.join(' ')));
    console.log(this.theme.formatSeparator(this.terminalWidth, '-'));
  }

  /**
   * Get first message from session
   */
  getFirstMessage(session) {
    if (!session.conversationPairs || session.conversationPairs.length === 0) {
      return 'No conversations';
    }
    
    const firstConversation = session.conversationPairs[0];
    const userMessage = firstConversation.userContent || '';
    
    // Use the improved message extraction logic
    if (this.containsThinkingContent(userMessage)) {
      const cleanMessage = this.extractCleanUserMessage(userMessage);
      const result = cleanMessage || textTruncator.smartTruncate(userMessage.replace(/\s+/g, ' '), 100);
      // Apply consistent 60 char limit
      return textTruncator.smartTruncate(result, 120);
    }
    
    // Clean and truncate the message - apply strict 60 char limit
    const cleaned = userMessage
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textTruncator.smartTruncate(cleaned, 120);
  }

  /**
   * Render wide session row
   */
  renderWideSessionRow(session, index, isSelected) {
    const prefix = isSelected ? this.theme.formatSelectedPrefix() + ' ' : '  ';
    
    if (isSelected) {
      // For selected rows, build plain content without ANSI codes
      const no = `${index + 1}`.padEnd(3);
      // Use appropriate format based on ID length
      const id = session.sessionId.length <= 8 ? session.sessionId : `${session.sessionId.substring(0, 8)}...${session.sessionId.substring(session.sessionId.length - 4)}`;
      const paddedId = id.padEnd(16);
      const truncatedProject = this.truncateWithWidth(session.projectName, config.layout.projectNameLength - 1);
      const project = truncatedProject.padEnd(config.layout.projectNameLength);
      
      const conversations = session.totalConversations.toString().padStart(6);
      
      // Format duration without ANSI codes
      const durationMs = session.duration;
      const seconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      let durationStr;
      const days = Math.floor(hours / 24);
      if (days > 0) {
        const remainingHours = hours % 24;
        const remainingMinutes = minutes % 60;
        if (remainingHours > 0 && remainingMinutes > 0) {
          durationStr = `${days}d ${remainingHours}h ${remainingMinutes}m`;
        } else if (remainingHours > 0) {
          durationStr = `${days}d ${remainingHours}h`;
        } else if (remainingMinutes > 0) {
          durationStr = `${days}d ${remainingMinutes}m`;
        } else {
          durationStr = `${days}d`;
        }
      } else if (hours > 0) {
        const remainingMinutes = minutes % 60;
        if (remainingMinutes > 0) {
          durationStr = `${hours}h ${remainingMinutes}m`;
        } else {
          durationStr = `${hours}h`;
        }
      } else if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        if (remainingSeconds > 0) {
          durationStr = `${minutes}m ${remainingSeconds}s`;
        } else {
          durationStr = `${minutes}m`;
        }
      } else {
        durationStr = `${seconds}s`;
      }
      const duration = durationStr.padEnd(config.layout.durationLength);
      
      // Format tools count
      const toolsCount = formatWithUnit(session.toolUsageCount || 0).padStart(8);
      
      // Format tokens with right alignment
      const totalTokens = session.totalTokens || 0;
      const tokens = this.theme.formatTokenCount(totalTokens);
      
      const startTime = this.theme.formatDateTime(session.startTime).padEnd(12);
      const endTime = this.theme.formatDateTime(session.lastActivity).padEnd(12);
      const firstMessage = this.getFirstMessage(session);
      
      // Build plain content - Conv, Duration, Tools, Tokens, Start Time, End Time, First Message
      const mainContent = `${no} ${paddedId} ${project} ${conversations} ${duration} ${toolsCount} ${tokens} ${startTime} ${endTime}`;
      
      // Calculate remaining space for first message
      const mainContentWidth = textTruncator.getDisplayWidth(mainContent);
      const prefixWidth = textTruncator.getDisplayWidth(prefix);
      const usedWidth = prefixWidth + mainContentWidth + 1; // +1 for space
      const remainingWidth = Math.max(20, this.terminalWidth - usedWidth); // Minimum 20 chars for message
      
      const truncatedMessage = this.truncateWithWidth(firstMessage, remainingWidth);
      const plainContent = `${mainContent} ${truncatedMessage}`;
      
      // Calculate padding to fill entire terminal width
      const contentWidth = textTruncator.getDisplayWidth(plainContent);
      const totalWidth = prefixWidth + contentWidth;
      const paddingWidth = Math.max(0, this.terminalWidth - totalWidth);
      const padding = ' '.repeat(paddingWidth);
      
      // Apply selection formatting to the entire line
      const fullLine = plainContent + padding;
      console.log(prefix + this.theme.formatSelection(fullLine, isSelected));
    } else {
      // For non-selected rows, use colored formatting
      const no = `${index + 1}`.padEnd(3);
      const formattedId = this.theme.formatSessionId(session.sessionId);
      const id = formattedId + ' '.repeat(Math.max(0, 16 - textTruncator.getDisplayWidth(formattedId)));
      const truncatedProject = this.truncateWithWidth(session.projectName, config.layout.projectNameLength - 1);
      const project = truncatedProject.padEnd(config.layout.projectNameLength);
      
      const conversations = session.totalConversations.toString().padStart(6);
      
      const durationText = this.theme.formatDuration(session.duration);
      const duration = durationText + ' '.repeat(Math.max(0, config.layout.durationLength - textTruncator.getDisplayWidth(durationText)));
      
      // Format tools count
      const toolsCount = formatWithUnit(session.toolUsageCount || 0).padStart(8);
      
      // Format tokens with color coding and right alignment
      const totalTokens = session.totalTokens || 0;
      const tokens = this.theme.formatTokenCount(totalTokens);
      
      const startTime = this.theme.formatDateTime(session.startTime).padEnd(12);
      const lastUpdated = this.theme.formatDateTime(session.lastActivity).padEnd(12);
      
      const firstMessage = this.getFirstMessage(session);
      
      // Build main content first
      const mainContent = `${no} ${id} ${project} ${conversations} ${duration} ${toolsCount} ${tokens} ${startTime} ${lastUpdated}`;
      
      // Calculate remaining space for first message
      const mainContentWidth = textTruncator.getDisplayWidth(mainContent);
      const prefixWidth = textTruncator.getDisplayWidth(prefix);
      const usedWidth = prefixWidth + mainContentWidth + 1; // +1 for space
      const remainingWidth = Math.max(20, this.terminalWidth - usedWidth); // Minimum 20 chars for message
      
      const truncatedMessage = this.truncateWithWidth(firstMessage, remainingWidth);
      const content = `${mainContent} ${truncatedMessage}`;
      
      const coloredContent = this.theme.formatSelection(content, isSelected);
      console.log(prefix + coloredContent);
    }
  }

  /**
   * Render compact session list headers
   */
  renderCompactSessionListHeaders() {
    const headers = [
      'No.'.padEnd(5),
      'ID'.padEnd(16),
      'Conv.'.padEnd(6),
      'Tokens'.padEnd(6),
      'First Message'
    ];
    
    const headerLine = headers.join(' ');
    console.log(this.theme.formatDim(headerLine));
    console.log(this.theme.formatSeparator(this.terminalWidth, '-'));
  }

  /**
   * Render compact session list
   */
  renderCompactSessionList(sessions, selectedIndex) {
    // Similar to wide but with fewer columns
    this.renderCompactSessionListHeaders();
    
    const { startIndex, endIndex } = this.getVisibleRange(sessions.length, selectedIndex);
    
    for (let i = startIndex; i < endIndex; i++) {
      const session = sessions[i];
      const isSelected = i === selectedIndex;
      
      this.renderCompactSessionRow(session, i, isSelected);
    }
  }

  /**
   * Render compact session row
   */
  renderCompactSessionRow(session, index, isSelected) {
    const prefix = isSelected ? this.theme.formatSelectedPrefix() + ' ' : '  ';
    
    if (isSelected) {
      // For selected rows, build plain content without ANSI codes
      const no = `${index + 1}`.padEnd(3);
      // Use appropriate format based on ID length
      const id = session.sessionId.length <= 8 ? session.sessionId : `${session.sessionId.substring(0, 8)}...${session.sessionId.substring(session.sessionId.length - 4)}`;
      const paddedId = id.padEnd(16);
      
      const conversations = session.totalConversations.toString().padEnd(5);
      
      // Add token display to compact layout
      const totalTokens = session.tokenUsage?.totalTokens || 0;
      const tokens = this.theme.formatTokenCount(totalTokens).replace(/\s+$/, '').padEnd(6);
      
      const firstMessage = this.getFirstMessage(session);
      
      // Build main content first
      const mainContent = `${no} ${paddedId} ${conversations} ${tokens}`;
      
      // Calculate remaining space for first message
      const mainContentWidth = textTruncator.getDisplayWidth(mainContent);
      const prefixWidth = textTruncator.getDisplayWidth(prefix);
      const usedWidth = prefixWidth + mainContentWidth + 1; // +1 for space
      const remainingWidth = Math.max(30, this.terminalWidth - usedWidth); // Minimum 30 chars for message in compact
      
      const truncatedMessage = this.truncateWithWidth(firstMessage, remainingWidth);
      const plainContent = `${mainContent} ${truncatedMessage}`;
      
      // Calculate padding to fill entire terminal width
      const contentWidth = textTruncator.getDisplayWidth(plainContent);
      const totalWidth = prefixWidth + contentWidth;
      const paddingWidth = Math.max(0, this.terminalWidth - totalWidth);
      const padding = ' '.repeat(paddingWidth);
      
      // Apply selection formatting to the entire line
      const fullLine = plainContent + padding;
      console.log(prefix + this.theme.formatSelection(fullLine, isSelected));
    } else {
      // For non-selected rows, use colored formatting
      const no = `${index + 1}`.padEnd(3);
      const formattedId = this.theme.formatSessionId(session.sessionId);
      const id = formattedId + ' '.repeat(Math.max(0, 16 - textTruncator.getDisplayWidth(formattedId)));
      
      const conversations = session.totalConversations.toString().padEnd(5);
      
      // Add token display to compact layout
      const totalTokens = session.tokenUsage?.totalTokens || 0;
      const tokens = this.theme.formatTokenCount(totalTokens).replace(/\s+$/, '').padEnd(6);
      
      const firstMessage = this.getFirstMessage(session);
      
      // Build main content first
      const mainContent = `${no} ${id} ${conversations} ${tokens}`;
      
      // Calculate remaining space for first message
      const mainContentWidth = textTruncator.getDisplayWidth(mainContent);
      const prefixWidth = textTruncator.getDisplayWidth(prefix);
      const usedWidth = prefixWidth + mainContentWidth + 1; // +1 for space
      const remainingWidth = Math.max(30, this.terminalWidth - usedWidth); // Minimum 30 chars for message in compact
      
      const truncatedMessage = this.truncateWithWidth(firstMessage, remainingWidth);
      const content = `${mainContent} ${truncatedMessage}`;
      
      const coloredContent = this.theme.formatSelection(content, isSelected);
      console.log(prefix + coloredContent);
    }
  }

  /**
   * Render session list footer
   */
  renderSessionListFooter(sessions, selectedIndex) {
    console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
    
    if (sessions.length > 0) {
      const selected = sessions[selectedIndex];
      this.renderSelectedSessionInfo(selected);
    }
    
    this.renderControls();
  }

  /**
   * Render selected session info
   */
  renderSelectedSessionInfo(session) {
    // First line: project info and session ID
    const sessionIdDisplay = session.sessionId.length <= 8 ? session.sessionId : session.fullSessionId;
    const projectInfo = this.theme.formatInfo('Selected: ') + 
                       this.theme.formatHeader(session.projectName) + 
                       ` - ${sessionIdDisplay}`;
    console.log(projectInfo);
    
    // Second line: filename info (full path)
    const filepath = session.filePath ? session.filePath : `${session.sessionId}.jsonl`;
    console.log(this.theme.formatMuted(`📁 File: ${filepath}`));
    
    // Third line and beyond: Recent Activity with exactly 5 items
    console.log('📝 Recent Activity:');
    
    if (session.conversationPairs && session.conversationPairs.length > 0) {
      const totalConversations = session.conversationPairs.length;
      const recentConversations = session.conversationPairs.slice(-5); // Get last 5 conversations
      const startIndex = Math.max(1, totalConversations - 4); // Start index for numbering (1-based)
      
      for (let i = 0; i < 5; i++) {
        if (i < recentConversations.length) {
          const conv = recentConversations[i];
          const conversationNumber = startIndex + i;
          const prefix = `   ${conversationNumber}. `;
          // Calculate ultra-conservative width for message content  
          const prefixWidth = textTruncator.getDisplayWidth(prefix);
          const maxMessageLength = Math.min(180, this.terminalWidth - prefixWidth - 30); // Cap at 180 chars (extended by 20)
          let originalMsg = (conv.userContent || conv.userMessage || '').replace(/\n/g, ' ').trim();
          
          // Check if this is a continuation session or contains thinking content
          if (originalMsg.includes('This session is being continued from a previous conversation')) {
            originalMsg = '[Continued] ' + originalMsg.substring(0, 80) + '...'
          } else if (this.containsThinkingContent(originalMsg)) {
            const cleanMsg = this.extractCleanUserMessage(originalMsg);
            originalMsg = cleanMsg || originalMsg.substring(0, 120).replace(/\s+/g, ' ').trim();
          }
          
          // Clean and truncate message using the same logic as conversation rows
          const cleanedMsg = originalMsg
            .replace(/\n/g, ' ')                    // Replace newlines with spaces
            .replace(/\r/g, ' ')                    // Replace carriage returns  
            .replace(/\t/g, ' ')                    // Replace tabs
            .replace(/\x1b\[[0-9;]*m/g, '')         // Remove ANSI codes
            .replace(/\u200B/g, '')                 // Remove zero-width spaces
            .replace(/[\u0000-\u001F]/g, ' ')       // Replace control characters
            .replace(/[\u007F-\u009F]/g, ' ')       // Replace DEL and C1 control characters
            .replace(/^\d+\.\s*/g, '')              // Remove numbered list markers at start only
            .replace(/\s+/g, ' ')                   // Collapse multiple spaces
            .trim();                                // Remove leading/trailing spaces
          
          const userMsg = this.truncateWithWidth(cleanedMsg, maxMessageLength);
          console.log(`${prefix}${userMsg}`);
        } else {
          console.log(`   ${i + 1}. `);
        }
      }
    } else {
      // Show 5 empty numbered lines if no conversations
      for (let i = 1; i <= 5; i++) {
        console.log(`   ${i}. `);
      }
    }
  }

  /**
   * Calculate statistics for filtered sessions
   */
  calculateFilteredStats(sessions) {
    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        totalConversations: 0,
        totalDuration: 0
      };
    }

    const totalConversations = sessions.reduce((sum, session) => {
      return sum + (session.totalConversations || 0);
    }, 0);

    const totalDuration = sessions.reduce((sum, session) => {
      return sum + (session.duration || 0);
    }, 0);

    const totalTools = sessions.reduce((sum, session) => {
      return sum + (session.toolUsageCount || session.totalTools || 0);
    }, 0);

    const totalTokens = sessions.reduce((sum, session) => {
      return sum + (session.totalTokens || 0);
    }, 0);

    return {
      totalSessions: sessions.length,
      totalConversations,
      totalDuration,
      totalTools,
      totalTokens
    };
  }

  /**
   * Calculate statistics for a single session
   */
  calculateSessionStats(session) {
    if (!session) {
      return {
        totalSessions: 0,
        totalConversations: 0,
        totalDuration: 0,
        totalTools: 0,
        totalTokens: 0
      };
    }

    return {
      totalSessions: 1,
      totalConversations: session.totalConversations || 0,
      totalDuration: session.duration || 0,
      totalTools: session.toolUsageCount || session.totalTools || 0,
      totalTokens: session.totalTokens || 0
    };
  }

  /**
   * Render controls
   */
  renderControls() {
    const controls = [
      this.theme.formatMuted('↑/↓ or k/j') + ' to select',
      this.theme.formatMuted('Enter') + ' to view details',
      this.theme.formatMuted('r') + ' resume',
      this.theme.formatMuted('/') + ' full-text search',
      this.theme.formatMuted('f') + ' filter',
      this.theme.formatMuted('s') + ' sort',
      this.theme.formatMuted('h') + ' help',
      this.theme.formatMuted('q') + ' exit'
    ];
    
    console.log(controls.join(' · '));
  }

  /**
   * Get visible range for virtual scrolling
   */
  getVisibleRange(totalItems, selectedIndex) {
    const maxVisible = this.getMaxVisibleSessions();
    
    if (totalItems <= maxVisible) {
      return { startIndex: 0, endIndex: totalItems };
    }
    
    // Center the selected item
    let startIndex = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
    let endIndex = Math.min(totalItems, startIndex + maxVisible);
    
    // Adjust if we're near the end
    if (endIndex - startIndex < maxVisible) {
      startIndex = Math.max(0, endIndex - maxVisible);
    }
    
    return { startIndex, endIndex };
  }

  /**
   * Get maximum visible sessions
   */
  getMaxVisibleSessions() {
    const headerHeight = 8; // stats(1) + filter/sort(1) + blank(1) + headers(1) + separator(1) + buffer(3)
    const footerHeight = 8; // separator(1) + selected info(2) + recent activity header(1) + activities(3) + controls(1)
    
    // No additional reduction needed
    return Math.max(1, this.terminalHeight - headerHeight - footerHeight);
  }

  /**
   * Render conversation detail view
   */
  renderConversationDetail(viewData) {
    this.clearScreen();
    
    const { session, conversations, selectedConversationIndex, conversationSortOrder, conversationSortDirection } = viewData;
    
    // Calculate stats for selected session only
    const stats = this.calculateSessionStats(session);
    
    // Calculate available space once
    const maxConversations = this.getMaxVisibleConversations();
    
    // Header
    this.renderConversationDetailHeader(session, stats, conversationSortOrder, conversationSortDirection);
    
    // Conversation list with exact fixed rows
    this.renderConversationList(conversations, selectedConversationIndex);
    
    // Selected conversation preview (always render to maintain layout)
    if (conversations && conversations[selectedConversationIndex]) {
      this.renderConversationPreview(conversations[selectedConversationIndex]);
    } else {
      // Empty preview to maintain layout
      console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
      console.log('');
      console.log('');
      console.log('');
      console.log('');
    }
    
    // Controls
    this.renderConversationDetailControls();
  }

  /**
   * Render conversation detail header
   */
  renderConversationDetailHeader(session, stats, sortOrder = 'dateTime', sortDirection = 'desc') {
    // Handle null session
    if (!session) {
      console.log(this.theme.formatError('No session data available'));
      return;
    }
    
    // Stats line (session-specific, no session count)
    const statsLine = this.formatSessionStatsLine(stats);
    console.log(statsLine);
    
    // Selected session info with file
    const sessionInfo = `Selected: [${session.sessionId || 'unknown'}] ${session.projectName || 'unknown'}`;
    console.log(this.theme.formatInfo(sessionInfo));
    
    if (session.filePath) {
      const filePath = this.theme.formatMuted(`📁 File: ${session.filePath}`);
      console.log(filePath);
    }
    
    // Sort info
    const sortOrderDisplay = {
      'dateTime': 'DateTime',
      'duration': 'Duration', 
      'tools': 'Tools',
      'tokens': 'Tokens'
    };
    const sortDirectionArrow = sortDirection === 'asc' ? '↑' : '↓';
    const sortInfo = this.theme.formatInfo(`📊 Sort: ${sortOrderDisplay[sortOrder]} ${sortDirectionArrow}`);
    console.log(sortInfo);
    
    console.log('');
  }

  /**
   * Render conversation list
   */
  renderConversationList(conversations, selectedIndex) {
    // Handle null or empty conversations
    if (!conversations || conversations.length === 0) {
      console.log(this.theme.formatMuted('No conversations available'));
      return;
    }
    
    // Headers - must match exact column spacing
    const headers = 
      '  ' + // 2 spaces for prefix alignment
      'No.'.padEnd(3) + ' ' +
      'Start Time'.padEnd(12) + ' ' +
      'End Time'.padEnd(12) + ' ' +
      'Duration'.padEnd(config.layout.durationLength) + ' ' +
      'Tools'.padEnd(6) + ' ' +  // Tools is right-aligned (padStart(5) + space)
      'Tokens'.padEnd(8) + ' ' + // Tokens is right-aligned (padStart(7) + space) 
      'User Message';
    
    console.log(this.theme.formatMuted(headers));
    console.log(this.theme.formatSeparator(this.terminalWidth, '-'));
    
    // Calculate fixed display rows
    const maxVisible = this.getMaxVisibleConversations();
    const { startIndex, endIndex } = this.getVisibleRange(conversations.length, selectedIndex);
    
    // Render conversations with fixed rows
    for (let i = 0; i < maxVisible; i++) {
      const actualIndex = startIndex + i;
      
      if (actualIndex < conversations.length) {
        const conversation = conversations[actualIndex];
        const isSelected = actualIndex === selectedIndex;
        this.renderConversationRow(conversation, actualIndex, isSelected);
      } else {
        // Empty line to maintain fixed layout
        console.log('');
      }
    }
  }

  /**
   * Render conversation row
   */
  renderConversationRow(conversation, index, isSelected) {
    const prefix = isSelected ? this.theme.formatSelectedPrefix() + ' ' : '  ';
    
    // Format columns
    const no = `${index + 1}`.padEnd(3);
    // Show both start time and end time
    const startTime = conversation.userTime || new Date(conversation.timestamp);
    const endTime = conversation.assistantTime || new Date(conversation.timestamp);
    const startDateTime = this.theme.formatDateTime(startTime).padEnd(12); // MM/DD HH:MM format
    const endDateTime = this.theme.formatDateTime(endTime).padEnd(12); // MM/DD HH:MM format
    const response = this.theme.formatResponseTime(conversation.responseTime); // Already padded in ThemeManager
    const toolCount = this.theme.formatToolCount(conversation.toolsUsed.length);
    
    // Format tokens with color coding (lower thresholds for conversations)
    const totalTokens = conversation.tokenUsage?.totalTokens || 0;
    const conversationThresholds = { error: 10000, warning: 5000 };
    const tokens = this.theme.formatTokenCount(totalTokens, conversationThresholds);
    
    // User message preview - calculate remaining width more accurately
    // Calculate fixed columns width
    // prefix(2) + no(3) + space + start_time(12) + space + end_time(12) + space + response(8) + space + tool(6) + space
    // Response and tool columns are already properly padded in ThemeManager
    const ansiMargin = 15; // Color codes don't display but take up string length
    const fixedColumnsWidth = 2 + 3 + 1 + 12 + 1 + 12 + 1 + 8 + 1 + 6 + 1 + ansiMargin;
    
    // Calculate exact fixed column widths based on actual conversation detail layout
    // Headers: "No." (3) + "Start Time" (12) + "End Time" (12) + "Duration" (8) + "Tools" (6) + "Tokens" (8) + spaces
    // Actual row: "  1   07/13 21:41  07/13 21:45  3m44s      19t  1.2k    [message content]"
    const exactFixedWidth = 
      2 +     // prefix: "  " or "▶ "
      3 + 1 + // no: "1  " (padEnd 3) + space  
      12 + 1 + // start time: "07/13 21:41 " (padEnd 12) + space
      12 + 1 + // end time: "07/13 21:45 " (padEnd 12) + space
      8 + 1 +  // duration: "3m44s   " (8 chars by formatResponseTime) + space
      6 + 1 +  // tools: "  19t " (6 chars by formatToolCount) + space
      8 + 1;   // tokens: "1.2k    " (8 chars) + space
    
    // Use ultra-conservative width to absolutely prevent wrapping
    // Reserve huge margin for ANSI codes, numbered lists, complex Japanese text, and calculation errors
    const targetMessageWidth = this.terminalWidth - exactFixedWidth - 5;
    
    // Ensure minimum readable width but use most of available space
    const availableWidth = Math.max(30, targetMessageWidth);
    
    // Extract only the clean user message (without assistant responses or thinking content)
    const cleanUserOnly = this.extractCleanUserMessage(conversation.userMessage);
    
    // Clean message while preserving readable content
    const originalMessage = cleanUserOnly
      .replace(/\n/g, ' ')                    // Replace newlines with spaces
      .replace(/\r/g, ' ')                    // Replace carriage returns  
      .replace(/\t/g, ' ')                    // Replace tabs
      .replace(/\x1b\[[0-9;]*m/g, '')         // Remove ANSI codes
      .replace(/\u200B/g, '')                 // Remove zero-width spaces
      .replace(/[\u0000-\u001F]/g, ' ')       // Replace control characters
      .replace(/[\u007F-\u009F]/g, ' ')       // Replace DEL and C1 control characters
      .replace(/^\d+\.\s*/g, '')              // Remove numbered list markers at start only
      .replace(/\s+/g, ' ')                   // Collapse multiple spaces
      .trim();                                // Remove leading/trailing spaces
    
    let truncatedMessage = this.truncateWithWidth(originalMessage, availableWidth);
    
    // Use the truncated message for all display
    const userMessage = truncatedMessage;
    
    // Build raw content without colors for width calculation
    const tokensRaw = tokens.replace(/\x1b\[[0-9;]*m/g, '');
    const rawContent = `${no} ${startDateTime} ${endDateTime} ${response.replace(/\x1b\[[0-9;]*m/g, '')} ${toolCount.replace(/\x1b\[[0-9;]*m/g, '').padEnd(6)} ${tokensRaw} ${userMessage}`;
    
    // Apply selection highlighting
    if (isSelected) {
      // For selected rows, we need plain text values to apply consistent background
      const responseRaw = conversation.responseTime >= 60 
        ? `${Math.floor(conversation.responseTime / 60)}m${Math.floor(conversation.responseTime % 60)}s`
        : `${conversation.responseTime.toFixed(1)}s`;
      const { formatWithUnit } = require('./utils/formatters');
      const toolCountRaw = formatWithUnit(conversation.toolsUsed.length);
      
      // Format tokens without color codes but keep the same formatting as non-selected rows
      const tokenStr = formatWithUnit(totalTokens);
      
      // Build plain content for full-width selection, ensuring it fits within terminal width
      const baseParts = [
        no, 
        startDateTime.replace(/\x1b\[[0-9;]*m/g, ''), // Remove any ANSI codes from startDateTime
        endDateTime.replace(/\x1b\[[0-9;]*m/g, ''), // Remove any ANSI codes from endDateTime
        responseRaw.padEnd(8), 
        toolCountRaw.padStart(5) + ' ', // Match formatToolCount's padding: padStart(5) + space
        tokenStr.padStart(7) + ' ' // Match formatTokenCount's padding: padStart(7) + space
      ];
      const baseContent = baseParts.join(' ');
      
      // Calculate available width for message in selected row
      const baseWidth = textTruncator.getDisplayWidth(baseContent);
      const prefixWidth = textTruncator.getDisplayWidth(prefix);
      const usedWidth = prefixWidth + baseWidth;
      const messageMaxWidth = Math.max(10, this.terminalWidth - usedWidth - 2); // Ultra-large margin for safety
      
      // Re-truncate message for selected row to ensure it fits
      const selectedMessage = this.truncateWithWidth(userMessage, messageMaxWidth);
      
      const plainContent = baseContent + ' ' + selectedMessage; // Add space before message
      
      // Calculate padding to fill entire terminal width
      const contentWidth = textTruncator.getDisplayWidth(plainContent);
      const totalWidth = prefixWidth + contentWidth;
      const paddingWidth = Math.max(0, this.terminalWidth - totalWidth);
      const padding = ' '.repeat(paddingWidth);
      
      // Apply selection formatting to the entire line including padding
      const fullLine = plainContent + padding;
      
      console.log(prefix + this.theme.formatSelection(fullLine, isSelected));
    } else {
      // For non-selected rows, use colored values but ensure message fits
      const content = `${no} ${startDateTime} ${endDateTime} ${response} ${toolCount} ${tokens} ${userMessage}`;
      
      // Double-check that total line width doesn't exceed terminal width
      const totalLineWidth = textTruncator.getDisplayWidth(prefix + content);
      if (totalLineWidth > this.terminalWidth) {
        // Emergency truncation if line is still too long
        const emergencyMaxWidth = this.terminalWidth - exactFixedWidth - 5;
        const emergencyMessage = this.truncateWithWidth(userMessage, emergencyMaxWidth);
        const safeContent = `${no} ${startDateTime} ${endDateTime} ${response} ${toolCount} ${tokens} ${emergencyMessage}`;
        console.log(prefix + safeContent);
      } else {
        console.log(prefix + content);
      }
    }
  }

  /**
   * Truncate string to fit within specified display width
   * Uses unified TextTruncator for consistent behavior across all character types
   */
  truncateWithWidth(text, maxWidth) {
    // Use exact width to prevent wrapping
    return textTruncator.smartTruncate(text, maxWidth);
  }


  /**
   * Get maximum visible conversations
   */
  getMaxVisibleConversations() {
    // Fixed layout calculation:
    // Header: stats(1) + session info(1) + file path(1) + sort info(1) + blank(1) = 5
    // Table headers: headers(1) + separator(1) = 2
    // Footer: separator(1) + preview(5-7 lines) + blank(1) + controls(1) = 8-10
    const headerHeight = 7; // 5 + 2
    const footerHeight = 6; // Further reduced by 2 for more conversation space
    
    // No additional reduction needed
    const maxVisible = Math.max(1, this.terminalHeight - headerHeight - footerHeight);
    
    return maxVisible;
  }

  /**
   * Render conversation preview
   */
  renderConversationPreview(conversation) {
    console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
    
    // Check if we need to highlight search terms
    const highlightQuery = this.state.highlightQuery;
    const highlightOptions = this.state.highlightOptions || {};
    
    // User message (truncate to fit one line considering display width)
    let userMessage = conversation.userMessage.replace(/\n/g, ' ').trim();
    let userPrefix = '👤 ';
    
    // Check if this is a continuation session or contains thinking content
    if (conversation.hasCompactContinuation) {
      userPrefix = '📦 ';  // Box emoji to indicate compact continuation
    } else if (conversation.userMessage && conversation.userMessage.includes('This session is being continued from a previous conversation')) {
      userPrefix = '🔗 ';  // Chain link emoji to indicate continuation
      userMessage = '[Continued session] ' + textTruncator.smartTruncate(userMessage, 180);
    } else if (this.containsThinkingContent(conversation.userMessage)) {
      // Extract just the user message part
      const cleanMessage = this.extractCleanUserMessage(conversation.userMessage);
      userMessage = cleanMessage || textTruncator.smartTruncate(conversation.userMessage.replace(/\s+/g, ' '), 180);
    }
    
    const userPrefixWidth = textTruncator.getDisplayWidth(userPrefix);
    const maxUserWidth = this.terminalWidth - userPrefixWidth;
    
    if (highlightQuery && this.textMatchesQuery(userMessage, highlightQuery, highlightOptions)) {
      const highlighted = this.highlightText(userMessage, highlightQuery, highlightOptions);
      const truncatedUser = this.truncateWithWidth(highlighted, maxUserWidth);
      console.log(`${userPrefix}${truncatedUser}`);
    } else {
      const truncatedUser = this.truncateWithWidth(userMessage, maxUserWidth);
      console.log(`${userPrefix}${truncatedUser}`);
    }
    
    
    // Assistant response (truncate to fit one line considering display width)
    const assistantPrefix = '🤖 ';
    const assistantPrefixWidth = textTruncator.getDisplayWidth(assistantPrefix);
    const maxAssistantWidth = this.terminalWidth - assistantPrefixWidth;
    const assistantMessage = conversation.assistantResponse.replace(/\n/g, ' ').trim();
    
    if (highlightQuery && this.textMatchesQuery(assistantMessage, highlightQuery, highlightOptions)) {
      const highlighted = this.highlightText(assistantMessage, highlightQuery, highlightOptions);
      const truncatedAssistant = this.truncateWithWidth(highlighted, maxAssistantWidth);
      console.log(`${assistantPrefix}${truncatedAssistant}`);
    } else {
      const truncatedAssistant = this.truncateWithWidth(assistantMessage, maxAssistantWidth);
      console.log(`${assistantPrefix}${truncatedAssistant}`);
    }
    
    // Tools used (always show line, even if empty)
    if (conversation.toolsUsed.length > 0) {
      // Count tool usage and format as "ToolName×Count"
      const toolCounts = {};
      conversation.toolsUsed.forEach(tool => {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      });
      
      const toolsFormatted = Object.entries(toolCounts)
        .map(([tool, count]) => count > 1 ? `${tool}×${count}` : tool)
        .join(', ');
        
      const toolsPrefix = '🔧 Tools: ';
      const toolsPrefixWidth = textTruncator.getDisplayWidth(toolsPrefix);
      const maxToolsWidth = this.terminalWidth - toolsPrefixWidth;
      const truncatedToolsFormatted = this.truncateWithWidth(toolsFormatted, maxToolsWidth);
      console.log(`${toolsPrefix}${truncatedToolsFormatted}`);
    } else {
      // Empty line to maintain fixed layout
      console.log('');
    }
    
    // Show thinking content preview if there's a search match in thinking
    if (highlightQuery && conversation.thinkingContent && conversation.thinkingContent.length > 0) {
      for (const thinking of conversation.thinkingContent) {
        if (thinking.text && this.textMatchesQuery(thinking.text, highlightQuery, highlightOptions)) {
          const thinkingPrefix = '💭 ';
          const thinkingPrefixWidth = textTruncator.getDisplayWidth(thinkingPrefix);
          const maxThinkingWidth = this.terminalWidth - thinkingPrefixWidth;
          const thinkingText = thinking.text.replace(/\n/g, ' ').trim();
          const highlighted = this.highlightText(thinkingText, highlightQuery, highlightOptions);
          const truncatedThinking = this.truncateWithWidth(highlighted, maxThinkingWidth);
          console.log(`${thinkingPrefix}${this.theme.formatDim(truncatedThinking)}`);
          break; // Only show first matching thinking
        }
      }
    }
  }

  /**
   * Check if text matches search query (supports OR and regex)
   */
  textMatchesQuery(text, query, options = {}) {
    if (!query || !text) return false;
    
    if (options.regex) {
      try {
        const regex = new RegExp(query, 'i');
        return regex.test(text);
      } catch (error) {
        return false;
      }
    } else if (/\s+(OR|or)\s+/.test(query)) {
      const orPattern = /\s+(OR|or)\s+/;
      const terms = query.split(orPattern)
        .filter((term, index) => index % 2 === 0) // Skip the "OR"/"or" matches
        .map(term => term.trim().toLowerCase());
      const lowerText = text.toLowerCase();
      return terms.some(term => lowerText.includes(term));
    } else {
      return text.toLowerCase().includes(query.toLowerCase());
    }
  }

  /**
   * Check if text contains Claude Code thinking content markers
   */
  containsThinkingContent(text) {
    if (!text) return false;
    
    const thinkingMarkers = [
      '🔧 TOOLS EXECUTION FLOW:',
      '🧠 THINKING PROCESS:',
      '[Thinking',
      /\[\d+\]\s+(Read|Write|Edit|Bash|Glob|Grep|Task)/,
      'File:',
      'Command:',
      'pattern:',
      'path:',
      /^\s*\[\d+\]\s+\w+$/m  // Tool execution markers like [1] Read
    ];
    
    return thinkingMarkers.some(marker => {
      if (typeof marker === 'string') {
        return text.includes(marker);
      } else {
        return marker.test(text);
      }
    });
  }

  /**
   * Format message with thinking content separated
   */
  formatMessageWithThinkingContent(text) {
    const lines = text.split('\n');
    const formattedLines = [];
    let inThinkingSection = false;
    
    for (const line of lines) {
      // Check if this line starts thinking content
      if (line.includes('🔧 TOOLS EXECUTION FLOW:')) {
        formattedLines.push('');
        formattedLines.push(this.theme.formatDim('--- Tool Execution Details ---'));
        formattedLines.push(this.theme.formatDim(line));
        inThinkingSection = true;
      } else if (line.includes('🧠 THINKING PROCESS:')) {
        formattedLines.push('');
        formattedLines.push(this.theme.formatDim('--- Claude Thinking Process ---'));
        formattedLines.push(this.theme.formatDim(line));
        inThinkingSection = true;
      } else if (line.match(/^\s*\[Thinking \d+\]/) ||
                 line.match(/^\s*\[\d+\]\s+\w+/) ||
                 line.startsWith('File:') ||
                 line.startsWith('Command:') ||
                 line.startsWith('pattern:') ||
                 line.startsWith('path:')) {
        formattedLines.push(this.theme.formatDim(line));
        inThinkingSection = true;
      } else if (inThinkingSection) {
        // Continue formatting as thinking content
        formattedLines.push(this.theme.formatDim(line));
      } else {
        // This is user content
        formattedLines.push(line);
      }
    }
    
    return formattedLines.join('\n');
  }

  /**
   * Extract clean user message from text containing thinking content
   */
  extractCleanUserMessage(text) {
    if (!text) return '';
    
    // Split into sections by common delimiters
    const sections = text.split(/(?:\n\n|\r\n\r\n|👤\s*USER|🤖\s*ASSISTANT)/);
    
    for (const section of sections) {
      const cleanSection = section.trim();
      if (!cleanSection) continue;
      
      // Skip sections that are clearly tool execution details
      if (this.isToolExecutionSection(cleanSection)) {
        continue;
      }
      
      // Skip sections that are thinking content
      if (this.isThinkingSection(cleanSection)) {
        continue;
      }
      
      // Extract meaningful user message from this section
      const userMessage = this.extractMeaningfulMessage(cleanSection);
      if (userMessage && userMessage.length > 10) { // Must be substantial
        // Always apply a reasonable length limit to prevent layout issues
        return textTruncator.smartTruncate(userMessage, 120);
      }
    }
    
    // Fallback: try to extract any meaningful text from the entire content
    const fallbackMessage = this.extractMeaningfulMessage(text) || this.extractFirstMeaningfulLine(text) || '';
    return textTruncator.smartTruncate(fallbackMessage, 120);
  }
  
  isToolExecutionSection(text) {
    const toolMarkers = [
      '🔧 TOOLS EXECUTION FLOW:',
      '🧠 THINKING PROCESS:',
      '⏺ Thinking', '⏺ Edit', '⏺ Read', '⏺ Write', '⏺ Bash', 
      '⏺ Task', '⏺ TodoWrite', '⏺ Grep', '⏺ Glob', '⏺ MultiEdit',
      'File:', 'Command:', 'pattern:', 'path:', '⎿'
    ];
    
    return toolMarkers.some(marker => text.includes(marker)) ||
           /^\s*\[Thinking \d+\]/.test(text) ||
           /^\s*\[\d+\]\s+\w+/.test(text) ||
           /^\s*\d+│/.test(text);
  }
  
  isThinkingSection(text) {
    return text.includes('[Thinking') || 
           text.includes('THINKING PROCESS') ||
           text.includes('TOOLS EXECUTION FLOW');
  }
  
  extractMeaningfulMessage(text) {
    const lines = text.split('\n');
    const meaningfulLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // Skip obvious tool execution markers
      if (this.isToolExecutionLine(trimmed)) continue;
      
      // Skip assistant response patterns
      if (this.isAssistantResponseLine(trimmed)) continue;
      
      // Keep meaningful content
      if (trimmed.length > 3 && !this.isMetadataLine(trimmed)) {
        meaningfulLines.push(trimmed);
      }
    }
    
    return meaningfulLines.join(' ').replace(/\s+/g, ' ').trim();
  }
  
  isToolExecutionLine(line) {
    return /^\s*\[(?:\d+|\w+)\]/.test(line) ||
           line.includes('⏺') ||
           line.includes('⎿') ||
           /^(File|Command|pattern|path):\s/.test(line) ||
           /^\d+│/.test(line);
  }
  
  isAssistantResponseLine(line) {
    const assistantPatterns = [
      /^(Looking at|I need to|Let me|I'll|I will|First,|Based on|Here's|Now)/,
      /^(The|This|That|It|We|You)/,
      /^(To|In order to|For|With|By)/
    ];
    
    return assistantPatterns.some(pattern => pattern.test(line));
  }
  
  isMetadataLine(line) {
    return /^\s*\d+\s*$/.test(line) ||
           /^-+$/.test(line) ||
           /^=+$/.test(line) ||
           /^\s*[\[\](){}]+\s*$/.test(line);
  }
  
  extractFirstMeaningfulLine(text) {
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.length > 10 && 
          !this.isToolExecutionLine(trimmed) && 
          !this.isMetadataLine(trimmed) &&
          !/^[🔧🧠⏺👤🤖]/.test(trimmed)) {
        return trimmed;
      }
    }
    
    return '';
  }

  /**
   * Highlight text with search query (supports OR and regex)
   */
  highlightText(text, query, options = {}) {
    if (!query) return text;
    
    let regex;
    
    if (options.regex) {
      // Use query as regex directly
      try {
        regex = new RegExp(`(${query})`, 'gi');
      } catch (error) {
        // If regex is invalid, return text as-is
        return text;
      }
    } else if (/\s+(OR|or)\s+/.test(query)) {
      // Handle OR conditions (support both OR and or)
      const orPattern = /\s+(OR|or)\s+/;
      const terms = query.split(orPattern)
        .filter((term, index) => index % 2 === 0) // Skip the "OR"/"or" matches
        .map(term => term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      regex = new RegExp(`(${terms.join('|')})`, 'gi');
    } else {
      // Simple search
      regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    }
    
    return text.replace(regex, (match) => this.theme.formatHighlight(match));
  }

  /**
   * Render conversation detail controls
   */
  renderConversationDetailControls() {
    const controls = [
      this.theme.formatMuted('↑/↓ or k/j') + ' select',
      this.theme.formatMuted('Enter') + ' detail',
      this.theme.formatMuted('←/→ or h/l') + ' switch',
      this.theme.formatMuted('r') + ' resume',
      this.theme.formatMuted('s') + ' sort',
      this.theme.formatMuted('Esc') + ' back',
      this.theme.formatMuted('q') + ' exit'
    ];
    
    // Apply truncation to fit terminal width
    const controlsText = controls.join(' · ');
    const truncatedControls = this.truncateWithWidth(controlsText, this.terminalWidth - 5);
    console.log(truncatedControls);
  }

  /**
   * Wrap text to fit terminal width
   */
  wrapText(text, maxWidth = null, indent = 0) {
    const width = maxWidth || this.terminalWidth - indent;
    const lines = [];
    const paragraphs = text.split('\n');
    
    paragraphs.forEach(paragraph => {
      if (paragraph.length === 0) {
        lines.push('');
        return;
      }
      
      let remainingText = paragraph;
      while (remainingText.length > 0) {
        // Find break point
        if (remainingText.length <= width) {
          lines.push(remainingText);
          break;
        }
        
        // Try to break at word boundary
        let breakPoint = width;
        for (let i = width; i > width * 0.7; i--) {
          if (remainingText[i] === ' ' || remainingText[i] === '、' || remainingText[i] === '。') {
            breakPoint = i + 1;
            break;
          }
        }
        
        lines.push(remainingText.substring(0, breakPoint));
        remainingText = remainingText.substring(breakPoint).trim();
      }
    });
    
    return lines;
  }

  /**
   * Render full detail view
   */
  renderFullDetail(viewData) {
    const { session, conversations, selectedConversationIndex, originalConversationNumber, scrollToEnd = false, highlightQuery, highlightOptions } = viewData;
    const conversation = conversations[selectedConversationIndex];
    
    // Check if conversation exists
    if (!conversation) {
      this.clearScreen();
      // Header for error case
      console.log(this.theme.formatHeader(`[${session.sessionId}] ${session.projectName}`));
      console.log(this.theme.formatMuted(`Conversation #${originalConversationNumber || selectedConversationIndex + 1} of ${session.totalConversations || conversations.length}`));
      console.log(this.theme.formatSeparator(this.terminalWidth));
      console.log('');
      console.log(this.theme.formatWarning('No conversation data available'));
      console.log('');
      console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
      this.renderFullDetailControls(false);
      return;
    }
    
    // Build content
    const lines = this.buildFullDetailContent(session, conversation, selectedConversationIndex, highlightQuery, highlightOptions);
    
    // Calculate scroll indicator first (needed for header calculation)
    let scrollIndicator = '';
    let preliminaryHeaderLines = 3; // Initial estimate
    let preliminaryBufferLines = 1; // Add buffer for header visibility
    let preliminaryContentHeight = this.terminalHeight - preliminaryHeaderLines - 2 - preliminaryBufferLines; // 2 for footer + 1 buffer
    let preliminaryMaxScrollOffset = Math.max(0, lines.length - preliminaryContentHeight);
    
    if (lines.length > preliminaryContentHeight) {
      const preliminaryScrollOffset = this.state.scrollOffset;
      const visibleStart = preliminaryScrollOffset;
      const visibleEnd = Math.min(visibleStart + preliminaryContentHeight, lines.length);
      const scrollPercentage = preliminaryMaxScrollOffset > 0 ? Math.round((preliminaryScrollOffset / preliminaryMaxScrollOffset) * 100) : 0;
      scrollIndicator = `[${visibleStart + 1}-${visibleEnd}/${lines.length}] ${scrollPercentage}%`;
    }
    
    // Build header with scroll indicator embedded
    const headerTitle = `[${session.sessionId}] ${session.projectName}`;
    const headerLine1 = this.buildHeaderWithIndicator(headerTitle, scrollIndicator);
    const headerLine2 = this.theme.formatMuted(`Conversation #${originalConversationNumber || selectedConversationIndex + 1} of ${session.totalConversations || conversations.length}`);
    const headerLine3 = this.theme.formatSeparator(this.terminalWidth);
    
    // Calculate actual header lines (check if headerLine1 contains newline)
    const actualHeaderLines = headerLine1.includes('\n') ? 4 : 3; // +1 if indicator is on separate line
    
    // Recalculate with actual header size
    const footerLines = 2; // Controls + separator
    const contentHeight = Math.max(1, this.terminalHeight - actualHeaderLines - footerLines);
    
    // Set max scroll offset in state manager
    const maxScrollOffset = Math.max(0, lines.length - contentHeight);
    this.state.setMaxScrollOffset(maxScrollOffset);
    
    // Get current scroll offset from state and ensure it's within bounds
    let scrollOffset = this.state.scrollOffset;
    
    // Check current state flag (this is authoritative over viewData parameter)
    // If scrollToEnd is true in state (first time entering), scroll to bottom
    if (this.state.scrollToEnd && lines.length > contentHeight) {
      scrollOffset = maxScrollOffset;
      this.state.scrollOffset = scrollOffset;
      this.state.scrollToEnd = false; // Reset flag after initial positioning
    } else {
      // Ensure scrollOffset is within valid bounds
      scrollOffset = Math.max(0, Math.min(scrollOffset, maxScrollOffset));
      // Update state if we had to adjust
      if (scrollOffset !== this.state.scrollOffset) {
        this.state.scrollOffset = scrollOffset;
      }
    }
    
    // If we need to scroll to search match
    if (this.state.scrollToSearchMatch && this.state.highlightQuery) {
      const matchLine = this.findFirstMatchLine(lines, this.state.highlightQuery, this.state.highlightOptions || {});
      if (matchLine !== -1) {
        // Position the match near the top of the content area (not center)
        // This ensures the header stays fixed at the top
        const topOffset = Math.min(5, Math.floor(contentHeight * 0.1)); // 10% down from top, max 5 lines
        scrollOffset = Math.max(0, Math.min(matchLine - topOffset, maxScrollOffset));
        this.state.scrollOffset = scrollOffset;
      }
      this.state.scrollToSearchMatch = false; // Reset flag
    }
    
    // Recalculate scroll indicator with final values
    if (lines.length > contentHeight) {
      const visibleStart = scrollOffset;
      const visibleEnd = Math.min(visibleStart + contentHeight, lines.length);
      const scrollPercentage = maxScrollOffset > 0 ? Math.round((scrollOffset / maxScrollOffset) * 100) : 0;
      scrollIndicator = `[${visibleStart + 1}-${visibleEnd}/${lines.length}] ${scrollPercentage}%`;
    }
    
    // Always clear screen and display fixed header at top
    this.clearScreen();
    
    // Build and display header with updated indicator
    if (lines.length > contentHeight && scrollIndicator) {
      const updatedHeaderLine1 = this.buildHeaderWithIndicator(headerTitle, scrollIndicator);
      // Ensure we start from top of screen
      process.stdout.write('\x1b[1;1H'); // Move cursor to top-left
      console.log(updatedHeaderLine1);
    } else {
      // No scrolling needed, display header without indicator
      process.stdout.write('\x1b[1;1H'); // Move cursor to top-left
      console.log(this.theme.formatHeader(headerTitle));
    }
    
    console.log(headerLine2);
    console.log(headerLine3);
    
    // Display scrollable content
    const visibleStart = scrollOffset;
    const visibleEnd = Math.min(visibleStart + contentHeight, lines.length);
    
    for (let i = visibleStart; i < visibleEnd; i++) {
      console.log(lines[i]);
    }
    
    // Fill remaining space if necessary
    for (let i = visibleEnd - visibleStart; i < contentHeight; i++) {
      console.log('');
    }
    
    // Footer
    console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
    this.renderFullDetailControls(lines.length > contentHeight);
  }

  /**
   * Build header line with scroll indicator on the right
   */
  buildHeaderWithIndicator(title, indicator) {
    if (!indicator) {
      return this.theme.formatHeader(title);
    }
    
    // Calculate available space for title
    const indicatorLength = textTruncator.getDisplayWidth(indicator);
    const availableWidth = this.terminalWidth - indicatorLength - 2; // 2 spaces padding
    
    // Don't truncate the title - let it show completely
    let displayTitle = title;
    
    // Build line with title on left, indicator on right
    const titleFormatted = this.theme.formatHeader(displayTitle);
    const indicatorFormatted = this.theme.formatMuted(indicator);
    
    // Calculate actual lengths after formatting
    const actualTitleLength = textTruncator.getDisplayWidth(displayTitle);
    const totalNeeded = actualTitleLength + indicatorLength + 2; // 2 spaces padding
    
    if (totalNeeded <= this.terminalWidth) {
      // Normal case - everything fits on one line
      const padding = ' '.repeat(this.terminalWidth - actualTitleLength - indicatorLength);
      return titleFormatted + padding + indicatorFormatted;
    } else {
      // Wide case - split into two lines
      // Line 1: Full title
      // Line 2: Right-aligned indicator  
      const indicatorPadding = ' '.repeat(Math.max(0, this.terminalWidth - indicatorLength));
      return titleFormatted + '\n' + indicatorPadding + indicatorFormatted;
    }
  }

  /**
   * Build full detail content lines with enhanced visual formatting
   */
  buildFullDetailContent(session, conversation, selectedConversationIndex, highlightQuery, highlightOptions) {
    const lines = [];
    
    // Clear tool IDs for new conversation
    this.state.clearAllToolIds();
    
    // Safety check
    if (!conversation) {
      lines.push('');
      lines.push(this.theme.formatWarning('No conversation data available'));
      return lines;
    }
    
    // Use provided highlight parameters or fallback to state
    highlightQuery = highlightQuery || this.state.highlightQuery;
    highlightOptions = highlightOptions || this.state.highlightOptions || {};
    
    // Simple metadata header
    lines.push('');
    lines.push(this.theme.formatDim('━━━ Conversation Details ━━━'));
    // Show both start and end times for consistency with conversation list
    const startTime = conversation.userTime || new Date(conversation.timestamp);
    const endTime = conversation.assistantTime || new Date(conversation.timestamp);
    lines.push(`📅 ${this.theme.formatDateTime(startTime)} → ${this.theme.formatDateTime(endTime)}`);
    lines.push(`⏱️  Response Time: ${this.theme.formatResponseTime(conversation.responseTime)}`);
    
    // Token usage information
    if (conversation.tokenUsage) {
      const { totalTokens, inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens } = conversation.tokenUsage;
      
      // Main token info
      let tokenStr = `🎯 Tokens: ${formatLargeNumber(totalTokens)} (In: ${formatLargeNumber(inputTokens)}, Out: ${formatLargeNumber(outputTokens)}`;
      
      // Add cache info if exists
      if (cacheCreationInputTokens || cacheReadInputTokens) {
        tokenStr += `, Cache: ${formatLargeNumber(cacheCreationInputTokens || 0)} created, ${formatLargeNumber(cacheReadInputTokens || 0)} read`;
      }
      tokenStr += ')';
      
      lines.push(tokenStr);
    }
    
    // User message section
    lines.push('');
    let userHeader = '👤 USER';
    lines.push(this.theme.formatAccent(userHeader));
    lines.push('');
    let displayMessage = this.processUserMessage(conversation.userMessage);
    const userMessage = highlightQuery ? this.highlightText(displayMessage, highlightQuery, highlightOptions) : displayMessage;
    const userLines = this.wrapTextWithWidth(userMessage, this.terminalWidth - 4);
    userLines.forEach(line => lines.push('  ' + line));
    
    // Assistant response section - show chronological thinking + tools + response
    lines.push('');
    lines.push(this.theme.formatAccent('🤖 ASSISTANT'));
    lines.push('');
    
    // Create chronological content from assistant message
    const chronologicalContent = this.createChronologicalContent(conversation, highlightQuery, highlightOptions);
    const chronologicalLines = chronologicalContent.split('\n');
    chronologicalLines.forEach(line => lines.push(line));
    
    // Add final spacing
    lines.push('');
    
    return lines;
  }

  /**
   * Create a simple, clean content section without boxes
   */
  createContentBox(title, content, type = 'default') {
    const lines = [];
    
    // Choose colors based on content type
    const colors = {
      'user': '\x1b[36m',      // Cyan
      'assistant': '\x1b[35m', // Magenta
      'thinking': '\x1b[33m',  // Yellow
      'tools': '\x1b[32m',     // Green
      'info': '\x1b[90m',      // Gray
      'default': '\x1b[37m'    // White
    };
    
    const color = colors[type] || colors.default;
    
    // Simple title with underline
    lines.push('');
    lines.push(`${color}${title}\x1b[0m`);
    lines.push(this.theme.formatDim('─'.repeat(Math.min(40, textTruncator.getDisplayWidth(title)))));
    
    // Content without box borders
    content.forEach(item => {
      if (typeof item === 'string') {
        // Process each line for better formatting
        const itemLines = item.split('\n');
        itemLines.forEach(rawLine => {
          // Check for code blocks or special formatting
          if (rawLine.startsWith('```')) {
            // Code block delimiter - just show as a separator
            lines.push(this.theme.formatDim('  ' + '─'.repeat(40)));
          } else if (rawLine.match(/^\s{4,}/) || rawLine.match(/^\t/)) {
            // Indented code
            lines.push(this.theme.formatMuted('  ' + rawLine));
          } else {
            // Regular content
            const contentLines = this.wrapTextWithWidth(rawLine, this.terminalWidth - 4);
            contentLines.forEach(line => {
              lines.push('  ' + line);
            });
          }
        });
      }
    });
    
    return lines.join('\n');
  }

  /**
   * Wrap text considering actual display width of characters
   */
  wrapTextWithWidth(text, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');
    
    for (const paragraph of paragraphs) {
      if (!paragraph) {
        lines.push('');
        continue;
      }
      
      let currentLine = '';
      let currentWidth = 0;
      const words = paragraph.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordWidth = textTruncator.getDisplayWidth(word);
        const spaceWidth = i > 0 ? 1 : 0;
        
        if (currentWidth + spaceWidth + wordWidth <= maxWidth) {
          if (i > 0) {
            currentLine += ' ';
            currentWidth += 1;
          }
          currentLine += word;
          currentWidth += wordWidth;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }
          
          // Handle long words that exceed maxWidth
          if (wordWidth > maxWidth) {
            let remainingWord = word;
            while (remainingWord) {
              let charCount = 0;
              let lineWidth = 0;
              
              // Find how many characters fit in the width
              for (let j = 0; j < remainingWord.length; j++) {
                const char = remainingWord[j];
                const charCode = char.charCodeAt(0);
                const charWidth = textTruncator.getCharWidth(String.fromCharCode(charCode));
                
                if (lineWidth + charWidth > maxWidth) break;
                lineWidth += charWidth;
                charCount++;
              }
              
              lines.push(remainingWord.substring(0, charCount));
              remainingWord = remainingWord.substring(charCount);
            }
            currentLine = '';
            currentWidth = 0;
          } else {
            currentLine = word;
            currentWidth = wordWidth;
          }
        }
      }
      
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    
    return lines;
  }


  /**
   * Create a special thinking content box with enhanced visualization
   */
  /**
   * Create a simplified thinking section for better visibility
   */
  createThinkingSection(thinkingContent, highlightQuery, highlightOptions) {
    const lines = [];
    
    // Simple header for thinking
    lines.push(this.theme.formatWarning('💭 THINKING PROCESS'));
    lines.push(this.theme.formatDim('─'.repeat(20)));
    
    // Process each thinking block
    thinkingContent.forEach((thinking, index) => {
      if (index > 0) {
        lines.push(''); // Space between blocks
      }
      
      // Simple block indicator
      lines.push(this.theme.formatAccent(`  [Thinking ${index + 1}]`));
      
      // Process thinking content with enhanced formatting - show all content
      const preview = thinking.text; // Show complete thinking content
      
      // Apply special formatting for common thinking patterns
      let formattedThinking = preview;
      
      // Highlight key thinking indicators
      formattedThinking = formattedThinking.replace(/^(I need to|I should|Let me|I'll|Looking at|Checking|Analyzing|The user|User wants|Now I)/gim, 
        (match) => this.theme.formatAccent(`➤ ${match}`));
      
      // Highlight conclusions and decisions
      formattedThinking = formattedThinking.replace(/^(So|Therefore|This means|The issue is|The problem is|I found|Actually|It seems)/gim,
        (match) => this.theme.formatSuccess(`✓ ${match}`));
      
      // Highlight errors or concerns
      formattedThinking = formattedThinking.replace(/^(Error|Failed|Cannot|Problem|Issue|Warning)/gim,
        (match) => this.theme.formatError(`⚠ ${match}`));
        
      // Highlight file/code references
      formattedThinking = formattedThinking.replace(/`([^`]+)`/g,
        (match, content) => this.theme.formatInfo(`[${content}]`));
      
      // Highlight file paths
      formattedThinking = formattedThinking.replace(/(\/[\w\-\/.]+\.(js|ts|tsx|jsx|py|go|rs|cpp|java|rb|php))/g,
        (match) => this.theme.formatInfo(match));
        
      // Apply search highlighting if needed
      const thinkingText = highlightQuery ? this.highlightText(formattedThinking, highlightQuery, highlightOptions) : formattedThinking;
      
      // Display thinking content with proper indentation
      const contentLines = this.wrapTextWithWidth(thinkingText, this.terminalWidth - 6);
      // Skip empty lines at the beginning of thinking content
      let startIndex = 0;
      while (startIndex < contentLines.length && contentLines[startIndex].trim() === '') {
        startIndex++;
      }
      for (let i = startIndex; i < contentLines.length; i++) {
        // Add line numbers for very long thinking sections
        if (contentLines.length > 20 && i % 10 === 0 && i > 0) {
          lines.push(this.theme.formatDim(`    [line ${i}]`));
        }
        lines.push('    ' + contentLines[i]);
      }
      
      // All thinking content is now displayed, no truncation
    });
    
    return lines.join('\n');
  }

  createThinkingBox(thinkingContent, highlightQuery, highlightOptions) {
    // Redirect to simpler version
    return this.createThinkingSection(thinkingContent, highlightQuery, highlightOptions);
  }

  /**
   * Create chronological content showing thinking, tools, and response in order
   */
  createChronologicalContent(conversation, highlightQuery, highlightOptions) {
    const lines = [];
    
    // Try to get raw assistant message content if available
    const assistantRawContent = conversation.rawAssistantContent || conversation.assistantRawContent;
    
    if (assistantRawContent && Array.isArray(assistantRawContent)) {
      // Process content in chronological order
      let thinkingIndex = 1;
      let toolIndex = 1;
      
      assistantRawContent.forEach((item, index) => {
        if (item.type === 'compact_continuation') {
          // Add compact continuation marker
          lines.push('');
          lines.push(this.theme.formatMuted('━━━ ' + item.content + ' ━━━'));
          lines.push('');
          
        } else if (item.type === 'thinking' && item.thinking) {
          // Add thinking section - Claude Code style
          lines.push('');
          
          // Format thinking header with timestamp
          let thinkingHeader = '⏺ Thinking';
          if (item.timestamp || conversation.timestamp) {
            // Use item's timestamp if available, otherwise use conversation timestamp
            const timestampToUse = item.timestamp || conversation.timestamp;
            const thinkingTime = this.formatDateTimeWithSeconds(new Date(timestampToUse));
            thinkingHeader += ` ${this.theme.formatDim(`[${thinkingTime}]`)}`;
          }
          lines.push(this.theme.formatWarning(thinkingHeader));
          
          // Apply search highlighting if needed
          const thinkingText = highlightQuery ? this.highlightText(item.thinking, highlightQuery, highlightOptions) : item.thinking;
          
          // Display thinking content with proper indentation
          const contentLines = this.wrapTextWithWidth(thinkingText, this.terminalWidth - 4);
          // Skip empty lines at the beginning of thinking content
          let startIndex = 0;
          while (startIndex < contentLines.length && contentLines[startIndex].trim() === '') {
            startIndex++;
          }
          for (let i = startIndex; i < contentLines.length; i++) {
            lines.push('  ' + contentLines[i]);
          }
          
        } else if (item.type === 'tool_use') {
          // Handle Task tools specially - they are sub-agent launches
          if (item.name === 'Task') {
            // Show Task tool with nested sub-agent content
            lines.push('');
            
            // Create Task tool header
            let toolHeader = `⏺ ${item.name}`;
            if (item.input) {
              const keyParams = this.getKeyParams(item.name, item.input);
              if (keyParams) {
                toolHeader += `(${keyParams})`;
              }
            }
            
            // Add timestamp if available
            if (item.timestamp || conversation.timestamp) {
              const timestampToUse = item.timestamp || conversation.timestamp;
              const toolTime = this.formatDateTimeWithSeconds(new Date(timestampToUse));
              toolHeader += ` ${this.theme.formatDim(`[${toolTime}]`)}`;
            }
            
            lines.push(this.theme.formatSuccess(toolHeader));
            
            // Show Task input (description and prompt)
            if (item.input) {
              lines.push('');
              if (item.input.description) {
                lines.push(`  ${this.theme.formatMuted('Description:')} ${item.input.description}`);
              }
              if (item.input.prompt) {
                lines.push(`  ${this.theme.formatMuted('Prompt:')}`);
                const promptLines = item.input.prompt.split('\n');
                promptLines.forEach(line => {
                  lines.push(`    ${this.theme.formatDim(line)}`);
                });
              }
            }
            
            // Show sub-agent execution results inline
            if (conversation.subAgentCommands && conversation.subAgentCommands.length > 0) {
              lines.push('');
              lines.push(`  ${this.theme.formatAccent('🤖 Sub-Agent Execution:')}`);
              
              conversation.subAgentCommands.forEach((subAgentPair, index) => {
                lines.push('');
                
                // Create enhanced sub-agent header with timestamp
                const timestamp = subAgentPair.command.timestamp ? 
                  this.formatDateTimeWithSeconds(subAgentPair.command.timestamp) : 
                  'Unknown time';
                lines.push(`  ${this.theme.formatHeader(`── Sub-Agent #${index + 1} ──`)}`);
                lines.push(`  ${this.theme.formatMuted(`Command: [${timestamp}]`)}`);
                
                // Get the sub-agent command with improved formatting
                const subCommandContent = this.sessionManager.extractUserContent(subAgentPair.command);
                const commandLines = this.wrapTextWithWidth(subCommandContent, this.terminalWidth - 6);
                commandLines.forEach(line => {
                  lines.push(`    ${this.theme.formatAccent(line)}`);
                });
                lines.push('');
                
                // Display sub-agent execution content from all responses
                if (subAgentPair.responses && subAgentPair.responses.length > 0) {
                  // Display all sub-agent responses in chronological order
                  subAgentPair.responses.forEach((response, responseIndex) => {
                    const responseTimestamp = response.timestamp ? 
                      this.formatDateTimeWithSeconds(response.timestamp) : 
                      'Unknown time';
                    
                    // Add response header with sequence number
                    if (subAgentPair.responses.length > 1) {
                      lines.push(`  ${this.theme.formatMuted(`💬 Response #${responseIndex + 1}: [${responseTimestamp}]`)}`);
                    } else {
                      lines.push(`  ${this.theme.formatMuted(`💬 Response: [${responseTimestamp}]`)}`);
                    }
                    
                    // Render this response
                    this.renderNestedSubAgentFromResponse(lines, response, 2);
                    
                    // Add separator between multiple responses
                    if (responseIndex < subAgentPair.responses.length - 1) {
                      lines.push(`  ${this.theme.formatDim('───')}`);
                    }
                  });
                } else if (subAgentPair.response) {
                  // Fallback to single response for backward compatibility
                  const responseTimestamp = subAgentPair.response.timestamp ? 
                    this.formatDateTimeWithSeconds(subAgentPair.response.timestamp) : 
                    'Unknown time';
                  lines.push(`  ${this.theme.formatMuted(`💬 Response: [${responseTimestamp}]`)}`);
                  this.renderNestedSubAgentFromResponse(lines, subAgentPair.response, 2);
                } else {
                  lines.push(`  ${this.theme.formatDim('⏳ Sub-agent execution in progress...')}`);
                }
              });
            }
            
            return;
          }
          
          // Add tool execution section - Claude Code style
          lines.push('');
          
          // Create tool header with parameters and timestamp
          let toolHeader = `⏺ ${item.name}`;
          if (item.input) {
            // Add key parameters to header
            const keyParams = this.getKeyParams(item.name, item.input);
            if (keyParams) {
              toolHeader += `(${keyParams})`;
            }
          }
          
          // Add timestamp if available
          if (item.timestamp || conversation.timestamp) {
            const timestampToUse = item.timestamp || conversation.timestamp;
            const toolTime = this.formatDateTimeWithSeconds(new Date(timestampToUse));
            toolHeader += ` ${this.theme.formatDim(`[${toolTime}]`)}`;
          }
          
          lines.push(this.theme.formatSuccess(toolHeader));
          
          // Format tool input details
          const toolInputLines = this.formatToolInput({ toolName: item.name, input: item.input });
          const inputToolId = `input-${item.id || index}`;
          const isInputExpanded = this.state.isToolExpanded(inputToolId);
          
          // Register tool ID for Ctrl+R
          this.state.registerToolId(inputToolId);
          
          if (toolInputLines.length > 0) {
            lines.push('  ⎿ ' + ' ');
            
            if (toolInputLines.length <= 20 || isInputExpanded) {
              // Show all lines if short or expanded
              toolInputLines.forEach((line, i) => {
                if (i === 0) {
                  lines[lines.length - 1] = '  ⎿' + line.substring(1); // Remove first space
                } else {
                  lines.push('    ' + line);
                }
              });
            } else {
              // Show first 20 lines and collapsed indicator
              for (let i = 0; i < 20; i++) {
                if (i === 0) {
                  lines[lines.length - 1] = '  ⎿' + toolInputLines[i].substring(1); // Remove first space
                } else {
                  lines.push('    ' + toolInputLines[i]);
                }
              }
              const remainingLines = toolInputLines.length - 20;
              lines.push(this.theme.formatDim(`     … +${remainingLines} lines (ctrl+r to expand)`));
            }
          }
          
          // Find corresponding tool result
          const toolResult = conversation.toolUses?.find(t => t.toolId === item.id);
          if (toolResult && toolResult.result) {
            // Format tool result
            const resultLines = this.formatToolResult(toolResult.result).split('\n');
            const toolId = item.id || `tool-${index}`;
            const isExpanded = this.state.isToolExpanded(toolId);
            
            // Register tool ID for Ctrl+R
            this.state.registerToolId(toolId);
            
            // Add indented ⎿ prefix
            lines.push('  ⎿ ' + ' ');
            
            if (resultLines.length <= 20 || isExpanded) {
              // Show all lines if short or expanded
              resultLines.forEach((line, i) => {
                if (i === 0) {
                  lines[lines.length - 1] = '  ⎿  ' + line;
                } else {
                  lines.push('     ' + line);
                }
              });
            } else {
              // Show first 20 lines and collapsed indicator
              for (let i = 0; i < 20; i++) {
                if (i === 0) {
                  lines[lines.length - 1] = '  ⎿  ' + resultLines[i];
                } else {
                  lines.push('     ' + resultLines[i]);
                }
              }
              const remainingLines = resultLines.length - 20;
              lines.push(this.theme.formatDim(`     … +${remainingLines} lines (ctrl+r to expand)`));
            }
          }
          
        } else if (item.type === 'text' && item.text) {
          // Add text response - show directly without header
          lines.push('');
          
          // Process markdown-style content for better display
          const processedResponse = this.processMarkdownContent(item.text);
          const responseText = highlightQuery ? this.highlightText(processedResponse, highlightQuery, highlightOptions) : processedResponse;
          const responseLines = responseText.split('\n');
          
          // Check if there are any tool-like blocks in the text that need collapsing
          this.processTextWithCollapsibleBlocks(responseLines, lines);
        }
      });
    } else {
      // Fallback to simplified display if raw content not available
      // Thinking content section
      if (conversation.thinkingContent && conversation.thinkingContent.length > 0) {
        conversation.thinkingContent.forEach(thinking => {
          lines.push('');
          
          // Format thinking header with timestamp
          let thinkingHeader = '⏺ Thinking';
          if (thinking.timestamp) {
            const thinkingTime = this.formatDateTimeWithSeconds(thinking.timestamp);
            thinkingHeader += ` ${this.theme.formatDim(`[${thinkingTime}]`)}`;
          }
          lines.push(this.theme.formatWarning(thinkingHeader));
          
          const thinkingText = highlightQuery ? this.highlightText(thinking.text, highlightQuery, highlightOptions) : thinking.text;
          const contentLines = this.wrapTextWithWidth(thinkingText, this.terminalWidth - 4);
          // Skip empty lines at the beginning of thinking content
          let startIndex = 0;
          while (startIndex < contentLines.length && contentLines[startIndex].trim() === '') {
            startIndex++;
          }
          for (let i = startIndex; i < contentLines.length; i++) {
            lines.push('  ' + contentLines[i]);
          }
        });
      }
      
      // Tool usage section
      if (conversation.toolUses && conversation.toolUses.length > 0) {
        conversation.toolUses.forEach(tool => {
          lines.push('');
          
          // Format timestamp
          let toolHeader = `⏺ ${tool.toolName}`;
          if (tool.input) {
            const keyParams = this.getKeyParams(tool.toolName, tool.input);
            if (keyParams) {
              toolHeader += `(${keyParams})`;
            }
          }
          if (tool.timestamp) {
            const toolTime = this.formatDateTimeWithSeconds(tool.timestamp);
            toolHeader += ` ${this.theme.formatDim(`[${toolTime}]`)}`;
          }
          lines.push(this.theme.formatSuccess(toolHeader));
          
          const toolInputLines = this.formatToolInput(tool);
          toolInputLines.forEach(line => {
            lines.push(line);
          });
        });
      }
      
      // Assistant response section - show directly
      if (conversation.assistantResponse) {
        lines.push('');
        
        // Show full assistant response (no truncation)
        const processedResponse = this.processMarkdownContent(conversation.assistantResponse);
        const assistantMessage = highlightQuery ? this.highlightText(processedResponse, highlightQuery, highlightOptions) : processedResponse;
        const assistantLines = assistantMessage.split('\n');
        
        // Process text with collapsible blocks
        this.processTextWithCollapsibleBlocks(assistantLines, lines);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format date/time with seconds (mm/dd hh:mm:ss)
   */
  formatDateTimeWithSeconds(timestamp) {
    const date = new Date(timestamp);
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Get key parameters for tool header display
   */
  getKeyParams(toolName, input) {
    if (!input) return '';
    
    switch (toolName) {
      case 'Edit':
      case 'Read':
      case 'Write':
        return input.file_path ? path.basename(input.file_path) : '';
      case 'Bash':
        return input.command ? textTruncator.smartTruncate(input.command, 30) : '';
      case 'Task':
        return input.description || '';
      case 'Grep':
        return input.pattern || '';
      case 'Glob':
        return input.pattern || '';
      case 'MultiEdit':
        return input.file_path ? path.basename(input.file_path) : '';
      case 'TodoWrite':
        return input.todos ? `${input.todos.length} todos` : '';
      default:
        // For unknown tools, try to find a meaningful parameter
        const keyParam = input.file_path || input.path || input.command || input.description || input.pattern;
        return keyParam ? (typeof keyParam === 'string' ? keyParam.substring(0, 30) : '') : '';
    }
  }

  /**
   * Format tool result for display
   */
  formatToolResult(result) {
    if (!result) return '(No result)';
    
    if (typeof result === 'string') {
      return result;
    } else if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    } else {
      return String(result);
    }
  }

  /**
   * Create an enhanced tools execution box
   */
  /**
   * Create a simplified tools section
   */
  createToolsSection(toolUses) {
    const lines = [];
    
    // Simple header
    lines.push(this.theme.formatSuccess('🔧 TOOLS EXECUTION'));
    lines.push(this.theme.formatDim('─'.repeat(20)));
    
    // Process each tool
    toolUses.forEach((tool, index) => {
      if (index > 0) {
        lines.push(''); // Space between tools
      }
      
      // Tool header with number and timestamp
      const toolTime = tool.timestamp ? this.theme.formatDateTime(tool.timestamp) : '';
      const toolHeader = toolTime ? 
        `  [${index + 1}] ${tool.toolName} ${this.theme.formatDim(`[${toolTime}]`)}` : 
        `  [${index + 1}] ${tool.toolName}`;
      lines.push(this.theme.formatAccent(toolHeader));
      
      // Tool parameters
      if (tool.input) {
        this.formatToolInput(tool, this.terminalWidth).forEach(line => {
          lines.push('  ' + line);
        });
      }
      
      // Tool result
      if (tool.result !== null && tool.result !== undefined) {
        lines.push('');
        const resultIcon = tool.isError ? '❌' : '✅';
        const resultLabel = tool.isError ? 'Error' : 'Result';
        lines.push(`  ${resultIcon} ${this.theme.formatAccent(resultLabel)}:`);
        
        // Format result
        let resultText = tool.result;
        if (typeof resultText === 'object') {
          resultText = JSON.stringify(resultText, null, 2);
        }
        
        resultText = resultText.toString();
        
        // Special formatting for Read tool - show with line numbers
        if (tool.toolName === 'Read' && resultText.includes('\n')) {
          const fileLines = resultText.split('\n').slice(0, 15);
          fileLines.forEach((line, idx) => {
            const lineNum = this.theme.formatDim(`${String(idx + 1).padStart(4)}│`);
            lines.push(`    ${lineNum} ${line.substring(0, 100)}`);
          });
          if (resultText.split('\n').length > 15) {
            lines.push(this.theme.formatMuted(`    ... ${resultText.split('\n').length - 15} more lines`));
          }
        } else {
          // Regular result
          const maxResultLength = 500;
          if (resultText.length > maxResultLength) {
            resultText = resultText.substring(0, maxResultLength) + '...';
          }
          
          const resultLines = this.wrapTextWithWidth(resultText, this.terminalWidth - 8);
          resultLines.forEach(line => {
            lines.push('    ' + (tool.isError ? this.theme.formatError(line) : line));
          });
        }
      }
    });
    
    return lines.join('\n');
  }

  createToolsBox(toolUses) {
    // Redirect to simpler version
    return this.createToolsSection(toolUses);
  }

  /**
   * Process text with collapsible tool blocks
   */
  processTextWithCollapsibleBlocks(responseLines, outputLines) {
    let i = 0;
    while (i < responseLines.length) {
      const line = responseLines[i];
      
      // Check if this line starts a tool block - match Claude Code tool format
      // Matches: ⏺ ToolName(args) [timestamp] or just ⏺ ToolName
      if (line.match(/^⏺\s+\w+/)) {
        // Found a tool header
        outputLines.push(line);
        i++;
        
        // Debug: Log what we're processing
        if (config.debug && config.debug.enabled) {
          console.log(`Found tool block at line ${i}, next line: "${responseLines[i] || 'EOF'}"`);
        }
        
        // Look for the indented block with ⎿ (allow spaces before it)
        if (i < responseLines.length && responseLines[i].match(/^\s*⎿/)) {
          const blockStart = i;
          let blockEnd = i + 1; // Start from the next line after ⎿
          
          // Find the end of the block
          while (blockEnd < responseLines.length) {
            const blockLine = responseLines[blockEnd];
            // Stop if we hit another tool header
            if (blockLine.match(/^⏺/)) {
              break;
            }
            // For MultiEdit and similar tools, continue if line is indented or looks like diff/code
            // This includes lines with line numbers (e.g., "123│" or "123 -" or "123 +")
            if (blockLine.match(/^\s+/) ||                    // Indented lines
                blockLine.match(/^\s*\d+[│\-\+]/i) ||        // Line numbers with diff markers
                blockLine.match(/^\s*\.\.\.\s*\d+\s*more/) || // "... X more lines"
                blockLine.includes('...')) {                  // Continuation markers
              blockEnd++;
            } else if (blockLine.trim() === '') {
              // Empty line might be part of the block, check next line
              if (blockEnd + 1 < responseLines.length && 
                  (responseLines[blockEnd + 1].match(/^\s+/) || 
                   responseLines[blockEnd + 1].match(/^\s*\d+[│\-\+]/))) {
                blockEnd++;
              } else {
                break;
              }
            } else {
              // Non-indented, non-empty line that doesn't look like part of the block
              break;
            }
          }
          
          const blockLines = responseLines.slice(blockStart, blockEnd);
          const blockId = `text-block-${blockStart}-${i}`;
          const isExpanded = this.state.isToolExpanded(blockId);
          
          // Check if there's already a "... X more lines" indicator
          const lastLine = blockLines[blockLines.length - 1];
          const moreMatch = lastLine && lastLine.match(/^\s*\.\.\.\s*(\d+)\s*more\s*lines?/);
          
          if (moreMatch) {
            // Already has a more lines indicator - this is pre-summarized content
            // Don't add expand/collapse hints as there's no actual content to show
            blockLines.forEach(blockLine => {
              outputLines.push(blockLine);
            });
          } else if (blockLines.length <= 20 || isExpanded) {
            // Show all lines
            blockLines.forEach(blockLine => {
              outputLines.push(blockLine);
            });
            // Set current block for Ctrl+R only if it's expandable
            if (blockLines.length > 20) {
              this.state.registerToolId(blockId);
            }
          } else {
            // Show first 20 lines and collapse indicator
            for (let j = 0; j < 20 && j < blockLines.length; j++) {
              outputLines.push(blockLines[j]);
            }
            const remainingLines = blockLines.length - 20;
            // Match the indentation of the tool output
            const indentMatch = blockLines[0].match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '     ';
            outputLines.push(this.theme.formatDim(`${indent}… +${remainingLines} lines (ctrl+r to expand)`));
            // Register block for Ctrl+R expansion
            this.state.registerToolId(blockId);
          }
          
          i = blockEnd;
          continue;
        }
      }
      
      // Regular line, just add it
      outputLines.push(line);
      i++;
    }
  }

  /**
   * Format tool input parameters
   */
  formatToolInput(tool, boxWidth) {
    const lines = [];
    
    // Simple, clean formatting for tool inputs
    if (tool.toolName === 'Bash' && tool.input.command) {
      lines.push(`  ${this.theme.formatMuted('command:')} ${this.theme.formatInfo(tool.input.command)}`);
      if (tool.input.description) {
        lines.push(`  ${this.theme.formatMuted('purpose:')} ${tool.input.description}`);
      }
    } else if ((tool.toolName === 'Read' || tool.toolName === 'Write' || tool.toolName === 'Edit' || tool.toolName === 'MultiEdit') && tool.input.file_path) {
      lines.push(`  ${this.theme.formatMuted('file:')} ${this.theme.formatInfo(tool.input.file_path)}`);
      
      if (tool.toolName === 'Edit' && tool.input.old_string) {
        // Show git-style diff
        lines.push('');
        const diffLines = this.createUnifiedDiff(tool.input.old_string, tool.input.new_string);
        
        if (diffLines.length === 0) {
          lines.push(`    ${this.theme.formatMuted('(No visible changes)')}`);
        } else {
          // Show unified diff with proper formatting
          let shownLines = 0;
          const maxLines = 15;
          
          for (const diffLine of diffLines) {
            if (shownLines >= maxLines) {
              lines.push(`    ${this.theme.formatMuted(`... ${diffLines.length - shownLines} more lines`)}`);
              break;
            }
            
            let lineNumStr = '';
            if (diffLine.lineNum !== '...') {
              lineNumStr = String(diffLine.lineNum).padStart(4) + '│';
            } else {
              lineNumStr = '    │';
            }
            
            if (diffLine.type === 'removed') {
              lines.push(`       ${this.theme.formatDim(lineNumStr)} ${this.theme.formatError('- ' + diffLine.content)}`);
            } else if (diffLine.type === 'added') {
              lines.push(`       ${this.theme.formatDim(lineNumStr)} ${this.theme.formatSuccess('+ ' + diffLine.content)}`);
            } else {
              // Context line
              lines.push(`       ${this.theme.formatDim(lineNumStr)}   ${diffLine.content}`);
            }
            shownLines++;
          }
        }
      } else if (tool.toolName === 'MultiEdit' && tool.input.edits) {
        // Handle MultiEdit specially
        lines.push(`  ${this.theme.formatMuted('edits:')} ${tool.input.edits.length} changes`);
        
        // Show each edit as a mini-diff
        tool.input.edits.forEach((edit, editIndex) => {
          if (editIndex > 0) {
            lines.push('');
          }
          
          const diffLines = this.createUnifiedDiff(edit.old_string, edit.new_string);
          const maxLines = 10;
          
          diffLines.slice(0, maxLines).forEach(diffLine => {
            let lineNumStr = '';
            if (diffLine.lineNum !== '...') {
              lineNumStr = String(diffLine.lineNum).padStart(4) + '│';
            } else {
              lineNumStr = '    │';
            }
            
            if (diffLine.type === 'removed') {
              lines.push(`       ${this.theme.formatDim(lineNumStr)} ${this.theme.formatError('- ' + diffLine.content)}`);
            } else if (diffLine.type === 'added') {
              lines.push(`       ${this.theme.formatDim(lineNumStr)} ${this.theme.formatSuccess('+ ' + diffLine.content)}`);
            } else {
              lines.push(`       ${this.theme.formatDim(lineNumStr)}   ${diffLine.content}`);
            }
          });
          
          if (diffLines.length > maxLines) {
            lines.push(`       ${this.theme.formatMuted(`... ${diffLines.length - maxLines} more lines`)}`);
          }
        });
      }
      
      if (tool.toolName === 'Read' && tool.input.offset) {
        lines.push(`  ${this.theme.formatMuted('offset:')} line ${tool.input.offset}`);
      }
      
      if (tool.toolName === 'Write' && tool.input.content) {
        lines.push(`  ${this.theme.formatMuted('writing:')} ${tool.input.content.split('\n').length} lines`);
        // Show all content (no truncation)
        const contentLines = tool.input.content.split('\n');
        contentLines.forEach((line, idx) => {
          const lineNum = this.theme.formatDim(`${String(idx + 1).padStart(4)}│`);
          lines.push(`       ${lineNum} ${line}`);
        });
      }
    } else if (tool.toolName === 'Grep' && tool.input.pattern) {
      lines.push(`  ${this.theme.formatMuted('pattern:')} ${this.theme.formatInfo(tool.input.pattern)}`);
      if (tool.input.path) {
        lines.push(`  ${this.theme.formatMuted('path:')} ${tool.input.path}`);
      }
      if (tool.input.glob) {
        lines.push(`  ${this.theme.formatMuted('glob:')} ${tool.input.glob}`);
      }
    } else if (tool.toolName === 'Task' && tool.input.prompt) {
      lines.push(`  ${this.theme.formatMuted('task:')} ${tool.input.description || 'Agent task'}`);
      // Show all prompt lines (no truncation)
      const promptLines = tool.input.prompt.split('\n');
      promptLines.forEach(line => {
        lines.push(`    ${this.theme.formatDim(line)}`);
      });
    } else if (tool.toolName === 'TodoWrite' && tool.input.todos) {
      const todoCount = tool.input.todos.length;
      const completedCount = tool.input.todos.filter(t => t.status === 'completed').length;
      const inProgressCount = tool.input.todos.filter(t => t.status === 'in_progress').length;
      lines.push(`  ${this.theme.formatMuted('todos:')} ${completedCount}/${todoCount} completed`);
      if (inProgressCount > 0) {
        lines.push(`  ${this.theme.formatMuted('in progress:')} ${inProgressCount}`);
      }
      // Show all todos (no truncation)
      tool.input.todos.forEach(todo => {
        const status = todo.status === 'completed' ? '✓' : 
                      todo.status === 'in_progress' ? '→' : '○';
        let formattedStatus;
        if (todo.status === 'completed') {
          formattedStatus = this.theme.formatSuccess(status + ' ' + todo.content);
        } else if (todo.status === 'in_progress') {
          formattedStatus = this.theme.formatWarning(status + ' ' + todo.content);
        } else {
          formattedStatus = this.theme.formatMuted(status + ' ' + todo.content);
        }
        lines.push(`    ${formattedStatus}`);
      });
    } else {
      // Generic formatting - show all parameters
      const params = Object.entries(tool.input)
        .filter(([key, value]) => value !== undefined && value !== null && key !== 'edits');
      
      params.forEach(([key, value]) => {
        let displayValue = typeof value === 'string' ? value : JSON.stringify(value);
        lines.push(`  ${this.theme.formatMuted(key + ':')} ${displayValue}`);
      });
    }
    
    return lines;
  }

  /**
   * Create unified diff like git diff
   */
  createUnifiedDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const diffLines = [];
    
    // Simple diff algorithm
    let oldIndex = 0;
    let newIndex = 0;
    const contextLines = 999; // Show all context (no truncation)
    
    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex] || '';
      const newLine = newLines[newIndex] || '';
      
      if (oldIndex >= oldLines.length) {
        // Only new lines remaining
        diffLines.push({
          type: 'added',
          lineNum: newIndex + 1,
          content: newLine
        });
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // Only old lines remaining
        diffLines.push({
          type: 'removed',
          lineNum: oldIndex + 1,
          content: oldLine
        });
        oldIndex++;
      } else if (oldLine === newLine) {
        // Lines are the same - context line
        // Show all context lines (no filtering)
        diffLines.push({
          type: 'context',
          lineNum: oldIndex + 1,
          content: oldLine
        });
        oldIndex++;
        newIndex++;
      } else {
        // Lines are different - check if it's replacement or insertion/deletion
        const oldTrimmed = oldLine.trim();
        const newTrimmed = newLine.trim();
        
        // Look ahead to see if this is a replacement
        let foundMatch = false;
        for (let lookahead = 1; lookahead <= 3; lookahead++) {
          if (oldIndex + lookahead < oldLines.length && 
              oldLines[oldIndex + lookahead] === newLine) {
            // Old line(s) were deleted
            for (let i = 0; i < lookahead; i++) {
              diffLines.push({
                type: 'removed',
                lineNum: oldIndex + i + 1,
                content: oldLines[oldIndex + i]
              });
            }
            oldIndex += lookahead;
            foundMatch = true;
            break;
          }
          if (newIndex + lookahead < newLines.length && 
              newLines[newIndex + lookahead] === oldLine) {
            // New line(s) were added
            for (let i = 0; i < lookahead; i++) {
              diffLines.push({
                type: 'added',
                lineNum: newIndex + i + 1,
                content: newLines[newIndex + i]
              });
            }
            newIndex += lookahead;
            foundMatch = true;
            break;
          }
        }
        
        if (!foundMatch) {
          // Direct replacement
          diffLines.push({
            type: 'removed',
            lineNum: oldIndex + 1,
            content: oldLine
          });
          diffLines.push({
            type: 'added',
            lineNum: newIndex + 1,
            content: newLine
          });
          oldIndex++;
          newIndex++;
        }
      }
    }
    
    // Return all diff lines without truncation
    return diffLines;
  }

  /**
   * Check if there are changes nearby for context determination
   */
  hasChangesNearby(oldLines, newLines, oldIndex, newIndex, contextLines) {
    // Check if there are any differences within contextLines distance
    const startOld = Math.max(0, oldIndex - contextLines);
    const endOld = Math.min(oldLines.length, oldIndex + contextLines + 1);
    const startNew = Math.max(0, newIndex - contextLines);
    const endNew = Math.min(newLines.length, newIndex + contextLines + 1);
    
    // Simple check: if lengths differ in this range, there are changes
    if ((endOld - startOld) !== (endNew - startNew)) {
      return true;
    }
    
    // Check for line differences in the range
    for (let i = 0; i < Math.min(endOld - startOld, endNew - startNew); i++) {
      if (oldLines[startOld + i] !== newLines[startNew + i]) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Trim excessive context lines from diff
   */
  trimContextLines(diffLines, maxContext) {
    // Group consecutive context lines and trim them
    const result = [];
    let contextGroup = [];
    
    for (const line of diffLines) {
      if (line.type === 'context') {
        contextGroup.push(line);
      } else {
        // Process accumulated context
        if (contextGroup.length > maxContext * 2) {
          // Keep first and last few context lines
          result.push(...contextGroup.slice(0, maxContext));
          if (contextGroup.length > maxContext * 2) {
            result.push({
              type: 'context',
              lineNum: '...',
              content: `... ${contextGroup.length - maxContext * 2} lines ...`
            });
          }
          result.push(...contextGroup.slice(-maxContext));
        } else {
          result.push(...contextGroup);
        }
        contextGroup = [];
        result.push(line);
      }
    }
    
    // Handle remaining context
    if (contextGroup.length > maxContext) {
      result.push(...contextGroup.slice(0, maxContext));
    } else {
      result.push(...contextGroup);
    }
    
    return result;
  }

  /**
   * Process user message for better display
   */
  processUserMessage(userMessage) {
    if (!userMessage) return '';
    
    if (userMessage.includes('This session is being continued from a previous conversation')) {
      // Format continuation metadata more clearly
      const messageLines = userMessage.split('\n');
      let formattedMessage = [];
      let inAnalysis = false;
      let inSummary = false;
      
      for (const line of messageLines) {
        if (line.startsWith('Analysis:')) {
          formattedMessage.push('\n' + this.theme.formatDim('📋 Analysis (from previous session):'));
          inAnalysis = true;
          inSummary = false;
        } else if (line.startsWith('Summary:')) {
          formattedMessage.push('\n' + this.theme.formatDim('📄 Summary (from previous session):'));
          inAnalysis = false;
          inSummary = true;
        } else if (line.match(/^(The user|User|ユーザー).*[:：]/i) ||
                   line.match(/表示方法|見直し|修正|改善/i)) {
          formattedMessage.push('\n' + this.theme.formatAccent('📌 Actual User Request:'));
          formattedMessage.push(line);
          inAnalysis = false;
          inSummary = false;
        } else if (inAnalysis || inSummary) {
          formattedMessage.push(this.theme.formatDim('  ' + line));
        } else if (line.trim()) {
          formattedMessage.push(line);
        }
      }
      
      return formattedMessage.join('\n');
    } else if (this.containsThinkingContent(userMessage)) {
      return this.formatMessageWithThinkingContent(userMessage);
    }
    
    return userMessage;
  }

  /**
   * Render full detail controls
   */
  renderFullDetailControls(canScroll = false) {
    const controls = [];
    
    // Always show scroll controls regardless of content length
    controls.push(
      this.theme.formatMuted('↑/↓ or k/j') + ' 5-line scroll',
      this.theme.formatMuted('Space/b') + ' page down/up',
      this.theme.formatMuted('g/G') + ' top/bottom'
    );
    
    controls.push(
      this.theme.formatMuted('←/→ or h/l') + ' prev/next conversation',
      this.theme.formatMuted('r') + ' resume',
      this.theme.formatMuted('Esc') + ' back',
      this.theme.formatMuted('q') + ' exit'
    );
    
    console.log(controls.join(' · '));
  }

  /**
   * Render conversation tree view
   */
  renderConversationTree(viewData) {
    this.clearScreen();
    
    const { session, conversationTree, selectedNodeUuid, expandedNodes, treeMode } = viewData;
    
    if (!session || !conversationTree) {
      console.log('No conversation tree data available');
      return;
    }
    
    // Header
    console.log(this.theme.formatHeader(`🌳 [${session.sessionId}] ${session.projectName} - Conversation Tree`));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    // Tree mode indicator
    const modeIndicator = treeMode === 'full' ? '🌳 Full Tree' : '🛤️ Path View';
    console.log(this.theme.formatMuted(`Mode: ${modeIndicator} | Nodes: ${conversationTree.nodes.size} | Roots: ${conversationTree.roots.length}`));
    console.log('');
    
    // Get visible nodes based on current state
    const visibleNodes = this.getVisibleTreeNodes(conversationTree, selectedNodeUuid, expandedNodes, treeMode);
    
    // Calculate available height for tree content
    const headerLines = 5; // Header + separator + mode + blank
    const footerLines = 2; // Controls
    const contentHeight = this.terminalHeight - headerLines - footerLines;
    
    // Render tree nodes
    this.renderTreeNodes(visibleNodes, selectedNodeUuid, expandedNodes, contentHeight);
    
    // Footer
    console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
    this.renderTreeControls();
  }

  /**
   * Get visible tree nodes based on mode and expansion state
   */
  getVisibleTreeNodes(tree, selectedNodeUuid, expandedNodes, treeMode) {
    const visibleNodes = [];
    
    const addNodeAndChildren = (nodeUuid, depth = 0) => {
      const node = tree.nodes.get(nodeUuid);
      if (!node) return;
      
      // Add current node with depth info
      visibleNodes.push({
        ...node,
        depth: depth,
        hasChildren: (tree.children.get(nodeUuid) || []).length > 0,
        isExpanded: expandedNodes.has(nodeUuid),
        isSelected: nodeUuid === selectedNodeUuid
      });
      
      // Add children if node is expanded
      if (expandedNodes.has(nodeUuid)) {
        const children = tree.children.get(nodeUuid) || [];
        for (const childUuid of children) {
          addNodeAndChildren(childUuid, depth + 1);
        }
      }
    };
    
    if (treeMode === 'path' && selectedNodeUuid) {
      // Path mode: show only path to selected node
      const pathNodes = this.getPathToNode(tree, selectedNodeUuid);
      for (const node of pathNodes) {
        addNodeAndChildren(node.uuid, 0);
      }
    } else {
      // Full mode: show all nodes starting from roots
      for (const rootUuid of tree.roots) {
        addNodeAndChildren(rootUuid, 0);
      }
    }
    
    return visibleNodes;
  }

  /**
   * Get path from roots to specified node
   */
  getPathToNode(tree, targetUuid) {
    const path = [];
    let currentUuid = targetUuid;
    
    while (currentUuid && tree.nodes.has(currentUuid)) {
      const node = tree.nodes.get(currentUuid);
      path.unshift(node);
      currentUuid = node.parentUuid;
    }
    
    return path;
  }

  /**
   * Render tree nodes with proper indentation and formatting
   */
  renderTreeNodes(visibleNodes, selectedNodeUuid, expandedNodes, contentHeight) {
    const startIndex = Math.max(0, this.scrollOffset);
    const endIndex = Math.min(visibleNodes.length, startIndex + contentHeight);
    
    for (let i = startIndex; i < endIndex; i++) {
      const node = visibleNodes[i];
      const isSelected = node.uuid === selectedNodeUuid;
      
      // Build line with proper indentation
      let line = '';
      
      // Indentation
      const indent = '  '.repeat(node.depth);
      line += indent;
      
      // Expansion indicator
      if (node.hasChildren) {
        line += node.isExpanded ? '▼ ' : '▶ ';
      } else {
        line += '  ';
      }
      
      // Node type indicator
      const typeIcon = node.type === 'user' ? '👤' : '🤖';
      line += typeIcon + ' ';
      
      // Node content preview
      const maxContentWidth = this.terminalWidth - line.length - 20; // Reserve space for timestamp
      let contentPreview = this.sanitizeForDisplay(node.content || '', maxContentWidth);
      
      // Add meta/sidechain indicators
      if (node.isMeta) {
        contentPreview = this.theme.formatMuted('[META] ') + contentPreview;
      }
      if (node.isSidechain) {
        contentPreview = this.theme.formatWarning('[SIDE] ') + contentPreview;
      }
      
      line += contentPreview;
      
      // Timestamp
      const timestamp = this.formatTimestamp(node.timestamp);
      const paddingNeeded = Math.max(0, this.terminalWidth - textTruncator.getDisplayWidth(line) - timestamp.length - 2);
      line += ' '.repeat(paddingNeeded) + this.theme.formatMuted(timestamp);
      
      // Apply selection highlighting
      if (isSelected) {
        line = this.theme.formatSelection(line, true);
      }
      
      console.log(line);
    }
    
    // Show scrolling indicator if needed
    if (visibleNodes.length > contentHeight) {
      const scrollInfo = `${startIndex + 1}-${endIndex}/${visibleNodes.length}`;
      console.log(this.theme.formatMuted(`  ... (${scrollInfo})`));
    }
  }

  /**
   * Render tree navigation controls
   */
  renderTreeControls() {
    const controls = [
      this.theme.formatMuted('↑/↓ or k/j') + ' navigate',
      this.theme.formatMuted('Space') + ' expand/collapse',
      this.theme.formatMuted('Enter') + ' go to conversation',
      this.theme.formatMuted('e') + ' expand all',
      this.theme.formatMuted('c') + ' collapse all',
      this.theme.formatMuted('m') + ' toggle mode',
      this.theme.formatMuted('Esc') + ' back',
      this.theme.formatMuted('q') + ' quit'
    ];
    
    console.log(controls.join(' · '));
  }

  /**
   * Render search view
   */
  renderSearch(viewData) {
    this.clearScreen();
    
    console.log(this.theme.formatHeader('🔍 Search Sessions'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    console.log('Search functionality coming soon...');
    console.log('');
    console.log('Press any key to return...');
  }

  /**
   * Render filter view
   */
  renderFilter(viewData) {
    // Directly show project selection instead of filter menu
    const projects = this.sessionManager.getProjects();
    this.clearScreen();
    console.log(this.theme.formatHeader('🔽 Filter by Project'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    const allOptions = ['Clear Filter', ...projects];
    allOptions.forEach((project, index) => {
      const isSelected = index === 0; // Default to "Clear Filter"
      const prefix = isSelected ? '▶ ' : '  ';
      const text = isSelected ? this.theme.formatSelection(project, true) : project;
      console.log(`${prefix}${text}`);
    });
    
    console.log('');
    console.log(this.theme.formatMuted('↑/↓ or k/j to navigate, Enter to select, Esc to cancel'));
  }

  /**
   * Render help view
   */
  /**
   * Render sub-agent detail view
   */
  renderSubAgentDetail(viewData) {
    const { selectedSubAgentData } = viewData;
    
    if (!selectedSubAgentData) {
      this.clearScreen();
      console.log(this.theme.formatError('No sub-agent data available'));
      return;
    }
    
    const { index, command, response, conversation } = selectedSubAgentData;
    
    // Clear and build header
    this.clearScreen();
    console.log(this.theme.formatHeader(`Sub-Agent #${index + 1} Details`));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    // Command section
    console.log(this.theme.formatAccent('📋 COMMAND'));
    console.log('');
    const commandContent = this.sessionManager.extractUserContent(command);
    const commandLines = this.wrapTextWithWidth(commandContent, this.terminalWidth - 4);
    commandLines.forEach(line => console.log('  ' + line));
    
    // Response section
    console.log('');
    console.log(this.theme.formatAccent('🤖 RESPONSE'));
    console.log('');
    
    if (response) {
      // Try to display the most complete sub-agent data available
      if (response.sessionId) {
        // Try to find the full sub-agent session for detailed display
        const fullSubAgentData = this.findFullSubAgentData(response.sessionId);
        if (fullSubAgentData) {
          // Display the sub-agent session with full detail
          const subAgentLines = this.buildFullDetailContent(
            {sessionId: response.sessionId}, 
            fullSubAgentData, 
            0
          );
          
          subAgentLines.forEach(line => {
            if (line.trim()) {
              console.log('  ' + line);
            }
          });
        } else {
          // Show available response content
          const lines = this.buildSubAgentDetailContent(response, conversation);
          lines.forEach(line => {
            if (line.trim()) {
              console.log('  ' + line);
            }
          });
        }
      } else {
        // Show available response content
        const lines = this.buildSubAgentDetailContent(response, conversation);
        lines.forEach(line => {
          if (line.trim()) {
            console.log('  ' + line);
          }
        });
      }
    } else {
      console.log('  ' + this.theme.formatDim('Response: (In progress or not available)'));
    }
    
    // Footer
    console.log('');
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(this.theme.formatMuted('Esc to return  |  Ctrl+R to toggle tool outputs  |  q to quit'));
  }

  renderHelp() {
    this.clearScreen();
    
    console.log(this.theme.formatAccent('CCScope Help'));
    console.log(this.theme.formatDim('─'.repeat(20)));
    console.log('');
    
    const sections = [
      {
        title: 'Navigation',
        items: [
          '↑/↓ k/j       Navigate up/down',
          '←/→ h/l       Navigate left/right',
          'PgUp/PgDn     Page up/down',
          'Ctrl+B/F      Page up/down (vim style)',
          'Enter         Select/Enter view',
          'Esc/q         Back/Exit',
          'g/G           Top/Bottom (in detail view)',
          'Ctrl+R        Expand/collapse tool output'
        ]
      },
      {
        title: 'Search & Filter',
        items: [
          '/             Search sessions',
          'f             Filter by project',
          's             Sort sessions'
        ]
      },
      {
        title: 'Actions',
        items: [
          'r             Resume session (claude -r)',
          'h/?           Show this help'
        ]
      }
    ];
    
    sections.forEach(section => {
      console.log(this.theme.formatAccent(`${section.title}:`));
      section.items.forEach(item => {
        console.log(`  ${item}`);
      });
      console.log('');
    });
    
    console.log(this.theme.formatDim('Press any key to continue...'));
  }

  /**
   * Render filter view
   */
  renderFilter(viewData) {
    this.clearScreen();
    
    const { filters } = viewData;
    
    // Header
    console.log(this.theme.formatHeader('🔽 Filter Sessions'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    // Current filters
    console.log(this.theme.formatAccent('Current Filters:'));
    if (filters.project) {
      console.log(`  📁 Project: ${filters.project}`);
    }
    
    if (!filters.project) {
      console.log(this.theme.formatMuted('  No filters active'));
    }
    
    console.log('');
    
    // Filter options
    console.log(this.theme.formatAccent('Filter Options:'));
    console.log('  p - Filter by Project');
    console.log('  c - Clear all filters');
    console.log('');
    
    // Navigation
    console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
    console.log(this.theme.formatMuted('Select an option or press Esc to cancel'));
  }

  /**
   * Render search view
   */
  renderSearch(viewData) {
    this.clearScreen();
    
    const { searchQuery } = viewData;
    
    // Header
    console.log(this.theme.formatHeader('🔍 Search Sessions'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    if (searchQuery) {
      console.log(this.theme.formatAccent(`Current Search: "${searchQuery}"`));
    } else {
      console.log(this.theme.formatMuted('No search query'));
    }
    
    console.log('');
    console.log(this.theme.formatMuted('Type to search, Esc to cancel'));
  }

  /**
   * Get frame rate information
   */
  getFrameRate() {
    const elapsed = Date.now() - this.renderStartTime;
    return elapsed > 0 ? Math.round(1000 / elapsed) : 0;
  }

  /**
   * Clear layout cache
   */
  clearCache() {
    this.layoutCache.clear();
  }

  /**
   * Render daily statistics
   */
  renderDailyStatistics(dailyStatsResult) {
    this.clearScreen();
    
    // Extract data
    const dailyStats = dailyStatsResult.dailyStats || dailyStatsResult;
    const totalSessions = dailyStatsResult.totalSessions || 0;
    
    // Header
    const title = this.theme.formatHeader('🔍 Claude Code Scope - Daily Statistics');
    console.log(title);
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    // Calculate totals
    const totals = {
      conversationCount: 0,
      totalDuration: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0
    };
    
    dailyStats.forEach(day => {
      totals.conversationCount += day.conversationCount;
      totals.totalDuration += day.totalDuration;
      totals.totalTokens += day.totalTokens || 0;
      totals.inputTokens += day.inputTokens || 0;
      totals.outputTokens += day.outputTokens || 0;
    });
    
    // Summary
    console.log(this.theme.formatHeader('Summary'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(`📊 Total Days: ${this.theme.formatHeader(dailyStats.length.toString())}`);
    console.log(`💼 Total Sessions: ${this.theme.formatHeader(totalSessions.toString())}`);
    console.log(`💬 Total Conversations: ${this.theme.formatHeader(totals.conversationCount.toString())}`);
    console.log(`⏱️  Total Duration: ${this.theme.formatHeader(this.theme.formatDuration(totals.totalDuration))}`);
    console.log(`🎯 Total Tokens: ${this.theme.formatHeader(formatLargeNumber(totals.totalTokens))} (In: ${formatLargeNumber(totals.inputTokens)}, Out: ${formatLargeNumber(totals.outputTokens)})`);;
    console.log('');
    
    // Table header
    console.log(this.theme.formatHeader('Daily Breakdown'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    const headers = ['Date', 'Sessions', 'Conversations', 'Duration', 'Avg Duration', 'Tools', 'Tokens'];
    const colWidths = [12, 10, 15, 12, 15, 10, 12];
    
    // Print headers
    let headerLine = '';
    headers.forEach((header, i) => {
      headerLine += this.theme.formatDim(header.padEnd(colWidths[i]));
    });
    console.log(headerLine);
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    // Print daily data
    dailyStats.forEach(day => {
      const avgDuration = day.conversationCount > 0 ? day.totalDuration / day.conversationCount : 0;
      
      let line = '';
      line += this.theme.formatHeader(day.date.padEnd(colWidths[0]));
      line += (day.sessionCount || 0).toString().padEnd(colWidths[1]);
      line += day.conversationCount.toString().padEnd(colWidths[2]);
      line += this.theme.formatDuration(day.totalDuration).padEnd(colWidths[3]);
      line += this.theme.formatDuration(avgDuration).padEnd(colWidths[4]);
      line += (day.toolUsageCount || 0).toString().padEnd(colWidths[5]);
      line += formatWithUnit(day.totalTokens || 0).padEnd(colWidths[6]);
      
      console.log(line);
    });
    
    console.log('');
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(this.theme.formatDim('Press Ctrl+C to exit'));
  }

  /**
   * Render project statistics
   */
  renderProjectStatistics(projectStats) {
    this.clearScreen();
    
    // Header
    const title = this.theme.formatHeader('🔍 Claude Code Scope - Project Statistics');
    console.log(title);
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    // Calculate totals
    const totals = {
      sessionCount: projectStats.reduce((sum, p) => sum + p.sessionCount, 0),
      conversationCount: projectStats.reduce((sum, p) => sum + p.conversationCount, 0),
      totalDuration: projectStats.reduce((sum, p) => sum + p.totalDuration, 0),
      totalTokens: projectStats.reduce((sum, p) => sum + (p.totalTokens || 0), 0),
      inputTokens: projectStats.reduce((sum, p) => sum + (p.inputTokens || 0), 0),
      outputTokens: projectStats.reduce((sum, p) => sum + (p.outputTokens || 0), 0)
    };
    
    // Summary
    console.log(this.theme.formatHeader('Summary'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(`📁 Total Projects: ${this.theme.formatHeader(projectStats.length.toString())}`);
    console.log(`💼 Total Sessions: ${this.theme.formatHeader(formatWithUnit(totals.sessionCount))}`);
    console.log(`💬 Total Conversations: ${this.theme.formatHeader(formatWithUnit(totals.conversationCount))}`);
    console.log(`⏱️  Total Duration: ${this.theme.formatHeader(this.theme.formatDuration(totals.totalDuration))}`);
    console.log(`🎯 Total Tokens: ${this.theme.formatHeader(formatWithUnit(totals.totalTokens))} (In: ${formatWithUnit(totals.inputTokens)}, Out: ${formatWithUnit(totals.outputTokens)})`);;
    console.log('');
    
    // Table header
    console.log(this.theme.formatHeader('Project Breakdown'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    const headers = ['Project', 'Sessions', 'Conv.', 'Duration', 'Avg Dur.', 'Tools', 'Tokens'];
    const colWidths = [45, 10, 8, 12, 10, 8, 12];
    
    // Print headers
    let headerLine = '';
    headers.forEach((header, i) => {
      headerLine += this.theme.formatDim(header.padEnd(colWidths[i]));
    });
    console.log(headerLine);
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    // Print project data
    projectStats.forEach(project => {
      let line = '';
      
      // Truncate project name if too long
      const projectName = project.project.length > colWidths[0] - 2 
        ? project.project.substring(0, colWidths[0] - 5) + '...'
        : project.project;
      
      line += this.theme.formatHeader(projectName.padEnd(colWidths[0]));
      line += formatWithUnit(project.sessionCount).padEnd(colWidths[1]);
      line += formatWithUnit(project.conversationCount).padEnd(colWidths[2]);
      line += this.theme.formatDuration(project.totalDuration).padEnd(colWidths[3]);
      
      // Calculate average duration
      const avgDuration = project.conversationCount > 0 ? project.totalDuration / project.conversationCount : 0;
      line += this.theme.formatDuration(avgDuration).padEnd(colWidths[4]);
      
      line += formatWithUnit(project.toolUsageCount || 0).padEnd(colWidths[5]);
      line += formatWithUnit(project.totalTokens || 0).padEnd(colWidths[6]);
      
      console.log(line);
    });
    
    console.log('');
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(this.theme.formatDim('Press Ctrl+C to exit'));
  }


  /**
   * Render search results interactively
   */
  renderSearchResultsInteractive(viewData) {
    this.clearScreen();
    
    const { searchResults, selectedIndex, searchQuery, searchOptions, scrollOffset } = viewData;
    
    // Header
    const title = this.theme.formatHeader('🔍 Claude Code Scope - Search Results');
    console.log(title);
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    // Search info
    console.log(this.theme.formatInfo(`Query: "${searchQuery}"`));
    
    // Results summary
    console.log(this.theme.formatHeader(`Found ${searchResults.length} matches`));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    if (searchResults.length === 0) {
      console.log(this.theme.formatMuted('No matches found.'));
      return;
    }
    
    // Calculate visible range
    const headerLines = 6; // Lines used by header (reduced from 7)
    const footerLines = 2; // Lines for footer
    const resultLines = 5; // Lines per result
    const availableHeight = this.terminalHeight - headerLines - footerLines;
    const maxVisibleResults = Math.floor(availableHeight / resultLines);
    
    // Ensure selected result is visible
    const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisibleResults / 2), searchResults.length - maxVisibleResults));
    const endIndex = Math.min(searchResults.length, startIndex + maxVisibleResults);
    
    // Display results
    for (let i = startIndex; i < endIndex; i++) {
      const result = searchResults[i];
      const isSelected = i === selectedIndex;
      
      // Selection indicator
      const prefix = isSelected ? this.theme.formatSelectedPrefix() + ' ' : '  ';
      
      // Session and conversation info
      const sessionIdShort = result.sessionId.substring(0, 8);
      const time = new Date(result.userTime).toLocaleString();
      // Format with better colors for readability
      const sessionInfo = `[${sessionIdShort}]`;
      const projectInfo = result.projectName;
      const convInfo = `Conv #${result.originalConversationNumber}`;
      
      console.log(prefix + 
        this.theme.formatMuted(sessionInfo) + ' ' +
        this.theme.formatInfo(projectInfo) + ' - ' +
        this.theme.formatAccent(convInfo)
      );
      
      // Metadata
      const responseTimeStr = this.theme.formatDuration(result.responseTime * 1000);
      const toolStr = result.toolCount > 0 ? ` • Tools: ${result.toolCount}` : '';
      
      console.log('  ' + `Duration: ${responseTimeStr}` + toolStr);
      
      // Match type and context
      const displayMatchType = result.matchType === 'thinking' ? 'assistant' : result.matchType;
      const matchTypeColor = result.matchType === 'user' ? 'formatInfo' : 'formatSuccess';
      console.log('  ' + this.theme[matchTypeColor](`Match in ${displayMatchType}:`));
      
      // Highlight the match in context
      let context = result.matchContext.replace(/\n/g, ' ').trim();
      
      // Get search options from the result
      const searchOptions = result.searchOptions || {};
      
      // Apply highlighting with support for OR and regex
      const highlightedContext = this.highlightText(context, searchQuery, searchOptions);
      
      // Format the context line with ellipsis
      const contextLine = `  ...${highlightedContext}...`;
      
      // Truncate if too long (considering ANSI codes)
      const maxWidth = this.terminalWidth - 4;
      const displayWidth = textTruncator.getDisplayWidth(this.theme.stripAnsiCodes(contextLine));
      
      if (displayWidth > maxWidth) {
        // Need more sophisticated truncation that preserves highlights
        const truncated = this.truncateWithWidth(contextLine, maxWidth);
        console.log(truncated);
      } else {
        console.log(contextLine);
      }
      
      if (i < endIndex - 1) {
        console.log(''); // Empty line between results
      }
    }
    
    // Footer
    console.log('');
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    // Search results controls
    const controls = [
      this.theme.formatMuted('↑/↓ or k/j') + ' to select result',
      this.theme.formatMuted('Enter') + ' to view detail',
      this.theme.formatMuted('Esc') + ' back',
      this.theme.formatMuted('q') + ' exit'
    ];
    console.log(controls.join(' · '));
  }

  /**
   * Render search results (static)
   * @param {string} query - Search query
   * @param {Array} results - Search results
   * @param {Object} options - Search options
   */
  renderSearchResults(query, results, options = {}) {
    this.clearScreen();
    
    // Header
    const title = this.theme.formatHeader('🔍 Claude Code Scope - Search Results');
    console.log(title);
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    // Search info
    console.log(this.theme.formatInfo(`Query: "${query}"`));
    console.log('');
    
    // Results summary
    console.log(this.theme.formatHeader(`Found ${results.length} matches`));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    if (results.length === 0) {
      console.log(this.theme.formatMuted('No matches found.'));
      console.log('');
      console.log(this.theme.formatDim('Press Ctrl+C to exit'));
      return;
    }
    
    // Group results by project
    const projectGroups = new Map();
    results.forEach(result => {
      if (!projectGroups.has(result.projectName)) {
        projectGroups.set(result.projectName, []);
      }
      projectGroups.get(result.projectName).push(result);
    });
    
    // Display results by project
    projectGroups.forEach((projectResults, projectName) => {
      console.log('');
      console.log(this.theme.formatHeader(`📁 ${projectName} (${projectResults.length} matches)`));
      console.log(this.theme.formatSeparator(Math.min(80, this.terminalWidth)));
      
      projectResults.slice(0, 10).forEach((result, index) => {
        console.log('');
        
        // Session and conversation info
        const sessionIdShort = result.sessionId.substring(0, 8);
        const time = new Date(result.userTime).toLocaleString();
        // Format with better colors for readability
        const sessionInfo = `[${sessionIdShort}]`;
        const convInfo = `Conversation #${result.conversationIndex + 1}`;
        const timeInfo = time;
        
        console.log(
          this.theme.formatMuted(sessionInfo) + ' ' +
          this.theme.formatAccent(convInfo) + ' - ' +
          this.theme.formatDim(timeInfo)
        );
        
        // Metadata
        const responseTimeStr = this.theme.formatDuration(result.responseTime * 1000);
        const toolStr = result.toolCount > 0 ? ` • Tools: ${result.toolCount}` : '';
        
        console.log(`Duration: ${responseTimeStr}` + toolStr);
        
        // Match type and context
        const displayMatchType = result.matchType === 'thinking' ? 'assistant' : result.matchType;
        const matchTypeColor = result.matchType === 'user' ? 'formatInfo' : 'formatSuccess';
        console.log(this.theme[matchTypeColor](`Match in ${displayMatchType}:`));
        
        // Highlight the match in context
        let context = result.matchContext.replace(/\n/g, ' ').trim();
        
        // Apply highlighting with support for OR and regex
        const highlightedContext = this.highlightText(context, query, options);
        
        // Format and display
        console.log(`  ...${highlightedContext}...`);
      });
      
      if (projectResults.length > 10) {
        console.log('');
        console.log(this.theme.formatDim(`  ... and ${projectResults.length - 10} more matches in this project`));
      }
    });
    
    console.log('');
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(this.theme.formatDim('Press Ctrl+C to exit'));
  }

  /**
   * Process markdown-style content for better display
   */
  processMarkdownContent(text) {
    if (!text) return text;
    
    let processedText = text;
    
    // Handle markdown-style headers - simpler approach
    processedText = processedText.replace(/^(#+)\s+(.+)$/gm, (match, hashes, content) => {
      const level = hashes.length;
      if (level === 1) return this.theme.formatAccent(`\n${content}\n${'─'.repeat(content.length)}`);
      if (level === 2) return this.theme.formatAccent(`▸ ${content}`);
      return `${'  '.repeat(level - 2)}• ${content}`;
    });
    
    // Handle inline code
    processedText = processedText.replace(/`([^`]+)`/g, (match, content) => {
      return this.theme.formatInfo(content);
    });
    
    // Handle lists
    processedText = processedText.replace(/^(\s*)([-*+])\s+(.+)$/gm, (match, indent, bullet, content) => {
      return `${indent}• ${content}`;
    });
    
    // Handle file paths
    processedText = processedText.replace(/\b(\/[^\s]+\.(js|ts|tsx|jsx|py|go|rs|cpp|c|h|java|rb|php))\b/g, (match) => {
      return this.theme.formatInfo(match);
    });
    
    return processedText;
  }

  /**
   * Find first line containing search match
   * @param {Array} lines - Array of lines to search
   * @param {string} query - Search query
   * @param {Object} options - Search options (supports OR and regex)
   * @returns {number} Line index or -1 if not found
   */
  findFirstMatchLine(lines, query, options = {}) {
    if (!query) return -1;
    
    let searchTerms = [];
    let searchRegex = null;
    
    if (options.regex) {
      // Regex mode
      try {
        searchRegex = new RegExp(query, 'i');
      } catch (error) {
        return -1;
      }
    } else if (/\s+(OR|or)\s+/.test(query)) {
      // Handle OR conditions (support both OR and or)
      const orPattern = /\s+(OR|or)\s+/;
      searchTerms = query.split(orPattern)
        .filter((term, index) => index % 2 === 0) // Skip the "OR"/"or" matches
        .map(term => term.trim().toLowerCase());
    } else {
      // Simple search
      searchTerms = [query.toLowerCase()];
    }
    
    for (let i = 0; i < lines.length; i++) {
      // Strip ANSI codes before searching
      const plainLine = this.theme.stripAnsiCodes(lines[i]);
      
      if (searchRegex) {
        if (searchRegex.test(plainLine)) {
          return i;
        }
      } else {
        const lowerLine = plainLine.toLowerCase();
        for (const term of searchTerms) {
          if (lowerLine.includes(term)) {
            return i;
          }
        }
      }
    }
    return -1;
  }

  /**
   * Truncate text to fit within specified width
   * @param {string} text - Text to truncate
   * @param {number} maxWidth - Maximum width
   * @returns {string} Truncated text
   */
  truncateText(text, maxWidth) {
    const strippedText = this.theme.stripAnsiCodes(text);
    
    if (textTruncator.getDisplayWidth(strippedText) <= maxWidth) {
      return text;
    }
    
    // Binary search for the right length
    let left = 0;
    let right = strippedText.length;
    let result = '';
    
    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      const substr = strippedText.substring(0, mid);
      
      if (textTruncator.getDisplayWidth(substr) <= maxWidth) {
        result = substr;
        left = mid;
      } else {
        right = mid - 1;
      }
    }
    
    // Preserve ANSI codes in the original text
    let ansiIndex = 0;
    let plainIndex = 0;
    let truncated = '';
    
    while (plainIndex < result.length && ansiIndex < text.length) {
      if (text[ansiIndex] === '\x1b') {
        // Copy ANSI escape sequence
        const match = text.substring(ansiIndex).match(/^\x1b\[[0-9;]*m/);
        if (match) {
          truncated += match[0];
          ansiIndex += match[0].length;
          continue;
        }
      }
      
      if (strippedText[plainIndex] === text[ansiIndex]) {
        truncated += text[ansiIndex];
        plainIndex++;
        ansiIndex++;
      } else {
        ansiIndex++;
      }
    }
    
    return truncated;
  }

  /**
   * Build sub-agent detail content (similar to buildFullDetailContent but for sub-agents)
   */
  buildSubAgentDetailContent(response, conversation) {
    const lines = [];
    
    // Clear tool IDs for this sub-agent
    this.state.clearAllToolIds();
    
    // Parse the response content directly - sub-agents may have different structure
    if (response.message && response.message.content) {
      const content = Array.isArray(response.message.content) ? response.message.content : [response.message.content];
      
      // Create chronological content from the raw message content
      const chronologicalContent = this.createChronologicalContentFromRaw(content, conversation);
      const chronologicalLines = chronologicalContent.split('\n');
      chronologicalLines.forEach(line => lines.push(line));
    } else {
      // Fallback: extract content using existing methods
      const assistantContent = this.sessionManager.extractAssistantContent(response);
      if (assistantContent) {
        const textLines = assistantContent.split('\n');
        textLines.forEach(line => lines.push(line));
      }
    }
    
    return lines;
  }

  /**
   * Create chronological content from raw message content array
   */
  createChronologicalContentFromRaw(content, conversation) {
    const lines = [];
    
    // Process content in order
    for (const item of content) {
      if (typeof item === 'string') {
        // Plain text content
        if (item.trim()) {
          const textLines = item.split('\n');
          textLines.forEach(line => lines.push(line));
        }
      } else if (item && typeof item === 'object') {
        if (item.type === 'thinking') {
          // Thinking content
          lines.push('');
          lines.push(this.theme.formatThinking('[Thinking]'));
          
          const thinkingContent = item.content || item.text || '';
          const thinkingLines = thinkingContent.split('\n');
          
          const thinkingId = `thinking-${Date.now()}`;
          const isExpanded = this.state.isToolExpanded(thinkingId);
          
          // Register thinking ID for Ctrl+R
          this.state.registerToolId(thinkingId);
          
          if (thinkingLines.length <= 20 || isExpanded) {
            thinkingLines.forEach(line => {
              lines.push(this.theme.formatThinking(line));
            });
          } else {
            // Show first 20 lines and collapsed indicator
            for (let i = 0; i < 20; i++) {
              lines.push(this.theme.formatThinking(thinkingLines[i]));
            }
            const remainingLines = thinkingLines.length - 20;
            lines.push(this.theme.formatDim(`… +${remainingLines} lines (ctrl+r to expand)`));
          }
        } else if (item.type === 'text') {
          // Text content in object format
          if (item.text && item.text.trim()) {
            lines.push('');
            const textLines = item.text.split('\n');
            textLines.forEach(line => lines.push(line));
          }
        } else if (item.type === 'tool_use') {
          // Tool use
          lines.push('');
          
          // Format tool header
          let toolHeader = `⏺ ${item.name}`;
          if (item.input) {
            const keyParams = this.getKeyParams(item.name, item.input);
            if (keyParams) {
              toolHeader += `(${keyParams})`;
            }
          }
          
          // Add timestamp
          const toolTime = this.formatDateTimeWithSeconds(new Date());
          toolHeader += ` ${this.theme.formatDim(`[${toolTime}]`)}`;
          
          lines.push(this.theme.formatSuccess(toolHeader));
          
          // Format tool input
          if (item.input) {
            this.formatToolInput(item, this.terminalWidth - 6).forEach(line => {
              lines.push('  ' + line);
            });
          }
          
          // Format tool result if available
          const toolResult = conversation.toolResults && conversation.toolResults.get(item.id);
          if (toolResult) {
            lines.push('');
            const resultIcon = toolResult.isError ? '❌' : '✅';
            const resultLabel = toolResult.isError ? 'Error' : 'Result';
            lines.push(`  ${resultIcon} ${this.theme.formatAccent(resultLabel)}:`);
            
            // Format result content
            let resultText = toolResult.result;
            if (typeof resultText === 'object') {
              resultText = JSON.stringify(resultText, null, 2);
            }
            
            resultText = resultText.toString();
            
            // Apply collapsible behavior for long tool outputs
            const resultLines = resultText.split('\n');
            const toolId = `tool-${item.id}`;
            const isExpanded = this.state.isToolExpanded(toolId);
            
            // Register tool ID for Ctrl+R
            this.state.registerToolId(toolId);
            
            if (resultLines.length <= 20 || isExpanded) {
              // Show all lines if short or expanded
              resultLines.forEach(line => {
                lines.push('    ' + (toolResult.isError ? this.theme.formatError(line) : line));
              });
            } else {
              // Show first 20 lines and collapsed indicator
              for (let i = 0; i < 20; i++) {
                lines.push('    ' + (toolResult.isError ? this.theme.formatError(resultLines[i]) : resultLines[i]));
              }
              const remainingLines = resultLines.length - 20;
              lines.push('    ' + this.theme.formatDim(`… +${remainingLines} lines (ctrl+r to expand)`));
            }
          }
        }
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Render nested sub-agent content from embedded response data
   */
  renderNestedSubAgentFromResponse(lines, response, baseIndent) {
    const indent = ' '.repeat(baseIndent);
    
    try {
      // DEBUG: Compact debug information to verify data structure
      if (response.message && Array.isArray(response.message.content)) {
        const contentTypes = response.message.content.map(item => item?.type || 'unknown');
        lines.push(`${indent}${this.theme.formatDim(`🔍 Content items: [${contentTypes.join(', ')}]`)}`);
      } else {
        lines.push(`${indent}${this.theme.formatDim('🔍 No content array found')}`);
      }
      
      // Check if response has message content
      if (!response.message || !response.message.content) {
        lines.push(`${indent}${this.theme.formatDim('No response content available')}`);
        return;
      }
      
      const content = response.message.content;
      if (!Array.isArray(content)) {
        lines.push(`${indent}${this.theme.formatDim('Invalid response content format')}`);
        return;
      }
      
      // Add timestamp if available
      if (response.timestamp) {
        const time = this.formatDateTimeWithSeconds(response.timestamp);
        lines.push(`  ${this.theme.formatDim(`[${time}]`)}`);
      }
      
      // Render each content item
      content.forEach((item, index) => {
        if (item.type === 'thinking') {
          // Show thinking content (correct field name: thinking, not content)
          lines.push(`  ${this.theme.formatThinking('🧠 Thinking:')}`);
          const thinkingContent = item.thinking || item.content || '';
          const thinkingLines = thinkingContent.split('\n');
          
          // Apply collapsible behavior for long thinking content
          const thinkingId = `thinking-${Date.now()}-${index}`;
          const isExpanded = this.state.isToolExpanded(thinkingId);
          
          // Register thinking ID for Ctrl+R
          this.state.registerToolId(thinkingId);
          
          if (thinkingLines.length <= 20 || isExpanded) {
            thinkingLines.forEach(line => {
              if (line.trim()) {
                lines.push(`    ${this.theme.formatDim(line)}`);
              }
            });
          } else {
            // Show first 20 lines and collapsed indicator
            for (let i = 0; i < 20; i++) {
              if (thinkingLines[i] && thinkingLines[i].trim()) {
                lines.push(`    ${this.theme.formatDim(thinkingLines[i])}`);
              }
            }
            const remainingLines = thinkingLines.length - 20;
            lines.push(`    ${this.theme.formatDim(`… +${remainingLines} lines (ctrl+r to expand)`)}`);
          }
          lines.push('');
          
        } else if (item.type === 'tool_use') {
          // Show tool usage with enhanced formatting
          lines.push('');
          let toolHeader = `⏺ ${item.name}`;
          if (item.input) {
            const keyParams = this.getKeyParams(item.name, item.input);
            if (keyParams) {
              toolHeader += `(${keyParams})`;
            }
          }
          
          // Add timestamp if available (tool execution time)
          const toolTime = new Date().toLocaleTimeString();
          toolHeader += ` ${this.theme.formatDim(`[${toolTime}]`)}`;
          
          lines.push(`  ${this.theme.formatSuccess(toolHeader)}`);
          
          // Show tool input parameters with collapsible behavior for large inputs
          if (item.input) {
            const params = Object.entries(item.input)
              .filter(([key, value]) => value !== undefined && value !== null && key !== 'edits');
            
            const toolId = `tool-input-${item.id || Date.now()}-${index}`;
            const isExpanded = this.state.isToolExpanded(toolId);
            
            // Register tool input ID for Ctrl+R
            this.state.registerToolId(toolId);
            
            params.forEach(([key, value]) => {
              let displayValue = typeof value === 'string' ? value : JSON.stringify(value);
              
              // Apply collapsible behavior for very long values
              if (displayValue.length > 200 && !isExpanded) {
                displayValue = displayValue.substring(0, 197) + '... (ctrl+r to expand)';
              }
              
              lines.push(`    ${this.theme.formatMuted(key + ':')} ${displayValue}`);
            });
          }
          
        } else if (item.type === 'tool_result') {
          // Show tool result with enhanced collapsible behavior
          const resultIcon = item.is_error ? '❌' : '✅';
          const resultLabel = item.is_error ? 'Error' : 'Result';
          lines.push(`  ${resultIcon} ${this.theme.formatAccent(resultLabel)}:`);
          
          if (item.content) {
            const resultLines = item.content.split('\n');
            const toolResultId = `tool-result-${item.tool_use_id || Date.now()}-${index}`;
            const isExpanded = this.state.isToolExpanded(toolResultId);
            
            // Register tool result ID for Ctrl+R
            this.state.registerToolId(toolResultId);
            
            if (resultLines.length <= 20 || isExpanded) {
              // Show all lines if short or expanded
              resultLines.forEach(line => {
                lines.push(`    ${item.is_error ? this.theme.formatError(line) : this.theme.formatDim(line)}`);
              });
            } else {
              // Show first 20 lines and collapsed indicator
              for (let i = 0; i < 20; i++) {
                if (resultLines[i] !== undefined) {
                  lines.push(`    ${item.is_error ? this.theme.formatError(resultLines[i]) : this.theme.formatDim(resultLines[i])}`);
                }
              }
              const remainingLines = resultLines.length - 20;
              lines.push(`    ${this.theme.formatDim(`… +${remainingLines} lines (ctrl+r to expand)`)}`);
            }
          }
          lines.push('');
          
        } else if (item.type === 'text') {
          // Show text response
          lines.push(`  ${this.theme.formatInfo('💬 Response:')}`);
          const textLines = item.text.split('\n');
          textLines.forEach(line => {
            if (line.trim()) {
              lines.push(`    ${line}`);
            }
          });
        }
      });
      
    } catch (error) {
      lines.push(`${indent}${this.theme.formatError('Error rendering sub-agent response: ' + error.message)}`);
    }
  }

  /**
   * Render nested sub-agent content with proper indentation
   */
  renderNestedSubAgentContent(lines, subAgentData, baseIndent) {
    const indent = ' '.repeat(baseIndent);
    
    try {
      // Create a chronological list from the sub-agent conversation
      const chronologicalContent = this.createChronologicalContentFromRaw(subAgentData);
      
      if (!chronologicalContent || chronologicalContent.length === 0) {
        lines.push(`${indent}${this.theme.formatDim('No content available')}`);
        return;
      }
      
      // Render each item in the chronological content
      chronologicalContent.forEach((item, index) => {
        if (item.type === 'thinking') {
          // Show thinking content
          lines.push(`${indent}${this.theme.formatThinking('🧠 Thinking:')}`);
          const thinkingLines = item.content.split('\n');
          thinkingLines.forEach(line => {
            if (line.trim()) {
              lines.push(`${indent}  ${this.theme.formatDim(line)}`);
            }
          });
          lines.push('');
          
        } else if (item.type === 'tool_use') {
          // Show tool usage
          let toolHeader = `🔧 ${item.name}`;
          if (item.input) {
            const keyParams = this.getKeyParams(item.name, item.input);
            if (keyParams) {
              toolHeader += `(${keyParams})`;
            }
          }
          lines.push(`${indent}${this.theme.formatSuccess(toolHeader)}`);
          
          // Show tool input parameters using existing pattern
          if (item.input) {
            // Use the same pattern as the main tool display logic
            const params = Object.entries(item.input)
              .filter(([key, value]) => value !== undefined && value !== null && key !== 'edits');
            
            params.forEach(([key, value]) => {
              let displayValue = typeof value === 'string' ? value : JSON.stringify(value);
              // Truncate very long values
              if (displayValue.length > 100) {
                displayValue = displayValue.substring(0, 97) + '...';
              }
              lines.push(`${indent}  ${this.theme.formatMuted(key + ':')} ${displayValue}`);
            });
          }
          
        } else if (item.type === 'tool_result') {
          // Show tool result
          lines.push(`${indent}${this.theme.formatMuted('📋 Result:')}`);
          if (item.content) {
            const resultLines = item.content.split('\n');
            const maxLines = 10; // Limit tool result display
            const displayLines = resultLines.slice(0, maxLines);
            
            displayLines.forEach(line => {
              if (line.trim()) {
                lines.push(`${indent}  ${this.theme.formatDim(line)}`);
              }
            });
            
            if (resultLines.length > maxLines) {
              lines.push(`${indent}  ${this.theme.formatDim(`... +${resultLines.length - maxLines} more lines`)}`);
            }
          }
          lines.push('');
          
        } else if (item.type === 'text') {
          // Show text response
          lines.push(`${indent}${this.theme.formatInfo('💬 Response:')}`);
          const textLines = item.content.split('\n');
          textLines.forEach(line => {
            if (line.trim()) {
              lines.push(`${indent}  ${line}`);
            }
          });
          lines.push('');
        }
      });
      
    } catch (error) {
      lines.push(`${indent}${this.theme.formatError('Error rendering sub-agent content: ' + error.message)}`);
    }
  }

  /**
   * Find full sub-agent data by session ID
   */
  findFullSubAgentData(sessionId) {
    // Search through SessionManager.sessions for a session with this ID
    const sessions = this.sessionManager.sessions;
    
    for (const session of sessions) {
      // Check if this session matches the sub-agent session ID
      if (session.fullSessionId === sessionId || session.sessionId === sessionId) {
        console.log('  ' + this.theme.formatDim(`Found sub-agent session: ${session.sessionId}`));
        
        // Return the first conversation from this session
        // (sub-agent sessions usually have one main conversation)
        if (session.conversationPairs && session.conversationPairs.length > 0) {
          return session.conversationPairs[0];
        }
      }
    }
    
    // If not found in current sessions, try to search transcript files
    // This is a more advanced feature that would require file system access
    console.log('  ' + this.theme.formatDim('Session not found in current sessions'));
    return null;
  }

  /**
   * Format session summary with metrics
   */
  formatSessionSummary(session) {
    if (!session) return '';
    
    const lines = [];
    
    if (session.metrics) {
      if (session.metrics.totalThinkingTime) {
        lines.push(`Thinking time: ${this.theme.formatDuration(session.metrics.totalThinkingTime)}`);
      }
      if (session.metrics.avgThinkingRatio !== undefined) {
        lines.push(`Thinking ratio: ${this.theme.formatThinkingRate(session.metrics.avgThinkingRatio)}`);
      }
      if (session.metrics.totalResponseTime) {
        lines.push(`Total response time: ${this.theme.formatDuration(session.metrics.totalResponseTime)}`);
      }
    }
    
    return lines.join(' | ');
  }

  /**
   * Create progress indicator
   */
  createProgressIndicator(current, total) {
    return this.theme.createProgressBar(current, total, 20);
  }

  /**
   * Render keyboard shortcut help
   */
  renderKeyboardHelp(view) {
    const shortcuts = {
      'session_list': [
        { key: '↑/↓ j/k', desc: 'Navigate' },
        { key: 'Enter', desc: 'View details' },
        { key: '/', desc: 'Search' },
        { key: 'f', desc: 'Filter' },
        { key: 's', desc: 'Sort' },
        { key: 'r', desc: 'Resume session' },
        { key: 'q', desc: 'Quit' }
      ],
      'conversation_detail': [
        { key: '↑/↓ j/k', desc: 'Navigate' },
        { key: 'Enter', desc: 'View full' },
        { key: '←/→ h/l', desc: 'Previous/Next session' },
        { key: 'Esc', desc: 'Back' },
        { key: 's', desc: 'Sort conversations' }
      ],
      'full_detail': [
        { key: '↑/↓ j/k', desc: 'Scroll' },
        { key: 'PgUp/PgDn', desc: 'Page scroll' },
        { key: 'Home/End', desc: 'Top/Bottom' },
        { key: 'Ctrl+R', desc: 'Toggle tools' },
        { key: 'Esc', desc: 'Back' }
      ]
    };
    
    const lines = [];
    const shortcutList = shortcuts[view] || [];
    
    shortcutList.forEach(item => {
      lines.push(`${this.theme.formatAccent(item.key.padEnd(15))} ${item.desc}`);
    });
    
    return lines;
  }

  /**
   * Render status bar
   */
  renderStatusBar(status) {
    const parts = [];
    
    if (status.mode) {
      parts.push(`Mode: ${status.mode}`);
    }
    
    if (status.message) {
      parts.push(status.message);
    }
    
    if (status.progress) {
      parts.push(`${status.progress.current}/${status.progress.total}`);
    }
    
    return this.theme.formatInfo(parts.join(' | '));
  }

  /**
   * Render error message
   */
  renderError(error) {
    if (error instanceof Error) {
      return this.theme.formatError(`Error: ${error.message}`);
    } else {
      return this.theme.formatError(`Error: ${error}`);
    }
  }

  /**
   * Get content height for scrolling
   */
  getContentHeight() {
    const headerLines = 8;
    const footerLines = 10;
    const buffer = 2;
    return Math.max(1, this.terminalHeight - headerLines - footerLines - buffer);
  }

  /**
   * Render daily statistics
   */
  renderDailyStatistics(dailyStatsResult) {
    console.clear();
    
    const title = '📊 Daily Conversation Statistics';
    console.log(this.theme.formatHeader(title));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log();
    
    if (!dailyStatsResult || !dailyStatsResult.dailyStats || dailyStatsResult.dailyStats.length === 0) {
      console.log(this.theme.formatMuted('No sessions found'));
      return;
    }
    
    const dailyStats = dailyStatsResult.dailyStats;
    
    // Calculate totals
    const totalConversations = dailyStats.reduce((sum, day) => sum + day.conversationCount, 0);
    const totalDuration = dailyStats.reduce((sum, day) => sum + day.totalDuration, 0);
    const totalTools = dailyStats.reduce((sum, day) => sum + day.toolUsageCount, 0);
    const totalTokens = dailyStats.reduce((sum, day) => sum + day.totalTokens, 0);
    
    // Summary section - formatted like main header
    console.log(this.theme.formatSeparator(65, '='));
    console.log(`📊 ${dailyStatsResult.totalSessions} Sessions | ⏱️ ${this.theme.formatDuration(totalDuration)} Duration | 💬 ${totalConversations} Convos | 🔧 ${formatWithUnit(totalTools)} Tools | 🎯 ${formatWithUnit(totalTokens)} Tokens`);
    console.log(this.theme.formatSeparator(65, '='));
    console.log();
    
    // Header with proper spacing
    const header = [
      'Date'.padEnd(10),
      'Sessions'.padStart(8),
      'Conv.'.padStart(6),
      'Duration'.padStart(10),
      'Avg Dur.'.padStart(8),
      'Tools'.padStart(6),
      'Tokens'.padStart(8)
    ].join('  ');
    
    console.log(this.theme.formatAccent(header));
    console.log(this.theme.formatSeparator(header.length));
    
    // Data rows
    dailyStats.forEach(day => {
      const avgDuration = day.conversationCount > 0 ? 
        Math.round(day.totalDuration / day.conversationCount / 1000) : 0; // Convert to seconds
      
      const row = [
        day.date.padEnd(10),
        String(day.sessionCount).padStart(8),
        String(day.conversationCount).padStart(6),
        this.theme.formatDuration(day.totalDuration).padStart(10),
        this.theme.formatDuration(avgDuration * 1000).padStart(8),
        formatWithUnit(day.toolUsageCount).padStart(6),
        formatWithUnit(day.totalTokens).padStart(8)
      ].join('  ');
      
      console.log(row);
    });
  }

  /**
   * Render project statistics
   */
  renderProjectStatistics(projectStats) {
    console.clear();
    
    const title = '📊 Project Statistics';
    console.log(this.theme.formatHeader(title));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log();
    
    if (!projectStats || !Array.isArray(projectStats) || projectStats.length === 0) {
      console.log(this.theme.formatMuted('No projects found'));
      return;
    }
    
    // Calculate totals
    const totalProjects = projectStats.length;
    const totalSessions = projectStats.reduce((sum, p) => sum + p.sessionCount, 0);
    const totalConversations = projectStats.reduce((sum, p) => sum + p.conversationCount, 0);
    const totalDuration = projectStats.reduce((sum, p) => sum + p.totalDuration, 0);
    const totalTools = projectStats.reduce((sum, p) => sum + p.toolUsageCount, 0);
    const totalTokens = projectStats.reduce((sum, p) => sum + p.totalTokens, 0);
    const totalInputTokens = projectStats.reduce((sum, p) => sum + p.inputTokens, 0);
    const totalOutputTokens = projectStats.reduce((sum, p) => sum + p.outputTokens, 0);
    
    // Summary section
    console.log('Summary');
    console.log(this.theme.formatSeparator(65, '='));
    console.log(`📁 Total Projects: ${totalProjects}`);
    console.log(`💼 Total Sessions: ${totalSessions}`);
    console.log(`💬 Total Conversations: ${totalConversations}`);
    console.log(`⏱️  Total Duration: ${this.theme.formatDuration(totalDuration)}`);
    console.log(`🎯 Total Tokens: ${formatLargeNumber(totalTokens)} (In: ${formatLargeNumber(totalInputTokens)}, Out: ${formatLargeNumber(totalOutputTokens)})`);
    console.log();
    
    // Project breakdown
    console.log('Project Breakdown');
    console.log(this.theme.formatSeparator(95, '='));
    
    // Header with proper spacing
    const header = [
      'Project'.padEnd(35),
      'Sessions'.padStart(8),
      'Conv.'.padStart(6),
      'Duration'.padStart(10),
      'Avg Dur.'.padStart(8),
      'Tools'.padStart(6),
      'Tokens'.padStart(10)
    ].join('  ');
    
    console.log(this.theme.formatAccent(header));
    console.log(this.theme.formatSeparator(95, '='));
    
    // Data rows
    projectStats.forEach(project => {
      const projectName = project.project || 'Unknown';
      const truncatedName = projectName.length > 35 ? 
        projectName.substring(0, 32) + '...' : projectName;
      
      const avgDuration = project.conversationCount > 0 ? 
        Math.round(project.totalDuration / project.conversationCount / 1000) : 0; // Convert to seconds
      
      const row = [
        truncatedName.padEnd(35),
        String(project.sessionCount).padStart(8),
        String(project.conversationCount).padStart(6),
        this.theme.formatDuration(project.totalDuration).padStart(10),
        this.theme.formatDuration(avgDuration * 1000).padStart(8),
        formatWithUnit(project.toolUsageCount).padStart(6),
        formatWithUnit(project.totalTokens).padStart(10)
      ].join('  ');
      
      console.log(row);
    });
  }

}

module.exports = ViewRenderer;