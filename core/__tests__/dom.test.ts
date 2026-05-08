// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';

// We test extractBodyText by constructing DOM trees.
// The function is imported from dom.ts, which requires DOM APIs.
describe('extractBodyText', () => {
  it('extracts per-<p> when all children are <p> and strips \\u3000-only lines', async () => {
    const { extractBodyText } = await import('../dom');

    const container = document.createElement('div');
    container.innerHTML = `
      <p>line1</p>
      <p>line2</p>
      <p>　</p>
      <p>line3</p>
    `;

    const result = extractBodyText(container);
    // \u3000-only line stripped to empty, but structure preserved
    expect(result).toBe('line1\nline2\n\nline3');
  });

  it('strips \\u3000-only lines to empty strings for token savings', async () => {
    const { extractBodyText } = await import('../dom');

    const container = document.createElement('div');
    container.innerHTML = `
      <p>──澄目村 石碑『澄鏡ノ辞』</p>
      <p>　</p>
      <p>　</p>
      <p>　</p>
      <p>■</p>
    `;

    const result = extractBodyText(container);
    // \u3000-only lines become empty, preserving line count
    expect(result).toBe('──澄目村 石碑『澄鏡ノ辞』\n\n\n\n■');
    const lines = result.split('\n');
    expect(lines).toHaveLength(5);
    // 3 empty lines where \u3000 was
    expect(lines.filter((l) => l === '')).toHaveLength(3);
  });

  it('falls back to innerText when children are not all <p>', async () => {
    const { extractBodyText } = await import('../dom');

    const container = document.createElement('div');
    container.innerHTML = `
      <div>line1</div>
      <span>inline</span>
      <p>line2</p>
    `;

    const result = extractBodyText(container);
    // Mixed children → container innerText
    expect(result).toBeTruthy();
    expect(result).toContain('line1');
    expect(result).toContain('inline');
    expect(result).toContain('line2');
  });

  it('falls back to innerText for single child', async () => {
    const { extractBodyText } = await import('../dom');

    const container = document.createElement('div');
    container.innerHTML = '<p>only paragraph</p>';

    const result = extractBodyText(container);
    // Single <p> child → per-element extraction is fine
    expect(result).toBe('only paragraph');
  });

  it('handles empty element', async () => {
    const { extractBodyText } = await import('../dom');

    const container = document.createElement('div');
    const result = extractBodyText(container);
    expect(result).toBe('');
  });

  it('handles element with no children but text', async () => {
    const { extractBodyText } = await import('../dom');

    const container = document.createElement('div');
    container.textContent = 'just text';
    const result = extractBodyText(container);
    expect(result).toBe('just text');
  });

  it('normalizeBodyText strips \\u3000-only lines', async () => {
    const { normalizeBodyText } = await import('../dom');

    expect(normalizeBodyText('a\n\u3000\nb')).toBe('a\n\nb');
    expect(normalizeBodyText('\u3000\na')).toBe('a');
    // \u3000 at start of text is trimmed (same as innerText.trim())
    expect(normalizeBodyText('\u3000Hello\nWorld')).toBe('\u3000Hello\nWorld');
  });

  it('does not introduce extra newlines from whitespace between <p> tags', async () => {
    const { extractBodyText } = await import('../dom');

    // HTML with lots of whitespace between tags (simulating typical minified or formatted HTML)
    const container = document.createElement('div');
    container.innerHTML =
      '<p>「空を見て、空が見てくれる。それが神の在り方」</p>\n' +
      '        \n' +
      '<p>「われらの顔は空にうつる。ならば空に笑顔をささげよう」</p>\n' +
      '        \n' +
      '<p>「泣く者は澱に落ちる。笑う者は、空に引かれる」</p>\n' +
      '        \n' +
      '<p>　</p>\n' +
      '        \n' +
      '<p>——澄目村 石碑『澄鏡ノ辞』</p>';

    const result = extractBodyText(container);
    const lines = result.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('「空を見て、空が見てくれる。それが神の在り方」');
    expect(lines[1]).toBe('「われらの顔は空にうつる。ならば空に笑顔をささげよう」');
    expect(lines[2]).toBe('「泣く者は澱に落ちる。笑う者は、空に引かれる」');
    // \u3000-only line stripped to empty
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('——澄目村 石碑『澄鏡ノ辞』');
  });
});
