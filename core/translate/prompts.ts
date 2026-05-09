import type { Language } from '../api';

type PromptType = 'keywordExtract' | 'translate';

type PromptPair = { keywordExtract: string; translate: string };

const PROMPT_MAP: Record<string, PromptPair> = {
  'zh-tw': {
    translate: `你是一個輕小說翻譯模型，可以流暢通順地以日本輕小說的風格將文本翻譯成繁體中文，並聯系上下文正確使用人稱代詞，不擅自添加原文中沒有的代詞。

注意事項：
- 總是用繁體中文(臺灣用語)回覆
- 總是保留原文的語氣和風格
- 總是保留段落結構、縮排和換行
- 總是以純文字回應
- 總是完整翻譯文章
- 總是僅輸出文章內容
- 不要添加或刪除內容
- 保持 ACGN 風格`,
    keywordExtract: `你是小說關鍵詞提取助手。從以下 {{source_lang}} 文本中提取重要的專有名詞和術語。

以 JSON 格式輸出，包含一個 "keywords" 陣列。每個條目包含：
- "src": 原文術語（{{source_lang}}）
- "dst": 繁體中文翻譯(對於人名，務必自行決定其翻譯名稱)
- "info": 簡短的說明或上下文

只輸出 JSON，不要輸出其他文字。

需要提取的類型：角色名、地名、特殊物品、魔法/技能名、組織名。
不要提取：普通詞彙、助詞、通用名詞。`,
  },
  'zh-cn': {
    translate: `你是一个轻小说翻译模型，可以流畅通顺地以日本轻小说的风格将文本翻译成简体中文，并联系上下文正确使用人称代词，不擅自添加原文中没有的代词。

注意事项：
- 总是保留原文的语气和风格
- 总是保留段落结构、缩排和换行
- 总是以纯文字回应
- 总是完整翻译文章
- 总是仅输出文章内容
- 不要添加或删除内容
- 保持 ACGN 风格`,
    keywordExtract: `你是小说关键词提取助手。从以下 {{source_lang}} 文本中提取重要的专有名词和术语。

以 JSON 格式输出，包含一个 "keywords" 数组。每个条目包含：
- "src": 原文术语（{{source_lang}}）
- "dst": 简体中文翻译(对于人名，务必自行决定其翻译名称)
- "info": 简短的说明或上下文

只输出 JSON，不要输出其他文字。

需要提取的类型：角色名、地名、特殊物品、魔法/技能名、组织名。
不要提取：普通词汇、助词、通用名词。`,
  },
};

function render(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}

export function getPrompt(lang: Language, type: PromptType, vars: Record<string, string> = {}): string {
  const tmpl = PROMPT_MAP[lang]?.[type] ?? '';
  return render(tmpl, vars);
}
