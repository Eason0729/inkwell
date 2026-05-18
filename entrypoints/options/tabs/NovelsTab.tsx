import type { NovelRecord } from '../../../core/db/types';

export function NovelsTab({ novels, onSelect }: { novels: NovelRecord[]; onSelect: (nk: string) => void }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        {novels.length === 0
          ? 'No tracked novels. Visit a chapter page with auto-translate enabled.'
          : `${novels.length} novel${novels.length > 1 ? 's' : ''}`}
      </p>

      {novels.length > 0 && (
        <div className="space-y-2">
          {novels.map((novel) => {
            const nk = `${novel.providerId}::${novel.novelId}`;
            return (
              <div
                key={nk}
                className="bg-gray-800/50 border border-gray-800 rounded-lg p-4 flex items-center justify-between group hover:border-gray-700 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{novel.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">
                    {novel.author || 'Unknown'} · {novel.providerId}
                  </p>
                </div>
                <button
                  onClick={() => onSelect(nk)}
                  className="shrink-0 ml-4 px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 bg-gray-800 border border-gray-700 hover:text-gray-300 hover:border-gray-600 transition-colors"
                >
                  Keywords
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
