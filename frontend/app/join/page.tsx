'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function requestNotifPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function fireNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.png', tag: 'classcontrol-msg' });
  }
}

function JoinContent() {
  const params = useSearchParams();
  const [name, setName] = useState('');
  const [code, setCode] = useState(params.get('code')?.toUpperCase() || '');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'kicked'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  // Detect when student leaves — switches app, switches tab, navigates away
  useEffect(() => {
    let switched = false;

    const onVisibility = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (document.visibilityState === 'hidden') {
        switched = true;
        wsRef.current.send(JSON.stringify({ type: 'TAB_SWITCHED', timestamp: Date.now() }));
      } else if (switched) {
        // only restore if we actually reported a switch — prevents iOS false-restore quirk
        switched = false;
        wsRef.current.send(JSON.stringify({ type: 'TAB_RESTORED' }));
      }
    };

    // pagehide fires when student types a new URL in the same tab (visibilitychange doesn't)
    const onPageHide = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(JSON.stringify({ type: 'TAB_SWITCHED', timestamp: Date.now() }));
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  const join = async () => {
    if (!name.trim()) { setErrorMsg('Enter your name'); return; }
    if (code.length !== 6) { setErrorMsg('Code must be 6 characters'); return; }

    setStatus('connecting');
    setErrorMsg('');

    // Request OS notification permission when student joins
    requestNotifPermission();

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const ws = new WebSocket(`${wsUrl}/ws/student/${code}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'JOINED', name: name.trim(), device: 'safari' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'SESSION_RULES') {
          setStatus('connected');
          if (data.rules?.locked_url) window.location.href = data.rules.locked_url;
        } else if (data.type === 'LOCK_URL' && data.url) {
          window.location.href = data.url;
        } else if (data.type === 'MESSAGE') {
          // Fire OS notification — works even when screen is off / app is backgrounded
          fireNotification('📢 Message from Teacher', data.text);
          setMessages(m => [...m.slice(-4), data.text]);
          setTimeout(() => setMessages(m => m.slice(1)), 8000);
        } else if (data.type === 'KICKED') {
          fireNotification('ClassControl', 'Your teacher has removed you from the session.');
          setStatus('kicked');
          ws.close();
        } else if (data.type === 'SESSION_ENDED') {
          fireNotification('ClassControl', 'The session has ended.');
          setStatus('idle');
          setMessages([]);
          ws.close();
        }
      } catch {}
    };

    ws.onclose = () => {
      if (status === 'connecting') {
        setStatus('idle');
        setErrorMsg('Could not connect. Check the room code.');
      }
    };
  };

  if (status === 'kicked') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl">🚫</div>
        <h1 className="text-xl font-bold text-slate-800">You&apos;ve been removed</h1>
        <p className="text-slate-500 text-sm">Your teacher ended your session access.</p>
        <button onClick={() => setStatus('idle')} className="text-blue-600 text-sm underline">
          Try joining again
        </button>
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl">✅</div>
        <h1 className="text-xl font-bold text-slate-800">You&apos;re in!</h1>
        <p className="text-slate-500 text-sm">Session <strong>{code}</strong> — stay on this page</p>
        <p className="text-xs text-slate-300">Your teacher can see when you switch away</p>
        {messages.map((m, i) => (
          <div key={i} className="w-full max-w-sm bg-blue-600 text-white px-4 py-3 rounded-2xl text-sm shadow-lg">
            📢 {m}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6">
        <div className="text-4xl mb-3 text-center">🎓</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1 text-center">Join Session</h1>
        <p className="text-slate-400 text-sm mb-6 text-center">Enter your details to connect</p>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className="w-full p-3 border border-slate-200 rounded-xl mb-3 text-sm outline-none focus:border-blue-400"
          maxLength={30}
        />
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Room code (e.g. ABC123)"
          className="w-full p-3 border border-slate-200 rounded-xl mb-4 text-sm font-mono tracking-widest text-center outline-none focus:border-blue-400"
          maxLength={6}
        />

        {errorMsg && <p className="text-red-500 text-sm mb-3 text-center">{errorMsg}</p>}

        <button
          onClick={join}
          disabled={status === 'connecting'}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-2xl text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {status === 'connecting' ? 'Connecting...' : 'Join Session'}
        </button>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinContent />
    </Suspense>
  );
}
