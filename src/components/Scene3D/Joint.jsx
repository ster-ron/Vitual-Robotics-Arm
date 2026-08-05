// components/Scene3D/Joint.jsx
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { SphereGeometry, MeshStandardMaterial } from 'three';

function Joint({ 
  children, 
  angle = 0, 
  axis = 'y', 
  position = [0, 0, 0],
  limit = { min: -180, max: 180 },
  speed = 2,
  showAxis = false,
  ...props 
}) {
  const groupRef = useRef();
  const currentAngle = useRef(0);

  // Smooth interpolation
  useFrame((state, delta) => {
    if (groupRef.current) {
      // Smoothly interpolate to target angle
      const target = (angle * Math.PI) / 180;
      currentAngle.current += (target - currentAngle.current) * Math.min(1, delta * speed);
      
      // Apply rotation
      if (axis === 'x') groupRef.current.rotation.x = currentAngle.current;
      else if (axis === 'y') groupRef.current.rotation.y = currentAngle.current;
      else if (axis === 'z') groupRef.current.rotation.z = currentAngle.current;
    }
  });

  return (
    <group ref={groupRef} position={position} {...props}>
      {/* Joint visual indicator */}
      <mesh>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial 
          color="#95a5a6" 
          roughness={0.3} 
          metalness={0.6}
          emissive="#2c3e50"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Axis indicator ring */}
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.15, 0.18, 24]} />
        <meshStandardMaterial 
          color="#7f8c8d" 
          transparent 
          opacity={0.3}
          side={2}
        />
      </mesh>

      {children}
    </group>
  );
}

export default Joint;