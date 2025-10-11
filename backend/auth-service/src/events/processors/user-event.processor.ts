import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { UserEventDto } from '../dto';
import { UserServiceClient } from '../../common/http-client/user-service.client';

@Injectable()
@Processor('user-events')
export class UserEventProcessor {
  private readonly logger = new Logger(UserEventProcessor.name);

  constructor(
    private readonly userServiceClient: UserServiceClient,
  ) {}

  @Process('update-user-data')
  async handleUserEvent(job: Job<UserEventDto>): Promise<void> {
    const event = job.data;
    const jobId = job.id;
    const attemptNumber = job.attemptsMade + 1;
    
    try {
      this.logger.log(
        `Processing user event (Job: ${jobId}, Attempt: ${attemptNumber}): ${event.type} for user ${event.userId}`
      );
      
      // Validate user event data
      await this.validateUserEvent(event);
      
      // TODO: In future tasks, this will integrate with User Service
      // For now, we'll process the event locally
      await this.processUserEventLocally(event);
      
      this.logger.log(
        `User event processed successfully (Job: ${jobId}): ${event.type} for user ${event.userId}`
      );
    } catch (error) {
      const errorMessage = `Failed to process user event (Job: ${jobId}, Attempt: ${attemptNumber}): ${error.message}`;
      
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
          `User event processing failed permanently after ${maxAttempts} attempts (Job: ${jobId}). Moving to dead letter queue.`,
          {
            jobId,
            eventType: event.type,
            userId: event.userId,
            finalError: error.message,
          }
        );
        
        // Store failed event for manual processing
        await this.storeFailedUserEvent(event, error.message);
      }
      
