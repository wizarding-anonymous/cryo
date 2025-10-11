export class UserLoggedInEvent {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;

  constructor(data: Partial<UserLoggedInEvent>) {
    Object.assign(this, data);
  }
}