import type { TranslationRequest, TranslationResponse, Language } from './api';
import type { AppConfig } from './config';
import { loadConfig } from './config';
import { translateChapter } from './translate/pipeline';
import { extractKeywordsFromBody } from './translate/glossary';
import { getStrings } from './translate/strings';
import {
  upsertNovel,
  getNovel,
  upsertChapter,
  getKeywords,
  mergeKeywords,
  getCache,
  setCache,
  deleteCache,
  deleteChapter,
} from './db/dexie';

let currentConfig: AppConfig | null = null;

async function getConfig(): Promise<AppConfig> {
  if (!currentConfig) {
    currentConfig = await loadConfig();
  }
  return currentConfig;
}

function dedupKey(providerId: string, novelId: string, chapterId: string): string {
  return `${providerId}::${novelId}::${chapterId}`;
}

const inflightTranslations = new Map<string, Promise<TranslationResponse>>();

async function handleTranslateChapter(req: TranslationRequest): Promise<TranslationResponse> {
  const baseKey = dedupKey(req.providerId, req.novelId, req.chapterId);
  const dedupK = req.forceRetranslate ? `force::${baseKey}` : baseKey;
  const existing = inflightTranslations.get(dedupK);
  if (existing) return existing;

  const promise = doTranslateChapter(req, baseKey);
  inflightTranslations.set(dedupK, promise);
  promise.finally(() => inflightTranslations.delete(dedupK));
  return promise;
}

async function doTranslateChapter(req: TranslationRequest, cacheKey: string): Promise<TranslationResponse> {
  const { providerId, novelId, chapterId } = req;
  try {
    const config = await getConfig();
    const { chapterIndex, url, title, body, sourceLanguage } = req;

    let novel = await getNovel(providerId, novelId);
    if (!novel) {
      const novelTitle = title ? title.replace(/[第\d\s話話].*$/, '').trim() : 'Unknown';
      novel = { providerId, novelId, url: url, title: novelTitle, author: '' };
      await upsertNovel(novel);
    }

    if (req.forceRetranslate) {
      console.log('[Inkwell] Force retranslate, clearing existing data');
      await deleteCache(cacheKey);
      await deleteChapter(providerId, novelId, chapterId);
    }

    const cached = await getCache(cacheKey);
    if (cached) {
      console.log('[Inkwell] Cache hit:', cacheKey);
      await upsertChapter({
        providerId,
        novelId,
        chapterId,
        chapterIndex,
        url,
        title,
        contentHash: cacheKey,
        originalContent: body,
        translatedContent: cached.translatedContent,
      });
      return {
        type: 'CHAPTER_TRANSLATED',
        providerId,
        novelId,
        chapterId,
        translatedContent: cached.translatedContent,
      };
    }

    console.log('[Inkwell] Cache miss:', cacheKey);
    const targetLang: Language = config.targetLanguage;
    const strings = getStrings(targetLang);

    let keywords = await getKeywords(providerId, novelId);
    if (keywords.length === 0) {
      const extracted = await extractKeywordsFromBody(body, sourceLanguage, config, strings, targetLang);
      await mergeKeywords(providerId, novelId, extracted);
      keywords = await getKeywords(providerId, novelId);
    }

    const translated = await translateChapter(body, sourceLanguage, targetLang, keywords, config);

    await upsertChapter({
      providerId,
      novelId,
      chapterId,
      chapterIndex,
      url,
      title,
      contentHash: cacheKey,
      originalContent: body,
      translatedContent: translated,
    });

    await setCache({
      hash: cacheKey,
      translatedContent: translated,
      model: config.model,
      timestamp: Date.now(),
    });

    return { type: 'CHAPTER_TRANSLATED', providerId, novelId, chapterId, translatedContent: translated };
  } catch (err) {
    console.error('[Inkwell] Translation failed:', err);
    return { type: 'ERROR', providerId, novelId, chapterId, error: String(err) };
  }
}

export async function handleMessage(message: unknown): Promise<TranslationResponse | undefined> {
  const msg = message as { type: string } & Record<string, unknown>;
  if (msg.type === 'TRANSLATE_CHAPTER') {
    return await handleTranslateChapter(msg as unknown as TranslationRequest);
  }
  return undefined;
}
