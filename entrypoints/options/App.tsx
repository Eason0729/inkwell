import { useState, useEffect, useCallback } from 'preact/hooks';
import { loadConfig, saveConfig } from '../../core/config';
import { getAllNovels, getKeywords } from '../../core/db/dexie';
import type { AppConfig } from '../../core/config';
import type { KeywordRecord } from '../../core/db/types';
import type { NovelRecord } from '../../core/db/types';
import { ConfigTab } from './tabs/ConfigTab';
import { NovelsTab } from './tabs/NovelsTab';
import { KeywordsTab } from './tabs/KeywordsTab';
import { Toggle } from './tabs/ConfigTab';

type Tab = 'config' | 'novels' | 'keywords';

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [novels, setNovels] = useState<NovelRecord[]>([]);
  const [keywords, setKeywords] = useState<KeywordRecord[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('config');
  const [saved, setSaved] = useState(false);

  const refreshNovels = useCallback(async () => {
    const data = await getAllNovels();
    setNovels(data);
  }, []);

  const refreshKeywords = useCallback(async () => {
    if (!selectedNovel) return;
    const [providerId, novelId] = selectedNovel.split('::');
    if (providerId && novelId) {
      const kws = await getKeywords(providerId, novelId);
      setKeywords(kws);
    }
  }, [selectedNovel]);

  useEffect(() => {
    loadConfig().then(setConfig);
    refreshNovels();

    const onFocus = () => {
      refreshNovels();
      if (tab === 'keywords') {
        refreshKeywords();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshNovels, refreshKeywords, tab]);

  // Refresh data when switching to novels/keywords tab
  useEffect(() => {
    if (tab === 'novels') {
      refreshNovels();
    } else if (tab === 'keywords') {
      refreshKeywords();
    }
  }, [tab, refreshNovels, refreshKeywords]);

  async function handleSave() {
    if (!config) return;
    await saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateConfig(partial: Partial<AppConfig>) {
    if (!config) return;
    setConfig({ ...config, ...partial });
    setSaved(false);
  }

  async function viewKeywords(novelKey: string) {
    setSelectedNovel(novelKey);
    const [providerId, novelId] = novelKey.split('::');
    if (providerId && novelId) {
      const kws = await getKeywords(providerId, novelId);
      setKeywords(kws);
    }
    setTab('keywords');
  }

  if (!config)
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <span className="text-base font-semibold text-gray-100 tracking-tight">Inkwell</span>
            <div className="flex items-center gap-1">
              {(['config', 'novels', 'keywords'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    tab === t ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t === 'config' ? 'Settings' : t === 'novels' ? 'Novels' : 'Keywords'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {tab === 'config' && (
          <>
            <ConfigTab config={config} onChange={updateConfig} />
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleSave}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                  saved
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : 'bg-gray-100 text-gray-900 hover:bg-white'
                }`}
              >
                {saved ? 'Saved' : 'Save'}
              </button>
              {!saved && <span className="text-xs text-gray-600">Settings are stored locally in your browser</span>}
            </div>
          </>
        )}

        {tab === 'novels' && <NovelsTab novels={novels} onSelect={viewKeywords} />}

        {tab === 'keywords' && (
          <KeywordsTab
            selectedNovel={selectedNovel}
            keywords={keywords}
            onBack={() => setTab('novels')}
            onUpdate={async () => {
              await refreshKeywords();
              await refreshNovels();
            }}
          />
        )}
      </main>
    </div>
  );
}

export { Toggle };
