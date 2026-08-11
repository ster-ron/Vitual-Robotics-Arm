// src/components/CodeEditor/Editor.jsx
import Editor from '@monaco-editor/react';

function CodeEditor({ code, onChange, isRunning, language = 'cpp', onRun }) {
  return (
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      value={code}
      onChange={onChange}
      onMount={(editor, monaco) => {
        if (onRun) {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRun());
        }
      }}
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
        tabSize: language === 'python' ? 4 : 2,
        insertSpaces: true,
      }}
    />
  );
}

export default CodeEditor;