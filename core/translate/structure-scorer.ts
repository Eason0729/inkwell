// ── Structural Scoring Algorithm ──
// Detects per-line structural violations between source and translation.
// Uses multi-signal scoring: content alignment, empty-line diff, indent comparison.

export type ViolationTag =
  | 'MISSING_EMPTY'
  | 'EXTRA_EMPTY'
  | 'INDENT_FW_MISSING'
  | 'INDENT_TAB_CHANGED'
  | 'INDENT_ADDED'
  | 'BOUNDARY_SHIFT'
  | 'LENGTH_EXTREME';

export interface AutoFix {
  type: 'insert_empty_line';
  /** Where to insert: after targetLineIndex in the translation line array */
  atLineIndex: number;
}

export interface Violation {
  tag: ViolationTag;
  /** The 0-based line index in the translation where the violation occurs.
   *  For MISSING_EMPTY, this is the line BEFORE the insertion point. */
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
 * Remove all <!-- VIOLATION: ... --> annotation markers from text.
 * Handles:
 *   - Inline markers: "text <!-- VIOLATION:xxx -->"
 *   - Standalone marker lines: "<!-- VIOLATION:xxx -->"
 */
export function stripViolationAnnotations(text: string): string {
  return text
    .replace(/ <!-- VIOLATION:[^>]+-->/g, '')       // inline
    .replace(/^<!-- VIOLATION:[^>]+-->\n?/gm, '');  // standalone lines
}

export interface StructureReport {
  violations: Violation[];
  /**
   * The translation text with <!-- VIOLATION: ... --> markers injected at each violating line.
   * Missing empty lines get a marker line: <!-- VIOLATION:MISSING_EMPTY — desc -->
   */
  annotatedText: string;
  /**
   * The translation text with auto-fixes applied:
   *   - missing empty lines inserted
   *   - \u3000 indent restored (future)
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

// ── Main Scoring Function ──

export function scoreStructure(source: string, translation: string): StructureReport {
  const srcLines = splitLines(source);
  const tgtLines = splitLines(translation);

  const srcContent = getContentLines(srcLines);
  const tgtContent = getContentLines(tgtLines);

  const violations: Violation[] = [];
  const contentCountMatch = srcContent.length === tgtContent.length;

  // ── Signal 1: Content count check ──
  let summaryParts: string[] = [];

  if (!contentCountMatch) {
    // Content count mismatch → low confidence alignment. 
    // Use cumulative boundaries as fallback alignment, but more limited auto-fix.
    summaryParts.push(`content=${srcContent.length}->${tgtContent.length}`);
  } else {
    summaryParts.push(`content=${srcContent.length}=${tgtContent.length}`);
  }

  // ── Signal 2: Boundary anomaly scores ──
  // Compute per-boundary anomaly = |log(tgtCumul / srcCumul)|
  const boundaryCount = Math.min(srcContent.length, tgtContent.length);
  const srcCumul = srcContent.length > 0
    ? getCumulativeLengths(srcContent.map(c => c.text))
    : [];
  const tgtCumul = tgtContent.length > 0
    ? getCumulativeLengths(tgtContent.map(c => c.text))
    : [];

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
      violations.push({
        tag: 'BOUNDARY_SHIFT',
        targetLineIndex: tgtContent[i]!.index,
        sourceLineIndex: srcContent[i]!.index,
        description: `邊界偏移: 累積長度比率=${ratio.toFixed(2)}`,
        annotation: ` <!-- VIOLATION:BOUNDARY_SHIFT — 邊界偏移: 累積長度比率=${ratio.toFixed(2)} -->`,
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

      // Count empty lines between these content lines in source
      const srcEmptyCount = srcNext.index - srcCur.index - 1;
      // Count empty lines between these content lines in target
      const tgtEmptyCount = tgtNext.index - tgtCur.index - 1;

      if (srcEmptyCount > tgtEmptyCount) {
        const diff = srcEmptyCount - tgtEmptyCount;
        violations.push({
          tag: 'MISSING_EMPTY',
          targetLineIndex: tgtCur.index,
          sourceLineIndex: srcCur.index,
          description: `缺少空行: 原文此處有${srcEmptyCount}個空行，譯文僅有${tgtEmptyCount}個`,
          annotation: ` <!-- VIOLATION:MISSING_EMPTY — 原文此處有${srcEmptyCount}個空行，譯文缺少${diff}個 -->`,
          canAutoFix: true,
          autoFix: { type: 'insert_empty_line', atLineIndex: tgtCur.index },
        });
      } else if (tgtEmptyCount > srcEmptyCount) {
        violations.push({
          tag: 'EXTRA_EMPTY',
          targetLineIndex: tgtCur.index,
          sourceLineIndex: srcCur.index,
          description: `多餘空行: 原文此處有${srcEmptyCount}個空行，譯文有${tgtEmptyCount}個`,
          annotation: ` <!-- VIOLATION:EXTRA_EMPTY — 原文此處無空行，譯文有多餘空行 -->`,
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

      // Skip indent violation when target line is effectively empty (only whitespace)
      if (sType === 'fw' && tType === 'none' && tgtLine.trim() !== '') {
        violations.push({
          tag: 'INDENT_FW_MISSING',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: '行首全形空格遺失',
          annotation: ` <!-- VIOLATION:INDENT_FW_MISSING — 行首全形空格遺失 -->`,
          canAutoFix: true,
        });
      } else if (sType === 'tab' && tType !== 'tab') {
        violations.push({
          tag: 'INDENT_TAB_CHANGED',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: '行首Tab縮排變更',
          annotation: ` <!-- VIOLATION:INDENT_TAB_CHANGED — 行首Tab被變更 -->`,
          canAutoFix: false,
        });
      } else if (sType === 'none' && tType !== 'none') {
        violations.push({
          tag: 'INDENT_ADDED',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: '多餘行首空白',
          annotation: ` <!-- VIOLATION:INDENT_ADDED — 譯文有多餘行首空白 -->`,
          canAutoFix: false,
        });
      }
    }
  }

  // ── Signal 6: Length extremes (when confident alignment) ──
  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length; i++) {
      const srcLen = srcContent[i]!.text.trim().length;
      const tgtLen = tgtContent[i]!.text.trim().length;
      const ratio = tgtLen / Math.max(srcLen, 1);
      if (ratio < LENGTH_MIN_RATIO || ratio > LENGTH_MAX_RATIO) {
        violations.push({
          tag: 'LENGTH_EXTREME',
          targetLineIndex: tgtContent[i]!.index,
          sourceLineIndex: srcContent[i]!.index,
          description: `行長度比率異常: ${ratio.toFixed(1)}`,
          annotation: ` <!-- VIOLATION:LENGTH_EXTREME — 行長度比率=${ratio.toFixed(1)} -->`,
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
    if (v.tag === 'MISSING_EMPTY') {
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
    // If this line has violations, append their annotations
    const lineV = violByLine.get(i);
    if (lineV) {
      line += lineV.map(v => v.annotation).join('');
    }
    annotatedLines.push(line);
    // If this line is BEFORE a missing empty, insert the marker after it
    if (missingEmptyLines.has(i)) {
      const mv = violations.filter(v => v.tag === 'MISSING_EMPTY' && v.targetLineIndex === i);
      for (const v of mv) {
        annotatedLines.push(v.annotation.trimStart());
      }
    }
  }
  const annotatedText = annotatedLines.join('\n');

  // ── Generate auto-fixed text ──
  // Compute empty lines needed between each aligned pair.
  const insertionsNeeded: { atIndex: number; count: number }[] = [];
  if (alignmentConfident) {
    for (let i = 0; i < srcContent.length - 1; i++) {
      const srcEmpty = srcContent[i+1]!.index - srcContent[i]!.index - 1;
      const tgtEmpty = tgtContent[i+1]!.index - tgtContent[i]!.index - 1;
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
  const autoFixCount = violations.filter(v => v.canAutoFix).length;
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
