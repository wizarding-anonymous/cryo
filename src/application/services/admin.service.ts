import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';

// Define DTOs for search criteria and paginated results
// These would live in separate files in a real app
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
      data: users.map(u => { delete u.passwordHash; return u; }), // Exclude password hash
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async blockUser(userId: string, reason: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    user.isBlocked = true;
    user.blockReason = reason;
    return this.userRepository.save(user);
  }
}
