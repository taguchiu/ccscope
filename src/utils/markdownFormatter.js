/**
 * Markdown formatter for terminal display
 * Converts markdown syntax to terminal escape codes
 */

class MarkdownFormatter {
  constructor(themeManager) {
    this.theme = themeManager;
  }

  /**
   * Format markdown text for terminal display
   * @param {string} text - The markdown text to format
   * @returns {string} - Formatted text with terminal escape codes
   */
  format(text) {
    if (!text) return '';
    
    let formatted = text;
    
    // Process in order to avoid conflicts
    
    // 1. Code blocks (```...```) - process first to avoid formatting inside
    formatted = this.formatCodeBlocks(formatted);
    
    // 2. Inline code (`...`) - process before other inline styles
    formatted = this.formatInlineCode(formatted);
    
    // 3. Bold (**...**) 
    formatted = this.formatBold(formatted);
    
    // 4. Italic (*...*)
    formatted = this.formatItalic(formatted);
    
    // 5. Headers (# Header)
    formatted = this.formatHeaders(formatted);
    
    // 6. Lists (- item or * item)
    formatted = this.formatLists(formatted);
    
    // 7. Blockquotes (> quote)
    formatted = this.formatBlockquotes(formatted);
    
    // 8. Links [text](url)
    formatted = this.formatLinks(formatted);
    
    // 9. Horizontal rules (---)
    formatted = this.formatHorizontalRules(formatted);
    
    // 10. File paths
    formatted = this.formatFilePaths(formatted);
    
    return formatted;
  }

  /**
   * Format bold text
   * @param {string} text
   * @returns {string}
   */
  formatBold(text) {
    // Match **text** but not inside code blocks or inline code
    return text.replace(/(?<!`)\*\*([^*]+)\*\*(?!`)/g, (match, content) => {
      return '\x1b[1m' + content + '\x1b[22m'; // Bold on/off
    });
  }

  /**
   * Format italic text
   * @param {string} text
   * @returns {string}
   */
  formatItalic(text) {
    // Match *text* but not **text** and not inside code
    // Use negative lookbehind/lookahead to avoid matching bold
    return text.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, (match, content) => {
      return '\x1b[3m' + content + '\x1b[23m'; // Italic on/off
    });
  }

  /**
   * Format inline code
   * @param {string} text
   * @returns {string}
   */
  formatInlineCode(text) {
    return text.replace(/`([^`]+)`/g, (match, code) => {
      // Use dim/muted style for inline code
      return this.theme.formatMuted(code);
    });
  }

  /**
   * Format code blocks
   * @param {string} text
   * @returns {string}
   */
  formatCodeBlocks(text) {
    return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const lines = code.trimEnd().split('\n');
      const formattedLines = lines.map(line => {
        return '  ' + this.theme.formatDim(line);
      });
      
      // Add language indicator if present
      if (lang) {
        formattedLines.unshift(this.theme.formatDim(`  [${lang}]`));
      }
      
      return formattedLines.join('\n');
    });
  }

  /**
   * Format headers
   * @param {string} text
   * @returns {string}
   */
  formatHeaders(text) {
    const lines = text.split('\n');
    const formattedLines = lines.map(line => {
      // H1
      if (line.match(/^# /)) {
        return this.theme.formatHeader(line.substring(2));
      }
      // H2
      else if (line.match(/^## /)) {
        return this.theme.formatAccent(line.substring(3));
      }
      // H3
      else if (line.match(/^### /)) {
        return this.theme.formatSuccess(line.substring(4));
      }
      // H4-H6
      else if (line.match(/^#{4,6} /)) {
        const headerText = line.replace(/^#{4,6} /, '');
        return '\x1b[1m' + headerText + '\x1b[22m'; // Bold
      }
      
      return line;
    });
    
    return formattedLines.join('\n');
  }

  /**
   * Format lists
   * @param {string} text
   * @returns {string}
   */
  formatLists(text) {
    const lines = text.split('\n');
    const formattedLines = lines.map(line => {
      // Unordered lists (- or *)
      if (line.match(/^[\s]*[-*] /)) {
        return line.replace(/^([\s]*)([-*]) /, '$1• ');
      }
      // Ordered lists (1. 2. etc)
      else if (line.match(/^[\s]*\d+\. /)) {
        return line.replace(/^([\s]*)(\d+)\. /, (match, indent, num) => {
          return indent + this.theme.formatInfo(num + '.') + ' ';
        });
      }
      
      return line;
    });
    
    return formattedLines.join('\n');
  }

  /**
   * Format blockquotes
   * @param {string} text
   * @returns {string}
   */
  formatBlockquotes(text) {
    const lines = text.split('\n');
    const formattedLines = lines.map(line => {
      if (line.match(/^> /)) {
        const quotedText = line.substring(2);
        return this.theme.formatDim('│ ' + quotedText);
      }
      return line;
    });
    
    return formattedLines.join('\n');
  }

  /**
   * Format links
   * @param {string} text
   * @returns {string}
   */
  formatLinks(text) {
    // Format [text](url) as underlined text
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
      return '\x1b[4m' + linkText + '\x1b[24m'; // Underline on/off
    });
  }

  /**
   * Format horizontal rules
   * @param {string} text
   * @returns {string}
   */
  formatHorizontalRules(text) {
    const lines = text.split('\n');
    const formattedLines = lines.map(line => {
      if (line.match(/^---+$/)) {
        return this.theme.formatDim('─'.repeat(40));
      }
      return line;
    });
    
    return formattedLines.join('\n');
  }

  /**
   * Format file paths
   * @param {string} text
   * @returns {string}
   */
  formatFilePaths(text) {
    // Match file paths with common extensions
    return text.replace(/\b(\/[^\s]+\.(js|ts|tsx|jsx|py|go|rs|cpp|c|h|java|rb|php|md|json|yml|yaml|xml|html|css|scss|sh|bash))\b/g, (match) => {
      return this.theme.formatInfo(match);
    });
  }

  /**
   * Strip markdown formatting (for search/comparison)
   * @param {string} text
   * @returns {string}
   */
  stripMarkdown(text) {
    if (!text) return '';
    
    let stripped = text;
    
    // Remove code blocks
    stripped = stripped.replace(/```[\s\S]*?```/g, '');
    
    // Remove inline code
    stripped = stripped.replace(/`([^`]+)`/g, '$1');
    
    // Remove bold
    stripped = stripped.replace(/\*\*([^*]+)\*\*/g, '$1');
    
    // Remove italic
    stripped = stripped.replace(/\*([^*]+)\*/g, '$1');
    
    // Remove headers
    stripped = stripped.replace(/^#{1,6} /gm, '');
    
    // Remove links
    stripped = stripped.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // Remove list markers
    stripped = stripped.replace(/^[\s]*[-*] /gm, '');
    stripped = stripped.replace(/^[\s]*\d+\. /gm, '');
    
    // Remove blockquotes
    stripped = stripped.replace(/^> /gm, '');
    
    // Remove horizontal rules
    stripped = stripped.replace(/^---+$/gm, '');
    
    return stripped;
  }
}

module.exports = MarkdownFormatter;