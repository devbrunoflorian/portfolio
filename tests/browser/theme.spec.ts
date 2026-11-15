import { test, expect } from '@playwright/test';

const routes = ['/en/', '/pt-br/', '/en/about/', '/pt-br/sobre/', '/en/labs/', '/pt-br/laboratorios/', '/en/projects/', '/pt-br/projetos/', '/en/contact/', '/pt-br/contato/', '/en/contact/stillflow/', '/pt-br/contato/stillflow/'];
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('home-entrance-00-played', '1'));
});

async function apply(page: import('@playwright/test').Page, theme: 'dark' | 'light', animate = false) {
  await page.evaluate(async ({ theme, animate }) => {
    const path = '/assets/shared/theme.js';
    await (await import(path)).setTheme(theme, { animate });
  }, { theme, animate });
}

test('first visit stays dark even on a light OS; the button advertises the next action', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/en/projects/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const button = page.locator('[data-theme-toggle]');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-label', 'Switch to dark theme');
  expect(await page.evaluate(() => localStorage.getItem('portfolio-theme'))).toBe('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('.locale-nav a[data-locale-choice="pt-br"]').click();
  await expect(page.getByRole('button', { name: 'Ativar tema escuro' })).toBeVisible();
});

test('all localized and review routes read the saved light preference and retain a 64px header', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('portfolio-theme', 'light'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('[data-theme-toggle]')).toBeVisible();
    expect(await page.locator('.site-header').evaluate(el => el.getBoundingClientRect().height), route).toBe(64);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
    expect(await page.locator('meta[name="color-scheme"]').getAttribute('content')).toBe('light');
  }
});

test('without JavaScript, dark content is available and the unavailable theme button stays hidden', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/en/about/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-theme-toggle]')).toBeHidden();
  await expect(page.locator('main h1')).toBeVisible();
  await context.close();
});

test('a blocked preference store does not prevent an in-page theme change', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/projects/');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the real wave retains pseudo-elements, clips the new view and cleans up after scroll', async ({ page }) => {
  await page.goto('/en/projects/');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-transition', 'running');
  await page.waitForTimeout(250);
  const clip = await page.evaluate(() => getComputedStyle(document.documentElement, '::view-transition-new(root)').clipPath);
  expect(clip).toContain('path(');
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--theme-reveal'))).toBe('');
});

