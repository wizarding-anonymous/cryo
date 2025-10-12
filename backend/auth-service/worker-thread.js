const { parentPort, workerData } = require('worker_threads');

const workerId = workerData?.workerId || 'unknown';

// Handle messages from main thread
parentPort.on('message', async (message) => {
  const { taskId, type, payload } = message;
  const startTime = Date.now();

  try {
    let result;

    // Process different task types
    switch (type) {
      case 'heavy_computation':
        result = await performHeavyComputation(payload);
        break;
      
      case 'data_processing':
        result = await processData(payload);
        break;
      
      case 'file_operation':
        result = await performFileOperation(payload);
        break;
      
      case 'crypto_operation':
        result = await performCryptoOperation(payload);
        break;
      
      default:
        throw new Error(`Unknown task type: ${type}`);
    }

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

/**
 * Perform heavy computational tasks
 */
async function performHeavyComputation(payload) {
  const { operation, data } = payload;

  switch (operation) {
    case 'fibonacci':
      return calculateFibonacci(data.n);
    
    case 'prime_check':
      return isPrime(data.number);
    
    case 'sort_large_array':
      return data.array.sort((a, b) => a - b);
    
    case 'matrix_multiplication':
      return multiplyMatrices(data.matrix1, data.matrix2);
    
    default:
      throw new Error(`Unknown computation operation: ${operation}`);
  }
}

/**
 * Process data transformations
 */
async function processData(payload) {
  const { operation, data } = payload;

  switch (operation) {
    case 'json_parse':
      return JSON.parse(data.jsonString);
    
    case 'csv_parse':
      return parseCsv(data.csvString);
    
    case 'data_validation':
      return validateData(data.records, data.schema);
    
    case 'data_transformation':
      return transformData(data.records, data.transformRules);
    
    default:
      throw new Error(`Unknown data processing operation: ${operation}`);
  }
}

/**
 * Perform file operations
 */
async function performFileOperation(payload) {
  const fs = require('fs').promises;
  const path = require('path');
  const { operation, data } = payload;

  switch (operation) {
    case 'read_file':
      return await fs.readFile(data.filePath, 'utf8');
    
    case 'write_file':
      await fs.writeFile(data.filePath, data.content, 'utf8');
      return { success: true };
    
    case 'process_log_file':
      return await processLogFile(data.filePath, data.filters);
    
    default:
      throw new Error(`Unknown file operation: ${operation}`);
  }
}

/**
 * Perform cryptographic operations
 */
async function performCryptoOperation(payload) {
  const crypto = require('crypto');
  const { operation, data } = payload;

  switch (operation) {
    case 'hash':
      return crypto.createHash(data.algorithm).update(data.input).digest('hex');
    
    case 'encrypt':
      return encryptData(data.input, data.key, data.algorithm);
    
    case 'decrypt':
      return decryptData(data.input, data.key, data.algorithm);
    
    case 'generate_key':
      return crypto.randomBytes(data.length).toString('hex');
    
    default:
      throw new Error(`Unknown crypto operation: ${operation}`);
  }
}

// Helper functions

function calculateFibonacci(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

function multiplyMatrices(matrix1, matrix2) {
  const rows1 = matrix1.length;
  const cols1 = matrix1[0].length;
  const cols2 = matrix2[0].length;
  
  const result = Array(rows1).fill().map(() => Array(cols2).fill(0));
  
  for (let i = 0; i < rows1; i++) {
    for (let j = 0; j < cols2; j++) {
      for (let k = 0; k < cols1; k++) {
        result[i][j] += matrix1[i][k] * matrix2[k][j];
      }
    }
  }
  
  return result;
}

function parseCsv(csvString) {
  const lines = csvString.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index];
    });
    return obj;
  });
}

function validateData(records, schema) {
  return records.map(record => {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = record[field];
      
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`Field ${field} is required`);
      }
      
      if (value !== undefined && rules.type && typeof value !== rules.type) {
        errors.push(`Field ${field} must be of type ${rules.type}`);
      }
      
      if (rules.minLength && value && value.length < rules.minLength) {
        errors.push(`Field ${field} must be at least ${rules.minLength} characters`);
      }
    }
    
    return { record, valid: errors.length === 0, errors };
  });
}

function transformData(records, transformRules) {
  return records.map(record => {
    const transformed = { ...record };
    
    for (const [field, rule] of Object.entries(transformRules)) {
      if (rule.type === 'uppercase') {
        transformed[field] = record[field]?.toUpperCase();
      } else if (rule.type === 'lowercase') {
        transformed[field] = record[field]?.toLowerCase();
      } else if (rule.type === 'number') {
        transformed[field] = Number(record[field]);
      } else if (rule.type === 'date') {
        transformed[field] = new Date(record[field]);
      }
    }
    
    return transformed;
  });
}

async function processLogFile(filePath, filters) {
  const fs = require('fs').promises;
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');
  
  let filteredLines = lines;
  
  if (filters.level) {
    filteredLines = filteredLines.filter(line => 
      line.toLowerCase().includes(filters.level.toLowerCase())
    );
  }
  
  if (filters.dateRange) {
    const { start, end } = filters.dateRange;
    filteredLines = filteredLines.filter(line => {
      const dateMatch = line.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        const lineDate = new Date(dateMatch[0]);
        return lineDate >= new Date(start) && lineDate <= new Date(end);
      }
      return false;
    });
  }
  
  return {
    totalLines: lines.length,
    filteredLines: filteredLines.length,
    lines: filteredLines,
  };
}

function encryptData(input, key, algorithm = 'aes-256-cbc') {
  const crypto = require('crypto');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(input, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
  };
}

function decryptData(encryptedData, key, algorithm = 'aes-256-cbc') {
  const crypto = require('crypto');
  const decipher = crypto.createDecipher(algorithm, key);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Handle worker termination
process.on('SIGTERM', () => {
  console.log(`Worker ${workerId} received SIGTERM, shutting down gracefully`);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(`Worker ${workerId} received SIGINT, shutting down gracefully`);
  process.exit(0);
});

console.log(`Worker ${workerId} started and ready to process tasks`);