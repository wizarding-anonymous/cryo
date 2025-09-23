# Achievement Service Database Setup

## Migrations

This service uses TypeORM migrations to manage database schema and seed data.

### Available Migrations

1. **CreateAchievementTables** - Creates the basic database structure
2. **SeedBasicAchievements** - Seeds basic achievements for MVP

### Running Migrations

```bash
# Run all pending migrations
npm run migration:run

# Show migration status
npm run migration:show

# Revert last migration
npm run migration:revert
```

## Seed Data

The `SeedBasicAchievements` migration includes the following achievements:

### First-Time Achievements (first_time condition)
- **Первая покупка** (100 points) - First game purchase
- **Первый отзыв** (50 points) - First review written
- **Первый друг** (75 points) - First friend added

### Count-Based Achievements (count condition)
- **Коллекционер игр** (200 points) - 5 games purchased
- **Активный критик** (300 points) - 10 reviews written

### Threshold Achievements (threshold condition)
- **Библиотекарь** (500 points) - 20 games in library
- **Эксперт-рецензент** (750 points) - 25 reviews written

### Achievement Condition Types

1. **first_time** - Triggered on first occurrence of an event
2. **count** - Triggered when reaching exact count
3. **threshold** - Triggered when reaching or exceeding threshold

### Icon Paths

All achievements include icon paths in the format `/icons/achievements/{name}.svg`:
- `/icons/achievements/first-purchase.svg`
- `/icons/achievements/first-review.svg`
- `/icons/achievements/first-friend.svg`
- `/icons/achievements/game-collector.svg`
- `/icons/achievements/active-critic.svg`
- `/icons/achievements/librarian.svg`
- `/icons/achievements/expert-reviewer.svg`

## Database Configuration

Configure database connection via environment variables:
- `DB_HOST` (default: localhost)
- `DB_PORT` (default: 5432)
- `DB_USERNAME` (default: postgres)
- `DB_PASSWORD` (default: password)
- `DB_NAME` (default: achievement_service)