const THINKING_PATTERN = /<thinking>[\s\S]*?<\/thinking>/g;
const REASONING_PATTERN = /<reasoning>[\s\S]*?<\/reasoning>/g;

const FIRST_LINE_TRAILING_PATTERN = /^.*?[:：]\*?$/;
const TRANSLATION_FIRST_LINE_PATTERN = /^(translation|翻译|翻譯|繁體|收到，已|原文行數|完成一致)/i;

/** Trim only ASCII whitespace (space, tab, newline, carriage return), preserving \u3000 and other Unicode whitespace. */
const ASCII_WS = /^[ \t\n\r]+|[ \t\n\r]+$/g;

function trimAscii(text: string): string {
  return text.replace(ASCII_WS, '');
}

export function stripTags(text: string): string {
  return text.replace(THINKING_PATTERN, '').replace(REASONING_PATTERN, '').replace(ASCII_WS, '');
}

export function cleanResponse(text: string): string {
  text = trimAscii(text);
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

  return trimAscii(lines.join('\n'));
}
