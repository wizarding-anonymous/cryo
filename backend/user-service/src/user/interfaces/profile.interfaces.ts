export interface UserPreferences {
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  gameSettings: {
    autoDownload: boolean;
    cloudSave: boolean;
    achievementNotifications: boolean;
  };
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  showOnlineStatus: boolean;
  showGameActivity: boolean;
  allowFriendRequests: boolean;
  showAchievements: boolean;
}
