import type { Language, KeywordEntry } from '../api';
import type { AppConfig } from '../config';
import { chunkText } from './chunking';
import { annotateKeywords, stripAnnotations } from './glossary';
import { getPrompt } from './prompts';
import { englishRatio, japaneseRatio, checkLanguage, checkStructure, checkRefusal, type RuleResult } from './rules';
import { callLlm, languageName } from './api';
import { getStrings } from './strings';
import { TRANSLATION } from './constants';
import { postProcessResponse } from './postprocess';

async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

const LANGUAGE_NAMES_IN_TARGET: Partial<Record<Language, Record<Language, string>>> = {
  jp: {
    jp: '日本語',
    'zh-cn': '中国語（簡体字）',
    'zh-tw': '中国語（繁体字）',
    en: '英語',
    kr: '韓国語',
  },
  'zh-cn': {
    jp: '日文',
    'zh-cn': '中文',
    'zh-tw': '繁体中文',
    en: '英文',
    kr: '韩文',
  },
  'zh-tw': {
    jp: '日文',
    'zh-cn': '简体中文',
    'zh-tw': '中文',
    en: '英文',
    kr: '韩文',
  },
  kr: {
    jp: '일본어',
    'zh-cn': '중국어(간체)',
    'zh-tw': '중국어(번체)',
    en: '영어',
    kr: '한국어',
  },
};

const USER_PROMPT_PREFIX_TEMPLATES: Partial<Record<Language, string>> = {
  'zh-cn': '将下面的{source}文本翻译成{target}：\n',
  'zh-tw': '將下面的{source}文本翻譯成{target}：\n',
};

function buildUserPromptPrefix(sourceLang: Language, targetLang: Language): string {
  const template = USER_PROMPT_PREFIX_TEMPLATES[targetLang] ?? '';
  const names = LANGUAGE_NAMES_IN_TARGET[targetLang];
  const sourceName = names?.[sourceLang] ?? sourceLang;
  const targetName = names?.[targetLang] ?? targetLang;
  return template.replace('{source}', sourceName).replace('{target}', targetName);
}

export async function translateChunk(
  rawSourceText: string,
  sourceLang: Language,
  targetLang: Language,
  config: AppConfig,
  keywords: KeywordEntry[],
): Promise<string> {
  const strings = getStrings(targetLang);

  const sourceText = postProcessResponse(rawSourceText, rawSourceText);

  const systemPrompt = getPrompt(targetLang, 'translate', {
    source_lang: languageName(sourceLang),
    target_lang: languageName(targetLang),
    target_lang_code: targetLang,
    source_lang_code: sourceLang,
  });

  const userPromptPrefix = buildUserPromptPrefix(sourceLang, targetLang);
  const annotatedSource = annotateKeywords(sourceText, keywords);

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPromptPrefix + annotatedSource },
  ];

  const ruleBudget = { ...TRANSLATION.ruleRetryLimits };
  let lastResponse = '';

  for (let attempt = 0; attempt < TRANSLATION.maxRetries; attempt++) {
    let response = await callLlm(messages, config, strings);
    if (!response) {
      console.warn(`[Inkwell] Chunk attempt ${attempt + 1}: API returned null, retrying...`);
      continue;
    }

    // ── Phase 1: Local post-processing (no API calls) ──
    response = postProcessResponse(response, sourceText);
    lastResponse = response;

    const engRatio = englishRatio(response);
    const jpRatio = japaneseRatio(response);

    // ── Phase 2: Quality rules (may trigger retry) ──
    let rejectReason = '';
    let correction = '';
    let ruleName = '';

    const r = response;

    const rules: Array<{ name: string; check: () => RuleResult }> = [
      { name: 'language', check: () => checkLanguage(r, strings) },
      { name: 'refusal', check: () => checkRefusal(r, strings) },
      { name: 'structure', check: () => checkStructure(sourceText, r, strings) },
    ];

    let anyFailed = false;
    for (const rule of rules) {
      const result = rule.check();
      if (!result.ok && (ruleBudget[rule.name] ?? 1) > 0) {
        rejectReason = result.detail;
        correction = result.correction;
        if (result.responseForRetry !== undefined) {
          response = result.responseForRetry;
        }
        ruleName = rule.name;
        anyFailed = true;
        break;
      }
    }

    if (anyFailed && attempt < TRANSLATION.maxRetries - 1) {
      ruleBudget[ruleName] = (ruleBudget[ruleName] ?? 1) - 1;
      console.log(
        `[Inkwell] Reject attempt ${attempt + 1}: ${rejectReason} | eng=${engRatio.toFixed(3)} jp=${jpRatio.toFixed(3)}`,
      );
      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: correction });
      continue;
    }

    return stripAnnotations(response, keywords);
  }

  return stripAnnotations(lastResponse, keywords);
}

export async function translateChapter(
  body: string,
  sourceLanguage: Language,
  targetLanguage: Language,
  keywords: KeywordEntry[],
  config: AppConfig,
  onProgress?: (index: number, total: number) => void,
): Promise<string> {
  const chunks = chunkText(body, config.chunkSize, 0);

  let completed = 0;
  const chunkTimes: number[] = [];
  const results = await mapConcurrent(
    chunks,
    (chunk) => {
      const t0 = performance.now();
      return translateChunk(chunk.text, sourceLanguage, targetLanguage, config, keywords).then((r) => {
        const elapsed = performance.now() - t0;
        chunkTimes.push(elapsed);
        completed++;
        onProgress?.(completed, chunks.length);
        console.log(`[Inkwell] Chunk ${completed}/${chunks.length} took ${(elapsed / 1000).toFixed(1)}s`);
        return r;
      });
    },
    config.parallelism,
  );

  const maxTime = chunkTimes.length ? (Math.max(...chunkTimes) / 1000).toFixed(1) : '0';
  console.log(`[Inkwell] Longest chunk took ${maxTime}s (parallelism=${config.parallelism})`);

  return results.join('\n\n');
}
