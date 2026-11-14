import { test, expect } from '@playwright/test';

for (const [locale, route, title, heading, nav, otherRoute] of [
  ['en', '/en/projects/', 'Projects | Bruno Florian', /Selected\s*work\./, ['Home', 'About', 'Labs', 'Projects', 'Contact'], '/pt-br/projetos/'],
  ['pt-BR', '/pt-br/projetos/', 'Projetos | Bruno Florian', /Projetos\s*selecionados\./, ['Início', 'Sobre', 'Laboratórios', 'Projetos', 'Contato'], '/en/projects/'],
] as const) {
  test(`${locale}: Projects route renders in Astro with direct localized navigation`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('main h1')).toContainText(heading);
    await expect(page.locator('.desktop-nav a')).toHaveText(nav);
    await page.locator(`.locale-nav a[href="${otherRoute}"]`).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(otherRoute);
    await context.close();
  });
}

test('fixed Projects title stays readable and existing controls use shared feedback timing', async ({ page }) => {
  await page.goto('/en/projects/');
  const heading = page.locator('#projects-title');
  await expect(heading).toHaveAttribute('data-scroll-fill-ready', 'true');
  await expect(heading).toHaveAttribute('data-scroll-fill-mode', 'static');
  await expect.poll(() => heading.locator('.scroll-fill-word').evaluateAll(words =>
    words.length > 0 && words.every(word => (word as HTMLElement).dataset.filled === 'true'),
  )).toBe(true);

  const feedback = await page.locator('.project-position button').first().evaluate(element => ({
    token: getComputedStyle(document.documentElement).getPropertyValue('--motion-feedback-duration').trim(),
    control: getComputedStyle(element).transitionDuration.split(',').map(duration => duration.trim()),
    primaryLink: getComputedStyle(document.querySelector('.project-primary-link')!).transitionDuration.split(',').map(duration => duration.trim()),
  }));
  expect(feedback.token).toBe('160ms');
  expect(feedback.control.length).toBeGreaterThan(0);
  expect(feedback.primaryLink.length).toBeGreaterThan(0);
  expect([...feedback.control, ...feedback.primaryLink].every(duration => duration === '0.16s')).toBe(true);
  await expect(page.locator('.project-intro h1')).toBeVisible();
  await expect(page.locator('.project-primary-link')).toBeVisible();
});
