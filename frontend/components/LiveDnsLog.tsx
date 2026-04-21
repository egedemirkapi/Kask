'use client';
import { useDnsLogs, type DnsLogEntry } from '@/hooks/useDnsLogs';
import { Activity, ShieldOff, Wifi } from 'lucide-react';

interface Props {
  roomCode: string;
  ipadMonitoringEnabled: boolean;
}

function formatTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function statusStyle(status: string) {
  switch (status) {
    case 'blocked':
      return { dot: 'bg-rose-500', label: 'Blocked', text: 'text-rose-700' };
    case 'allowed':
      return { dot: 'bg-emerald-500', label: 'Allowed', text: 'text-emerald-700' };
    default:
      return { dot: 'bg-slate-400', label: 'Default', text: 'text-slate-500' };
  }
}

function LogRow({ entry }: { entry: DnsLogEntry }) {
  const s = statusStyle(entry.status);
  return (
    <li className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-3 py-2 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden />
      <span className="text-[13px] text-slate-800 truncate mono">{entry.domain}</span>
      <span className={`text-[11px] ${s.text} tabular`}>{s.label}</span>
      <span className="text-[11px] text-slate-400 tabular">{formatTime(entry.timestamp)}</span>
    </li>
  );
}

export function LiveDnsLog({ roomCode, ipadMonitoringEnabled }: Props) {
  const { enabled, logs, loading, error } = useDnsLogs(roomCode, ipadMonitoringEnabled);

  return (
    <section className="bg-white border border-slate-200 rounded-lg flex flex-col min-h-[280px] max-h-[460px]">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity size={14} strokeWidth={2.25} className="text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">iPad activity</h3>
          {enabled && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400 tabular">{logs.length} events</span>
      </header>

      {!enabled && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-2">
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
            <ShieldOff size={16} strokeWidth={2.25} className="text-slate-400" />
          </div>
          <p className="text-[13px] font-medium text-slate-700">Activity feed unavailable</p>
          <p className="text-[12px] text-slate-500 max-w-xs">
            iPad monitoring needs the backend NextDNS integration to be configured.
          </p>
        </div>
      )}

      {enabled && loading && (
        <div className="flex-1 flex items-center justify-center text-[12px] text-slate-400">
          Loading activity…
        </div>
      )}

      {enabled && !loading && logs.length === 0 && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-2">
          <Wifi size={18} strokeWidth={2} className="text-slate-300" />
          <p className="text-[13px] font-medium text-slate-700">No iPad traffic yet</p>
          <p className="text-[12px] text-slate-500 max-w-xs">
            Once a student installs the profile and opens any site, you&rsquo;ll see it here in real time.
          </p>
        </div>
      )}

      {enabled && !loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-2">
          <p className="text-[13px] font-medium text-slate-700">Couldn&rsquo;t load activity</p>
          <p className="text-[12px] text-slate-500 mono">{error}</p>
        </div>
      )}

      {enabled && logs.length > 0 && (
        <ul className="flex-1 overflow-y-auto">
          {logs.map((entry, i) => (
            <LogRow key={`${entry.timestamp}-${entry.domain}-${i}`} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}
