import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLlm, type ResponseFormat } from '../api';
import type { AppConfig } from '../../config';
import type { Strings } from '../strings';

const testConfig: AppConfig = {
  apiEndpoint: 'https://test.example.com/v1',
  apiKey: 'test-key',
  model: 'test-model',
  chunkSize: 200,
  targetLanguage: 'zh-tw',
  autoTranslate: true,
  enablePreemptive: false,
  parallelism: 4,
  reasoningEffort: 'low',
};

const zhTwStrings: Strings = {
  correction: {
    englishRatio: '',
    japaneseRatio: '',
    refusal: '',
    structureViolation: '',
  },
  violationAnnotations: {
    boundaryShift: () => '',
    missingEmpty: () => '',
    extraEmpty: () => '',
    indentFwMissing: '',
    indentTabChanged: '',
    indentAdded: '',
    lengthExtreme: () => '',
    longLine: () => '',
  },
  keywordSchema: { srcDesc: '', dstDesc: '', infoDesc: '' },
  firstLineCleanPattern: /^$/,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('callLlm (Responses API)', () => {
  it('posts to /responses with Responses-shaped body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ output_text: 'hello' }));

    await callLlm(
      [{ role: 'user', content: 'hi' }],
      testConfig,
      zhTwStrings,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://test.example.com/v1/responses');
    expect(init!.method).toBe('POST');
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('test-model');
    expect(body.input).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.max_output_tokens).toBeTypeOf('number');
    expect(body.store).toBe(false);
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body).not.toHaveProperty('messages');
    expect(body).not.toHaveProperty('max_tokens');
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(body).not.toHaveProperty('response_format');
    expect(init!.headers.Authorization).toBe('Bearer test-key');
  });

  it('omits Authorization header when apiKey is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ output_text: 'hello' }));
    await callLlm([{ role: 'user', content: 'hi' }], { ...testConfig, apiKey: '' }, zhTwStrings);
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('sends text.format when responseFormat provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ output_text: '{}' }));
    const fmt: ResponseFormat = {
      type: 'json_schema',
      name: 'keywords',
      strict: true,
      schema: { type: 'object' },
    };
    await callLlm([{ role: 'user', content: 'x' }], testConfig, zhTwStrings, fmt);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.text).toEqual({ format: fmt });
    expect(body).not.toHaveProperty('response_format');
  });

  it('parses top-level output_text', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ output_text: '你好' }));
    const result = await callLlm([{ role: 'user', content: 'hi' }], testConfig, zhTwStrings);
    expect(result).toBe('你好');
  });

  it('falls back to output[].content[].text when output_text absent', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        output: [
          { type: 'reasoning', content: [] },
          {
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'output_text', text: '從輸出陣列取出' },
              { type: 'output_text', text: '第二段' },
            ],
          },
        ],
      }),
    );
    const result = await callLlm([{ role: 'user', content: 'hi' }], testConfig, zhTwStrings);
    expect(result).toBe('從輸出陣列取出');
  });

  it('returns null on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'boom' } }, false));
    const result = await callLlm([{ role: 'user', content: 'hi' }], testConfig, zhTwStrings);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const result = await callLlm([{ role: 'user', content: 'hi' }], testConfig, zhTwStrings);
    expect(result).toBeNull();
  });

  it('returns null when no text is present', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ output: [] }));
    const result = await callLlm([{ role: 'user', content: 'hi' }], testConfig, zhTwStrings);
    expect(result).toBeNull();
  });

  it('strips trailing slash in endpoint before appending /responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ output_text: 'x' }));
    await callLlm([{ role: 'user', content: 'hi' }], { ...testConfig, apiEndpoint: 'https://test.example.com/v1///' }, zhTwStrings);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://test.example.com/v1/responses');
  });
});