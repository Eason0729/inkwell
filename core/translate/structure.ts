import { estimateTokens } from './token';
import type { Strings } from './strings';

export type ViolationTag =
  | 'missing_empty'
  | 'extra_empty'
  | 'indent_fw_missing'
  | 'indent_tab_changed'
  | 'indent_added'
  | 'boundary_shift'
  | 'length_extreme'
  | 'long_line';

export interface Violation {
  tag: ViolationTag;
  targetLineIndex: number;
  sourceLineIndex: number;
  description: string;
  annotation: string;
}

export interface ViolationReport {
  violations: Violation[];
  annotatedText: string;
  summary: string;
}

function isEmptyLine(line: string): boolean {
  return line.trim() === '';
}

function indentType(line: string): 'tab' | 'fw' | 'space' | 'none' {
  if (/^\t/.test(line)) return 'tab';
  if (/^\u3000/.test(line)) return 'fw';
  if (/^ /.test(line)) return 'space';
  return 'none';
}

function splitLines(text: string): string[] {
  return text.split('\n');
}

function getContentLines(lines: string[]): { text: string; index: number }[] {
  const result: { text: string; index: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isEmptyLine(lines[i]!)) {
      result.push({ text: lines[i]!, index: i });
    }
  }
  return result;
}

function getCumulativeLengths(lines: string[]): number[] {
  const cumul: number[] = [];
  let total = 0;
  for (const l of lines) {
    total += l.trim().length;
    cumul.push(total);
  }
  return cumul;
}

function computeAlignment(
  srcLines: string[],
  tgtLines: string[],
): {
  srcContent: ReturnType<typeof getContentLines>;
  tgtContent: ReturnType<typeof getContentLines>;
  contentCountMatch: boolean;
  alignmentConfident: boolean;
  maxBoundaryAnomaly: number;
} {
  const srcContent = getContentLines(srcLines);
  const tgtContent = getContentLines(tgtLines);
  const contentCountMatch = srcContent.length === tgtContent.length;

  const boundaryCount = Math.min(srcContent.length, tgtContent.length);
  let maxBoundaryAnomaly = 0;
  if (boundaryCount > 0) {
    const srcCumul = getCumulativeLengths(srcContent.map((c) => c.text));
    const tgtCumul = getCumulativeLengths(tgtContent.map((c) => c.text));
    for (let i = 0; i < boundaryCount; i++) {
      const ratio = tgtCumul[i]! / Math.max(srcCumul[i]!, 1);
      const anomaly = Math.abs(Math.log(ratio));
      if (anomaly > maxBoundaryAnomaly) maxBoundaryAnomaly = anomaly;
    }
  }

  const alignmentConfident = contentCountMatch && maxBoundaryAnomaly < 0.5;
  return { srcContent, tgtContent, contentCountMatch, alignmentConfident, maxBoundaryAnomaly };
}

const BOUNDARY_RATIO_MIN = 0.6;
const BOUNDARY_RATIO_MAX = 1.67;
const LENGTH_MIN_RATIO = 0.4;
const LENGTH_MAX_RATIO = 2.5;
const LONG_LINE_TOKEN_RATIO = 1.4;
const LONG_LINE_TOKEN_TORRANCE = 8;

export function fixStructure(source: string, translation: string): string {
  const srcLines = splitLines(source);
  const tgtLines = splitLines(translation);
  const { srcContent, tgtContent, alignmentConfident } = computeAlignment(srcLines, tgtLines);

  let result = [...tgtLines];

  if (alignmentConfident) {
    const insertions: { atIndex: number; count: number }[] = [];
    for (let i = 0; i < srcContent.length - 1; i++) {
      const srcEmpty = srcContent[i + 1]!.index - srcContent[i]!.index - 1;
      const tgtEmpty = tgtContent[i + 1]!.index - tgtContent[i]!.index - 1;
      if (srcEmpty > tgtEmpty) {
        insertions.push({ atIndex: tgtContent[i]!.index, count: srcEmpty - tgtEmpty });
      }
    }
    for (const ins of insertions.sort((a, b) => b.atIndex - a.atIndex)) {
      result.splice(ins.atIndex + 1, 0, ...Array(ins.count).fill(''));
    }

    const newTgtContent = getContentLines(result);
    for (let i = 0; i < srcContent.length && i < newTgtContent.length; i++) {
      if (indentType(srcContent[i]!.text) === 'fw' && indentType(newTgtContent[i]!.text) !== 'fw') {
        const lineIdx = newTgtContent[i]!.index;
        result[lineIdx] = '\u3000' + result[lineIdx]!;
      }
    }
  }

  return result.join('\n');
}

