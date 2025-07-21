// Playwright Configuration - Task 3.3: Testing Suite
// End-to-end testing configuration for critical user flows

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './src/test/e2e',
  
  // Test patterns
  testMatch: '**/*.e2e.test.{ts,js}',
  
  // Timeout configuration
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  
  // Global setup and teardown
  globalSetup: './src/test/setup/playwright-global.ts',
  globalTeardown: './src/test/teardown/playwright-global.ts',
  
  // Test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],
  
  // Global test configuration
  use: {
    // Base URL for testing
    baseURL: process.env.BASE_URL || 'http://localhost:4321',
    
    // Browser configuration
    headless: process.env.CI ? true : false,
    
    // Trace configuration
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Context configuration
    ignoreHTTPSErrors: true,
    
    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  
  // Browser projects
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // Guest user flows (no authentication)
    {
      name: 'guest-chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/*guest*.e2e.test.{ts,js}',
    },
  ],
  
  // Web server configuration for development
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/ara_test',
      REDIS_URL: 'redis://localhost:6379/1',
      PII_ENCRYPTION_KEY: 'test-key-32-characters-minimum-required',
      CSRF_SECRET: 'test-csrf-secret-key-for-testing',
      ADMIN_API_KEY: 'test-admin-key',
    },
  },
  
  // Output directory
  outputDir: 'test-results/playwright-artifacts',
  
  // Test metadata
  metadata: {
    'test-suite': 'ARA E2E Tests',
    'task': 'Task 3.3: Testing Suite',
    'coverage': 'Critical user flows',
  },
});