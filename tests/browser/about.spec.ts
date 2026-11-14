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
    await expect(page.locator('.games-cover button')).toBeDisabled();
  });
}

test('Art preserves the portrait proportions and keeps copy clear of the face', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/pt-br/sobre/');

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.locator('#art').scrollIntoViewIfNeeded();
    const framing = await page.locator('#art').evaluate(section => {
      const image = section.querySelector('.art-portrait')!.getBoundingClientRect();
      // Face region measured in the original 1470 x 1070 artwork, not its paint aura.
      const face = { left: image.left + image.width * 350 / 1470, right: image.left + image.width * 800 / 1470, top: image.top + image.height * 100 / 1070, bottom: image.top + image.height * 600 / 1070 };
      const copy = [...section.querySelectorAll('#art-title, .art-copy > p:not(.about-eyebrow)')];
      const overlap = copy.reduce((total, element) => {
        const text = element.getBoundingClientRect();
        const width = Math.max(0, Math.min(face.right, text.right) - Math.max(face.left, text.left));
        const height = Math.max(0, Math.min(face.bottom, text.bottom) - Math.max(face.top, text.top));
        return total + width * height;
      }, 0);
      return { overlap, aspect: image.width / image.height };
    });

    expect(framing.overlap).toBe(0);
    expect(framing.aspect).toBeCloseTo(1470 / 1070, 2);
  }
});

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

test('Games is a static coming-soon cover with an unavailable Play action', async ({ page }) => {
  await page.goto('/pt-br/sobre/');
  await expect(page.locator('.games-cover-status')).toHaveText('Em breve');
  await expect(page.locator('.games-cover button')).toBeDisabled();
  await expect(page.locator('.games-cover button')).toHaveAttribute('aria-describedby', 'game-availability');
  await expect(page.locator('[data-world-dialog], [data-world-play], .knight-sprite')).toHaveCount(0);
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


async function seekJourney(page: Page, progress: number) {
  await page.locator('[data-about-journey]').evaluate((root, value) => {
    const start = scrollY + root.getBoundingClientRect().top;
    scrollTo(0, start + ((root as HTMLElement).offsetHeight - innerHeight) * value);
  }, progress);
  await expect.poll(async () => Number(await page.locator('[data-about-journey]').getAttribute('data-journey-progress'))).toBeCloseTo(progress, 2);
}

test('Music, Art and Games dissolve inside one stationary stage and reverse exactly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/pt-br/sobre/');
  await expect(page.locator('[data-about-journey]')).toHaveAttribute('data-journey-mode', 'pinned');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-art-image], [data-art-flower] img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  const stage = page.locator('[data-journey-stage]');
  await seekJourney(page, .25);
  const first = await stage.screenshot();
  const y = (await stage.boundingBox())!.y;
  await expect(page.locator('[data-art-composition]')).toHaveAttribute('data-masked', 'true');
  await seekJourney(page, .5);
  await expect(page.locator('[data-about-journey]')).toHaveAttribute('data-art-presence', '1.00000');
  await expect(page.locator('[data-art-composition]')).not.toHaveAttribute('data-masked');
  await expect(page.locator('[data-art-flower]')).toBeVisible();
  expect(await page.locator('[data-art-flower]').evaluate(el => el.closest('[data-art-composition]'))).toBeNull();
  expect((await stage.boundingBox())!.y).toBeCloseTo(y, 0);
  await seekJourney(page, .75);
  await expect(page.locator('[data-about-journey]')).toHaveAttribute('data-underlay', 'games');
  await expect(page.locator('[data-art-composition]')).toHaveAttribute('data-masked', 'true');
  expect((await stage.boundingBox())!.y).toBeCloseTo(y, 0);
  await seekJourney(page, .25);
  expect(Buffer.compare(await stage.screenshot(), first)).toBe(0);
});

test('the pointer moves smoke while the foreground flower stays anchored', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/about/'); await seekJourney(page, .5);
  const smoke = page.locator('.art-smoke--blue');
  const initial = await smoke.evaluate(el => getComputedStyle(el).transform);
  const flower = await page.locator('[data-art-flower]').evaluate(el => getComputedStyle(el).transform);
  await page.mouse.move(1050, 220);
  await expect.poll(() => smoke.evaluate(el => getComputedStyle(el).transform)).not.toBe(initial);
  await expect(page.locator('#art canvas')).toHaveCount(0);
  expect(await page.locator('[data-art-flower]').evaluate(el => getComputedStyle(el).transform)).toBe(flower);
});

test('opt-in playback stays active while the stage changes to Games', async ({ page }) => {
  await page.goto('/en/about/'); await seekJourney(page, 0);
  const player = page.locator('[data-play-toggle]'); await player.click();
  await expect(player).toHaveAttribute('aria-pressed', 'true');
  await seekJourney(page, 1);
  await expect(player).toHaveAttribute('aria-pressed', 'true');
  await player.click(); await expect(player).toHaveAttribute('aria-pressed', 'false');
});
