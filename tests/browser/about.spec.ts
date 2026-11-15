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

test('reduced motion completes the opening cleanly when enabled during its entrance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/about/');
  const heading = page.locator('#about-title');
  await expect(heading).toHaveAttribute('data-scroll-fill-ready', 'true');
  await page.waitForFunction(() => {
    const title = document.querySelector<HTMLElement>('#about-title');
    return title?.dataset.introStage === 'appear'
      && [...(title?.querySelectorAll<HTMLElement>('.scroll-fill-syllable') ?? [])]
        .some(syllable => Number(syllable.style.opacity) > 0 && Number(syllable.style.opacity) < 1);
  }, undefined, { timeout: 6000 });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(heading).toHaveAttribute('data-scroll-fill-complete', 'true');
  const finalStyles = await heading.evaluate(title => ({
    label: title.getAttribute('aria-label'),
    syllables: [...title.querySelectorAll<HTMLElement>('.scroll-fill-syllable')].map(syllable => ({
      inlineOpacity: syllable.style.opacity,
      inlineTransform: syllable.style.transform,
      opacity: getComputedStyle(syllable).opacity,
      transform: getComputedStyle(syllable).transform,
    })),
    body: [...document.querySelectorAll<HTMLElement>('.about-opening [data-opening-sentence] .scroll-fill-word')]
      .map(word => ({ opacity: word.style.opacity, transform: word.style.transform })),
    reveal: getComputedStyle(document.querySelector('.about-opening')!).getPropertyValue('--opening-reveal'),
  }));

  expect(finalStyles.label).toBe("Behind every piece, there's a person.");
  expect(finalStyles.syllables.length).toBeGreaterThan(0);
  expect(finalStyles.syllables.every(style => style.inlineOpacity === '' && style.inlineTransform === '' && style.opacity === '1' && style.transform === 'none')).toBe(true);
  expect(finalStyles.body.every(style => style.opacity === '1' && style.transform === 'none')).toBe(true);
  expect(finalStyles.reveal.trim()).toBe('1');
});

for (const route of ['/en/about/', '/pt-br/sobre/']) {
  test(`${route}: the highlighted word follows the phrase cadence and reveals left to right`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(route);
    const heading = page.locator('#about-title');
    await expect(heading).toHaveAttribute('data-scroll-fill-ready', 'true');

    const sample = () => heading.evaluate(title => {
      const line = title.querySelector<HTMLElement>('.opening-title-wide .opening-title-line:nth-of-type(2)');
      const bridge = [...(line?.querySelectorAll<HTMLElement>('.scroll-fill-syllable') ?? [])]
        .filter(syllable => !syllable.closest('em') && !/^[.,!?]$/u.test(syllable.textContent.trim()));
      const person = [...(line?.querySelectorAll<HTMLElement>('em .scroll-fill-syllable') ?? [])];
      const scene = title.closest<HTMLElement>('.about-opening')!;
      return {
        bridge: bridge.map(syllable => Number(syllable.style.opacity)),
        person: person.map(syllable => Number(syllable.style.opacity)),
        reveal: Number(scene.style.getPropertyValue('--opening-reveal')),
      };
    });

    await page.waitForFunction(() => {
      const line = document.querySelector<HTMLElement>('#about-title .opening-title-wide .opening-title-line:nth-of-type(2)');
      const bridge = [...(line?.querySelectorAll<HTMLElement>('.scroll-fill-syllable') ?? [])]
        .filter(syllable => !syllable.closest('em') && !/^[.,!?]$/u.test(syllable.textContent.trim()));
      const person = [...(line?.querySelectorAll<HTMLElement>('em .scroll-fill-syllable') ?? [])];
      const bridgeEnd = Number(bridge.at(-1)?.style.opacity);
      const leadingOpacity = Number(person[0]?.style.opacity);
      return bridge.length > 0
        && person.length > 1
        && bridgeEnd > 0 && bridgeEnd < 1
        && leadingOpacity > 0 && leadingOpacity < 1
        && person.slice(1).every(syllable => Number(syllable.style.opacity) === 0);
    });

    const firstSyllable = await sample();
    expect(firstSyllable.bridge.at(-1)).toBeGreaterThan(0);
    expect(firstSyllable.bridge.at(-1)).toBeLessThan(1);
    expect(firstSyllable.person[0]).toBeGreaterThan(0);
    expect(firstSyllable.person[0]).toBeLessThan(1);
    expect(firstSyllable.person.slice(1).every(opacity => opacity === 0)).toBe(true);
    expect(firstSyllable.reveal).toBeGreaterThan(0);
    expect(firstSyllable.reveal).toBeLessThan(1);

    await page.waitForFunction(() => {
      const line = document.querySelector<HTMLElement>('#about-title .opening-title-wide .opening-title-line:nth-of-type(2)');
      const person = [...(line?.querySelectorAll<HTMLElement>('em .scroll-fill-syllable') ?? [])];
      return person.length > 1
        && Number(person[0]?.style.opacity) === 1
        && Number(person.at(-1)?.style.opacity) > 0
        && Number(person.at(-1)?.style.opacity) < 1;
    });
    const movingRight = await sample();
    expect(movingRight.person[0]).toBe(1);
    expect(movingRight.person.at(-1)).toBeGreaterThan(0);
    expect(movingRight.person.at(-1)).toBeLessThan(1);
    expect(movingRight.person[0]).toBeGreaterThan(movingRight.person.at(-1)!);

    await page.waitForFunction(() => {
      const line = document.querySelector<HTMLElement>('#about-title .opening-title-wide .opening-title-line:nth-of-type(2)');
      const person = [...(line?.querySelectorAll<HTMLElement>('em .scroll-fill-syllable') ?? [])];
      const scene = document.querySelector<HTMLElement>('.about-opening');
      return person.length > 1
        && person.every(syllable => Number(syllable.style.opacity) === 1)
        && Number(scene?.style.getPropertyValue('--opening-reveal')) === 1;
    });

    const completeReveal = await sample();
    expect(completeReveal.person.every(opacity => opacity === 1)).toBe(true);
    expect(completeReveal.reveal).toBe(1);
  });
}