      // Re-throw to trigger Bull's retry mechanism with exponential backoff
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job<UserEventDto>) {
    this.logger.debug(
      `User event processing started (Job: ${job.id}): ${job.data.type} for user ${job.data.userId}`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<UserEventDto>) {
    this.logger.debug(
      `User event processing completed (Job: ${job.id}): ${job.data.type} for user ${job.data.userId}`
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<UserEventDto>, error: Error) {
    this.logger.warn(
      `User event processing failed (Job: ${job.id}): ${job.data.type} for user ${job.data.userId}. Error: ${error.message}`
    );
  }

  private async validateUserEvent(event: UserEventDto): Promise<void> {
    if (!event.userId) {
      throw new Error('User event missing userId');
    }
    
    if (!event.type) {
      throw new Error('User event missing type');
    }

    const validTypes = ['update_last_login', 'profile_update', 'account_status_change'];
    if (!validTypes.includes(event.type)) {
      throw new Error(`Invalid user event type: ${event.type}`);
    }

    // Validate specific event data based on type
    switch (event.type) {
      case 'update_last_login':
        if (!event.data?.lastLoginAt) {
          throw new Error('update_last_login event missing lastLoginAt in data');
        }
        break;
      case 'profile_update':
        if (!event.data || Object.keys(event.data).length === 0) {
          throw new Error('profile_update event missing update data');
        }
        break;
      case 'account_status_change':
        if (!event.data?.status) {
          throw new Error('account_status_change event missing status in data');
        }
        break;
    }
  }

  private async processUserEventLocally(event: UserEventDto): Promise<void> {
    // Log structured user event
    const logData = {
      eventType: 'USER_EVENT',
      userId: event.userId,
      userEventType: event.type,
      data: event.data,
      timestamp: event.timestamp,
      correlationId: `user_${event.userId}_${Date.now()}`,
    };

    this.logger.log(`User Event: ${JSON.stringify(logData)}`);
    
    // Process user data based on type with proper error handling
    try {
      switch (event.type) {
        case 'update_last_login':
          await this.processLastLoginUpdate(event);
          break;
        case 'profile_update':
          await this.processProfileUpdate(event);
          break;
        case 'account_status_change':
          await this.processAccountStatusChange(event);
          break;
        default:
          await this.processGenericUserEvent(event);
      }
    } catch (processingError) {
      this.logger.error(
        `Failed to process ${event.type} user event: ${processingError.message}`,
        {
          userId: event.userId,
          eventType: event.type,
          eventData: event.data,
          error: processingError.message,
        }
      );
      throw processingError;
    }
    
    // TODO: Send to User Service when implemented in task 4.2
  }

  private async processLastLoginUpdate(event: UserEventDto): Promise<void> {
    this.logger.log(
      `Processing last login update for user ${event.userId}`
    );
    
    try {
      // Call User Service to update last login timestamp
      // Requirements: 11.2 - Move last login update to event handler
      await this.userServiceClient.updateLastLogin(event.userId);
      
      this.logger.log(
        `Successfully updated last login for user ${event.userId} to ${event.data.lastLoginAt} from IP ${event.data.ipAddress}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to update last login for user ${event.userId}: ${error.message}`,
        {
          userId: event.userId,
          lastLoginAt: event.data.lastLoginAt,
          ipAddress: event.data.ipAddress,
          error: error.message,
        }
      );
      
      // Re-throw to trigger retry mechanism
      throw error;
    }
  }

  private async processProfileUpdate(event: UserEventDto): Promise<void> {
    this.logger.log(
      `Processing profile update for user ${event.userId}`
    );
    
    const allowedFields = ['name', 'email', 'preferences', 'settings'];
    const updateData = {};
    
    // Filter only allowed fields for security
    for (const [key, value] of Object.entries(event.data)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update in profile');
    }
    
    this.logger.log(
      `Would update profile for user ${event.userId} with data: ${JSON.stringify(updateData)}`
    );
    
    // TODO: Call User Service PATCH /users/:id endpoint
    // await this.userServiceClient.updateProfile(event.userId, updateData);
  }

  private async processAccountStatusChange(event: UserEventDto): Promise<void> {
    this.logger.log(
      `Processing account status change for user ${event.userId}`
    );
    
    const validStatuses = ['active', 'inactive', 'suspended', 'deleted'];
    const newStatus = event.data.status;
    
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid account status: ${newStatus}`);
    }
    
    const statusData = {
      status: newStatus,
      reason: event.data.reason || 'System update',
      changedBy: event.data.changedBy || 'system',
      changedAt: event.timestamp,
    };
    
    this.logger.log(
      `Would update account status for user ${event.userId} to ${newStatus} (reason: ${statusData.reason})`
    );
    
    // TODO: Call User Service PATCH /users/:id/status endpoint
    // await this.userServiceClient.updateAccountStatus(event.userId, statusData);
  }

  private async processGenericUserEvent(event: UserEventDto): Promise<void> {
    this.logger.log(
      `Processing generic user event ${event.type} for user ${event.userId}`
    );
    
    this.logger.log(
      `Would process ${event.type} for user ${event.userId} with data: ${JSON.stringify(event.data)}`
    );
    
    // TODO: Handle other user event types as they are added
  }

  private async storeFailedUserEvent(event: UserEventDto, errorMessage: string): Promise<void> {
    try {
      // Log failed user event for manual processing
      const failedEventLog = {
        eventType: 'FAILED_USER_EVENT',
        userId: event.userId,
        userEventType: event.type,
        originalData: event.data,
        errorMessage,
        failedAt: new Date(),
        requiresManualProcessing: true,
        correlationId: `failed_user_${event.userId}_${Date.now()}`,
      };

      this.logger.error(
        `Failed user event stored for manual processing: ${JSON.stringify(failedEventLog)}`
      );
      
      // TODO: In future, store in database table for failed user events
    } catch (storageError) {
      this.logger.error(
        `Critical: Failed to store failed user event: ${storageError.message}`,
        {
          originalEvent: event,
          originalError: errorMessage,
          storageError: storageError.message,
        }
      );
    }
  }
}