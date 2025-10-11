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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { IsUUID, IsEmail } from 'class-validator';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

class UuidParamDto {
  @IsUUID(4, { message: 'Invalid UUID format' })
  id: string;
}

class EmailParamDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  // Endpoints for auth-service communication
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a new user (internal use by auth-service)',
    description: 'Creates a new user with pre-hashed password from Auth Service'
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
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiConflictResponse({ 
    description: 'User with this email already exists.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: { type: 'string', example: 'User with this email already exists' },
        error: { type: 'string', example: 'Conflict' }
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Invalid input data.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get('email/:email')
  @ApiOperation({ 
    summary: 'Find user by email (internal use by auth-service)',
    description: 'Retrieves user information by email address for authentication purposes'
  })
  @ApiParam({ 
    name: 'email', 
    description: 'User email address',
    example: 'user@example.com'
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
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'User not found.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'User not found' },
        error: { type: 'string', example: 'Not Found' }
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Invalid email format.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  async findByEmail(@Param() params: EmailParamDto) {
    const { email } = params;
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Find user by ID (internal use by auth-service)',
    description: 'Retrieves user information by UUID for token validation and user verification'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000'
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
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'User not found.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'User not found' },
        error: { type: 'string', example: 'Not Found' }
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Invalid UUID format.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  async findById(@Param() params: UuidParamDto) {
    const { id } = params;
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Patch(':id/last-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update user last login timestamp (internal use by auth-service)',
    description: 'Updates the lastLoginAt field when user successfully authenticates'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Last login updated successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Last login updated successfully' }
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'User not found.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'User not found' },
        error: { type: 'string', example: 'Not Found' }
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Invalid UUID format.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  async updateLastLogin(@Param() params: UuidParamDto) {
    const { id } = params;
    await this.userService.updateLastLogin(id);
    return { message: 'Last login updated successfully' };
  }

  @Get(':id/exists')
  @ApiOperation({ 
    summary: 'Check if a user exists by ID (internal use by auth-service)',
    description: 'Verifies user existence for token validation without returning sensitive data'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Returns whether the user exists.',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean', example: true }
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Invalid UUID format.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  async checkUserExists(@Param() params: UuidParamDto) {
    const { id } = params;
    const exists = await this.userService.exists(id);
    return { exists };
  }
}
