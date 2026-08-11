// src/components/Scene3D/RobotArm.jsx
import { useStore } from '../../store/armStore';
import { ARM_CONFIG } from '../../simulation/armConfig';
import Joint from './Joint';
import Gripper from './Gripper';

function RoundedBox({ width, height, depth, color, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.4} envMapIntensity={0.7} />
    </mesh>
  );
}

function RobotArm() {
  const { angles } = useStore();
  const { segments, colors, limits } = ARM_CONFIG;

  // Previously each joint's rotation was set directly from the store value
  // every render, so the arm teleported to new angles instead of moving —
  // not how a real servo behaves. Nesting <Joint> components here gives
  // every joint the same smooth, speed-limited interpolation, driven off
  // the exact same store values.
  return (
    <group position={[0, 0, 0]}>
      {/* Base platform */}
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.8, 1.0, 0.3, 32]} />
        <meshStandardMaterial color={colors.base} roughness={0.35} metalness={0.55} envMapIntensity={0.7} />
      </mesh>
      {/* Trim ring for a bit of visual detail on the pedestal */}
      <mesh position={[0, 0.16, 0]}>
        <torusGeometry args={[0.82, 0.02, 8, 48]} />
        <meshStandardMaterial color="#e8934a" roughness={0.3} metalness={0.8} emissive="#3a2410" emissiveIntensity={0.4} />
      </mesh>

      <Joint position={[0, 0.3, 0]} angle={angles.base} axis="y" limit={limits.base} speed={3}>
        <Joint position={[0, 0.4, 0]} angle={angles.shoulder} axis="x" limit={limits.shoulder} speed={3}>
          <RoundedBox
            position={[0, segments.upperArm.length / 2, 0]}
            width={segments.upperArm.width}
            height={segments.upperArm.length}
            depth={segments.upperArm.depth}
            color={colors.upperArm}
          />

          <Joint position={[0, segments.upperArm.length, 0]} angle={angles.elbow} axis="x" limit={limits.elbow} speed={3.5}>
            <RoundedBox
              position={[0, -segments.forearm.length / 2, 0]}
              width={segments.forearm.width}
              height={segments.forearm.length}
              depth={segments.forearm.depth}
              color={colors.forearm}
            />

            <Joint position={[0, -segments.forearm.length, 0]} angle={angles.wrist} axis="x" limit={limits.wrist} speed={4}>
              <RoundedBox
                position={[0, -0.2, 0]}
                width={segments.wrist.width}
                height={segments.wrist.length}
                depth={segments.wrist.depth}
                color={colors.wrist}
              />

              <Gripper
                position={[0, -segments.wrist.length - 0.1, 0]}
                angle={angles.gripper}
                color={colors.gripper}
              />
            </Joint>
          </Joint>
        </Joint>
      </Joint>
    </group>
  );
}

export default RobotArm;