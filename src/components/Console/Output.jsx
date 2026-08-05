// src/components/Console/Output.jsx
import { useEffect, useRef } from 'react';

function ConsoleOutput({ messages }) {
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
    <div 
      ref={containerRef}
      className="h-full overflow-auto p-3 font-mono text-sm"
    >
      {messages.length === 0 ? (
        <div className="text-gray-500 italic flex items-center justify-center h-full">
          Console output will appear here...
        </div>
      ) : (
        messages.map((msg, i) => (
          <div key={i} className={`${getColor(msg.type)} whitespace-pre-wrap`}>
            <span className="opacity-50 mr-2">[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
            <span className="mr-1">{getIcon(msg.type)}</span>
            {msg.message}
          </div>
        ))
      )}
    </div>
  );
}

export default ConsoleOutput;