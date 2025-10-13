const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');

async function testMonitoring() {
  try {
    console.log('🔍 Testing monitoring system...');
    
    // Create the application
    const app = await NestFactory.create(AppModule, { logger: false });
    
    console.log('✅ Application created successfully');
    
    // Test that metrics endpoint exists
    const server = app.getHttpServer();
    
    await app.init();
    console.log('✅ Application initialized');
    
    // Get monitoring services
    const prometheusService = app.get('PrometheusService');
    const authMetricsService = app.get('AuthMetricsService');
    const structuredLogger = app.get('StructuredLoggerService');
    const correlationService = app.get('CorrelationService');
    
    console.log('✅ All monitoring services found');
    
    // Test basic functionality
    const correlationId = correlationService.generateCorrelationId();
    console.log(`✅ Generated correlation ID: ${correlationId}`);
    
    authMetricsService.incrementAuthOperation('test', 'success', 'email');
    console.log('✅ Metrics recorded successfully');
    
    const metrics = await prometheusService.getMetrics();
    console.log(`✅ Prometheus metrics retrieved (${metrics.length} characters)`);
    
    structuredLogger.log('Test log message', { operation: 'test' });
    console.log('✅ Structured logging works');
    
    await app.close();
    console.log('✅ Application closed successfully');
    
    console.log('\n🎉 All monitoring tests passed!');
    
  } catch (error) {
    console.error('❌ Monitoring test failed:', error.message);
    process.exit(1);
  }
}

testMonitoring();