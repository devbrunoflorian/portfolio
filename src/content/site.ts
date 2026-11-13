export const locales = ['pt-br', 'en'] as const;
export type Locale = typeof locales[number];
export type PageId = 'home' | 'about' | 'labs' | 'projects' | 'contact';

export const routes: Record<Locale, Record<PageId, string>> = {
  'pt-br': { home: '/pt-br/', about: '/pt-br/sobre/', labs: '/pt-br/laboratorios/', projects: '/pt-br/projetos/', contact: '/pt-br/contato/' },
  en: { home: '/en/', about: '/en/about/', labs: '/en/labs/', projects: '/en/projects/', contact: '/en/contact/' },
};

export const siteCopy = {
  'pt-br': { lang: 'pt-BR', home: 'início', skip: 'Pular para o conteúdo', navigation: 'Navegação principal', language: 'Idioma', profiles: 'Perfis externos', labels: ['Início', 'Sobre', 'Laboratórios', 'Projetos', 'Contato'] },
  en: { lang: 'en', home: 'home', skip: 'Skip to content', navigation: 'Primary navigation', language: 'Language', profiles: 'External profiles', labels: ['Home', 'About', 'Labs', 'Projects', 'Contact'] },
} as const;

export const navigation: PageId[] = ['home', 'about', 'labs', 'projects', 'contact'];
