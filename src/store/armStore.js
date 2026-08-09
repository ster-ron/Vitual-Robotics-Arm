// src/store/armStore.js
import { create } from 'zustand';
import { ARM_CONFIG, clampToLimits } from '../simulation/armConfig';

const DEFAULT_ANGLES = {
  base: 0,
  shoulder: 0,
  elbow: 0,
  wrist: 0,
  gripper: 45,
};

export const useStore = create((set, get) => ({
  angles: { ...DEFAULT_ANGLES },

  // Tracks, per joint, whether the last requested angle had to be clamped
  // to stay within ARM_CONFIG.limits. Components can use this to show a
  // "hit the limit" visual cue.
  limitHit: {},

  setAngle: (joint, value) => {
    const limits = ARM_CONFIG.limits[joint];
    const clamped = clampToLimits(joint, value);
    const wasClamped = limits ? Math.round(value) !== Math.round(clamped) : false;

    set((state) => ({
      angles: {
        ...state.angles,
        [joint]: Math.round(clamped),
      },
      limitHit: {
        ...state.limitHit,
        [joint]: wasClamped,
      },
    }));

    return { clamped: Math.round(clamped), wasClamped };
  },

  setAngles: (newAngles) => {
    const current = get().angles;
    const nextAngles = { ...current };
    const nextLimitHit = { ...get().limitHit };

    Object.entries(newAngles).forEach(([joint, value]) => {
      const clamped = clampToLimits(joint, value);
      const limits = ARM_CONFIG.limits[joint];
      nextAngles[joint] = Math.round(clamped);
      nextLimitHit[joint] = limits ? Math.round(value) !== Math.round(clamped) : false;
    });

    set({ angles: nextAngles, limitHit: nextLimitHit });
  },

  resetAngles: () => {
    set({ angles: { ...DEFAULT_ANGLES }, limitHit: {} });
  },
}));
