import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublisherProfile } from '../../domain/entities/publisher-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';
import { CreatePublisherProfileDto } from './dtos/create-publisher-profile.dto';
import { INN } from '../../domain/value-objects/inn.value-object';
import { OGRN } from '../../domain/value-objects/ogrn.value-object';
import { KPP } from '../../domain/value-objects/kpp.value-object';
import { PublisherProfileUpdatedEvent } from '../events/schemas/publisher-profile-updated.event.ts';
import { PublisherVerificationChangedEvent } from '../events/schemas/publisher-verification-changed.event.ts';
import { VerificationStatus } from '../events/types/verification-status.enum';

@Injectable()
export class BasicPublisherService {
  constructor(
    @InjectRepository(PublisherProfile)
    private readonly publisherProfileRepository: Repository<PublisherProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async createBasicPublisherProfile(dto: CreatePublisherProfileDto): Promise<PublisherProfile> {
    const user = await this.userRepository.findOneBy({ id: dto.userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    // Validate requisites
    new INN(dto.corporateInfo.inn);
    new OGRN(dto.corporateInfo.ogrn);
    if (dto.corporateInfo.kpp) new KPP(dto.corporateInfo.kpp);

    const newProfile = this.publisherProfileRepository.create({ ...dto, user });

    return this.publisherProfileRepository.save(newProfile);
  }

  async updateBasicPublisherProfile(userId: string, updates: Partial<CreatePublisherProfileDto>): Promise<PublisherProfile> {
    const profile = await this.publisherProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException(`Publisher profile for user ID ${userId} not found`);
    }

    // In a real application, we would handle deep merging of JSONB fields
    Object.assign(profile, updates);
    const updatedProfile = await this.publisherProfileRepository.save(profile);

    // Publish event
    await this.eventPublisher.publish(
        'publisher.profile.updated',
        new PublisherProfileUpdatedEvent({
            userId: updatedProfile.userId,
            publisherId: updatedProfile.id,
            changedFields: Object.keys(updates),
            basicData: {
                companyName: updatedProfile.companyName,
                companyType: updatedProfile.companyType,
            },
            timestamp: new Date().toISOString(),
        }),
        PublisherProfileUpdatedEvent,
    );

    return updatedProfile;
  }

  async updateVerificationStatus(userId: string, newStatus: VerificationStatus): Promise<PublisherProfile> {
    const profile = await this.publisherProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException(`Publisher profile for user ID ${userId} not found`);
    }

    const oldStatus = profile.verification.status;

    profile.verification = {
      ...profile.verification,
      status: newStatus,
      isVerified: newStatus === VerificationStatus.Approved,
      verifiedAt: newStatus === VerificationStatus.Approved ? new Date() : profile.verification.verifiedAt,
    };

    const updatedProfile = await this.publisherProfileRepository.save(profile);

    // Publish event
    await this.eventPublisher.publish(
        'publisher.verification.changed',
        new PublisherVerificationChangedEvent({ // Assuming a similar event schema exists
            userId: updatedProfile.userId,
            publisherId: updatedProfile.id,
            newStatus: newStatus,
            timestamp: new Date().toISOString(),
        }),
        PublisherVerificationChangedEvent,
    );

    return updatedProfile;
  }

  async getBasicProfileByUserId(userId: string): Promise<PublisherProfile> {
    const profile = await this.publisherProfileRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException(`Publisher profile for user ID ${userId} not found`);
    }
    return profile;
  }
}
