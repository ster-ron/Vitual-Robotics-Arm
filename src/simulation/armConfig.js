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
    base: '#2c3e50',
    shoulder: '#3498db',
    upperArm: '#2980b9',
    forearm: '#e67e22',
    wrist: '#f39c12',
    gripper: '#e74c3c',
    joint: '#95a5a6',
  }
};