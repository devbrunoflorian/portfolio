import { test, expect } from '@playwright/test';

test('public Contact routes render localized links and headings in the initial HTML', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  for (const route of [
    { path: '/en/contact/', lang: 'en', heading: /Let.s make\s*something\s*real\./, alternate: '/pt-br/contato/' },
    { path: '/pt-br/contato/', lang: 'pt-BR', heading: /Vamos criar\s*algo\s*real\./, alternate: '/en/contact/' },
  ]) {
    await page.goto(route.path);
    await expect(page.locator('html')).toHaveAttribute('lang', route.lang);
    await expect(page.locator('#contact-title')).toContainText(route.heading);
    await expect(page.locator('.contact-channel-link[href="https://www.linkedin.com/in/rbrunoflorian/"]')).toBeVisible();
    await expect(page.locator('.contact-channel-link[href="mailto:dev.brunoflorian@gmail.com"]')).toBeVisible();
    await expect(page.locator('.contact-channel-link[href="https://wa.me/5547992457539"]')).toBeVisible();
    await expect(page.locator(`.locale-nav a[href="${route.alternate}"]`)).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  }

  await context.close();
});

test('review routes preserve localization, noindex and links back to the public page', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  for (const route of [
    { path: '/en/contact/stillflow/', lang: 'en', title: 'STILLFLOW · Contact | Bruno Florian', alternate: '/pt-br/contato/stillflow/', back: '/en/contact/' },
    { path: '/pt-br/contato/stillflow/', lang: 'pt-BR', title: 'STILLFLOW · Contato | Bruno Florian', alternate: '/en/contact/stillflow/', back: '/pt-br/contato/' },
  ]) {
    await page.goto(route.path);
    await expect(page.locator('html')).toHaveAttribute('lang', route.lang);
    await expect(page).toHaveTitle(route.title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator(`.locale-nav a[href="${route.alternate}"]`)).toBeVisible();
    await expect(page.locator('.sf-controls')).toBeHidden();
    await expect(page.locator(`.sf-controls a[href="${route.back}"]`)).toHaveAttribute('href', route.back);
  }

  await context.close();
});

test('without JavaScript the Contact still and direct channel links remain available', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/en/contact/');

  await expect(page.locator('.sf-frame[data-sf-current] .sf-photo')).toBeVisible();
  await expect(page.locator('.contact-channel-list')).toBeVisible();
  await expect(page.locator('.sf-controls')).toBeHidden();
  await expect(page.locator('.contact-channel-link')).toHaveCount(3);
  await context.close();
});

test('reduced motion keeps the public scene static and prevents the train event', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/en/contact/');

  await expect(page.locator('.contact-stage')).toHaveAttribute('data-sf-phase', 'idle');
  await expect(page.locator('[data-sf-status]')).toContainText('Reduced motion: static scene.');
  await expect(page.locator('[data-sf-pause]')).toBeDisabled();
  await expect(page.locator('.sf-train-event')).toHaveCount(1);
  const train = await page.locator('.sf-train-event').evaluate(video => ({ paused: (video as HTMLVideoElement).paused, hasSource: (video as HTMLVideoElement).hasAttribute('src') }));
  expect(train).toEqual({ paused: true, hasSource: false });
  await expect(page.locator('.contact-channel-link')).toHaveCount(3);
  await context.close();
});

test('review pause control holds and resumes the photographic scene', async ({ page }) => {
  await page.goto('/en/contact/stillflow/');
  const panel = page.locator('.sf-controls');
  await panel.locator('summary').click();
  const pause = panel.locator('[data-sf-pause]');
  await expect(pause).toBeEnabled();
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.contact-stage')).toHaveAttribute('data-sf-paused', 'true');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.contact-stage')).toHaveAttribute('data-sf-paused', 'false');
});
