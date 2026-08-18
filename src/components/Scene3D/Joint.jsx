// components/Scene3D/Joint.jsx
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// Cylinder geometry's length runs along local Y by default. To make the
// disc cap face along the axis it's actually rotating around, we rotate
// the mesh itself so its flat face points along that axis.
const AXIS_ROTATION = {
  x: [0, 0, Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
};
const AXIS_OFFSET = {
  x: (d) => [d, 0, 0],
  y: (d) => [0, d, 0],
  z: (d) => [0, 0, d],
};

function Joint({
  children,
  angle = 0,
  axis = 'y',
  position = [0, 0, 0],
  limit = { min: -180, max: 180 },
  speed = 2,
  size = 0.16,
  accent = '#7ed321',
  ...props
}) {
  const groupRef = useRef();
  const currentAngle = useRef(0);

  useFrame((state, delta) => {
    if (groupRef.current) {
      const target = (angle * Math.PI) / 180;
      currentAngle.current += (target - currentAngle.current) * Math.min(1, delta * speed);
      if (axis === 'x') groupRef.current.rotation.x = currentAngle.current;
      else if (axis === 'y') groupRef.current.rotation.y = currentAngle.current;
      else if (axis === 'z') groupRef.current.rotation.z = currentAngle.current;
    }
  });

  const housingRot = AXIS_ROTATION[axis];
  const capOffset = AXIS_OFFSET[axis](size * 0.72);
  const capOffsetNeg = AXIS_OFFSET[axis](-size * 0.72);

  // A few thin radial "spokes" across each disc face, like the vaned
  // pattern on a harmonic-drive end cap in the reference photo.
  const spokeAngles = useMemo(() => [0, 60, 120], []);

  return (
    <group ref={groupRef} position={position} {...props}>
      {/* Green accent collar where the disc meets the body */}
      <mesh rotation={housingRot} castShadow>
        <cylinderGeometry args={[size * 1.08, size * 1.08, size * 0.22, 24]} />
        <meshStandardMaterial color={accent} roughness={0.35} metalness={0.5} />
      </mesh>

      {/* Main housing barrel between the two disc caps */}
      <mesh rotation={housingRot} castShadow receiveShadow>
        <cylinderGeometry args={[size * 0.92, size * 0.92, size * 1.3, 28]} />
        <meshStandardMaterial color="#e9ebee" roughness={0.4} metalness={0.15} />
      </mesh>

      {/* Navy disc caps on each face, matching the reference's joint-end look */}
      {[capOffset, capOffsetNeg].map((offset, i) => (
        <group key={i} position={offset} rotation={housingRot}>
          <mesh castShadow>
            <cylinderGeometry args={[size, size, size * 0.16, 28]} />
            <meshStandardMaterial color="#1c2b4a" roughness={0.35} metalness={0.6} />
          </mesh>
          {/* Lighter inset ring for depth */}
          <mesh position={[0, size * 0.09, 0]}>
            <cylinderGeometry args={[size * 0.65, size * 0.65, size * 0.02, 24]} />
            <meshStandardMaterial color="#2f4a7a" roughness={0.3} metalness={0.65} />
          </mesh>
          {/* Radial spokes */}
          {spokeAngles.map((deg) => (
            <mesh key={deg} position={[0, size * 0.1, 0]} rotation={[0, (deg * Math.PI) / 180, 0]}>
              <boxGeometry args={[size * 1.7, size * 0.03, size * 0.09]} />
              <meshStandardMaterial color="#14203a" roughness={0.4} metalness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {children}
    </group>
  );
}

export default Joint;