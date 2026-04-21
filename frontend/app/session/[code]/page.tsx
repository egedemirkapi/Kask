'use client';
import { useState } from 'react';
import { useTeacherSession } from '@/hooks/useTeacherSession';
import { StudentGrid } from '@/components/StudentGrid';
import { ControlPanel } from '@/components/ControlPanel';
import { IpadSetup } from '@/components/IpadSetup';
import { LiveDnsLog } from '@/components/LiveDnsLog';
import {
  QrCode,
  Send,
  X,
  AlertTriangle,
  WifiOff,
  Smartphone,
  PowerOff,
  Users,
} from 'lucide-react';

interface Props { params: { code: string } }

function getQueryParam(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) || '';
}

export default function SessionPage({ params }: Props) {
  const { code } = params;
  const session = useTeacherSession(code);
  const [msgTarget, setMsgTarget] = useState<string | null>(null);
  const [msgText, setMsgText] = useState('');
  const [showQR, setShowQR] = useState(false);

  const qrDataUrl = getQueryParam('qr');
  const initialIpadEnabled = getQueryParam('ipad') === '1';
  const [ipadEnabled, setIpadEnabled] = useState(initialIpadEnabled);

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-5 h-14 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center">
            <span className="text-white font-semibold text-[12px] tracking-tight">CC</span>
          </div>
          <h1 className="text-[15px] font-semibold tracking-tight text-slate-900">ClassControl</h1>
        </div>

        <span className="h-5 w-px bg-slate-200 mx-1" />

        <button
          onClick={() => qrDataUrl && setShowQR(true)}
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors group"
          title="Show join QR"
        >
          <span className="mono text-[13px] font-semibold tracking-[0.18em] text-slate-900">{code}</span>
          <QrCode size={13} strokeWidth={2.25} className="text-slate-500 group-hover:text-slate-700" />
        </button>

        <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
          <Users size={12} strokeWidth={2.25} className="text-slate-400" />
          <span className="tabular">{session.studentCount}</span>
          <span className="text-slate-400">connected</span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2 py-0.5 rounded-full border ${
              session.connected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${session.connected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            {session.connected ? 'Live' : 'Reconnecting'}
          </span>
          <button
            onClick={() => {
              if (confirm('End the session for everyone?')) {
                session.endSession();
                window.location.href = '/';
              }
            }}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-md hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 transition-colors"
          >
            <PowerOff size={13} strokeWidth={2.25} /> End session
          </button>
        </div>
      </header>

      {/* ── Body: 3-column grid ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[280px] shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <ControlPanel
            onSetWhitelist={session.setWhitelist}
            onLockUrl={session.lockUrl}
            onBroadcast={session.broadcastMessage}
          />
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 max-w-[1600px] mx-auto">
            {/* iPad row */}
            <div className="grid lg:grid-cols-[1fr_440px] gap-4 mb-5">
              <IpadSetup
                roomCode={code}
                enabled={ipadEnabled}
                onActivated={() => setIpadEnabled(true)}
              />
              <LiveDnsLog roomCode={code} ipadMonitoringEnabled={ipadEnabled} />
            </div>

            {/* Students */}
            <section>
              <div className="flex items-baseline justify-between mb-3 px-0.5">
                <h2 className="text-[13px] font-semibold text-slate-900 tracking-tight uppercase">
                  Students
                </h2>
                <span className="text-[11.5px] text-slate-500 tabular">
                  {Object.keys(session.students).length} total
                </span>
              </div>
              <div className="min-h-[260px]">
                <StudentGrid
                  students={session.students}
                  onMessage={setMsgTarget}
                  onKick={session.kick}
                />
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* ── Per-student message modal ─────────────────────── */}
      {msgTarget && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => { setMsgTarget(null); setMsgText(''); }}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Send message
              </h3>
              <button
                onClick={() => { setMsgTarget(null); setMsgText(''); }}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                aria-label="Close"
              >
                <X size={14} strokeWidth={2.25} />
              </button>
            </header>
            <div className="px-5 py-4">
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md resize-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 placeholder:text-slate-400 transition-colors"
                rows={3}
                placeholder="Open page 47 in your textbook."
                autoFocus
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setMsgTarget(null); setMsgText(''); }}
                  className="flex-1 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (msgText.trim()) {
                      session.sendMessage(msgTarget, msgText.trim());
                      setMsgTarget(null);
                      setMsgText('');
                    }
                  }}
                  disabled={!msgText.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={13} strokeWidth={2.25} /> Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QR modal ────────────────────────────────────────── */}
      {showQR && qrDataUrl && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 w-full max-w-xs p-6 text-center shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Scan to join</h3>
            <p className="text-[12px] text-slate-500 mt-1">
              Room <span className="mono font-semibold text-slate-700 tracking-widest">{code}</span>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={decodeURIComponent(qrDataUrl)}
              alt="Join QR code"
              className="w-48 h-48 mx-auto mt-4 rounded-md border border-slate-200"
            />
            <button
              onClick={() => setShowQR(false)}
              className="mt-5 text-[12.5px] text-slate-500 hover:text-slate-900 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Alert toasts ───────────────────────────────────── */}
      <div className="fixed top-3 right-4 flex flex-col gap-1.5 z-40 pointer-events-none">
        {session.alerts.map(a => {
          const Icon = a.type === 'offline' ? WifiOff : a.type === 'app' ? Smartphone : AlertTriangle;
          const tone =
            a.type === 'offline'
              ? 'bg-white border-rose-200 text-rose-700'
              : a.type === 'app'
              ? 'bg-white border-violet-200 text-violet-700'
              : 'bg-white border-amber-200 text-amber-700';
          return (
            <div
              key={a.id}
              className={`inline-flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-md border shadow-sm text-[12.5px] font-medium ${tone}`}
            >
              <Icon size={13} strokeWidth={2.25} />
              <span>{a.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
