import browser from 'webextension-polyfill';
import type { Language } from './api';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface AppConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  chunkSize: number;
  targetLanguage: Language;
  autoTranslate: boolean;
  enablePreemptive: boolean;
  parallelism: number;
  reasoningEffort: ReasoningEffort;
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
  parallelism: 16,
  reasoningEffort: 'none',
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
