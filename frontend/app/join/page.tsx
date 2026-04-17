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
  const [showShortcutSetup, setShowShortcutSetup] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  // Page Visibility API — detects app/tab switches on iPad and desktop Safari
  useEffect(() => {
    const handler = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (document.visibilityState === 'hidden') {
        wsRef.current.send(JSON.stringify({ type: 'TAB_SWITCHED', timestamp: Date.now() }));
      } else {
        wsRef.current.send(JSON.stringify({ type: 'TAB_RESTORED' }));
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
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

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://kask.onrender.com';
  const shortcutPayloadOpen = JSON.stringify({ room_code: code, student_name: name, app: 'APP_NAME', event: 'opened' }, null, 2);
  const shortcutPayloadClose = JSON.stringify({ room_code: code, student_name: name, app: 'APP_NAME', event: 'closed' }, null, 2);

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

        {/* iOS App Monitoring Setup */}
        <div className="w-full max-w-sm">
          <button
            onClick={() => setShowShortcutSetup(s => !s)}
            className="w-full text-sm py-2.5 px-4 bg-purple-50 text-purple-700 rounded-2xl border border-purple-200 font-medium hover:bg-purple-100 transition-colors"
          >
            📲 {showShortcutSetup ? 'Hide' : 'Set up'} iPad App Monitoring
          </button>

          {showShortcutSetup && (
            <div className="mt-3 bg-white rounded-2xl border border-purple-100 p-4 text-sm text-slate-700 space-y-3">
              <p className="font-semibold text-purple-700">Let your teacher see which apps you&apos;re using</p>
              <ol className="list-decimal list-inside space-y-2 text-slate-600">
                <li>Open the <strong>Shortcuts</strong> app on your iPad</li>
                <li>Tap <strong>Automation</strong> → <strong>+</strong> → <strong>App</strong></li>
                <li>Choose an app (e.g. Notability), tick <strong>Opens</strong> and <strong>Closes</strong></li>
                <li>Add action: <strong>Get Contents of URL</strong></li>
                <li>Set URL to: <code className="bg-slate-100 px-1 rounded text-xs break-all">{apiBase}/app-event</code></li>
                <li>Method: <strong>POST</strong>, Body: <strong>JSON</strong></li>
                <li>For <em>Opens</em>, paste this body (replace APP_NAME with the actual app name):</li>
              </ol>
              <pre className="bg-slate-100 rounded-lg p-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">{shortcutPayloadOpen}</pre>
              <p className="text-slate-500 text-xs">For <em>Closes</em>, use the same but with <code className="bg-slate-100 px-1 rounded">&#34;event&#34;: &#34;closed&#34;</code></p>
              <p className="text-slate-400 text-xs">Repeat for each app you use in class. Your name and room code are already filled in above.</p>
            </div>
          )}
        </div>
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
