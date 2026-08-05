// src/store/armStore.js
import { create } from 'zustand';

export const useStore = create((set, get) => ({
  angles: {
    base: 0,
    shoulder: 0,
    elbow: 0,
    wrist: 0,
    gripper: 45,
  },

  setAngle: (joint, value) => {
    set((state) => ({
      angles: {
        ...state.angles,
        [joint]: Math.round(value),
      }
    }));
  },

  setAngles: (newAngles) => {
    set({ angles: { ...get().angles, ...newAngles } });
  },

  resetAngles: () => {
    set({
      angles: {
        base: 0,
        shoulder: 0,
        elbow: 0,
        wrist: 0,
        gripper: 45,
      }
    });
  }
}));