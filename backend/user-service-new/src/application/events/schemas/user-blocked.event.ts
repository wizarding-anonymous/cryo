export interface UserBlockedEventData {
  userId: string;
  reason: string;
  blockedBy: string;
  expiresAt?: string;
  timestamp: string;
}

export class UserBlockedEvent {
  constructor(public readonly data: UserBlockedEventData) {}
}