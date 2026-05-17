import { estimateTokens } from './token';
import { findViolations, type ViolationReport } from './structure';
import type { Strings } from './strings';
import { TRANSLATION } from './constants';

export interface RuleResult {
  ok: boolean;
  detail: string;
  correction: string;
  responseForRetry?: string;
}

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

export function findJapaneseKana(text: string): string[] {
  const seen = new Set<string>();
  for (const c of text) {
    if (isJapaneseKana(c)) seen.add(c);
  }
  return [...seen].sort();
}

export function checkLanguage(text: string, strings: Strings): RuleResult {
  const engR = englishRatio(text);
  if (engR > TRANSLATION.maxEnglishRatio) {
    return {
      ok: false,
      detail: `engRatio=${engR.toFixed(3)} > ${TRANSLATION.maxEnglishRatio}`,
      correction: strings.correction.englishRatio,
    };
  }
  const jpR = japaneseRatio(text);
  if (jpR >= TRANSLATION.maxJapaneseRatio) {
    return {
      ok: false,
      detail: `jpRatio=${jpR.toFixed(3)} >= ${TRANSLATION.maxJapaneseRatio}`,
      correction: strings.correction.japaneseRatio,
    };
  }
  return { ok: true, detail: '', correction: '' };
}

export function checkStructure(source: string, translation: string, strings: Strings): RuleResult {
  const report = findViolations(source, translation, strings);

  const ok = report.violations.length === 0;

  return {
    ok,
    detail: report.summary,
    correction: strings.correction.structureViolation,
    responseForRetry: !ok && report.violations.length > 0 ? report.annotatedText : undefined,
  };
}

const REFUSAL_PATTERNS = [
  /抱歉，我無法完成/i,
  /抱歉，我无法完成/i,
  /對不起，我[不無]/i,
  /对不起，我[不无]/i,
  /i['']m sorry[,.]* (but )?i (can't|cannot)/i,
  /申し訳ありませ[んn].*できませ[んn]/i,
];

export function checkRefusal(text: string, strings: Strings): RuleResult {
  if (text.length >= 40) return { ok: true, detail: '', correction: '' };
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        ok: false,
        detail: 'refusal detected',
        correction: strings.correction.refusal,
      };
    }
  }
  return { ok: true, detail: '', correction: '' };
}
