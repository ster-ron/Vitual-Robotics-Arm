// App.jsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows } from '@react-three/drei';
import { Suspense, useCallback, useRef, useState } from 'react';
import RobotArm from './components/Scene3D/RobotArm';
import ArmControls from './components/Scene3D/ArmControls';
import CodeEditor from './components/CodeEditor/Editor';
import ConsoleOutput from './components/Console/Output';
import { runArduinoCode, stopExecution } from './simulation/interpreter';
import { runPythonCode, stopPythonExecution } from './simulation/pythonController';
import { examples } from './examples';
import { pythonExamples } from './examples/pythonExamples';

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

  const log = useCallback((message, type = 'info', src) => {
    idRef.current += 1;
    setMessages((prev) => {
      const next = [...prev, { id: idRef.current, message: src ? `[${src}] ${message}` : message, type, timestamp: Date.now() }];
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  }, []);

  const runCpp = useCallback(() => {
    setCppRunning(true);
    runArduinoCode(cppCode, (m, t) => log(m, t, 'cpp'), () => setCppRunning(false));
  }, [cppCode, log]);

  const stopCpp = useCallback(() => {
    stopExecution();
    setCppRunning(false);
    log('Stopped by user', 'warning', 'cpp');
  }, [log]);

  const runPy = useCallback(() => {
    setPyRunning(true);
    runPythonCode(pyCode, (m, t) => log(m, t, 'py'), () => setPyRunning(false));
  }, [pyCode, log]);

  const stopPy = useCallback(() => {
    stopPythonExecution();
    setPyRunning(false);
    log('Stopped by user', 'warning', 'py');
  }, [log]);

  const handleCppExampleChange = (key) => {
    if (cppRunning) stopCpp();
    setCppExample(key);
    setCppCode(examples[key]);
  };
  const handlePyExampleChange = (key) => {
    if (pyRunning) stopPy();
    setPyExample(key);
    setPyCode(pythonExamples[key]);
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
            <Environment preset="warehouse" />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 7]} intensity={1} castShadow shadow-mapSize={1024} />
            <pointLight position={[-5, 3, -5]} intensity={0.5} />
            <Grid
              position={[0, -0.5, 0]}
              args={[10, 10]}
              cellSize={0.5}
              cellThickness={1}
              cellColor="#6f6f6f"
              sectionSize={2}
              sectionThickness={2}
              sectionColor="#9d9d9d"
            />
            <RobotArm />
            <ContactShadows position={[0, -0.5, 0]} opacity={0.55} scale={10} blur={2.2} far={2} />
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

        <div className="flex-1 min-h-0">
          {lang === 'cpp' ? (
            <CodeEditor
              code={cppCode}
              language="cpp"
              onChange={(v) => setCppCode(v ?? '')}
              isRunning={cppRunning}
              onRun={runCpp}
            />
          ) : (
            <CodeEditor
              code={pyCode}
              language="python"
              onChange={(v) => setPyCode(v ?? '')}
              isRunning={pyRunning}
              onRun={runPy}
            />
          )}
        </div>

        <div className="h-56 border-t border-gray-800 shrink-0">
          <ConsoleOutput messages={messages} onClear={() => setMessages([])} />
        </div>
      </div>
    </div>
  );
}

export default App;