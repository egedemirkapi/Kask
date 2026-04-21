'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Laptop, Smartphone, ShieldCheck } from 'lucide-react';

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
      const params = new URLSearchParams({
        qr: data.qr_data_url,
        ipad: data.ipad_monitoring_enabled ? '1' : '0',
      });
      router.push(`/session/${data.room_code}?${params.toString()}`);
    } catch {
      setError('Could not create session. Is the backend running?');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-[radial-gradient(circle_at_top,_#eef2ff_0%,_#f7f7f8_55%)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-slate-500 mb-3">
            ClassControl
          </p>
          <h1 className="text-[34px] leading-tight font-semibold text-slate-900 tracking-tight text-balance">
            Keep the class on task.
          </h1>
          <p className="text-[15px] text-slate-500 mt-3 leading-relaxed text-balance">
            Real-time visibility across student laptops and iPads. No accounts, no installs for you.
          </p>
        </div>

        <button
          onClick={createSession}
          disabled={loading}
          className="group w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 text-white text-[15px] font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating session…' : (
            <>
              Start a new session
              <ArrowRight size={16} strokeWidth={2.25} className="transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        {error && (
          <p className="text-[13px] text-rose-600 mt-3 text-center">{error}</p>
        )}

        <ul className="mt-10 grid grid-cols-3 gap-3">
          {[
            { icon: Laptop, label: 'Chrome laptops', sub: 'Block & redirect' },
            { icon: Smartphone, label: 'iPad / Safari', sub: 'Domain visibility' },
            { icon: ShieldCheck, label: 'No login', sub: 'Ephemeral session' },
          ].map(({ icon: Icon, label, sub }) => (
            <li key={label} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
              <Icon size={16} strokeWidth={2.25} className="text-slate-700 mx-auto mb-1.5" />
              <p className="text-[12px] font-medium text-slate-800 leading-tight">{label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
