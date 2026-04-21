'use client';
import { useState } from 'react';
import {
  Download,
  Smartphone,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
} from 'lucide-react';

interface Props {
  roomCode: string;
  enabled: boolean;
  onActivated?: () => void;
}

const STEPS = [
  'AirDrop or email this profile to each iPad.',
  'On the iPad, open Settings — a profile prompt appears.',
  'Tap Install (top right), enter the iPad passcode, then Install again.',
  'Done. Every site the iPad visits now appears in your dashboard.',
];

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function ActiveState({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);
  const downloadUrl = `${apiUrl}/session/${roomCode}/dns/profile.mobileconfig`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <ShieldCheck size={15} strokeWidth={2.25} className="text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight leading-tight">
              iPad setup
            </h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              One-time install per iPad. Removable from Settings anytime.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Active
        </span>
      </header>

      <div className="px-5 py-4 grid sm:grid-cols-[1fr_auto] gap-4 items-start">
        <ol className="space-y-2">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[12.5px] text-slate-700 leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-[10.5px] font-semibold inline-flex items-center justify-center mt-0.5 tabular">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 sm:items-end">
          <a
            href={downloadUrl}
            download={`ClassControl-${roomCode}.mobileconfig`}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download size={14} strokeWidth={2.25} /> Download profile
          </a>
          <button
            onClick={copyLink}
            className="inline-flex items-center justify-center gap-1.5 text-[12px] text-slate-600 hover:text-slate-900 px-2 py-1 rounded transition-colors"
          >
            {copied ? <><Check size={12} strokeWidth={2.5} /> Link copied</> : <><Copy size={12} strokeWidth={2.25} /> Copy link</>}
          </button>
        </div>
      </div>

      <footer className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex items-start gap-2">
        <Smartphone size={13} strokeWidth={2.25} className="text-slate-500 shrink-0 mt-0.5" />
        <p className="text-[11.5px] text-slate-500 leading-relaxed">
          Blocks distracting categories by default — across <em>every</em> app on the iPad, not just Safari. View live activity at <a className="underline hover:text-slate-700" href="https://my.nextdns.io" target="_blank" rel="noreferrer">my.nextdns.io</a>.
        </p>
      </footer>
    </section>
  );
}

function SetupForm({ roomCode, onActivated }: { roomCode: string; onActivated: () => void }) {
  const [profileId, setProfileId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const cleaned = profileId.trim().toLowerCase();
    if (!/^[a-z0-9]{6,12}$/.test(cleaned)) {
      setError('Profile ID is 6-12 letters/numbers (e.g. abc123).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/session/${roomCode}/dns/manual-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: cleaned }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server returned ${res.status}`);
      }
      onActivated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <header className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
          <KeyRound size={15} strokeWidth={2.25} className="text-slate-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight leading-tight">
            Connect NextDNS to enable iPad monitoring
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            Free. Takes one minute. No card required.
          </p>
        </div>
      </header>

      <div className="px-5 py-4 grid lg:grid-cols-[1fr_1fr] gap-5">
        <ol className="space-y-2.5">
          {[
            <>Open <a href="https://my.nextdns.io/start" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">my.nextdns.io/start <ExternalLink size={11} strokeWidth={2.25} /></a> and sign up (email only).</>,
            <>You&rsquo;ll land on a configuration page. The URL ends in <span className="mono bg-slate-100 px-1 py-0.5 rounded text-[11.5px]">/abc123</span> — that&rsquo;s your profile ID.</>,
            <>Paste it on the right and click <strong>Activate</strong>.</>,
          ].map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[12.5px] text-slate-700 leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-[10.5px] font-semibold inline-flex items-center justify-center mt-0.5 tabular">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 lg:border-l lg:border-slate-100 lg:pl-5">
          <label htmlFor="profile-id" className="text-[12px] font-medium text-slate-700">
            NextDNS profile ID
          </label>
          <input
            id="profile-id"
            value={profileId}
            onChange={e => setProfileId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="abc123"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 placeholder:text-slate-400 mono tracking-wider transition-colors"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
          />
          {error && (
            <p className="text-[12px] text-rose-600">{error}</p>
          )}
          <button
            onClick={submit}
            disabled={submitting || !profileId.trim()}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <><Loader2 size={14} strokeWidth={2.25} className="animate-spin" /> Activating…</> : <>Activate</>}
          </button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Your profile ID is public-safe — it just identifies which DNS rules to apply, not who you are.
          </p>
        </div>
      </div>
    </section>
  );
}

export function IpadSetup({ roomCode, enabled, onActivated }: Props) {
  const [activated, setActivated] = useState(enabled);
  if (activated) return <ActiveState roomCode={roomCode} />;
  return (
    <SetupForm
      roomCode={roomCode}
      onActivated={() => {
        setActivated(true);
        onActivated?.();
      }}
    />
  );
}
