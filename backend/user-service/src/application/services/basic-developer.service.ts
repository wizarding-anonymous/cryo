import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeveloperProfile } from '../../domain/entities/developer-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';
import { CreateDeveloperProfileDto } from './dtos/create-developer-profile.dto';
import { INN } from '../../domain/value-objects/inn.value-object';
import { OGRN } from '../../domain/value-objects/ogrn.value-object';
import { DeveloperProfileUpdatedEvent } from '../events/schemas/developer-profile-updated.event';

@Injectable()
export class BasicDeveloperService {
  constructor(
    @InjectRepository(DeveloperProfile)
    private readonly developerProfileRepository: Repository<DeveloperProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async createBasicDeveloperProfile(dto: CreateDeveloperProfileDto): Promise<DeveloperProfile> {
    const user = await this.userRepository.findOneBy({ id: dto.userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    // Validate INN/OGRN using Value Objects
    if (dto.inn) new INN(dto.inn);
    if (dto.ogrn) new OGRN(dto.ogrn);

    const newProfile = this.developerProfileRepository.create({ ...dto, user });

    return this.developerProfileRepository.save(newProfile);
  }

  async updateBasicDeveloperProfile(
    userId: string,
    updates: Partial<CreateDeveloperProfileDto>,
  ): Promise<DeveloperProfile> {
    const profile = await this.developerProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException(`Developer profile for user ID ${userId} not found`);
    }

    // Validate if new data is provided
    if (updates.inn) new INN(updates.inn);
    if (updates.ogrn) new OGRN(updates.ogrn);

    Object.assign(profile, updates);
    const updatedProfile = await this.developerProfileRepository.save(profile);

    // Publish event
    await this.eventPublisher.publish(
      'developer.profile.updated',
      new DeveloperProfileUpdatedEvent({
        userId: updatedProfile.userId,
        developerId: updatedProfile.id,
        changedFields: Object.keys(updates),
        basicData: {
          companyName: updatedProfile.companyName,
          companyType: updatedProfile.companyType,
        },
        timestamp: new Date().toISOString(),
      }),
    );

    return updatedProfile;
  }

  async getBasicProfileByUserId(userId: string): Promise<DeveloperProfile> {
    const profile = await this.developerProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException(`Developer profile for user ID ${userId} not found`);
    }
    return profile;
  }

  async updateVerificationStatus(userId: string, status: string): Promise<DeveloperProfile> {
    const profile = await this.developerProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException(`Developer profile for user ID ${userId} not found`);
    }

    const previousStatus = profile.verificationStatus;
    profile.verificationStatus = status;
    profile.isVerified = status === 'approved';

    if (status === 'approved') {
      profile.verifiedAt = new Date();
    }

    const updatedProfile = await this.developerProfileRepository.save(profile);

    // Publish verification changed event
    await this.eventPublisher.publish('developer.verification.changed', {
      userId: updatedProfile.userId,
      verificationStatus: status,
      previousStatus,
      timestamp: new Date().toISOString(),
    });

    return updatedProfile;
  }
}
