const THINKING_PATTERN = /<thinking>[\s\S]*?<\/thinking>/g;
const REASONING_PATTERN = /<reasoning>[\s\S]*?<\/reasoning>/g;

const FIRST_LINE_TRAILING_PATTERN = /^.*?[:：]\*?$/;
const TRANSLATION_FIRST_LINE_PATTERN = /^(translation|翻译|翻譯|繁體|收到，已|原文行數|完成一致)/i;

export function stripTags(text: string): string {
  return text.replace(THINKING_PATTERN, '').replace(REASONING_PATTERN, '').trim();
}

export function cleanResponse(text: string): string {
  text = text.trim();
  text = stripTags(text);
  const lines = text.split('\n');

  while (lines.length > 0) {
    const first = lines[0]!.trim();
    if (!first) {
      lines.shift();
      continue;
    }
    if (TRANSLATION_FIRST_LINE_PATTERN.test(first)) {
      lines.shift();
      continue;
    }
    if (FIRST_LINE_TRAILING_PATTERN.test(first)) {
      lines.shift();
      continue;
    }
    break;
  }

  return lines.join('\n').trim();
}
