# Achievement Service - Seed Data Documentation

## Overview

This document describes the basic achievements seeded into the Achievement Service MVP. These achievements provide a foundation for user engagement and gamification on the Russian gaming platform.

## Achievement Categories

### 1. First-Time Achievements (Первые достижения)

These achievements are unlocked when a user performs an action for the first time:

| Achievement | Description | Points | Condition Type | Icon |
|-------------|-------------|--------|----------------|------|
| **Первая покупка** | Поздравляем с первой покупкой игры на нашей платформе! Добро пожаловать в мир игр! | 100 | `first_time` | `/icons/achievements/first-purchase.svg` |
| **Первый отзыв** | Спасибо за ваш первый отзыв! Ваше мнение важно для сообщества игроков. | 50 | `first_time` | `/icons/achievements/first-review.svg` |
| **Первый друг** | Отлично! Вы добавили своего первого друга на платформе. Игры веселее с друзьями! | 75 | `first_time` | `/icons/achievements/first-friend.svg` |

### 2. Count-Based Achievements (Достижения за количество)

These achievements are unlocked when a user reaches specific milestones:

| Achievement | Description | Points | Target | Field | Icon |
|-------------|-------------|--------|--------|-------|------|
| **Начинающий рецензент** | Вы написали свои первые 3 отзыва! Продолжайте делиться впечатлениями. | 100 | 3 | `reviews_count` | `/icons/achievements/beginner-reviewer.svg` |
| **Коллекционер игр** | У вас уже 5 игр в библиотеке! Продолжайте собирать коллекцию. | 200 | 5 | `games_count` | `/icons/achievements/game-collector.svg` |
| **Социальная бабочка** | У вас уже 5 друзей на платформе! Вы создаете настоящее игровое сообщество. | 150 | 5 | `friends_count` | `/icons/achievements/social-butterfly.svg` |
| **Активный критик** | Вы написали уже 10 отзывов! Ваши рецензии помогают другим игрокам делать правильный выбор. | 300 | 10 | `reviews_count` | `/icons/achievements/active-critic.svg` |

### 3. Threshold Achievements (Пороговые достижения)

These achievements are unlocked when a user exceeds significant thresholds:

| Achievement | Description | Points | Threshold | Field | Icon |
|-------------|-------------|--------|-----------|-------|------|
| **Библиотекарь** | Впечатляющая коллекция! У вас уже 20 игр в библиотеке. Настоящий ценитель игр! | 500 | 20 | `games_count` | `/icons/achievements/librarian.svg` |
| **Эксперт-рецензент** | Невероятно! Вы написали уже 25 отзывов. Настоящий эксперт в мире игр! | 750 | 25 | `reviews_count` | `/icons/achievements/expert-reviewer.svg` |

## Achievement Condition Types

### 1. `first_time`
- **Purpose**: Awarded when a user performs an action for the first time
- **Structure**: `{"type": "first_time"}`
- **Examples**: First purchase, first review, first friend

### 2. `count`
- **Purpose**: Awarded when a user reaches an exact count
- **Structure**: `{"type": "count", "target": number, "field": "field_name"}`
- **Examples**: Exactly 5 games, exactly 10 reviews

### 3. `threshold`
- **Purpose**: Awarded when a user exceeds a threshold
- **Structure**: `{"type": "threshold", "target": number, "field": "field_name"}`
- **Examples**: More than 20 games, more than 25 reviews

## Points System

The achievement system uses a progressive points structure:

- **First-time achievements**: 50-100 points (encouraging initial engagement)
- **Early milestones**: 100-200 points (rewarding continued activity)
- **Significant milestones**: 300-500 points (recognizing dedication)
- **Expert level**: 750+ points (celebrating mastery)

## Integration with MVP Services

### Required Event Types

The achievement system listens for these events from other MVP services:

1. **Payment Service Events**:
   - `game_purchase` → Updates `games_count` field
   - Triggers: "Первая покупка", "Коллекционер игр", "Библиотекарь"

2. **Review Service Events**:
   - `review_created` → Updates `reviews_count` field
   - Triggers: "Первый отзыв", "Начинающий рецензент", "Активный критик", "Эксперт-рецензент"

3. **Social Service Events**:
   - `friend_added` → Updates `friends_count` field
   - Triggers: "Первый друг", "Социальная бабочка"

### Event Data Structure

```typescript
interface AchievementEvent {
  userId: string;
  eventType: 'game_purchase' | 'review_created' | 'friend_added';
  eventData: {
    gameId?: string;
    reviewId?: string;
    friendId?: string;
    timestamp: Date;
  };
}
```

## Database Schema

### Achievement Table Structure

```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  type achievement_type NOT NULL,
  condition JSONB NOT NULL,
  "iconUrl" VARCHAR(255),
  points INTEGER DEFAULT 0,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### Achievement Types Enum

```sql
CREATE TYPE achievement_type AS ENUM (
  'first_purchase',
  'first_review', 
  'first_friend',
  'games_purchased',
  'reviews_written'
);
```

## Migration Usage

### Running the Migration

```bash
# Run all pending migrations
npm run migration:run

# Show migration status
npm run migration:show

# Revert last migration (if needed)
npm run migration:revert
```

### Verification

After running the migration, verify the data:

```sql
-- Check all seeded achievements
SELECT name, type, points, condition FROM achievements ORDER BY points;

-- Verify achievement types
SELECT type, COUNT(*) as count FROM achievements GROUP BY type;

-- Check condition types
SELECT condition->>'type' as condition_type, COUNT(*) as count 
FROM achievements 
GROUP BY condition->>'type';
```

## Icon Assets

The achievement system expects icon files to be available at the following paths:

```
/icons/achievements/
├── first-purchase.svg
├── first-review.svg
├── first-friend.svg
├── game-collector.svg
├── active-critic.svg
├── librarian.svg
├── expert-reviewer.svg
├── social-butterfly.svg
└── beginner-reviewer.svg
```

## Future Enhancements (Post-MVP)

The current seed data provides a foundation for future enhancements:

1. **Seasonal Achievements**: Holiday and event-based achievements
2. **Game-Specific Achievements**: Achievements tied to specific games
3. **Community Achievements**: Forum participation, helping others
4. **Streak Achievements**: Daily login streaks, consecutive purchases
5. **Competitive Achievements**: Leaderboard positions, tournaments
6. **Meta Achievements**: Achievements for earning other achievements

## Testing

The seed data includes achievements that can be easily tested:

1. **Immediate Testing**: First-time achievements can be tested immediately
2. **Progressive Testing**: Count-based achievements allow testing progression
3. **Edge Case Testing**: Threshold achievements test boundary conditions

## Maintenance

### Adding New Achievements

To add new achievements post-deployment:

1. Create a new migration file
2. Follow the same structure as the seed migration
3. Ensure unique names and appropriate point values
4. Test thoroughly before deployment

### Modifying Existing Achievements

- **Points**: Can be updated via migration
- **Descriptions**: Can be updated via migration  
- **Conditions**: Should be carefully tested before changes
- **Names**: Should not be changed (used as identifiers)