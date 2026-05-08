import type { ProviderDefinition } from './index';

export const syosetu: ProviderDefinition = {
  id: 'syosetu',
  name: '小説家になろう',
  language: 'jp',
  matchUrl(url) {
    return /^https:\/\/ncode\.syosetu\.com\/n[a-z0-9]+\/?(\d+\/?)?$/.test(url);
  },
  parseUrl(url) {
    const m = url.match(/^https:\/\/ncode\.syosetu\.com\/n([a-z0-9]+)\/(\d+)\/?$/);
    if (!m) return null;
    return { providerId: 'syosetu', novelId: m[1]!, chapterId: m[2]! };
  },
  selectors: {
    chapterTitle: '.p-novel__title',
    chapterBody: '.p-novel__body',
    nextChapter: 'a.c-pager__item.c-pager__item--next',
  },
  className: 'js-novel-text p-novel__text',
  style: {
    lineHeight: '180%',
    fontSize: '100%',
  },
};
