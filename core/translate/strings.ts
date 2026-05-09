import type { Language } from '../api';

export interface ViolationAnnotation {
  /** Description text appended after `<!-- violation:TAG — desc -->` */
  (a: number, b?: number, c?: number): string;
}

export interface Strings {
  correction: {
    englishRatio: string;
    japaneseRatio: string;
    refusal: string;
    structureViolation: string;
  };

  violationAnnotations: {
    boundaryShift: (ratio: number) => string;
    missingEmpty: (srcCount: number, tgtCount: number, diff: number) => string;
    extraEmpty: (srcCount: number, tgtCount: number) => string;
    indentFwMissing: string;
    indentTabChanged: string;
    indentAdded: string;
    lengthExtreme: (ratio: number) => string;
    longLine: (tgtTokens: number, srcTokens: number) => string;
  };

  keywordSchema: {
    srcDesc: string;
    dstDesc: string;
    infoDesc: string;
  };

  firstLineCleanPattern: RegExp;
}

const zhTw: Strings = {
  correction: {
    englishRatio: '回覆中幾乎都是英文內容\n請全部翻譯成繁體中文!\n請全部翻譯成繁體中文!\n請全部翻譯成繁體中文!',
    japaneseRatio: '回覆中幾乎都是日文內容\n請全部翻譯成繁體中文!\n請全部翻譯成繁體中文!\n請全部翻譯成繁體中文!',
    refusal: '請以翻譯為目的重新進行。',
    structureViolation: '請修正以下帶有 <!-- violation: --> 標記的問題。修正後請移除所有標記。',
  },
  violationAnnotations: {
    boundaryShift: (ratio: number) => `邊界偏移: 累積長度比率=${ratio.toFixed(2)}`,
    missingEmpty: (srcCount: number, _tgtCount: number, diff: number) =>
      `原文此處有${srcCount}個空行，譯文缺少${diff}個`,
    extraEmpty: (_srcCount: number, tgtCount: number) => `原文此處無空行，譯文有${tgtCount}個多餘空行`,
    indentFwMissing: '行首全形空格遺失',
    indentTabChanged: '行首Tab被變更',
    indentAdded: '譯文有多餘行首空白',
    lengthExtreme: (ratio: number) => `行長度比率異常: ${ratio.toFixed(1)}`,
    longLine: (tgtTokens: number, srcTokens: number) => `行過長: 譯文${tgtTokens}個token，原文${srcTokens}個token`,
  },
  keywordSchema: {
    srcDesc: '原始術語（日文）',
    dstDesc: '繁體中文翻譯',
    infoDesc: '簡短的說明或上下文',
  },
  firstLineCleanPattern: /^(translation|翻译|翻譯|繁體|简体|收到，已|原文行數|完成一致)/i,
};

const zhCn: Strings = {
  correction: {
    englishRatio: '回覆中几乎都是英文内容\n请全部翻译成简体中文!\n请全部翻译成简体中文!\n请全部翻译成简体中文!',
    japaneseRatio: '回覆中几乎都是日文内容\n请全部翻译成简体中文!\n请全部翻译成简体中文!\n请全部翻译成简体中文!',
    refusal: '请以翻译为目的重新进行。',
    structureViolation: '请修正以下带有 <!-- violation: --> 标记的问题。修正后请移除所有标记。',
  },
  violationAnnotations: {
    boundaryShift: (ratio: number) => `边界偏移: 累计长度比率=${ratio.toFixed(2)}`,
    missingEmpty: (srcCount: number, _tgtCount: number, diff: number) =>
      `原文此处有${srcCount}个空行，译文缺少${diff}个`,
    extraEmpty: (_srcCount: number, tgtCount: number) => `原文此处无空行，译文有${tgtCount}个多余空行`,
    indentFwMissing: '行首全角空格遗失',
    indentTabChanged: '行首Tab被变更',
    indentAdded: '译文有多余行首空白',
    lengthExtreme: (ratio: number) => `行长度比率异常: ${ratio.toFixed(1)}`,
    longLine: (tgtTokens: number, srcTokens: number) => `行过长: 译文${tgtTokens}个token，原文${srcTokens}个token`,
  },
  keywordSchema: {
    srcDesc: '原始术语（日文）',
    dstDesc: '简体中文翻译',
    infoDesc: '简短的说明或上下文',
  },
  firstLineCleanPattern: /^(translation|翻译|翻譯|繁體|简体|收到，已|原文行數|完成一致)/i,
};

export function getStrings(lang: Language): Strings {
  if (lang === 'zh-cn') return zhCn;
  return zhTw;
}
