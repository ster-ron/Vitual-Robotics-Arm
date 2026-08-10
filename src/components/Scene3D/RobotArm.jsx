// src/components/Scene3D/RobotArm.jsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store/armStore';
import { ARM_CONFIG } from '../../simulation/armConfig';
import Gripper from './Gripper';

const { colors } = ARM_CONFIG;
const ROTATE_SPEED = 6; // how quickly a joint eases toward its target angle

function Bolts({ radius = 0.15, count = 4, boltRadius = 0.022, boltHeight = 0.02, y = 0 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * radius, y, Math.sin(angle) * radius]}
            castShadow
          >
            <cylinderGeometry args={[boltRadius, boltRadius, boltHeight, 6]} />
            <meshStandardMaterial color={colors.bolt} metalness={0.9} roughness={0.25} />
          </mesh>
        );
      })}
    </>
  );
}

function MotorHousing({ radius = 0.2, height = 0.26, finCount = 6 }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 24]} />
        <meshStandardMaterial color={colors.motorHousing} metalness={0.45} roughness={0.5} />
      </mesh>
      {Array.from({ length: finCount }).map((_, i) => {
        const a = (i / finCount) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * (radius + 0.006), 0, Math.sin(a) * (radius + 0.006)]}
            rotation={[0, -a, 0]}
            castShadow
          >
            <boxGeometry args={[0.01, height * 0.65, 0.045]} />
            <meshStandardMaterial color={colors.accent} metalness={0.3} roughness={0.55} />
          </mesh>
        );
      })}
      <Bolts radius={radius * 0.72} count={4} y={height / 2 - 0.02} boltHeight={0.018} boltRadius={0.018} />
    </group>
  );
}

function JointSphere({ radius, hit }) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={hit ? colors.jointLimitHit : colors.joint}
        roughness={0.3}
        metalness={0.7}
        emissive={hit ? colors.jointLimitHit : '#000000'}
        emissiveIntensity={hit ? 0.6 : 0}
      />
    </mesh>
  );
}

// A servo cable running alongside a segment, with a slight sag for realism.
// direction: +1 if the segment extends toward +Y from this group's origin,
// -1 if it extends toward -Y (matches how upperArm vs. forearm are built below).
function CableRun({ length, direction = 1, sideOffset = 0.18, sag = 0.035, radius = 0.015 }) {
  const curve = useMemo(() => {
    const end = length * direction;
    const mid = end / 2;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(sideOffset, 0.02 * direction, 0),
      new THREE.Vector3(sideOffset + sag, mid, 0),
      new THREE.Vector3(sideOffset, end - 0.02 * direction, 0),
    ]);
  }, [length, direction, sideOffset, sag]);

  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 16, radius, 8, false]} />
      <meshStandardMaterial color={colors.bolt} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

function RobotArm() {
  const limitHit = useStore((s) => s.limitHit);
  const gripperAngle = useStore((s) => s.angles.gripper);
  const { segments } = ARM_CONFIG;

  const baseRef = useRef();
  const shoulderRef = useRef();
  const elbowRef = useRef();
  const wristRef = useRef();

  const toRad = (deg) => (deg * Math.PI) / 180;

  // Ease each joint toward its target angle every frame instead of
  // snapping instantly - this is what makes the motion read as a real
  // servo turning rather than a value teleporting.
  useFrame((_state, delta) => {
    const { angles } = useStore.getState();
    const t = Math.min(1, delta * ROTATE_SPEED);
    const lerp = (current, target) => current + (target - current) * t;

    if (baseRef.current) {
      baseRef.current.rotation.y = lerp(baseRef.current.rotation.y, toRad(angles.base));
    }
    if (shoulderRef.current) {
      shoulderRef.current.rotation.x = lerp(shoulderRef.current.rotation.x, toRad(angles.shoulder));
    }
    if (elbowRef.current) {
      elbowRef.current.rotation.x = lerp(elbowRef.current.rotation.x, toRad(angles.elbow));
    }
    if (wristRef.current) {
      wristRef.current.rotation.x = lerp(wristRef.current.rotation.x, toRad(angles.wrist));
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Base Platform */}
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.8, 1.0, 0.3, 32]} />
        <meshStandardMaterial color={colors.base} roughness={0.4} metalness={0.55} />
      </mesh>
      <Bolts radius={0.65} count={6} y={0.16} boltHeight={0.03} boltRadius={0.03} />

      {/* Base Rotation */}
      <group ref={baseRef} position={[0, 0.3, 0]}>
        <MotorHousing radius={0.28} height={0.3} />
        <JointSphere radius={0.09} hit={limitHit.base} />

        {/* Shoulder */}
        <group ref={shoulderRef} position={[0, 0.4, 0]}>
          <MotorHousing radius={0.2} height={0.26} />
          <JointSphere radius={0.08} hit={limitHit.shoulder} />

          {/* Upper Arm */}
          <RoundedBox
            position={[0, segments.upperArm.length / 2, 0]}
            args={[segments.upperArm.width, segments.upperArm.length, segments.upperArm.depth]}
            radius={0.04}
            smoothness={4}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={colors.upperArm} roughness={0.35} metalness={0.55} />
          </RoundedBox>
          <CableRun
            length={segments.upperArm.length}
            direction={1}
            sideOffset={segments.upperArm.width / 2 + 0.05}
          />

          {/* Elbow */}
          <group position={[0, segments.upperArm.length, 0]}>
            <group ref={elbowRef}>
              <MotorHousing radius={0.17} height={0.22} />
              <JointSphere radius={0.07} hit={limitHit.elbow} />

              {/* Forearm */}
              <RoundedBox
                position={[0, -segments.forearm.length / 2, 0]}
                args={[segments.forearm.width, segments.forearm.length, segments.forearm.depth]}
                radius={0.035}
                smoothness={4}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial color={colors.forearm} roughness={0.35} metalness={0.55} />
              </RoundedBox>
              <CableRun
                length={segments.forearm.length}
                direction={-1}
                sideOffset={segments.forearm.width / 2 + 0.045}
              />

              {/* Wrist */}
              <group position={[0, -segments.forearm.length, 0]}>
                <group ref={wristRef}>
                  <MotorHousing radius={0.12} height={0.16} finCount={4} />
                  <JointSphere radius={0.055} hit={limitHit.wrist} />

                  <RoundedBox
                    position={[0, -segments.wrist.length / 2, 0]}
                    args={[segments.wrist.width, segments.wrist.length, segments.wrist.depth]}
                    radius={0.025}
                    smoothness={4}
                    castShadow
                    receiveShadow
                  >
                    <meshStandardMaterial color={colors.wrist} roughness={0.4} metalness={0.55} />
                  </RoundedBox>

                  {/* Gripper */}
                  <Gripper
                    position={[0, -segments.wrist.length - 0.1, 0]}
                    angle={gripperAngle}
                    color={limitHit.gripper ? colors.jointLimitHit : colors.gripper}
                  />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* Soft grounding shadow beneath the whole arm */}
      <ContactShadows
        position={[0, -0.14, 0]}
        opacity={0.55}
        scale={8}
        blur={2}
        far={3}
        resolution={512}
        color="#000000"
      />
    </group>
  );
}

export default RobotArm;