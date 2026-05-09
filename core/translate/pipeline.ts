import type { Language, KeywordEntry } from '../api';
import type { AppConfig } from '../config';
import { chunkText } from './chunking';
import { annotateKeywords, stripAnnotations } from './glossary';
import { getPrompt } from './prompts';
import { englishRatio, japaneseRatio, checkLanguage, checkStructure, checkRefusal, type RuleResult } from './rules';
import { stripViolationAnnotations, scoreStructure } from './structure';
import { normalizeBodyText } from '../dom';
import { callLlm, languageName } from './api';
import { getStrings } from './strings';
import { TRANSLATION } from './constants';

/**
 * Run an array of async tasks with bounded concurrency, preserving input order
 * in the output array. Each worker pulls the next item when idle.
 */
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

// User prompt prefix — single newline after instruction colon (not double).
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

/**
 * Translate a single chunk of text through the retry pipeline.
 *
 * Pipeline lifecycle:
 * 1. Build initial messages: [system(prompt template), user(prefix + annotated source)]
 * 2. Send to LLM via callLlm()
 * 3. Clean the response: normalize whitespace-only lines, strip <thinking>/<reasoning> tags,
 *    remove first-line artifacts ("收到，已翻譯...")
 * 4. Always apply structure auto-fix (insert missing empty lines, restore \u3000 indent)
 * 5. Run quality rules (language → refusal → structure) in priority order
 * 6. Each failing rule (with remaining budget) triggers a retry:
 *    - Push [assistant(response), user(correction)] to messages
 *    - The assistant response may use rule-specific annotated text (e.g. structure violations)
 *    - Repeat from step 2
 * 7. When all rules pass (or all budgets exhausted), strip keyword annotations and
 *    violation markers, then return the final text
 *
 * There can be multiple assistant messages per chunk — one per retry attempt.
 */
export async function translateChunk(
  rawSourceText: string,
  sourceLang: Language,
  targetLang: Language,
  config: AppConfig,
  keywords: KeywordEntry[],
): Promise<string> {
  const strings = getStrings(targetLang);

  // Normalize lines that contain only whitespace (including \u3000) to empty,
  // then trim leading/trailing blanks — reduces token waste.
  const sourceText = normalizeBodyText(rawSourceText);

  const systemPrompt = getPrompt(targetLang, 'translate', {
    source_lang: languageName(sourceLang),
    target_lang: languageName(targetLang),
    target_lang_code: targetLang,
    source_lang_code: sourceLang,
  });

  const userPromptPrefix = buildUserPromptPrefix(sourceLang, targetLang);
  const annotatedSource = annotateKeywords(sourceText, keywords);

  // Initial message pair: system (translation prompt) + user (source text)
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPromptPrefix + annotatedSource },
  ];

  // Per-rule retry budgets, decremented on each retry for that rule
  const ruleBudget = { ...TRANSLATION.ruleRetryLimits };
  let lastResponse = '';

  for (let attempt = 0; attempt < TRANSLATION.maxRetries; attempt++) {
    let response = await callLlm(messages, config, strings);
    if (!response) {
      console.warn(`[Inkwell] Chunk attempt ${attempt + 1}: API returned null (see LLM error above), retrying...`);
      continue;
    }
    // Normalize whitespace-only lines immediately so retries don't re-send wasted tokens.
    // callLlm() already applies cleanResponse() which strips <thinking>/<reasoning> and
    // handler-like first-line artifacts ("收到，已翻譯成...").
    response = normalizeBodyText(response);
    lastResponse = response;

    // Always apply structure auto-fix — insert missing empty lines, restore \u3000 indent.
    // This runs unconditionally before any rule checks so that subsequent content rules
    // (language, refusal) see the structurally corrected text.
    response = scoreStructure(sourceText, response, strings).autoFixedText;

    const engRatio = englishRatio(response);
    const jpRatio = japaneseRatio(response);
    let rejectReason = '';
    let correction = '';
    let ruleName = '';

    // Freeze the auto-fixed response for rule closures so they don't track
    // responseForRetry reassignments (which swap in annotated text for the
    // retry assistant message).
    const r = response;

    // Quality rules checked in priority order: language → refusal → structure.
    // The first failing rule with remaining budget triggers a retry.
    const rules: Array<{ name: string; check: () => RuleResult }> = [
      { name: 'language', check: () => checkLanguage(r, strings) },
      { name: 'refusal', check: () => checkRefusal(r, strings) },
      { name: 'structure', check: () => checkStructure(sourceText, r, strings) },
    ];

    for (const rule of rules) {
      const result = rule.check();

      if (!result.ok && (ruleBudget[rule.name] ?? 1) > 0) {
        // Retry path — rule failed and still has budget
        rejectReason = result.detail;
        correction = result.correction;
        // Use the rule's annotated/retry response as the assistant message
        // (e.g. structure rule provides annotated text so the LLM can see
        // <!-- violation: --> markers)
        if (result.responseForRetry !== undefined) {
          response = result.responseForRetry;
        }
        ruleName = rule.name;
        break;
      }

      if (!result.ok) {
        // Budget exhausted — apply rule-specific fallback (auto-fix) if provided,
        // but do NOT retry. The response is updated in place so the next rule
        // checks the fixed version.
        if (result.responseOnBudgetExhausted !== undefined) {
          response = result.responseOnBudgetExhausted;
        }
        // Continue to next rule (don't break)
      }
    }

    if (rejectReason && attempt < TRANSLATION.maxRetries - 1) {
      ruleBudget[ruleName] = (ruleBudget[ruleName] ?? 1) - 1;
      console.log(
        `[Inkwell] Reject attempt ${attempt + 1}: ${rejectReason} | eng=${engRatio.toFixed(3)} jp=${jpRatio.toFixed(3)}`,
      );
      // Append the failing response as the assistant message and the
      // correction as the user message for the retry
      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: correction });
      continue;
    }

    // All rules passed (or all budgets exhausted) — return the clean translation
    return stripAnnotations(stripViolationAnnotations(response), keywords);
  }

  // All retries exhausted — return whatever we have
  return stripAnnotations(stripViolationAnnotations(lastResponse), keywords);
}

/**
 * Translate a full chapter body by splitting it into chunks and translating
 * each chunk in parallel with the configured concurrency.
 */
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
