import type { ProviderDefinition } from './index';

export const kakuyomu: ProviderDefinition = {
  id: 'kakuyomu',
  name: 'カクヨム',
  language: 'jp',
  matchUrl(url) {
    return /^https:\/\/kakuyomu\.jp\/works\/\d+\/episodes\/\d+$/.test(url);
  },
  parseUrl(url) {
    const m = url.match(/^https:\/\/kakuyomu\.jp\/works\/(\d+)\/episodes\/(\d+)$/);
    if (!m) return null;
    return { providerId: 'kakuyomu', novelId: m[1]!, chapterId: m[2]! };
  },
  selectors: {
    chapterTitle: '.widget-episodeTitle',
    chapterBody: '.widget-episodeBody',
    nextChapter: 'link[rel="next"]',
  },
};
