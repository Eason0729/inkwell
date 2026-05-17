// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';

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
    expect(result).toBe('──澄目村 石碑『澄鏡ノ辞』\n\n\n\n■');
    const lines = result.split('\n');
    expect(lines).toHaveLength(5);
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

  it('does not introduce extra newlines from whitespace between <p> tags', async () => {
    const { extractBodyText } = await import('../dom');

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
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('——澄目村 石碑『澄鏡ノ辞』');
  });
});
