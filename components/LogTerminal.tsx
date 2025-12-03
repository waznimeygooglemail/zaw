import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogTerminalProps {
  logs: LogEntry[];
}

export const LogTerminal: React.FC<LogTerminalProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-black rounded-lg border border-gray-700 font-mono text-xs md:text-sm overflow-hidden shadow-inner">
      <div className="bg-gray-800 px-3 py-1 text-gray-400 text-xs flex justify-between items-center border-b border-gray-700">
        <span><i className="fas fa-terminal mr-2"></i>PROCESS LOGS</span>
        <span className="text-green-500 animate-pulse">● LIVE</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
        {logs.length === 0 && <span className="text-gray-600 italic">Ready to initialize...</span>}
        {logs.map((log) => (
          <div key={log.id} className="break-all">
            <span className="text-gray-500">[{log.timestamp}]</span>{' '}
            <span
              className={`
                ${log.type === 'success' ? 'text-green-400 font-bold' : ''}
                ${log.type === 'error' ? 'text-red-400' : ''}
                ${log.type === 'debug' ? 'text-blue-400' : ''}
                ${log.type === 'info' ? 'text-gray-300' : ''}
              `}
            >
              {log.type === 'success' ? '>> ' : ''}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
