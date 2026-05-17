import { describe, it, expect } from 'vitest';
import { findViolations, fixStructure } from '../structure';
import { getStrings } from '../strings';

const strings = getStrings('zh-tw');

describe('fixStructure', () => {
  it('passes through identical text', () => {
    const result = fixStructure('a\nb\nc', 'a\nb\nc');
    expect(result).toBe('a\nb\nc');
  });

  it('inserts missing empty lines', () => {
    const src = 'a\n\nb\n\nc';
    const tgt = 'a\nb\nc';
    expect(fixStructure(src, tgt)).toBe('a\n\nb\n\nc');
  });

  it('restores \\u3000 indent', () => {
    const src = '\u3000a\n\n\u3000b';
    const tgt = 'a\n\nb';
    expect(fixStructure(src, tgt)).toBe('\u3000a\n\n\u3000b');
  });

  it('combines empty line insertion and indent restoration', () => {
    const src = '\u3000a\n\n\u3000b\n\n\u3000c';
    const tgt = 'a\nb\nc';
    expect(fixStructure(src, tgt)).toBe('\u3000a\n\n\u3000b\n\n\u3000c');
  });

  it('is idempotent', () => {
    const src = '\u3000a\n\n\u3000b';
    const tgt = 'a\nb';
    const fixed = fixStructure(src, tgt);
    expect(fixStructure(src, fixed)).toBe(fixed);
  });

  it('handles empty source', () => {
    expect(fixStructure('', '')).toBe('');
  });

  it('handles long runs of empty lines', () => {
    const src = 'a\n\n\n\n\nb';
    const tgt = 'a\nb';
    expect(fixStructure(src, tgt)).toBe('a\n\n\n\n\nb');
  });
});

describe('findViolations', () => {
  it('returns empty violations for identical text', () => {
    const report = findViolations('a\nb\nc', 'a\nb\nc', strings);
    expect(report.violations).toHaveLength(0);
    expect(report.summary).toContain('content=3=3');
    expect(report.summary).toContain('align=high');
  });

  it('detects missing empty lines between paragraphs', () => {
    const src = 'a\n\nb\n\nc';
    const tgt = 'a\nb\nc';
    const report = findViolations(src, tgt, strings);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations.every((v) => v.tag === 'missing_empty')).toBe(true);
  });

  it('detects indent_fw_missing', () => {
    const src = '\u3000hello\n\u3000world';
    const tgt = 'hello\nworld';
    const report = findViolations(src, tgt, strings);
    const fwMissing = report.violations.filter((v) => v.tag === 'indent_fw_missing');
    expect(fwMissing).toHaveLength(2);
  });

  it('skips indent_fw_missing when target line is empty content', () => {
    const src = '\u3000a\n\u3000b\n\u3000c';
    const tgt = '\u3000a\n\n\u3000c';
    const report = findViolations(src, tgt, strings);
    const fwMissing = report.violations.filter((v) => v.tag === 'indent_fw_missing');
    expect(fwMissing).toHaveLength(0);
  });

  it('generates annotated text with violation markers', () => {
    const src = '\u3000a\n\n\u3000b';
    const tgt = 'a\nb';
    const report = findViolations(src, tgt, strings);
    expect(report.annotatedText).toContain('<!-- violation:');
    expect(report.annotatedText).toContain('indent_fw_missing');
    expect(report.annotatedText).toContain('missing_empty');
  });

  it('detects boundary shift when content crosses lines', () => {
    const src = 'aaaabbb\ncc';
    const tgt = 'aaa\nbbbcc';
    const report = findViolations(src, tgt, strings);
    const shifts = report.violations.filter((v) => v.tag === 'boundary_shift');
    expect(shifts.length).toBeGreaterThan(0);
  });

  it('detects content count mismatch', () => {
    const src = 'a\nb\nc';
    const tgt = 'a\nb\nc\nd\ne';
    const report = findViolations(src, tgt, strings);
    expect(report.summary).toContain('->');
    expect(report.summary).toContain('align=low');
    expect(report.violations).toHaveLength(0);
  });

  it('detects extra empty lines in translation', () => {
    const src = 'a\nb\nc';
    const tgt = 'a\n\nb\n\nc';
    const report = findViolations(src, tgt, strings);
    const extra = report.violations.filter((v) => v.tag === 'extra_empty');
    expect(extra.length).toBeGreaterThan(0);
  });

  it('handles empty source', () => {
    const report = findViolations('', '', strings);
    expect(report.violations).toHaveLength(0);
    expect(report.summary).toContain('content=0=');
  });

  it('handles empty translation', () => {
    const src = 'a\nb\nc';
    const tgt = '';
    const report = findViolations(src, tgt, strings);
    expect(report.summary).toContain('->');
  });

  it('handles long runs of empty lines', () => {
    const src = 'a\n\n\n\n\nb';
    const tgt = 'a\nb';
    const report = findViolations(src, tgt, strings);
    const missing = report.violations.filter((v) => v.tag === 'missing_empty');
    expect(missing).toHaveLength(1);
    expect(report.annotatedText).toContain('缺少4個');
  });
});
