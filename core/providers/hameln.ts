import type { ProviderDefinition } from './index';

export const hameln: ProviderDefinition = {
  id: 'hameln',
  name: 'ハーメルン',
  language: 'jp',
  matchUrl(url) {
    return /^https:\/\/syosetu\.org\/novel\/\d+\/\d+(\.html)+$/.test(url);
  },
  parseUrl(url) {
    const m = url.match(/^https:\/\/syosetu\.org\/novel\/(\d+)\/(\d+)(\.html)+$/);
    if (!m) return null;
    return { providerId: 'hameln', novelId: m[1]!, chapterId: m[2]! };
  },
  selectors: {
    chapterTitle: 'title',
    chapterBody: '#honbun',
    nextChapter: 'a.next_page_link',
  },
};
