import type { Language } from './api';

export interface ProviderDefinition {
  id: string;
  name: string;
  language: Language;
  matchUrl(url: string): boolean;
  parseUrl(url: string): { providerId: string; novelId: string; chapterId: string } | null;
  selectors: {
    chapterTitle: string;
    chapterBody: string;
    nextChapter?: string;
  };
  className?: string;
  style?: {
    lineHeight?: string;
    fontSize?: string;
    lineGap?: string;
  };
}

/**
 * Remove \u3000 from lines that have no other printable content.
 * These lines represent blank visual lines; stripping the ideographic space
 * reduces token usage without losing structural meaning.
 */
export function normalizeBodyText(text: string): string {
  const lines = text.split('\n').map((l) => (l.trim() === '' ? '' : l));
  // Remove leading/trailing empty lines without stripping \u3000 prefixes
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

/**
 * Extract text content from an element.
 *
 * When a container's direct children are all <p> elements (per-line layout),
 * extract each <p>'s innerText and join with \n. This avoids extra newlines
 * from whitespace between HTML tags that innerText on the container includes.
 *
 * Falls back to container-level innerText when the structure is mixed or unknown.
 */
export function extractBodyText(element: HTMLElement): string {
  const children = Array.from(element.children);
  const pChildren = children.filter((el) => el.tagName === 'P');

  // Per-<p> extraction when every direct child is a <p>
  if (pChildren.length > 0 && pChildren.length === children.length) {
    return normalizeBodyText(pChildren.map((el) => (el as HTMLElement).innerText ?? '').join('\n'));
  }

  return normalizeBodyText(element.innerText?.trim() ?? '');
}

export function extractChapterFromDom(provider: ProviderDefinition): { title: string; body: string } | null {
  const titleEl = document.querySelector(provider.selectors.chapterTitle);
  const bodyEl = document.querySelector(provider.selectors.chapterBody);
  if (!bodyEl) return null;

  const title = titleEl?.textContent?.trim() ?? '';
  const body = extractBodyText(bodyEl as HTMLElement);
  if (!body) return null;

  return { title, body };
}

export function findNextChapterUrl(provider: ProviderDefinition): string | undefined {
  const linkRel = document.querySelector<HTMLLinkElement>(provider.selectors.nextChapter ?? 'link[rel="next"]');
  if (linkRel?.href) return linkRel.href;

  if (provider.selectors.nextChapter && provider.selectors.nextChapter !== 'link[rel="next"]') {
    const customLink = document.querySelector<HTMLAnchorElement>(provider.selectors.nextChapter);
    if (customLink?.href) return customLink.href;
  }

  return undefined;
}

export function replaceBodyWithTranslation(provider: ProviderDefinition, translated: string): void {
  const bodyEl = document.querySelector(provider.selectors.chapterBody);
  if (!bodyEl) return;

  bodyEl.innerHTML = '';
  const container = document.createElement('div');

  if (provider.className) {
    container.className = provider.className;
  }

  const lines = translated.split('\n');
  container.style.whiteSpace = 'pre-wrap';
  container.style.wordWrap = 'break-word';

  if (provider.style) {
    if (provider.style.lineHeight) container.style.lineHeight = provider.style.lineHeight;
    if (provider.style.fontSize) container.style.fontSize = provider.style.fontSize;
    if (provider.style.lineGap) {
      container.style.setProperty('--inkwell-line-gap', provider.style.lineGap);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimEnd();
    if (line) {
      const p = document.createElement('p');
      p.textContent = line;
      p.style.margin = '0';
      if (provider.style?.lineGap) {
        p.style.marginBottom = provider.style.lineGap;
      }
      container.appendChild(p);
    } else {
      const spacer = document.createElement('p');
      spacer.textContent = '\u00A0';
      spacer.style.margin = '0';
      spacer.style.lineHeight = '0.5em';
      container.appendChild(spacer);
    }
  }

  bodyEl.appendChild(container);
}

export function insertLanguageToggle(
  currentLang: 'original' | 'translated',
  onToggle: () => void,
  onRetranslate?: () => void,
): void {
  const existing = document.getElementById('inkwell-toggle');
  if (existing) existing.remove();

  const toggle = document.createElement('div');
  toggle.id = 'inkwell-toggle';
  toggle.style.cssText = `
    position: sticky; top: 0; z-index: 9999;
    background: #1a1a2e; color: #eee; padding: 8px 16px;
    font-size: 14px; display: flex; gap: 12px; align-items: center;
    font-family: sans-serif;
  `;

  const label = document.createElement('span');
  label.textContent = 'Inkwell Translation';

  const btnStyle = `
    background: #f3f4f6; color: #111827; border: none;
    padding: 4px 12px; border-radius: 4px; cursor: pointer;
  `;

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = currentLang === 'translated' ? '原文' : '译文';
  toggleBtn.style.cssText = btnStyle;
  toggleBtn.onclick = onToggle;

  toggle.appendChild(label);
  toggle.appendChild(toggleBtn);

  if (onRetranslate) {
    const retranslateBtn = document.createElement('button');
    retranslateBtn.textContent = '重新翻譯';
    retranslateBtn.style.cssText = btnStyle;
    retranslateBtn.onclick = onRetranslate;
    toggle.appendChild(retranslateBtn);
  }

  const target = document.querySelector('body');
  if (target) {
    target.prepend(toggle);
  }
}
