import {
    Controller, Post, Body, HttpException, HttpStatus, UseInterceptors, UploadedFile, Req, UseGuards, Get, Delete, Param, ParseUUIDPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from '../../../application/services/user.service';
import { SessionService } from '../../../application/services/session.service';
import { CreateUserDto } from '../../../application/services/dtos/create-user.dto';
import { MockAvatarService } from '../../../application/services/mock-avatar.service';
import { MockExternalIntegrationService } from '../../../application/services/mock-external-integration.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Users & Registration')
@Controller('users')
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly avatarService: MockAvatarService,
        private readonly integrationService: MockExternalIntegrationService,
        private readonly sessionService: SessionService,
    ) {}

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User created. Please check your email for verification.'})
    @ApiResponse({ status: 409, description: 'User with this email or username already exists.'})
    async register(@Body() createUserDto: CreateUserDto) {
        try {
            await this.userService.createUser(createUserDto);
            return { message: 'User created. Please check your email for verification.' };
        } catch (error) {
            if (error.constructor.name === 'ConflictException') {
                throw new HttpException(error.message, HttpStatus.CONFLICT);
            }
            throw error;
        }
    }

    @Post('me/avatar')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('avatar'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: "Upload the current user's avatar" })
    @ApiBody({
      schema: {
        type: 'object',
        properties: {
          avatar: { type: 'string', format: 'binary' },
        },
      },
    })
    async uploadAvatar(@Req() req, @UploadedFile() file: Express.Multer.File) {
      const avatarUrl = await this.avatarService.uploadAvatar(req.user.userId, file);
      await this.userService.updateAvatarUrl(req.user.userId, avatarUrl);
      return { avatarUrl, message: 'Avatar uploaded successfully' };
    }

    @Post('me/import/steam')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: "Import user data from Steam (Mock)" })
    async importFromSteam(@Req() req, @Body() body: { steamId: string }) {
        return this.integrationService.importFromSteam(req.user.userId, body.steamId);
    }

    @Post('me/import/epic')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: "Import user data from Epic Games (Mock)" })
    async importFromEpic(@Req() req, @Body() body: { epicId: string }) {
        return this.integrationService.importFromEpicGames(req.user.userId, body.epicId);
    }

    @Get('me/sessions')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: "Get current user's active sessions" })
    async getActiveSessions(@Req() req) {
        // Placeholder implementation
        return [];
    }

    @Delete('me/sessions/:sessionId')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: "Terminate a specific user session" })
    async terminateSession(@Req() req, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
        // Placeholder implementation
        await this.sessionService.terminateSession(sessionId);
        return { message: 'Session terminated' };
    }
}
