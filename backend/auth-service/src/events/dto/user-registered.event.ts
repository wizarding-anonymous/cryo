export class UserRegisteredEvent {
  userId: string;
  email: string;
  name: string;
  ipAddress: string;
  timestamp: Date;

  constructor(data: Partial<UserRegisteredEvent>) {
    Object.assign(this, data);
  }
}