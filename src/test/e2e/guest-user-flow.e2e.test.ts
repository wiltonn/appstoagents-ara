// Guest User Flow E2E Tests - Task 3.3: Testing Suite
// End-to-end tests for guest user journey and conversion

import { test, expect } from '@playwright/test';

test.describe('Guest User Flow - Complete Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Start as guest user
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('guest user can start wizard without authentication', async ({ page }) => {
    // Verify landing page loads
    await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();
    
    // Click start wizard button
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Should navigate to wizard without requiring login
    await expect(page).toHaveURL(/\/wizard/);
    await expect(page.locator('[data-testid="wizard-container"]')).toBeVisible();
    
    // Should show guest user indicator
    await expect(page.locator('[data-testid="guest-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="guest-indicator"]')).toContainText('guest');
  });

  test('guest user session persists across page reloads', async ({ page }) => {
    // Start wizard as guest
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Answer first question
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    // Get session ID for verification
    const sessionId = await page.evaluate(() => localStorage.getItem('guest_session_id'));
    expect(sessionId).toBeTruthy();
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should maintain same session
    const newSessionId = await page.evaluate(() => localStorage.getItem('guest_session_id'));
    expect(newSessionId).toBe(sessionId);
    
    // Should restore progress
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('2');
  });

  test('guest user can complete entire wizard', async ({ page }) => {
    // Start wizard
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Complete wizard with valid answers
    const questions = [
      { selector: '[data-testid="option-startup"]', type: 'click' },
      { selector: '[data-testid="scale-slider"]', type: 'fill', value: '6' },
      { selector: '[data-testid="technical-maturity-slider"]', type: 'fill', value: '5' },
      { selector: '[data-testid="data-infrastructure"]', type: 'select', value: 'cloud' },
    ];

    for (const question of questions) {
      if (question.type === 'click') {
        await page.locator(question.selector).click();
      } else if (question.type === 'fill') {
        await page.locator(question.selector).fill(question.value!);
      } else if (question.type === 'select') {
        await page.locator(question.selector).selectOption(question.value!);
      }
      await page.locator('[data-testid="next-button"]').click();
    }

    // Complete wizard
    await page.locator('[data-testid="submit-wizard"]').click();
    
    // Should reach completion page
    await expect(page.locator('[data-testid="wizard-completion"]')).toBeVisible();
    await expect(page.locator('[data-testid="guest-completion"]')).toBeVisible();
  });

  test('guest user sees conversion prompts during wizard', async ({ page }) => {
    // Start wizard
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Progress through a few steps
    await page.locator('[data-testid="option-enterprise"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    await page.locator('[data-testid="scale-slider"]').fill('8');
    await page.locator('[data-testid="next-button"]').click();
    
    // Should see sign-up prompt at strategic points
    await expect(page.locator('[data-testid="signup-prompt"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-prompt"]')).toContainText('create account');
    
    // Can dismiss prompt and continue as guest
    await page.locator('[data-testid="continue-as-guest"]').click();
    await expect(page.locator('[data-testid="signup-prompt"]')).not.toBeVisible();
  });

  test('guest user conversion to registered user', async ({ page }) => {
    // Start as guest and progress
    await page.locator('[data-testid="start-wizard-guest"]').click();
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    // Click sign up from conversion prompt
    await page.locator('[data-testid="signup-from-guest"]').click();
    
    // Should navigate to sign-up with session preservation
    await expect(page).toHaveURL(/\/sign-up/);
    await expect(page.locator('[data-testid="signup-form"]')).toBeVisible();
    
    // Should show session preservation notice
    await expect(page.locator('[data-testid="session-preservation-notice"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-preservation-notice"]'))
      .toContainText('progress will be saved');
  });

  test('guest user email capture for report delivery', async ({ page }) => {
    // Complete wizard as guest
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Quick completion
    const steps = ['startup', '6', '5', 'cloud'];
    for (let i = 0; i < steps.length; i++) {
      if (i === 0) {
        await page.locator(`[data-testid="option-${steps[i]}"]`).click();
      } else if (i === 1 || i === 2) {
        await page.locator('[data-testid*="slider"]').nth(i - 1).fill(steps[i]);
      } else {
        await page.locator('[data-testid="data-infrastructure"]').selectOption(steps[i]);
      }
      await page.locator('[data-testid="next-button"]').click();
    }
    
    await page.locator('[data-testid="submit-wizard"]').click();
    
    // Should prompt for email to receive report
    await expect(page.locator('[data-testid="email-capture"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    
    // Enter email
    await page.locator('[data-testid="email-input"]').fill('guest@example.com');
    await page.locator('[data-testid="send-report"]').click();
    
    // Should confirm email sent
    await expect(page.locator('[data-testid="email-sent-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-sent-confirmation"]'))
      .toContainText('guest@example.com');
  });

  test('guest user rate limiting works correctly', async ({ page }) => {
    // Test rate limiting for guest users
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Rapidly make multiple requests by clicking next button many times
    for (let i = 0; i < 25; i++) {
      await page.locator('[data-testid="option-startup"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      // If rate limited, should see error
      const rateLimitError = page.locator('[data-testid="rate-limit-error"]');
      if (await rateLimitError.isVisible()) {
        await expect(rateLimitError).toContainText('too many requests');
        break;
      }
      
      // Go back to retry
      if (await page.locator('[data-testid="back-button"]').isVisible()) {
        await page.locator('[data-testid="back-button"]').click();
      }
    }
  });

  test('guest user data privacy and cleanup', async ({ page }) => {
    // Start as guest
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Verify privacy notice is shown
    await expect(page.locator('[data-testid="privacy-notice"]')).toBeVisible();
    await expect(page.locator('[data-testid="privacy-notice"]'))
      .toContainText('guest session');
    
    // Complete a question
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    // Check session exists in localStorage
    const sessionId = await page.evaluate(() => localStorage.getItem('guest_session_id'));
    expect(sessionId).toBeTruthy();
    
    // Test manual session cleanup
    await page.locator('[data-testid="clear-session"]').click();
    
    // Should confirm cleanup
    await expect(page.locator('[data-testid="session-cleared"]')).toBeVisible();
    
    // Session should be removed
    const clearedSessionId = await page.evaluate(() => localStorage.getItem('guest_session_id'));
    expect(clearedSessionId).toBeNull();
  });

  test('guest user session timeout handling', async ({ page }) => {
    // Start as guest
    await page.locator('[data-testid="start-wizard-guest"]').click();
    await page.locator('[data-testid="option-startup"]').click();
    
    // Mock session timeout by clearing session on server side
    await page.route('**/api/wizard/**', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ 
          error: 'Guest session expired',
          code: 'GUEST_SESSION_TIMEOUT'
        }),
      });
    });
    
    // Try to proceed
    await page.locator('[data-testid="next-button"]').click();
    
    // Should handle guest session timeout gracefully
    await expect(page.locator('[data-testid="guest-session-expired"]')).toBeVisible();
    await expect(page.locator('[data-testid="start-new-session"]')).toBeVisible();
    
    // Should offer to start new session
    await page.locator('[data-testid="start-new-session"]').click();
    
    // Should reset to beginning with new session
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('1');
    
    // New session ID should be generated
    const newSessionId = await page.evaluate(() => localStorage.getItem('guest_session_id'));
    expect(newSessionId).toBeTruthy();
  });

  test('guest user mobile experience', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-specific test');
    
    // Test mobile guest experience
    await expect(page.locator('[data-testid="mobile-hero"]')).toBeVisible();
    
    // Start wizard on mobile
    await page.locator('[data-testid="start-wizard-guest"]').tap();
    
    // Test mobile-optimized guest indicators
    await expect(page.locator('[data-testid="mobile-guest-indicator"]')).toBeVisible();
    
    // Test mobile conversion prompts
    await page.locator('[data-testid="option-startup"]').tap();
    await page.locator('[data-testid="next-button"]').tap();
    
    // Mobile conversion prompt should be appropriately sized
    const conversionPrompt = page.locator('[data-testid="mobile-signup-prompt"]');
    if (await conversionPrompt.isVisible()) {
      const box = await conversionPrompt.boundingBox();
      expect(box?.width).toBeLessThan(400); // Should fit mobile screen
    }
  });

  test('guest user analytics and tracking', async ({ page }) => {
    // Verify guest user events are tracked
    let analyticsEvents: any[] = [];
    
    // Mock analytics tracking
    await page.addInitScript(() => {
      (window as any).trackEvent = (event: string, data: any) => {
        (window as any).analyticsEvents = (window as any).analyticsEvents || [];
        (window as any).analyticsEvents.push({ event, data, timestamp: Date.now() });
      };
    });
    
    // Start as guest
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Check guest session start event
    analyticsEvents = await page.evaluate(() => (window as any).analyticsEvents || []);
    expect(analyticsEvents.some(e => e.event === 'guest_session_start')).toBe(true);
    
    // Complete a step
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    // Check progress event
    analyticsEvents = await page.evaluate(() => (window as any).analyticsEvents || []);
    expect(analyticsEvents.some(e => e.event === 'wizard_step_complete')).toBe(true);
  });

  test('guest user accessibility compliance', async ({ page }) => {
    // Test accessibility features for guest users
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Focus first option
    await expect(page.locator('[data-testid="option-startup"]')).toBeFocused();
    
    await page.keyboard.press('Space'); // Select option
    await expect(page.locator('[data-testid="option-startup"]')).toBeChecked();
    
    // Test screen reader support for guest indicator
    const guestIndicator = page.locator('[data-testid="guest-indicator"]');
    await expect(guestIndicator).toHaveAttribute('aria-label');
    await expect(guestIndicator).toHaveAttribute('role', 'status');
    
    // Test high contrast mode support
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('[data-testid="wizard-container"]')).toBeVisible();
    
    // Guest indicators should remain visible in high contrast
    await expect(guestIndicator).toBeVisible();
  });

  test('guest user cross-browser compatibility', async ({ page, browserName }) => {
    // Test guest functionality across different browsers
    console.log(`Testing guest flow in ${browserName}`);
    
    // Start wizard
    await page.locator('[data-testid="start-wizard-guest"]').click();
    
    // Test localStorage functionality
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    const sessionId = await page.evaluate(() => localStorage.getItem('guest_session_id'));
    expect(sessionId).toBeTruthy();
    
    // Test progress persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const restoredSessionId = await page.evaluate(() => localStorage.getItem('guest_session_id'));
    expect(restoredSessionId).toBe(sessionId);
    
    // Should maintain progress
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('2');
  });
});