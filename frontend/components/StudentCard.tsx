'use client';
import { Student } from '@/hooks/useTeacherSession';
import { Smartphone, Laptop, MessageSquare, UserMinus } from 'lucide-react';

const STATUS_CONFIG = {
  active: {
    dot: 'bg-emerald-500',
    label: 'Active',
    border: 'border-slate-200',
    accent: 'text-slate-600',
  },
  switched: {
    dot: 'bg-amber-500',
    label: 'Switched away',
    border: 'border-amber-300',
    accent: 'text-amber-700',
  },
  disconnected: {
    dot: 'bg-slate-400',
    label: 'Offline',
    border: 'border-slate-200',
    accent: 'text-slate-500',
  },
  in_app: {
    dot: 'bg-violet-500',
    label: 'In app',
    border: 'border-violet-300',
    accent: 'text-violet-700',
  },
} as const;

interface Props {
  student: Student;
  onMessage: (id: string) => void;
  onKick: (id: string) => void;
}

export function StudentCard({ student, onMessage, onKick }: Props) {
  const cfg = STATUS_CONFIG[student.status];
  const DeviceIcon = student.device === 'chrome' ? Laptop : Smartphone;
  const deviceLabel = student.device === 'chrome' ? 'Laptop' : 'iPad';
  const isOffline = student.status === 'disconnected';

  return (
    <article
      className={`group relative bg-white border rounded-lg p-3 transition-colors hover:border-slate-300 ${cfg.border} ${isOffline ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="relative shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[13px] font-semibold text-slate-700 tabular">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${cfg.dot}`}
            aria-label={cfg.label}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-medium text-slate-900 truncate leading-tight">
              {student.name}
            </h4>
            <DeviceIcon
              size={12}
              strokeWidth={2.25}
              className="text-slate-400 shrink-0"
              aria-label={deviceLabel}
            />
          </div>
          <p className={`text-[11.5px] mt-0.5 truncate ${cfg.accent}`}>
            {student.status === 'in_app' && student.current_app
              ? student.current_app
              : cfg.label}
          </p>
        </div>
      </div>

      {!isOffline && (
        <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMessage(student.id)}
            className="flex-1 inline-flex items-center justify-center gap-1 text-[11.5px] py-1.5 px-2 bg-slate-50 text-slate-700 rounded-md hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <MessageSquare size={11} strokeWidth={2.25} /> Message
          </button>
          <button
            onClick={() => onKick(student.id)}
            className="flex-1 inline-flex items-center justify-center gap-1 text-[11.5px] py-1.5 px-2 bg-white text-rose-700 rounded-md hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors"
          >
            <UserMinus size={11} strokeWidth={2.25} /> Kick
          </button>
        </div>
      )}
    </article>
  );
}
