import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { FriendsService } from '../friends/friends.service';
import { NotFriendsException } from '../common/exceptions/not-friends.exception';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { MessageNotFoundException } from '../common/exceptions/message-not-found.exception';
import { NotificationServiceClient } from '../clients/notification.service.client';
import { UserServiceClient } from '../clients/user.service.client';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly friendsService: FriendsService,
    private readonly notificationServiceClient: NotificationServiceClient,
    private readonly userServiceClient: UserServiceClient,
  ) {}

  async sendMessage(fromUserId: string, dto: SendMessageDto): Promise<Message> {
    const areFriends = await this.friendsService.checkFriendship(fromUserId, dto.toUserId);
    if (!areFriends) {
      throw new NotFriendsException();
    }

    const message = this.messageRepository.create({
      fromUserId,
      toUserId: dto.toUserId,
      content: dto.content,
    });

    const savedMessage = await this.messageRepository.save(message);

    await this.notificationServiceClient.sendNotification({
        userId: dto.toUserId,
        type: 'new_message',
        title: 'New Message',
        message: `You have a new message from user ${fromUserId}`,
        metadata: { fromUserId, messageId: savedMessage.id }
    });

    return savedMessage;
  }

  async getConversations(userId: string) {
    // This query is complex and for a real-world scenario would need optimization.
    // It gets the last message for each conversation partner.
    const recentMessages = await this.messageRepository.query(
        `SELECT DISTINCT ON (partner_id) * FROM (
            SELECT m.*, CASE WHEN "fromUserId" = $1 THEN "toUserId" ELSE "fromUserId" END AS partner_id
            FROM messages m
            WHERE "fromUserId" = $1 OR "toUserId" = $1
        ) AS subquery ORDER BY partner_id, "createdAt" DESC;`,
        [userId]
    );

    const partnerIds = recentMessages.map(msg => msg.partner_id);
    const partnersInfo = await this.userServiceClient.getUsersByIds(partnerIds);

    const conversations = recentMessages.map(msg => {
        const partnerInfo = partnersInfo.find(p => p.id === msg.partner_id);
        return {
            friendId: msg.partner_id,
            friendInfo: partnerInfo,
            lastMessage: msg,
            // unreadCount would require another query.
        };
    });

    return conversations;
  }

  async getConversation(userId: string, friendId: string, options: MessagesQueryDto) {
    const { page = 1, limit = 50 } = options;

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

    return {
        messages: messages.reverse(),
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }
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
        }
    });
  }
}