test('rapid changes before capture leave only the final target and no stale wave', async ({ page }) => {
  await page.goto('/en/projects/');
  await page.evaluate(async () => {
    const path = '/assets/shared/theme.js';
    const { setTheme } = await import(path);
    await Promise.all([setTheme('light'), setTheme('dark'), setTheme('light')]);
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
});

test('a restored document reads the preference selected on a later page', async ({ page }) => {
  await page.goto('/en/projects/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => {
    localStorage.setItem('portfolio-theme', 'light');
    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-label', 'Switch to dark theme');
});

test('lazy participants receive the current theme and dispose aborts delayed writes', async ({ page }) => {
  await page.goto('/en/projects/');
  await apply(page, 'light');
  const result = await page.evaluate(async () => {
    const path = '/assets/shared/theme.js';
    const { registerThemeParticipant, setTheme } = await import(path);
    const received: string[] = [];
    const unregister = registerThemeParticipant({ applyTheme: (theme: string) => { received.push(theme); } });
    await new Promise(resolve => setTimeout(resolve, 0));
    await setTheme('dark', { animate: false });
    unregister();
    await setTheme('light', { animate: false });
    let wrote = false;
    let release: () => void = () => {};
    const stopped = registerThemeParticipant({ applyTheme: async (_: string, { signal }: { signal: AbortSignal }) => {
      await new Promise<void>(resolve => { release = resolve; });
      if (!signal.aborted) wrote = true;
    } });
    await new Promise(resolve => setTimeout(resolve, 0));
    stopped(); release();
    await new Promise(resolve => setTimeout(resolve, 0));
    return { received, wrote };
  });
  expect(result).toEqual({ received: ['light', 'dark'], wrote: false });
});

test('unsupported and throwing transition APIs still await theme preparation', async ({ page }) => {
  await page.goto('/en/projects/');
  const result = await page.evaluate(async () => {
    const path = '/assets/shared/theme.js';
    const { setTheme, registerThemeParticipant } = await import(path);
    let ready = false;
    const off = registerThemeParticipant({ applyTheme: async () => { await new Promise(resolve => setTimeout(resolve, 30)); ready = true; } });
    document.startViewTransition = () => { throw new Error('Unavailable'); };
    await setTheme('light');
    off();
    return { ready, theme: document.documentElement.dataset.theme };
  });
  expect(result).toEqual({ ready: true, theme: 'light' });
  await page.evaluate(() => { Object.defineProperty(document, 'startViewTransition', { value: undefined }); });
  await apply(page, 'dark', true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('a slow participant abandons the wave but can finish the current theme safely', async ({ page }) => {
  await page.goto('/en/projects/');
  const result = await page.evaluate(async () => {
    const path = '/assets/shared/theme.js';
    const { registerThemeParticipant, setTheme } = await import(path);
    let finished = false;
    const off = registerThemeParticipant({ applyTheme: async (theme: string, { signal }: { signal: AbortSignal }) => {
      if (theme !== 'light') return;
      await new Promise(resolve => setTimeout(resolve, 400));
      if (!signal.aborted) finished = true;
    } });
    await setTheme('light');
    const waveEnded = !document.documentElement.hasAttribute('data-theme-transition');
    await new Promise(resolve => setTimeout(resolve, 200));
    off();
    return { finished, waveEnded, theme: document.documentElement.dataset.theme };
  });
  expect(result).toEqual({ finished: true, waveEnded: true, theme: 'light' });
});

test('a failed participant and failed fallback cannot strand the theme or reject initialization', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/en/projects/');
  await page.evaluate(async () => {
    const path = '/assets/shared/theme.js';
    const { registerThemeParticipant, setTheme } = await import(path);
    const off = registerThemeParticipant({
      applyTheme() { throw new Error('Scene failed'); },
      onError() { throw new Error('Fallback failed'); },
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    await setTheme('light', { animate: false });
    off();
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-label', 'Switch to dark theme');
  expect(errors).toEqual([]);
});

test('Home renders an ivory material and restores onyx without changing its paused pose', async ({ page }) => {
  await page.goto('/en/?home-capture=1');
  const frame = page.locator('#scene-frame');
  await expect(frame).toHaveAttribute('data-capture-ready', 'true', { timeout: 30000 });
  await expect(frame).toHaveAttribute('data-knight-theme', 'onyx');
  const pose = () => frame.evaluate(el => ['modelYaw', 'modelPitch', 'progress', 'assemblyProgress'].map(key => (el as HTMLElement).dataset[key]));
  const before = await pose();
  const materialBefore = await page.evaluate(() => (window as any).__homeCapture.snapshot().renderer.knightMaterial);
  await apply(page, 'light');
  await expect(frame).toHaveAttribute('data-knight-theme', 'ivory');
  expect(await page.evaluate(() => (window as any).__homeCapture.snapshot().renderer.knightMaterial.color)).toBe('f2e7cf');
  expect(await pose()).toEqual(before);
  await apply(page, 'dark');
  await expect(frame).toHaveAttribute('data-knight-theme', 'onyx');
  expect(await page.evaluate(() => (window as any).__homeCapture.snapshot().renderer.knightMaterial)).toEqual(materialBefore);
  expect(await pose()).toEqual(before);
});

test('a saved light theme changed during model loading builds the final dark material', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('portfolio-theme', 'light'));
  let requested = false;
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/assets/models/chess-knight-006-web.glb', async route => {
    requested = true;
    await pending;
    await route.continue();
  });
  await page.goto('/en/?home-capture=1');
  await expect.poll(() => requested).toBe(true);
  await apply(page, 'dark');
  release();
  await expect(page.locator('#scene-frame')).toHaveAttribute('data-knight-theme', 'onyx', { timeout: 30000 });
  expect(await page.evaluate(() => (window as any).__homeCapture.snapshot().renderer.knightMaterial.color)).toBe('0f1114');
});

test('changing theme preserves SVG notation and active audio transport', async ({ page }) => {
  await page.goto('/en/about/');
  const notes = await page.locator('.score-window path').count();
  const audio = page.locator('[data-floating-audio] [data-play-toggle]');
  await expect(audio).toHaveAttribute('data-audio-player-ready', 'true');
  await audio.click();
  await expect(audio).toHaveAttribute('aria-pressed', 'true');
  await apply(page, 'light');
  await expect(audio).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.score-window path').count()).toBe(notes);
  await audio.click();
  await expect(audio).toHaveAttribute('aria-pressed', 'false');
});

test('the paused Labs renderer changes palette without changing its time, selection or pose', async ({ page }) => {
  await page.goto('/en/labs/?labs-capture=1');
  const canvas = page.locator('.lab-webgl-canvas[data-proof-ready="true"]');
  await expect(canvas).toBeVisible({ timeout: 25000 });
  const keys = ['captureTime', 'scrollPosition', 'activeFolderSlot', 'glyphCount', 'idleRunning'];
  const before = await canvas.evaluate((el, keys) => Object.fromEntries(keys.map(key => [key, (el as HTMLElement).dataset[key]])), keys);
  await apply(page, 'light');
  await expect(canvas).toHaveAttribute('data-theme', 'light');
  const after = await canvas.evaluate((el, keys) => Object.fromEntries(keys.map(key => [key, (el as HTMLElement).dataset[key]])), keys);
  expect(after).toEqual(before);
  await apply(page, 'dark');
  await expect(canvas).toHaveAttribute('data-theme', 'dark');
});

test('the mobile Canvas fallback paints readable blue ink and keeps its selected folder', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/labs/');
  await expect(page.locator('[data-labs-ready]')).toHaveAttribute('data-labs-ready', 'true');
  const selected = await page.locator('[data-lab-index]').textContent();
  await apply(page, 'light');
  const inkPixels = await page.locator('[data-folder-canvas]').first().evaluate(el => {
    const canvas = el as HTMLCanvasElement;
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const red = pixels[i]!, blue = pixels[i+2]!, alpha = pixels[i+3]!;
      if (alpha > 100 && blue > red * 1.2 && blue < 220) count++;
    }
    return count;
  });
  expect(inkPixels).toBeGreaterThan(100);
  expect(await page.locator('[data-lab-index]').textContent()).toBe(selected);
});

for (const width of [320, 390, 1440]) {
  test(`audio stays outside the header and the menu takes priority at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en/about/');
    const audio = page.locator('[data-floating-audio]');
    await expect(audio).toBeVisible();
    expect(await audio.evaluate(el => el.closest('header'))).toBeNull();
    const box = await audio.boundingBox();
    expect(box!.y).toBe(76);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    const toggle = page.locator('[data-theme-toggle]');
    expect((await toggle.boundingBox())!.width).toBe(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 840) {
      await page.locator('.menu-toggle').click();
      await expect(audio).toBeHidden();
      await expect(audio).toHaveAttribute('inert', '');
    }
  });
}
