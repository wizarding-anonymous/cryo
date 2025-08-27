export interface PublisherVerificationChangedEventData {
  userId: string;
  verificationStatus: string;
  previousStatus: string;
  timestamp: string;
}

export class PublisherVerificationChangedEvent {
  constructor(public readonly data: PublisherVerificationChangedEventData) {}
}