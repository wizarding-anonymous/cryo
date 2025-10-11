export class UserEventDto {
  userId: string;
  type: 'update_last_login' | 'profile_update' | 'account_status_change';
  data?: Record<string, any>;
  timestamp: Date;

  constructor(data: Partial<UserEventDto>) {
    Object.assign(this, data);
  }
}