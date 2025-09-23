import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { FriendsService } from '../friends/friends.service';
import { NotFriendsException } from '../common/exceptions/not-friends.exception';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { MessageNotFoundException } from '../common/exceptions/message-not-found.exception';
import { RateLimitExceededException } from '../common/exceptions/rate-limit-exceeded.exception';
import { NotificationServiceClient } from '../clients/notification.service.client';
import { UserServiceClient } from '../clients/user.service.client';
import { CacheService } from '../cache/cache.service';
import { MessageDto } from './dto/message.dto';
import { ConversationDto } from './dto/conversation.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { UserStatus } from '../status/entities/user-status.enum';

@Injectable()
export class MessagingService {
  private readonly MESSAGE_RATE_LIMIT = 20; // messages per minute
  private readonly RATE_LIMIT_WINDOW = 60; // seconds

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly friendsService: FriendsService,
    private readonly notificationServiceClient: NotificationServiceClient,
    private readonly userServiceClient: UserServiceClient,
    private readonly cacheService: CacheService,
  ) {}

  async sendMessage(fromUserId: string, dto: SendMessageDto): Promise<MessageDto> {
    // Check rate limiting
    await this.checkRateLimit(fromUserId);

    // Check if users are friends
    const areFriends = await this.friendsService.checkFriendship(fromUserId, dto.toUserId);
    if (!areFriends) {
      throw new NotFriendsException();
    }

    // Create and save message
    const message = this.messageRepository.create({
      fromUserId,
      toUserId: dto.toUserId,
      content: dto.content,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Send notification (with error handling)
    try {
      await this.notificationServiceClient.sendNotification({
        userId: dto.toUserId,
        type: 'new_message',
        title: 'New Message',
        message: `You have a new message from user ${fromUserId}`,
        metadata: { fromUserId, messageId: savedMessage.id },
      });
    } catch (error) {
      // Log error but don't fail the message sending
      console.error('Failed to send notification:', error);
    }

    return this.toMessageDto(savedMessage);
  }

  async getConversations(userId: string): Promise<ConversationDto[]> {
    // Get recent messages for each conversation
    const recentMessages = await this.messageRepository.query(
      `SELECT DISTINCT ON (partner_id) * FROM (
            SELECT m.*, CASE WHEN "fromUserId" = $1 THEN "toUserId" ELSE "fromUserId" END AS partner_id
            FROM messages m
            WHERE "fromUserId" = $1 OR "toUserId" = $1 
        ) AS subquery ORDER BY partner_id, "createdAt" DESC`,
      [userId],
    );

    if (recentMessages.length === 0) {
      return [];
    }

    // Get partner information
    const partnerIds = recentMessages.map((msg: any) => msg.partner_id);
    const partnersInfo = await this.userServiceClient.getUsersByIds(partnerIds);
    const infoMap = new Map<string, any>(partnersInfo.map((info) => [info.id, info]));

    // Get unread counts for each conversation
    const unreadCounts = await this.getUnreadCountsForConversations(userId, partnerIds);

    return recentMessages.map((raw: any) => {
      const partnerInfo = infoMap.get(raw.partner_id);
      return {
        friendId: raw.partner_id,
        friendInfo: this.buildConversationFriendInfo(partnerInfo),
        lastMessage: this.toMessageDto({
          id: raw.id,
          fromUserId: raw.fromUserId,
          toUserId: raw.toUserId,
          content: raw.content,
          isRead: raw.isRead,
          readAt: raw.readAt,
          createdAt: raw.createdAt,
        }),
        unreadCount: unreadCounts.get(raw.partner_id) || 0,
      } as ConversationDto;
    });
  }

  async getConversation(
    userId: string,
    friendId: string,
    options: MessagesQueryDto,
  ): Promise<ConversationResponseDto> {
    const { page = 1, limit = 50 } = options;

    // Verify friendship before showing conversation
    const areFriends = await this.friendsService.checkFriendship(userId, friendId);
    if (!areFriends) {
      throw new NotFriendsException();
    }

    const whereCondition = [
      { fromUserId: userId, toUserId: friendId },
      { fromUserId: friendId, toUserId: userId },
    ];

    const [messages, total] = await this.messageRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    // Return messages in chronological order (oldest first)
    const orderedMessages = [...messages].reverse();
    const messageDtos = orderedMessages.map((message) => this.toMessageDto(message));

    return {
      messages: messageDtos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / Math.max(limit, 1)),
      },
    };
  }

  async markAsRead(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOneBy({ id: messageId });

    if (!message || message.toUserId !== userId) {
      throw new MessageNotFoundException(messageId);
    }

    if (!message.isRead) {
      message.isRead = true;
      message.readAt = new Date();
      await this.messageRepository.save(message);
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.messageRepository.count({
      where: {
        toUserId: userId,
        isRead: false,
      },
    });
  }

  private toMessageDto(message: Message | any): MessageDto {
    const createdAtValue =
      message.createdAt instanceof Date
        ? message.createdAt
        : message.createdAt
          ? new Date(message.createdAt)
          : new Date();

    return {
      id: message.id,
      fromUserId: message.fromUserId,
      toUserId: message.toUserId,
      content: message.content,
      isRead: Boolean(message.isRead),
      readAt: message.readAt ? new Date(message.readAt) : undefined,
      createdAt: createdAtValue,
    };
  }

  private buildConversationFriendInfo(raw: any): ConversationDto['friendInfo'] {
    return {
      username: raw?.username ?? raw?.displayName ?? 'Unknown user',
      avatar: raw?.avatar,
      onlineStatus: (raw?.onlineStatus ?? raw?.status ?? UserStatus.OFFLINE) as UserStatus,
    };
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const key = `rate-limit:messages:${userId}`;
    const currentCount = await this.cacheService.get<number>(key);

    if (currentCount === undefined || currentCount === null) {
      await this.cacheService.set(key, 1, this.RATE_LIMIT_WINDOW);
      return;
    }

    if (currentCount >= this.MESSAGE_RATE_LIMIT) {
      throw new RateLimitExceededException(this.MESSAGE_RATE_LIMIT);
    }

    await this.cacheService.set(key, currentCount + 1, this.RATE_LIMIT_WINDOW);
  }

  private async getUnreadCountsForConversations(
    userId: string,
    partnerIds: string[],
  ): Promise<Map<string, number>> {
    const unreadCounts = new Map<string, number>();

    for (const partnerId of partnerIds) {
      const count = await this.messageRepository.count({
        where: {
          fromUserId: partnerId,
          toUserId: userId,
          isRead: false,
        },
      });
      unreadCounts.set(partnerId, count);
    }

    return unreadCounts;
  }
}
