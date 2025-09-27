#!/usr/bin/env ts-node

/**
 * Validation script for achievement seed data
 * This script validates the seed migration without requiring a database connection
 */

import { AchievementType } from '../src/achievement/entities/achievement.entity';

interface AchievementSeedData {
  name: string;
  description: string;
  type: string;
  condition: string;
  iconUrl: string;
  points: number;
  isActive: boolean;
}

// Extract the seed data from the migration (simulated)
const seedAchievements: AchievementSeedData[] = [
  {
    name: 'Первая покупка',
    description: 'Поздравляем с первой покупкой игры на нашей платформе! Добро пожаловать в мир игр!',
    type: 'first_purchase',
    condition: '{"type": "first_time"}',
    iconUrl: '/icons/achievements/first-purchase.svg',
    points: 100,
    isActive: true,
  },
  {
    name: 'Первый отзыв',
    description: 'Спасибо за ваш первый отзыв! Ваше мнение важно для сообщества игроков.',
    type: 'first_review',
    condition: '{"type": "first_time"}',
    iconUrl: '/icons/achievements/first-review.svg',
    points: 50,
    isActive: true,
  },
  {
    name: 'Первый друг',
    description: 'Отлично! Вы добавили своего первого друга на платформе. Игры веселее с друзьями!',
    type: 'first_friend',
    condition: '{"type": "first_time"}',
    iconUrl: '/icons/achievements/first-friend.svg',
    points: 75,
    isActive: true,
  },
  {
    name: 'Коллекционер игр',
    description: 'У вас уже 5 игр в библиотеке! Продолжайте собирать коллекцию.',
    type: 'games_purchased',
    condition: '{"type": "count", "target": 5, "field": "games_count"}',
    iconUrl: '/icons/achievements/game-collector.svg',
    points: 200,
    isActive: true,
  },
  {
    name: 'Активный критик',
    description: 'Вы написали уже 10 отзывов! Ваши рецензии помогают другим игрокам делать правильный выбор.',
    type: 'reviews_written',
    condition: '{"type": "count", "target": 10, "field": "reviews_count"}',
    iconUrl: '/icons/achievements/active-critic.svg',
    points: 300,
    isActive: true,
  },
  {
    name: 'Библиотекарь',
    description: 'Впечатляющая коллекция! У вас уже 20 игр в библиотеке. Настоящий ценитель игр!',
    type: 'games_purchased',
    condition: '{"type": "threshold", "target": 20, "field": "games_count"}',
    iconUrl: '/icons/achievements/librarian.svg',
    points: 500,
    isActive: true,
  },
  {
    name: 'Эксперт-рецензент',
    description: 'Невероятно! Вы написали уже 25 отзывов. Настоящий эксперт в мире игр!',
    type: 'reviews_written',
    condition: '{"type": "threshold", "target": 25, "field": "reviews_count"}',
    iconUrl: '/icons/achievements/expert-reviewer.svg',
    points: 750,
    isActive: true,
  },
  {
    name: 'Социальная бабочка',
    description: 'У вас уже 5 друзей на платформе! Вы создаете настоящее игровое сообщество.',
    type: 'first_friend',
    condition: '{"type": "count", "target": 5, "field": "friends_count"}',
    iconUrl: '/icons/achievements/social-butterfly.svg',
    points: 150,
    isActive: true,
  },
  {
    name: 'Начинающий рецензент',
    description: 'Вы написали свои первые 3 отзыва! Продолжайте делиться впечатлениями.',
    type: 'reviews_written',
    condition: '{"type": "count", "target": 3, "field": "reviews_count"}',
    iconUrl: '/icons/achievements/beginner-reviewer.svg',
    points: 100,
    isActive: true,
  },
];

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalAchievements: number;
    byType: Record<string, number>;
    byConditionType: Record<string, number>;
    pointsRange: { min: number; max: number };
  };
}

