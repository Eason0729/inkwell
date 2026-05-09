import type { Language, KeywordEntry } from '../api';
import type { AppConfig } from '../config';
import type { Strings } from './strings';
import { getPrompt } from './prompts';
import { callLlm, languageName, type ResponseFormat } from './api';

export function annotateKeywords(text: string, keywords: KeywordEntry[]): string {
  const sorted = [...keywords].filter((k) => k.src && k.dst).sort((a, b) => b.src.length - a.src.length);
  let result = text;
  for (const kw of sorted) {
    result = result.replaceAll(kw.src, `${kw.dst}(${kw.src})`);
  }
  return result;
}

export function stripAnnotations(text: string, keywords: KeywordEntry[]): string {
  const sorted = [...keywords].filter((k) => k.src).sort((a, b) => b.src.length - a.src.length);
  let result = text;
  for (const kw of sorted) {
    result = result
      .replaceAll(`(${kw.src})`, '')
      .replaceAll(`（${kw.src}）`, '')
      .replaceAll(`（${kw.src})`, '')
      .replaceAll(`(${kw.src}）`, '');
  }
  return result;
}

function buildKeywordSchema(strings: Strings): ResponseFormat {
  const s = strings.keywordSchema;
  return {
    type: 'json_schema',
    json_schema: {
      name: 'keywords',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          keywords: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                src: { type: 'string', description: s.srcDesc },
                dst: { type: 'string', description: s.dstDesc },
                info: { type: 'string', description: s.infoDesc },
              },
              required: ['src', 'dst', 'info'],
              additionalProperties: false,
            },
          },
        },
        required: ['keywords'],
        additionalProperties: false,
      },
    },
  };
}

export async function extractKeywordsFromBody(
  body: string,
  sourceLanguage: Language,
  config: AppConfig,
  strings: Strings,
  targetLang?: Language,
): Promise<KeywordEntry[]> {
  const targetLanguage = targetLang ?? 'zh-tw';

  const systemPrompt = getPrompt(targetLanguage, 'keywordExtract', {
    source_lang: languageName(sourceLanguage),
    target_lang: languageName(targetLanguage),
    target_lang_code: targetLanguage,
    source_lang_code: sourceLanguage,
  });

  const t0 = performance.now();
  const response = await callLlm(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: body },
    ],
    config,
    strings,
    buildKeywordSchema(strings),
  );
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`[Inkwell] Keyword extraction took ${elapsed}s`);

  if (!response) return [];

  try {
    const parsed = JSON.parse(response);
    const arr = Array.isArray(parsed) ? parsed : (parsed.keywords ?? parsed.terms ?? []);
    return arr
      .filter((item: { src?: string }) => item.src && typeof item.src === 'string')
      .map((item: { src?: string; dst?: string; info?: string }) => ({
        src: (item.src ?? '').trim(),
        dst: (item.dst ?? '').trim(),
        info: (item.info ?? '').trim(),
        count: 1,
      }));
  } catch {
    console.warn('[Inkwell] Failed to parse keyword JSON from LLM response');
    return [];
  }
}
