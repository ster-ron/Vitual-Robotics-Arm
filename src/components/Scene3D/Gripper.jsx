// components/Scene3D/Gripper.jsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const BOLT_POSITIONS = [
  [-0.07, 0.055, -0.05],
  [0.07, 0.055, -0.05],
  [-0.07, 0.055, 0.05],
  [0.07, 0.055, 0.05],
];

function Gripper({ angle = 0, color = '#c0392b', ...props }) {
  const leftFinger = useRef();
  const rightFinger = useRef();
  const currentOpen = useRef(0);

  useFrame((_state, delta) => {
    // Angle maps to gripper opening (0 = closed, 90 = open)
    const targetOpen = (angle / 90) * 0.15;
    currentOpen.current += (targetOpen - currentOpen.current) * Math.min(1, delta * 8);

    if (leftFinger.current && rightFinger.current) {
      leftFinger.current.position.x = -0.1 - currentOpen.current;
      rightFinger.current.position.x = 0.1 + currentOpen.current;
    }
  });

  return (
    <group {...props}>
      {/* Gripper base */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.1, 0.15]} />
        <meshStandardMaterial color="#232a30" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Mounting bolts */}
      {BOLT_POSITIONS.map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.015, 6]} />
          <meshStandardMaterial color="#0d0f11" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}

      {/* Left finger */}
      <group ref={leftFinger}>
        <mesh position={[-0.1, -0.1, 0]} rotation={[0, 0, 0.1]} castShadow>
          <boxGeometry args={[0.04, 0.2, 0.04]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
        </mesh>
        {/* Finger tip */}
        <mesh position={[-0.1, -0.2, 0]} rotation={[0, 0, 0.2]} castShadow>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#8f291c" roughness={0.75} />
        </mesh>
      </group>

      {/* Right finger */}
      <group ref={rightFinger}>
        <mesh position={[0.1, -0.1, 0]} rotation={[0, 0, -0.1]} castShadow>
          <boxGeometry args={[0.04, 0.2, 0.04]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0.1, -0.2, 0]} rotation={[0, 0, -0.2]} castShadow>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#8f291c" roughness={0.75} />
        </mesh>
      </group>

      {/* Mounting plate */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 0.02, 0.12]} />
        <meshStandardMaterial color="#8b9299" metalness={0.85} roughness={0.3} />
      </mesh>
    </group>
  );
}

export default Gripper;