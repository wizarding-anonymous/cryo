#!/usr/bin/env node

/**
 * Migration validation script
 * Validates that all migration files are properly structured and can be loaded
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'infrastructure', 'persistence', 'migrations');
const ENTITIES_DIR = path.join(__dirname, '..', 'src', 'domain', 'entities');

console.log('🔍 Validating Game Catalog Service Database Migrations');
console.log('=====================================================');

// Check if migrations directory exists
if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error('❌ Migrations directory does not exist:', MIGRATIONS_DIR);
  process.exit(1);
}

// Check if entities directory exists
if (!fs.existsSync(ENTITIES_DIR)) {
  console.error('❌ Entities directory does not exist:', ENTITIES_DIR);
  process.exit(1);
}

// Get all migration files
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
  .filter(file => file.endsWith('.ts'))
  .sort();

console.log(`📁 Found ${migrationFiles.length} migration files:`);
migrationFiles.forEach(file => console.log(`   - ${file}`));

// Get all entity files
const entityFiles = fs.readdirSync(ENTITIES_DIR)
  .filter(file => file.endsWith('.entity.ts'))
  .sort();

console.log(`\n📁 Found ${entityFiles.length} entity files:`);
entityFiles.forEach(file => console.log(`   - ${file}`));

// Validate migration file structure
console.log('\n🔍 Validating migration files...');
let validationErrors = 0;

migrationFiles.forEach(file => {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for required migration structure
  const hasClass = /export class \w+\d+ implements MigrationInterface/.test(content);
  const hasName = /name = ['"`]\w+\d+['"`]/.test(content);
  const hasUp = /public async up\(queryRunner: QueryRunner\)/.test(content);
  const hasDown = /public async down\(queryRunner: QueryRunner\)/.test(content);
  
  if (!hasClass) {
    console.error(`❌ ${file}: Missing migration class declaration`);
    validationErrors++;
  }
  
  if (!hasName) {
    console.error(`❌ ${file}: Missing migration name property`);
    validationErrors++;
  }
  
  if (!hasUp) {
    console.error(`❌ ${file}: Missing up() method`);
    validationErrors++;
  }
  
  if (!hasDown) {
    console.error(`❌ ${file}: Missing down() method`);
    validationErrors++;
  }
  
  if (hasClass && hasName && hasUp && hasDown) {
    console.log(`✅ ${file}: Valid migration structure`);
  }
});

// Validate entity files
console.log('\n🔍 Validating entity files...');

const expectedEntities = [
  'game.entity.ts',
  'category.entity.ts',
  'tag.entity.ts',
  'screenshot.entity.ts',
  'video.entity.ts',
  'discount.entity.ts',
  'game-translation.entity.ts',
  'dlc.entity.ts',
  'preorder.entity.ts',
  'preorder-tier.entity.ts',
  'demo.entity.ts',
  'game-edition.entity.ts',
  'bundle.entity.ts',
  'franchise.entity.ts',
  'system-requirements.entity.ts'
];

expectedEntities.forEach(expectedEntity => {
  if (entityFiles.includes(expectedEntity)) {
    console.log(`✅ ${expectedEntity}: Found`);
  } else {
    console.error(`❌ ${expectedEntity}: Missing`);
    validationErrors++;
  }
});

// Check for TypeORM decorators in entities
entityFiles.forEach(file => {
  const filePath = path.join(ENTITIES_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Skip system-requirements.entity.ts as it's an embedded object, not a table entity
  if (file === 'system-requirements.entity.ts') {
    console.log(`✅ ${file}: Embedded object (not a table entity)`);
    return;
  }
  
  const hasEntity = /@Entity\(/.test(content);
  const hasPrimaryKey = /@PrimaryGeneratedColumn/.test(content);
  
  if (!hasEntity) {
    console.error(`❌ ${file}: Missing @Entity decorator`);
    validationErrors++;
  }
  
  if (!hasPrimaryKey) {
    console.error(`❌ ${file}: Missing @PrimaryGeneratedColumn decorator`);
    validationErrors++;
  }
});

// Check data-source.ts configuration
const dataSourcePath = path.join(__dirname, '..', 'data-source.ts');
if (fs.existsSync(dataSourcePath)) {
  console.log('\n✅ data-source.ts: Found');
  const dataSourceContent = fs.readFileSync(dataSourcePath, 'utf8');
  
  if (dataSourceContent.includes('entities:') && dataSourceContent.includes('migrations:')) {
    console.log('✅ data-source.ts: Contains entities and migrations configuration');
  } else {
    console.error('❌ data-source.ts: Missing entities or migrations configuration');
    validationErrors++;
  }
} else {
  console.error('❌ data-source.ts: Missing');
  validationErrors++;
}

// Check package.json scripts
const packageJsonPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};
  
  const requiredScripts = ['typeorm', 'migration:run', 'migration:revert'];
  requiredScripts.forEach(script => {
    if (scripts[script]) {
      console.log(`✅ package.json: Script '${script}' found`);
    } else {
      console.error(`❌ package.json: Script '${script}' missing`);
      validationErrors++;
    }
  });
} else {
  console.error('❌ package.json: Missing');
  validationErrors++;
}

// Summary
console.log('\n📊 Validation Summary');
console.log('====================');
console.log(`Migration files: ${migrationFiles.length}`);
console.log(`Entity files: ${entityFiles.length}`);
console.log(`Validation errors: ${validationErrors}`);

if (validationErrors === 0) {
  console.log('\n🎉 All validations passed! Database schema is ready.');
  console.log('\nNext steps:');
  console.log('1. Set up PostgreSQL database');
  console.log('2. Configure environment variables (.env file)');
  console.log('3. Run: npm run migration:run');
  console.log('4. Run: ./scripts/init-db.sh (or init-db.bat on Windows)');
  process.exit(0);
} else {
  console.log('\n❌ Validation failed. Please fix the errors above.');
  process.exit(1);
}