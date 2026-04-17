'use client';
import { useState } from 'react';
import { useTeacherSession } from '@/hooks/useTeacherSession';
import { StudentGrid } from '@/components/StudentGrid';
import { ControlPanel } from '@/components/ControlPanel';

interface Props { params: { code: string } }

export default function SessionPage({ params }: Props) {
  const { code } = params;
  const session = useTeacherSession(code);
  const [msgTarget, setMsgTarget] = useState<string | null>(null);
  const [msgText, setMsgText] = useState('');
  const [showQR, setShowQR] = useState(false);
  const qrDataUrl = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('qr') || ''
    : '';

  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">🎓 ClassControl</h1>
        <div
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200"
          onClick={() => setShowQR(true)}
          title="Click to show QR code"
        >
          <span className="text-sm font-mono font-bold tracking-widest text-slate-700">{code}</span>
          <span className="text-xs text-slate-400">📷 QR</span>
        </div>
        <span className="text-sm text-slate-500">{session.studentCount} connected</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            session.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {session.connected ? '● Live' : '○ Reconnecting...'}
          </span>
          <button
            onClick={() => { session.endSession(); window.location.href = '/'; }}
            className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 border-r bg-white overflow-y-auto">
          <ControlPanel
            onSetWhitelist={session.setWhitelist}
            onLockUrl={session.lockUrl}
            onBroadcast={session.broadcastMessage}
          />
        </aside>
        <main className="flex-1 overflow-y-auto">
          <StudentGrid
            students={session.students}
            onMessage={setMsgTarget}
            onKick={session.kick}
          />
        </main>
      </div>

      {/* Per-student message modal */}
      {msgTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-5 w-80 shadow-2xl">
            <h3 className="font-semibold text-slate-800 mb-3">Send Message</h3>
            <textarea
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2 text-sm resize-none outline-none focus:border-blue-400"
              rows={3}
              placeholder="Type your message..."
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  if (msgText.trim()) {
                    session.sendMessage(msgTarget, msgText.trim());
                    setMsgTarget(null);
                    setMsgText('');
                  }
                }}
                className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
              >
                Send
              </button>
              <button
                onClick={() => { setMsgTarget(null); setMsgText(''); }}
                className="flex-1 py-2 bg-slate-100 rounded-xl text-sm hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR modal */}
      {showQR && qrDataUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-2xl p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">Scan to Join</h3>
            <p className="text-sm text-slate-400 mb-4">Room code: <strong>{code}</strong></p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={decodeURIComponent(qrDataUrl)} alt="QR code" className="w-48 h-48 mx-auto" />
            <button onClick={() => setShowQR(false)} className="mt-4 text-sm text-slate-400 hover:text-slate-600">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Alert toasts */}
      <div className="fixed top-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {session.alerts.map(a => (
          <div
            key={a.id}
            className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right ${
              a.type === 'offline' ? 'bg-red-600 text-white' : 'bg-yellow-400 text-yellow-900'
            }`}
          >
            {a.type === 'offline' ? '🔴' : '⚠️'} {a.message}
          </div>
        ))}
      </div>
    </div>
  );
}
