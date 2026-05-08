import browser from 'webextension-polyfill';
import { defineBackground } from 'wxt/utils/define-background';
import type { TranslationResponse } from '../core/api';
import { handleMessage } from '../core/server';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    async (message: unknown, _sender: unknown): Promise<TranslationResponse | undefined> => {
      try {
        return await handleMessage(message);
      } catch (err) {
        console.error('[Inkwell] Unhandled error in message listener:', err);
        return { type: 'ERROR', error: String(err) };
      }
    },
  );

  console.log('[Inkwell] Background worker initialized');
});
