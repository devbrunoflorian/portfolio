import type { Locale } from './site';

interface ArtCopy {
  firstLine: string;
  secondLine: string;
  accent: string;
  description: string;
  portraitAlt: string;
  gameTitle: string;
  gameStatus: string;
  gameNote: string;
  play: string;
}

export const aboutArt: Record<Locale, ArtCopy> = {
  'pt-br': {
    firstLine: 'Entre o que vemos e sentimos,', secondLine: 'a arte encontra', accent: 'inspiração',
    description: 'Um encontro sensível entre forma, emoção e expressão visual.',
    portraitAlt: 'Vitória em uma composição de aquarela violeta e azul',
    gameTitle: 'Floresta Antiga', gameStatus: 'Em breve',
    gameNote: 'Um mundo em construção. O jogo ainda não está disponível.', play: 'Jogar',
  },
  en: {
    firstLine: 'Between what we see and feel,', secondLine: 'art finds', accent: 'inspiration',
    description: 'A meeting of form, emotion, and visual expression.',
    portraitAlt: 'Vitória in a violet and blue watercolor composition',
    gameTitle: 'The Ancient Forest', gameStatus: 'Coming soon',
    gameNote: 'A world in the making. The game is not available yet.', play: 'Play',
  },
};
