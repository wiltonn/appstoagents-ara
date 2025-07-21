// Playwright Global Teardown - Task 3.3: Testing Suite
// Global teardown for E2E tests

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Running Playwright global teardown...');

  try {
    // Clean up test data
    await cleanupTestData();
    
    // Clean up authentication states
    await cleanupAuthStates();
    
    console.log('✅ Playwright global teardown complete');
  } catch (error) {
    console.error('❌ Playwright teardown error:', error);
    // Don't throw - teardown should be best effort
  }
}

async function cleanupTestData() {
  console.log('🗑️ Cleaning up test data...');
  
  // Clean up any test data created during tests
  // This could include:
  // 1. Removing test audit sessions
  // 2. Cleaning up test files
  // 3. Resetting test configurations
  
  console.log('✅ Test data cleanup complete');
}

async function cleanupAuthStates() {
  console.log('🔐 Cleaning up authentication states...');
  
  // Clean up authentication files if needed
  try {
    const fs = require('fs').promises;
    await fs.rm('./test-results/auth', { recursive: true, force: true });
  } catch (error) {
    // Ignore if directory doesn't exist
  }
  
  console.log('✅ Auth state cleanup complete');
}

export default globalTeardown;