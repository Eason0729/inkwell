import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: ({ browser, manifestVersion }) => ({
    name: 'Inkwell',
    description: 'Novel translating browser extension',
    version: '0.1.0',
    permissions: ['storage', 'unlimitedStorage'],
    host_permissions: [
      'https://ncode.syosetu.com/*',
      'https://novel18.syosetu.com/*',
      'https://kakuyomu.jp/*',
      'https://www.alphapolis.co.jp/*',
      'https://syosetu.org/*',
      'https://syosetu.com/*',
      'https://www.pixiv.net/*',
      'https://ollama.com/v1/*',
    ],
    ...(browser === 'firefox' && manifestVersion === 2
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'inkwell@example.com',
              strict_min_version: '113.0',
            },
            gecko_android: {
              strict_min_version: '113.0',
            },
          },
        }
      : {}),
  }),
  runner: {
    startUrls: ['https://ncode.syosetu.com/'],
  },
});