test('the opening clock pauses and resumes across the motion toggle and hidden tab state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/about/');
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('#about-title em .scroll-fill-syllable')]
    .some(syllable => Number(syllable.style.opacity) > 0 && Number(syllable.style.opacity) < 1), undefined, { timeout: 10000 });

  const sampleOpening = () => page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>('.about-opening')!;
    const person = [...document.querySelectorAll<HTMLElement>('#about-title em .scroll-fill-syllable')]
      .map(syllable => [syllable.style.opacity, syllable.style.transform]);
    return {
      person,
      reveal: scene.style.getPropertyValue('--opening-reveal'),
      blur: scene.style.getPropertyValue('--opening-table-blur'),
    };
  });

  const beforePause = await sampleOpening();
  expect(Number(beforePause.reveal)).toBeGreaterThan(0);
  await page.evaluate(() => { document.documentElement.dataset.motionPaused = 'true'; });
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'true');
  await page.waitForTimeout(50);
  const pausedFrame = await sampleOpening();
  await page.waitForTimeout(180);
  expect(await sampleOpening()).toEqual(pausedFrame);

  await page.evaluate(() => { document.documentElement.dataset.motionPaused = 'false'; });
  await expect.poll(async () => (await sampleOpening()).reveal).not.toBe(pausedFrame.reveal);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(50);
  const hiddenFrame = await sampleOpening();
  await page.waitForTimeout(180);
  expect(await sampleOpening()).toEqual(hiddenFrame);

  await page.evaluate(() => {
    delete (document as any).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await sampleOpening()).reveal).not.toBe(hiddenFrame.reveal);
});

for (const route of ['/en/about/', '/pt-br/sobre/']) {
  test(`${route}: pinned Art stays fully formed through its central reading window`, async ({ page }) => {
    await page.goto(route);
    const root = page.locator('[data-about-journey]');
    const geometry = await root.evaluate(element => ({
      top: element.getBoundingClientRect().top + scrollY,
      travel: (element as HTMLElement).offsetHeight - innerHeight,
    }));

    for (const progress of [.4, .5, .6]) {
      await page.evaluate(({ top, travel, progress }) => scrollTo(0, top + travel * progress), { ...geometry, progress });
      await expect.poll(() => root.getAttribute('data-art-presence')).toBe('1.00000');
      await expect(page.locator('[data-art-composition]')).not.toHaveAttribute('data-masked', 'true');
    }
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

test('pausing ambient motion preserves the current Art dissolve and chapter access', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/en/about/');
  const root = page.locator('[data-about-journey]');
  const pause = page.locator('[data-motion-toggle]');
  await expect(pause).toHaveAttribute('aria-pressed', 'false');

  await seekJourney(page, .3);
  const formingPresence = Number(await root.getAttribute('data-art-presence'));
  expect(formingPresence).toBeGreaterThan(0);
  expect(formingPresence).toBeLessThan(1);
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await root.getAttribute('data-art-presence'))).toBeCloseTo(formingPresence, 4);
  await expect(root).toHaveAttribute('data-interactive-chapter', 'music');
  await expect(page.locator('[data-art-composition]')).toHaveAttribute('data-masked', 'true');
  await expect(page.locator('[data-art-composition]')).toHaveCSS('visibility', 'visible');

  await seekJourney(page, .8);
  const dissolvingPresence = Number(await root.getAttribute('data-art-presence'));
  expect(dissolvingPresence).toBeGreaterThan(0);
  expect(dissolvingPresence).toBeLessThan(1);
  await expect(root).toHaveAttribute('data-interactive-chapter', 'art');
  await expect(page.locator('[data-journey-panel="art"]')).not.toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[data-journey-panel="games"]')).toHaveAttribute('aria-hidden', 'true');

  await seekJourney(page, .3);
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
});

