'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

export interface Student {
  id: string;
  name: string;
  device: 'chrome' | 'safari';
  status: 'active' | 'switched' | 'disconnected' | 'in_app';
  last_url?: string;
  switched_at?: number;
  current_app?: string;
}

interface SessionRules {
  whitelist: string[];
  locked_url: string | null;
}

interface SessionState {
  students: Record<string, Student>;
  rules: SessionRules;
  connected: boolean;
}

export interface Alert {
  id: string;
  message: string;
  type: 'switched' | 'offline' | 'app';
}

export function useTeacherSession(roomCode: string) {
  const [state, setState] = useState<SessionState>({
    students: {},
    rules: { whitelist: [], locked_url: null },
    connected: false
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const addAlert = useCallback((message: string, type: Alert['type']) => {
    const id = Math.random().toString(36).slice(2);
    setAlerts(a => [...a.slice(-4), { id, message, type }]);
    setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 5000);
  }, []);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string;

    if (type === 'SESSION_STATE') {
      const students = data.students as Student[];
      setState(s => ({
        ...s,
        students: Object.fromEntries(students.map(st => [st.id, st])),
        rules: data.rules as SessionRules
      }));
    } else if (type === 'STUDENT_JOINED') {
      const student = data.student as Student;
      setState(s => ({ ...s, students: { ...s.students, [student.id]: student } }));
    } else if (type === 'STUDENT_DISCONNECTED') {
      const sid = data.student_id as string;
      const name = data.name as string;
      setState(s => {
        const students = { ...s.students };
        if (students[sid]) students[sid] = { ...students[sid], status: 'disconnected' };
        return { ...s, students };
      });
      addAlert(`${name} disconnected`, 'offline');
    } else if (type === 'STUDENT_SWITCHED') {
      const sid = data.student_id as string;
      const name = data.name as string;
      setState(s => ({
        ...s,
        students: {
          ...s.students,
          [sid]: { ...s.students[sid], status: 'switched', switched_at: data.timestamp as number }
        }
      }));
      addAlert(`${name} switched screens`, 'switched');
    } else if (type === 'STUDENT_RESTORED') {
      const sid = data.student_id as string;
      setState(s => ({
        ...s,
        students: { ...s.students, [sid]: { ...s.students[sid], status: 'active' } }
      }));
    } else if (type === 'STUDENT_APP_EVENT') {
      const sid = data.student_id as string;
      const app = data.app as string;
      const event = data.event as string;
      const name = data.name as string;
      setState(s => ({
        ...s,
        students: {
          ...s.students,
          [sid]: {
            ...s.students[sid],
            status: event === 'opened' ? 'in_app' : 'active',
            current_app: event === 'opened' ? app : undefined
          }
        }
      }));
      if (event === 'opened') addAlert(`${name} opened ${app}`, 'app');
    } else if (type === 'STUDENT_WORKING') {
      const sid = data.student_id as string;
      setState(s => ({
        ...s,
        students: { ...s.students, [sid]: { ...s.students[sid], status: 'active' } }
      }));
    }
  }, [addAlert]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const ws = new WebSocket(`${wsUrl}/ws/teacher/${roomCode}`);
    wsRef.current = ws;

    ws.onopen = () => setState(s => ({ ...s, connected: true }));
    ws.onclose = () => setState(s => ({ ...s, connected: false }));
    ws.onmessage = (event) => {
      try { handleMessage(JSON.parse(event.data)); } catch {}
    };

    return () => ws.close();
  }, [roomCode, handleMessage]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const activeStudents = Object.values(state.students).filter(s => s.status !== 'disconnected');

  return {
    ...state,
    alerts,
    studentCount: activeStudents.length,
    setWhitelist: (urls: string[]) => send({ type: 'SET_WHITELIST', urls }),
    lockUrl: (url: string | null) => send({ type: 'LOCK_URL', url }),
    sendMessage: (student_id: string, text: string) => send({ type: 'SEND_MESSAGE', student_id, text }),
    broadcastMessage: (text: string) => send({ type: 'BROADCAST_MSG', text }),
    kick: (student_id: string) => send({ type: 'KICK', student_id }),
    endSession: () => send({ type: 'END_SESSION' })
  };
}
