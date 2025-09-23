import { Notification } from './notification.entity';
import { NotificationType, NotificationPriority, NotificationChannel } from '../common/enums';

describe('Notification Entity', () => {
  it('should be defined', () => {
    expect(Notification).toBeDefined();
  });

  it('should create a notification instance with required properties', () => {
    const notification = new Notification();
    notification.userId = '123e4567-e89b-12d3-a456-426614174000';
    notification.type = NotificationType.FRIEND_REQUEST;
    notification.title = 'Test Notification';
    notification.message = 'This is a test notification';
    notification.isRead = false;
    notification.priority = NotificationPriority.NORMAL;

    expect(notification.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(notification.type).toBe(NotificationType.FRIEND_REQUEST);
    expect(notification.title).toBe('Test Notification');
    expect(notification.message).toBe('This is a test notification');
    expect(notification.isRead).toBe(false);
    expect(notification.priority).toBe(NotificationPriority.NORMAL);
  });

  it('should support optional properties', () => {
    const notification = new Notification();
    notification.metadata = { gameId: '123', action: 'invite' };
    notification.channels = [NotificationChannel.IN_APP, NotificationChannel.EMAIL];
    notification.expiresAt = new Date('2024-12-31');

    expect(notification.metadata).toEqual({ gameId: '123', action: 'invite' });
    expect(notification.channels).toEqual([NotificationChannel.IN_APP, NotificationChannel.EMAIL]);
    expect(notification.expiresAt).toBeInstanceOf(Date);
  });
});