import {
  Controller,
  Get,
  Body,
  Param,
  Post,
  Patch,
  NotFoundException,
  HttpStatus,
  HttpCode,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserServiceError, ErrorCodes } from '../common/errors';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiSecurity,
  ApiQuery,
} from '@nestjs/swagger';
import { IsUUID, IsEmail } from 'class-validator';
import { Request } from 'express';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { InternalServiceGuard, RateLimit, RateLimitType } from '../common/guards';
import { 
  LoggingService, 
  AuditService, 
  AuditInterceptor,
  Audit,
  AuditOperations,
  AuditResources,
  AuditContext,
} from '../common/logging';
import { UserFilterDto } from '../common/dto/pagination.dto';
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from '../common/dto/api-response.dto';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor';

class UuidParamDto {
  @IsUUID(4, { message: 'Invalid UUID format' })
  id: string;
}

class EmailParamDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}

@ApiTags('Users')
@ApiSecurity('internal-api-key')
@ApiSecurity('internal-bearer')
@Controller('users')
@UseGuards(InternalServiceGuard)
@UseInterceptors(ApiResponseInterceptor, AuditInterceptor)
@RateLimit({ type: RateLimitType.INTERNAL })
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly loggingService: LoggingService,
    private readonly auditService: AuditService,
  ) {}

  // Internal endpoints for microservice communication
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Audit({
    operation: AuditOperations.USER_CREATE,
    resource: AuditResources.USER,
    sensitiveData: true,
    complianceRelevant: true,
    gdprRelevant: true,
    logChanges: true,
  })
  @ApiOperation({
    summary: 'Create a new user (internal use)',
    description: 'Creates a new user with pre-hashed password',
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully created.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiConflictResponse({
    description: 'User with this email already exists.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: 'User with this email already exists',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @AuditContext() auditContext: any,
  ) {
    const { correlationId, ipAddress, userAgent } = auditContext;

    this.loggingService.info('User creation request received', {
      correlationId,
      operation: 'user_create_request',
      ipAddress,
      userAgent,
      metadata: {
        email: createUserDto.email,
        hasPassword: !!createUserDto.password,
      },
    });

    const result = await this.userService.create(
      createUserDto,
      correlationId,
      ipAddress,
      userAgent,
    );

    // Enhanced audit logging is now handled by AuditInterceptor
    // But we can still log additional context-specific information
    await this.auditService.logUserOperation(
      AuditOperations.USER_CREATE,
      result.id,
      correlationId,
      ipAddress,
      userAgent,
      true,
      undefined, // duration will be calculated by interceptor
      {
        email: result.email,
        createdBy: 'system',
        fieldsAccessed: ['email', 'password', 'name'],
      },
    );

    return result;
  }

  @Get('email/:email')
  @Audit({
    operation: AuditOperations.USER_READ,
    resource: AuditResources.USER,
    sensitiveData: true,
    complianceRelevant: true,
    gdprRelevant: true,
  })
  @ApiOperation({
    summary: 'Find user by email (internal use)',
    description: 'Retrieves user information by email address',
  })
  @ApiParam({
    name: 'email',
    description: 'User email address',
    example: 'user@example.com',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the user if found.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        password: { type: 'string', description: 'Hashed password' },
        lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'User not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid email format.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async findByEmail(
    @Param() params: EmailParamDto, 
    @AuditContext() auditContext: any,
  ) {
    const { email } = params;
    const { correlationId, ipAddress, userAgent } = auditContext;

    this.loggingService.info('User lookup by email request received', {
      correlationId,
      operation: 'user_find_by_email_request',
      ipAddress,
      userAgent,
      metadata: {
        email,
      },
    });

    const user = await this.userService.findByEmail(email, correlationId);

    if (!user) {
      this.loggingService.warn('User not found by email', {
        correlationId,
        operation: 'user_find_by_email_not_found',
        ipAddress,
        userAgent,
        metadata: {
          email,
        },
      });
      throw UserServiceError.userNotFound(email, correlationId);
    }

    // Enhanced audit logging with suspicious activity detection
    await this.auditService.logEnhancedDataAccess({
      operation: 'READ',
      table: 'users',
      recordId: user.id,
      userId: 'system', // System access
      correlationId,
      ipAddress,
      userAgent,
      fieldsAccessed: [
        'id',
        'email',
        'name',
        'password',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
      success: true,
    });

    return user;
  }

  @Get(':id')
  @Audit({
    operation: AuditOperations.USER_READ,
    resource: AuditResources.USER,
    sensitiveData: true,
    complianceRelevant: true,
    gdprRelevant: true,
  })
  @ApiOperation({
    summary: 'Find user by ID (internal use)',
    description: 'Retrieves user information by UUID',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the user if found.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        password: { type: 'string', description: 'Hashed password' },
        lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'User not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async findById(
    @Param() params: UuidParamDto, 
    @AuditContext() auditContext: any,
  ) {
    const { id } = params;
    const { correlationId, ipAddress, userAgent } = auditContext;

    this.loggingService.info('User lookup by ID request received', {
      correlationId,
      operation: 'user_find_by_id_request',
      ipAddress,
      userAgent,
      metadata: {
        userId: id,
      },
    });

    const user = await this.userService.findById(id, correlationId);

    if (!user) {
      this.loggingService.warn('User not found by ID', {
        correlationId,
        operation: 'user_find_by_id_not_found',
        ipAddress,
        userAgent,
        metadata: {
          userId: id,
        },
      });
      throw UserServiceError.userNotFound(id, correlationId);
    }

    // Log audit event for user data access
    this.auditService.logDataAccess({
      operation: 'READ',
      table: 'users',
      recordId: user.id,
      userId: 'system', // System access
      correlationId,
      ipAddress,
      userAgent,
      fieldsAccessed: [
        'id',
        'email',
        'name',
        'password',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
      success: true,
    });

    return user;
  }

  @Patch(':id/last-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user last login timestamp (internal use)',
    description: 'Updates the lastLoginAt field for user activity tracking',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Last login updated successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Last login updated successfully' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'User not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async updateLastLogin(
    @Param() params: UuidParamDto,
    @Req() request: Request,
  ) {
    const { id } = params;
    const correlationId = (request as any).correlationId;
    const ipAddress = request.ip || request.socket?.remoteAddress;
    const userAgent = (typeof request.get === 'function' ? request.get('User-Agent') : request.headers?.['user-agent']) || '';

    this.loggingService.info('Update last login request received', {
      correlationId,
      operation: 'user_update_last_login_request',
      ipAddress,
      userAgent,
      metadata: {
        userId: id,
      },
    });

    await this.userService.updateLastLogin(id);

    // Log audit event for user data modification
    this.auditService.logDataAccess({
      operation: 'UPDATE',
      table: 'users',
      recordId: id,
      userId: 'system', // System access
      correlationId,
      ipAddress,
      userAgent,
      fieldsAccessed: ['lastLoginAt'],
      changes: {
        lastLoginAt: { from: 'previous_value', to: new Date().toISOString() },
      },
      success: true,
    });

    this.loggingService.info('Last login updated successfully', {
      correlationId,
      operation: 'user_update_last_login_success',
      ipAddress,
      userAgent,
      metadata: {
        userId: id,
      },
    });

    return { message: 'Last login updated successfully' };
  }

  @Get(':id/exists')
  @ApiOperation({
    summary: 'Check if a user exists by ID (internal use)',
    description: 'Verifies user existence without returning sensitive data',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns whether the user exists.',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean', example: true },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async checkUserExists(
    @Param() params: UuidParamDto,
    @Req() request: Request,
  ) {
    const { id } = params;
    const correlationId = (request as any).correlationId;
    const ipAddress = request.ip || request.socket?.remoteAddress;
    const userAgent = (typeof request.get === 'function' ? request.get('User-Agent') : request.headers?.['user-agent']) || '';

    this.loggingService.info('User existence check request received', {
      correlationId,
      operation: 'user_exists_request',
      ipAddress,
      userAgent,
      metadata: {
        userId: id,
      },
    });

    const exists = await this.userService.exists(id);

    this.loggingService.info('User existence check completed', {
      correlationId,
      operation: 'user_exists_response',
      ipAddress,
      userAgent,
      metadata: {
        userId: id,
        exists,
      },
    });

    return { exists };
  }

  @Get()
  @ApiOperation({
    summary: 'Get users with pagination and filtering (internal use)',
    description:
      'Retrieves users with pagination, filtering, and sorting capabilities',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-based)',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (max 100)',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'cursor',
    description: 'Cursor for cursor-based pagination',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Field to sort by',
    required: false,
    enum: ['createdAt', 'updatedAt', 'name', 'email', 'lastLoginAt'],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort direction',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiQuery({
    name: 'name',
    description: 'Filter by user name (partial match)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'email',
    description: 'Filter by email (partial match)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'isActive',
    description: 'Filter by active status',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'createdFrom',
    description: 'Filter by creation date from (ISO string)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'createdTo',
    description: 'Filter by creation date to (ISO string)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'includeDeleted',
    description: 'Include soft-deleted users',
    required: false,
    type: Boolean,
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of users.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string' },
                  isActive: { type: 'boolean' },
                  lastLoginAt: {
                    type: 'string',
                    format: 'date-time',
                    nullable: true,
                  },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 100 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                totalPages: { type: 'number', example: 5 },
                hasNext: { type: 'boolean', example: true },
                hasPrevious: { type: 'boolean', example: false },
                nextCursor: { type: 'string', nullable: true },
                previousCursor: { type: 'string', nullable: true },
              },
            },
          },
        },
        error: { type: 'string', nullable: true, example: null },
        timestamp: { type: 'string', format: 'date-time' },
        correlationId: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        data: { type: 'null', example: null },
        error: { type: 'string', example: 'Invalid query parameters' },
        timestamp: { type: 'string', format: 'date-time' },
        correlationId: { type: 'string' },
      },
    },
  })
  async findUsersWithPagination(
    @Query() filterDto: UserFilterDto,
    @Req() request: Request,
  ) {
    const correlationId = (request as any).correlationId;
    const ipAddress = request.ip || request.socket?.remoteAddress;
    const userAgent = (typeof request.get === 'function' ? request.get('User-Agent') : request.headers?.['user-agent']) || '';

    this.loggingService.info('Users pagination request received', {
      correlationId,
      operation: 'users_pagination_request',
      ipAddress,
      userAgent,
      metadata: {
        filters: {
          name: filterDto.name,
          email: filterDto.email,
          isActive: filterDto.isActive,
        },
        pagination: {
          page: filterDto.page,
          limit: filterDto.limit,
          cursor: !!filterDto.cursor,
          sortBy: filterDto.sortBy,
          sortOrder: filterDto.sortOrder,
        },
      },
    });

    const result = await this.userService.findUsersWithPagination(
      filterDto,
      correlationId,
    );

    // Log audit event for bulk user data access
    this.auditService.logDataAccess({
      operation: 'BULK_READ',
      table: 'users',
      userId: 'system', // System access
      correlationId,
      ipAddress,
      userAgent,
      fieldsAccessed: [
        'id',
        'email',
        'name',
        'isActive',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
      success: true,
    });

    return result;
  }

  @Get('search')
  @RateLimit({ 
    type: RateLimitType.SEARCH, 
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 search requests per minute
    message: 'Too many search requests, please try again later'
  })
  @ApiOperation({
    summary: 'Search users by name or email (internal use)',
    description: 'Searches users by name or email with pagination support',
  })
  @ApiQuery({
    name: 'q',
    description: 'Search term for name or email',
    required: true,
    type: String,
    example: 'john',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-based)',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (max 100)',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'cursor',
    description: 'Cursor for cursor-based pagination',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Field to sort by',
    required: false,
    enum: ['createdAt', 'updatedAt', 'name', 'email', 'lastLoginAt'],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort direction',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated search results.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string' },
                  isActive: { type: 'boolean' },
                  lastLoginAt: {
                    type: 'string',
                    format: 'date-time',
                    nullable: true,
                  },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 100 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                totalPages: { type: 'number', example: 5 },
                hasNext: { type: 'boolean', example: true },
                hasPrevious: { type: 'boolean', example: false },
                nextCursor: { type: 'string', nullable: true },
                previousCursor: { type: 'string', nullable: true },
              },
            },
          },
        },
        error: { type: 'string', nullable: true, example: null },
        timestamp: { type: 'string', format: 'date-time' },
        correlationId: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Missing or invalid search term.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        data: { type: 'null', example: null },
        error: { type: 'string', example: 'Search term is required' },
        timestamp: { type: 'string', format: 'date-time' },
        correlationId: { type: 'string' },
      },
    },
  })
  async searchUsers(
    @Query('q') searchTerm: string,
    @Query() filterDto: UserFilterDto,
    @Req() request: Request,
  ) {
    const correlationId = (request as any).correlationId;
    const ipAddress = request.ip || request.socket?.remoteAddress;
    const userAgent = (typeof request.get === 'function' ? request.get('User-Agent') : request.headers?.['user-agent']) || '';

    if (!searchTerm || !searchTerm.trim()) {
      this.loggingService.warn('Users search request without search term', {
        correlationId,
        operation: 'users_search_invalid',
        ipAddress,
        userAgent,
      });
      throw UserServiceError.validationError(
        'Search term is required',
        'q',
        searchTerm,
        correlationId,
      );
    }

    this.loggingService.info('Users search request received', {
      correlationId,
      operation: 'users_search_request',
      ipAddress,
      userAgent,
      metadata: {
        searchTerm: searchTerm.substring(0, 50), // Limit logged search term length
        pagination: {
          page: filterDto.page,
          limit: filterDto.limit,
          cursor: !!filterDto.cursor,
          sortBy: filterDto.sortBy,
          sortOrder: filterDto.sortOrder,
        },
      },
    });

    const result = await this.userService.searchUsers(
      searchTerm,
      filterDto,
      correlationId,
    );

    // Log audit event for user search
    this.auditService.logDataAccess({
      operation: 'BULK_READ',
      table: 'users',
      userId: 'system', // System access
      correlationId,
      ipAddress,
      userAgent,
      fieldsAccessed: [
        'id',
        'email',
        'name',
        'isActive',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
      success: true,
    });

    return result;
  }
}
