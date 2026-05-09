// Translation pipeline constants — not user-configurable.
export const TRANSLATION = {
  maxRetries: 10,
  repetitionPenalty: 1.05,
  temperature: 0.1,
  topP: 0.3,
  maxEnglishRatio: 0.2,
  maxJapaneseRatio: 0.2,
  ruleRetryLimits: {
    language: 3,
    refusal: 1,
    structure: 2,
  } as Record<string, number>,
} as const;
