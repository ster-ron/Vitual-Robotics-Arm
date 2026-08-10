// src/simulation/armConfig.js
export const ARM_CONFIG = {
  segments: {
    base: { height: 0.8, radius: 0.6 },
    shoulder: { height: 1.2, width: 0.4, depth: 0.4 },
    upperArm: { length: 1.8, width: 0.3, depth: 0.3 },
    forearm: { length: 1.4, width: 0.25, depth: 0.25 },
    wrist: { length: 0.3, width: 0.2, depth: 0.2 },
    gripper: { length: 0.4, width: 0.15, depth: 0.15 },
  },

  limits: {
    base: { min: -180, max: 180 },
    shoulder: { min: -90, max: 90 },
    elbow: { min: -135, max: 135 },
    wrist: { min: -90, max: 90 },
    gripper: { min: 0, max: 90 },
  },

  colors: {
    base: '#20262b',
    shoulder: '#3a4046',
    upperArm: '#d6dade',
    forearm: '#bfc4c9',
    wrist: '#9aa0a6',
    gripper: '#c0392b',
    gripperTip: '#8f291c',
    joint: '#3a4046',
    jointLimitHit: '#ff4d4d',
    motorHousing: '#15181b',
    bolt: '#0d0f11',
    accent: '#e8791b',
  },
};

/** Clamp a logical joint angle (degrees) into that joint's configured limits. */
export function clampToLimits(joint, angle) {
  const limits = ARM_CONFIG.limits[joint];
  if (!limits) return angle;
  return Math.max(limits.min, Math.min(limits.max, angle));
}

/**
 * A real hobby servo only physically rotates 0-180 degrees. That 0-180
 * throw is mechanically geared/linked to produce each joint's actual
 * range of motion (e.g. the shoulder swings -90..90, the base swings
 * -180..180). This maps a servo.write() value (0-180) onto the joint's
 * logical range, so a real Arduino sketch driving servos the normal way
 * produces physically sensible arm motion instead of a raw 1:1 passthrough.
 */
export function servoToJointAngle(joint, servoAngle) {
  const limits = ARM_CONFIG.limits[joint];
  if (!limits) return servoAngle;
  const clampedServo = Math.max(0, Math.min(180, servoAngle));
  const t = clampedServo / 180;
  return limits.min + t * (limits.max - limits.min);
}

/** Inverse of servoToJointAngle - useful for reporting/debugging. */
export function jointAngleToServo(joint, jointAngle) {
  const limits = ARM_CONFIG.limits[joint];
  if (!limits) return jointAngle;
  const clamped = clampToLimits(joint, jointAngle);
  const t = (clamped - limits.min) / (limits.max - limits.min);
  return t * 180;
}