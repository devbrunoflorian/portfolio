import { test, expect } from '@playwright/test';

const pageErrors = new WeakMap<import('@playwright/test').Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

async function ready(page: import('@playwright/test').Page, route = '/en/labs/') {
  await page.goto(route);
  await expect(page.locator('[data-labs-ready]')).toHaveAttribute('data-labs-ready', 'true', { timeout: 20_000 });
}

for (const [locale, route] of [['en', '/en/labs/'], ['pt-BR', '/pt-br/laboratorios/']] as const) {
  test(`${locale}: selection follows scroll and never exposes a reserved repository`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page, route);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('[data-lab-title]')).toHaveText('Rate Limiting Lab');
    await expect(page.locator('[data-lab-link]')).toHaveAttribute('href', 'https://github.com/engineering-proof-labs/rate-limiting-lab');
    await page.locator('[data-lab-next]').click();
    await expect(page.locator('[data-lab-index]')).toHaveText('02');
    await expect(page.locator('[data-lab-incoming]')).toBeVisible();
    await expect(page.locator('[data-lab-link]')).toBeHidden();
    expect(await page.locator('[data-lab-link]').getAttribute('href')).toBeNull();
    await page.locator('[data-lab-scene]').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-lab-index]')).toHaveText('01');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-lab-index]')).toHaveText('01');
    await page.evaluate(() => {
      const runway = document.querySelector<HTMLElement>('[data-labs-runway]')!;
      scrollTo(0, runway.offsetTop + runway.offsetHeight - innerHeight);
    });
    await expect(page.locator('[data-lab-index]')).toHaveText('05');
    await page.locator('[data-lab-next]').click();
    await expect(page.locator('[data-lab-index]')).toHaveText('05');
  });
}

test('fixed Labs heading stays fully readable while selection metadata enters and interrupts cleanly', async ({ page }) => {
  await ready(page);
  const heading = page.locator('#labs-title');
  await expect(heading).toHaveAttribute('data-scroll-fill-mode', 'static');
  await expect(page.locator('[data-lab-current-entry]')).not.toHaveClass(/is-entering/);
  await expect.poll(() => heading.locator('.scroll-fill-word').evaluateAll(words =>
    words.length > 0 && words.every(word => (word as HTMLElement).dataset.filled === 'true'),
  )).toBe(true);
  await page.evaluate(() => {
    const runway = document.querySelector<HTMLElement>('[data-labs-runway]')!;
    scrollTo(0, runway.offsetTop + runway.offsetHeight - innerHeight);
  });
  await expect.poll(() => heading.locator('.scroll-fill-word').evaluateAll(words =>
    words.every(word => (word as HTMLElement).dataset.filled === 'true'),
  )).toBe(true);

  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    scrollTo(0, 0);
  });
  await expect(page.locator('[data-lab-index]')).toHaveText('01');
  await page.locator('[data-lab-next]').click();
  await expect(page.locator('[data-lab-index]')).toHaveText('02');
  const enteringEntry = page.locator('[data-lab-current-entry]');
  const oldNode = await enteringEntry.evaluateHandle(element => element);
  await expect(enteringEntry).toHaveClass(/is-entering/);
  const animation = await enteringEntry.evaluate(element => ({
    name: getComputedStyle(element).animationName,
    durationToken: getComputedStyle(document.documentElement).getPropertyValue('--motion-editorial-duration').trim(),
  }));
  expect(animation).toEqual({ name: 'lab-current-enter', durationToken: '480ms' });
  await page.locator('[data-lab-next]').click();
  await expect(page.locator('[data-lab-index]')).toHaveText('03');
  expect(await oldNode.evaluate(element => element.isConnected)).toBe(false);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-lab-next]').click();
  await expect(page.locator('[data-lab-index]')).toHaveText('04');
  await expect.poll(() => page.locator('[data-lab-current-entry]').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
});

test('ambient pause stops the GPU loop without blocking scroll navigation', async ({ page }) => {
  await ready(page);
  await expect(page.locator('.lab-webgl-canvas')).toHaveAttribute('data-idle-running', 'true');
  await page.locator('[data-lab-motion]').click();
  await expect(page.locator('[data-lab-motion]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lab-webgl-canvas')).toHaveAttribute('data-idle-running', 'false');
  await page.locator('[data-lab-next]').click();
  await expect(page.locator('[data-lab-index]')).toHaveText('02');
  await expect(page.locator('.lab-webgl-canvas')).toHaveAttribute('data-idle-running', 'false');
  await page.locator('[data-lab-motion]').click();
  await expect(page.locator('.lab-webgl-canvas')).toHaveAttribute('data-idle-running', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.lab-webgl-canvas')).toHaveAttribute('data-idle-running', 'false');
});

test('capture progress is reversible through the final folder', async ({ page }) => {
  await ready(page, '/en/labs/?labs-capture=1');
  const states = await page.evaluate(() => {
    const capture = (window as any).__labsCapture;
    const snapshot = (progress: number) => {
      capture.setProgress(progress); capture.setTime(2);
      const canvas = document.querySelector<HTMLElement>('.lab-webgl-canvas')!;
      return { progress: canvas.dataset.scrollPosition, fraction: canvas.dataset.transitionFraction, dissolve: canvas.dataset.transitionDissolve, next: canvas.dataset.transitionRebuild };
    };
    return [snapshot(.45), snapshot(1.2), snapshot(.45), snapshot(4)];
  });
  expect(states[0]).toEqual(states[2]);
  expect(states[3]!.progress).toBe('4.000');
});

test('WebGL failure keeps the Canvas collection and navigation usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: any[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return (original as any).call(this, type, ...args);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await expect(page.locator('.lab-webgl-canvas')).toHaveCount(0);
  await expect(page.locator('.lab-transition-field')).toHaveCount(1);
  await page.locator('[data-lab-next]').click();
  await expect(page.locator('[data-lab-index]')).toHaveText('02');
});

