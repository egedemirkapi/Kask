'use client';
import { useEffect, useState } from 'react';

export interface DnsLogEntry {
  domain: string;
  timestamp: string;
  status: string;
  device_name?: string;
}

interface DnsLogsState {
  enabled: boolean;
  logs: DnsLogEntry[];
  loading: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 5000;

export function useDnsLogs(roomCode: string, ipadMonitoringEnabled: boolean) {
  const [state, setState] = useState<DnsLogsState>({
    enabled: ipadMonitoringEnabled,
    logs: [],
    loading: ipadMonitoringEnabled,
    error: null,
  });

  useEffect(() => {
    if (!ipadMonitoringEnabled) {
      setState({ enabled: false, logs: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    async function fetchLogs() {
      try {
        const res = await fetch(`${apiUrl}/session/${roomCode}/dns/logs?limit=80`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setState({
          enabled: data.enabled,
          logs: data.logs || [],
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState(s => ({ ...s, loading: false, error: (e as Error).message }));
      }
    }

    fetchLogs();
    const interval = setInterval(fetchLogs, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomCode, ipadMonitoringEnabled]);

  return state;
}
