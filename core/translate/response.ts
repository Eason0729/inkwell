const THINKING_PATTERN = /<thinking>[\s\S]*?<\/thinking>/g;
const REASONING_PATTERN = /<reasoning>[\s\S]*?<\/reasoning>/g;

const FIRST_LINE_TRAILING_PATTERN = /^.*?[:：]\*?$/;
const TRANSLATION_FIRST_LINE_PATTERN = /^(translation|翻译|翻譯|繁體|收到，已|原文行數|完成一致)/i;

/** Strip only leading/trailing newlines. Preserve all other whitespace (spaces, tabs, \u3000) as they carry indentation. */
const NEWLINE_TRIM = /^[\n\r]+|[\n\r]+$/g;

function trimNewlines(text: string): string {
  return text.replace(NEWLINE_TRIM, '');
}

export function stripTags(text: string): string {
  return text.replace(THINKING_PATTERN, '').replace(REASONING_PATTERN, '').replace(NEWLINE_TRIM, '');
}

export function cleanResponse(text: string): string {
  text = trimNewlines(text);
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

  return trimNewlines(lines.join('\n'));
}
