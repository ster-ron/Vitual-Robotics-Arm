// App.jsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, MeshReflectorMaterial } from '@react-three/drei';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import RobotArm from './components/Scene3D/RobotArm';
import ArmControls from './components/Scene3D/ArmControls';
import CodeEditor from './components/CodeEditor/Editor';
import ConsoleOutput from './components/Console/Output';
import { runArduinoCode, stopExecution, checkSyntax } from './simulation/interpreter';
import { runPythonCode, stopPythonExecution, checkPythonSyntax } from './simulation/pythonController';
import { examples } from './examples';
import { pythonExamples } from './examples/pythonExamples';

// Pulls a leading "Line N: " prefix off an error message (added by the
// engine) so we can point a Monaco marker at the right line instead of
// just dumping the whole error as unstructured text.
function parseLinedError(message) {
  const m = /^(?:Runtime error: |Compile error: )?Line (\d+): (.*)$/.exec(message);
  if (m) return { line: parseInt(m[1], 10), message: m[2] };
  return { line: 1, message };
}

function App() {
  const [lang, setLang] = useState('cpp'); // 'cpp' | 'python'

  const [cppExample, setCppExample] = useState('basic_sweep');
  const [cppCode, setCppCode] = useState(examples.basic_sweep);
  const [cppRunning, setCppRunning] = useState(false);

  const [pyExample, setPyExample] = useState('direct_control');
  const [pyCode, setPyCode] = useState(pythonExamples.direct_control);
  const [pyRunning, setPyRunning] = useState(false);

  const [messages, setMessages] = useState([]);
  const idRef = useRef(0);
  const cppEditorRef = useRef(null);
  const pyEditorRef = useRef(null);

  const log = useCallback((message, type = 'info', src) => {
    idRef.current += 1;
    setMessages((prev) => {
      const next = [...prev, { id: idRef.current, message: src ? `[${src}] ${message}` : message, type, timestamp: Date.now() }];
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  }, []);

  /* ---------------- Live syntax checking, as you type ---------------- */
  // Debounced so we're not re-parsing on every keystroke, and skipped
  // while that language is actively running (the run-time error marker
  // takes priority in that case).
  useEffect(() => {
    if (cppRunning) return;
    const t = setTimeout(() => {
      const result = checkSyntax(cppCode);
      cppEditorRef.current?.setErrors(result.ok ? [] : [{ line: result.line, message: result.message }]);
    }, 500);
    return () => clearTimeout(t);
  }, [cppCode, cppRunning]);

  useEffect(() => {
    if (pyRunning) return;
    const t = setTimeout(() => {
      const result = checkPythonSyntax(pyCode);
      pyEditorRef.current?.setErrors(result.ok ? [] : [{ line: result.line, message: result.message }]);
    }, 500);
    return () => clearTimeout(t);
  }, [pyCode, pyRunning]);

  /* ---------------- Run / stop ---------------- */
  const runCpp = useCallback(() => {
    setCppRunning(true);
    cppEditorRef.current?.setErrors([]);
    runArduinoCode(
      cppCode,
      (m, t) => log(m, t, 'cpp'),
      (err) => {
        setCppRunning(false);
        cppEditorRef.current?.setCurrentLine(null);
        if (err) {
          const { line, message } = parseLinedError(err.message);
          cppEditorRef.current?.setErrors([{ line, message }]);
        }
      },
      (line) => cppEditorRef.current?.setCurrentLine(line)
    );
  }, [cppCode, log]);

  const stopCpp = useCallback(() => {
    stopExecution();
    setCppRunning(false);
    cppEditorRef.current?.setCurrentLine(null);
    log('Stopped by user', 'warning', 'cpp');
  }, [log]);

  const runPy = useCallback(() => {
    setPyRunning(true);
    pyEditorRef.current?.setErrors([]);
    runPythonCode(
      pyCode,
      (m, t) => log(m, t, 'py'),
      (err) => {
        setPyRunning(false);
        pyEditorRef.current?.setCurrentLine(null);
        if (err) {
          const { line, message } = parseLinedError(err.message);
          pyEditorRef.current?.setErrors([{ line, message }]);
        }
      },
      (line) => pyEditorRef.current?.setCurrentLine(line)
    );
  }, [pyCode, log]);

  const stopPy = useCallback(() => {
    stopPythonExecution();
    setPyRunning(false);
    pyEditorRef.current?.setCurrentLine(null);
    log('Stopped by user', 'warning', 'py');
  }, [log]);

  const handleCppExampleChange = (key) => {
    if (cppRunning) stopCpp();
    setCppExample(key);
    setCppCode(examples[key]);
    cppEditorRef.current?.setErrors([]);
  };
  const handlePyExampleChange = (key) => {
    if (pyRunning) stopPy();
    setPyExample(key);
    setPyCode(pythonExamples[key]);
    pyEditorRef.current?.setErrors([]);
  };

  const isRunning = lang === 'cpp' ? cppRunning : pyRunning;
  const handleRun = lang === 'cpp' ? runCpp : runPy;
  const handleStop = lang === 'cpp' ? stopCpp : stopPy;

  return (
    <div className="h-screen w-full bg-gray-950 flex">
      {/* 3D viewport */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [3, 3, 4], fov: 45 }} shadows>
          <Suspense fallback={null}>
            <Environment preset="city" />

            {/* Three-point lighting: warm key light casting the shadows,
                cool dim fill to soften them, and a rim light behind the
                arm to separate its silhouette from the background. */}
            <ambientLight intensity={0.25} />
            <directionalLight
              position={[4, 7, 5]}
              intensity={1.4}
              color="#fff4e0"
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-4}
              shadow-camera-right={4}
              shadow-camera-top={4}
              shadow-camera-bottom={-4}
              shadow-bias={-0.0005}
            />
            <directionalLight position={[-4, 2, -2]} intensity={0.3} color="#7fb8ff" />
            <pointLight position={[-3, 3, -4]} intensity={0.6} color="#e8934a" />

            {/* Reflective floor, receiving real shadows from the light
                above — gives the metal/plastic materials something to
                actually reflect. Flat ambient light alone reads as toy
                plastic no matter how the materials are tuned. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
              <planeGeometry args={[30, 30]} />
              <MeshReflectorMaterial
                blur={[400, 100]}
                resolution={1024}
                mixBlur={1}
                mixStrength={35}
                roughness={1}
                depthScale={1}
                minDepthThreshold={0.85}
                color="#0a0c0f"
                metalness={0.4}
              />
            </mesh>
            <Grid
              position={[0, 0.002, 0]}
              args={[10, 10]}
              cellSize={0.5}
              cellThickness={0.6}
              cellColor="#3a4149"
              sectionSize={2}
              sectionThickness={1.2}
              sectionColor="#525b66"
              fadeDistance={12}
              fadeStrength={1.5}
            />
            <RobotArm />
            <OrbitControls minDistance={2} maxDistance={10} enablePan target={[0, 0.5, 0]} />
          </Suspense>
        </Canvas>
        <ArmControls />
      </div>

      {/* Code + console panel */}
      <div className="w-[500px] flex flex-col border-l border-gray-800 bg-gray-900">
        {/* Language tabs */}
        <div className="flex items-center border-b border-gray-800 shrink-0">
          <button
            onClick={() => setLang('cpp')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${lang === 'cpp' ? 'text-white border-orange-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
          >
            C++ Firmware {cppRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 ml-1 align-middle" />}
          </button>
          <button
            onClick={() => setLang('python')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${lang === 'python' ? 'text-white border-cyan-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
          >
            Python Controller {pyRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 ml-1 align-middle" />}
          </button>
        </div>

        {/* Example picker + run/stop */}
        <div className="flex items-center gap-2 p-2 border-b border-gray-800 shrink-0">
          {lang === 'cpp' ? (
            <select
              value={cppExample}
              onChange={(e) => handleCppExampleChange(e.target.value)}
              className="bg-gray-800 text-gray-200 text-sm rounded px-2 py-1.5 flex-1"
            >
              {Object.keys(examples).map((key) => (
                <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>
              ))}
            </select>
          ) : (
            <select
              value={pyExample}
              onChange={(e) => handlePyExampleChange(e.target.value)}
              className="bg-gray-800 text-gray-200 text-sm rounded px-2 py-1.5 flex-1"
            >
              {Object.keys(pythonExamples).map((key) => (
                <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>
              ))}
            </select>
          )}
          {!isRunning ? (
            <button
              onClick={handleRun}
              title="Run (Ctrl/Cmd + Enter)"
              className="px-4 py-1.5 text-sm font-semibold rounded bg-green-600 hover:bg-green-500 text-white transition"
            >
              ▶ Run
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-4 py-1.5 text-sm font-semibold rounded bg-red-600 hover:bg-red-500 text-white transition"
            >
              ■ Stop
            </button>
          )}
        </div>

        {/* Both editors stay mounted (just hidden) so switching tabs
            mid-run doesn't lose track of which editor a running
            program's debugger pointer/error markers belong to, and so
            scroll position/undo history survive tab switches. */}
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0" style={{ visibility: lang === 'cpp' ? 'visible' : 'hidden' }}>
            <CodeEditor
              ref={cppEditorRef}
              code={cppCode}
              language="cpp"
              onChange={(v) => setCppCode(v ?? '')}
              isRunning={cppRunning}
              onRun={runCpp}
            />
          </div>
          <div className="absolute inset-0" style={{ visibility: lang === 'python' ? 'visible' : 'hidden' }}>
            <CodeEditor
              ref={pyEditorRef}
              code={pyCode}
              language="python"
              onChange={(v) => setPyCode(v ?? '')}
              isRunning={pyRunning}
              onRun={runPy}
            />
          </div>
        </div>

        <div className="h-56 border-t border-gray-800 shrink-0">
          <ConsoleOutput messages={messages} onClear={() => setMessages([])} />
        </div>
      </div>
    </div>
  );
}

export default App;