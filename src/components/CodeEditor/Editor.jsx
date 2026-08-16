// src/components/CodeEditor/Editor.jsx
import Editor from '@monaco-editor/react';
import { forwardRef, useImperativeHandle, useRef } from 'react';

const CodeEditor = forwardRef(function CodeEditor(
  { code, onChange, isRunning, language = 'cpp', onRun },
  ref
) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const currentLineDecorations = useRef([]);

  useImperativeHandle(ref, () => ({
    // errors: array of { line, message }
    setErrors(errors) {
      const editor = editorRef.current, monaco = monacoRef.current;
      if (!editor || !monaco) return;
      const model = editor.getModel();
      if (!model) return;
      const markers = (errors || []).map((e) => ({
        severity: monaco.MarkerSeverity.Error,
        message: e.message,
        startLineNumber: e.line,
        startColumn: 1,
        endLineNumber: e.line,
        endColumn: model.getLineMaxColumn(e.line),
      }));
      monaco.editor.setModelMarkers(model, 'simulator', markers);
    },
    // Highlights the line about to execute — a live "you are here" pointer
    // while a program is running, like a debugger's current-line arrow.
    setCurrentLine(line) {
      const editor = editorRef.current;
      if (!editor) return;
      if (line == null) {
        currentLineDecorations.current = editor.deltaDecorations(currentLineDecorations.current, []);
        return;
      }
      currentLineDecorations.current = editor.deltaDecorations(currentLineDecorations.current, [
        {
          range: new monacoRef.current.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'exec-line-highlight',
            glyphMarginClassName: 'exec-line-glyph',
          },
        },
      ]);
    },
  }));

  return (
    <>
      <style>{`
        .exec-line-highlight { background: rgba(232, 147, 74, 0.16); }
        .exec-line-glyph::before {
          content: '▶';
          color: #e8934a;
          font-size: 11px;
          margin-left: 4px;
        }
      `}</style>
      <Editor
        height="100%"
        language={language}
        theme="vs-dark"
        value={code}
        onChange={onChange}
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          monacoRef.current = monaco;
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
          glyphMargin: true,
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
    </>
  );
});

export default CodeEditor;