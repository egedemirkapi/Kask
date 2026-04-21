'use client';
import { Student } from '@/hooks/useTeacherSession';
import { StudentCard } from './StudentCard';
import { Users } from 'lucide-react';

interface Props {
  students: Record<string, Student>;
  onMessage: (id: string) => void;
  onKick: (id: string) => void;
}

export function StudentGrid({ students, onMessage, onKick }: Props) {
  const list = Object.values(students);

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
          <Users size={20} strokeWidth={2} className="text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">Waiting for students</p>
          <p className="text-[12.5px] text-slate-500 mt-1">
            Share the room code or scan the QR to join.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
      {list.map(s => (
        <StudentCard key={s.id} student={s} onMessage={onMessage} onKick={onKick} />
      ))}
    </div>
  );
}
