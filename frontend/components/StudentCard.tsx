'use client';
import { Student } from '@/hooks/useTeacherSession';

const STATUS_CONFIG = {
  active:       { dot: 'bg-green-500',  label: 'Active',       ring: 'ring-green-200',  bg: 'bg-white' },
  switched:     { dot: 'bg-yellow-400', label: 'Switched',     ring: 'ring-yellow-300', bg: 'bg-yellow-50' },
  disconnected: { dot: 'bg-red-500',    label: 'Disconnected', ring: 'ring-red-200',    bg: 'bg-red-50' },
  in_app:       { dot: 'bg-purple-500', label: 'In App',       ring: 'ring-purple-200', bg: 'bg-purple-50' }
};

const APP_EMOJIS: Record<string, string> = {
  'notability': '📝', 'goodnotes': '📓', 'google classroom': '📚',
  'safari': '🌐', 'instagram': '📸', 'tiktok': '🎵', 'youtube': '📺',
  'messages': '💬', 'snapchat': '👻', 'twitter': '🐦', 'x': '🐦',
  'chrome': '🌐', 'gmail': '📧', 'discord': '💬', 'spotify': '🎵'
};

function appEmoji(name: string): string {
  return APP_EMOJIS[name.toLowerCase()] ?? '📱';
}

interface Props {
  student: Student;
  onMessage: (id: string) => void;
  onKick: (id: string) => void;
}

export function StudentCard({ student, onMessage, onKick }: Props) {
  const cfg = STATUS_CONFIG[student.status];
  return (
    <div className={`p-3 rounded-xl border ring-1 ${cfg.ring} ${cfg.bg} flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
        <span className="font-medium text-sm truncate flex-1 text-slate-800">{student.name}</span>
        <span className="text-base" title={student.device === 'chrome' ? 'Laptop (Chrome)' : 'iPad (Safari)'}>
          {student.device === 'chrome' ? '💻' : '📱'}
        </span>
      </div>
      <div className="text-xs text-slate-400">
        {student.status === 'in_app' && student.current_app
          ? <span className="font-medium text-purple-600">{appEmoji(student.current_app)} {student.current_app}</span>
          : cfg.label}
      </div>
      {student.status !== 'disconnected' && (
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => onMessage(student.id)}
            className="flex-1 text-xs py-1 px-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
          >
            Message
          </button>
          <button
            onClick={() => onKick(student.id)}
            className="flex-1 text-xs py-1 px-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors"
          >
            Kick
          </button>
        </div>
      )}
    </div>
  );
}
