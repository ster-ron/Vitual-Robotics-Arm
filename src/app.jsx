// App.jsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, SoftShadows } from '@react-three/drei';
import { Suspense, useState, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import RobotArm from './components/Scene3D/RobotArm';
import ArmControls from './components/Scene3D/ArmControls';
import CodeEditor from './components/CodeEditor/Editor';
import ConsoleOutput from './components/Console/Output';
import { runArduinoCode, stopExecution } from './simulation/interpreter';
import { examples } from './examples/index';

function App() {
  const [code, setCode] = useState(examples.basic_sweep);
  const [selectedExample, setSelectedExample] = useState('basic_sweep');
  const [messages, setMessages] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const runIdRef = useRef(0);

  const log = (message, type = 'info') => {
    setMessages((prev) => [...prev, { message, type, timestamp: Date.now() }]);
  };

  const handleRun = async () => {
    if (isRunning) return;
    const thisRun = ++runIdRef.current;
    setIsRunning(true);
    setMessages([]);
    log('▶️ Starting execution...', 'info');

    try {
      await runArduinoCode(code, log);
      if (runIdRef.current === thisRun) {
        log('✅ Execution finished', 'success');
      }
    } catch (error) {
      if (runIdRef.current === thisRun) {
        log(`❌ ${error.message}`, 'error');
      }
    } finally {
      if (runIdRef.current === thisRun) {
        setIsRunning(false);
      }
    }
  };

  const handleStop = () => {
    stopExecution();
  };

  const handleExampleChange = (key) => {
    setSelectedExample(key);
    setCode(examples[key]);
  };

  return (
    <div className="h-screen w-full bg-gray-900 flex">
      {/* Left: 3D Scene */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [3, 3, 4], fov: 45 }} shadows>
          <Suspense fallback={null}>
            <Environment preset="warehouse" />
            <SoftShadows size={20} samples={12} focus={0.6} />

            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight
              position={[5, 10, 7]}
              intensity={1.1}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={-0.0005}
              shadow-camera-left={-4}
              shadow-camera-right={4}
              shadow-camera-top={4}
              shadow-camera-bottom={-4}
            />
            <pointLight position={[-5, 3, -5]} intensity={0.5} />

            {/* Ground grid */}
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

            {/* The arm */}
            <RobotArm />

            <OrbitControls
              minDistance={2}
              maxDistance={10}
              enablePan={true}
              target={[0, 0.5, 0]}
            />
          </Suspense>
        </Canvas>

        {/* UI Overlay */}
        <ArmControls />
      </div>

      {/* Right: Code editor + console */}
      <div className="w-[480px] flex flex-col border-l border-gray-800 bg-gray-950">
        <div className="flex items-center justify-between gap-2 p-3 border-b border-gray-800">
          <select
            value={selectedExample}
            onChange={(e) => handleExampleChange(e.target.value)}
            disabled={isRunning}
            className="bg-gray-800 text-gray-200 text-sm rounded px-2 py-1.5 flex-1"
          >
            {Object.keys(examples).map((key) => (
              <option key={key} value={key}>
                {key.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {isRunning ? (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-1.5 rounded"
            >
              <Square size={14} /> Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-1.5 rounded"
            >
              <Play size={14} /> Run
            </button>
          )}
        </div>

        <div className="h-[55%] min-h-0">
          <CodeEditor code={code} onChange={setCode} isRunning={isRunning} />
        </div>

        <div className="h-[45%] min-h-0 border-t border-gray-800 bg-black/40">
          <ConsoleOutput messages={messages} />
        </div>
      </div>
    </div>
  );
}

export default App;