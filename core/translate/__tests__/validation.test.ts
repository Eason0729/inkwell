import { describe, it, expect } from 'vitest';
import {
  isEnglishChar,
  englishRatio,
  isJapaneseKana,
  japaneseRatio,
  findJapaneseKana,
  checkEnglishRatio,
  checkJapaneseRatio,
  checkStructure,
  checkLongLine,
  checkRefusal,
} from '../validation';

describe('isEnglishChar', () => {
  it('returns true for lowercase letters', () => {
    expect(isEnglishChar('a')).toBe(true);
    expect(isEnglishChar('z')).toBe(true);
  });

  it('returns true for uppercase letters', () => {
    expect(isEnglishChar('A')).toBe(true);
    expect(isEnglishChar('Z')).toBe(true);
  });

  it('returns false for CJK characters', () => {
    expect(isEnglishChar('中')).toBe(false);
    expect(isEnglishChar('文')).toBe(false);
  });

  it('returns false for kana', () => {
    expect(isEnglishChar('あ')).toBe(false);
    expect(isEnglishChar('ア')).toBe(false);
  });

  it('returns false for digits', () => {
    expect(isEnglishChar('0')).toBe(false);
    expect(isEnglishChar('9')).toBe(false);
  });
});

describe('englishRatio', () => {
  it('returns 1.0 for pure English text', () => {
    expect(englishRatio('HelloWorld')).toBe(1.0);
  });

  it('returns 0.0 for pure CJK text', () => {
    expect(englishRatio('中文繁體')).toBe(0);
  });

  it('returns correct ratio for mixed text', () => {
    const ratio = englishRatio('He世界');
    expect(ratio).toBeCloseTo(0.5, 1);
  });

  it('returns 0 for empty string', () => {
    expect(englishRatio('')).toBe(0);
  });

  it('returns 0 for text with only symbols and numbers', () => {
    expect(englishRatio('123!@#')).toBe(0);
  });
});

describe('isJapaneseKana', () => {
  it('returns true for hiragana', () => {
    expect(isJapaneseKana('あ')).toBe(true);
    expect(isJapaneseKana('ん')).toBe(true);
  });

  it('returns true for katakana', () => {
    expect(isJapaneseKana('ア')).toBe(true);
    expect(isJapaneseKana('ン')).toBe(true);
  });

  it('returns false for kanji', () => {
    expect(isJapaneseKana('漢')).toBe(false);
    expect(isJapaneseKana('字')).toBe(false);
  });

  it('returns false for ASCII', () => {
    expect(isJapaneseKana('a')).toBe(false);
    expect(isJapaneseKana('Z')).toBe(false);
  });
});

describe('japaneseRatio', () => {
  it('returns 1.0 for pure hiragana', () => {
    expect(japaneseRatio('あいうえお')).toBe(1.0);
  });

  it('returns 1.0 for pure katakana', () => {
    expect(japaneseRatio('アイウエオ')).toBe(1.0);
  });

  it('returns 0.0 for pure CJK', () => {
    expect(japaneseRatio('中文繁體')).toBe(0);
  });

  it('returns correct ratio for mixed text', () => {
    const ratio = japaneseRatio('あい中文');
    expect(ratio).toBeCloseTo(0.5, 1);
  });

  it('returns 0 for empty string', () => {
    expect(japaneseRatio('')).toBe(0);
  });

  it('returns correct ratio for mixed hiragana and katakana', () => {
    const ratio = japaneseRatio('ああああいいいいううううabc');
    expect(ratio).toBeCloseTo(0.8, 1);
  });
});

describe('findJapaneseKana', () => {
  it('returns unique kana characters sorted', () => {
    const result = findJapaneseKana('あいあ');
    expect(result).toEqual(['あ', 'い']);
  });

  it('returns empty array when no kana present', () => {
    expect(findJapaneseKana('Hello')).toEqual([]);
  });

  it('includes both hiragana and katakana', () => {
    const result = findJapaneseKana('あア');
    expect(result).toEqual(['あ', 'ア']);
  });
});

describe('checkEnglishRatio', () => {
  const maxRatio = 0.2;

  it('returns ok when ratio is below threshold', () => {
    const result = checkEnglishRatio('中文繁體', maxRatio);
    expect(result.ok).toBe(true);
    expect(result.detail).toBe('');
    expect(result.correction).toBe('');
  });

  it('returns not ok when ratio exceeds threshold', () => {
    const result = checkEnglishRatio('Hello World English', maxRatio);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('engRatio');
    expect(result.detail).toContain(String(maxRatio));
    expect(result.correction).toBeTruthy();
  });

  it('returns ok when ratio is exactly at threshold', () => {
    const text = 'a'.repeat(Math.round(0.2 * 100)) + '中'.repeat(80);
    const result = checkEnglishRatio(text, maxRatio);
    expect(result.ok).toBe(true);
  });

  it('returns not ok for all-English text', () => {
    const result = checkEnglishRatio('english', maxRatio);
    expect(result.ok).toBe(false);
  });

  it('returns ok for empty string', () => {
    expect(checkEnglishRatio('', maxRatio).ok).toBe(true);
  });
});

