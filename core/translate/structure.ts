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

export interface AutoFix {
  type: 'insert_empty_line';
  /** Where to insert: after targetLineIndex in the translation line array */
  atLineIndex: number;
}

export interface Violation {
  tag: ViolationTag;
  /** The 0-based line index in the translation where the violation occurs.
   *  For missing_empty, this is the line BEFORE the insertion point. */
  targetLineIndex: number;
  /** The 0-based line index in the source content that led to this violation. */
  sourceLineIndex: number;
  description: string;
  annotation: string;
  autoFix?: AutoFix;
  /** Whether this violation can be automatically fixed with high confidence. */
  canAutoFix: boolean;
}

/**
 * Remove all <!-- violation: ... --> annotation markers from text.
 * Handles:
 *   - Inline markers: "text <!-- violation:xxx -->"
 *   - Standalone marker lines: "<!-- violation:xxx -->"
 */
export function stripViolationAnnotations(text: string): string {
  return text
    .replace(/ <!-- [Vv][Ii][Oo][Ll][Aa][Tt][Ii][Oo][Nn]:[^>]+-->/g, '') // inline (case-insensitive)
    .replace(/^<!-- [Vv][Ii][Oo][Ll][Aa][Tt][Ii][Oo][Nn]:[^>]+-->\n?/gm, ''); // standalone lines
}

export interface StructureReport {
  violations: Violation[];
  /**
   * The translation text with <!-- violation: ... --> markers injected at each violating line.
   * Missing empty lines get a marker line: <!-- violation:missing_empty — desc -->
   */
  annotatedText: string;
  /**
   * The translation text with auto-fixes applied:
   *   - missing empty lines inserted
   *   - \u3000 indent restored
   */
  autoFixedText: string;
  autoFixCount: number;
  /**
   * Summary string for logging.
   */
  summary: string;
}

// ── Helpers ──

function isEmptyLine(line: string): boolean {
  return line.trim() === '';
}

function indentType(line: string): 'tab' | 'fw' | 'space' | 'none' {
  if (/^\t/.test(line)) return 'tab';
  if (/^\u3000/.test(line)) return 'fw';
  if (/^ /.test(line)) return 'space';
  return 'none';
}

/**
 * Split text into lines, preserving empty lines.
 */
function splitLines(text: string): string[] {
  return text.split('\n');
}

/**
 * Get only content (non-empty) lines, with their original line indices.
 */
function getContentLines(lines: string[]): { text: string; index: number }[] {
  const result: { text: string; index: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isEmptyLine(lines[i]!)) {
      result.push({ text: lines[i]!, index: i });
    }
  }
  return result;
}

/**
 * Compute cumulative trimmed character lengths for content lines.
 */
function getCumulativeLengths(lines: string[]): number[] {
  const cumul: number[] = [];
  let total = 0;
  for (const l of lines) {
    total += l.trim().length;
    cumul.push(total);
  }
  return cumul;
}

// ── Thresholds ──

const BOUNDARY_RATIO_MIN = 0.6;
const BOUNDARY_RATIO_MAX = 1.67;
const LENGTH_MIN_RATIO = 0.4;
const LENGTH_MAX_RATIO = 2.5;
const LONG_LINE_TOKEN_RATIO = 1.4;
const LONG_LINE_TOKEN_TORRANCE = 8;

// ── Main Scoring Function ──

