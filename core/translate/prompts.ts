import type { Language } from '../api';

import kwZhTw from '../../prompts/extension/zh-tw/keyword-extract.j2?raw';
import trZhTw from '../../prompts/extension/zh-tw/translate.j2?raw';
import kwZhCn from '../../prompts/extension/zh-cn/keyword-extract.j2?raw';
import trZhCn from '../../prompts/extension/zh-cn/translate.j2?raw';
type PromptType = 'keywordExtract' | 'translate';

type PromptPair = { keywordExtract: string; translate: string };

const PROMPT_MAP: Record<string, PromptPair> = {
  'zh-tw': { keywordExtract: kwZhTw, translate: trZhTw },
  'zh-cn': { keywordExtract: kwZhCn, translate: trZhCn },
};

export function getPrompt(lang: Language, type: PromptType): string {
  return PROMPT_MAP[lang]?.[type] ?? '';
}
