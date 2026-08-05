// src/components/Scene3D/HumanoidHand.jsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../../store/armStore';
import { HAND_CONFIG } from '../../simulation/handConfig';

// Simple finger segment
function FingerSegment({ length, width, color, angle = 0, position = [0, 0, 0] }) {
  const groupRef = useRef();
  const currentAngle = useRef(0);

  useFrame((state, delta) => {
    if (groupRef.current) {
      const target = (angle * Math.PI) / 180;
      currentAngle.current += (target - currentAngle.current) * Math.min(1, delta * 8);
      groupRef.current.rotation.x = currentAngle.current;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, length/2, 0]} castShadow>
        <cylinderGeometry args={[width * 0.7, width, length, 12]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[width * 0.6, 12, 12]} />
        <meshStandardMaterial color={HAND_CONFIG.jointColor} roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
}

// Simple finger
function Finger({ segments, lengths, widths, color, basePosition, angles }) {
  let currentY = 0;
  
  return (
    <group position={basePosition}>
      {segments.map((segment, index) => {
        const angle = angles && angles[index] ? angles[index] : 0;
        const length = lengths[index] || 0.5;
        const width = widths[index] || 0.15;
        const pos = [0, currentY, 0];
        currentY += length;
        
        return (
          <FingerSegment
            key={index}
            length={length}
            width={width}
            color={color}
            angle={angle}
            position={pos}
          />
        );
      })}
    </group>
  );
}

// Main Hand Component
function HumanoidHand() {
  const { angles } = useStore();
  const { palm, fingers, knucklePositions, wrist, forearm } = HAND_CONFIG;

  const fingerAngles = {
    thumb: [angles.thumb1 || 0, angles.thumb2 || 0],
    index: [angles.index1 || 0, angles.index2 || 0, angles.index3 || 0],
    middle: [angles.middle1 || 0, angles.middle2 || 0, angles.middle3 || 0],
    ring: [angles.ring1 || 0, angles.ring2 || 0, angles.ring3 || 0],
    pinky: [angles.pinky1 || 0, angles.pinky2 || 0, angles.pinky3 || 0],
  };

  const toRad = (deg) => deg * Math.PI / 180;

  return (
    <group position={[0, 0, 0]}>
      
      {/* Forearm */}
      <group position={[0, -forearm.length, 0]}>
        <mesh position={[0, forearm.length/2, 0]} castShadow>
          <cylinderGeometry args={[forearm.width * 0.6, forearm.width * 0.8, forearm.length, 16]} />
          <meshStandardMaterial color={forearm.color} roughness={0.7} metalness={0.1} />
        </mesh>

        {/* Wrist */}
        <group position={[0, forearm.length, 0]} rotation={[toRad(angles.wrist || 0), 0, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[wrist.width * 0.5, 16, 16]} />
            <meshStandardMaterial color={HAND_CONFIG.jointColor} roughness={0.3} metalness={0.6} />
          </mesh>

          {/* Palm */}
          <group position={[0, 0.1, 0]}>
            <mesh position={[0, palm.height/2, 0]} castShadow>
              <boxGeometry args={[palm.width, palm.height, palm.depth]} />
              <meshStandardMaterial color={palm.color} roughness={0.7} metalness={0.05} />
            </mesh>

            {/* Thumb */}
            <group rotation={[0.3, 0.2, 0.1]}>
              <Finger
                segments={fingers.thumb.segments}
                lengths={fingers.thumb.lengths}
                widths={fingers.thumb.widths}
                color={fingers.thumb.color}
                basePosition={[knucklePositions.thumb.x, knucklePositions.thumb.y, knucklePositions.thumb.z]}
                angles={fingerAngles.thumb}
              />
            </group>

            {/* Index Finger */}
            <Finger
              segments={fingers.index.segments}
              lengths={fingers.index.lengths}
              widths={fingers.index.widths}
              color={fingers.index.color}
              basePosition={[knucklePositions.index.x, knucklePositions.index.y, knucklePositions.index.z]}
              angles={fingerAngles.index}
            />

            {/* Middle Finger */}
            <Finger
              segments={fingers.middle.segments}
              lengths={fingers.middle.lengths}
              widths={fingers.middle.widths}
              color={fingers.middle.color}
              basePosition={[knucklePositions.middle.x, knucklePositions.middle.y, knucklePositions.middle.z]}
              angles={fingerAngles.middle}
            />

            {/* Ring Finger */}
            <Finger
              segments={fingers.ring.segments}
              lengths={fingers.ring.lengths}
              widths={fingers.ring.widths}
              color={fingers.ring.color}
              basePosition={[knucklePositions.ring.x, knucklePositions.ring.y, knucklePositions.ring.z]}
              angles={fingerAngles.ring}
            />

            {/* Pinky Finger */}
            <Finger
              segments={fingers.pinky.segments}
              lengths={fingers.pinky.lengths}
              widths={fingers.pinky.widths}
              color={fingers.pinky.color}
              basePosition={[knucklePositions.pinky.x, knucklePositions.pinky.y, knucklePositions.pinky.z]}
              angles={fingerAngles.pinky}
            />
          </group>
        </group>
      </group>
    </group>
  );
}

export default HumanoidHand;