export function scoreStructure(source: string, translation: string, strings: Strings): StructureReport {
  const srcLines = splitLines(source);
  const tgtLines = splitLines(translation);

  const srcContent = getContentLines(srcLines);
  const tgtContent = getContentLines(tgtLines);

  const violations: Violation[] = [];
  const contentCountMatch = srcContent.length === tgtContent.length;

  const va = strings.violationAnnotations;

  // Helper: build annotation comment string
  function annotate(tag: ViolationTag, desc: string): string {
    return ` <!-- violation:${tag} — ${desc} -->`;
  }

  // ── Signal 1: Content count check ──
  let summaryParts: string[] = [];

  if (!contentCountMatch) {
    summaryParts.push(`content=${srcContent.length}->${tgtContent.length}`);
  } else {
    summaryParts.push(`content=${srcContent.length}=${tgtContent.length}`);
  }

  // ── Signal 2: Boundary anomaly scores ──
  // Compute per-boundary anomaly = |log(tgtCumul / srcCumul)|
  const boundaryCount = Math.min(srcContent.length, tgtContent.length);
  const srcCumul = srcContent.length > 0 ? getCumulativeLengths(srcContent.map((c) => c.text)) : [];
  const tgtCumul = tgtContent.length > 0 ? getCumulativeLengths(tgtContent.map((c) => c.text)) : [];

  let boundaryAnomalies: number[] = [];
  let maxBoundaryAnomaly = 0;
  for (let i = 0; i < boundaryCount; i++) {
    const ratio = tgtCumul[i]! / Math.max(srcCumul[i]!, 1);
    const anomaly = Math.abs(Math.log(ratio));
    boundaryAnomalies.push(anomaly);
    if (anomaly > maxBoundaryAnomaly) maxBoundaryAnomaly = anomaly;
  }

  const alignmentConfident = contentCountMatch && maxBoundaryAnomaly < 0.5;
  if (alignmentConfident) {
    summaryParts.push('align=high');
  } else if (contentCountMatch) {
    summaryParts.push(`align=medium(anomaly=${maxBoundaryAnomaly.toFixed(2)})`);
  } else {
    summaryParts.push('align=low');
  }

  // ── Signal 3: Per-boundary shift check ──
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
        canAutoFix: false,
      });
    }
  }

  // ── Signal 4: Empty line diff (only when confident alignment) ──
  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length - 1; i++) {
      const srcCur = srcContent[i]!;
      const srcNext = srcContent[i + 1]!;
      const tgtCur = tgtContent[i]!;
      const tgtNext = tgtContent[i + 1]!;

      const srcEmptyCount = srcNext.index - srcCur.index - 1;
      const tgtEmptyCount = tgtNext.index - tgtCur.index - 1;

      if (srcEmptyCount > tgtEmptyCount) {
        const diff = srcEmptyCount - tgtEmptyCount;
        const desc = va.missingEmpty(srcEmptyCount, tgtEmptyCount, diff);
        violations.push({
          tag: 'missing_empty',
          targetLineIndex: tgtCur.index,
          sourceLineIndex: srcCur.index,
          description: desc,
          annotation: annotate('missing_empty', desc),
          canAutoFix: true,
          autoFix: { type: 'insert_empty_line', atLineIndex: tgtCur.index },
        });
      } else if (tgtEmptyCount > srcEmptyCount) {
        const desc = va.extraEmpty(srcEmptyCount, tgtEmptyCount);
        violations.push({
          tag: 'extra_empty',
          targetLineIndex: tgtCur.index,
          sourceLineIndex: srcCur.index,
          description: desc,
          annotation: annotate('extra_empty', desc),
          canAutoFix: false,
        });
      }
    }
  }

  // ── Signal 5: Indent comparison (when confident alignment) ──
  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length; i++) {
      const srcLine = srcContent[i]!.text;
      const tgtLine = tgtContent[i]!.text;
      const sType = indentType(srcLine);
      const tType = indentType(tgtLine);

      if (sType === 'fw' && tType === 'none' && tgtLine.trim() !== '') {
        const desc = va.indentFwMissing;
        violations.push({
          tag: 'indent_fw_missing',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: desc,
          annotation: annotate('indent_fw_missing', desc),
          canAutoFix: true,
        });
      } else if (sType === 'tab' && tType !== 'tab') {
        const desc = va.indentTabChanged;
        violations.push({
          tag: 'indent_tab_changed',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: desc,
          annotation: annotate('indent_tab_changed', desc),
          canAutoFix: false,
        });
      } else if (sType === 'none' && tType !== 'none') {
        const desc = va.indentAdded;
        violations.push({
          tag: 'indent_added',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: desc,
          annotation: annotate('indent_added', desc),
          canAutoFix: false,
        });
      }
    }
  }

  // ── Signal 6: Length extremes + long line detection (when confident alignment) ──
  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length; i++) {
      const srcLen = srcContent[i]!.text.trim().length;
      const tgtLen = tgtContent[i]!.text.trim().length;
      const ratio = tgtLen / Math.max(srcLen, 1);

      if (ratio < LENGTH_MIN_RATIO || ratio > LENGTH_MAX_RATIO) {
        const desc = va.lengthExtreme(ratio);
        violations.push({
          tag: 'length_extreme',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: desc,
          annotation: annotate('length_extreme', desc),
          canAutoFix: false,
        });
      }

      // Long line: token-based detection (was a separate checkLongLine rule)
      const srcTokens = estimateTokens(srcContent[i]!.text);
      const tgtTokens = estimateTokens(tgtContent[i]!.text);
      if (tgtTokens > srcTokens * LONG_LINE_TOKEN_RATIO + LONG_LINE_TOKEN_TORRANCE) {
        const desc = va.longLine(tgtTokens, srcTokens);
        violations.push({
          tag: 'long_line',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: desc,
          annotation: annotate('long_line', desc),
          canAutoFix: false,
        });
      }
    }
  }

  // ── Generate annotated text ──
  // Group violations by targetLineIndex
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

  // Build annotated text: insert annotations at end of each violating line
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

  // ── Generate auto-fixed text ──
  const insertionsNeeded: { atIndex: number; count: number }[] = [];
  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length - 1; i++) {
      const srcEmpty = srcContent[i + 1]!.index - srcContent[i]!.index - 1;
      const tgtEmpty = tgtContent[i + 1]!.index - tgtContent[i]!.index - 1;
      if (srcEmpty > tgtEmpty) {
        insertionsNeeded.push({
          atIndex: tgtContent[i]!.index,
          count: srcEmpty - tgtEmpty,
        });
      }
    }
  }

  // Step 1: Insert missing empty lines (high to low index to preserve positions)
  let autoFixedLines = [...tgtLines];
  for (const ins of insertionsNeeded.sort((a, b) => b.atIndex - a.atIndex)) {
    const emptyLines = Array(ins.count).fill('');
    autoFixedLines.splice(ins.atIndex + 1, 0, ...emptyLines);
  }

  // Step 2: Rebuild content line mapping (indices shifted after insertions)
  const newTgtContent = getContentLines(autoFixedLines);

  // Step 3: Restore \u3000 indent prefix
  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length && i < newTgtContent.length; i++) {
      if (indentType(srcContent[i]!.text) === 'fw' && indentType(newTgtContent[i]!.text) !== 'fw') {
        const lineIdx = newTgtContent[i]!.index;
        autoFixedLines[lineIdx] = '\u3000' + autoFixedLines[lineIdx]!;
      }
    }
  }

  const autoFixedText = autoFixedLines.join('\n');

  // ── Summarize ──
  summaryParts.push(`violations=${violations.length}`);
  const autoFixCount = violations.filter((v) => v.canAutoFix).length;
  if (autoFixCount > 0) summaryParts.push(`autofix=${autoFixCount}`);

  const summary = summaryParts.join(' | ');

  return {
    violations,
    annotatedText,
    autoFixedText,
    autoFixCount,
    summary,
  };
}
