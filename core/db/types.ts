export interface ChapterRecord {
  providerId: string;
  novelId: string;
  chapterId: string;
  chapterIndex: number;
  url: string;
  title: string;
  contentHash: string;
  originalContent: string;
  translatedContent: string;
}

export interface CacheRecord {
  hash: string;
  translatedContent: string;
  model: string;
  timestamp: number;
}

export interface NovelRecord {
  providerId: string;
  novelId: string;
  url: string;
  title: string;
  author: string;
}

export interface KeywordRecord {
  id?: number;
  novelKey: string;
  src: string;
  dst: string;
  info: string;
  count: number;
}
