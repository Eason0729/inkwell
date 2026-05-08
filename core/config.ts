import browser from 'webextension-polyfill';
import type { Language } from './api';

export interface AppConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  chunkSize: number;
  targetLanguage: Language;
  autoTranslate: boolean;
  enablePreemptive: boolean;
  repetitionPenalty: number;
  temperature: number;
  topP: number;
  parallelism: number;
  maxRetries: number;
  maxEnglishRatio: number;
  maxJapaneseRatio: number;
  ruleRetryLimits: Record<string, number>;
}

const STORAGE_KEY = 'inkwell-config';

const DEFAULT_CONFIG: AppConfig = {
  apiEndpoint: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'deepseek/deepseek-v4-flash',
  chunkSize: 600,
  targetLanguage: 'zh-tw',
  autoTranslate: true,
  enablePreemptive: true,
  repetitionPenalty: 1.05,
  temperature: 0.1,
  topP: 0.3,
  parallelism: 16,
  maxRetries: 10,
  maxEnglishRatio: 0.2,
  maxJapaneseRatio: 0.2,
  ruleRetryLimits: { english: 2, japanese: 3, longline: 1, refusal: 1, structure: 10 },
};

export async function loadConfig(): Promise<AppConfig> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    const saved = result[STORAGE_KEY] as Partial<AppConfig> | undefined;
    if (saved) {
      return { ...DEFAULT_CONFIG, ...saved };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: config });
}
