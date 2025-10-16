import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  output: string;
  error?: string;
}

interface PerformanceMetrics {
  memoryUsage: {
    initial: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    final: NodeJS.MemoryUsage;
  };
  cpuUsage: {
    initial: NodeJS.CpuUsage;
    final: NodeJS.CpuUsage;
  };
  testDuration: number;
}

class PerformanceTestRunner {
  private results: TestResult[] = [];
  private metrics: PerformanceMetrics;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      memoryUsage: {
        initial: process.memoryUsage(),
        peak: process.memoryUsage(),
        final: process.memoryUsage(),
      },
      cpuUsage: {
        initial: process.cpuUsage(),
        final: process.cpuUsage(),
      },
      testDuration: 0,
    };
  }

  async runAllPerformanceTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Performance Test Suite');
    console.log('=' .repeat(60));
    console.log(`📅 Start Time: ${new Date().toISOString()}`);
    console.log(`📊 Initial Memory: ${Math.round(this.metrics.memoryUsage.initial.heapUsed / 1024 / 1024)}MB`);
    console.log('');

    try {
      // Check if service is running
      await this.checkServiceHealth();

      // Run Jest-based performance tests
      await this.runJestPerformanceTests();

      // Run advanced Node.js load test
      await this.runAdvancedLoadTest();

      // Run k6 load test if available
      await this.runK6LoadTest();

      // Generate comprehensive report
      await this.generateComprehensiveReport();

    } catch (error) {
      console.error('❌ Performance test suite failed:', error.message);
      process.exit(1);
    } finally {
      this.metrics.testDuration = Date.now() - this.startTime;
      this.metrics.memoryUsage.final = process.memoryUsage();
      this.metrics.cpuUsage.final = process.cpuUsage(this.metrics.cpuUsage.initial);
    }
  }

  private async checkServiceHealth(): Promise<void> {
    console.log('🏥 Checking service health...');
    
    try {
      const response = await fetch('http://localhost:3001/api/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      console.log('✅ Service is healthy and ready for testing');
    } catch (error) {
      console.error('❌ Service health check failed:', error.message);
      console.log('💡 Make sure the User Service is running on http://localhost:3001');
      console.log('💡 Run: npm run dev:setup && npm run start:dev');
      throw error;
    }
  }

  private async runJestPerformanceTests(): Promise<void> {
    console.log('\n📋 Running Jest-based Performance Tests...');
    console.log('-'.repeat(50));

    const jestTests = [
      {
        name: 'Batch Operations Performance',
        testFile: 'test/performance-batch-operations.e2e-spec.ts',
        timeout: 600000, // 10 minutes
      },
      {
        name: 'Concurrent Users Load Test',
        testFile: 'test/load-test-concurrent-users.e2e-spec.ts',
        timeout: 900000, // 15 minutes
      },
      {
        name: 'Cache & Database Performance',
        testFile: 'test/performance-cache-database.e2e-spec.ts',
        timeout: 600000, // 10 minutes
      },
      {
        name: 'Memory & Resource Usage',
        testFile: 'test/performance-memory-resource.e2e-spec.ts',
        timeout: 1200000, // 20 minutes
      },
    ];

    for (const test of jestTests) {
      await this.runJestTest(test);
    }
  }

  private async runJestTest(test: { name: string; testFile: string; timeout: number }): Promise<void> {
    console.log(`\n🧪 Running: ${test.name}`);
    console.log(`📁 File: ${test.testFile}`);
    
    const startTime = Date.now();
    const memoryBefore = process.memoryUsage();

    try {
      const result = await this.executeCommand('npm', [
        'run',
        'test:e2e',
        '--',
        '--testPathPattern=' + test.testFile,
        '--testTimeout=' + test.timeout,
        '--verbose',
        '--detectOpenHandles',
        '--forceExit'
      ]);

      const duration = Date.now() - startTime;
      const memoryAfter = process.memoryUsage();
      
      // Update peak memory usage
      if (memoryAfter.heapUsed > this.metrics.memoryUsage.peak.heapUsed) {
        this.metrics.memoryUsage.peak = memoryAfter;
      }

      this.results.push({
        name: test.name,
        success: result.success,
        duration,
        output: result.output,
        error: result.error,
      });

      if (result.success) {
        console.log(`✅ ${test.name} completed successfully`);
        console.log(`⏱️ Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log(`📊 Memory: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB → ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      } else {
        console.log(`❌ ${test.name} failed`);
        console.log(`❌ Error: ${result.error}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        name: test.name,
        success: false,
        duration,
        output: '',
        error: error.message,
      });
      console.log(`❌ ${test.name} failed: ${error.message}`);
    }
  }

  private async runAdvancedLoadTest(): Promise<void> {
    console.log('\n🚀 Running Advanced Node.js Load Test...');
    console.log('-'.repeat(50));

    const startTime = Date.now();
    const memoryBefore = process.memoryUsage();

    try {
      const result = await this.executeCommand('node', [
        'load-test/advanced-performance-test.js'
      ], {
        env: {
          ...process.env,
          BASE_URL: 'http://localhost:3001',
          MAX_CONCURRENT_USERS: '1500',
          TEST_DURATION: '600000', // 10 minutes
        }
      });

      const duration = Date.now() - startTime;
      const memoryAfter = process.memoryUsage();

      // Update peak memory usage
      if (memoryAfter.heapUsed > this.metrics.memoryUsage.peak.heapUsed) {
        this.metrics.memoryUsage.peak = memoryAfter;
      }

      this.results.push({
        name: 'Advanced Load Test',
        success: result.success,
        duration,
        output: result.output,
        error: result.error,
      });

      if (result.success) {
        console.log('✅ Advanced Load Test completed successfully');
        console.log(`⏱️ Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log(`📊 Memory: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB → ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      } else {
        console.log('❌ Advanced Load Test failed');
        console.log(`❌ Error: ${result.error}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        name: 'Advanced Load Test',
        success: false,
        duration,
        output: '',
        error: error.message,
      });
      console.log(`❌ Advanced Load Test failed: ${error.message}`);
    }
  }

  private async runK6LoadTest(): Promise<void> {
    console.log('\n📊 Running k6 Load Test (if available)...');
    console.log('-'.repeat(50));

    // Check if k6 is available
    try {
      await this.executeCommand('k6', ['version'], { timeout: 5000 });
    } catch (error) {
      console.log('⚠️ k6 not available, skipping k6 load test');
      console.log('💡 Install k6 from https://k6.io/docs/getting-started/installation/');
      return;
    }

    const startTime = Date.now();
    const memoryBefore = process.memoryUsage();

    try {
      const result = await this.executeCommand('k6', [
        'run',
        'load-test/k6-load-test.js'
      ], {
        env: {
          ...process.env,
          BASE_URL: 'http://localhost:3001',
        }
      });

      const duration = Date.now() - startTime;
      const memoryAfter = process.memoryUsage();

      this.results.push({
        name: 'k6 Load Test',
        success: result.success,
        duration,
        output: result.output,
        error: result.error,
      });

      if (result.success) {
        console.log('✅ k6 Load Test completed successfully');
        console.log(`⏱️ Duration: ${(duration / 1000).toFixed(1)}s`);
      } else {
        console.log('❌ k6 Load Test failed');
        console.log(`❌ Error: ${result.error}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        name: 'k6 Load Test',
        success: false,
        duration,
        output: '',
        error: error.message,
      });
      console.log(`❌ k6 Load Test failed: ${error.message}`);
    }
  }

  private async executeCommand(
    command: string, 
    args: string[], 
    options: { env?: NodeJS.ProcessEnv; timeout?: number } = {}
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      const { env = process.env, timeout = 1800000 } = options; // 30 minutes default timeout
      
      const child: ChildProcess = spawn(command, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text); // Real-time output
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text); // Real-time error output
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output,
          error: `Command timed out after ${timeout}ms`,
        });
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          output,
          error: code !== 0 ? errorOutput || `Command exited with code ${code}` : undefined,
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output,
          error: error.message,
        });
      });
    });
  }

  private async generateComprehensiveReport(): Promise<void> {
    console.log('\n📊 Generating Comprehensive Performance Report...');
    console.log('-'.repeat(50));

    const report = {
      testSuite: 'Comprehensive Performance Test Suite',
      timestamp: new Date().toISOString(),
      duration: this.metrics.testDuration,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        totalMemory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024) + 'GB',
      },
      metrics: {
        memoryUsage: {
          initial: Math.round(this.metrics.memoryUsage.initial.heapUsed / 1024 / 1024),
          peak: Math.round(this.metrics.memoryUsage.peak.heapUsed / 1024 / 1024),
          final: Math.round(this.metrics.memoryUsage.final.heapUsed / 1024 / 1024),
          growth: Math.round((this.metrics.memoryUsage.final.heapUsed - this.metrics.memoryUsage.initial.heapUsed) / 1024 / 1024),
        },
        cpuUsage: {
          user: Math.round(this.metrics.cpuUsage.final.user / 1000), // Convert to milliseconds
          system: Math.round(this.metrics.cpuUsage.final.system / 1000),
        },
      },
      summary: {
        totalTests: this.results.length,
        successful: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length,
        successRate: (this.results.filter(r => r.success).length / this.results.length) * 100,
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
      },
      results: this.results,
      recommendations: this.generateRecommendations(),
    };

    // Create reports directory
    const reportsDir = path.join(__dirname, '..', 'performance-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Save detailed JSON report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonReportPath = path.join(reportsDir, `performance-report-${timestamp}.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Generate and save summary report
    const summaryReportPath = path.join(reportsDir, `performance-summary-${timestamp}.txt`);
    const summaryContent = this.generateSummaryReport(report);
    fs.writeFileSync(summaryReportPath, summaryContent);

    // Generate HTML report
    const htmlReportPath = path.join(reportsDir, `performance-report-${timestamp}.html`);
    const htmlContent = this.generateHtmlReport(report);
    fs.writeFileSync(htmlReportPath, htmlContent);

    console.log(`📄 JSON Report: ${jsonReportPath}`);
    console.log(`📄 Summary Report: ${summaryReportPath}`);
    console.log(`📄 HTML Report: ${htmlReportPath}`);

    // Print summary to console
    console.log('\n' + summaryContent);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const failedTests = this.results.filter(r => !r.success);
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} test(s) failed - investigate and fix issues before production deployment`);
    }

    const memoryGrowth = this.metrics.memoryUsage.final.heapUsed - this.metrics.memoryUsage.initial.heapUsed;
    if (memoryGrowth > 200 * 1024 * 1024) { // 200MB
      recommendations.push('Significant memory growth detected during testing - investigate potential memory leaks');
    }

    const longRunningTests = this.results.filter(r => r.duration > 600000); // 10 minutes
    if (longRunningTests.length > 0) {
      recommendations.push('Some tests took longer than 10 minutes - consider optimizing performance');
    }

    const successRate = (this.results.filter(r => r.success).length / this.results.length) * 100;
    if (successRate < 100) {
      recommendations.push('Not all performance tests passed - address failures before production deployment');
    } else {
      recommendations.push('All performance tests passed - system is ready for production load');
    }

    if (this.metrics.memoryUsage.peak.heapUsed > 1024 * 1024 * 1024) { // 1GB
      recommendations.push('Peak memory usage exceeded 1GB - consider memory optimization');
    }

    return recommendations;
  }

  private generateSummaryReport(report: any): string {
    let summary = '🚀 COMPREHENSIVE PERFORMANCE TEST SUMMARY\n';
    summary += '='.repeat(60) + '\n\n';
    
    summary += `📅 Test Date: ${report.timestamp}\n`;
    summary += `⏱️ Total Duration: ${(report.duration / 1000 / 60).toFixed(1)} minutes\n`;
    summary += `🖥️ Environment: Node.js ${report.environment.nodeVersion} on ${report.environment.platform}\n`;
    summary += `💾 System Memory: ${report.environment.totalMemory}\n`;
    summary += `🔧 CPU Cores: ${report.environment.cpus}\n\n`;

    summary += 'TEST RESULTS\n';
    summary += '-'.repeat(30) + '\n';
    summary += `📊 Total Tests: ${report.summary.totalTests}\n`;
    summary += `✅ Successful: ${report.summary.successful}\n`;
    summary += `❌ Failed: ${report.summary.failed}\n`;
    summary += `📈 Success Rate: ${report.summary.successRate.toFixed(1)}%\n\n`;

    summary += 'RESOURCE USAGE\n';
    summary += '-'.repeat(30) + '\n';
    summary += `📊 Memory Usage:\n`;
    summary += `   Initial: ${report.metrics.memoryUsage.initial}MB\n`;
    summary += `   Peak: ${report.metrics.memoryUsage.peak}MB\n`;
    summary += `   Final: ${report.metrics.memoryUsage.final}MB\n`;
    summary += `   Growth: ${report.metrics.memoryUsage.growth}MB\n\n`;
    summary += `⚡ CPU Usage:\n`;
    summary += `   User: ${report.metrics.cpuUsage.user}ms\n`;
    summary += `   System: ${report.metrics.cpuUsage.system}ms\n\n`;

    summary += 'INDIVIDUAL TEST RESULTS\n';
    summary += '-'.repeat(30) + '\n';
    report.results.forEach((result: TestResult, index: number) => {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(1);
      summary += `${index + 1}. ${status} ${result.name} (${duration}s)\n`;
      if (!result.success && result.error) {
        summary += `   Error: ${result.error}\n`;
      }
    });
    summary += '\n';

    summary += 'RECOMMENDATIONS\n';
    summary += '-'.repeat(30) + '\n';
    report.recommendations.forEach((rec: string, index: number) => {
      summary += `${index + 1}. ${rec}\n`;
    });

    return summary;
  }

  private generateHtmlReport(report: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .card h3 { margin-top: 0; color: #007bff; }
        .success { border-left-color: #28a745; }
        .success h3 { color: #28a745; }
        .warning { border-left-color: #ffc107; }
        .warning h3 { color: #ffc107; }
        .danger { border-left-color: #dc3545; }
        .danger h3 { color: #dc3545; }
        .test-results { margin-bottom: 30px; }
        .test-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 4px; }
        .test-success { border-left: 4px solid #28a745; }
        .test-failure { border-left: 4px solid #dc3545; }
        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .recommendations ul { margin: 10px 0; }
        .metric { font-size: 24px; font-weight: bold; }
        .metric-label { font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Test Report</h1>
            <p><strong>Generated:</strong> ${report.timestamp}</p>
            <p><strong>Duration:</strong> ${(report.duration / 1000 / 60).toFixed(1)} minutes</p>
        </div>

        <div class="summary">
            <div class="card ${report.summary.successRate === 100 ? 'success' : report.summary.successRate >= 80 ? 'warning' : 'danger'}">
                <h3>Test Results</h3>
                <div class="metric">${report.summary.successRate.toFixed(1)}%</div>
                <div class="metric-label">Success Rate</div>
                <p>${report.summary.successful}/${report.summary.totalTests} tests passed</p>
            </div>

            <div class="card">
                <h3>Memory Usage</h3>
                <div class="metric">${report.metrics.memoryUsage.peak}MB</div>
                <div class="metric-label">Peak Memory</div>
                <p>Growth: ${report.metrics.memoryUsage.growth}MB</p>
            </div>

            <div class="card">
                <h3>System Info</h3>
                <div class="metric">${report.environment.cpus}</div>
                <div class="metric-label">CPU Cores</div>
                <p>${report.environment.totalMemory} RAM</p>
                <p>Node.js ${report.environment.nodeVersion}</p>
            </div>
        </div>

        <div class="test-results">
            <h2>Individual Test Results</h2>
            ${report.results.map((result: TestResult) => `
                <div class="test-item ${result.success ? 'test-success' : 'test-failure'}">
                    <div>
                        <strong>${result.success ? '✅' : '❌'} ${result.name}</strong>
                        ${!result.success && result.error ? `<br><small style="color: #dc3545;">Error: ${result.error}</small>` : ''}
                    </div>
                    <div>
                        <strong>${(result.duration / 1000).toFixed(1)}s</strong>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="recommendations">
            <h2>📋 Recommendations</h2>
            <ul>
                ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>
</body>
</html>`;
  }
}

// Run the performance test suite if this file is executed directly
if (require.main === module) {
  const runner = new PerformanceTestRunner();
  runner.runAllPerformanceTests().catch(error => {
    console.error('❌ Performance test suite failed:', error);
    process.exit(1);
  });
}

export default PerformanceTestRunner;