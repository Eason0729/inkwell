export const MAX_OUTPUT_TOKENS = 32768;
const AVG_CHARS_PER_TOKEN = 3;

function charTypeWeight(code: number): number {
  if (code >= 0x4e00 && code <= 0x9fff) return 0.5;
  if (code >= 0x3040 && code <= 0x30ff) return 0.4;
  if (code >= 0xac00 && code <= 0xd7af) return 0.33;
  if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) return 0.25;
  return 0.33;
}

export function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    tokens += charTypeWeight(char.codePointAt(0)!);
  }
  return Math.ceil(tokens);
}

export function charsPerTokenAvg(text: string): number {
  const estimated = estimateTokens(text);
  if (estimated === 0) return AVG_CHARS_PER_TOKEN;
  return text.length / estimated;
}
