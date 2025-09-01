import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';
import { IPaymentServiceIntegration } from '../../domain/interfaces/payment-service.interface';
import { UserBlockedEvent } from '../events/schemas/user-blocked.event';

// Define DTOs for search criteria and paginated results
export class UserSearchCriteria {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  email?: string;
  username?: string;
  isBlocked?: boolean;
}

export class PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventPublisher: EventPublisher,
    @Inject(IPaymentServiceIntegration) private readonly paymentService: IPaymentServiceIntegration,
  ) {}

  async searchUsers(criteria: UserSearchCriteria): Promise<PaginatedResult<User>> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (criteria.email) {
      queryBuilder.andWhere('user.email ILIKE :email', { email: `%${criteria.email}%` });
    }
    if (criteria.username) {
      queryBuilder.andWhere('user.username ILIKE :username', { username: `%${criteria.username}%` });
    }
    if (criteria.isBlocked !== undefined) {
      queryBuilder.andWhere('user.isBlocked = :isBlocked', { isBlocked: criteria.isBlocked });
    }

    const sortField = criteria.sortBy || 'createdAt';
    const sortOrder = criteria.sortOrder || 'DESC';
    queryBuilder.orderBy(`user.${sortField}`, sortOrder);

    const page = criteria.page || 1;
    const limit = criteria.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      data: users.map(u => {
        delete u.passwordHash;
        return u;
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async blockUser(userId: string, adminId: string, reason: string, duration?: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.isBlocked = true;
    user.blockReason = reason;

    if (duration) {
      const blockExpiresAt = new Date();
      blockExpiresAt.setHours(blockExpiresAt.getHours() + duration);
      user.blockExpiresAt = blockExpiresAt;
    }

    const updatedUser = await this.userRepository.save(user);

    // Интеграция с Payment Service
    await this.paymentService.notifyUserBlocked({
      userId: updatedUser.id,
      reason: reason,
      blockedBy: adminId,
      duration,
      timestamp: new Date(),
    });

    return updatedUser;
  }

  async unblockUser(userId: string, adminId: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.isBlocked = false;
    user.blockReason = null;
    user.blockExpiresAt = null;

    const updatedUser = await this.userRepository.save(user);

    // Интеграция с Payment Service
    await this.paymentService.notifyUserUnblocked({
      userId: updatedUser.id,
      unblockedBy: adminId,
      timestamp: new Date(),
    });

    return updatedUser;
  }

  async getUserPaymentStatus(userId: string): Promise<{
    canMakePayments: boolean;
    canReceivePayments: boolean;
    restrictions: string[];
  }> {
    return this.paymentService.checkUserStatus(userId);
  }
}
