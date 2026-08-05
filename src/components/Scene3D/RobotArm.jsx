// src/components/Scene3D/RobotArm.jsx
import { useRef } from 'react';
import { useStore } from '../../store/armStore';
import { ARM_CONFIG } from '../../simulation/armConfig';
import Gripper from './Gripper';

function RoundedBox({ width, height, depth, color, ...props }) {
  return (
    <mesh {...props}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.4}
        metalness={0.3}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}

function RobotArm() {
  const { angles } = useStore();
  const { segments, colors } = ARM_CONFIG;

  // Convert degrees to radians
  const toRad = (deg) => deg * Math.PI / 180;

  return (
    <group position={[0, 0, 0]}>
      
      {/* Base Platform */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <cylinderGeometry args={[0.8, 1.0, 0.3, 32]} />
        <meshStandardMaterial color={colors.base} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Base Rotation */}
      <group position={[0, 0.3, 0]} rotation={[0, toRad(angles.base), 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color={colors.joint} roughness={0.2} metalness={0.8} />
        </mesh>

        {/* Shoulder */}
        <group position={[0, 0.4, 0]} rotation={[toRad(angles.shoulder), 0, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color={colors.joint} roughness={0.2} metalness={0.8} />
          </mesh>

          {/* Upper Arm */}
          <RoundedBox
            position={[0, 0.9, 0]}
            width={segments.upperArm.width}
            height={segments.upperArm.length}
            depth={segments.upperArm.depth}
            color={colors.upperArm}
          />

          {/* Elbow */}
          <group position={[0, segments.upperArm.length, 0]} rotation={[toRad(angles.elbow), 0, 0]}>
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshStandardMaterial color={colors.joint} roughness={0.2} metalness={0.8} />
            </mesh>

            {/* Forearm */}
            <RoundedBox
              position={[0, -segments.forearm.length/2, 0]}
              width={segments.forearm.width}
              height={segments.forearm.length}
              depth={segments.forearm.depth}
              color={colors.forearm}
            />

            {/* Wrist */}
            <group position={[0, -segments.forearm.length, 0]} rotation={[toRad(angles.wrist), 0, 0]}>
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshStandardMaterial color={colors.joint} roughness={0.2} metalness={0.8} />
              </mesh>

              <RoundedBox
                position={[0, -0.2, 0]}
                width={segments.wrist.width}
                height={segments.wrist.length}
                depth={segments.wrist.depth}
                color={colors.wrist}
              />

              {/* Gripper */}
              <Gripper 
                position={[0, -segments.wrist.length - 0.1, 0]}
                angle={angles.gripper}
                color={colors.gripper}
              />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default RobotArm;