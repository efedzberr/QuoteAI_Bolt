import { useState, useCallback, useEffect } from 'react';

export interface DebugLog {
  id: string;
  timestamp: number;
  level: 'log' | 'error' | 'warn' | 'info';
  message: string;
  data?: any;
}

export function useDebugLogs() {
  const [logs, setLogs] = useState<DebugLog[]>([]);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const addLog = (level: DebugLog['level'], args: any[]) => {
      const message = args
        .map(arg => {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'object') return JSON.stringify(arg);
          return String(arg);
        })
        .join(' ');

      const data = args.length > 1 ? args.slice(1) : undefined;

      setLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          level,
          message,
          data: data?.length > 0 ? data : undefined,
        }
      ]);
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('log', args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('error', args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', args);
    };

    console.info = (...args) => {
      originalInfo(...args);
      addLog('info', args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    };
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, clearLogs };
}
