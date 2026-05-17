import { describe, it, expect } from 'vitest';
import { stripMarkers, normalizeWhitespace, postProcessResponse } from '../postprocess';

describe('stripMarkers', () => {
  it('removes inline violation markers (lowercase)', () => {
    const input = 'hello <!-- violation:indent_fw_missing -- desc -->\nworld';
    expect(stripMarkers(input)).toBe('hello\nworld');
  });

  it('removes inline violation markers (uppercase legacy)', () => {
    const input = 'hello <!-- VIOLATION:INDENT_FW_MISSING -- desc -->\nworld';
    expect(stripMarkers(input)).toBe('hello\nworld');
  });

  it('removes standalone marker lines', () => {
    const input = 'hello\n<!-- violation:missing_empty -- desc -->\nworld';
    expect(stripMarkers(input)).toBe('hello\nworld');
  });

  it('removes multiple markers on same line', () => {
    const input = 'hello <!-- violation:a --1--> <!-- VIOLATION:B --2-->';
    expect(stripMarkers(input)).toBe('hello');
  });

  it('handles text with no markers', () => {
    const input = 'hello\nworld';
    expect(stripMarkers(input)).toBe('hello\nworld');
  });

  it('handles empty string', () => {
    expect(stripMarkers('')).toBe('');
  });
});

describe('normalizeWhitespace', () => {
  it('collapses whitespace-only lines to empty', () => {
    expect(normalizeWhitespace('a\n   \nb')).toBe('a\n\nb');
  });

  it('collapses \\u3000-only lines to empty (token saving)', () => {
    expect(normalizeWhitespace('a\n\u3000\nb')).toBe('a\n\nb');
  });

  it('strips leading/trailing empty lines', () => {
    expect(normalizeWhitespace('\n\na\nb\n\n')).toBe('a\nb');
  });

  it('preserves \\u3000 on content lines (indent)', () => {
    expect(normalizeWhitespace('\u3000Hello\nWorld')).toBe('\u3000Hello\nWorld');
  });

  it('preserves internal empty lines', () => {
    expect(normalizeWhitespace('a\n\nb\n\nc')).toBe('a\n\nb\n\nc');
  });

  it('is idempotent', () => {
    const text = '\u3000a\n\n\u3000\n\nb';
    const once = normalizeWhitespace(text);
    const twice = normalizeWhitespace(once);
    expect(twice).toBe(once);
  });

  it('handles single line', () => {
    expect(normalizeWhitespace('hello')).toBe('hello');
  });
});

describe('postProcessResponse', () => {
  it('applies all three steps in order', () => {
    const source = '\u3000甲\n\n\u3000乙\n\n\u3000丙';
    const response = '甲\n乙\n丙';
    const result = postProcessResponse(response, source);
    expect(result).toBe('\u3000甲\n\n\u3000乙\n\n\u3000丙');
  });

  it('is idempotent', () => {
    const source = '\u3000甲\n\n\u3000乙';
    const response = '甲\n乙';
    const fixed = postProcessResponse(response, source);
    expect(postProcessResponse(fixed, source)).toBe(fixed);
  });

  it('strips residual violation markers before normalization and fix', () => {
    const source = '\u3000甲\n\n\u3000乙';
    const response = '甲\n<!-- violation:missing_empty -- 缺少1個 -->\n乙';
    const result = postProcessResponse(response, source);
    expect(result).not.toContain('violation');
    expect(result).toBe('\u3000甲\n\n\u3000乙');
  });

  it('auto-fixes missing empty lines (1\\n\\n2\\n\\n3 → 1\\n2\\n3)', () => {
    const source = '一\n\n二\n\n三';
    const response = '一\n二\n三';
    const result = postProcessResponse(response, source);
    expect(result).toBe('一\n\n二\n\n三');
  });

  it('does not confuse marker lines with real empty lines', () => {
    const source = '甲\n\n乙\n\n丙';
    const response = '甲\n<!-- violation:missing_empty -- 1 -->\n<!-- violation:missing_empty -- 2 -->\n乙\n丙';
    const result = postProcessResponse(response, source);
    expect(result).not.toContain('violation');
    const lines = result.split('\n');
    expect(lines).toEqual(['甲', '', '乙', '', '丙']);
  });
});
