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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthRequest } from '../common/interfaces/auth-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendshipGuard } from '../auth/guards/friendship.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import { MessageDto } from './dto/message.dto';
import { ConversationDto } from './dto/conversation.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FriendshipGuard, RateLimitGuard)
@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message to a friend' })
  @ApiCreatedResponse({ type: MessageDto })
  async sendMessage(@Req() req: AuthRequest, @Body() dto: SendMessageDto): Promise<MessageDto> {
    const fromUserId = req.user.userId;
    return this.messagingService.sendMessage(fromUserId, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get a list of conversations' })
  @ApiOkResponse({ type: [ConversationDto] })
  async getConversations(@Req() req: AuthRequest): Promise<ConversationDto[]> {
    const userId = req.user.userId;
    return this.messagingService.getConversations(userId);
  }

  @Get('conversations/:friendId')
  @ApiOperation({ summary: 'Get conversation history with a friend' })
  @ApiOkResponse({ type: ConversationResponseDto })
  async getConversation(
    @Req() req: AuthRequest,
    @Param('friendId') friendId: string,
    @Query() query: MessagesQueryDto,
  ): Promise<ConversationResponseDto> {
    const userId = req.user.userId;
    return this.messagingService.getConversation(userId, friendId, query);
  }

  @Put(':messageId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a message as read' })
  @ApiNoContentResponse()
  async markAsRead(@Req() req: AuthRequest, @Param('messageId') messageId: string): Promise<void> {
    const userId = req.user.userId;
    await this.messagingService.markAsRead(messageId, userId);
  }
}
