import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { webcrypto } from 'crypto';

// Fix for @nestjs/schedule crypto issue in Docker
// @nestjs/schedule expects Web Crypto API, not Node.js crypto module
if (!global.crypto) {
  global.crypto = webcrypto as any;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('🔐 Auth Service API')
    .setDescription(`
      # Authentication and Authorization Microservice
      
      Dedicated authentication service for the Russian Gaming Platform, providing secure user authentication, 
      session management, and JWT token operations.
      
      ## Features
      
      ### 🔐 Authentication
      - User registration with strong password validation
      - Email/password login with rate limiting
      - Secure logout with token blacklisting
      - JWT token refresh with rotation
      
      ### 🛡️ Security
      - bcrypt password hashing
      - JWT token blacklisting (Redis + Local DB)
      - Rate limiting and throttling
      - Session management with concurrent limits
      - Security event logging
      
      ### 🔄 Session Management
      - IP address and user agent tracking
      - Concurrent session limits (max 5 per user)
      - Session invalidation for security events
      - Automatic session cleanup
      
      ### 🌐 Service Integration
      - Circuit breaker pattern for resilience
      - Event-driven architecture for non-critical operations
      - Integration with User, Security, and Notification services
      
      ## Rate Limits
      
      | Endpoint | Limit | Window |
      |----------|-------|--------|
      | Registration | 3 attempts | 15 minutes |
      | Login | 5 attempts | 15 minutes |
      | Token Refresh | 10 attempts | 1 minute |
      | Token Validation | 10 requests | 1 second |
      
      ## Authentication Flow
      
      1. **Registration**: POST /auth/register → Returns JWT tokens + session
      2. **Login**: POST /auth/login → Returns JWT tokens + session  
      3. **API Calls**: Include "Bearer {access_token}" in Authorization header
      4. **Token Refresh**: POST /auth/refresh → Returns new tokens
      5. **Logout**: POST /auth/logout → Blacklists tokens + invalidates session
      
      ## Error Handling
      
      All endpoints return consistent error responses with:
      - HTTP status codes
      - Localized error messages (Russian)
      - Detailed error information
      - Request context (timestamp, path, method)
      
      ## Requirements Coverage
      
      This API implements requirements 1.1-14.5 from the Auth Service migration specification,
      ensuring complete separation of authentication concerns from the User Service.
    `)
    .setVersion('1.0.0')
    .setContact(
      'Gaming Platform Team',
      'https://github.com/gaming-platform/auth-service',
      'support@gaming-platform.ru'
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3001', 'Development Server')
    .addServer('https://api-dev.gaming-platform.ru', 'Development Environment')
    .addServer('https://api.gaming-platform.ru', 'Production Environment')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Health', 'Service health monitoring and diagnostics')
    .addTag('Root', 'Service information and status endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
      requestInterceptor: (req) => {
        // Add request timestamp for debugging
        req.headers['X-Request-Timestamp'] = new Date().toISOString();
        return req;
      },
    },
    customSiteTitle: 'Auth Service API Documentation',
    customfavIcon: '/favicon.ico',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    ],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);

  logger.log(`🔐 Auth Service is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error('Failed to start the application:', error);
  process.exit(1);
});