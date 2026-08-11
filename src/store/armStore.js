// src/store/armStore.js
import { create } from 'zustand';
import { ARM_CONFIG } from '../simulation/armConfig';

function clamp(joint, value) {
  const lim = ARM_CONFIG.limits[joint];
  if (!lim) return Math.round(value);
  return Math.round(Math.max(lim.min, Math.min(lim.max, value)));
}

export const useStore = create((set, get) => ({
  angles: {
    base: 0,
    shoulder: 0,
    elbow: 0,
    wrist: 0,
    gripper: 45,
  },

  // true while a joint is at (or within half a degree of) its limit —
  // lets the UI show a "hit the stop" indicator instead of silently
  // swallowing out-of-range commands.
  atLimit: {},

  setAngle: (joint, value) => {
    const clamped = clamp(joint, value);
    const lim = ARM_CONFIG.limits[joint];
    const hitLimit = !!lim && (clamped === lim.min || clamped === lim.max);
    set((state) => ({
      angles: { ...state.angles, [joint]: clamped },
      atLimit: { ...state.atLimit, [joint]: hitLimit },
    }));
  },

  setAngles: (newAngles) => {
    const clamped = {};
    Object.entries(newAngles).forEach(([j, v]) => { clamped[j] = clamp(j, v); });
    set({ angles: { ...get().angles, ...clamped } });
  },

  resetAngles: () => {
    set({
      angles: {
        base: 0,
        shoulder: 0,
        elbow: 0,
        wrist: 0,
        gripper: 45,
      },
      atLimit: {},
    });
  }
}));