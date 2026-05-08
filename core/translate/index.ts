import type { Language, KeywordEntry } from '../api';
import type { AppConfig } from '../config';
import { chunkText } from './chunking';
import { renderTemplate, type TemplateVars } from './template';
import { annotateKeywords, stripAnnotations, buildKeywordInjectionBlock } from './keyword';
import { getPrompt } from './prompts';
import {
  englishRatio,
  japaneseRatio,
  checkEnglishRatio,
  checkJapaneseRatio,
  checkStructure,
  checkLongLine,
  checkRefusal,
  type StructureResult,
} from './validation';
import { stripViolationAnnotations } from './structure-scorer';
import { normalizeBodyText } from '../dom';
import { callLlm, languageName } from './llm';

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
  'zh-cn': '将下面的{source}文本翻译成{target}：\n\n',
  'zh-tw': '將下面的{source}文本翻譯成{target}：\n\n',
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
  // Normalize \u3000-only lines to empty to reduce tokens
  const sourceText = normalizeBodyText(rawSourceText);

  const glossaryBlock = buildKeywordInjectionBlock(keywords);

  const vars: TemplateVars = {
    source_lang: languageName(sourceLang),
    target_lang: languageName(targetLang),
    target_lang_code: targetLang,
    source_lang_code: sourceLang,
    glossary: glossaryBlock,
  };
  const prompt = getPrompt(targetLang, 'translate');
  const systemPrompt = renderTemplate(prompt, vars);

  const userPromptPrefix = buildUserPromptPrefix(sourceLang, targetLang);
  const annotatedSource = annotateKeywords(sourceText, keywords);

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPromptPrefix + annotatedSource },
  ];

  const ruleBudget = { ...config.ruleRetryLimits };
  let lastResponse = '';

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    let response = await callLlm(messages, config);
    if (!response) {
      console.warn(`[Inkwell] Chunk attempt ${attempt + 1}: API returned null (see LLM error above), retrying...`);
      continue;
    }
    // Normalize \u3000-only lines immediately so retries don't re-send wasted tokens
    response = normalizeBodyText(response);
    lastResponse = response;

    const engRatio = englishRatio(response);
    const jpRatio = japaneseRatio(response);
    let rejectReason = '';
    let correction = '';
    let ruleName = '';

    const r = response; // const alias for null-narrowing in closures
    const rules: Array<{
      name: string;
      check: () => { ok: boolean; detail: string; correction?: string };
      correctionOverride?: string;
    }> = [
      { name: 'japanese', check: () => checkJapaneseRatio(r, config.maxJapaneseRatio) },
      { name: 'english', check: () => checkEnglishRatio(r, config.maxEnglishRatio) },
      { name: 'refusal', check: () => checkRefusal(r), correctionOverride: '請以翻譯為目的重新進行。' },
      {
        name: 'longline',
        check: () => checkLongLine(sourceText, r),
        correctionOverride:
          '回應中有過長的段落，請在長段落中適當換行。\n回應中有過長的段落，請在長段落中適當換行。\n回應中有過長的段落，請在長段落中適當換行。',
      },
      {
        name: 'structure',
        check: () => checkStructure(sourceText, r),
      },
    ];

    for (const rule of rules) {
      const result = rule.check();
      // Apply structure auto-fix (insert empty lines, restore \u3000 indent) when all violations are fixable
      if (rule.name === 'structure') {
        const sr = result as StructureResult;
        response = sr.autoFixedText;
      }
      if (!result.ok && (ruleBudget[rule.name] ?? 1) > 0) {
        rejectReason = result.detail;
        correction = rule.correctionOverride ?? result.correction ?? '';
        ruleName = rule.name;
        // For structure: use annotated response for retry so LLM sees violation markers
        if (ruleName === 'structure') {
          response = (result as StructureResult).annotatedResponse;
        }
        break;
      }
    }

    if (rejectReason && attempt < config.maxRetries - 1) {
      ruleBudget[ruleName] = (ruleBudget[ruleName] ?? 1) - 1;
      console.log(
        `[Inkwell] Reject attempt ${attempt + 1}: ${rejectReason} | eng=${engRatio.toFixed(3)} jp=${jpRatio.toFixed(3)}`,
      );
      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: correction });
      continue;
    }

    return stripAnnotations(stripViolationAnnotations(response), keywords);
  }

  return stripAnnotations(stripViolationAnnotations(lastResponse), keywords);
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
