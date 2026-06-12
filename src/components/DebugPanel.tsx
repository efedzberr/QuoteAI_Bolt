import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export interface DebugLog {
  id: string;
  timestamp: number;
  level: 'log' | 'error' | 'warn' | 'info';
  message: string;
  data?: any;
}

interface DebugPanelProps {
  logs: DebugLog[];
  onClear: () => void;
}

export default function DebugPanel({ logs, onClear }: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'warn':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-100 text-red-700';
      case 'warn':
        return 'bg-amber-100 text-amber-700';
      case 'info':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="mt-6 border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-300">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          Debug Logs ({logs.length})
        </button>
        <button
          onClick={onClear}
          className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Logs Container */}
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No logs yet...
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`px-4 py-3 border-l-4 ${getLevelColor(log.level)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${getLevelBadgeColor(log.level)}`}>
                      {log.level.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono break-words">{log.message}</p>
                      {log.data && (
                        <pre className="text-xs mt-1 bg-black bg-opacity-5 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                      <p className="text-xs mt-1 opacity-60">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
