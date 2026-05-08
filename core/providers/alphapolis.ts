import type { ProviderDefinition } from './index';

export const alphapolis: ProviderDefinition = {
  id: 'alphapolis',
  name: 'アルファポリス',
  language: 'jp',
  matchUrl(url) {
    return /^https:\/\/www\.alphapolis\.co\.jp\/novel\/\d+\/\d+$/.test(url);
  },
  parseUrl(url) {
    const m = url.match(/^https:\/\/www\.alphapolis\.co\.jp\/novel\/(\d+)\/(\d+)$/);
    if (!m) return null;
    return { providerId: 'alphapolis', novelId: m[1]!, chapterId: m[2]! };
  },
  selectors: {
    chapterTitle: 'h1.title',
    chapterBody: 'div.text#novelBody',
    nextChapter: 'link[rel="next"]',
  },
};
