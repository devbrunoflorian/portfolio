import { test, expect, type Page } from '@playwright/test';

async function seekEntry(page: Page, progress: number) {
  await page.evaluate(value => {
    const journey = document.querySelector<HTMLElement>('[data-about-journey]')!;
    const top = journey.getBoundingClientRect().top + scrollY;
    const start = top - innerHeight * .78;
    const end = top + innerHeight * .22;
    scrollTo(0, start + (end - start) * value);
  }, progress);
}

test('Code → Music fold is reversible, theme-aware, and leaves the Music → Art dissolve alone', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/pt-br/sobre/');

  const canvas = page.locator('.code-to-music-canvas');
  await seekEntry(page, .45);
  await expect.poll(() => canvas.getAttribute('data-fold-progress'), { timeout: 10_000 }).not.toBeNull();
  const forwardPose = await canvas.getAttribute('data-fold-progress');
  const artPresence = await page.locator('[data-about-journey]').getAttribute('data-art-presence');

  await seekEntry(page, .22);
  await expect.poll(async () => Number(await canvas.getAttribute('data-fold-progress'))).toBeLessThan(Number(forwardPose));
  await seekEntry(page, .45);
  await expect.poll(() => canvas.getAttribute('data-fold-progress')).toBe(forwardPose);

  await page.locator('[data-theme-toggle]').evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => canvas.getAttribute('data-fold-progress')).toBe(forwardPose);
  await expect(page.locator('[data-about-journey]')).toHaveAttribute('data-art-presence', artPresence!);
  expect(errors).toEqual([]);
});

test('reduced motion and direct Music entry keep the functional score visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/about/');
  await seekEntry(page, .5);
  await expect(page.locator('.code-to-music-canvas')).toBeHidden();

  await page.goto('/en/about/#music');
  await expect(page.locator('.code-to-music-canvas')).toBeHidden();
  await expect(page.locator('.about-music .score-window .score-measure').first()).toBeVisible();
});
