import { describe, it, expect } from 'vitest';
import {
  isEnglishChar,
  englishRatio,
  isJapaneseKana,
  japaneseRatio,
  findJapaneseKana,
  checkLanguage,
  checkStructure,
  checkRefusal,
} from '../rules';
import { getStrings } from '../strings';
import { TRANSLATION } from '../constants';

const strings = getStrings('zh-tw');

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

describe('checkLanguage', () => {
  it('returns ok for pure Chinese text', () => {
    const result = checkLanguage('中文繁體', strings);
    expect(result.ok).toBe(true);
    expect(result.detail).toBe('');
    expect(result.correction).toBe('');
  });

  it('returns not ok when english ratio exceeds threshold', () => {
    const result = checkLanguage('Hello World English', strings);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('engRatio');
    expect(result.correction).toBeTruthy();
  });

  it('returns not ok when japanese ratio exceeds threshold', () => {
    const result = checkLanguage('あいうえおかきくけこ', strings);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('jpRatio');
    expect(result.correction).toBeTruthy();
  });

  it('returns english failure before japanese check', () => {
    const text = 'a'.repeat(Math.round(TRANSLATION.maxEnglishRatio * 100 + 1)) + 'あ'.repeat(50);
    const result = checkLanguage(text, strings);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('engRatio');
  });

  it('returns ok for empty string', () => {
    expect(checkLanguage('', strings).ok).toBe(true);
  });

  it('returns ok when both ratios are below thresholds', () => {
    const text = 'a'.repeat(5) + 'あ'.repeat(5) + '中'.repeat(90);
    const result = checkLanguage(text, strings);
    expect(result.ok).toBe(true);
  });
});

describe('checkStructure', () => {
  it('returns ok for identical content', () => {
    const src = 'line1\nline2';
    const result = checkStructure(src, src, strings);
    expect(result.ok).toBe(true);
  });

  it('returns ok for indent removal (fixStructure handles this)', () => {
    const src = '\u3000a\n\u3000b\n\u3000c\n\u3000d';
    const tgt = 'a\nb\nc\nd';
    const result = checkStructure(src, tgt, strings);
    expect(result.ok).toBe(false);
  });

  it('returns ok for missing empty lines (fixStructure handles this)', () => {
    const src = 'a\n\nb\n\nc\n\nd\n\ne\n\nf\n\ng';
    const tgt = 'a\nb\nc\nd\ne\nf\ng';
    const result = checkStructure(src, tgt, strings);
    expect(result.ok).toBe(false);
  });

  it('returns ok for content mismatch with no structural violations (nothing actionable for retry)', () => {
    const src = 'a\nb\nc';
    const tgt = 'a\nb\nc\nd';
    const result = checkStructure(src, tgt, strings);
    expect(result.ok).toBe(true);
    expect(result.responseForRetry).toBeUndefined();
  });

  it('detects content redistribution across lines', () => {
    const src = 'aaabbb\nccc';
    const tgt = 'aaa\nbbbccc';
    const result = checkStructure(src, tgt, strings);
    expect(result.ok).toBe(false);
    expect(result.responseForRetry).toBeDefined();
  });

  it('returns annotated text via responseForRetry for non-auto-fixable violations', () => {
    const src = 'aaabbb\nccc';
    const tgt = 'aaa\nbbbccc';
    const result = checkStructure(src, tgt, strings);
    expect(result.correction).toContain('violation');
    expect(result.responseForRetry).toContain('violation:boundary_shift');
  });
});

describe('checkRefusal', () => {
  it('returns ok for long translation text', () => {
    const result = checkRefusal('x'.repeat(40), strings);
    expect(result.ok).toBe(true);
  });

  it('detects Chinese refusal pattern', () => {
    const result = checkRefusal('抱歉，我無法完成這個請求', strings);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('refusal');
  });

  it('detects English refusal pattern', () => {
    const result = checkRefusal("I'm sorry, but I cannot do that", strings);
    expect(result.ok).toBe(false);
  });

  it('detects Japanese refusal pattern', () => {
    const result = checkRefusal('申し訳ありませんが、できません', strings);
    expect(result.ok).toBe(false);
  });

  it('returns ok for short non-refusal text', () => {
    const result = checkRefusal('你好嗎？', strings);
    expect(result.ok).toBe(true);
  });
});
