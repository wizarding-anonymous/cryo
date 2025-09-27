import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables for local Docker connection
dotenv.config({ path: '.env.development' });

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5433,
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: process.env.POSTGRES_DB || 'user_service_db',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false,
});

async function runMigrations() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    console.log('Running migrations...');
    const migrations = await AppDataSource.runMigrations();
    
    if (migrations.length === 0) {
      console.log('✅ No migrations to run - database is up to date');
    } else {
      console.log(`✅ Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`  - ${migration.name}`);
      });
    }

    // Check if migrations table exists and show current state
    const executedMigrations = await AppDataSource.query(
      'SELECT * FROM migrations ORDER BY timestamp DESC'
    );
    
    console.log('\n📊 Migration Status:');
    console.log(`Total executed migrations: ${executedMigrations.length}`);
    
    if (executedMigrations.length > 0) {
      console.log('Latest migrations:');
      executedMigrations.slice(0, 5).forEach((migration, index) => {
        const timestamp = migration.timestamp ? new Date(parseInt(migration.timestamp)).toISOString() : 'Unknown';
        console.log(`  ${index + 1}. ${migration.name} (${timestamp})`);
      });
    }

    await AppDataSource.destroy();
    console.log('✅ Migration process completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}