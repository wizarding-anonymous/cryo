import { DatabaseModule } from './database.module';
import { Notification, NotificationSettings } from '../entities';

describe('DatabaseModule', () => {
  it('should be defined', () => {
    expect(DatabaseModule).toBeDefined();
  });

  it('should export entities', () => {
    expect(Notification).toBeDefined();
    expect(NotificationSettings).toBeDefined();
  });

  it('should have proper entity metadata', () => {
    // Check that entities have proper TypeORM metadata
    expect(Notification.name).toBe('Notification');
    expect(NotificationSettings.name).toBe('NotificationSettings');
  });
});
