import { useState } from 'preact/hooks';
import type { AppConfig, ReasoningEffort } from '../../../core/config';
import type { Language } from '../../../core/api';

export function ConfigTab({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (partial: Partial<AppConfig>) => void;
}) {
  return (
    <div className="space-y-6">
      <Section title="API">
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Endpoint</label>
            <input
              type="text"
              value={config.apiEndpoint}
              onInput={(e) => onChange({ apiEndpoint: (e.target as HTMLInputElement).value })}
              className="input"
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">API Key</label>
            <input
              type="password"
              value={config.apiKey}
              onInput={(e) => onChange({ apiKey: (e.target as HTMLInputElement).value })}
              className="input"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Model</label>
            <input
              type="text"
              value={config.model}
              onInput={(e) => onChange({ model: (e.target as HTMLInputElement).value })}
              className="input"
              placeholder="mistralai/mistral-nemo"
            />
          </div>
        </div>
      </Section>

      <Section title="Translation">
        <div className="py-2.5 border-b border-gray-800/50">
          <label className="block text-sm text-gray-200 mb-1.5">Target language</label>
          <select
            value={config.targetLanguage}
            onChange={(e) => onChange({ targetLanguage: (e.target as HTMLSelectElement).value as Language })}
            className="input"
          >
            <option value="zh-tw">Traditional Chinese (繁體中文)</option>
            <option value="zh-cn">Simplified Chinese (简体中文)</option>
          </select>
        </div>
        <Toggle
          label="Auto-translate chapters"
          description="Replace body text when opening a chapter page"
          checked={config.autoTranslate}
          onChange={(v) => onChange({ autoTranslate: v })}
        />
        <div className="py-2.5 border-b border-gray-800/50">
          <label className="block text-sm text-gray-200 mb-1.5">Parallelism</label>
          <input
            type="number"
            min={1}
            max={64}
            value={config.parallelism}
            onInput={(e) => onChange({ parallelism: parseInt((e.target as HTMLInputElement).value) || 8 })}
            className="input"
          />
          <p className="text-xs text-gray-600 mt-1">Number of concurrent LLM requests for chunk processing.</p>
        </div>
        <div className="py-2.5 border-b border-gray-800/50">
          <label className="block text-sm text-gray-200 mb-1.5">Chunk Size</label>
          <input
            type="number"
            value={config.chunkSize}
            onInput={(e) => onChange({ chunkSize: parseInt((e.target as HTMLInputElement).value) || 600 })}
            className="input"
          />
          <p className="text-xs text-gray-600 mt-1">Number of token for each translation chunk.</p>
        </div>
        <div className="py-2.5 border-b border-gray-800/50">
          <label className="block text-sm text-gray-200 mb-1.5">Reasoning Effort</label>
          <select
            value={config.reasoningEffort}
            onChange={(e) => onChange({ reasoningEffort: (e.target as HTMLSelectElement).value as ReasoningEffort })}
            className="input"
          >
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <p className="text-xs text-gray-600 mt-1">Controls how much the model reasons before responding.</p>
        </div>
        <Toggle
          label="Preemptive next-chapter"
          description="Translate the next chapter in the background"
          checked={config.enablePreemptive}
          onChange={(v) => onChange({ enablePreemptive: v })}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">{title}</h2>
      <div className="bg-gray-800/30 border border-gray-800 rounded-lg p-4">{children}</div>
    </section>
  );
}

export function Toggle({
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
    <div className="flex items-center justify-between py-2.5 border-b border-gray-800/50 last:border-0">
      <div className="min-w-0 pr-4">
        <p className="text-sm text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-600 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-5 rounded-full transition-colors duration-150 ${
          checked ? 'bg-blue-500' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-150 ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
