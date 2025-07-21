// Vitest Configuration - Task 3.3: Testing Suite
// Comprehensive test configuration for unit and integration tests

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globalSetup: './src/test/setup/global.ts',
    setupFiles: ['./src/test/setup/vitest.ts'],
    
    // Test patterns
    include: [
      'src/**/*.test.{ts,js}',
      'src/**/*.spec.{ts,js}',
      'test/**/*.test.{ts,js}',
      'test/**/*.spec.{ts,js}',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/*.e2e.test.{ts,js}', // Exclude E2E tests from unit test runs
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{ts,js}',
      ],
      exclude: [
        'src/**/*.test.{ts,js}',
        'src/**/*.spec.{ts,js}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/middleware.ts', // Astro middleware
        'src/env.d.ts',
      ],
      // Coverage thresholds (Task 3.3 requirement: >80%)
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        // Specific thresholds for critical modules
        'src/lib/security/**': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'src/lib/scoring.ts': {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
        'src/lib/validation*.ts': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
      },
    },
    
    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    
    // Watch mode
    watch: false,
    
    // Reporters
    reporters: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/vitest-results.json',
      html: './test-results/vitest-report.html',
    },
    
    // Mock configuration
    deps: {
      external: ['@clerk/clerk-js'],
    },
    
    // Test environment variables
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/ara_test',
      REDIS_URL: 'redis://localhost:6379/1',
      PII_ENCRYPTION_KEY: 'test-key-32-characters-minimum-required',
      CSRF_SECRET: 'test-csrf-secret-key-for-testing',
      ADMIN_API_KEY: 'test-admin-key',
    },
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/components': resolve(__dirname, './src/components'),
      '@/types': resolve(__dirname, './src/types'),
      '@/config': resolve(__dirname, './src/config'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/test': resolve(__dirname, './src/test'),
    },
  },
  
  // Define globals
  define: {
    global: 'globalThis',
  },
});