'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const createSession = async () => {
    setLoading(true);
    setError('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/session/create`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      router.push(`/session/${data.room_code}?qr=${encodeURIComponent(data.qr_data_url)}`);
    } catch {
      setError('Could not create session. Is the backend running?');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="text-6xl mb-5">🎓</div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">ClassControl</h1>
        <p className="text-slate-500 mb-8">Keep students focused. One click to start.</p>
        <button
          onClick={createSession}
          disabled={loading}
          className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-2xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 transition-all hover:shadow-xl hover:-translate-y-0.5"
        >
          {loading ? 'Creating session...' : 'New Session →'}
        </button>
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        <p className="text-xs text-slate-300 mt-8">Students join via Chrome extension or /join</p>
      </div>
    </div>
  );
}
