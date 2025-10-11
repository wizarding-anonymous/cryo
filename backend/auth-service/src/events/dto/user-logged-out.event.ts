export class UserLoggedOutEvent {
  userId: string;
  sessionId: string;
  ipAddress: string;
  reason: 'manual' | 'security' | 'expired';
  timestamp: Date;

  constructor(data: Partial<UserLoggedOutEvent>) {
    Object.assign(this, data);
  }
}