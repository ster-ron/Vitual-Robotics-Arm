// App.jsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { Suspense } from 'react';
import RobotArm from './components/Scene3D/RobotArm';
import ArmControls from './components/Scene3D/ArmControls';

function App() {
  return (
    <div className="h-screen w-full bg-gradient-to-b from-gray-900 to-gray-700 relative">
      <Canvas 
        camera={{ position: [3, 3, 4], fov: 45 }}
        shadows
      >
        <Suspense fallback={null}>
          <Environment preset="warehouse" />
          
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight 
            position={[5, 10, 7]} 
            intensity={1} 
            castShadow 
            shadow-mapSize={1024}
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
  );
}

export default App;