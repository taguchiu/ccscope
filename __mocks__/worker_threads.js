// Mock for worker_threads module

class Worker {
  constructor(filename) {
    this.filename = filename;
    this.listeners = {};
    this.onceListeners = {};
  }
  
  postMessage(data) {
    // Simulate async response
    setTimeout(() => {
      const handler = this.onceListeners['message'] || this.listeners['message'];
      if (handler) {
        // Simulate successful parse with minimal data
        handler({
          success: true,
          result: {
            sessionId: 'test-session',
            fullSessionId: 'test-session',
            projectName: 'test-project',
            projectPath: '/test/path',
            filePath: data,
            conversationPairs: [],
            totalConversations: 0,
            summary: { short: 'Test', detailed: [] },
            duration: 0,
            actualDuration: 0,
            avgResponseTime: 0,
            totalTools: 0,
            startTime: new Date(),
            endTime: new Date(),
            lastActivity: new Date()
          }
        });
        // Clear once listener after calling
        delete this.onceListeners['message'];
      }
    }, 0);
  }
  
  once(event, handler) {
    this.onceListeners[event] = handler;
  }
  
  on(event, handler) {
    this.listeners[event] = handler;
  }
  
  terminate() {
    return Promise.resolve();
  }
}

module.exports = {
  Worker
};