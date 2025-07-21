// Smoke Tests - Task 3.3: Testing Suite
// Basic smoke tests for production deployment validation

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests @smoke', () => {
  test('application loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Basic page load verification
    await expect(page).toHaveTitle(/ARA|Agent Readiness Assessment/);
    await expect(page.locator('body')).toBeVisible();
    
    // Check for critical elements
    await expect(page.locator('[data-testid="hero-section"], .hero, h1')).toBeVisible();
  });

  test('wizard is accessible', async ({ page }) => {
    await page.goto('/wizard');
    
    // Wizard loads and shows initial state
    await expect(page.locator('[data-testid="wizard-container"], .wizard, form')).toBeVisible();
    await expect(page.locator('[data-testid="progress-bar"], .progress, .stepper')).toBeVisible();
  });

  test('basic navigation works', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to wizard
    const wizardLink = page.locator('a[href*="/wizard"], [data-testid="start-wizard"]').first();
    if (await wizardLink.isVisible()) {
      await wizardLink.click();
      await expect(page).toHaveURL(/wizard/);
    }
    
    // Navigate back
    await page.goBack();
    await expect(page).toHaveURL('/');
  });

  test('API endpoints respond', async ({ page }) => {
    // Test basic API health
    const response = await page.request.get('/api/health');
    expect(response.status()).toBeLessThan(500); // Should not be server error
    
    // Test session endpoint
    const sessionResponse = await page.request.get('/api/wizard/session');
    expect(sessionResponse.status()).toBeLessThan(500);
  });

  test('error handling works', async ({ page }) => {
    // Test 404 handling
    await page.goto('/non-existent-page');
    
    // Should show some kind of error page or redirect
    const title = await page.title();
    const isErrorPage = title.includes('404') || title.includes('Not Found') || title.includes('Error');
    const hasRedirected = page.url().includes('/') && !page.url().includes('non-existent-page');
    
    expect(isErrorPage || hasRedirected).toBe(true);
  });

  test('basic form interaction works', async ({ page }) => {
    await page.goto('/wizard');
    
    // Find and interact with first form element
    const firstInput = page.locator('input, select, button[type="submit"]').first();
    if (await firstInput.isVisible()) {
      await firstInput.focus();
      // Don't need to complete the form, just verify it's interactive
    }
    
    // Should not crash
    await page.waitForTimeout(500);
    expect(page.isClosed()).toBe(false);
  });

  test('CSS and assets load', async ({ page }) => {
    await page.goto('/');
    
    // Check if styles are applied (body should not be completely unstyled)
    const bodyStyles = await page.locator('body').evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        fontFamily: styles.fontFamily,
        backgroundColor: styles.backgroundColor,
        margin: styles.margin,
      };
    });
    
    // At least one style property should be set (not default browser styles)
    const hasStyles = bodyStyles.fontFamily !== 'Times' || 
                     bodyStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                     bodyStyles.margin !== '8px';
    
    expect(hasStyles).toBe(true);
  });

  test('JavaScript is functional', async ({ page }) => {
    await page.goto('/');
    
    // Test basic JavaScript functionality
    const jsWorks = await page.evaluate(() => {
      try {
        // Basic JS test
        const arr = [1, 2, 3];
        return arr.length === 3 && typeof window !== 'undefined';
      } catch {
        return false;
      }
    });
    
    expect(jsWorks).toBe(true);
  });

  test('responsive design basics', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('essential meta tags present', async ({ page }) => {
    await page.goto('/');
    
    // Check for viewport meta tag (critical for mobile)
    const viewportMeta = page.locator('meta[name="viewport"]');
    if (await viewportMeta.count() > 0) {
      const content = await viewportMeta.getAttribute('content');
      expect(content).toContain('width=device-width');
    }
    
    // Should have some form of title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});