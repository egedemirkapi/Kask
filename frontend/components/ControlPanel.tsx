'use client';
import { useState } from 'react';
import { Lock, Unlock, Globe, Send, Plus, X, Smartphone, Laptop, type LucideIcon } from 'lucide-react';

interface Props {
  onSetWhitelist: (urls: string[]) => void;
  onLockUrl: (url: string | null) => void;
  onBroadcast: (text: string) => void;
}

function PlatformBadge({ ipad, laptop, label }: { ipad?: boolean; laptop?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      {ipad && <Smartphone size={11} strokeWidth={2.25} className="text-slate-500" />}
      {laptop && <Laptop size={11} strokeWidth={2.25} className="text-slate-500" />}
      <span className="tracking-tight">{label}</span>
    </span>
  );
}

function SectionHeader({ icon: Icon, title, badges }: { icon: LucideIcon; title: string; badges: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon size={14} strokeWidth={2.25} className="text-slate-700" />
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
      </div>
      <div className="flex items-center gap-2">{badges}</div>
    </div>
  );
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
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Lock to URL */}
      <section className="px-5 py-5 border-b border-slate-100">
        <SectionHeader
          icon={Lock}
          title="Lock to URL"
          badges={<PlatformBadge ipad laptop label="iPad + Laptop" />}
        />
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          Force-redirects every student to a single page. Most reliable across all devices.
        </p>
        <input
          value={lockUrl}
          onChange={e => setLockUrl(e.target.value)}
          placeholder="https://classroom.google.com"
          disabled={isLocked}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md mb-2 disabled:bg-slate-50 disabled:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 placeholder:text-slate-400 transition-colors"
        />
        <button
          onClick={toggleLock}
          className={`w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-md transition-colors ${
            isLocked
              ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {isLocked ? <><Unlock size={14} strokeWidth={2.25} /> Unlock students</> : <><Lock size={14} strokeWidth={2.25} /> Lock all students</>}
        </button>
      </section>

      {/* Whitelist */}
      <section className="px-5 py-5 border-b border-slate-100">
        <SectionHeader
          icon={Globe}
          title="Allowed sites"
          badges={<PlatformBadge laptop label="Chrome only" />}
        />
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          Block all sites except these on student laptops. iPads use the iPad Setup panel instead.
        </p>
        <div className="flex gap-1.5 mb-2">
          <input
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDomain()}
            placeholder="khanacademy.org"
            className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 placeholder:text-slate-400 transition-colors"
          />
          <button
            onClick={addDomain}
            className="inline-flex items-center justify-center w-9 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors"
            aria-label="Add domain"
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>
        <ul className="space-y-1 mt-2">
          {whitelist.map(d => (
            <li
              key={d}
              className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50 rounded-md text-sm border border-slate-100"
            >
              <span className="text-slate-700 truncate mono text-[13px]">{d}</span>
              <button
                onClick={() => removeDomain(d)}
                className="text-slate-400 hover:text-slate-700 ml-2 shrink-0 p-0.5 rounded transition-colors"
                aria-label={`Remove ${d}`}
              >
                <X size={13} strokeWidth={2.25} />
              </button>
            </li>
          ))}
        </ul>
        {whitelist.length > 0 && (
          <button
            onClick={() => { setWhitelist([]); onSetWhitelist([]); }}
            className="text-xs text-slate-500 hover:text-slate-900 mt-3 transition-colors"
          >
            Clear all restrictions
          </button>
        )}
      </section>

      {/* Broadcast */}
      <section className="px-5 py-5">
        <SectionHeader
          icon={Send}
          title="Send a message"
          badges={<PlatformBadge ipad laptop label="All devices" />}
        />
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          Sends an OS notification to every connected student.
        </p>
        <textarea
          value={broadcastText}
          onChange={e => setBroadcastText(e.target.value)}
          placeholder="Open page 47 in your textbook."
          rows={3}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md resize-none mb-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 placeholder:text-slate-400 transition-colors"
        />
        <button
          onClick={() => {
            if (broadcastText.trim()) {
              onBroadcast(broadcastText.trim());
              setBroadcastText('');
            }
          }}
          disabled={!broadcastText.trim()}
          className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={14} strokeWidth={2.25} /> Send to all
        </button>
      </section>
    </div>
  );
}
