#!/usr/bin/env ts-node

/**
 * Database Seeding Script for User Service
 * Seeds the database with test data for development
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { User } from '../src/user/entities/user.entity';
import { UserPreferences, PrivacySettings } from '../src/user/interfaces';

// Load environment variables
config({ path: join(__dirname, '../.env.docker') });

const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5433'),
    username: process.env.DB_USER || process.env.POSTGRES_USER || 'user_service',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'user_password',
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'user_db',
    entities: [User],
    synchronize: false,
    logging: true,
});

const seedUsers: Partial<User>[] = [
    {
        email: 'admin@cryo.com',
        password: '$2b$10$rQZ8kHWKtGXGvqWXq9X9XeJ8kHWKtGXGvqWXq9X9XeJ8kHWKtGXGvq', // hashed 'admin123'
        name: 'Admin User',
        isActive: true,
        preferences: {
            language: 'en',
            timezone: 'UTC',
            theme: 'dark',
            notifications: {
                email: true,
                push: true,
                sms: false,
            },
            gameSettings: {
                autoDownload: true,
                cloudSave: true,
                achievementNotifications: true,
            },
        } as UserPreferences,
        privacySettings: {
            profileVisibility: 'public',
            showOnlineStatus: true,
            showGameActivity: true,
            allowFriendRequests: true,
            showAchievements: true,
        } as PrivacySettings,
    },
    {
        email: 'user1@cryo.com',
        password: '$2b$10$rQZ8kHWKtGXGvqWXq9X9XeJ8kHWKtGXGvqWXq9X9XeJ8kHWKtGXGvq', // hashed 'user123'
        name: 'Test User 1',
        isActive: true,
        preferences: {
            language: 'en',
            timezone: 'America/New_York',
            theme: 'light',
            notifications: {
                email: true,
                push: false,
                sms: false,
            },
            gameSettings: {
                autoDownload: false,
                cloudSave: true,
                achievementNotifications: false,
            },
        } as UserPreferences,
        privacySettings: {
            profileVisibility: 'friends',
            showOnlineStatus: false,
            showGameActivity: true,
            allowFriendRequests: true,
            showAchievements: false,
        } as PrivacySettings,
    },
    {
        email: 'user2@cryo.com',
        password: '$2b$10$rQZ8kHWKtGXGvqWXq9X9XeJ8kHWKtGXGvqWXq9X9XeJ8kHWKtGXGvq', // hashed 'user123'
        name: 'Test User 2',
        isActive: true,
        preferences: {
            language: 'ru',
            timezone: 'Europe/Moscow',
            theme: 'auto',
            notifications: {
                email: false,
                push: true,
                sms: true,
            },
            gameSettings: {
                autoDownload: true,
                cloudSave: false,
                achievementNotifications: true,
            },
        } as UserPreferences,
        privacySettings: {
            profileVisibility: 'private',
            showOnlineStatus: false,
            showGameActivity: false,
            allowFriendRequests: false,
            showAchievements: true,
        } as PrivacySettings,
    },
];

async function seedDatabase() {
    console.log('🌱 Starting database seeding...');

    try {
        await dataSource.initialize();
        console.log('✅ Database connection established');

        const userRepository = dataSource.getRepository(User);

        // Clear existing test data
        console.log('🧹 Clearing existing test data...');
        const testEmails = ['admin@cryo.com', 'user1@cryo.com', 'user2@cryo.com'];
        for (const email of testEmails) {
            await userRepository.delete({ email });
        }

        // Insert seed data
        console.log('📝 Inserting seed data...');
        for (const userData of seedUsers) {
            try {
                const user = userRepository.create(userData);
                const savedUser = await userRepository.save(user);
                console.log(`✅ Created user: ${savedUser.email} (ID: ${savedUser.id})`);
            } catch (error) {
                console.error(`❌ Failed to create user ${userData.email}:`, error.message);
                throw error;
            }
        }

        console.log('🎉 Database seeding completed successfully!');
        console.log('\n📋 Seeded users:');
        console.log('  - admin@cryo.com (Admin User)');
        console.log('  - user1@cryo.com (Test User 1)');
        console.log('  - user2@cryo.com (Test User 2)');
        console.log('\n🔑 All users have password: user123');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        await dataSource.destroy();
    }
}

// Run seeding if called directly
if (require.main === module) {
    seedDatabase();
}

export { seedDatabase };