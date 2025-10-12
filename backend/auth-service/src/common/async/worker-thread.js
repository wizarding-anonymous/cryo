const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');

const workerId = workerData.workerId;

// Worker task handlers
const taskHandlers = {
  // Password hashing (CPU intensive)
  'hash-password': async (payload) => {
    const bcrypt = require('bcrypt');
    const { password, saltRounds = 10 } = payload;
    return await bcrypt.hash(password, saltRounds);
  },

  // Password comparison (CPU intensive)
  'compare-password': async (payload) => {
    const bcrypt = require('bcrypt');
    const { password, hash } = payload;
    return await bcrypt.compare(password, hash);
  },

  // Token hashing for secure storage
  'hash-token': async (payload) => {
    const { token } = payload;
    return crypto.createHash('sha256').update(token).digest('hex');
  },

  // Bulk token hashing
  'hash-tokens-batch': async (payload) => {
    const { tokens } = payload;
    return tokens.map(token => 
      crypto.createHash('sha256').update(token).digest('hex')
    );
  },

  // Data encryption (CPU intensive)
  'encrypt-data': async (payload) => {
    const { data, key } = payload;
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  },

  // Data decryption (CPU intensive)
  'decrypt-data': async (payload) => {
    const { encryptedData, key } = payload;
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  },

  // JSON processing (memory intensive)
  'process-large-json': async (payload) => {
    const { jsonData, operation } = payload;
    
    switch (operation) {
      case 'parse':
        return JSON.parse(jsonData);
      case 'stringify':
        return JSON.stringify(jsonData);
      case 'validate':
        try {
          JSON.parse(jsonData);
          return { valid: true };
        } catch (error) {
          return { valid: false, error: error.message };
        }
      default:
        throw new Error(`Unknown JSON operation: ${operation}`);
    }
  },

  // Session data processing
  'process-session-data': async (payload) => {
    const { sessions, operation } = payload;
    
    switch (operation) {
      case 'cleanup-expired':
        const now = Date.now();
        return sessions.filter(session => 
          new Date(session.expiresAt).getTime() > now
        );
      
      case 'aggregate-stats':
        return {
          total: sessions.length,
          active: sessions.filter(s => s.isActive).length,
          expired: sessions.filter(s => 
            new Date(s.expiresAt).getTime() <= Date.now()
          ).length,
          byUserAgent: sessions.reduce((acc, s) => {
            acc[s.userAgent] = (acc[s.userAgent] || 0) + 1;
            return acc;
          }, {}),
        };
      
      default:
        throw new Error(`Unknown session operation: ${operation}`);
    }
  },

  // Security analysis (CPU intensive)
  'analyze-security-events': async (payload) => {
    const { events, analysisType } = payload;
    
    switch (analysisType) {
      case 'detect-patterns':
        // Simple pattern detection
        const patterns = {};
        events.forEach(event => {
          const key = `${event.type}_${event.ipAddress}`;
          patterns[key] = (patterns[key] || 0) + 1;
        });
        
        return Object.entries(patterns)
          .filter(([, count]) => count > 5) // Suspicious if more than 5 events
          .map(([pattern, count]) => ({ pattern, count, suspicious: true }));
      
      case 'risk-score':
        // Calculate risk score based on event frequency and types
        const riskFactors = {
          'failed_login': 3,
          'suspicious_activity': 5,
          'brute_force_attack': 10,
          'login': 1,
          'logout': 0,
        };
        
        return events.reduce((score, event) => {
          return score + (riskFactors[event.type] || 1);
        }, 0);
      
      default:
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }
  },

  // Batch operations
  'batch-operation': async (payload) => {
    const { operations, batchSize = 100 } = payload;
    const results = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (op) => {
          const handler = taskHandlers[op.type];
          if (!handler) {
            throw new Error(`Unknown operation type: ${op.type}`);
          }
          return await handler(op.payload);
        })
      );
      results.push(...batchResults);
    }
    
    return results;
  },
};

// Handle messages from main thread
parentPort.on('message', async (message) => {
  const { taskId, type, payload } = message;
  const startTime = Date.now();
  
  try {
    // Find and execute task handler
    const handler = taskHandlers[type];
    if (!handler) {
      throw new Error(`Unknown task type: ${type}`);
    }
    
    const result = await handler(payload);
    const processingTime = Date.now() - startTime;
    
    // Send success result back to main thread
    parentPort.postMessage({
      taskId,
      success: true,
      result,
      processingTime,
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Send error result back to main thread
    parentPort.postMessage({
      taskId,
      success: false,
      error: error.message,
      processingTime,
    });
  }
});

// Handle worker errors
process.on('uncaughtException', (error) => {
  console.error(`Worker ${workerId} uncaught exception:`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`Worker ${workerId} unhandled rejection at:`, promise, 'reason:', reason);
  process.exit(1);
});

// Signal that worker is ready
parentPort.postMessage({
  type: 'worker-ready',
  workerId,
  timestamp: new Date().toISOString(),
});