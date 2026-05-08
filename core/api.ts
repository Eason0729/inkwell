export type Language = 'jp' | 'zh-cn' | 'zh-tw' | 'en' | 'kr';

export interface KeywordEntry {
  src: string;
  dst: string;
  info: string;
  count: number;
}

export interface TranslationRequest {
  type: 'TRANSLATE_CHAPTER';
  providerId: string;
  novelId: string;
  chapterId: string;
  chapterIndex: number;
  url: string;
  title: string;
  body: string;
  sourceLanguage: Language;
  preemptiveNextUrl?: string;
  preemptiveNextTitle?: string;
  forceRetranslate?: boolean;
}

export interface KeywordExtractRequest {
  type: 'EXTRACT_KEYWORDS';
  providerId: string;
  novelId: string;
  chapterId: string;
  body: string;
  sourceLanguage: Language;
}

export interface TranslationResponse {
  type: 'CHAPTER_TRANSLATED' | 'KEYWORDS_EXTRACTED' | 'ERROR';
  providerId?: string;
  novelId?: string;
  chapterId?: string;
  translatedContent?: string;
  keywords?: KeywordEntry[];
  error?: string;
}
