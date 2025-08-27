import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';
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
      data: users.map(u => { delete u.passwordHash; return u; }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async blockUser(userId: string, adminId: string, reason: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    user.isBlocked = true;
    user.blockReason = reason;
    const updatedUser = await this.userRepository.save(user);

    await this.eventPublisher.publish(
        'user.blocked',
        new UserBlockedEvent({
            userId: updatedUser.id,
            reason: reason,
            blockedBy: adminId,
            timestamp: new Date().toISOString(),
        }),
        UserBlockedEvent,
    );

    return updatedUser;
  }
}
