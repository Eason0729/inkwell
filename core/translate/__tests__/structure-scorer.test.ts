import { describe, it, expect } from 'vitest';
import { scoreStructure, stripViolationAnnotations } from '../structure-scorer';

describe('scoreStructure', () => {
  it('returns empty violations for identical text', () => {
    const report = scoreStructure('a\nb\nc', 'a\nb\nc');
    expect(report.violations).toHaveLength(0);
    expect(report.summary).toContain('content=3=3');
    expect(report.summary).toContain('align=high');
  });

  it('detects missing empty lines between paragraphs', () => {
    const src = 'a\n\nb\n\nc';
    const tgt = 'a\nb\nc';
    const report = scoreStructure(src, tgt);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations.every(v => v.tag === 'MISSING_EMPTY')).toBe(true);
    expect(report.violations.every(v => v.canAutoFix)).toBe(true);
  });

  it('detects INDENT_FW_MISSING', () => {
    const src = '\u3000hello\n\u3000world';
    const tgt = 'hello\nworld';
    const report = scoreStructure(src, tgt);
    const fwMissing = report.violations.filter(v => v.tag === 'INDENT_FW_MISSING');
    expect(fwMissing).toHaveLength(2);
    expect(fwMissing.every(v => v.canAutoFix)).toBe(true);
  });

  it('skips INDENT_FW_MISSING when target line is empty content', () => {
    // Edge case: source has \u3000 prefix but target line trims to empty
    // Note: such target lines are filtered from content, so this won't trigger
    const src = '\u3000a\n\u3000b\n\u3000c';
    const tgt = '\u3000a\n\n\u3000c'; // middle line is empty
    const report = scoreStructure(src, tgt);
    // Content counts may differ (3 vs 2), so alignment is low confidence
    // No indent violations should fire when alignment is not confident
    const fwMissing = report.violations.filter(v => v.tag === 'INDENT_FW_MISSING');
    expect(fwMissing).toHaveLength(0);
  });

  it('generates annotated text with violation markers', () => {
    const src = '\u3000a\n\n\u3000b';
    const tgt = 'a\nb';
    const report = scoreStructure(src, tgt);
    expect(report.annotatedText).toContain('<!-- VIOLATION:');
    expect(report.annotatedText).toContain('INDENT_FW_MISSING');
    expect(report.annotatedText).toContain('MISSING_EMPTY');
  });

  it('auto-fixes missing empty lines', () => {
    const src = 'a\n\nb\n\nc';
    const tgt = 'a\nb\nc';
    const report = scoreStructure(src, tgt);
    expect(report.autoFixedText).toBe('a\n\nb\n\nc');
  });

  it('auto-fixes INDENT_FW_MISSING', () => {
    const src = '\u3000a\n\n\u3000b';
    const tgt = 'a\n\nb';
    const report = scoreStructure(src, tgt);
    expect(report.autoFixedText).toContain('\u3000a\n\n\u3000b');
  });

  it('auto-fixes combined empty and indent violations', () => {
    const src = '\u3000a\n\n\u3000b\n\n\u3000c';
    const tgt = 'a\nb\nc';
    const report = scoreStructure(src, tgt);
    expect(report.autoFixedText).toBe('\u3000a\n\n\u3000b\n\n\u3000c');
  });

  it('detects boundary shift when content crosses lines', () => {
    const src = 'aaaabbb\ncc';
    const tgt = 'aaa\nbbbcc';
    const report = scoreStructure(src, tgt);
    const shifts = report.violations.filter(v => v.tag === 'BOUNDARY_SHIFT');
    expect(shifts.length).toBeGreaterThan(0);
    expect(shifts.every(v => !v.canAutoFix)).toBe(true);
  });

  it('detects content count mismatch', () => {
    const src = 'a\nb\nc';
    const tgt = 'a\nb\nc\nd\ne';
    const report = scoreStructure(src, tgt);
    expect(report.summary).toContain('->');
    expect(report.summary).toContain('align=low');
    expect(report.violations).toHaveLength(0); // no confident alignment → no violations
  });

  it('detects extra empty lines in translation', () => {
    const src = 'a\nb\nc';
    const tgt = 'a\n\nb\n\nc';
    const report = scoreStructure(src, tgt);
    const extra = report.violations.filter(v => v.tag === 'EXTRA_EMPTY');
    expect(extra.length).toBeGreaterThan(0);
    expect(extra.every(v => !v.canAutoFix)).toBe(true);
  });

  it('handles empty source', () => {
    const report = scoreStructure('', '');
    expect(report.violations).toHaveLength(0);
    expect(report.summary).toContain('content=0=');
  });

  it('handles empty translation', () => {
    const src = 'a\nb\nc';
    const tgt = '';
    const report = scoreStructure(src, tgt);
    expect(report.summary).toContain('->');
  });

  it('handles long runs of empty lines', () => {
    const src = 'a\n\n\n\n\nb';
    const tgt = 'a\nb';
    const report = scoreStructure(src, tgt);
    const missing = report.violations.filter(v => v.tag === 'MISSING_EMPTY');
    expect(missing).toHaveLength(1);
    expect(report.annotatedText).toContain('缺少4個');
  });
});

describe('stripViolationAnnotations', () => {
  it('removes inline violation markers', () => {
    const input = 'hello <!-- VIOLATION:INDENT_FW_MISSING — desc -->\nworld';
    expect(stripViolationAnnotations(input)).toBe('hello\nworld');
  });

  it('removes standalone marker lines', () => {
    const input = 'hello\n<!-- VIOLATION:MISSING_EMPTY — desc -->\nworld';
    expect(stripViolationAnnotations(input)).toBe('hello\nworld');
  });

  it('removes multiple markers on same line', () => {
    const input = 'hello <!-- VIOLATION:A --1--> <!-- VIOLATION:B --2-->';
    expect(stripViolationAnnotations(input)).toBe('hello');
  });

  it('handles text with no markers', () => {
    const input = 'hello\nworld';
    expect(stripViolationAnnotations(input)).toBe('hello\nworld');
  });

  it('handles empty string', () => {
    expect(stripViolationAnnotations('')).toBe('');
  });
});
