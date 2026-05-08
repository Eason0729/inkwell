import Dexie, { type Table } from 'dexie';
import type { ChapterRecord, CacheRecord, NovelRecord } from './types';
import type { KeywordEntry } from '../api';

export class InkwellDB extends Dexie {
  novels!: Table<NovelRecord, string>;
  chapters!: Table<ChapterRecord, string>;
  keywords!: Table<KeywordEntry & { novelKey: string }, number>;
  cache!: Table<CacheRecord, string>;

  constructor() {
    super('InkwellDB');
    this.version(3).stores({
      novels: '&[providerId+novelId], url, title',
      chapters: '&[providerId+novelId+chapterId], url, novelId, chapterIndex, [providerId+novelId]',
      keywords: '++id, novelKey, src',
      cache: '&hash, model, timestamp',
    });
  }
}

function makeKey(providerId: string, novelId: string, chapterId: string): string {
  return `${providerId}::${novelId}::${chapterId}`;
}

function novelKey(providerId: string, novelId: string): string {
  return `${providerId}::${novelId}`;
}

let _db: InkwellDB | null = null;

export function getDb(): InkwellDB {
  if (!_db) {
    _db = new InkwellDB();
  }
  return _db;
}

export async function upsertNovel(novel: NovelRecord): Promise<void> {
  await getDb().novels.put(novel);
}

export async function getNovel(providerId: string, novelId: string): Promise<NovelRecord | undefined> {
  return getDb().novels.get([providerId, novelId]);
}

export async function upsertChapter(chapter: ChapterRecord): Promise<void> {
  await getDb().chapters.put(chapter);
}

export async function getChapter(
  providerId: string,
  novelId: string,
  chapterId: string,
): Promise<ChapterRecord | undefined> {
  return getDb().chapters.get([providerId, novelId, chapterId]);
}

export async function getNovelChapters(providerId: string, novelId: string): Promise<ChapterRecord[]> {
  return getDb().chapters.where('[providerId+novelId]').equals([providerId, novelId]).toArray();
}

export async function getKeywords(providerId: string, novelId: string): Promise<KeywordEntry[]> {
  const nk = novelKey(providerId, novelId);
  return getDb().keywords.where({ novelKey: nk }).toArray();
}

export async function mergeKeywords(providerId: string, novelId: string, entries: KeywordEntry[]): Promise<void> {
  const nk = novelKey(providerId, novelId);
  const existing = await getDb().keywords.where({ novelKey: nk }).toArray();
  const existingMap = new Map<string, KeywordEntry>();
  for (const e of existing) {
    existingMap.set(e.src, e);
  }
  for (const entry of entries) {
    const found = existingMap.get(entry.src);
    if (found) {
      existingMap.set(entry.src, {
        ...found,
        dst: entry.dst || found.dst,
        info: entry.info || found.info,
        count: (found.count || 0) + 1,
      });
    } else {
      existingMap.set(entry.src, { ...entry, count: 1 });
    }
  }
  await getDb().keywords.where({ novelKey: nk }).delete();
  for (const entry of existingMap.values()) {
    await getDb().keywords.add({ ...entry, novelKey: nk });
  }
}

export async function getCache(dedupKey: string): Promise<CacheRecord | undefined> {
  return getDb().cache.get(dedupKey);
}

export async function setCache(record: CacheRecord): Promise<void> {
  await getDb().cache.put(record);
}

export async function deleteCache(hash: string): Promise<void> {
  await getDb().cache.delete(hash);
}

export async function deleteChapter(providerId: string, novelId: string, chapterId: string): Promise<void> {
  await getDb().chapters.delete(makeKey(providerId, novelId, chapterId));
}

export async function getAllNovels(): Promise<NovelRecord[]> {
  return getDb().novels.toArray();
}
