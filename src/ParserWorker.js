/**
 * ParserWorker
 * Worker thread for parallel file parsing
 */

const { parentPort } = require('worker_threads');
const fs = require('fs');
const FastParser = require('./FastParser');
const QuickParser = require('./QuickParser');
const ProjectExtractor = require('./services/ProjectExtractor');
const ContentExtractor = require('./services/ContentExtractor');
const ConversationBuilder = require('./services/ConversationBuilder');
const SessionStatisticsCalculator = require('./services/SessionStatisticsCalculator');

// Initialize services
const fastParser = new FastParser();
const quickParser = new QuickParser();
const projectExtractor = new ProjectExtractor();
const contentExtractor = new ContentExtractor();
const sessionCalculator = new SessionStatisticsCalculator();
const conversationBuilder = new ConversationBuilder(contentExtractor, fastParser);

// Generate hash for session ID
function generateHash(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// Extract session ID
function extractSessionId(entries) {
  for (const entry of entries) {
    if (entry.session_id) return entry.session_id;
    if (entry.conversation_id) return entry.conversation_id;
  }
  
  const content = JSON.stringify(entries.slice(0, 3));
  const hash = generateHash(content);
  return hash.substring(0, 8);
}

// Extract full session ID from filename
function extractFullSessionId(filePath) {
  const path = require('path');
  const filename = path.basename(filePath);
  
  // Look for UUID pattern
  const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
  const match = filename.match(uuidPattern);
  
  if (match) {
    return match[1];
  }
  
  // Look for other long ID patterns
  const hexPattern = /([a-f0-9]{32,})/i;
  const hexMatch = filename.match(hexPattern);
  
  if (hexMatch) {
    return hexMatch[1];
  }
  
  return null;
}

// Quick pre-scan to check if file has valid content
function quickPreScan(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(0, 10); // Check first 10 lines
    
    let hasUser = false;
    let hasAssistant = false;
    
    for (const line of lines) {
      if (line.includes('"type":"user"')) hasUser = true;
      if (line.includes('"type":"assistant"')) hasAssistant = true;
      if (hasUser && hasAssistant) return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// Parse a single file
async function parseFile(filePath) {
  try {
    // Quick pre-scan
    if (!quickPreScan(filePath)) {
      return null;
    }
    
    const { entries, firstEntry } = await fastParser.parseFile(filePath);
    
    if (entries.length === 0) return null;
    
    const sessionId = extractSessionId(entries);
    const fullSessionId = extractFullSessionId(filePath);
    const projectName = projectExtractor.extractProjectName(entries, filePath);
    const projectPath = projectExtractor.extractProjectPathOptimized(filePath, projectName, firstEntry);
    
    const conversationPairs = conversationBuilder.buildConversationPairs(entries);
    
    if (conversationPairs.length === 0) return null;
    
    const metrics = sessionCalculator.calculateSessionMetrics(conversationPairs);
    const summary = sessionCalculator.generateSessionSummary(conversationPairs);
    
    return {
      sessionId,
      fullSessionId: fullSessionId || sessionId,
      projectName,
      projectPath,
      filePath,
      conversationPairs,
      totalConversations: conversationPairs.length,
      summary,
      ...metrics
    };
    
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error.message}`);
  }
}

// Listen for messages from main thread
parentPort.on('message', async (filePath) => {
  try {
    const result = await parseFile(filePath);
    parentPort.postMessage({ success: true, result });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
});