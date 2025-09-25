export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  libraryServiceUrl: string;
  achievementServiceUrl: string;
  notificationServiceUrl: string;
  gameCatalogServiceUrl: string;
}

export const appConfig = (): AppConfig => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key',
  libraryServiceUrl: process.env.LIBRARY_SERVICE_URL || 'http://library-service:3000',
  achievementServiceUrl: process.env.ACHIEVEMENT_SERVICE_URL || 'http://achievement-service:3000',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3000',
  gameCatalogServiceUrl: process.env.GAME_CATALOG_SERVICE_URL || 'http://game-catalog-service:3000',
});