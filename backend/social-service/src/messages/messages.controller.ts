import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Query,
  Param,
  Put,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthRequest } from '../common/interfaces/auth-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendshipGuard } from '../auth/guards/friendship.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FriendshipGuard, RateLimitGuard)
@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message to a friend' })
  async sendMessage(@Req() req: AuthRequest, @Body() dto: SendMessageDto) {
    const fromUserId = req.user.userId;
    return this.messagingService.sendMessage(fromUserId, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get a list of conversations' })
  async getConversations(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    return this.messagingService.getConversations(userId);
  }

  @Get('conversations/:friendId')
  @ApiOperation({ summary: 'Get conversation history with a friend' })
  async getConversation(
    @Req() req: AuthRequest,
    @Param('friendId') friendId: string,
    @Query() query: MessagesQueryDto,
  ) {
    const userId = req.user.userId;
    return this.messagingService.getConversation(userId, friendId, query);
  }

  @Put(':messageId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a message as read' })
  async markAsRead(
    @Req() req: AuthRequest,
    @Param('messageId') messageId: string,
  ) {
    const userId = req.user.userId;
    await this.messagingService.markAsRead(messageId, userId);
  }
}
