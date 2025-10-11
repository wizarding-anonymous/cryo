import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { SecurityEventDto } from '../dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityEvent } from '../../entities/security-event.entity';

@Injectable()
@Processor('security-events')
export class SecurityEventProcessor {
  private readonly logger = new Logger(SecurityEventProcessor.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly securityEventRepository: Repository<SecurityEvent>,
  ) {}

  @Process('log-security-event')
  async handleSecurityEvent(job: Job<SecurityEventDto>): Promise<void> {
    const event = job.data;
    const jobId = job.id;
    const attemptNumber = job.attemptsMade + 1;
    
    try {
      this.logger.log(
        `Processing security event (Job: ${jobId}, Attempt: ${attemptNumber}): ${event.type} for user ${event.userId}`
      );
      
      // Store security event locally for audit trail
      await this.storeSecurityEventLocally(event);
      
      // TODO: In future tasks, this will integrate with Security Service
      // For now, we'll log the event locally
      await this.logSecurityEventLocally(event);
      
      this.logger.log(
        `Security event processed successfully (Job: ${jobId}): ${event.type} for user ${event.userId}`
      );
    } catch (error) {
      const errorMessage = `Failed to process security event (Job: ${jobId}, Attempt: ${attemptNumber}): ${error.message}`;
      
      // Log error with context
      this.logger.error(errorMessage, {
        jobId,
        attemptNumber,
        maxAttempts: job.opts.attempts || 3,
        eventType: event.type,
        userId: event.userId,
        error: error.message,
        stack: error.stack,
      });

      // Check if this is the final attempt
      const maxAttempts = job.opts.attempts || 3;
      if (attemptNumber >= maxAttempts) {
        this.logger.error(
          `Security event processing failed permanently after ${maxAttempts} attempts (Job: ${jobId}). Moving to dead letter queue.`,
          {
            jobId,
            eventType: event.type,
            userId: event.userId,
            finalError: error.message,
          }
        );
        
        // Store failed event for manual processing
        await this.storeFailedSecurityEvent(event, error.message);
      }
      
      // Re-throw to trigger Bull's retry mechanism with exponential backoff
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job<SecurityEventDto>) {
    this.logger.debug(
      `Security event processing started (Job: ${job.id}): ${job.data.type} for user ${job.data.userId}`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<SecurityEventDto>) {
    this.logger.debug(
      `Security event processing completed (Job: ${job.id}): ${job.data.type} for user ${job.data.userId}`
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<SecurityEventDto>, error: Error) {
    this.logger.warn(
      `Security event processing failed (Job: ${job.id}): ${job.data.type} for user ${job.data.userId}. Error: ${error.message}`
    );
  }

  private async storeSecurityEventLocally(event: SecurityEventDto): Promise<SecurityEvent> {
    try {
      const securityEvent = this.securityEventRepository.create({
        userId: event.userId,
        type: event.type,
        ipAddress: event.ipAddress,
        metadata: {
          userAgent: event.userAgent,
          ...event.metadata,
        },
        processed: false, // Will be set to true when sent to Security Service
      });

      const savedEvent = await this.securityEventRepository.save(securityEvent);
      
      this.logger.debug(
        `Security event stored locally with ID: ${savedEvent.id} for user ${event.userId}`
      );
      
      return savedEvent;
    } catch (error) {
      this.logger.error(
        `Failed to store security event locally: ${error.message}`,
        {
          userId: event.userId,
          eventType: event.type,
          error: error.message,
        }
      );
      throw error;
    }
  }

  private async logSecurityEventLocally(event: SecurityEventDto): Promise<void> {
    // Log structured security event for immediate visibility
    const logData = {
      eventType: 'SECURITY_EVENT',
      userId: event.userId,
      securityEventType: event.type,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: event.metadata,
      timestamp: event.timestamp,
      correlationId: `sec_${event.userId}_${Date.now()}`,
    };

    // Use different log levels based on event severity
    switch (event.type) {
      case 'suspicious_activity':
      case 'brute_force_attack':
      case 'all_sessions_invalidated':
      case 'security_session_invalidation':
        this.logger.warn(`High Priority Security Event: ${JSON.stringify(logData)}`);
        break;
      case 'failed_login':
        this.logger.warn(`Security Event: ${JSON.stringify(logData)}`);
        break;
      case 'login':
      case 'logout':
      case 'registration':
        this.logger.log(`Security Event: ${JSON.stringify(logData)}`);
        break;
      default:
        this.logger.log(`Security Event: ${JSON.stringify(logData)}`);
    }

    // For suspicious activity, add additional alerting
    if (event.type === 'suspicious_activity' || event.type === 'brute_force_attack') {
      this.logger.error(
        `SECURITY ALERT: ${event.type} detected for user ${event.userId} from IP ${event.ipAddress}`,
        {
          userId: event.userId,
          ipAddress: event.ipAddress,
          patterns: event.metadata?.patterns,
          severity: 'HIGH',
          requiresInvestigation: true,
        }
      );
    }
  }

  private async storeFailedSecurityEvent(event: SecurityEventDto, errorMessage: string): Promise<void> {
    try {
      // Store failed event with error details for manual processing
      const failedEvent = this.securityEventRepository.create({
        userId: event.userId,
        type: event.type,
        ipAddress: event.ipAddress,
        metadata: {
          userAgent: event.userAgent,
          ...event.metadata,
          processingError: errorMessage,
          failedAt: new Date(),
          requiresManualProcessing: true,
        },
        processed: false,
      });

      await this.securityEventRepository.save(failedEvent);
      
      this.logger.warn(
        `Failed security event stored for manual processing: ${event.type} for user ${event.userId}`
      );
    } catch (storageError) {
      this.logger.error(
        `Critical: Failed to store failed security event: ${storageError.message}`,
        {
          originalEvent: event,
          originalError: errorMessage,
          storageError: storageError.message,
        }
      );
    }
  }
}