import type { Language } from '../api';
import type { AppConfig } from '../config';
import type { Strings } from './strings';
import { MAX_OUTPUT_TOKENS } from './token';
import { TRANSLATION } from './constants';
import { cleanResponse } from './response';

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

export type ResponseFormat = { type: 'json_schema'; name: string; strict?: boolean; schema: object };

type OutputItem = {
  type?: string;
  role?: string;
  content?: Array<{ type?: string; text?: string }>;
};

function extractOutputText(data: { output_text?: string; output?: OutputItem[] }): string | undefined {
  if (typeof data.output_text === 'string' && data.output_text.length > 0) {
    return data.output_text;
  }
  const output = data.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === 'output_text' && typeof part.text === 'string') {
            return part.text;
          }
        }
      }
    }
  }
  return undefined;
}

// usage of response API enable interleaved thinking,
// which greatly imporve the output quality on provider like claudflare and GMICloud
export async function callLlm(
  messages: Array<{ role: string; content: string }>,
  config: AppConfig,
  strings: Strings,
  responseFormat?: ResponseFormat,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    model: config.model,
    input: messages,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    repetition_penalty: TRANSLATION.repetitionPenalty,
    temperature: TRANSLATION.temperature,
    top_p: TRANSLATION.topP,
    reasoning: { effort: config.reasoningEffort },
    store: false,
  };

  if (responseFormat) {
    body.text = { format: responseFormat };
  }

  try {
    const res = await fetch(`${config.apiEndpoint.replace(/\/+$/, '')}/responses`, {
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
    let content: string | undefined = extractOutputText(data);
    if (content) content = cleanResponse(content, strings);
    return content ?? null;
  } catch (err) {
    console.warn('[Inkwell] LLM call failed:', err);
    return null;
  }
}
