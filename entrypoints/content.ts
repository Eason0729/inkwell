import browser from 'webextension-polyfill';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { TranslationRequest, TranslationResponse, Language } from '../core/api';
import { getProviderByUrl } from '../core/providers/index';
import { loadConfig } from '../core/config';
import {
  extractChapterFromDom,
  findNextChapterUrl,
  replaceBodyWithTranslation,
  insertLanguageToggle,
} from '../core/dom';
import { fetchNextChapterContent } from '../core/fetch';

let currentProvider: ReturnType<typeof getProviderByUrl> = undefined;
let originalBody = '';
let translatedBody = '';
let currentLang: 'original' | 'translated' = 'original';
let currentParsed: { providerId: string; novelId: string; chapterId: string } | null = null;
let currentChapterIndex = 0;
let currentUrl = '';
let currentTitle = '';
let currentSourceLanguage: Language = 'jp';
let isRetranslating = false;

function toggleLanguage(): void {
  if (currentLang === 'original') {
    if (translatedBody && currentProvider) {
      replaceBodyWithTranslation(currentProvider, translatedBody);
      currentLang = 'translated';
    }
  } else {
    if (originalBody && currentProvider) {
      replaceBodyWithTranslation(currentProvider, originalBody);
      currentLang = 'original';
    }
  }
  insertLanguageToggle(currentLang, toggleLanguage, handleRetranslate);
}

async function handleRetranslate(): Promise<void> {
  if (isRetranslating || !currentProvider || !currentParsed || !originalBody) return;
  isRetranslating = true;
  try {
    replaceBodyWithTranslation(currentProvider, originalBody);
    currentLang = 'original';

    const response = await requestTranslation(
      currentParsed.providerId,
      currentParsed.novelId,
      currentParsed.chapterId,
      currentChapterIndex,
      currentUrl,
      currentTitle,
      originalBody,
      currentSourceLanguage,
      undefined,
      true,
    );

    if (response.type === 'CHAPTER_TRANSLATED' && response.translatedContent) {
      translatedBody = response.translatedContent;
      replaceBodyWithTranslation(currentProvider, translatedBody);
      currentLang = 'translated';
    }
  } finally {
    isRetranslating = false;
    insertLanguageToggle(currentLang, toggleLanguage, handleRetranslate);
  }
}

async function requestTranslation(
  providerId: string,
  novelId: string,
  chapterId: string,
  chapterIndex: number,
  url: string,
  title: string,
  body: string,
  sourceLanguage: Language,
  preemptiveNextUrl?: string,
  forceRetranslate?: boolean,
): Promise<TranslationResponse> {
  const resp = await browser.runtime.sendMessage({
    type: 'TRANSLATE_CHAPTER',
    providerId,
    novelId,
    chapterId,
    chapterIndex,
    url,
    title,
    body,
    sourceLanguage,
    ...(preemptiveNextUrl ? { preemptiveNextUrl } : {}),
    ...(forceRetranslate ? { forceRetranslate } : {}),
  } satisfies TranslationRequest);
  return resp as TranslationResponse;
}

export default defineContentScript({
  matches: [
    'https://ncode.syosetu.com/*',
    'https://novel18.syosetu.com/*',
    'https://kakuyomu.jp/*',
    'https://www.alphapolis.co.jp/*',
    'https://syosetu.org/*',
    'https://www.pixiv.net/*',
  ],
  async main() {
    console.log('[Inkwell] Content script loaded for:', window.location.href);
    try {
      const provider = getProviderByUrl(window.location.href);
      console.log('[Inkwell] Provider:', provider?.id);
      if (!provider) return;

      currentProvider = provider;

      const config = await loadConfig();
      console.log(
        '[Inkwell] Config loaded, autoTranslate:',
        config.autoTranslate,
        'enablePreemptive:',
        config.enablePreemptive,
      );
      if (!config.autoTranslate) return;

      const extracted = extractChapterFromDom(provider);
      console.log('[Inkwell] Extract result:', extracted ? 'found, body length: ' + extracted.body.length : 'null');
      if (!extracted || !extracted.body) return;

      originalBody = extracted.body;

      const parsed = provider.parseUrl(window.location.href);
      console.log('[Inkwell] Parsed URL:', parsed);
      if (!parsed) return;

      const chapterIndex = parseInt(parsed.chapterId, 10);
      currentParsed = parsed;
      currentChapterIndex = chapterIndex;
      currentUrl = window.location.href;
      currentTitle = extracted.title;
      currentSourceLanguage = provider.language;

      const response = await requestTranslation(
        parsed.providerId,
        parsed.novelId,
        parsed.chapterId,
        chapterIndex,
        window.location.href,
        extracted.title,
        originalBody,
        provider.language,
      );
      console.log('[Inkwell] Response type:', response.type);

      if (response.type === 'CHAPTER_TRANSLATED' && response.translatedContent) {
        translatedBody = response.translatedContent;
        replaceBodyWithTranslation(provider, translatedBody);
        currentLang = 'translated';
        insertLanguageToggle(currentLang, toggleLanguage, handleRetranslate);
        console.log('[Inkwell] Translation displayed');
      }

      if (config.enablePreemptive && provider) {
        const nextUrl = findNextChapterUrl(provider);
        console.log('[Inkwell] Next URL:', nextUrl);
        if (nextUrl) {
          const nextParsed = provider.parseUrl(nextUrl);
          console.log('[Inkwell] Next parsed:', nextParsed);
          if (nextParsed) {
            console.log('[Inkwell] Fetching next chapter:', nextUrl);
            const nextContent = await fetchNextChapterContent(nextUrl, provider);
            if (nextContent) {
              console.log('[Inkwell] Request sent to background:', nextUrl);
              requestTranslation(
                nextParsed.providerId,
                nextParsed.novelId,
                nextParsed.chapterId,
                chapterIndex + 1,
                nextUrl,
                nextContent.title,
                nextContent.body,
                provider.language,
                nextUrl,
              );
            } else {
              console.warn('[Inkwell] Failed to fetch next chapter content for preemptive translation:', nextUrl);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Inkwell] Unhandled error in content script:', err, 'url:', window.location.href);
    }
  },
});
