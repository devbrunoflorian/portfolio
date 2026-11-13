import { test, expect, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

for (const [locale, route, title, heading, nav, playerLabel, status] of [
  ['en', '/en/about/', 'About | Bruno Florian', "Behind every piece, there's a person.", ['Home', 'About', 'Labs', 'Projects', 'Contact'], 'Play Dissonância', 'Sound is off'],
  ['pt-BR', '/pt-br/sobre/', 'Sobre | Bruno Florian', 'Por trás de cada criação, há uma pessoa.', ['Início', 'Sobre', 'Laboratórios', 'Projetos', 'Contato'], 'Reproduzir Dissonância', 'Som desligado'],
] as const) {
  test(`${locale}: About is server-rendered with working language routes and opt-in audio`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('.desktop-nav a')).toHaveText(nav);
    await expect(page.locator('#about-title')).toHaveAttribute('aria-label', heading);
    await expect(page.locator('[data-audio-status]')).toHaveText(status);
    await expect(page.locator('[data-play-toggle]')).toHaveAttribute('aria-label', playerLabel);
    await expect(page.locator('[data-play-toggle]')).toHaveAttribute('data-audio-player-ready', 'true');
    await expect(page.locator('#music-mixer')).toHaveAttribute('data-audio-mixer-ready', 'true');
    await expect(page.locator('[data-track-mixer] input[type="range"]')).toHaveCount(4);
    await expect(page.locator('.locale-nav a[data-locale-choice="pt-br"]')).toHaveAttribute('href', '/pt-br/sobre/');
    await expect(page.locator('.locale-nav a[data-locale-choice="en"]')).toHaveAttribute('href', '/en/about/');
    await expect(page.locator('[data-world-src]')).not.toHaveAttribute('src');
  });
}

test('React player emits intent and reflects the standalone audio engine state', async ({ page }) => {
  await page.addInitScript(() => {
    const commands: unknown[] = [];
    Object.defineProperty(window, '__aboutAudioCommands', { value: commands, configurable: true });
    window.addEventListener('about-audio-command', event => {
      commands.push((event as CustomEvent).detail);
      event.stopImmediatePropagation();
    });
  });
  await page.goto('/en/about/');

  const toggle = page.locator('[data-play-toggle]');
  await expect(toggle).toHaveAttribute('data-audio-player-ready', 'true');
  await toggle.click();
  await expect.poll(() => page.evaluate(() => (window as any).__aboutAudioCommands)).toEqual([{ type: 'toggle' }]);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('about-audio-state', { detail: { state: 'playing' } })));
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveAttribute('aria-label', 'Pause Dissonância');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('about-audio-state', { detail: { state: 'paused' } })));
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAttribute('aria-label', 'Continue Dissonância');
});

test('the player command reaches the existing audio engine without creating audio automatically', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/pt-br/sobre/');
  await page.evaluate(() => document.querySelector('#music')?.scrollIntoView({ block: 'center' }));
  await expect(page.locator('[data-about-page]')).toHaveAttribute('data-active-chapter', 'music');
  await expect(page.locator('[data-audio-status]')).toHaveText('Som desligado');
  await page.locator('[data-play-toggle]').click();
  await expect(page.locator('[data-audio-status]')).toHaveText('Áudio indisponível');
});

test('React mixer sends volume and repeat changes to the single audio owner', async ({ page }) => {
  await page.addInitScript(() => {
    const commands: unknown[] = [];
    Object.defineProperty(window, '__aboutAudioCommands', { value: commands, configurable: true });
    window.addEventListener('about-audio-command', event => {
      commands.push((event as CustomEvent).detail);
      event.stopImmediatePropagation();
    });
  });
  await page.goto('/en/about/');
  const mixer = page.locator('#music-mixer');
  await expect(mixer).toHaveAttribute('data-audio-mixer-ready', 'true');
  await mixer.locator('summary').click();
  await mixer.locator('[data-track-mixer] input[type="range"]').nth(2).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => (window as any).__aboutAudioCommands)).toHaveLength(1);
  expect(await page.evaluate(() => (window as any).__aboutAudioCommands[0].type)).toBe('track-volume');
  expect(await page.evaluate(() => (window as any).__aboutAudioCommands[0].trackId)).toBe(3);

  await mixer.locator('[data-repeat]').uncheck();
  await expect.poll(() => page.evaluate(() => (window as any).__aboutAudioCommands)).toHaveLength(2);
  expect(await page.evaluate(() => (window as any).__aboutAudioCommands[1])).toEqual({ type: 'repeat', value: false });

  await mixer.locator('[data-mix-reset]').click();
  await expect(mixer.locator('[data-mixer-feedback]')).toHaveText('Mix restored.');
  expect(await page.evaluate(() => (window as any).__aboutAudioCommands[2])).toEqual({ type: 'restore-tracks' });
});

test('game assets remain deferred until the explicit Play action', async ({ page }) => {
  await page.goto('/pt-br/sobre/');
  const scene = page.locator('[data-world-src]');
  await expect(scene).not.toHaveAttribute('src');
  await page.locator('[data-world-open]').click();
  await expect(page.locator('[data-world-dialog]')).toBeVisible();
  await page.locator('[data-world-play]').click();
  await expect(scene).toHaveAttribute('src', '/assets/about-legacy/forest/forest-world-wide.png');
});

test('About keeps translated content and navigation available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/pt-br/sobre/');
  await expect(page.locator('#about-title')).toHaveAttribute('aria-label', 'Por trás de cada criação, há uma pessoa.');
  await expect(page.locator('.desktop-nav a')).toHaveText(['Início', 'Sobre', 'Laboratórios', 'Projetos', 'Contato']);
  await expect(page.locator('[data-play-toggle]')).toBeVisible();
  await page.locator('.locale-nav a[data-locale-choice="en"]').click();
  await expect(page).toHaveURL(/\/en\/about\/$/);
  await context.close();
});

test('audio commands remain connected after persisted page restoration', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/about/');
  await expect(page.locator('[data-play-toggle]')).toHaveAttribute('data-audio-player-ready', 'true');
  await page.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    document.querySelector('#music')?.scrollIntoView({ block: 'center' });
  });
  await expect(page.locator('[data-about-page]')).toHaveAttribute('data-active-chapter', 'music');
  await page.locator('[data-play-toggle]').click();
  await expect(page.locator('[data-audio-status]')).toHaveText('Audio unavailable');
});
