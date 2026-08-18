// components/Scene3D/Gripper.jsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// A claw finger built from a few segments, each rotated a bit further
// than the last, approximates the curved talon shape in the reference
// photo — a single straight box reads as a parallel-jaw gripper instead.
function ClawFinger({ segments = 3, segLength = 0.09, curve = 22, color }) {
  let y = 0;
  const parts = [];
  for (let i = 0; i < segments; i++) {
    const width = 0.05 - i * 0.012;
    parts.push(
      <mesh key={i} position={[0, y - segLength / 2, 0]} rotation={[0, 0, (-curve * (i + 1) * Math.PI) / 180]} castShadow>
        <boxGeometry args={[width, segLength, width * 0.9]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.25} />
      </mesh>
    );
    y -= segLength * Math.cos((curve * (i + 1) * Math.PI) / 180);
  }
  return <group>{parts}</group>;
}

function Gripper({ angle = 0, color = '#7ed321', ...props }) {
  const leftFinger = useRef();
  const rightFinger = useRef();
  const currentOpen = useRef(0);

  useFrame((state, delta) => {
    const targetOpen = (angle / 90) * 0.14;
    currentOpen.current += (targetOpen - currentOpen.current) * Math.min(1, delta * 6);
    if (leftFinger.current && rightFinger.current) {
      leftFinger.current.position.x = -0.06 - currentOpen.current;
      rightFinger.current.position.x = 0.06 + currentOpen.current;
    }
  });

  return (
    <group {...props}>
      <mesh position={[0, 0.07, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.05, 20]} />
        <meshStandardMaterial color="#1c2b4a" roughness={0.35} metalness={0.5} />
      </mesh>

      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.08, 0.15]} />
        <meshStandardMaterial color="#eef0f2" roughness={0.5} metalness={0.08} />
      </mesh>

      <group ref={leftFinger} rotation={[0, 0, 0.35]}>
        <ClawFinger color={color} />
      </group>

      <group ref={rightFinger} rotation={[0, 0, -0.35]} scale={[-1, 1, 1]}>
        <ClawFinger color={color} />
      </group>
    </group>
  );
}

export default Gripper;