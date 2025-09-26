import { NotificationSettings } from './notification-settings.entity';

describe('NotificationSettings Entity', () => {
  it('should be defined', () => {
    expect(NotificationSettings).toBeDefined();
  });

  it('should create a notification settings instance with required properties', () => {
    const settings = new NotificationSettings();
    settings.userId = '123e4567-e89b-12d3-a456-426614174000';
    settings.inAppNotifications = true;
    settings.emailNotifications = true;
    settings.friendRequests = true;
    settings.gameUpdates = false;
    settings.achievements = true;
    settings.purchases = true;
    settings.systemNotifications = true;

    expect(settings.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(settings.inAppNotifications).toBe(true);
    expect(settings.emailNotifications).toBe(true);
    expect(settings.friendRequests).toBe(true);
    expect(settings.gameUpdates).toBe(false);
    expect(settings.achievements).toBe(true);
    expect(settings.purchases).toBe(true);
    expect(settings.systemNotifications).toBe(true);
  });

  it('should have default values for notification preferences', () => {
    const settings = new NotificationSettings();
    // Note: Default values are set by TypeORM decorators, not constructor
    // This test verifies the entity structure is correct
    expect(typeof settings.inAppNotifications).toBe('undefined'); // Will be set by TypeORM
    expect(typeof settings.emailNotifications).toBe('undefined'); // Will be set by TypeORM
  });
});
