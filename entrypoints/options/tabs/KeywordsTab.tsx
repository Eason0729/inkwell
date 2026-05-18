import { useState } from 'preact/hooks';
import type { KeywordRecord } from '../../../core/db/types';
import { updateKeyword, deleteKeyword, addKeyword } from '../../../core/db/dexie';

export function KeywordsTab({
  selectedNovel,
  keywords,
  onBack,
  onUpdate,
}: {
  selectedNovel: string | null;
  keywords: KeywordRecord[];
  onBack: () => void;
  onUpdate: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({ src: '', dst: '', info: '' });
  const [editValues, setEditValues] = useState({ src: '', dst: '', info: '' });
  const [busy, setBusy] = useState(false);

  function startEdit(kw: KeywordRecord) {
    if (kw.id == null) return;
    setEditing(kw.id);
    setEditValues({ src: kw.src, dst: kw.dst, info: kw.info });
  }

  async function saveEdit(id: number | undefined) {
    if (id == null) return;
    if (busy) return;
    setBusy(true);
    try {
      await updateKeyword(id, editValues);
      await onUpdate();
    } finally {
      setBusy(false);
      setEditing(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this keyword entry?')) return;
    if (busy) return;
    setBusy(true);
    try {
      await deleteKeyword(id);
      await onUpdate();
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (!selectedNovel || !newEntry.src.trim()) return;
    if (busy) return;
    setBusy(true);
    try {
      await addKeyword(selectedNovel, {
        src: newEntry.src.trim(),
        dst: newEntry.dst.trim(),
        info: newEntry.info.trim(),
      });
      await onUpdate();
      setNewEntry({ src: '', dst: '', info: '' });
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        {selectedNovel && (
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            &larr; Novels
          </button>
        )}
        <span className="text-sm text-gray-500 truncate">
          {selectedNovel ? `Keywords for ${selectedNovel}` : 'Select a novel'}
        </span>
      </div>

      {!selectedNovel && <p className="text-sm text-gray-600">Select a novel to view its keywords.</p>}

      {selectedNovel && (
        <>
          <div className="mb-4">
            <button
              onClick={() => setAdding(!adding)}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20 hover:bg-blue-400/20 transition-colors"
            >
              {adding ? 'Cancel' : '+ Add keyword'}
            </button>
          </div>

          {adding && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 gap-2 mb-2">
                <input
                  type="text"
                  className="input text-xs py-1.5"
                  placeholder="Source"
                  value={newEntry.src}
                  onInput={(e) => setNewEntry({ ...newEntry, src: (e.target as HTMLInputElement).value })}
                />
                <input
                  type="text"
                  className="input text-xs py-1.5"
                  placeholder="Translation"
                  value={newEntry.dst}
                  onInput={(e) => setNewEntry({ ...newEntry, dst: (e.target as HTMLInputElement).value })}
                />
                <input
                  type="text"
                  className="input text-xs py-1.5"
                  placeholder="Context"
                  value={newEntry.info}
                  onInput={(e) => setNewEntry({ ...newEntry, info: (e.target as HTMLInputElement).value })}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={busy || !newEntry.src.trim()}
                  className="px-3 py-1 rounded-md text-xs font-medium text-gray-900 bg-gray-100 hover:bg-white transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="px-3 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {keywords.length === 0 && <p className="text-sm text-gray-600">No keywords extracted yet.</p>}

          {keywords.length > 0 && (
            <div className="space-y-2">
              {keywords.map((kw) => {
                const isEditing = editing === kw.id;
                return (
                  <div
                    key={kw.id}
                    className={`bg-gray-800/40 border ${isEditing ? 'border-blue-500/30' : 'border-gray-800'} rounded-lg p-3 transition-colors`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">
                              Source
                            </label>
                            <input
                              type="text"
                              className="input text-xs py-1"
                              value={editValues.src}
                              onInput={(e) =>
                                setEditValues({ ...editValues, src: (e.target as HTMLInputElement).value })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">
                              Translation
                            </label>
                            <input
                              type="text"
                              className="input text-xs py-1"
                              value={editValues.dst}
                              onInput={(e) =>
                                setEditValues({ ...editValues, dst: (e.target as HTMLInputElement).value })
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">
                            Context
                          </label>
                          <input
                            type="text"
                            className="input text-xs py-1"
                            value={editValues.info}
                            onInput={(e) =>
                              setEditValues({ ...editValues, info: (e.target as HTMLInputElement).value })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-gray-600">Ref: {kw.count}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(kw.id)}
                              disabled={busy}
                              className="px-2.5 py-1 rounded text-xs font-medium text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="px-2.5 py-1 rounded text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-mono text-gray-200 truncate">{kw.src}</span>
                            {kw.dst && <span className="text-sm text-gray-400">&rarr; {kw.dst}</span>}
                          </div>
                          {kw.info && <p className="text-xs text-gray-600 mt-0.5 truncate">{kw.info}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => startEdit(kw)}
                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-700/50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(kw.id ?? 0)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors px-1.5 py-0.5 rounded hover:bg-red-400/10"
                          >
                            Del
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
