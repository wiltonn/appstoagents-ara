// Wizard Flow E2E Tests - Task 3.3: Testing Suite
// End-to-end tests for critical wizard completion flow

import { test, expect } from '@playwright/test';

test.describe('Wizard Flow - Critical User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the wizard page
    await page.goto('/wizard');
    
    // Wait for the wizard to load
    await page.waitForLoadState('networkidle');
  });

  test('complete wizard flow as guest user', async ({ page }) => {
    // Test the complete guest user wizard flow
    
    // Step 1: Verify wizard initialization
    await expect(page.locator('[data-testid="wizard-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('1');

    // Step 2: Answer first question (company size)
    await page.locator('[data-testid="question-company-size"]').click();
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();

    // Verify progress update
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('2');

    // Step 3: Answer AI usage question (scale rating)
    await page.locator('[data-testid="scale-slider"]').fill('7');
    await page.locator('[data-testid="next-button"]').click();

    // Step 4: Answer technical readiness questions
    await page.locator('[data-testid="technical-maturity-slider"]').fill('6');
    await page.locator('[data-testid="next-button"]').click();

    // Step 5: Answer data infrastructure questions
    await page.locator('[data-testid="data-infrastructure"]').selectOption('cloud');
    await page.locator('[data-testid="next-button"]').click();

    // Step 6: Complete final questions and review
    await page.locator('[data-testid="review-answers"]').click();

    // Verify score preview appears
    await expect(page.locator('[data-testid="score-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-score"]')).toBeVisible();

    // Step 7: Submit wizard
    await page.locator('[data-testid="submit-wizard"]').click();

    // Verify completion
    await expect(page.locator('[data-testid="wizard-completion"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-report"]')).toBeVisible();
  });

  test('wizard validation prevents progression with incomplete answers', async ({ page }) => {
    // Test validation prevents moving forward without answers
    
    // Try to proceed without answering first question
    await page.locator('[data-testid="next-button"]').click();
    
    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('required');
    
    // Should not advance to next step
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('1');
  });

  test('wizard supports going back to previous steps', async ({ page }) => {
    // Answer first question
    await page.locator('[data-testid="option-enterprise"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    // Answer second question
    await page.locator('[data-testid="scale-slider"]').fill('8');
    await page.locator('[data-testid="next-button"]').click();
    
    // Go back to previous step
    await page.locator('[data-testid="back-button"]').click();
    
    // Verify we're on step 2 and answer is preserved
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('2');
    await expect(page.locator('[data-testid="scale-slider"]')).toHaveValue('8');
    
    // Go back to first step
    await page.locator('[data-testid="back-button"]').click();
    
    // Verify first answer is preserved
    await expect(page.locator('[data-testid="option-enterprise"]')).toBeChecked();
  });

  test('wizard saves progress automatically', async ({ page }) => {
    // Answer first few questions
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    await page.locator('[data-testid="scale-slider"]').fill('5');
    await page.locator('[data-testid="next-button"]').click();
    
    // Reload the page to simulate returning user
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should restore to where user left off
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('3');
    
    // Go back to verify previous answers were saved
    await page.locator('[data-testid="back-button"]').click();
    await expect(page.locator('[data-testid="scale-slider"]')).toHaveValue('5');
    
    await page.locator('[data-testid="back-button"]').click();
    await expect(page.locator('[data-testid="option-startup"]')).toBeChecked();
  });

  test('wizard shows real-time score preview', async ({ page }) => {
    // Answer questions and verify score updates
    await page.locator('[data-testid="option-enterprise"]').click();
    
    // Check if score preview is visible and has initial score
    await expect(page.locator('[data-testid="score-preview"]')).toBeVisible();
    const initialScore = await page.locator('[data-testid="current-score"]').textContent();
    
    await page.locator('[data-testid="next-button"]').click();
    
    // Answer with high score
    await page.locator('[data-testid="scale-slider"]').fill('9');
    
    // Score should increase
    const updatedScore = await page.locator('[data-testid="current-score"]').textContent();
    expect(parseInt(updatedScore || '0')).toBeGreaterThan(parseInt(initialScore || '0'));
  });

  test('wizard accessibility features work correctly', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Focus first option
    await page.keyboard.press('Space'); // Select option
    await page.keyboard.press('Tab'); // Focus next button
    await page.keyboard.press('Enter'); // Proceed to next step
    
    // Verify step advancement
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('2');
    
    // Test screen reader support
    const questionTitle = page.locator('[data-testid="question-title"]');
    await expect(questionTitle).toHaveAttribute('role', 'heading');
    await expect(questionTitle).toHaveAttribute('aria-level', '2');
    
    // Test ARIA labels
    const progressBar = page.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toHaveAttribute('role', 'progressbar');
    await expect(progressBar).toHaveAttribute('aria-valuenow');
    await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  test('wizard handles conditional navigation', async ({ page }) => {
    // Answer questions that trigger conditional logic
    await page.locator('[data-testid="option-no-current-ai"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    // Should skip AI-specific questions and go to different path
    await expect(page.locator('[data-testid="question-title"]')).not.toContainText('AI');
    
    // Go back and select different option
    await page.locator('[data-testid="back-button"]').click();
    await page.locator('[data-testid="option-extensive-ai"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    // Should now show AI-specific questions
    await expect(page.locator('[data-testid="question-title"]')).toContainText('AI');
  });

  test('wizard completion generates downloadable report', async ({ page }) => {
    // Complete wizard quickly with valid answers
    const answers = [
      { selector: '[data-testid="option-enterprise"]', action: 'click' },
      { selector: '[data-testid="scale-slider"]', action: 'fill', value: '8' },
      { selector: '[data-testid="technical-maturity-slider"]', action: 'fill', value: '7' },
      { selector: '[data-testid="data-infrastructure"]', action: 'selectOption', value: 'hybrid' },
    ];

    for (const answer of answers) {
      if (answer.action === 'click') {
        await page.locator(answer.selector).click();
      } else if (answer.action === 'fill') {
        await page.locator(answer.selector).fill(answer.value!);
      } else if (answer.action === 'selectOption') {
        await page.locator(answer.selector).selectOption(answer.value!);
      }
      await page.locator('[data-testid="next-button"]').click();
    }

    // Complete wizard
    await page.locator('[data-testid="submit-wizard"]').click();
    
    // Wait for completion page
    await expect(page.locator('[data-testid="wizard-completion"]')).toBeVisible();
    
    // Test report download
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="download-report"]').click();
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/ara-audit-report-.*\.pdf/);
  });

  test('wizard works on mobile devices', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-specific test');
    
    // Test mobile-specific interactions
    await expect(page.locator('[data-testid="wizard-container"]')).toBeVisible();
    
    // Test touch interactions
    await page.locator('[data-testid="option-startup"]').tap();
    await page.locator('[data-testid="next-button"]').tap();
    
    // Test mobile-optimized components
    await expect(page.locator('[data-testid="mobile-progress"]')).toBeVisible();
    
    // Test swipe navigation (if implemented)
    const wizard = page.locator('[data-testid="wizard-container"]');
    await wizard.swipe('left'); // Swipe to next step
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('2');
  });

  test('wizard handles errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('**/api/wizard/**', route => {
      route.abort('networkfailure');
    });
    
    // Try to proceed
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('connection');
    
    // Should offer retry option
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Remove network mock and retry
    await page.unroute('**/api/wizard/**');
    await page.locator('[data-testid="retry-button"]').click();
    
    // Should proceed normally
    await expect(page.locator('[data-testid="step-counter"]')).toContainText('2');
  });

  test('wizard session timeout handling', async ({ page }) => {
    // Start wizard
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();
    
    // Mock session timeout
    await page.route('**/api/wizard/**', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Session expired' }),
      });
    });
    
    // Try to proceed
    await page.locator('[data-testid="scale-slider"]').fill('5');
    await page.locator('[data-testid="next-button"]').click();
    
    // Should handle session timeout
    await expect(page.locator('[data-testid="session-expired"]')).toBeVisible();
    await expect(page.locator('[data-testid="restart-session"]')).toBeVisible();
  });
});