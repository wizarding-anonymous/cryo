import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from '../../../application/services/user.service';
import { CreateUserDto } from '../../../application/services/dtos/create-user.dto';

@ApiTags('Users & Registration')
@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User created. Please check your email for verification.'})
    @ApiResponse({ status: 409, description: 'User with this email or username already exists.'})
    async register(@Body() createUserDto: CreateUserDto) {
        try {
            const user = await this.userService.createUser(createUserDto);
            // In a real app, we wouldn't return the user object here.
            // But for now, it's fine. We return a simple message.
            return { message: 'User created. Please check your email for verification.' };
        } catch (error) {
            if (error.constructor.name === 'ConflictException') {
                throw new HttpException(error.message, HttpStatus.CONFLICT);
            }
            throw error;
        }
    }
}
