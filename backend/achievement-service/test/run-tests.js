#!/usr/bin/env node

/**
 * Test runner script for Achievement Service
 * This script helps verify that all test configurations are working properly
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Achievement Service Test Runner');
console.log('==================================\n');

const testCommands = [
  {
    name: 'TypeScript Compilation Check',
    command: 'npx tsc --noEmit --project tsconfig.json',
    description: 'Verify TypeScript compilation'
  },
  {
    name: 'ESLint Check',
    command: 'npm run lint',
    description: 'Check code style and linting'
  },
  {
    name: 'Unit Tests',
    command: 'npm test -- --passWithNoTests',
    description: 'Run unit tests'
  }
];

function runCommand(cmd) {
  try {
    console.log(`\n📋 Running: ${cmd.name}`);
    console.log(`   Command: ${cmd.command}`);
    console.log(`   Description: ${cmd.description}\n`);
    
    const output = execSync(cmd.command, { 
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log('✅ Success!');
    if (output.trim()) {
      console.log('Output:', output.trim());
    }
    return true;
  } catch (error) {
    console.log('❌ Failed!');
    console.log('Error:', error.message);
    if (error.stdout) {
      console.log('Stdout:', error.stdout.toString());
    }
    if (error.stderr) {
      console.log('Stderr:', error.stderr.toString());
    }
    return false;
  }
}

async function main() {
  let successCount = 0;
  
  for (const cmd of testCommands) {
    const success = runCommand(cmd);
    if (success) {
      successCount++;
    }
  }
  
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`✅ Passed: ${successCount}/${testCommands.length}`);
  console.log(`❌ Failed: ${testCommands.length - successCount}/${testCommands.length}`);
  
  if (successCount === testCommands.length) {
    console.log('\n🎉 All checks passed! The test environment is ready.');
    console.log('\n📝 Available test commands:');
    console.log('   npm run test:e2e              - Run all e2e tests');
    console.log('   npm run test:integration       - Run integration tests');
    console.log('   npm run test:performance       - Run performance tests');
    console.log('   npm run test:error-handling    - Run error handling tests');
    console.log('   npm run test:full-flow         - Run full flow tests');
    console.log('\n💡 Remember to start the test database first:');
    console.log('   npm run test:db:start');
  } else {
    console.log('\n⚠️  Some checks failed. Please fix the issues before running tests.');
    process.exit(1);
  }
}

main().catch(console.error);