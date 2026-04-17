'use client';
import { useState } from 'react';

interface Props {
  onSetWhitelist: (urls: string[]) => void;
  onLockUrl: (url: string | null) => void;
  onBroadcast: (text: string) => void;
}

export function ControlPanel({ onSetWhitelist, onLockUrl, onBroadcast }: Props) {
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [lockUrl, setLockUrl] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!d) return;
    const updated = [...whitelist, d];
    setWhitelist(updated);
    setNewDomain('');
    onSetWhitelist(updated);
  };

  const removeDomain = (d: string) => {
    const updated = whitelist.filter(x => x !== d);
    setWhitelist(updated);
    onSetWhitelist(updated);
  };

  const toggleLock = () => {
    if (isLocked) {
      setIsLocked(false);
      onLockUrl(null);
    } else if (lockUrl.trim()) {
      setIsLocked(true);
      onLockUrl(lockUrl.trim());
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 h-full overflow-y-auto">

      {/* Lock to URL */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">🔒 Lock to URL</h3>
        <input
          value={lockUrl}
          onChange={e => setLockUrl(e.target.value)}
          placeholder="https://..."
          disabled={isLocked}
          className="w-full text-sm p-2 border border-slate-200 rounded-lg mb-2 disabled:bg-slate-50 outline-none focus:border-blue-400"
        />
        <button
          onClick={toggleLock}
          className={`w-full text-sm py-2 rounded-lg font-medium transition-colors ${
            isLocked
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLocked ? '🔓 Unlock' : 'Lock All Students'}
        </button>
      </section>

      <div className="border-t border-slate-100" />

      {/* Whitelist */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">🌐 Allowed Sites</h3>
        <div className="flex gap-2 mb-2">
          <input
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDomain()}
            placeholder="e.g. khanacademy.org"
            className="flex-1 text-sm p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400"
          />
          <button
            onClick={addDomain}
            className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700"
          >
            +
          </button>
        </div>
        {whitelist.map(d => (
          <div key={d} className="flex items-center justify-between py-1.5 px-2 bg-slate-50 rounded-lg mb-1 text-sm">
            <span className="text-slate-700 truncate">{d}</span>
            <button onClick={() => removeDomain(d)} className="text-slate-400 hover:text-red-500 ml-2 shrink-0">✕</button>
          </div>
        ))}
        {whitelist.length > 0 && (
          <button
            onClick={() => { setWhitelist([]); onSetWhitelist([]); }}
            className="text-xs text-slate-400 hover:text-red-500 mt-1"
          >
            Clear all restrictions
          </button>
        )}
      </section>

      <div className="border-t border-slate-100" />

      {/* Broadcast */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">📢 Broadcast Message</h3>
        <textarea
          value={broadcastText}
          onChange={e => setBroadcastText(e.target.value)}
          placeholder="Message to all students..."
          rows={3}
          className="w-full text-sm p-2 border border-slate-200 rounded-lg resize-none mb-2 outline-none focus:border-blue-400"
        />
        <button
          onClick={() => {
            if (broadcastText.trim()) {
              onBroadcast(broadcastText.trim());
              setBroadcastText('');
            }
          }}
          className="w-full text-sm py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          Send to All
        </button>
      </section>
    </div>
  );
}
