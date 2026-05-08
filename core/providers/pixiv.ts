import type { ProviderDefinition } from './index';

export const pixiv: ProviderDefinition = {
  id: 'pixiv',
  name: 'Pixiv',
  language: 'jp',
  matchUrl(url) {
    return /^https:\/\/www\.pixiv\.net\/novel\/show\/\d+$/.test(url);
  },
  parseUrl(url) {
    const m = url.match(/^https:\/\/www\.pixiv\.net\/novel\/show\/(\d+)$/);
    if (!m) return null;
    return { providerId: 'pixiv', novelId: m[1]!, chapterId: '1' };
  },
  selectors: {
    chapterTitle: 'h1',
    chapterBody: '.novel_view',
    nextChapter: 'link[rel="next"]',
  },
};
