'use client';
import { Student } from '@/hooks/useTeacherSession';
import { StudentCard } from './StudentCard';

interface Props {
  students: Record<string, Student>;
  onMessage: (id: string) => void;
  onKick: (id: string) => void;
}

export function StudentGrid({ students, onMessage, onKick }: Props) {
  const list = Object.values(students);

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
        <span className="text-5xl">🎓</span>
        <p className="text-sm">Waiting for students to join...</p>
        <p className="text-xs text-slate-300">Share the room code or QR to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
      {list.map(s => (
        <StudentCard key={s.id} student={s} onMessage={onMessage} onKick={onKick} />
      ))}
    </div>
  );
}
