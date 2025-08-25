import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeveloperProfile } from '../../domain/entities/developer-profile.entity';
import { PublisherProfile } from '../../domain/entities/publisher-profile.entity';
import { EventPublisher } from '../events/event-publisher.service';
import { VerificationState, VerificationDocument, AutoCheckResult } from './types/verification.types';
import { VerificationStatus } from '../events/types/verification-status.enum';
import { DeveloperVerificationChangedEvent } from '../events/schemas/developer-verification-changed.event';
import { PublisherVerificationChangedEvent } from '../events/schemas/publisher-verification-changed.event';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(DeveloperProfile)
    private readonly developerProfileRepository: Repository<DeveloperProfile>,
    @InjectRepository(PublisherProfile)
    private readonly publisherProfileRepository: Repository<PublisherProfile>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async submitForVerification(
    userId: string,
    documents: VerificationDocument[],
    profileType: 'developer' | 'publisher',
  ): Promise<VerificationState> {
    this.logger.log(`Starting verification for ${profileType} profile of user ${userId}`);

    // In a real app, we would validate file existence, e.g., this.fileExists(doc.filePath)

    // Initial state
    await this.updateState(userId, profileType, VerificationState.SUBMITTED);

    // Automatic checks
    await this.updateState(userId, profileType, VerificationState.AUTO_CHECKING);
    const autoResult = await this.runAutomaticChecks(documents);

    let finalState: VerificationState;
    if (autoResult.confidence > 0.8) {
      finalState = VerificationState.APPROVED;
    } else if (autoResult.confidence < 0.3) {
      finalState = VerificationState.REJECTED;
    } else {
      finalState = VerificationState.MANUAL_REVIEW;
    }

    this.logger.log(`Automatic checks for user ${userId} resulted in state: ${finalState}`);
    await this.updateState(userId, profileType, finalState, true); // isFinalState = true

    return finalState;
  }

  private async runAutomaticChecks(documents: VerificationDocument[]): Promise<AutoCheckResult> {
    // Smart mock implementation
    this.logger.log('Running smart mock automatic checks...');
    for (const doc of documents) {
      if (!doc.filePath.toLowerCase().endsWith('.pdf') && !doc.filePath.toLowerCase().endsWith('.jpg')) {
        return { isValid: false, confidence: 0.1, reason: 'Invalid file format' };
      }
    }

    const passesAutoCheck = Math.random() > 0.1; // 90% chance to pass for demo
    if (passesAutoCheck) {
      return { isValid: true, confidence: 0.85, reason: 'Passed automatic verification' };
    } else {
      return { isValid: false, confidence: 0.4, reason: 'Requires manual review' };
    }
  }

  private async updateState(
    userId: string,
    profileType: 'developer' | 'publisher',
    state: VerificationState,
    isFinalState: boolean = false,
  ) {
    const verificationStatus = this.mapStateToStatus(state);
    if (profileType === 'developer') {
      const profile = await this.developerProfileRepository.findOneBy({ userId });
      if (!profile) throw new NotFoundException('Developer profile not found');

      profile.verificationStatus = verificationStatus;
      if(isFinalState) {
        profile.isVerified = state === VerificationState.APPROVED;
        await this.eventPublisher.publish('developer.verification.changed', new DeveloperVerificationChangedEvent({
          userId: profile.userId,
          developerId: profile.id,
          newStatus: verificationStatus,
          timestamp: new Date().toISOString(),
        }), DeveloperVerificationChangedEvent);
      }
      await this.developerProfileRepository.save(profile);

    } else { // publisher
      const profile = await this.publisherProfileRepository.findOneBy({ userId });
      if (!profile) throw new NotFoundException('Publisher profile not found');

      profile.verification.status = verificationStatus;
      if(isFinalState) {
          profile.verification.isVerified = state === VerificationState.APPROVED;
          await this.eventPublisher.publish('publisher.verification.changed', new PublisherVerificationChangedEvent({
              userId: profile.userId,
              publisherId: profile.id,
              newStatus: verificationStatus,
              timestamp: new Date().toISOString(),
          }), PublisherVerificationChangedEvent);
      }
      await this.publisherProfileRepository.save(profile);
    }
  }

  private mapStateToStatus(state: VerificationState): VerificationStatus {
      switch (state) {
          case VerificationState.APPROVED:
              return VerificationStatus.Approved;
          case VerificationState.REJECTED:
              return VerificationStatus.Rejected;
          default:
              return VerificationStatus.Pending;
      }
  }
}
