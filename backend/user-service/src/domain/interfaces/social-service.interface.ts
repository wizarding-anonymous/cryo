export interface ISocialServiceIntegration {
  /**
   * Уведомляет Social Service о регистрации нового пользователя
   */
  notifyUserRegistered(eventData: {
    userId: string;
    email: string;
    username: string;
    registrationDate: Date;
    source: 'direct' | 'oauth';
    oauthProvider?: string;
    referralCode?: string;
  }): Promise<void>;

  /**
   * Уведомляет Social Service об обновлении профиля пользователя
   */
  notifyUserProfileUpdated(eventData: {
    userId: string;
    displayName: string;
    avatarUrl?: string;
    changedFields: string[];
    timestamp: Date;
  }): Promise<void>;

  /**
   * Проверяет здоровье Social Service
   */
  checkHealth(): Promise<boolean>;
}

export const ISocialServiceIntegration = Symbol('ISocialServiceIntegration');
