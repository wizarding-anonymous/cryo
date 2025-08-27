export interface DeveloperVerificationChangedEventData {
  userId: string;
  verificationStatus: string;
  previousStatus: string;
  timestamp: string;
}

export class DeveloperVerificationChangedEvent {
  constructor(public readonly data: DeveloperVerificationChangedEventData) {}
}