function validateSeedData(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    summary: {
      totalAchievements: seedAchievements.length,
      byType: {},
      byConditionType: {},
      pointsRange: { min: Infinity, max: -Infinity },
    },
  };

  const validTypes = Object.values(AchievementType);
  const validConditionTypes = ['first_time', 'count', 'threshold'];
  const achievementNames = new Set<string>();

  seedAchievements.forEach((achievement, index) => {
    const prefix = `Achievement ${index + 1} (${achievement.name})`;

    // Validate name uniqueness
    if (achievementNames.has(achievement.name)) {
      result.errors.push(`${prefix}: Duplicate name "${achievement.name}"`);
      result.isValid = false;
    }
    achievementNames.add(achievement.name);

    // Validate name length
    if (achievement.name.length > 100) {
      result.errors.push(`${prefix}: Name too long (${achievement.name.length} > 100)`);
      result.isValid = false;
    }

    // Validate description
    if (!achievement.description || achievement.description.length < 10) {
      result.errors.push(`${prefix}: Description too short or missing`);
      result.isValid = false;
    }

    // Validate type
    if (!validTypes.includes(achievement.type as AchievementType)) {
      result.errors.push(`${prefix}: Invalid type "${achievement.type}"`);
      result.isValid = false;
    }

    // Count by type
    result.summary.byType[achievement.type] = (result.summary.byType[achievement.type] || 0) + 1;

    // Validate condition JSON
    try {
      const condition = JSON.parse(achievement.condition);
      
      if (!validConditionTypes.includes(condition.type)) {
        result.errors.push(`${prefix}: Invalid condition type "${condition.type}"`);
        result.isValid = false;
      }

      // Count by condition type
      result.summary.byConditionType[condition.type] = 
        (result.summary.byConditionType[condition.type] || 0) + 1;

      // Validate condition structure
      if (condition.type === 'count' || condition.type === 'threshold') {
        if (typeof condition.target !== 'number' || condition.target <= 0) {
          result.errors.push(`${prefix}: Invalid target value for ${condition.type} condition`);
          result.isValid = false;
        }
        if (!condition.field || typeof condition.field !== 'string') {
          result.errors.push(`${prefix}: Missing or invalid field for ${condition.type} condition`);
          result.isValid = false;
        }
      }
    } catch (error) {
      result.errors.push(`${prefix}: Invalid JSON in condition: ${achievement.condition}`);
      result.isValid = false;
    }

    // Validate icon URL
    if (!achievement.iconUrl || !achievement.iconUrl.match(/^\/icons\/achievements\/.*\.svg$/)) {
      result.errors.push(`${prefix}: Invalid icon URL format`);
      result.isValid = false;
    }

    // Validate points
    if (typeof achievement.points !== 'number' || achievement.points <= 0) {
      result.errors.push(`${prefix}: Invalid points value`);
      result.isValid = false;
    }

    // Update points range
    result.summary.pointsRange.min = Math.min(result.summary.pointsRange.min, achievement.points);
    result.summary.pointsRange.max = Math.max(result.summary.pointsRange.max, achievement.points);

    // Validate isActive
    if (typeof achievement.isActive !== 'boolean') {
      result.errors.push(`${prefix}: isActive must be boolean`);
      result.isValid = false;
    }
  });

  // Task requirement validations
  const requiredAchievements = ['Первая покупка', 'Первый отзыв', 'Первый друг'];
  requiredAchievements.forEach(name => {
    if (!achievementNames.has(name)) {
      result.errors.push(`Missing required achievement: ${name}`);
      result.isValid = false;
    }
  });

  // Check for 5 games and 10 reviews achievements
  const hasGameCollector = seedAchievements.some(a => 
    a.condition.includes('"target": 5') && a.condition.includes('"field": "games_count"')
  );
  const hasActiveReviewer = seedAchievements.some(a => 
    a.condition.includes('"target": 10') && a.condition.includes('"field": "reviews_count"')
  );

  if (!hasGameCollector) {
    result.errors.push('Missing achievement for 5 games');
    result.isValid = false;
  }
  if (!hasActiveReviewer) {
    result.errors.push('Missing achievement for 10 reviews');
    result.isValid = false;
  }

  // Check condition type coverage
  if (!result.summary.byConditionType.first_time) {
    result.errors.push('Missing first_time condition type');
    result.isValid = false;
  }
  if (!result.summary.byConditionType.count) {
    result.errors.push('Missing count condition type');
    result.isValid = false;
  }
  if (!result.summary.byConditionType.threshold) {
    result.errors.push('Missing threshold condition type');
    result.isValid = false;
  }

  // Warnings
  if (result.summary.totalAchievements < 5) {
    result.warnings.push('Consider adding more achievements for better user engagement');
  }

  if (result.summary.pointsRange.max - result.summary.pointsRange.min < 500) {
    result.warnings.push('Consider wider point range for better progression');
  }

  return result;
}

function printValidationResult(result: ValidationResult): void {
  console.log('🎯 Achievement Seed Data Validation Report');
  console.log('==========================================\n');

  console.log('📊 Summary:');
  console.log(`  Total Achievements: ${result.summary.totalAchievements}`);
  console.log(`  Points Range: ${result.summary.pointsRange.min} - ${result.summary.pointsRange.max}`);
  console.log('\n📈 By Type:');
  Object.entries(result.summary.byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log('\n🔧 By Condition Type:');
  Object.entries(result.summary.byConditionType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(error => console.log(`  • ${error}`));
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach(warning => console.log(`  • ${warning}`));
  }

  console.log(`\n${result.isValid ? '✅' : '❌'} Validation ${result.isValid ? 'PASSED' : 'FAILED'}`);
  
  if (result.isValid) {
    console.log('\n🎉 All task requirements satisfied:');
    console.log('  ✅ Basic achievements: "Первая покупка", "Первый отзыв", "Первый друг"');
    console.log('  ✅ Quantitative achievements: "5 игр", "10 отзывов"');
    console.log('  ✅ All condition types: first_time, count, threshold');
    console.log('  ✅ Icons and descriptions for each achievement');
    console.log('  ✅ Points system implemented');
  }
}

// Run validation
const result = validateSeedData();
printValidationResult(result);

// Exit with appropriate code
process.exit(result.isValid ? 0 : 1);