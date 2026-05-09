import { useState, useEffect } from 'preact/hooks';
import { loadConfig, saveConfig } from '../../core/config';
import { getAllNovels, getKeywords } from '../../core/db/dexie';
import type { AppConfig } from '../../core/config';
import type { KeywordEntry, Language } from '../../core/api';
import type { NovelRecord } from '../../core/db/types';

type Tab = 'config' | 'novels' | 'keywords';

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [novels, setNovels] = useState<NovelRecord[]>([]);
  const [keywords, setKeywords] = useState<KeywordEntry[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('config');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig().then(setConfig);
    getAllNovels().then(setNovels);
  }, []);

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
      <div class="min-h-screen bg-gray-900 flex items-center justify-center">
        <p class="text-gray-500">Loading...</p>
      </div>
    );

  return (
    <div class="min-h-screen bg-gray-900">
      <nav class="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-50">
        <div class="max-w-2xl mx-auto px-4">
          <div class="flex items-center justify-between h-14">
            <span class="text-base font-semibold text-gray-100 tracking-tight">Inkwell</span>
            <div class="flex items-center gap-1">
              {(['config', 'novels', 'keywords'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  class={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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

      <main class="max-w-2xl mx-auto px-4 py-8">
        {tab === 'config' && (
          <div class="space-y-6">
            <Section title="API">
              <div class="space-y-3">
                <div>
                  <label class="block text-sm text-gray-400 mb-1.5">Endpoint</label>
                  <input
                    type="text"
                    value={config.apiEndpoint}
                    onInput={(e) => updateConfig({ apiEndpoint: (e.target as HTMLInputElement).value })}
                    class="input"
                    placeholder="https://openrouter.ai/api/v1"
                  />
                </div>
                <div>
                  <label class="block text-sm text-gray-400 mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={config.apiKey}
                    onInput={(e) => updateConfig({ apiKey: (e.target as HTMLInputElement).value })}
                    class="input"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label class="block text-sm text-gray-400 mb-1.5">Model</label>
                  <input
                    type="text"
                    value={config.model}
                    onInput={(e) => updateConfig({ model: (e.target as HTMLInputElement).value })}
                    class="input"
                    placeholder="mistralai/mistral-nemo"
                  />
                </div>
              </div>
            </Section>

            <Section title="Translation">
              <div class="py-2.5 border-b border-gray-800/50">
                <label class="block text-sm text-gray-200 mb-1.5">Target language</label>
                <select
                  value={config.targetLanguage}
                  onChange={(e) => updateConfig({ targetLanguage: (e.target as HTMLSelectElement).value as Language })}
                  class="input"
                >
                  <option value="zh-tw">Traditional Chinese (繁體中文)</option>
                  <option value="zh-cn">Simplified Chinese (简体中文)</option>
                </select>
              </div>
              <Toggle
                label="Auto-translate chapters"
                description="Replace body text when opening a chapter page"
                checked={config.autoTranslate}
                onChange={(v) => updateConfig({ autoTranslate: v })}
              />
              <div class="py-2.5 border-b border-gray-800/50">
                <label class="block text-sm text-gray-200 mb-1.5">Parallelism</label>
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={config.parallelism}
                  onInput={(e) => updateConfig({ parallelism: parseInt((e.target as HTMLInputElement).value) || 8 })}
                  class="input"
                />
                <p class="text-xs text-gray-600 mt-1">Number of concurrent LLM requests for chunk processing.</p>
              </div>
              <div class="py-2.5 border-b border-gray-800/50">
                <label class="block text-sm text-gray-200 mb-1.5">Chunk Size</label>
                <input
                  type="number"
                  value={config.chunkSize}
                  onInput={(e) => updateConfig({ chunkSize: parseInt((e.target as HTMLInputElement).value) || 600 })}
                  class="input"
                />
                <p class="text-xs text-gray-600 mt-1">Number of token for each translation chunk.</p>
              </div>
              <Toggle
                label="Preemptive next-chapter"
                description="Translate the next chapter in the background"
                checked={config.enablePreemptive}
                onChange={(v) => updateConfig({ enablePreemptive: v })}
              />
            </Section>

            <div class="flex items-center gap-3">
              <button
                onClick={handleSave}
                class={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                  saved
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : 'bg-gray-100 text-gray-900 hover:bg-white'
                }`}
              >
                {saved ? 'Saved' : 'Save'}
              </button>
              {!saved && <span class="text-xs text-gray-600">Settings are stored locally in your browser</span>}
            </div>
          </div>
        )}

        {tab === 'novels' && (
          <div>
            <p class="text-sm text-gray-500 mb-4">
              {novels.length === 0
                ? 'No tracked novels. Visit a chapter page with auto-translate enabled.'
                : `${novels.length} novel${novels.length > 1 ? 's' : ''}`}
            </p>

            {novels.length > 0 && (
              <div class="space-y-2">
                {novels.map((novel) => {
                  const nk = `${novel.providerId}::${novel.novelId}`;
                  return (
                    <div
                      key={nk}
                      class="bg-gray-800/50 border border-gray-800 rounded-lg p-4 flex items-center justify-between group hover:border-gray-700 transition-colors"
                    >
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-gray-200 truncate">{novel.title || 'Untitled'}</p>
                        <p class="text-xs text-gray-600 mt-0.5 truncate">
                          {novel.author || 'Unknown'} &middot; {novel.providerId}
                        </p>
                      </div>
                      <button
                        onClick={() => viewKeywords(nk)}
                        class="shrink-0 ml-4 px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 bg-gray-800 border border-gray-700 hover:text-gray-300 hover:border-gray-600 transition-colors"
                      >
                        Keywords
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'keywords' && (
          <div>
            <div class="flex items-center gap-3 mb-4">
              {selectedNovel && (
                <button
                  onClick={() => setTab('novels')}
                  class="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  &larr; Novels
                </button>
              )}
              <span class="text-sm text-gray-500">
                {selectedNovel ? `Keywords for ${selectedNovel}` : 'Select a novel'}
              </span>
            </div>

            {selectedNovel && keywords.length === 0 && <p class="text-sm text-gray-600">No keywords extracted yet.</p>}

            {selectedNovel && keywords.length > 0 && (
              <div class="border border-gray-800 rounded-lg overflow-hidden">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-gray-800/50 border-b border-gray-800">
                      <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Translation</th>
                      <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                        Context
                      </th>
                      <th class="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-12">#</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-800">
                    {keywords.map((kw, i) => (
                      <tr key={i} class="hover:bg-gray-800/30 transition-colors">
                        <td class="px-3 py-2 font-mono text-gray-300">{kw.src}</td>
                        <td class="px-3 py-2 text-gray-200">
                          {kw.dst || <span class="text-gray-600 italic">unset</span>}
                        </td>
                        <td class="px-3 py-2 text-gray-600 text-xs truncate max-w-[200px] hidden sm:table-cell">
                          {kw.info}
                        </td>
                        <td class="px-3 py-2 text-right text-gray-600 font-mono text-xs">{kw.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <section>
      <h2 class="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">{title}</h2>
      <div class="bg-gray-800/30 border border-gray-800 rounded-lg p-4">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div class="flex items-center justify-between py-2.5 border-b border-gray-800/50 last:border-0">
      <div class="min-w-0 pr-4">
        <p class="text-sm text-gray-200">{label}</p>
        {description && <p class="text-xs text-gray-600 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        class={`relative shrink-0 w-10 h-5 rounded-full transition-colors duration-150 ${
          checked ? 'bg-blue-500' : 'bg-gray-700'
        }`}
      >
        <span
          class={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-150 ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