test('crossing the desktop breakpoint replaces the renderer rather than duplicating it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  for (let i = 0; i < 2; i++) {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.lab-webgl-canvas')).toHaveCount(0);
    await expect(page.locator('.lab-transition-field')).toHaveCount(1);
    await expect(page.locator('.folder-reflection')).toHaveCount(5);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.lab-webgl-canvas')).toHaveCount(1);
    await expect(page.locator('[data-labs-ready]')).toHaveAttribute('data-labs-ready', 'true');
    await expect(page.locator('.folder-reflection')).toHaveCount(0);
  }
});

test('native vertical touch scroll changes selection; horizontal swipe remains a fallback action', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await ready(page);
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 600 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 400 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page.locator('[data-lab-scene]').dispatchEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 5, pointerType: 'touch', clientX: 260, clientY: 400 });
  await page.locator('[data-lab-scene]').dispatchEvent('pointerup', { isPrimary: true, button: 0, pointerId: 5, pointerType: 'touch', clientX: 100, clientY: 400 });
  await expect(page.locator('[data-lab-index]')).toHaveText('02');
  await context.close();
});

test('static HTML keeps the real repository and native language navigation without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/en/labs/');
  await expect(page.locator('[data-lab-title]')).toHaveText('Rate Limiting Lab');
  await expect(page.locator('[data-lab-link]')).toBeVisible();
  await expect(page.locator('[data-lab-controls]')).toBeHidden();
  await page.locator('.locale-nav a[data-locale-choice="pt-br"]').click();
  await expect(page).toHaveURL(/\/pt-br\/laboratorios\/$/);
  await page.locator('.mobile-menu summary').click();
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await context.close();
});

test('storage failure does not prevent changing language or returning with history', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); }; });
  await ready(page);
  await page.locator('.locale-nav [data-locale-choice="pt-br"]').click();
  await expect(page).toHaveURL(/\/pt-br\/laboratorios\/$/);
  await expect(page.locator('[data-labs-ready]')).toHaveAttribute('data-labs-ready', 'true', { timeout: 20_000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/labs\/$/);
  await expect(page.locator('[data-labs-ready]')).toHaveAttribute('data-labs-ready', 'true', { timeout: 20_000 });
  await expect(page.locator('.lab-webgl-canvas')).toHaveCount(1);
});

test('five controller lifecycles leave no renderer, capture API or active callbacks behind', async ({ page }) => {
  await page.route('**/_astro/**', route => route.abort());
  await page.goto('/en/labs/?labs-capture=1');
  const result = await page.evaluate(async () => {
    const url = '/assets/labs/controller.js';
    const { mountLabsController } = await import(/* @vite-ignore */ url);
    const root = document.querySelector<HTMLElement>('main')!;
    let updates = 0;
    for (let i = 0; i < 5; i++) {
      const controller = mountLabsController(root, { onState: () => updates++ });
      await controller.ready;
      controller.dispose(); controller.dispose();
    }
    const before = updates;
    dispatchEvent(new Event('resize')); dispatchEvent(new Event('scroll'));
    await new Promise(resolve => setTimeout(resolve, 100));
    return { unchanged: before === updates, canvases: root.querySelectorAll('.lab-webgl-canvas, .lab-transition-field, .folder-reflection').length, capture: '__labsCapture' in window };
  });
  expect(result).toEqual({ unchanged: true, canvases: 0, capture: false });
});

test('disposal during the model request prevents late mounting', async ({ page }) => {
  await page.route('**/_astro/**', route => route.abort());
  await page.route('**/*.glb', async route => { await new Promise(resolve => setTimeout(resolve, 200)); await route.continue(); });
  await page.goto('/en/labs/');
  const canvases = await page.evaluate(async () => {
    const url = '/assets/labs/controller.js';
    const { mountLabsController } = await import(/* @vite-ignore */ url);
    const controller = mountLabsController(document.querySelector('main'), { onState: () => {} });
    await new Promise(resolve => setTimeout(resolve, 50));
    controller.dispose(); await controller.ready;
    return document.querySelectorAll('.lab-webgl-canvas').length;
  });
  expect(canvases).toBe(0);
});

test('persisted page transitions pause and resume without creating a second renderer', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(page.locator('.lab-webgl-canvas')).toHaveAttribute('data-idle-running', 'false');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('.lab-webgl-canvas')).toHaveAttribute('data-idle-running', 'true');
  await expect(page.locator('.lab-webgl-canvas')).toHaveCount(1);
});
