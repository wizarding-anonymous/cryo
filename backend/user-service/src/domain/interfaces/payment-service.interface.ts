export interface IPaymentServiceIntegration {
  /**
   * Уведомляет Payment Service о блокировке пользователя
   */
  notifyUserBlocked(eventData: {
    userId: string;
    reason: string;
    blockedBy: string;
    duration?: number;
    timestamp: Date;
  }): Promise<void>;

  /**
   * Уведомляет Payment Service о разблокировке пользователя
   */
  notifyUserUnblocked(eventData: { userId: string; unblockedBy: string; timestamp: Date }): Promise<void>;

  /**
   * Проверяет статус пользователя для финансовых операций
   */
  checkUserStatus(userId: string): Promise<{
    canMakePayments: boolean;
    canReceivePayments: boolean;
    restrictions: string[];
  }>;

  /**
   * Проверяет здоровье Payment Service
   */
  checkHealth(): Promise<boolean>;
}

export const IPaymentServiceIntegration = Symbol('IPaymentServiceIntegration');
