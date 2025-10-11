export class NotificationEventDto {
  userId: string;
  email: string;
  type: 'welcome' | 'security_alert' | 'password_reset' | 'login_alert';
  data?: Record<string, any>;
  timestamp: Date;

  constructor(data: Partial<NotificationEventDto>) {
    Object.assign(this, data);
  }
}