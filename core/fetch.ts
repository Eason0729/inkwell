import type { ProviderDefinition } from './providers/index';
import { extractBodyText } from './dom';

export async function fetchNextChapterContent(
  url: string,
  provider: ProviderDefinition,
): Promise<{ title: string; body: string } | null> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';

    let cleanup = () => {};

    const overallTimer = setTimeout(() => {
      cleanup();
      console.warn('[Inkwell] fetchNextChapterContent: iframe timeout for', url);
      resolve(null);
    }, 30000);

    let attempts = 0;
    const maxAttempts = 30;
    let pollTimer: ReturnType<typeof setTimeout>;

    function poll() {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.body) {
          const bodyEl = doc.querySelector(provider.selectors.chapterBody);
          if (bodyEl && extractBodyText(bodyEl as HTMLElement)) {
            const titleEl = doc.querySelector(provider.selectors.chapterTitle);
            cleanup();
            resolve({
              title: titleEl?.textContent?.trim() ?? '',
              body: extractBodyText(bodyEl as HTMLElement),
            });
            return;
          }
        }
      } catch {
        // cross-origin iframe access denied — not expected for same-origin
      }

      attempts++;
      if (attempts >= maxAttempts) {
        cleanup();
        console.warn('[Inkwell] fetchNextChapterContent: iframe poll exhausted for', url);
        resolve(null);
        return;
      }

      pollTimer = setTimeout(poll, 1000);
    }

    cleanup = () => {
      clearTimeout(overallTimer);
      clearTimeout(pollTimer);
      iframe.remove();
    };

    iframe.onload = () => {
      setTimeout(poll, 500);
    };

    iframe.src = url;
    document.body.appendChild(iframe);
  });
}
