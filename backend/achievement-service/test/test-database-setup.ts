import { DataSource } from 'typeorm';
import { testDataSourceConfig } from './test-database.config';
import { Achievement } from '../src/achievement/entities/achievement.entity';
import { UserAchievement } from '../src/achievement/entities/user-achievement.entity';
import { UserProgress } from '../src/achievement/entities/user-progress.entity';

export class TestDatabaseSetup {
    private static dataSource: DataSource | null = null;

    static async createTestDatabase(): Promise<DataSource> {
        if (this.dataSource && this.dataSource.isInitialized) {
            return this.dataSource;
        }

        this.dataSource = new DataSource(testDataSourceConfig);

        try {
            await this.dataSource.initialize();
            console.log('Test database connection established');

            // Ensure tables are created
            await this.dataSource.synchronize(true);

            return this.dataSource;
        } catch (error) {
            console.error('Failed to connect to test database:', error);
            throw error;
        }
    }

    static async closeTestDatabase(): Promise<void> {
        if (this.dataSource && this.dataSource.isInitialized) {
            await this.dataSource.destroy();
            this.dataSource = null;
            console.log('Test database connection closed');
        }
    }

    static async clearTestDatabase(): Promise<void> {
        if (!this.dataSource || !this.dataSource.isInitialized) {
            throw new Error('Database not initialized');
        }

        try {
            // Clear in correct order to avoid foreign key constraints
            await this.dataSource.getRepository(UserProgress).clear();
            await this.dataSource.getRepository(UserAchievement).clear();
            await this.dataSource.getRepository(Achievement).clear();
        } catch (error) {
            console.error('Failed to clear test database:', error);
            throw error;
        }
    }

    static async resetTestDatabase(): Promise<void> {
        if (!this.dataSource || !this.dataSource.isInitialized) {
            throw new Error('Database not initialized');
        }

        try {
            await this.dataSource.synchronize(true);
            console.log('Test database schema reset');
        } catch (error) {
            console.error('Failed to reset test database:', error);
            throw error;
        }
    }

    static getDataSource(): DataSource {
        if (!this.dataSource || !this.dataSource.isInitialized) {
            throw new Error('Database not initialized');
        }
        return this.dataSource;
    }

    static async waitForDatabase(maxRetries: number = 10, delay: number = 1000): Promise<void> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                if (this.dataSource && this.dataSource.isInitialized) {
                    await this.dataSource.query('SELECT 1');
                    return;
                }
                await this.createTestDatabase();
                await this.dataSource!.query('SELECT 1');
                return;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`Database connection attempt ${i + 1}/${maxRetries} failed:`, errorMessage);
                if (i === maxRetries - 1) {
                    throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}
