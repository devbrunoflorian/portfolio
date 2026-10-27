const preferenceKey = "portfolio.preferredLocale";
const supportedLocales = new Set(["pt-br", "en"]);

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-locale-choice]");
  if (!link || !supportedLocales.has(link.dataset.localeChoice)) return;

  try {
    localStorage.setItem(preferenceKey, link.dataset.localeChoice);
  } catch {
    // The links still navigate when browser storage is unavailable.
  }
});

if (document.documentElement.hasAttribute("data-locale-entry")) {
  let locale = "";

  try {
    const savedLocale = localStorage.getItem(preferenceKey);
    if (supportedLocales.has(savedLocale)) locale = savedLocale;
  } catch {
    // Continue with the browser language or the static PT-BR fallback.
  }

  if (!locale) {
    const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
    const preferredLanguage = browserLanguages.find((language) => /^(pt|en)(-|$)/i.test(language));
    locale = preferredLanguage?.toLowerCase().startsWith("en") ? "en" : "pt-br";
  }

  window.location.replace(`/${locale}/`);
}
