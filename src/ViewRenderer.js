/**
 * ViewRenderer
 * Handles all display logic and view rendering
 */

const config = require('./config');
const path = require('path');

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
          // Calculate ultra-conservative width for message content  
          const prefixWidth = this.theme.getDisplayWidth(prefix);
          const maxMessageLength = this.terminalWidth - prefixWidth - 25; // Large 25 char margin for safety
          let originalMsg = (conv.userContent || conv.userMessage || '').replace(/\n/g, ' ').trim();
          
          // Check if this is a continuation session or contains thinking content
          if (originalMsg.includes('This session is being continued from a previous conversation')) {
            originalMsg = '[Continued] ' + originalMsg.substring(0, 50) + '...';
          } else if (this.containsThinkingContent(originalMsg)) {
            const cleanMsg = this.extractCleanUserMessage(originalMsg);
            originalMsg = cleanMsg || '[Contains tool execution details]';
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
      this.theme.formatMuted('r') + ' resume',
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
    const headerHeight = 8; // Title(1) + separator(1) + stats(1) + blank(1) + headers(2) + separator(1)
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
    const sessionInfo = `Selected: [${session.sessionId}] ${session.projectName}`;
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
    
    // Calculate exact fixed column widths based on actual conversation detail layout
    // Headers: "No." (3) + "DateTime" (12) + "Duration" (8) + "Tools" (6) + spaces
    // Actual row: "  1   07/13 21:41  3m44s      19t  [message content]"
    const exactFixedWidth = 
      2 +     // prefix: "  " or "▶ "
      3 + 1 + // no: "1  " (padEnd 3) + space  
      12 + 1 + // datetime: "07/13 21:41 " (padEnd 12) + space
      8 + 1 +  // duration: "3m44s   " (8 chars by formatResponseTime) + space
      6 + 1;   // tools: "  19t " (6 chars by formatToolCount) + space
    
    // Use ultra-conservative width to absolutely prevent wrapping
    // Reserve huge margin for ANSI codes, numbered lists, complex Japanese text, and calculation errors
    const targetMessageWidth = this.terminalWidth - exactFixedWidth - 50;
    
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
    const rawContent = `${no} ${dateTime} ${response.replace(/\x1b\[[0-9;]*m/g, '')} ${toolCount.replace(/\x1b\[[0-9;]*m/g, '').padEnd(6)} ${userMessage}`;
    
    // Apply selection highlighting
    if (isSelected) {
      // For selected rows, we need plain text values to apply consistent background
      const responseRaw = conversation.responseTime >= 60 
        ? `${Math.floor(conversation.responseTime / 60)}m${Math.floor(conversation.responseTime % 60)}s`
        : `${conversation.responseTime.toFixed(1)}s`;
      const toolCountRaw = `${conversation.toolsUsed.length}t`;
      
      // Build plain content for full-width selection, ensuring it fits within terminal width
      const baseParts = [
        no, 
        dateTime.replace(/\x1b\[[0-9;]*m/g, ''), // Remove any ANSI codes from dateTime
        responseRaw.padEnd(8), 
        toolCountRaw.padStart(5) + ' '
      ];
      const baseContent = baseParts.join(' ');
      
      // Calculate available width for message in selected row
      const baseWidth = this.theme.getDisplayWidth(baseContent);
      const prefixWidth = this.theme.getDisplayWidth(prefix);
      const usedWidth = prefixWidth + baseWidth;
      const messageMaxWidth = Math.max(10, this.terminalWidth - usedWidth - 40); // Ultra-large margin for safety
      
      // Re-truncate message for selected row to ensure it fits
      const selectedMessage = this.truncateWithWidth(userMessage, messageMaxWidth);
      
      const plainContent = baseContent + selectedMessage;
      
      // Calculate padding to fill entire terminal width
      const contentWidth = this.theme.getDisplayWidth(plainContent);
      const totalWidth = prefixWidth + contentWidth;
      const paddingWidth = Math.max(0, this.terminalWidth - totalWidth);
      const padding = ' '.repeat(paddingWidth);
      
      // Apply selection formatting to the entire line including padding
      const fullLine = plainContent + padding;
      
      console.log(prefix + this.theme.formatSelection(fullLine, isSelected));
    } else {
      // For non-selected rows, use colored values but ensure message fits
      const content = `${no} ${dateTime} ${response} ${toolCount} ${userMessage}`;
      
      // Double-check that total line width doesn't exceed terminal width
      const totalLineWidth = this.theme.getDisplayWidth(prefix + content);
      if (totalLineWidth > this.terminalWidth) {
        // Emergency truncation if line is still too long
        const emergencyMaxWidth = this.terminalWidth - exactFixedWidth - 50;
        const emergencyMessage = this.truncateWithWidth(userMessage, emergencyMaxWidth);
        const safeContent = `${no} ${dateTime} ${response} ${toolCount} ${emergencyMessage}`;
        console.log(prefix + safeContent);
      } else {
        console.log(prefix + content);
      }
    }
  }

  /**
   * Truncate string to fit within specified display width
   */
  truncateWithWidth(text, maxWidth) {
    // Clean text of any remaining ANSI codes and control characters
    const cleanText = text
      .replace(/\x1b\[[0-9;]*m/g, '')         // Remove ANSI codes
      .replace(/[\u0000-\u001F]/g, ' ')       // Replace remaining control characters
      .replace(/[\u007F-\u009F]/g, ' ')       // Replace DEL and C1 control characters
      .replace(/\s+/g, ' ')                   // Collapse multiple spaces again
      .trim();
    
    let currentWidth = 0;
    let truncateIndex = 0;
    const ellipsis = '...';
    const ellipsisWidth = 3;
    
    // Calculate total width first, handling surrogate pairs
    let totalWidth = 0;
    for (let i = 0; i < cleanText.length; i++) {
      const code = cleanText.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < cleanText.length) {
        const lowCode = cleanText.charCodeAt(i + 1);
        if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
          totalWidth += 2;
          i++; // Skip low surrogate
          continue;
        }
      }
      totalWidth += this.getCharWidth(cleanText[i]);
    }
    
    // Return original if it fits
    if (totalWidth <= maxWidth) {
      return cleanText;
    }
    
    // Use ultra-conservative width calculation with large safety buffer
    // Account for potential errors in character width calculation
    const targetMaxWidth = maxWidth - ellipsisWidth - 10; // Extra 10 char safety buffer
    
    for (let i = 0; i < cleanText.length; i++) {
      const code = cleanText.charCodeAt(i);
      let charWidth = 1;
      
      // Handle surrogate pairs properly
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < cleanText.length) {
        const lowCode = cleanText.charCodeAt(i + 1);
        if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
          charWidth = 2;
          if (currentWidth + charWidth > targetMaxWidth) {
            break;
          }
          currentWidth += charWidth;
          truncateIndex = i + 2; // Include both surrogate chars
          i++; // Skip low surrogate
          continue;
        }
      }
      
      charWidth = this.getCharWidth(cleanText[i]);
      
      // Ultra-conservative character width handling
      // Assume any non-ASCII character might be wider than calculated
      if (cleanText.charCodeAt(i) > 127) {
        charWidth = Math.max(charWidth, 2); // Assume at least 2-width for non-ASCII
      }
      
      if (currentWidth + charWidth > targetMaxWidth) {
        break;
      }
      currentWidth += charWidth;
      truncateIndex = i + 1;
    }
    
    const truncated = cleanText.substring(0, truncateIndex) + ellipsis;
    
    // Return truncated with ellipsis
    return truncated;
  }

  /**
   * Get character width (1 for half-width, 2 for full-width)
   */
  getCharWidth(char) {
    const code = char.charCodeAt(0);
    
    // Check for emoji sequences (surrogate pairs) - always width 2
    if (code >= 0xD800 && code <= 0xDBFF) {
      return 2;
    }
    
    // Specific problematic characters that appear in the display
    const specificWideChars = {
      0x23FA: 2, // ⏺ Record button
      0x23BF: 2, // ⎿ Horizontal scan line
      0x1F527: 2, // 🔧 Wrench
      0x1F4CA: 2, // 📊 Bar chart
      0x1F4C5: 2, // 📅 Calendar
      0x1F4C1: 2, // 📁 Folder
      0x1F4C4: 2, // 📄 Document
      0x1F4DD: 2, // 📝 Memo
      0x2B06: 2, // ⬆ Up arrow
      0x2B07: 2, // ⬇ Down arrow
      0x25B6: 2, // ▶ Play button
      0x25C0: 2, // ◀ Reverse button
      0x2705: 2, // ✅ Check mark
      0x274C: 2, // ❌ Cross mark
      0x26A0: 2, // ⚠ Warning
      0x2139: 2, // ℹ Information
    };
    
    if (specificWideChars[code]) {
      return specificWideChars[code];
    }
    
    // Extended emoji and symbol ranges - be more conservative (assume width 2)
    if ((code >= 0x2600 && code <= 0x27BF) || // Miscellaneous Symbols
        (code >= 0x1F300 && code <= 0x1F6FF) || // Miscellaneous Symbols and Pictographs
        (code >= 0x1F900 && code <= 0x1F9FF) || // Supplemental Symbols and Pictographs
        (code >= 0x1F000 && code <= 0x1F02F) || // Mahjong/Domino Tiles
        (code >= 0x2300 && code <= 0x23FF) || // Miscellaneous Technical
        (code >= 0x2000 && code <= 0x206F) || // General Punctuation
        (code >= 0x25A0 && code <= 0x25FF) || // Geometric Shapes
        (code >= 0x2190 && code <= 0x21FF) || // Arrows
        (code >= 0x1F780 && code <= 0x1F7FF) || // Geometric Shapes Extended
        (code >= 0x1F1E6 && code <= 0x1F1FF) || // Regional Indicator Symbols
        (code >= 0x1F700 && code <= 0x1F77F) || // Alchemical Symbols
        (code >= 0x1F800 && code <= 0x1F8FF)) { // Supplemental Arrows-C
      return 2;
    }
    
    // Comprehensive full-width character detection
    if ((code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
        (code >= 0x2E80 && code <= 0x9FFF) || // CJK (includes Hiragana, Katakana, Kanji)
        (code >= 0xAC00 && code <= 0xD7AF) || // Hangul Syllables
        (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
        (code >= 0xFE30 && code <= 0xFE4F) || // CJK Compatibility Forms
        (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
        (code >= 0xFFE0 && code <= 0xFFE6) || // Fullwidth Forms Currency
        (code >= 0x3000 && code <= 0x303F) || // CJK Symbols and Punctuation
        (code >= 0x3040 && code <= 0x309F) || // Hiragana
        (code >= 0x30A0 && code <= 0x30FF) || // Katakana
        (code >= 0x2018 && code <= 0x201F) || // Quotation marks
        (code >= 0x2010 && code <= 0x2017)) { // Dashes and punctuation
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
    
    // Check if we need to highlight search terms
    const highlightQuery = this.state.highlightQuery;
    const highlightOptions = this.state.highlightOptions || {};
    
    // User message (truncate to fit one line considering display width)
    let userMessage = conversation.userMessage.replace(/\n/g, ' ').trim();
    let userPrefix = '👤 ';
    
    // Check if this is a continuation session or contains thinking content
    if (conversation.userMessage && conversation.userMessage.includes('This session is being continued from a previous conversation')) {
      userPrefix = '🔗 ';  // Chain link emoji to indicate continuation
      userMessage = '[Continued session] ' + (userMessage.length > 100 ? userMessage.substring(0, 100) + '...' : userMessage);
    } else if (this.containsThinkingContent(conversation.userMessage)) {
      // Extract just the user message part
      const cleanMessage = this.extractCleanUserMessage(conversation.userMessage);
      userMessage = cleanMessage || '[Contains tool execution details]';
    }
    
    const userPrefixWidth = this.theme.getDisplayWidth(userPrefix);
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
    const assistantPrefixWidth = this.theme.getDisplayWidth(assistantPrefix);
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
      const toolsPrefixWidth = this.theme.getDisplayWidth(toolsPrefix);
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
          const thinkingPrefixWidth = this.theme.getDisplayWidth(thinkingPrefix);
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
    
    const lines = text.split('\n');
    const userMessageLines = [];
    
    for (const line of lines) {
      // Stop when we hit assistant response markers or thinking content
      if (line.includes('🔧 TOOLS EXECUTION FLOW:') ||
          line.includes('🧠 THINKING PROCESS:') ||
          line.includes('🤖 ASSISTANT') ||
          line.includes('⏺ Thinking') ||
          line.includes('⏺ Edit') ||
          line.includes('⏺ Read') ||
          line.includes('⏺ Write') ||
          line.includes('⏺ Bash') ||
          line.includes('⏺ Task') ||
          line.includes('⏺ TodoWrite') ||
          line.includes('⏺ Grep') ||
          line.includes('⏺ Glob') ||
          line.includes('⏺ MultiEdit') ||
          line.match(/^\s*\[Thinking \d+\]/) ||
          line.match(/^\s*\[\d+\]\s+\w+/) ||
          line.match(/^\s*\d+│/) ||
          line.includes('file:') ||
          line.includes('File:') ||
          line.includes('Command:') ||
          line.includes('pattern:') ||
          line.includes('path:') ||
          line.includes('⎿')) {
        break;
      }
      
      // Skip lines that look like assistant responses
      if (line.trim().startsWith('Looking at') ||
          line.trim().startsWith('I need to') ||
          line.trim().startsWith('Let me') ||
          line.trim().startsWith('I\'ll') ||
          line.trim().startsWith('I will') ||
          line.trim().startsWith('First,') ||
          line.trim().startsWith('Based on')) {
        break;
      }
      
      userMessageLines.push(line);
    }
    
    return userMessageLines.join(' ').replace(/\s+/g, ' ').trim();
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
      this.theme.formatMuted('↑/↓/wheel') + ' to select conversation',
      this.theme.formatMuted('Enter') + ' to view detail',
      this.theme.formatMuted('←/→') + ' switch session',
      this.theme.formatMuted('r') + ' resume',
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
    const indicatorLength = this.theme.getDisplayWidth(indicator);
    const availableWidth = this.terminalWidth - indicatorLength - 2; // 2 spaces padding
    
    // Don't truncate the title - let it show completely
    let displayTitle = title;
    
    // Build line with title on left, indicator on right
    const titleFormatted = this.theme.formatHeader(displayTitle);
    const indicatorFormatted = this.theme.formatMuted(indicator);
    
    // Calculate actual lengths after formatting
    const actualTitleLength = this.theme.getDisplayWidth(displayTitle);
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
    lines.push(`📅 ${this.theme.formatDateTime(conversation.timestamp)}`);
    lines.push(`⏱️  Response Time: ${this.theme.formatResponseTime(conversation.responseTime)}`);
    
    // User message section
    lines.push('');
    lines.push(this.theme.formatAccent('👤 USER'));
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
    lines.push(this.theme.formatDim('─'.repeat(Math.min(40, this.theme.getDisplayWidth(title)))));
    
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
        const wordWidth = this.theme.getDisplayWidth(word);
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
                const charWidth = this.getCharWidth(charCode);
                
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
   * Get character width (1 for half-width, 2 for full-width)
   */
  getCharWidth(charCode) {
    // Full-width characters
    if ((charCode >= 0x1100 && charCode <= 0x115F) || // Hangul Jamo
        (charCode >= 0x2E80 && charCode <= 0x9FFF) || // CJK
        (charCode >= 0xAC00 && charCode <= 0xD7AF) || // Hangul Syllables
        (charCode >= 0xF900 && charCode <= 0xFAFF) || // CJK Compatibility
        (charCode >= 0xFE30 && charCode <= 0xFE4F) || // CJK Compatibility Forms
        (charCode >= 0xFF00 && charCode <= 0xFF60) || // Fullwidth Forms
        (charCode >= 0xFFE0 && charCode <= 0xFFE6) || // Fullwidth Forms
        (charCode >= 0x3000 && charCode <= 0x303F) || // CJK Symbols
        (charCode >= 0x2018 && charCode <= 0x201F)) { // Quotation marks
      return 2;
    }
    
    // Emoji and symbols (simplified check)
    if ((charCode >= 0x2600 && charCode <= 0x27BF) || // Miscellaneous Symbols
        (charCode >= 0x1F300 && charCode <= 0x1F6FF) || // Misc Symbols and Pictographs
        (charCode >= 0x1F900 && charCode <= 0x1F9FF)) { // Supplemental Symbols
      return 2;
    }
    
    return 1;
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
      lines.push('');
      
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
      contentLines.forEach((line, lineIndex) => {
        // Add line numbers for very long thinking sections
        if (contentLines.length > 20 && lineIndex % 10 === 0 && lineIndex > 0) {
          lines.push(this.theme.formatDim(`    [line ${lineIndex}]`));
        }
        lines.push('    ' + line);
      });
      
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
        if (item.type === 'thinking' && item.thinking) {
          // Add thinking section - Claude Code style
          lines.push('');
          lines.push(this.theme.formatWarning('⏺ Thinking'));
          lines.push('');
          
          // Apply search highlighting if needed
          const thinkingText = highlightQuery ? this.highlightText(item.thinking, highlightQuery, highlightOptions) : item.thinking;
          
          // Display thinking content with proper indentation
          const contentLines = this.wrapTextWithWidth(thinkingText, this.terminalWidth - 4);
          contentLines.forEach(line => {
            lines.push('  ' + line);
          });
          
        } else if (item.type === 'tool_use') {
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
          const toolTime = item.timestamp ? this.theme.formatDateTime(item.timestamp) : '';
          if (toolTime) {
            toolHeader += ` ${this.theme.formatDim(`[${toolTime}]`)}`;
          }
          
          lines.push(this.theme.formatSuccess(toolHeader));
          
          // Format tool input details
          const toolInputLines = this.formatToolInput({ toolName: item.name, input: item.input });
          const inputToolId = `input-${item.id || index}`;
          const isInputExpanded = this.state.isToolExpanded(inputToolId);
          
          // Set current tool for Ctrl+R focus
          this.state.setCurrentToolId(inputToolId);
          
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
            
            // Set current tool for Ctrl+R focus
            this.state.setCurrentToolId(toolId);
            
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
          lines.push(this.theme.formatWarning('⏺ Thinking'));
          lines.push('');
          
          const thinkingText = highlightQuery ? this.highlightText(thinking.text, highlightQuery, highlightOptions) : thinking.text;
          const contentLines = this.wrapTextWithWidth(thinkingText, this.terminalWidth - 4);
          contentLines.forEach(line => {
            lines.push('  ' + line);
          });
        });
      }
      
      // Tool usage section
      if (conversation.toolUses && conversation.toolUses.length > 0) {
        conversation.toolUses.forEach(tool => {
          lines.push('');
          
          // Format timestamp
          const toolTime = tool.timestamp ? this.theme.formatDateTime(tool.timestamp) : '';
          let toolHeader = `⏺ ${tool.toolName}`;
          if (tool.input) {
            const keyParams = this.getKeyParams(tool.toolName, tool.input);
            if (keyParams) {
              toolHeader += `(${keyParams})`;
            }
          }
          if (toolTime) {
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
        return input.command ? input.command.substring(0, 30) + (input.command.length > 30 ? '...' : '') : '';
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
      
      // Check if this line starts a tool block
      if (line.match(/^⏺\s+\w+/)) {
        // Found a tool header
        outputLines.push(line);
        i++;
        
        // Debug: Log what we're processing
        if (config.debug && config.debug.enabled) {
          console.log(`Found tool block at line ${i}, next line: "${responseLines[i] || 'EOF'}"`);
        }
        
        // Look for the indented block with ⎿ (allow spaces before it)
        if (i < responseLines.length && responseLines[i].includes('⎿')) {
          const blockStart = i;
          let blockEnd = i + 1; // Start from the next line after ⎿
          
          // Find the end of the block
          while (blockEnd < responseLines.length) {
            const blockLine = responseLines[blockEnd];
            // Stop if we hit an empty line, another tool header, or a line that doesn't look like part of the block
            if (blockLine.trim() === '' || 
                blockLine.match(/^⏺/) || 
                blockLine.match(/^[A-Z]/) || // New line starting with capital letter
                (!blockLine.match(/^\s+/) && !blockLine.includes('...'))) {
              break;
            }
            blockEnd++;
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
              this.state.setCurrentToolId(blockId);
            }
          } else {
            // Show first 20 lines and collapse indicator
            for (let j = 0; j < 20 && j < blockLines.length; j++) {
              outputLines.push(blockLines[j]);
            }
            const remainingLines = blockLines.length - 20;
            outputLines.push(`     … +${remainingLines} lines (ctrl+r to expand)`);
            // Set current block for Ctrl+R
            this.state.setCurrentToolId(blockId);
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
      this.theme.formatMuted('↑/↓') + ' 5-line scroll',
      this.theme.formatMuted('Space/b') + ' page',
      this.theme.formatMuted('g/G') + ' top/bottom'
    );
    
    controls.push(
      this.theme.formatMuted('←/→') + ' prev/next conversation',
      this.theme.formatMuted('r') + ' resume',
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
    
    console.log(this.theme.formatAccent('CCScope Help'));
    console.log(this.theme.formatDim('─'.repeat(20)));
    console.log('');
    
    const sections = [
      {
        title: 'Navigation',
        items: [
          '↑/↓ k/j       Navigate up/down',
          '←/→ h/l       Navigate left/right',
          'Mouse wheel   Scroll up/down (all views)',
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
      totalDuration: 0
    };
    
    dailyStats.forEach(day => {
      totals.conversationCount += day.conversationCount;
      totals.totalDuration += day.totalDuration;
    });
    
    // Summary
    console.log(this.theme.formatHeader('Summary'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(`📊 Total Days: ${this.theme.formatHeader(dailyStats.length.toString())}`);
    console.log(`💼 Total Sessions: ${this.theme.formatHeader(totalSessions.toString())}`);
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
      totalDuration: projectStats.reduce((sum, p) => sum + p.totalDuration, 0)
    };
    
    // Summary
    console.log(this.theme.formatHeader('Summary'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    console.log(`📁 Total Projects: ${this.theme.formatHeader(projectStats.length.toString())}`);
    console.log(`💼 Total Sessions: ${this.theme.formatHeader(totals.sessionCount.toString())}`);
    console.log(`💬 Total Conversations: ${this.theme.formatHeader(totals.conversationCount.toString())}`);
    console.log(`⏱️  Total Duration: ${this.theme.formatHeader(this.theme.formatDuration(totals.totalDuration))}`);
    console.log('');
    
    // Table header
    console.log(this.theme.formatHeader('Project Breakdown'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    const headers = ['Project', 'Sessions', 'Conversations', 'Duration', 'Avg Duration', 'Tools'];
    const colWidths = [70, 10, 15, 12, 14, 10];
    
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
      line += project.sessionCount.toString().padEnd(colWidths[1]);
      line += project.conversationCount.toString().padEnd(colWidths[2]);
      line += this.theme.formatDuration(project.totalDuration).padEnd(colWidths[3]);
      
      // Calculate average duration
      const avgDuration = project.conversationCount > 0 ? project.totalDuration / project.conversationCount : 0;
      line += this.theme.formatDuration(avgDuration).padEnd(colWidths[4]);
      
      line += (project.toolUsageCount || 0).toString().padEnd(colWidths[5]);
      
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
    
    // Results summary and controls
    console.log(this.theme.formatHeader(`Found ${searchResults.length} matches`));
    console.log(this.theme.formatDim('↑/↓: Navigate • Enter: View Detail • Esc: Back'));
    console.log(this.theme.formatSeparator(this.terminalWidth));
    
    if (searchResults.length === 0) {
      console.log(this.theme.formatMuted('No matches found.'));
      return;
    }
    
    // Calculate visible range
    const headerLines = 7; // Lines used by header
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
      const displayWidth = this.theme.getDisplayWidth(this.theme.stripAnsiCodes(contextLine));
      
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
    
    // Use same controls as conversation detail
    const controls = [
      this.theme.formatMuted('↑/↓') + ' to select result',
      this.theme.formatMuted('Enter') + ' to view detail',
      this.theme.formatMuted('←/→') + ' navigate results',
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
    
    if (this.theme.getDisplayWidth(strippedText) <= maxWidth) {
      return text;
    }
    
    // Binary search for the right length
    let left = 0;
    let right = strippedText.length;
    let result = '';
    
    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      const substr = strippedText.substring(0, mid);
      
      if (this.theme.getDisplayWidth(substr) <= maxWidth) {
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

}

module.exports = ViewRenderer;