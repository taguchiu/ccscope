/**
 * ViewRenderer
 * Handles all display logic and view rendering
 */

const config = require('./config');

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
      case 'help':
        this.renderHelp();
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
    const title = this.theme.formatHeader('🔍 Claude Code Scope');
    console.log(title);
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
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
    const duration = this.theme.formatHeader(this.theme.formatDuration(stats.totalDuration || 0));
    let line = `📊 ${sessions} Sessions | 💬 ${conversations} Convos | ⏱️  ${duration}`;
    
    return line;
  }

  /**
   * Format session stats line (for conversation detail view)
   */
  formatSessionStatsLine(stats) {
    const conversations = this.theme.formatHeader(`${stats.totalConversations}`);
    const duration = this.theme.formatHeader(this.theme.formatDuration(stats.totalDuration || 0));
    let line = `💬 ${conversations} Convos | ⏱️  ${duration}`;
    
    return line;
  }

  /**
   * Format search/filter/sort info
   */
  formatSearchFilterInfo(searchQuery, filters, sortOrder, sortDirection) {
    let info = '';
    
    if (searchQuery) {
      info += this.theme.formatInfo(`🔍 Search: "${searchQuery}"`);
    }
    
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
      'projectName': 'Project Name'
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
      'Conversations'.padEnd(13),
      'Duration'.padEnd(12),
      'Started'.padEnd(12),
      'Last Updated'.padEnd(12)
    ];
    
    console.log(this.theme.formatMuted(headers.join(' ')));
    console.log(this.theme.formatSeparator(this.terminalWidth, '-'));
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
      
      const conversations = session.totalConversations.toString().padEnd(13);
      
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
      const duration = durationStr.padEnd(12);
      const startTime = this.theme.formatDateTime(session.startTime).padEnd(12);
      const lastUpdated = this.theme.formatDateTime(session.lastActivity).padEnd(12);
      
      // Build plain content
      const plainContent = `${no} ${paddedId} ${project} ${conversations} ${duration} ${startTime} ${lastUpdated}`;
      
      // Calculate padding to fill entire terminal width
      const contentWidth = this.theme.getDisplayWidth(plainContent);
      const prefixWidth = this.theme.getDisplayWidth(prefix);
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
      const id = formattedId + ' '.repeat(Math.max(0, 16 - this.theme.getDisplayWidth(formattedId)));
      const truncatedProject = this.truncateWithWidth(session.projectName, config.layout.projectNameLength - 1);
      const project = truncatedProject.padEnd(config.layout.projectNameLength);
      
      const conversations = session.totalConversations.toString().padEnd(13);
      const durationText = this.theme.formatDuration(session.duration);
      const duration = durationText + ' '.repeat(Math.max(0, 12 - this.theme.getDisplayWidth(durationText)));
      const startTime = this.theme.formatDateTime(session.startTime).padEnd(12);
      const lastUpdated = this.theme.formatDateTime(session.lastActivity).padEnd(12);
      
      const content = `${no} ${id} ${project} ${conversations} ${duration} ${startTime} ${lastUpdated}`;
      const coloredContent = this.theme.formatSelection(content, isSelected);
      console.log(prefix + coloredContent);
    }
  }

  /**
   * Render compact session list
   */
  renderCompactSessionList(sessions, selectedIndex) {
    // Similar to wide but with fewer columns
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
      
      // Build plain content
      const plainContent = `${no} ${paddedId} ${conversations}`;
      
      // Calculate padding to fill entire terminal width
      const contentWidth = this.theme.getDisplayWidth(plainContent);
      const prefixWidth = this.theme.getDisplayWidth(prefix);
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
      const id = formattedId + ' '.repeat(Math.max(0, 16 - this.theme.getDisplayWidth(formattedId)));
      
      const conversations = session.totalConversations.toString().padEnd(5);
      
      const content = `${no} ${id} ${conversations}`;
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
          // Use conservative max length to ensure single line display
          const maxMessageLength = Math.min(80, this.terminalWidth - prefix.length - 10); // Extra safety margin
          const originalMsg = (conv.userContent || conv.userMessage || '').replace(/\n/g, ' ').trim();
          const userMsg = originalMsg.length > maxMessageLength ? 
            originalMsg.substring(0, maxMessageLength) + '...' : 
            originalMsg;
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

    return {
      totalSessions: sessions.length,
      totalConversations,
      totalDuration
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
        totalDuration: 0
      };
    }

    return {
      totalSessions: 1,
      totalConversations: session.totalConversations || 0,
      totalDuration: session.duration || 0
    };
  }

  /**
   * Render controls
   */
  renderControls() {
    const controls = [
      this.theme.formatMuted('↑/↓') + ' to select',
      this.theme.formatMuted('Enter') + ' to view details',
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
    const headerHeight = 8; // Title(1) + separator(1) + ultrathink(1) + stats(1) + blank(1) + headers(2) + separator(1)
    const footerHeight = 10; // separator(1) + selected info(2) + recent activity header(1) + activities(3) + controls(1) + buffer(2)
    
    // Reduce by 2 for stability
    return Math.max(1, this.terminalHeight - headerHeight - footerHeight - 2);
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
    if (conversations[selectedConversationIndex]) {
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
    // Title
    const title = this.theme.formatHeader('🔍 Claude Code Scope');
    console.log(title);
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    // Stats line (session-specific, no session count)
    const statsLine = this.formatSessionStatsLine(stats);
    console.log(statsLine);
    
    // Selected session info with file
    const sessionInfo = `Selected: ${session.projectName} - ${session.sessionId}`;
    console.log(this.theme.formatInfo(sessionInfo));
    
    if (session.filePath) {
      const filePath = this.theme.formatMuted(`📁 File: ${session.filePath}`);
      console.log(filePath);
    }
    
    // Sort info
    const sortOrderDisplay = {
      'dateTime': 'DateTime',
      'duration': 'Duration', 
      'tools': 'Tools'
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
    // Headers
    const headers = [
      'No.'.padEnd(3),
      'DateTime'.padEnd(12),
      'Duration'.padEnd(8),
      'Tools'.padEnd(6), // Match the data column width
      'User Message'
    ];
    
    console.log(this.theme.formatMuted(headers.join(' ')));
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
    const dateTime = this.theme.formatDateTime(conversation.timestamp).padEnd(12); // MM/DD HH:MM format
    const response = this.theme.formatResponseTime(conversation.responseTime); // Already padded in ThemeManager
    const toolCount = this.theme.formatToolCount(conversation.toolsUsed.length);
    // User message preview - calculate remaining width more accurately
    // Calculate fixed columns width
    // prefix(2) + no(3) + space + datetime(12) + space + response(8) + space + tool(6) + space
    // Response and tool columns are already properly padded in ThemeManager
    const ansiMargin = 15; // Color codes don't display but take up string length
    const fixedColumnsWidth = 2 + 3 + 1 + 12 + 1 + 8 + 1 + 6 + 1 + ansiMargin;
    
    // Calculate available width for message
    // Calculate actual fixed width based on real column sizes
    let actualFixedWidth = 0;
    actualFixedWidth += 2; // prefix
    actualFixedWidth += 3 + 1; // no + space
    actualFixedWidth += 12 + 1; // datetime + space (MM/DD HH:MM = 11 + 1 padding)
    actualFixedWidth += 8 + 1; // response + space
    actualFixedWidth += 6 + 1; // tool + space
    
    // Use larger safety margin to prevent wrapping
    // Additional margin for potential full-width character edge cases
    const safetyMargin = 35; // Further increased to handle all edge cases
    const availableWidth = Math.max(20, this.terminalWidth - actualFixedWidth - safetyMargin);
    
    // Truncate message considering full-width characters
    const originalMessage = conversation.userMessage.replace(/\n/g, ' ');
    let truncatedMessage = this.truncateWithWidth(originalMessage, availableWidth);
    
    // Use the truncated message for all display
    const userMessage = truncatedMessage;
    
    // Build raw content without colors for width calculation
    const rawContent = `${no} ${dateTime} ${response.replace(/\x1b\[[0-9;]*m/g, '')} ${toolCount.replace(/\x1b\[[0-9;]*m/g, '').padEnd(6)} ${userMessage}`;
    
    // Apply selection highlighting
    if (isSelected) {
      // For selected rows, we need plain text values to apply consistent background
      const responseRaw = conversation.responseTime >= 60 
        ? `${Math.floor(conversation.responseTime / 60)}m${Math.floor(conversation.responseTime % 60)}s`
        : `${conversation.responseTime.toFixed(1)}s`;
      const toolCountRaw = `${conversation.toolsUsed.length}t`;
      
      // Build plain content for full-width selection
      const plainParts = [
        no, 
        dateTime.replace(/\x1b\[[0-9;]*m/g, ''), // Remove any ANSI codes from dateTime
        responseRaw.padEnd(8), 
        toolCountRaw.padStart(5) + ' ', // Consistent padding with non-selected rows
        userMessage // Already truncated considering full-width chars
      ];
      const plainContent = plainParts.join(' ');
      
      // Calculate padding to fill entire terminal width
      const contentWidth = this.theme.getDisplayWidth(plainContent);
      const prefixWidth = this.theme.getDisplayWidth(prefix);
      const totalWidth = prefixWidth + contentWidth;
      const paddingWidth = Math.max(0, this.terminalWidth - totalWidth);
      const padding = ' '.repeat(paddingWidth);
      
      // Apply selection formatting to the entire line including padding
      const fullLine = plainContent + padding;
      
      console.log(prefix + this.theme.formatSelection(fullLine, isSelected));
    } else {
      // For non-selected rows, use colored values but ensure message fits
      const content = `${no} ${dateTime} ${response} ${toolCount} ${userMessage}`;
      console.log(prefix + content);
    }
  }

  /**
   * Truncate string to fit within specified display width
   */
  truncateWithWidth(text, maxWidth) {
    let currentWidth = 0;
    let truncateIndex = 0;
    const ellipsis = '...';
    const ellipsisWidth = 3;
    
    // Calculate total width first, handling surrogate pairs
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
        const lowCode = text.charCodeAt(i + 1);
        if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
          totalWidth += 2;
          i++; // Skip low surrogate
          continue;
        }
      }
      totalWidth += this.getCharWidth(text[i]);
    }
    
    // Return original if it fits
    if (totalWidth <= maxWidth) {
      return text;
    }
    
    // Calculate where to truncate - be more conservative
    // Leave extra space to ensure no wrapping occurs
    const conservativeMaxWidth = maxWidth - ellipsisWidth - 2; // Extra 2 char buffer
    
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      let charWidth = 1;
      
      // Handle surrogate pairs properly
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
        const lowCode = text.charCodeAt(i + 1);
        if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
          charWidth = 2;
          if (currentWidth + charWidth > conservativeMaxWidth) {
            break;
          }
          currentWidth += charWidth;
          truncateIndex = i + 2; // Include both surrogate chars
          i++; // Skip low surrogate
          continue;
        }
      }
      
      charWidth = this.getCharWidth(text[i]);
      if (currentWidth + charWidth > conservativeMaxWidth) {
        break;
      }
      currentWidth += charWidth;
      truncateIndex = i + 1;
    }
    
    const truncated = text.substring(0, truncateIndex) + ellipsis;
    
    // Return truncated with ellipsis
    return truncated;
  }

  /**
   * Get character width (1 for half-width, 2 for full-width)
   */
  getCharWidth(char) {
    const code = char.charCodeAt(0);
    
    // Check for emoji sequences (surrogate pairs)
    if (code >= 0xD800 && code <= 0xDBFF) {
      // This is a high surrogate, which means it's part of an emoji
      return 2;
    }
    
    // Additional emoji ranges
    if ((code >= 0x2600 && code <= 0x27BF) || // Miscellaneous Symbols
        (code >= 0x1F300 && code <= 0x1F6FF) || // Miscellaneous Symbols and Pictographs
        (code >= 0x1F900 && code <= 0x1F9FF) || // Supplemental Symbols and Pictographs
        (code >= 0x1F000 && code <= 0x1F02F)) { // Mahjong/Domino Tiles
      return 2;
    }
    
    // Check if it's a full-width character
    if ((code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
        (code >= 0x2E80 && code <= 0x9FFF) || // CJK (includes Hiragana, Katakana, Kanji)
        (code >= 0xAC00 && code <= 0xD7AF) || // Hangul Syllables
        (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
        (code >= 0xFE30 && code <= 0xFE4F) || // CJK Compatibility Forms
        (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
        (code >= 0xFFE0 && code <= 0xFFE6) || // Fullwidth Forms
        (code >= 0x3000 && code <= 0x303F) || // CJK Symbols and Punctuation (、。など)
        (code >= 0x2018 && code <= 0x201F)) { // Quotation marks
      return 2;
    }
    return 1;
  }

  /**
   * Get maximum visible conversations
   */
  getMaxVisibleConversations() {
    // Fixed layout calculation:
    // Header: title(1) + separator(1) + blank(1) = 3
    // Table headers: headers(1) + separator(1) = 2
    // Footer: separator(1) + preview(5-7 lines) + blank(1) + controls(1) = 8-10
    const headerHeight = 5; // 3 + 2
    const footerHeight = 10; // Increased footer height for more preview space
    
    // Reduce by 2 for stability
    const maxVisible = Math.max(1, this.terminalHeight - headerHeight - footerHeight - 2);
    
    return maxVisible;
  }

  /**
   * Render conversation preview
   */
  renderConversationPreview(conversation) {
    console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
    
    // User message (truncate to fit one line considering display width)
    const userPrefix = '👤 ';
    const userPrefixWidth = this.theme.getDisplayWidth(userPrefix);
    const maxUserWidth = this.terminalWidth - userPrefixWidth;
    const userMessage = conversation.userMessage.replace(/\n/g, ' ').trim();
    const truncatedUser = this.truncateWithWidth(userMessage, maxUserWidth);
    console.log(`${userPrefix}${truncatedUser}`);
    
    // Assistant response (truncate to fit one line considering display width)
    const assistantPrefix = '🤖 ';
    const assistantPrefixWidth = this.theme.getDisplayWidth(assistantPrefix);
    const maxAssistantWidth = this.terminalWidth - assistantPrefixWidth;
    const assistantMessage = conversation.assistantResponse.replace(/\n/g, ' ').trim();
    const truncatedAssistant = this.truncateWithWidth(assistantMessage, maxAssistantWidth);
    console.log(`${assistantPrefix}${truncatedAssistant}`);
    
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
      const toolsPrefixWidth = this.theme.getDisplayWidth(toolsPrefix);
      const maxToolsWidth = this.terminalWidth - toolsPrefixWidth;
      const truncatedToolsFormatted = this.truncateWithWidth(toolsFormatted, maxToolsWidth);
      console.log(`${toolsPrefix}${truncatedToolsFormatted}`);
    } else {
      // Empty line to maintain fixed layout
      console.log('');
    }
    
  }

  /**
   * Render conversation detail controls
   */
  renderConversationDetailControls() {
    const controls = [
      this.theme.formatMuted('↑/↓') + ' to select conversation',
      this.theme.formatMuted('Enter') + ' to view detail',
      this.theme.formatMuted('←/→') + ' switch session',
      this.theme.formatMuted('s') + ' sort',
      this.theme.formatMuted('Esc') + ' back',
      this.theme.formatMuted('q') + ' exit'
    ];
    
    console.log(controls.join(' · '));
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
    this.clearScreen();
    
    const { session, conversations, selectedConversationIndex, scrollToEnd = false } = viewData;
    const conversation = conversations[selectedConversationIndex];
    
    // Always display fixed header first (ensure it's never scrolled off)
    console.log(this.theme.formatHeader(`Full Detail: ${session.projectName}`));
    console.log(this.theme.formatMuted(`Conversation #${selectedConversationIndex + 1} of ${conversations.length}`));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    // Check if conversation exists
    if (!conversation) {
      console.log('');
      console.log(this.theme.formatWarning('No conversation data available'));
      console.log('');
      console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
      this.renderFullDetailControls(false);
      return;
    }
    
    // Build content
    const lines = this.buildFullDetailContent(session, conversation, selectedConversationIndex);
    
    // Calculate visible area (header is already displayed above)
    const headerLines = 3; // Fixed header (already displayed)
    const footerLines = 2; // Controls + separator
    const contentHeight = this.terminalHeight - headerLines - footerLines;
    
    // Set max scroll offset in state manager
    const maxScrollOffset = Math.max(0, lines.length - contentHeight);
    this.state.setMaxScrollOffset(maxScrollOffset);
    
    // Get current scroll offset from state (updated by scroll methods)
    let scrollOffset = this.state.scrollOffset;
    
    // If scrollToEnd is true (first time entering), scroll to bottom
    if (scrollToEnd && lines.length > contentHeight) {
      scrollOffset = maxScrollOffset;
      this.state.scrollOffset = scrollOffset;
      this.state.scrollToEnd = false; // Reset flag after initial positioning
    }
    
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
    
    // Display scroll indicator in header area (line 1, right side)
    if (lines.length > contentHeight) {
      const scrollPercentage = Math.round((scrollOffset / maxScrollOffset) * 100);
      const scrollIndicator = `[${visibleStart + 1}-${visibleEnd}/${lines.length}] ${scrollPercentage}%`;
      
      // Position in header area (line 1, right side)
      process.stdout.write('\x1b[s'); // Save cursor
      process.stdout.write(`\x1b[1;${this.terminalWidth - scrollIndicator.length + 1}H`); // Move to header line, right side
      process.stdout.write(this.theme.formatMuted(scrollIndicator));
      process.stdout.write('\x1b[u'); // Restore cursor
    }
    
    // Footer
    console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
    this.renderFullDetailControls(lines.length > contentHeight);
  }

  /**
   * Build full detail content lines
   */
  buildFullDetailContent(session, conversation, selectedConversationIndex) {
    const lines = [];
    
    // Safety check
    if (!conversation) {
      lines.push('');
      lines.push(this.theme.formatWarning('No conversation data available'));
      return lines;
    }
    
    // Timestamp and metadata
    lines.push('');
    lines.push(this.theme.formatInfo('📅 ' + this.theme.formatDateTime(conversation.timestamp)));
    lines.push(this.theme.formatInfo(`⏱️  Response Time: ${this.theme.formatResponseTime(conversation.responseTime)}`));
    
    if (conversation.thinkingRate && conversation.thinkingRate > 0) {
      lines.push(this.theme.formatInfo(`🧠 Thinking Rate: ${(conversation.thinkingRate * 100).toFixed(1)}%`));
    }
    
    lines.push('');
    
    // User message
    lines.push(this.theme.formatAccent('👤 USER MESSAGE:'));
    lines.push(this.theme.formatSeparator(this.terminalWidth, '-'));
    const userLines = this.wrapText(conversation.userMessage, this.terminalWidth - 2);
    userLines.forEach(line => lines.push(line));
    lines.push('');
    
    // Thinking content
    if (conversation.thinkingContent && conversation.thinkingContent.length > 0) {
      lines.push(this.theme.formatAccent('🧠 THINKING PROCESS:'));
      lines.push(this.theme.formatSeparator(this.terminalWidth, '-'));
      
      conversation.thinkingContent.forEach((thinking, index) => {
        if (index > 0) lines.push(''); // Add space between thinking blocks
        lines.push(this.theme.formatMuted(`[Thinking ${index + 1}]`));
        // Show first 1000 characters of each thinking block
        const preview = thinking.text.substring(0, 1000);
        const thinkingLines = this.wrapText(preview, this.terminalWidth - 2);
        thinkingLines.forEach(line => lines.push(line));
        if (thinking.text.length > 1000) {
          lines.push(this.theme.formatMuted(`... (${thinking.text.length - 1000} more characters)`));
        }
      });
      
      lines.push('');
    }
    
    // Tool usage details
    if (conversation.toolUses && conversation.toolUses.length > 0) {
      lines.push(this.theme.formatAccent('🔧 TOOLS EXECUTION FLOW:'));
      lines.push(this.theme.formatSeparator(this.terminalWidth, '-'));
      
      // Show detailed tool execution with parameters and results
      conversation.toolUses.forEach((tool, index) => {
        lines.push('');
        lines.push(this.theme.formatInfo(`[${index + 1}] ${tool.toolName}`));
        
        // Show tool parameters
        if (tool.input) {
          // Special formatting for Bash commands
          if (tool.toolName === 'Bash' && tool.input.command) {
            const commandLines = this.wrapText(tool.input.command, this.terminalWidth - 12, 12);
            if (commandLines.length > 0) {
              lines.push(`  ${this.theme.formatMuted('Command:')} ${this.theme.formatAccent(commandLines[0])}`);
              for (let i = 1; i < commandLines.length; i++) {
                lines.push(`            ${this.theme.formatAccent(commandLines[i])}`);
              }
            } else {
              lines.push(`  ${this.theme.formatMuted('Command:')} ${this.theme.formatAccent(tool.input.command)}`);
            }
          } 
          // Special formatting for Read/Write file operations
          else if ((tool.toolName === 'Read' || tool.toolName === 'Write' || tool.toolName === 'Edit') && tool.input.file_path) {
            lines.push(`  ${this.theme.formatMuted('File:')} ${tool.input.file_path}`);
            if (tool.input.old_string) {
              lines.push(`  ${this.theme.formatMuted('Replace:')} "${tool.input.old_string.substring(0, 50)}${tool.input.old_string.length > 50 ? '...' : ''}"`);
            }
            if (tool.input.new_string) {
              lines.push(`  ${this.theme.formatMuted('With:')} "${tool.input.new_string.substring(0, 50)}${tool.input.new_string.length > 50 ? '...' : ''}"`);
            }
          }
          // Special formatting for Grep
          else if (tool.toolName === 'Grep' && tool.input.pattern) {
            lines.push(`  ${this.theme.formatMuted('Pattern:')} ${tool.input.pattern}`);
            if (tool.input.path) {
              lines.push(`  ${this.theme.formatMuted('Path:')} ${tool.input.path}`);
            }
          }
          // Generic formatting for other tools
          else {
            const params = Object.entries(tool.input)
              .filter(([key, value]) => value !== undefined && value !== null)
              .slice(0, 3); // Show max 3 parameters
            
            params.forEach(([key, value]) => {
              let displayValue = typeof value === 'string' ? value : JSON.stringify(value);
              if (displayValue.length > 100) {
                displayValue = displayValue.substring(0, 100) + '...';
              }
              
              // Wrap long values
              const valueLines = this.wrapText(displayValue, this.terminalWidth - key.length - 6, key.length + 6);
              lines.push(`  ${this.theme.formatMuted(key + ':')} ${valueLines[0]}`);
              for (let i = 1; i < valueLines.length; i++) {
                lines.push(`  ${' '.repeat(key.length + 2)}${valueLines[i]}`);
              }
            });
          }
        }
        
        // Show tool result
        if (tool.result !== null && tool.result !== undefined) {
          lines.push('');
          if (tool.isError) {
            lines.push(`  ${this.theme.formatError('❌ Error:')}`);
          } else {
            lines.push(`  ${this.theme.formatSuccess('✅ Result:')}`);
          }
          
          // Format and wrap result based on tool type
          let resultText = tool.result;
          if (typeof resultText === 'object') {
            resultText = JSON.stringify(resultText, null, 2);
          }
          
          // Limit result display to reasonable length
          const maxResultLength = 500;
          if (resultText.length > maxResultLength) {
            resultText = resultText.substring(0, maxResultLength) + `\n${this.theme.formatMuted(`... (${resultText.length - maxResultLength} more characters)`)}`;
          }
          
          const resultLines = this.wrapText(resultText, this.terminalWidth - 4, 4);
          resultLines.forEach(line => lines.push(`  ${line}`));
        }
      });
      
      lines.push('');
    } else if (conversation.toolsUsed && conversation.toolsUsed.length > 0) {
      // Fallback for legacy data
      lines.push(this.theme.formatAccent('🔧 TOOLS USED:'));
      lines.push(this.theme.formatSeparator(40, '-'));
      lines.push(`  ${conversation.toolsUsed.join(', ')}`);
      lines.push('');
    }
    
    // Assistant response
    lines.push(this.theme.formatAccent('🤖 ASSISTANT RESPONSE:'));
    lines.push(this.theme.formatSeparator(this.terminalWidth, '-'));
    
    // Show assistant response (limit to reasonable length for terminal)
    const maxResponseLength = 2000;
    const responseToShow = conversation.assistantResponse.length > maxResponseLength 
      ? conversation.assistantResponse.substring(0, maxResponseLength)
      : conversation.assistantResponse;
    
    const responseLines = this.wrapText(responseToShow, this.terminalWidth - 2);
    responseLines.forEach(line => lines.push(line));
    
    if (conversation.assistantResponse.length > maxResponseLength) {
      lines.push(this.theme.formatMuted(`\n... (${conversation.assistantResponse.length - maxResponseLength} more characters)`));
    }
    
    // Add final spacing
    lines.push('');
    
    return lines;
  }

  /**
   * Render full detail controls
   */
  renderFullDetailControls(canScroll = false) {
    const controls = [];
    
    if (canScroll) {
      controls.push(
        this.theme.formatMuted('↑/↓') + ' 5-line scroll',
        this.theme.formatMuted('Space/b') + ' page',
        this.theme.formatMuted('g/G') + ' top/bottom'
      );
    }
    
    controls.push(
      this.theme.formatMuted('←/→') + ' prev/next conversation',
      this.theme.formatMuted('Esc') + ' back',
      this.theme.formatMuted('q') + ' exit'
    );
    
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
    console.log(this.theme.formatMuted('↑/↓ to navigate, Enter to select, Esc to cancel'));
  }

  /**
   * Render help view
   */
  renderHelp() {
    this.clearScreen();
    
    console.log(this.theme.formatHeader('🔍 CC Lens - Help'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    const sections = [
      {
        title: 'Navigation',
        items: [
          '↑/↓ or k/j    Navigate up/down',
          '←/→ or h/l    Navigate left/right',
          'Enter         Select/Enter view',
          'Esc or q      Back/Exit'
        ]
      },
      {
        title: 'Views',
        items: [
          'Enter         View session details',
          '+/-           Adjust context range',
          'L             Toggle language'
        ]
      },
      {
        title: 'Search & Filter',
        items: [
          '/             Search sessions',
          'f             Filter sessions (project)',
          's             Sort sessions',
          'c             Clear filters'
        ]
      },
      {
        title: 'Actions',
        items: [
          'r             Refresh sessions',
          'b             Bookmark session',
          'e             Export data',
          'h or ?        This help'
        ]
      }
    ];
    
    sections.forEach(section => {
      console.log(this.theme.formatAccent(section.title));
      section.items.forEach(item => {
        console.log(`  ${item}`);
      });
      console.log('');
    });
    
    console.log(this.theme.formatSeparator(this.terminalWidth, '─'));
    console.log(this.theme.formatMuted('Press any key to continue...'));
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
  renderDailyStatistics(dailyStats) {
    this.clearScreen();
    
    // Header
    const title = this.theme.formatHeader('🔍 Claude Code Scope - Daily Statistics');
    console.log(title);
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log('');
    
    // Calculate totals
    const totals = {
      conversationCount: 0,
      totalDuration: 0,
      sessionCount: new Set()
    };
    
    dailyStats.forEach(day => {
      totals.conversationCount += day.conversationCount;
      totals.totalDuration += day.totalDuration;
      day.sessionCount && Array.from({ length: day.sessionCount }).forEach((_, i) => totals.sessionCount.add(`${day.date}-${i}`));
    });
    
    // Summary
    console.log(this.theme.formatHeader('Summary'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(`📊 Total Days: ${this.theme.formatHeader(dailyStats.length.toString())}`);
    console.log(`💼 Total Sessions: ${this.theme.formatHeader(totals.sessionCount.size.toString())}`);
    console.log(`💬 Total Conversations: ${this.theme.formatHeader(totals.conversationCount.toString())}`);
    console.log(`⏱️  Total Duration: ${this.theme.formatHeader(this.theme.formatDuration(totals.totalDuration))}`);
    console.log('');
    
    // Table header
    console.log(this.theme.formatHeader('Daily Breakdown'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    const headers = ['Date', 'Sessions', 'Conversations', 'Duration', 'Avg Duration', 'Tools'];
    const colWidths = [12, 10, 15, 12, 15, 10];
    
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
      
      console.log(line);
    });
    
    console.log('');
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(this.theme.formatDim('Press Ctrl+C to exit'));
  }
}

module.exports = ViewRenderer;