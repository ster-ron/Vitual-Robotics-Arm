// src/components/CodeEditor/Editor.jsx
import Editor from '@monaco-editor/react';

function CodeEditor({ code, onChange, isRunning }) {
  return (
    <Editor
      height="100%"
      defaultLanguage="cpp"
      theme="vs-dark"
      value={code}
      onChange={onChange}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        automaticLayout: true,
        readOnly: isRunning,
        scrollbar: {
          vertical: 'visible',
          horizontal: 'visible',
        },
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: '400',
        tabSize: 2,
        insertSpaces: true,
      }}
    />
  );
}

export default CodeEditor;