describe('checkJapaneseRatio', () => {
  const maxRatio = 0.15;

  it('returns ok when ratio is below threshold', () => {
    const result = checkJapaneseRatio('中文繁體', maxRatio);
    expect(result.ok).toBe(true);
    expect(result.detail).toBe('');
    expect(result.correction).toBe('');
  });

  it('returns not ok when ratio exceeds threshold', () => {
    const result = checkJapaneseRatio('あいうえおかきくけこ', maxRatio);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('jpRatio');
    expect(result.detail).toContain(String(maxRatio));
    expect(result.correction).toBeTruthy();
  });

  it('returns not ok when ratio is exactly at threshold', () => {
    const text = 'あ'.repeat(15) + '中'.repeat(85);
    const result = checkJapaneseRatio(text, maxRatio);
    expect(result.ok).toBe(false);
  });

  it('returns ok for text with no kana', () => {
    expect(checkJapaneseRatio('中文繁體測試', maxRatio).ok).toBe(true);
  });

  it('returns ok for empty string', () => {
    expect(checkJapaneseRatio('', maxRatio).ok).toBe(true);
  });
});

describe('checkStructure', () => {
  it('returns ok for identical content', () => {
    const src = 'line1\nline2';
    const result = checkStructure(src, src);
    expect(result.ok).toBe(true);
    expect(result.allAutoFixable).toBe(true);
  });

  it('auto-fixes indent removal', () => {
    const src = '　a\n　b\n　c\n　d';
    const tgt = 'a\nb\nc\nd';
    const result = checkStructure(src, tgt);
    // All violations auto-fixable → ok
    expect(result.ok).toBe(true);
    expect(result.allAutoFixable).toBe(true);
    expect(result.hasIndentViolation).toBe(true);
    // Annotated response has markers
    expect(result.annotatedResponse).toContain('VIOLATION:INDENT_FW_MISSING');
  });

  it('auto-fixes empty line collapse', () => {
    const src = 'a\n\nb\n\nc\n\nd\n\ne\n\nf\n\ng';
    const tgt = 'a\nb\nc\nd\ne\nf\ng';
    const result = checkStructure(src, tgt);
    // All violations auto-fixable → ok
    expect(result.ok).toBe(true);
    expect(result.allAutoFixable).toBe(true);
    expect(result.hasEmptyViolation).toBe(true);
    expect(result.annotatedResponse).toContain('VIOLATION:MISSING_EMPTY');
  });

  it('auto-fixes missing empty lines', () => {
    const src = 'a\n\nb\n\nc';
    const tgt = 'a\nb\nc';
    const result = checkStructure(src, tgt);
    expect(result.ok).toBe(true);
    expect(result.allAutoFixable).toBe(true);
    expect(result.hasEmptyViolation).toBe(true);
  });

  it('detects content count mismatch', () => {
    const src = 'a\nb\nc';
    const tgt = 'a\nb\nc\nd';
    const result = checkStructure(src, tgt);
    expect(result.ok).toBe(false);
    expect(result.allAutoFixable).toBe(false);
    expect(result.hasContentCountViolation).toBe(true);
  });

  it('detects content redistribution across lines', () => {
    const src = 'aaabbb\nccc';
    const tgt = 'aaa\nbbbccc';
    const result = checkStructure(src, tgt);
    expect(result.ok).toBe(false);
    expect(result.allAutoFixable).toBe(false);
    expect(result.hasContentDistViolation).toBe(true);
  });

  it('returns annotated response with non-auto-fixable violations', () => {
    const src = 'aaabbb\nccc';
    const tgt = 'aaa\nbbbccc';
    const result = checkStructure(src, tgt);
    expect(result.correction).toBeTruthy();
    expect(result.correction).toContain('VIOLATION:BOUNDARY_SHIFT');
    expect(result.annotatedResponse).toContain('VIOLATION:BOUNDARY_SHIFT');
  });

  it('strips violation annotations from output', () => {
    const src = '　a\n　b';
    const tgt = 'a\nb';
    const result = checkStructure(src, tgt);
    // allAutoFixable → no correction, but annotatedResponse has markers
    const cleaned = result.annotatedResponse
      .replace(/ <!-- VIOLATION:[^>]+-->/g, '')
      .replace(/^<!-- VIOLATION:[^>]+-->\n?/gm, '');
    expect(cleaned).not.toContain('VIOLATION');
    expect(cleaned).toBe(tgt);
  });
});

describe('checkLongLine', () => {
  it('returns ok for equal length lines', () => {
    const src = 'short line';
    const tgt = 'short line';
    const result = checkLongLine(src, tgt);
    expect(result.ok).toBe(true);
  });

  it('detects excessively long line in translation', () => {
    const src = 'a';
    const tgt = 'a' + ' very very very very very very very long line'.repeat(20);
    const result = checkLongLine(src, tgt);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('longest line');
  });

  it('returns ok when translation line is shorter', () => {
    const src = 'a very very long line that goes on and on and on and on and on';
    const tgt = 'short line';
    const result = checkLongLine(src, tgt);
    expect(result.ok).toBe(true);
  });
});

describe('checkRefusal', () => {
  it('returns ok for long translation text', () => {
    const result = checkRefusal('x'.repeat(40));
    expect(result.ok).toBe(true);
  });

  it('detects Chinese refusal pattern', () => {
    const result = checkRefusal('抱歉，我無法完成這個請求');
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('refusal');
  });

  it('detects English refusal pattern', () => {
    const result = checkRefusal("I'm sorry, but I cannot do that");
    expect(result.ok).toBe(false);
  });

  it('detects Japanese refusal pattern', () => {
    const result = checkRefusal('申し訳ありませんが、できません');
    expect(result.ok).toBe(false);
  });

  it('returns ok for short non-refusal text', () => {
    const result = checkRefusal('你好嗎？');
    expect(result.ok).toBe(true);
  });
});