test('chapter fragments, browser back and forward, and reload seek to their authored positions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/about/#music');
  const root = page.locator('[data-about-journey]');
  await expect.poll(async () => Number(await root.getAttribute('data-journey-progress'))).toBeCloseTo(0, 3);

  await page.evaluate(() => { location.hash = '#art'; });
  await expect.poll(async () => Number(await root.getAttribute('data-journey-progress'))).toBeCloseTo(.5, 2);
  await page.goBack();
  await expect(page).toHaveURL(/#music$/);
  await expect.poll(async () => Number(await root.getAttribute('data-journey-progress'))).toBeCloseTo(0, 3);
  await page.goForward();
  await expect(page).toHaveURL(/#art$/);
  await expect.poll(async () => Number(await root.getAttribute('data-journey-progress'))).toBeCloseTo(.5, 2);

  await page.evaluate(() => { location.hash = '#games'; });
  await expect.poll(async () => Number(await root.getAttribute('data-journey-progress'))).toBeCloseTo(1, 3);
  await page.reload();
  await expect(page).toHaveURL(/#games$/);
  await expect.poll(async () => Number(await page.locator('[data-about-journey]').getAttribute('data-journey-progress'))).toBeCloseTo(1, 3);
});

test('manual scrolling cancels a delayed initial hash correction after fonts load', async ({ page }) => {
  await page.addInitScript(() => {
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    Object.defineProperty(document.fonts, 'ready', { configurable: true, value: ready });
    (window as any).__releaseTestFonts = release;
    (window as any).__testWheelEvents = 0;
    window.addEventListener('wheel', () => { (window as any).__testWheelEvents++; });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/about/#art');
  const root = page.locator('[data-about-journey]');
  await expect(root).toHaveAttribute('data-journey-mode', 'pinned');
  await root.evaluate(element => {
    const top = scrollY + element.getBoundingClientRect().top;
    const max = top + (element as HTMLElement).offsetHeight - innerHeight;
    scrollTo(0, max);
  });
  await expect.poll(async () => Number(await root.getAttribute('data-journey-progress'))).toBeCloseTo(1, 2);
  const beforeReleaseY = await page.evaluate(() => scrollY);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 10);
  await expect.poll(() => page.evaluate(() => (window as any).__testWheelEvents)).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__releaseTestFonts());
  await page.waitForTimeout(50);
  const afterReleaseY = await page.evaluate(() => scrollY);
  expect(Math.abs(afterReleaseY - beforeReleaseY)).toBeLessThan(20);
  expect(Number(await root.getAttribute('data-journey-progress'))).not.toBeCloseTo(.5, 1);
  await expect(page).toHaveURL(/#art$/);
});

test('journey returns from reduced motion and recalculates its center after resize', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/pt-br/sobre/');
  const root = page.locator('[data-about-journey]');
  await expect(root).toHaveAttribute('data-journey-mode', 'pinned');
  await seekJourney(page, .5);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(root).toHaveAttribute('data-journey-mode', 'static');
  await expect(page.locator('[data-journey-panel="art"]')).not.toHaveJSProperty('inert', true);
  await expect(page.locator('[data-art-composition]')).not.toHaveAttribute('data-masked');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(root).toHaveAttribute('data-journey-mode', 'pinned');
  await page.setViewportSize({ width: 900, height: 900 });
  await seekJourney(page, .5);
  await expect(root).toHaveAttribute('data-art-presence', '1.00000');
  await expect(page.locator('[data-journey-panel="art"]')).not.toHaveAttribute('aria-hidden', 'true');
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

test('inactive journey chapters leave the keyboard focus in an available area', async ({ page }) => {
  await page.goto('/en/about/');
  await seekJourney(page, 0);

  const player = page.locator('[data-play-toggle]');
  await player.focus();
  await expect(player).toBeFocused();

  await seekJourney(page, .4);
  const music = page.locator('[data-journey-panel="music"]');
  await expect(music).toHaveAttribute('aria-hidden', 'true');
  await expect(music).toHaveJSProperty('inert', true);
  expect(await music.evaluate(panel => panel.contains(document.activeElement))).toBe(false);

  await seekJourney(page, .88);
  const art = page.locator('[data-journey-panel="art"]');
  await expect(art).toHaveAttribute('aria-hidden', 'true');
  await expect(art).toHaveJSProperty('inert', true);
  expect(await art.evaluate(panel => panel.contains(document.activeElement))).toBe(false);
  await expect(page.locator('[data-journey-panel="games"]')).not.toHaveAttribute('aria-hidden', 'true');
});