export function findViolations(source: string, translation: string, strings: Strings): ViolationReport {
  const srcLines = splitLines(source);
  const tgtLines = splitLines(translation);
  const { srcContent, tgtContent, contentCountMatch, alignmentConfident, maxBoundaryAnomaly } = computeAlignment(
    srcLines,
    tgtLines,
  );

  const violations: Violation[] = [];
  const va = strings.violationAnnotations;

  function annotate(tag: ViolationTag, desc: string): string {
    return ` <!-- violation:${tag} — ${desc} -->`;
  }

  let summaryParts: string[] = [];
  if (!contentCountMatch) {
    summaryParts.push(`content=${srcContent.length}->${tgtContent.length}`);
  } else {
    summaryParts.push(`content=${srcContent.length}=${tgtContent.length}`);
  }

  if (alignmentConfident) {
    summaryParts.push('align=high');
  } else if (contentCountMatch) {
    summaryParts.push(`align=medium(anomaly=${maxBoundaryAnomaly.toFixed(2)})`);
  } else {
    summaryParts.push('align=low');
  }

  const boundaryCount = Math.min(srcContent.length, tgtContent.length);
  if (boundaryCount > 0) {
    const srcCumul = getCumulativeLengths(srcContent.map((c) => c.text));
    const tgtCumul = getCumulativeLengths(tgtContent.map((c) => c.text));
    for (let i = 0; i < boundaryCount; i++) {
      const ratio = tgtCumul[i]! / Math.max(srcCumul[i]!, 1);
      if (ratio < BOUNDARY_RATIO_MIN || ratio > BOUNDARY_RATIO_MAX) {
        const desc = va.boundaryShift(ratio);
        violations.push({
          tag: 'boundary_shift',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: desc,
          annotation: annotate('boundary_shift', desc),
        });
      }
    }
  }

  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length - 1; i++) {
      const srcEmptyCount = srcContent[i + 1]!.index - srcContent[i]!.index - 1;
      const tgtEmptyCount = tgtContent[i + 1]!.index - tgtContent[i]!.index - 1;

      if (srcEmptyCount > tgtEmptyCount) {
        const diff = srcEmptyCount - tgtEmptyCount;
        const desc = va.missingEmpty(srcEmptyCount, tgtEmptyCount, diff);
        violations.push({
          tag: 'missing_empty',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: desc,
          annotation: annotate('missing_empty', desc),
        });
      } else if (tgtEmptyCount > srcEmptyCount) {
        const desc = va.extraEmpty(srcEmptyCount, tgtEmptyCount);
        violations.push({
          tag: 'extra_empty',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: desc,
          annotation: annotate('extra_empty', desc),
        });
      }
    }
  }

  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length; i++) {
      const srcLine = srcContent[i]!.text;
      const tgtLine = tgtContent[i]!.text;
      const sType = indentType(srcLine);
      const tType = indentType(tgtLine);

      if (sType === 'fw' && tType === 'none' && tgtLine.trim() !== '') {
        violations.push({
          tag: 'indent_fw_missing',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: va.indentFwMissing,
          annotation: annotate('indent_fw_missing', va.indentFwMissing),
        });
      } else if (sType === 'tab' && tType !== 'tab') {
        violations.push({
          tag: 'indent_tab_changed',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: va.indentTabChanged,
          annotation: annotate('indent_tab_changed', va.indentTabChanged),
        });
      } else if (sType === 'none' && tType !== 'none') {
        violations.push({
          tag: 'indent_added',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: va.indentAdded,
          annotation: annotate('indent_added', va.indentAdded),
        });
      }
    }
  }

  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length; i++) {
      const srcLen = srcContent[i]!.text.trim().length;
      const tgtLen = tgtContent[i]!.text.trim().length;
      const ratio = tgtLen / Math.max(srcLen, 1);

      if (ratio < LENGTH_MIN_RATIO || ratio > LENGTH_MAX_RATIO) {
        violations.push({
          tag: 'length_extreme',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: va.lengthExtreme(ratio),
          annotation: annotate('length_extreme', va.lengthExtreme(ratio)),
        });
      }

      const srcTokens = estimateTokens(srcContent[i]!.text);
      const tgtTokens = estimateTokens(tgtContent[i]!.text);
      if (tgtTokens > srcTokens * LONG_LINE_TOKEN_RATIO + LONG_LINE_TOKEN_TORRANCE) {
        violations.push({
          tag: 'long_line',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: va.longLine(tgtTokens, srcTokens),
          annotation: annotate('long_line', va.longLine(tgtTokens, srcTokens)),
        });
      }
    }
  }

  const violByLine = new Map<number, Violation[]>();
  const missingEmptyLines = new Set<number>();
  for (const v of violations) {
    if (v.tag === 'missing_empty') {
      missingEmptyLines.add(v.targetLineIndex);
    } else {
      const arr = violByLine.get(v.targetLineIndex) ?? [];
      arr.push(v);
      violByLine.set(v.targetLineIndex, arr);
    }
  }

  const annotatedLines: string[] = [];
  for (let i = 0; i < tgtLines.length; i++) {
    let line = tgtLines[i]!;
    const lineV = violByLine.get(i);
    if (lineV) {
      line += lineV.map((v) => v.annotation).join('');
    }
    annotatedLines.push(line);
    if (missingEmptyLines.has(i)) {
      const mv = violations.filter((v) => v.tag === 'missing_empty' && v.targetLineIndex === i);
      for (const v of mv) {
        annotatedLines.push(v.annotation.trimStart());
      }
    }
  }
  const annotatedText = annotatedLines.join('\n');

  summaryParts.push(`violations=${violations.length}`);

  return {
    violations,
    annotatedText,
    summary: summaryParts.join(' | '),
  };
}
