import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual, callLlm: vi.fn() };
});

import { callLlm } from '../api';
import { translateChunk } from '../pipeline';
import type { AppConfig } from '../../config';

const mockCallLlm = vi.mocked(callLlm);

const testConfig: AppConfig = {
  apiEndpoint: 'https://test.example.com/v1',
  apiKey: 'test-key',
  model: 'test-model',
  chunkSize: 200,
  targetLanguage: 'zh-tw',
  autoTranslate: true,
  enablePreemptive: false,
  parallelism: 4,
  extraBody: '{"reasoning":{"effort":"none"}}',
};

beforeEach(() => {
  mockCallLlm.mockReset();
});

describe('translateChunk', () => {
  it('returns clean translation on first attempt', async () => {
    const src = '吾輩は猫である。名前はまだ無い。\n\nどこで生れたかとんと見当がつかぬ。';
    mockCallLlm.mockResolvedValueOnce('我是貓。還沒有名字。\n\n在哪裡出生根本無從推測。');

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('我是貓。還沒有名字。\n\n在哪裡出生根本無從推測。');
    expect(mockCallLlm).toHaveBeenCalledTimes(1);
  });

  it('collapses whitespace-only lines to save tokens', async () => {
    const src = '甲\n\n乙';
    mockCallLlm.mockResolvedValueOnce('甲\n   \n乙');

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('甲\n\n乙');
  });

  it('restores structure when LLM drops empty lines and indent', async () => {
    const src = '\u3000甲\n\n\u3000乙\n\n\u3000丙';
    mockCallLlm.mockResolvedValueOnce('甲\n乙\n丙');

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('\u3000甲\n\n\u3000乙\n\n\u3000丙');
    expect(mockCallLlm).toHaveBeenCalledTimes(1);
  });

  it('retries when LLM returns excessive English', async () => {
    const src = '甲\n乙';
    mockCallLlm.mockResolvedValueOnce('Hello World Test Output Here');
    const good = '好的\n翻譯結果';
    for (let i = 0; i < 9; i++) mockCallLlm.mockResolvedValueOnce(good);

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('好的\n翻譯結果');
  });

  it('retries when LLM returns excessive Japanese kana', async () => {
    const src = '甲\n乙';
    mockCallLlm.mockResolvedValueOnce('あいうえおかきくけこさしすせそたちつてと');
    const good = '好的\n翻譯';
    for (let i = 0; i < 9; i++) mockCallLlm.mockResolvedValueOnce(good);

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('好的\n翻譯');
  });

  it('retries structure violation and passes annotated text in assistant message', async () => {
    const src = '甲甲乙乙\n丙丙';
    mockCallLlm.mockResolvedValueOnce('甲甲\n乙乙丙丙');
    const good = '甲甲翻譯\n丙丙';
    for (let i = 0; i < 9; i++) mockCallLlm.mockResolvedValueOnce(good);

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).not.toContain('violation');

    const messages = mockCallLlm.mock.calls[1]![0] as Array<{ role: string; content: string }>;
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    const lastAssistant = assistantMessages[assistantMessages.length - 1]?.content;
    expect(lastAssistant).toContain('violation:boundary_shift');
    const lastUserContent = messages[messages.length - 1]!.content;
    expect(lastUserContent).toContain('violation');
  });

  it('retries when LLM refuses', async () => {
    const src = '甲\n乙';
    mockCallLlm.mockResolvedValueOnce('抱歉，我無法完成這個請求');
    const good = '正常\n翻譯';
    for (let i = 0; i < 9; i++) mockCallLlm.mockResolvedValueOnce(good);

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('正常\n翻譯');
  });

  it('strips residual violation markers from LLM response before post-processing', async () => {
    const src = '\u3000甲\n\n\u3000乙';
    mockCallLlm.mockResolvedValueOnce('甲\n<!-- violation:missing_empty -- 缺少1個 -->\n乙');

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).not.toContain('violation');
    expect(result).toBe('\u3000甲\n\n\u3000乙');
    expect(mockCallLlm).toHaveBeenCalledTimes(1);
  });

  it('does not retry for content count mismatch with no violations', async () => {
    const src = '甲\n乙\n丙';
    mockCallLlm.mockResolvedValueOnce('甲\n乙\n丙\n丁\n戊');

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('甲\n乙\n丙\n丁\n戊');
    expect(mockCallLlm).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries when structure budget runs out', async () => {
    const src = '甲甲乙乙\n丙丙';
    const badResponse = '甲甲\n乙乙丙丙';
    for (let i = 0; i < 10; i++) {
      mockCallLlm.mockResolvedValueOnce(badResponse);
    }

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).not.toContain('violation');
    const callCount = mockCallLlm.mock.calls.length;
    expect(callCount).toBeGreaterThan(2);
    expect(callCount).toBeLessThanOrEqual(10);
  });

  it('strips keyword annotations from final output', async () => {
    const src = '吾輩は猫である';
    mockCallLlm.mockResolvedValueOnce('我是貓(猫)');

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, [
      { src: '猫', dst: '貓', info: 'cat', count: 1 },
    ]);

    expect(result).toBe('我是貓');
    expect(result).not.toContain('(猫)');
  });

  it('continues on null LLM response', async () => {
    const src = '甲\n乙';
    mockCallLlm.mockResolvedValueOnce(null);
    const good = '好的\n回應';
    for (let i = 0; i < 9; i++) mockCallLlm.mockResolvedValueOnce(good);

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('好的\n回應');
  });

  it('preserves empty lines from source through translation', async () => {
    const src = '甲\n\n乙\n\n丙';
    mockCallLlm.mockResolvedValueOnce('壹\n\n貳\n\n參');

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    const lines = result.split('\n');
    expect(lines).toEqual(['壹', '', '貳', '', '參']);
  });

  it('handles single-line input without empty lines', async () => {
    const src = '吾輩は猫である';
    mockCallLlm.mockResolvedValueOnce('我是貓。');

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('我是貓。');
  });

  it('normalizes source text whitespace before constructing prompt', async () => {
    const src = '\u3000甲\n\n\u3000\n\n\u3000\n\n\u3000乙\n\n';
    mockCallLlm.mockResolvedValueOnce('好的\n\n翻譯');

    const result = await translateChunk(src, 'jp', 'zh-tw', testConfig, []);

    expect(result).toBe('好的\n\n翻譯');
  });
});
