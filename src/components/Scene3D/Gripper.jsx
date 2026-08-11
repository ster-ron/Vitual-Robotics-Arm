// components/Scene3D/Gripper.jsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

function Gripper({ angle = 0, color = '#e74c3c', ...props }) {
  const leftFinger = useRef();
  const rightFinger = useRef();
  const currentOpen = useRef(0);

  useFrame((state, delta) => {
    // angle maps to gripper opening (0 = closed, 90 = open)
    const targetOpen = (angle / 90) * 0.15;
    currentOpen.current += (targetOpen - currentOpen.current) * Math.min(1, delta * 6);
    if (leftFinger.current && rightFinger.current) {
      leftFinger.current.position.x = -0.1 - currentOpen.current;
      rightFinger.current.position.x = 0.1 + currentOpen.current;
    }
  });

  return (
    <group {...props}>
      {/* Gripper base */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.15]} />
        <meshStandardMaterial color="#34495e" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Left finger */}
      <group ref={leftFinger}>
        <mesh position={[-0.1, -0.1, 0]} rotation={[0, 0, 0.1]} castShadow>
          <boxGeometry args={[0.04, 0.2, 0.04]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        <mesh position={[-0.1, -0.2, 0]} rotation={[0, 0, 0.2]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#e74c3c" roughness={0.8} />
        </mesh>
      </group>

      {/* Right finger */}
      <group ref={rightFinger}>
        <mesh position={[0.1, -0.1, 0]} rotation={[0, 0, -0.1]} castShadow>
          <boxGeometry args={[0.04, 0.2, 0.04]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        <mesh position={[0.1, -0.2, 0]} rotation={[0, 0, -0.2]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#e74c3c" roughness={0.8} />
        </mesh>
      </group>

      {/* Mounting plate */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.15, 0.02, 0.12]} />
        <meshStandardMaterial color="#95a5a6" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

export default Gripper;