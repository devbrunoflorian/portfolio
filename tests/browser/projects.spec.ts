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
