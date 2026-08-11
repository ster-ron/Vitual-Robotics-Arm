// src/components/Console/Output.jsx
import { useEffect, useRef } from 'react';

function ConsoleOutput({ messages, onClear }) {
  const containerRef = useRef();

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const getColor = (type) => {
    switch(type) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      case 'serial': return 'text-cyan-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-gray-300';
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-800 shrink-0">
        <span className="text-[11px] uppercase tracking-wide text-gray-500 font-mono">Console</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-600 font-mono">{messages.length}</span>
          {onClear && (
            <button
              onClick={onClear}
              className="text-[11px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-gray-800 transition"
              title="Clear console"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto p-3 font-mono text-sm">
        {messages.length === 0 ? (
          <div className="text-gray-500 italic flex items-center justify-center h-full">
            Console output will appear here...
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id ?? `${msg.timestamp}-${msg.message}`} className={`${getColor(msg.type)} whitespace-pre-wrap`}>
              <span className="opacity-50 mr-2">[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
              <span className="mr-1">{getIcon(msg.type)}</span>
              {msg.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ConsoleOutput;