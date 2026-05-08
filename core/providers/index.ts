import type { Language } from '../api';

export interface ProviderDefinition {
  id: string;
  name: string;
  language: Language;
  matchUrl(url: string): boolean;
  parseUrl(url: string): { providerId: string; novelId: string; chapterId: string } | null;
  selectors: {
    chapterTitle: string;
    chapterBody: string;
    nextChapter?: string;
  };
  className?: string;
  style?: {
    lineHeight?: string;
    fontSize?: string;
    lineGap?: string;
  };
}

import { syosetu } from './syosetu';
import { syosetu18 } from './syosetu18';
import { kakuyomu } from './kakuyomu';
import { alphapolis } from './alphapolis';
import { hameln } from './hameln';
import { pixiv } from './pixiv';

const providers: ProviderDefinition[] = [syosetu, syosetu18, kakuyomu, alphapolis, hameln, pixiv];

export function getProviderByUrl(url: string): ProviderDefinition | undefined {
  return providers.find((p) => p.matchUrl(url));
}

export function getProviderById(id: string): ProviderDefinition | undefined {
  return providers.find((p) => p.id === id);
}

export function getAllProviders(): ProviderDefinition[] {
  return providers;
}
