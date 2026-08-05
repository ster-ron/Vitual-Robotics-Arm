// src/simulation/handConfig.js
export const HAND_CONFIG = {
  palm: {
    width: 1.0,
    height: 1.2,
    depth: 0.3,
    color: '#f5cba7'
  },
  
  fingers: {
    thumb: {
      segments: 2,
      lengths: [0.6, 0.5],
      widths: [0.18, 0.14],
      color: '#f5cba7'
    },
    index: {
      segments: 3,
      lengths: [0.5, 0.5, 0.4],
      widths: [0.14, 0.12, 0.10],
      color: '#f5cba7'
    },
    middle: {
      segments: 3,
      lengths: [0.55, 0.55, 0.45],
      widths: [0.15, 0.13, 0.11],
      color: '#f5cba7'
    },
    ring: {
      segments: 3,
      lengths: [0.5, 0.5, 0.4],
      widths: [0.14, 0.12, 0.10],
      color: '#f5cba7'
    },
    pinky: {
      segments: 3,
      lengths: [0.4, 0.4, 0.3],
      widths: [0.12, 0.10, 0.08],
      color: '#f5cba7'
    }
  },

  knucklePositions: {
    thumb: { x: -0.3, y: 0.5, z: 0.2 },
    index: { x: -0.35, y: 0.45, z: -0.1 },
    middle: { x: -0.1, y: 0.5, z: -0.1 },
    ring: { x: 0.15, y: 0.45, z: -0.1 },
    pinky: { x: 0.35, y: 0.4, z: -0.05 }
  },

  wrist: {
    width: 0.6,
    height: 0.4,
    depth: 0.5,
    color: '#d4a574'
  },

  forearm: {
    length: 2.0,
    width: 0.5,
    color: '#d4a574'
  },

  jointColor: '#7f8c8d',
  jointHighlight: '#bdc3c7'
};