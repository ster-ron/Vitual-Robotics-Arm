// src/components/Scene3D/RobotArm.jsx
import { useStore } from '../../store/armStore';
import { ARM_CONFIG } from '../../simulation/armConfig';
import Joint from './Joint';
import Gripper from './Gripper';

// A tapered cylinder (narrower toward the far joint) reads as a real
// mechanical link, unlike a uniform box. Matte, low-metalness material —
// the reference look is molded white plastic/resin, not brushed metal.
function Link({ length, radiusBottom, radiusTop, color, position, panelSide = 1, showPanel = false }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radiusTop, radiusBottom, length, 20]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.08} />
      </mesh>
      {/* Small green control-panel detail on one side, like the PCB/vent
          panel on the upper arm in the reference photo. */}
      {showPanel && (
        <mesh position={[panelSide * (radiusBottom * 0.72), 0, 0]} rotation={[0, panelSide > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} castShadow>
          <boxGeometry args={[radiusBottom * 0.7, length * 0.32, 0.012]} />
          <meshStandardMaterial color="#7ed321" roughness={0.4} metalness={0.3} />
        </mesh>
      )}
    </group>
  );
}

function BasePlatform({ color, accent }) {
  const footPositions = [
    [-0.6, 0.62], [0.6, 0.62], [-0.6, -0.62], [0.6, -0.62],
  ];
  return (
    <group>
      {/* Beveled trapezoidal pedestal (wider at the bottom), matching the
          reference's angular base instead of a plain flat cylinder foot. */}
      <mesh position={[0, 0.09, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.5, 0.18, 1.3]} />
        <meshStandardMaterial color="#f2f3f5" roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.22, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.3, 0.1, 1.12]} />
        <meshStandardMaterial color="#e4e6ea" roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Rubber feet */}
      {footPositions.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.015, z]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} />
          <meshStandardMaterial color="#1c1f24" roughness={0.8} metalness={0.05} />
        </mesh>
      ))}

      {/* Rotating turret */}
      <mesh position={[0, 0.42, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.62, 0.7, 0.32, 40]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Bolt circle on the turret top */}
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.58, 0.58, Math.sin(a) * 0.58]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.02, 8]} />
            <meshStandardMaterial color="#b8bcc2" roughness={0.4} metalness={0.5} />
          </mesh>
        );
      })}
      {/* Small green port detail on the turret face */}
      <mesh position={[0, 0.32, 0.63]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.14, 0.06, 0.012]} />
        <meshStandardMaterial color={accent} roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

function RobotArm() {
  const { angles } = useStore();
  const { segments, colors, limits, jointSize } = ARM_CONFIG;

  return (
    <group position={[0, 0, 0]}>
      <BasePlatform color={colors.base} accent={colors.accent} />

      <Joint position={[0, 0.58, 0]} angle={angles.base} axis="y" limit={limits.base} speed={3} size={jointSize.base} accent={colors.accent}>
        <Joint position={[0, jointSize.base * 0.4, 0]} angle={angles.shoulder} axis="x" limit={limits.shoulder} speed={3} size={jointSize.shoulder} accent={colors.accent}>
          <Link
            length={segments.upperArm.length}
            radiusBottom={segments.upperArm.radiusBottom}
            radiusTop={segments.upperArm.radiusTop}
            color={colors.upperArm}
            position={[0, segments.upperArm.length / 2, 0]}
            panelSide={1}
            showPanel
          />

          <Joint position={[0, segments.upperArm.length, 0]} angle={angles.elbow} axis="x" limit={limits.elbow} speed={3.5} size={jointSize.elbow} accent={colors.accent}>
            <Link
              length={segments.forearm.length}
              radiusBottom={segments.forearm.radiusBottom}
              radiusTop={segments.forearm.radiusTop}
              color={colors.forearm}
              position={[0, -segments.forearm.length / 2, 0]}
              panelSide={-1}
            />

            <Joint position={[0, -segments.forearm.length, 0]} angle={angles.wrist} axis="x" limit={limits.wrist} speed={4} size={jointSize.wrist} accent={colors.accent}>
              <Link
                length={segments.wrist.length}
                radiusBottom={segments.wrist.radiusBottom}
                radiusTop={segments.wrist.radiusTop}
                color={colors.wrist}
                position={[0, -segments.wrist.length / 2, 0]}
              />

              <Gripper
                position={[0, -segments.wrist.length - 0.06, 0]}
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