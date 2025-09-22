const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class IntegrationMonitor {
  constructor(options = {}) {
    this.services = options.services || [
      {
        name: 'review-service',
        url: 'http://localhost:3004',
        healthPath: '/api/v1/health',
        critical: true,
      },
      {
        name: 'library-service',
        url: process.env.LIBRARY_SERVICE_URL || 'http://localhost:3001',
        healthPath: '/api/v1/health',
        critical: true,
      },
      {
        name: 'game-catalog-service',
        url: process.env.GAME_CATALOG_SERVICE_URL || 'http://localhost:3002',
        healthPath: '/api/v1/health',
        critical: true,
      },
      {
        name: 'achievement-service',
        url: process.env.ACHIEVEMENT_SERVICE_URL || 'http://localhost:3005',
        healthPath: '/api/v1/health',
        critical: false,
      },
      {
        name: 'notification-service',
        url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006',
        healthPath: '/api/v1/health',
        critical: false,
      },
    ];
    
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.timeout = options.timeout || 5000; // 5 seconds
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second
    
    this.results = new Map();
    this.isRunning = false;
    this.startTime = null;
  }

  async start() {
    console.log('🔍 Starting Integration Monitor');
    console.log(`📊 Monitoring ${this.services.length} services`);
    console.log(`⏱️  Check interval: ${this.checkInterval / 1000}s`);
    console.log(`⏰ Timeout: ${this.timeout / 1000}s`);
    console.log('');

    this.isRunning = true;
    this.startTime = Date.now();

    // Initialize results
    this.services.forEach(service => {
      this.results.set(service.name, {
        status: 'unknown',
        lastCheck: null,
        responseTime: null,
        uptime: 0,
        downtime: 0,
        totalChecks: 0,
        successfulChecks: 0,
        consecutiveFailures: 0,
        lastError: null,
        history: [],
      });
    });

    // Initial check
    await this.checkAllServices();

    // Schedule periodic checks
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.checkAllServices();
        this.printStatus();
      }
    }, this.checkInterval);

    // Print initial status
    this.printStatus();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.stop();
    });

    process.on('SIGTERM', () => {
      this.stop();
    });
  }

  async checkAllServices() {
    const checkPromises = this.services.map(service => 
      this.checkService(service).catch(error => ({
        service: service.name,
        error,
      }))
    );

    await Promise.allSettled(checkPromises);
  }

  async checkService(service) {
    const result = this.results.get(service.name);
    result.totalChecks++;
    result.lastCheck = new Date();

    let lastError = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const startTime = performance.now();
        const response = await this.makeHealthRequest(service);
        const responseTime = performance.now() - startTime;

        // Success
        result.status = 'healthy';
        result.responseTime = Math.round(responseTime);
        result.successfulChecks++;
        result.consecutiveFailures = 0;
        result.lastError = null;
        result.uptime += this.checkInterval;

        // Add to history (keep last 100 checks)
        result.history.push({
          timestamp: new Date(),
          status: 'healthy',
          responseTime: Math.round(responseTime),
          attempt,
        });

        if (result.history.length > 100) {
          result.history.shift();
        }

        return;

      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryAttempts) {
          await this.sleep(this.retryDelay);
        }
      }
    }

    // All attempts failed
    result.status = 'unhealthy';
    result.responseTime = null;
    result.consecutiveFailures++;
    result.lastError = lastError.message;
    result.downtime += this.checkInterval;

    // Add to history
    result.history.push({
      timestamp: new Date(),
      status: 'unhealthy',
      error: lastError.message,
      attempts: this.retryAttempts,
    });

    if (result.history.length > 100) {
      result.history.shift();
    }

    // Log critical service failures
    if (service.critical) {
      console.error(`🚨 CRITICAL: ${service.name} is unhealthy - ${lastError.message}`);
    }
  }

  makeHealthRequest(service) {
    return new Promise((resolve, reject) => {
      const url = new URL(service.healthPath, service.url);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationMonitor/1.0',
          'Accept': 'application/json',
        },
        timeout: this.timeout,
      };

      const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve({ statusCode: res.statusCode, data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  printStatus() {
    console.clear();
    console.log('🔍 INTEGRATION MONITOR STATUS');
    console.log('='.repeat(80));
    
    const now = new Date();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    console.log(`⏱️  Monitor uptime: ${this.formatDuration(uptime)}`);
    console.log(`🕐 Last check: ${now.toLocaleTimeString()}`);
    console.log('');

    // Service status table
    console.log('SERVICE STATUS');
    console.log('-'.repeat(80));
    console.log('Service'.padEnd(20) + 'Status'.padEnd(12) + 'Response'.padEnd(12) + 'Uptime'.padEnd(10) + 'Success Rate'.padEnd(15) + 'Last Error');
    console.log('-'.repeat(80));

    let healthyServices = 0;
    let criticalDown = 0;

    this.services.forEach(service => {
      const result = this.results.get(service.name);
      const successRate = result.totalChecks > 0 ? 
        ((result.successfulChecks / result.totalChecks) * 100).toFixed(1) : '0.0';
      
      const statusIcon = result.status === 'healthy' ? '✅' : 
                        result.status === 'unhealthy' ? '❌' : '❓';
      
      const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
      const uptimePercent = result.totalChecks > 0 ? 
        ((result.successfulChecks / result.totalChecks) * 100).toFixed(1) : '0.0';
      
      const lastError = result.lastError ? 
        (result.lastError.length > 25 ? result.lastError.substring(0, 22) + '...' : result.lastError) : '';

      console.log(
        `${statusIcon} ${service.name}`.padEnd(20) +
        result.status.padEnd(12) +
        responseTime.padEnd(12) +
        `${uptimePercent}%`.padEnd(10) +
        `${successRate}%`.padEnd(15) +
        lastError
      );

      if (result.status === 'healthy') {
        healthyServices++;
      } else if (service.critical) {
        criticalDown++;
      }
    });

    console.log('');
    console.log('OVERALL SYSTEM STATUS');
    console.log('-'.repeat(40));
    
    if (criticalDown === 0) {
      console.log('🟢 System Status: HEALTHY');
    } else {
      console.log(`🔴 System Status: DEGRADED (${criticalDown} critical services down)`);
    }
    
    console.log(`📊 Services: ${healthyServices}/${this.services.length} healthy`);
    
    // Integration test results
    console.log('');
    console.log('INTEGRATION TESTS');
    console.log('-'.repeat(40));
    
    const integrationResults = this.runIntegrationTests();
    integrationResults.forEach(test => {
      const icon = test.passed ? '✅' : '❌';
      console.log(`${icon} ${test.name}: ${test.result}`);
    });

    console.log('');
    console.log('Press Ctrl+C to stop monitoring');
  }

  runIntegrationTests() {
    const tests = [];
    
    // Test 1: All critical services are healthy
    const criticalServices = this.services.filter(s => s.critical);
    const healthyCritical = criticalServices.filter(s => 
      this.results.get(s.name).status === 'healthy'
    );
    
    tests.push({
      name: 'Critical Services Health',
      passed: healthyCritical.length === criticalServices.length,
      result: `${healthyCritical.length}/${criticalServices.length} critical services healthy`,
    });

    // Test 2: Response times are acceptable
    const acceptableResponseTime = 1000; // 1 second
    const servicesWithGoodResponse = this.services.filter(s => {
      const result = this.results.get(s.name);
      return result.responseTime && result.responseTime < acceptableResponseTime;
    });

    tests.push({
      name: 'Response Time Check',
      passed: servicesWithGoodResponse.length >= criticalServices.length,
      result: `${servicesWithGoodResponse.length} services < ${acceptableResponseTime}ms`,
    });

    // Test 3: No service has been down for too long
    const maxConsecutiveFailures = 3;
    const servicesWithTooManyFailures = this.services.filter(s => {
      const result = this.results.get(s.name);
      return result.consecutiveFailures >= maxConsecutiveFailures;
    });

    tests.push({
      name: 'Service Stability',
      passed: servicesWithTooManyFailures.length === 0,
      result: servicesWithTooManyFailures.length === 0 ? 
        'All services stable' : 
        `${servicesWithTooManyFailures.length} services unstable`,
    });

    return tests;
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      monitorUptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {},
      summary: {
        totalServices: this.services.length,
        healthyServices: 0,
        criticalServices: this.services.filter(s => s.critical).length,
        healthyCriticalServices: 0,
      },
    };

    this.services.forEach(service => {
      const result = this.results.get(service.name);
      const successRate = result.totalChecks > 0 ? 
        (result.successfulChecks / result.totalChecks) * 100 : 0;

      report.services[service.name] = {
        status: result.status,
        critical: service.critical,
        responseTime: result.responseTime,
        successRate: Math.round(successRate * 100) / 100,
        totalChecks: result.totalChecks,
        successfulChecks: result.successfulChecks,
        consecutiveFailures: result.consecutiveFailures,
        lastError: result.lastError,
        lastCheck: result.lastCheck,
      };

      if (result.status === 'healthy') {
        report.summary.healthyServices++;
        if (service.critical) {
          report.summary.healthyCriticalServices++;
        }
      }
    });

    return report;
  }

  stop() {
    console.log('\n🛑 Stopping Integration Monitor...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Generate final report
    const report = this.generateReport();
    console.log('\n📊 FINAL REPORT');
    console.log('='.repeat(50));
    console.log(JSON.stringify(report, null, 2));

    process.exit(0);
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'interval') options.checkInterval = parseInt(value) * 1000;
    if (key === 'timeout') options.timeout = parseInt(value) * 1000;
    if (key === 'retries') options.retryAttempts = parseInt(value);
  }

  const monitor = new IntegrationMonitor(options);
  monitor.start().catch(console.error);
}

module.exports = IntegrationMonitor;