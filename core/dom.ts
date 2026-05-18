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

function removeHTMLMark(text: string): string {
  const marks = ['nbsp'];

  for (const mark of marks) {
    text = text.replaceAll(`&${mark};`, '').replaceAll(`&${mark}`, '');
  }

  return text;
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

  if (pChildren.length > 0 && pChildren.length === children.length) {
    return removeHTMLMark(pChildren.map((el) => (el as HTMLElement).innerText ?? '').join('\n'));
  }

  return removeHTMLMark(element.innerText?.trim() ?? '');
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
