import type { Language } from '../api';
import type { AppConfig } from '../config';
import { MAX_OUTPUT_TOKENS } from './token';
import { cleanResponse } from './post-process';

export function languageName(lang: Language): string {
  const names: Record<Language, string> = {
    jp: '日本語',
    'zh-cn': '简体中文',
    'zh-tw': '繁體中文',
    en: 'English',
    kr: '한국어',
  };
  return names[lang] ?? lang;
}

// JSON Schema is required, or openrouter will throw error.
export type ResponseFormat = { type: 'json_schema'; json_schema: { name: string; strict?: boolean; schema: object } };

export async function callLlm(
  messages: Array<{ role: string; content: string }>,
  config: AppConfig,
  responseFormat?: ResponseFormat,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: MAX_OUTPUT_TOKENS,
    repetition_penalty: config.repetitionPenalty,
    temperature: config.temperature,
    top_p: config.topP,
    reasoning: { effort: 'none' },
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  try {
    const res = await fetch(`${config.apiEndpoint.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Inkwell] LLM API error ${res.status}: ${errText}`);
      return null;
    }

    const data = await res.json();
    let content: string | undefined = data.choices?.[0]?.message?.content;
    if (content) content = cleanResponse(content);
    return content ?? null;
  } catch (err) {
    console.warn('[Inkwell] LLM call failed:', err);
    return null;
  }
}
