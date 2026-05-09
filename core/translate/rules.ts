import { estimateTokens } from './token';
import { scoreStructure, stripViolationAnnotations } from './structure-scorer';

export function isEnglishChar(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

export function englishRatio(text: string): number {
  if (text.length === 0) return 0;
  let eng = 0;
  for (const c of text) if (isEnglishChar(c)) eng++;
  return eng / text.length;
}

export function isJapaneseKana(c: string): boolean {
  const code = c.charCodeAt(0);
  return (code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff);
}

export function japaneseRatio(text: string): number {
  if (text.length === 0) return 0;
  let jp = 0;
  for (const c of text) if (isJapaneseKana(c)) jp++;
  return jp / text.length;
}

export function checkEnglishRatio(text: string, maxRatio: number): { ok: boolean; detail: string; correction: string } {
  const ratio = englishRatio(text);
  if (ratio > maxRatio) {
    return {
      ok: false,
      detail: `engRatio=${ratio.toFixed(3)} > ${maxRatio}`,
      correction: '回覆中幾乎都是英文內容\n請全部翻譯成繁體中文!\n請全部翻譯成繁體中文!\n請全部翻譯成繁體中文!',
    };
  }
  return { ok: true, detail: '', correction: '' };
}

export function checkJapaneseRatio(
  text: string,
  maxRatio: number,
): { ok: boolean; detail: string; correction: string } {
  const ratio = japaneseRatio(text);
  if (ratio >= maxRatio) {
    return {
      ok: false,
      detail: `jpRatio=${ratio.toFixed(3)} >= ${maxRatio}`,
      correction: '回覆中幾乎都是日文內容\n請全部翻譯成繁體中文!\n請全部翻譯成繁體中文!\n請全部翻譯成繁體中文!',
    };
  }
  return { ok: true, detail: '', correction: '' };
}

export function findJapaneseKana(text: string): string[] {
  const seen = new Set<string>();
  for (const c of text) {
    if (isJapaneseKana(c)) seen.add(c);
  }
  return [...seen].sort();
}

export interface StructureResult {
  ok: boolean;
  detail: string;
  hasIndentViolation: boolean;
  hasEmptyViolation: boolean;
  hasContentDistViolation: boolean;
  hasContentLengthViolation: boolean;
  hasContentCountViolation: boolean;
  correction: string;
  /** Translation text with <!-- VIOLATION: ... --> markers on violating lines. */
  annotatedResponse: string;
  /** Whether ALL violations can be auto-fixed without LLM retry. */
  allAutoFixable: boolean;
  /** Translation text with auto-fixes applied (inserted empty lines, restored \u3000 indent). */
  autoFixedText: string;
}

export function checkStructure(source: string, translation: string): StructureResult {
  const report = scoreStructure(source, translation);

  const hasIndent = report.violations.some(
    (v) => v.tag === 'INDENT_FW_MISSING' || v.tag === 'INDENT_TAB_CHANGED' || v.tag === 'INDENT_ADDED',
  );
  const hasEmpty = report.violations.some((v) => v.tag === 'MISSING_EMPTY' || v.tag === 'EXTRA_EMPTY');
  const hasContentDist = report.violations.some((v) => v.tag === 'BOUNDARY_SHIFT');
  const hasContentLength = report.violations.some((v) => v.tag === 'LENGTH_EXTREME');
  const contentMatch = /content=\d+=\d+/.test(report.summary);
  const hasContentCountViolation = !contentMatch;

  // Content must match and all violations must be auto-fixable
  const allAutoFixable =
    contentMatch && (report.violations.length === 0 || report.violations.every((v) => v.canAutoFix));

  // Build correction message with annotations for non-auto-fixable cases
  let correction = '';
  if (!allAutoFixable && report.violations.length > 0) {
    correction = `請修正以下帶有 <!-- VIOLATION: --> 標記的問題。修正後請移除所有標記。\n\n${report.annotatedText}`;
  }

  return {
    ok: allAutoFixable,
    detail: report.summary,
    hasIndentViolation: hasIndent,
    hasEmptyViolation: hasEmpty,
    hasContentDistViolation: hasContentDist,
    hasContentLengthViolation: hasContentLength,
    hasContentCountViolation,
    correction,
    annotatedResponse: report.annotatedText,
    allAutoFixable,
    autoFixedText: report.autoFixedText,
  };
}

export function checkLongLine(source: string, translation: string): { ok: boolean; detail: string } {
  const srcLines = source.split('\n');
  const tgtLines = translation.split('\n');
  const maxSrc = Math.max(...srcLines.map((l) => estimateTokens(l)));
  const maxTgt = Math.max(...tgtLines.map((l) => estimateTokens(l)));
  if (maxSrc * 1.5 < maxTgt) {
    return { ok: false, detail: `longest line ${maxTgt} tokens > ${maxSrc} * 1.5 (${(maxSrc * 1.5).toFixed(0)})` };
  }
  return { ok: true, detail: '' };
}

const REFUSAL_PATTERNS = [
  /抱歉，我無法完成/i,
  /抱歉，我无法完成/i,
  /對不起，我[不無]/i,
  /对不起，我[不无]/i,
  /i['']m sorry[,.]* (but )?i (can't|cannot)/i,
  /申し訳ありませ[んn].*できませ[んn]/i,
];

export function checkRefusal(text: string): { ok: boolean; detail: string } {
  if (text.length >= 40) return { ok: true, detail: '' };
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(text)) {
      return { ok: false, detail: 'refusal detected' };
    }
  }
  return { ok: true, detail: '' };
}
