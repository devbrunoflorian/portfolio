import { test, expect } from '@playwright/test';

test('root language links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Escolha um idioma');
  const portuguese = page.getByRole('link', { name: 'Português (Brasil)' });
  const english = page.getByRole('link', { name: 'English' });
  await expect(portuguese).toHaveAttribute('href', '/pt-br/');
  await expect(english).toHaveAttribute('href', '/en/');
  await english.click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('From');
  await context.close();
});

test('root chooses a saved locale before the browser locale', async ({ browser }) => {
  const savedContext = await browser.newContext({ locale: 'pt-BR' });
  await savedContext.addInitScript(() => localStorage.setItem('portfolio.preferredLocale', 'en'));
  const savedPage = await savedContext.newPage();
  await savedPage.goto('/');
  await expect(savedPage).toHaveURL(/\/en\/$/);
  await savedContext.close();

  const browserContext = await browser.newContext({ locale: 'en-US' });
  const browserPage = await browserContext.newPage();
  await browserPage.goto('/');
  await expect(browserPage).toHaveURL(/\/en\/$/);
  await browserContext.close();

  const portugueseContext = await browser.newContext({ locale: 'pt-BR' });
  const portuguesePage = await portugueseContext.newPage();
  await portuguesePage.goto('/');
  await expect(portuguesePage).toHaveURL(/\/pt-br\/$/);
  await portugueseContext.close();
});

test('PT and EN Home render localized content, shared navigation and locale links in HTML', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/pt-br/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('main h1')).toContainText(/Da\s*ideia\s*à\s*forma\./);
  await expect(page.locator('.desktop-nav a')).toHaveText(['Início', 'Sobre', 'Laboratórios', 'Projetos', 'Contato']);
  await expect(page.locator('.locale-nav a[data-locale-choice="pt-br"]')).toHaveAttribute('href', '/pt-br/');
  await expect(page.locator('.locale-nav a[data-locale-choice="en"]')).toHaveAttribute('href', '/en/');

  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main h1')).toContainText(/From\s*thought\s*to\s*form\./);
  await expect(page.locator('.desktop-nav a')).toHaveText(['Home', 'About', 'Labs', 'Projects', 'Contact']);
  await expect(page.locator('.locale-nav a[data-locale-choice="pt-br"]')).toHaveAttribute('href', '/pt-br/');
  await expect(page.locator('.locale-nav a[data-locale-choice="en"]')).toHaveAttribute('href', '/en/');

  await context.close();
});

test('choosing a Home locale persists it for the root entry', async ({ page }) => {
  await page.goto('/pt-br/');
  await page.locator('.locale-nav a[data-locale-choice="en"]').click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('portfolio.preferredLocale'))).toBe('en');
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
});

test('shared header feedback keeps its 160ms color transition contract across routes', async ({ page }) => {
  for (const route of [
    '/en/', '/pt-br/',
    '/en/about/', '/pt-br/sobre/',
    '/en/labs/', '/pt-br/laboratorios/',
    '/en/contact/', '/pt-br/contato/',
    '/en/contact/stillflow/', '/pt-br/contato/stillflow/',
    '/en/projects/', '/pt-br/projetos/',
  ]) {
    await page.goto(route);
    const timing = await page.locator('.desktop-nav a').first().evaluate(element => {
      const styles = getComputedStyle(element);
      return {
        token: getComputedStyle(document.documentElement).getPropertyValue('--motion-feedback-duration').trim(),
        duration: styles.transitionDuration,
        easing: styles.transitionTimingFunction,
        footerDuration: getComputedStyle(document.querySelector('.site-footer a')!).transitionDuration,
      };
    });

    expect(timing, route).toEqual({ token: '160ms', duration: '0.16s', easing: 'ease', footerDuration: '0.16s' });
  }
});

for (const [locale, route] of [['EN', '/en/'], ['PT-BR', '/pt-br/']] as const) {
  test(`${locale} Home preview title fills and reverses across supported viewports`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('home-entrance-00-played', '1'));

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
      { width: 390, height: 844 },
      { width: 320, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(route);
      const heading = page.locator('#work-title');
      await expect(heading).toHaveAttribute('data-scroll-fill-ready', 'true');
      await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        scrollTo(0, 0);
      });
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      const setHeadingTop = async (viewportRatio: number) => heading.evaluate((element, ratio) => {
        document.documentElement.style.scrollBehavior = 'auto';
        const target = scrollY + element.getBoundingClientRect().top - innerHeight * ratio;
        scrollTo(0, target);
      }, viewportRatio);
      const allWordsFilled = () => heading.locator('.scroll-fill-word').evaluateAll(words =>
        words.length > 0 && words.every(word => (word as HTMLElement).dataset.filled === 'true'),
      );
      const finishPosition = .46 - 2 / viewport.height;

      await setHeadingTop(.86);
      await expect.poll(allWordsFilled).toBe(false);
      await setHeadingTop(finishPosition);
      await expect.poll(allWordsFilled).toBe(true);
      await setHeadingTop(.86);
      await expect.poll(allWordsFilled).toBe(false);
    }
  });
}

test('first visit can skip the opening and a return does not start it again', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('body')).toHaveAttribute('data-home-opening-playing', 'true', { timeout: 25_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-home-opening-complete', 'true');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('home-entrance-00-played'))).toBe('1');
  await expect(page.locator('body')).not.toHaveAttribute('data-home-opening-active', 'true');

  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-home-scene-ready', 'true', { timeout: 25_000 });
  await expect(page.locator('body')).not.toHaveAttribute('data-home-opening-playing', 'true');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('home-entrance-00-played'))).toBe('1');
});

test('mobile reduced motion keeps static Home content and navigation available', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto('/pt-br/');

  await expect(page.locator('#scene-frame')).toHaveAttribute('data-scene-state', 'poster');
  await expect(page.locator('#scene-canvas')).toBeHidden();
  await expect(page.locator('#hero-poster-image')).toBeVisible();
  await expect(page.locator('main h1')).toContainText(/Da\s*ideia\s*à\s*forma\./);
  await expect(page.locator('.hero-actions a')).toHaveCount(2);
  await expect(page.locator('.mobile-menu summary')).toBeVisible();
  await page.locator('.mobile-menu summary').click();
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await expect(page.locator('.mobile-nav a')).toHaveText(['Início', 'Sobre', 'Laboratórios', 'Projetos', 'Contato']);
  await context.close();
});
