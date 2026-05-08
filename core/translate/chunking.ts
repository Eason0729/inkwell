import { estimateTokens, MAX_OUTPUT_TOKENS } from './token';

export interface ChunkResult {
  text: string;
  index: number;
}

const SENTENCE_BOUNDARY_RE = /[。！？．.!?\n]/;
const AVG_CHARS_PER_TOKEN = 3;

export function chunkText(text: string, chunkSize: number, promptOverheadTokens: number = 0): ChunkResult[] {
  const inputBudget = chunkSize - promptOverheadTokens;
  if (inputBudget <= 0) return [{ text, index: 0 }];

  const safetyFactor = 1.2;
  const maxOutputChars = Math.floor(MAX_OUTPUT_TOKENS / safetyFactor) * AVG_CHARS_PER_TOKEN;
  const maxInputChars = inputBudget * AVG_CHARS_PER_TOKEN;
  const maxChunkChars = Math.min(maxInputChars, maxOutputChars);

  if (maxChunkChars <= 0) return [{ text, index: 0 }];

  const paragraphs = text.split(/\n\n+/);
  const chunks: ChunkResult[] = [];
  let current = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    const candidate = current ? current + '\n\n' + para : para;
    const estimated = estimateTokens(candidate);

    if (estimated > inputBudget && current) {
      chunks.push({ text: current, index: chunkIndex++ });
      current = para;
    } else if (candidate.length > maxChunkChars && current) {
      chunks.push({ text: current, index: chunkIndex++ });
      current = para;
    } else {
      current = candidate;
    }

    if (current && current.length > maxChunkChars * 1.5) {
      let remaining = current;
      while (remaining.length > maxChunkChars) {
        let splitAt = maxChunkChars;
        for (let ci = maxChunkChars; ci >= 0; ci--) {
          if (SENTENCE_BOUNDARY_RE.test(remaining[ci] ?? '')) {
            splitAt = ci;
            break;
          }
        }
        if (splitAt < 1) splitAt = maxChunkChars;
        const split = remaining.substring(0, splitAt + 1).trim();
        if (split) chunks.push({ text: split, index: chunkIndex++ });
        remaining = remaining.substring(splitAt + 1).trim();
      }
      current = remaining;
    }
  }

  if (current.trim()) {
    chunks.push({ text: current.trim(), index: chunkIndex });
  }

  return chunks;
}
