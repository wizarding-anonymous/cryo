import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiExtraModels,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ValidateTokenDto } from './dto/validate-token.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import {
  AuthResponseDto,
  TokenRefreshResponseDto,
  TokenValidationResponseDto,
  SessionInfoDto,
  SessionStatsDto,
  ConcurrentSessionInfoDto,
} from './dto/auth-response.dto';
import {
  ValidationErrorResponseDto,
  ConflictErrorResponseDto,
  UnauthorizedErrorResponseDto,
  RateLimitErrorResponseDto,
  NotFoundErrorResponseDto,
  ServiceUnavailableErrorResponseDto,
} from './dto/error-response.dto';
import {
  InvalidateSessionsForSecurityDto,
  SessionListResponseDto,
} from './dto/session-management.dto';

@ApiTags('Authentication')
@ApiExtraModels(
  AuthResponseDto,
  TokenRefreshResponseDto,
  TokenValidationResponseDto,
  SessionInfoDto,
  SessionStatsDto,
  ConcurrentSessionInfoDto,
  ValidationErrorResponseDto,
  ConflictErrorResponseDto,
  UnauthorizedErrorResponseDto,
  RateLimitErrorResponseDto,
  NotFoundErrorResponseDto,
  ServiceUnavailableErrorResponseDto,
  SessionListResponseDto,
  InvalidateSessionsForSecurityDto,
)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Extract client IP address from request
   */
  private getClientIp(request: any): string {
    return request.ip || 
           request.connection?.remoteAddress || 
           request.socket?.remoteAddress ||
           request.headers['x-forwarded-for']?.split(',')[0] ||
           '::1';
  }

  /**
   * Extract user agent from request
   */
  private getUserAgent(request: any): string {
    return request.headers['user-agent'] || 'Unknown';
  }

  @Post('register')
  @Throttle({ auth_strict: { limit: 3, ttl: 900000 } }) // 3 registration attempts per 15 minutes
  @ApiOperation({ 
    summary: 'Register a new user',
    description: `
      Creates a new user account with email and password authentication.
      
      **Security Features:**
      - Password strength validation (8+ chars, mixed case, numbers, symbols)
      - Email uniqueness validation
      - Rate limiting: 3 attempts per 15 minutes
      - Automatic JWT token generation
      - Session creation with metadata tracking
      
      **Idempotency Support:**
      - Include 'Idempotency-Key' header to make request idempotent
      - Duplicate requests return cached result for 24 hours
      - Concurrent requests with same key return 409 Conflict
      - Example: Idempotency-Key: user-reg-2024-01-15-abc123
      
      **Process:**
      1. Validates input data and password strength
      2. Checks email uniqueness via User Service
      3. Hashes password using bcrypt
      4. Creates user record in User Service
      5. Generates JWT access and refresh tokens
      6. Creates local session with IP and user agent tracking
      7. Publishes registration event for notifications and logging
      
      **Requirements:** 1.1, 4.1, 4.3, 4.4, 12.2
    `
  })
  @ApiBody({ 
    type: RegisterDto,
    description: 'User registration data',

  })
  @ApiResponse({ 
    status: 201, 
    description: 'User successfully registered. Returns user data, JWT tokens, and session information.',
    type: AuthResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data or validation errors',
    type: ValidationErrorResponseDto
  })
  @ApiResponse({ 
    status: 409, 
    description: 'User with this email already exists',
    type: ConflictErrorResponseDto
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded - Too many registration attempts',
    type: RateLimitErrorResponseDto
  })
  @ApiResponse({ 
    status: 503, 
    description: 'User Service unavailable - Registration temporarily disabled',
    type: ServiceUnavailableErrorResponseDto
  })
  async register(@Body() registerDto: RegisterDto, @Request() req: any) {
    const ipAddress = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  @Post('login')
  @Throttle({ auth_strict: { limit: 5, ttl: 900000 } }) // 5 login attempts per 15 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Authenticate user',
    description: `
      Authenticates user with email and password credentials.
      
      **Security Features:**
      - Password verification using bcrypt
      - Rate limiting: 5 attempts per 15 minutes
      - Failed login attempt tracking
      - Concurrent session management (max 5 sessions per user)
      - IP address and user agent tracking
      
      **Idempotency Support:**
      - Include 'Idempotency-Key' header to make request idempotent
      - Duplicate requests return same tokens for 24 hours
      - Useful for handling network retries safely
      - Example: Idempotency-Key: user-login-2024-01-15-xyz789
      
      **Process:**
      1. Validates email and password format
      2. Verifies user exists via User Service
      3. Compares password hash using bcrypt
      4. Checks concurrent session limits
      5. Generates JWT access and refresh tokens
      6. Creates new session with metadata
      7. Updates last login timestamp
      8. Publishes login event for logging
      
      **Requirements:** 1.2, 4.2, 4.3, 4.4, 12.2, 13.1
    `
  })
  @ApiBody({ 
    type: LoginDto,
    description: 'User login credentials'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User successfully authenticated. Returns JWT tokens and session information.',
    type: AuthResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data',
    type: ValidationErrorResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid email or password',
    type: UnauthorizedErrorResponseDto
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded - Too many login attempts',
    type: RateLimitErrorResponseDto
  })
  async login(@Body() loginDto: LoginDto, @Request() req: any) {
    const ipAddress = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    
    // Validate user credentials manually instead of using LocalAuthGuard
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      // Log failed login attempt to Security Service
      // Requirement: 6.2, 6.3 - Log authentication events to Security Service
      await this.authService.logFailedLoginAttempt(
        loginDto.email,
        ipAddress,
        'Invalid credentials',
        { userAgent }
      );
      throw new UnauthorizedException('Неверный email или пароль');
    }
    
    return this.authService.login(user, ipAddress, userAgent);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Logout user and invalidate session',
    description: `
      Logs out the authenticated user by blacklisting tokens and invalidating the session.
      
      **Security Features:**
      - JWT token blacklisting in Redis and local database
      - Session invalidation with metadata tracking
      - Optional refresh token blacklisting
      - Security event logging
      
      **Idempotency Support:**
      - Include 'Idempotency-Key' header to make request idempotent
      - Duplicate logout requests are safe and return 204
      - Prevents issues with network retries
      - Example: Idempotency-Key: user-logout-2024-01-15-def456
      
      **Process:**
      1. Extracts access token from Authorization header
      2. Blacklists access token with calculated TTL
      3. Optionally blacklists provided refresh token
      4. Invalidates current session in local database
      5. Publishes logout event for security logging
      
      **Requirements:** 1.3, 4.5, 6.3, 12.3, 13.1
    `
  })
  @ApiBody({ 
    type: LogoutDto, 
    required: false,
    description: 'Optional refresh token to blacklist'
  })
  @ApiResponse({ 
    status: 204, 
    description: 'User successfully logged out. Access token blacklisted and session invalidated.'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto
  })
  async logout(
    @Headers('authorization') authHeader: string,
    @Request() req: AuthenticatedRequest,
    @Body() logoutDto?: LogoutDto,
  ): Promise<void> {
    const accessToken = authHeader?.split(' ')[1];
    const ipAddress = this.getClientIp(req);
    await this.authService.logout(
      accessToken, 
      req.user.userId, 
      logoutDto?.refreshToken,
      ipAddress
    );
  }

  @Post('refresh')
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 refresh attempts per minute
  @ApiOperation({ 
    summary: 'Refresh access token',
    description: `
      Validates refresh token and generates new access and refresh tokens.
      
      **Security Features:**
      - Refresh token validation and blacklist checking
      - Token rotation (old refresh token is invalidated)
      - User existence verification
      - Rate limiting: 10 attempts per minute
      
      **Process:**
      1. Validates refresh token format and signature
      2. Checks if refresh token is blacklisted
      3. Verifies user still exists and is active
      4. Generates new access and refresh tokens
      5. Blacklists old refresh token
      6. Updates session with new token information
      
      **Requirements:** 5.7, 4.4
    `
  })
  @ApiBody({ 
    type: RefreshTokenDto,
    description: 'Refresh token to exchange for new tokens'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token successfully refreshed. Returns new access and refresh tokens (token rotation).',
    type: TokenRefreshResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid, expired, or blacklisted refresh token',
    type: UnauthorizedErrorResponseDto
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded - Too many refresh attempts',
    type: RateLimitErrorResponseDto
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 1000 } }) // 10 validation requests per second (for service-to-service calls)
  @ApiOperation({ 
    summary: 'Validate JWT token (for other services)',
    description: `
      Validates JWT token for service-to-service authentication.
      
      **Validation Process:**
      - JWT signature verification
      - Token expiration checking
      - Blacklist status verification (Redis + local DB)
      - User existence verification via User Service
      - Session validity checking
      
      **Use Cases:**
      - API Gateway token validation
      - Microservice authentication
      - Protected resource access verification
      
      **Rate Limiting:** 10 requests per second (optimized for service calls)
      
      **Requirements:** 5.1, 5.2, 5.4
    `
  })
  @ApiBody({ 
    type: ValidateTokenDto,
    description: 'JWT token to validate'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token is valid. Returns user information and session details.',
    type: TokenValidationResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Token is invalid, expired, blacklisted, or user not found',
    type: UnauthorizedErrorResponseDto
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded - Too many validation requests',
    type: RateLimitErrorResponseDto
  })
  async validateToken(@Body() validateTokenDto: ValidateTokenDto) {
    return this.authService.validateToken(validateTokenDto.token);
  }

  // Session Management Endpoints
  // Requirements: 13.3, 13.5, 13.6

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get user sessions',
    description: `
      Retrieve all sessions (active and inactive) for the authenticated user.
      
      **Session Information:**
      - Session ID and creation timestamp
      - IP address and user agent tracking
      - Active/inactive status
      - Expiration and last access times
      
      **Use Cases:**
      - Security monitoring
      - Device management
      - Session cleanup
      
      **Requirements:** 13.3, 13.5, 13.6
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of user sessions with metadata and statistics',
    type: SessionListResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto
  })
  async getUserSessions(@Request() req: AuthenticatedRequest) {
    return this.authService.getUserSessions(req.user.userId);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Invalidate specific session',
    description: `
      Invalidate a specific session by ID. Users can only invalidate their own sessions.
      
      **Security Features:**
      - Session ownership verification
      - Immediate token blacklisting
      - Security event logging
      
      **Use Cases:**
      - Remote device logout
      - Suspicious session termination
      - Manual session cleanup
      
      **Requirements:** 13.3, 13.5, 13.6
    `
  })
  @ApiParam({ 
    name: 'sessionId', 
    description: 'UUID of the session to invalidate',
    example: '550e8400-e29b-41d4-a716-446655440001'
  })
  @ApiResponse({ 
    status: 204, 
    description: 'Session successfully invalidated. Associated tokens are blacklisted.'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid JWT token or session not owned by user',
    type: UnauthorizedErrorResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Session not found',
    type: NotFoundErrorResponseDto
  })
  async invalidateSession(
    @Param('sessionId') sessionId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    // Verify the session belongs to the authenticated user
    const userSessions = await this.authService.getUserSessions(req.user.userId);
    const sessionExists = userSessions.some(session => session.id === sessionId);
    
    if (!sessionExists) {
      throw new UnauthorizedException('Session not found or access denied');
    }

    // Invalidate the specific session
    await this.authService.invalidateSpecificSession(sessionId, req.user.userId);
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Invalidate all user sessions',
    description: `
      Invalidate all sessions for the authenticated user (security action).
      
      **Security Features:**
      - Immediate invalidation of all user sessions
      - Blacklisting of all associated tokens
      - Security event logging with reason
      
      **Use Cases:**
      - Account security breach response
      - Password change security measure
      - User-initiated security cleanup
      
      **Note:** This will log out the user from all devices including the current session.
      
      **Requirements:** 13.3, 13.5, 13.6
    `
  })
  @ApiResponse({ 
    status: 204, 
    description: 'All user sessions successfully invalidated. All associated tokens are blacklisted.'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto
  })
  async invalidateAllSessions(@Request() req: AuthenticatedRequest): Promise<void> {
    const ipAddress = this.getClientIp(req);
    await this.authService.invalidateAllUserSessions(
      req.user.userId, 
      'user_requested_all_sessions_invalidation',
      ipAddress
    );
  }

  @Get('sessions/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get session statistics',
    description: `
      Get comprehensive session statistics for monitoring and analytics.
      
      **Statistics Include:**
      - Total active and expired sessions
      - Sessions per user distribution
      - System-wide session metrics
      
      **Note:** In production, this endpoint should be restricted to admin users.
      
      **Requirements:** 13.7
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Comprehensive session statistics for system monitoring',
    type: SessionStatsDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto
  })
  async getSessionStats() {
    // Note: In a real application, you might want to restrict this to admin users
    return this.authService.getSessionStats();
  }

  @Get('sessions/concurrent-info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get concurrent session information',
    description: `
      Get detailed information about user's concurrent sessions and limits.
      
      **Information Provided:**
      - Current active session count
      - Maximum allowed sessions (default: 5)
      - Session limit status
      - Oldest session age for cleanup decisions
      
      **Use Cases:**
      - Session limit enforcement
      - User session management UI
      - Security monitoring
      
      **Requirements:** 13.3
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Detailed concurrent session information and limits',
    type: ConcurrentSessionInfoDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto
  })
  async getConcurrentSessionInfo(@Request() req: AuthenticatedRequest) {
    return this.authService.getConcurrentSessionInfo(req.user.userId);
  }

  @Post('sessions/invalidate-for-security')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Invalidate sessions for security events',
    description: `
      Invalidate user sessions due to security events with detailed logging.
      
      **Security Event Types:**
      - **password_change**: User changed password (exclude current session)
      - **suspicious_activity**: Detected suspicious login patterns
      - **account_compromise**: Confirmed account breach
      - **admin_action**: Administrative security action
      
      **Features:**
      - Selective session invalidation
      - Security event logging
      - Optional current session preservation
      
      **Requirements:** 13.5, 13.6
    `
  })
  @ApiBody({
    type: InvalidateSessionsForSecurityDto,
    description: 'Security event details for session invalidation'
  })
  @ApiResponse({ 
    status: 204, 
    description: 'Sessions successfully invalidated for security event. Security event logged.'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid security event type or request data',
    type: ValidationErrorResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto
  })
  async invalidateSessionsForSecurity(
    @Body() body: InvalidateSessionsForSecurityDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    const ipAddress = this.getClientIp(req);
    
    // Get current session ID if we need to exclude it
    let currentSessionId: string | undefined;
    if (body.excludeCurrentSession) {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];
      if (accessToken) {
        const currentSession = await this.authService.getSessionByAccessToken(accessToken);
        currentSessionId = currentSession?.id;
      }
    }

    await this.authService.invalidateSessionsForSecurityEvent(
      req.user.userId,
      body.securityEventType,
      ipAddress,
      currentSessionId
    );
  }
}