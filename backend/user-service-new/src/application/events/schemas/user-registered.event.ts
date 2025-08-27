export interface UserRegisteredEventData {
  userId: string;
  email: string;
  username: string;
  registrationDate: Date;
  source: 'direct' | 'oauth';
  oauthProvider?: string;
}

export class UserRegisteredEvent {
  constructor(public readonly data: UserRegisteredEventData) {}
}