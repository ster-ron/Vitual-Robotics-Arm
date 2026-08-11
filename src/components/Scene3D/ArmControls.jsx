// components/Scene3D/ArmControls.jsx
import { useStore } from '../../store/armStore';
import { ARM_CONFIG } from '../../simulation/armConfig';

const JOINT_LABELS = { base: 'Base', shoulder: 'Shoulder', elbow: 'Elbow', wrist: 'Wrist', gripper: 'Gripper' };

function ArmControls() {
  const { angles, atLimit, setAngle } = useStore();

  const joints = Object.keys(JOINT_LABELS).map((key) => ({
    key,
    name: JOINT_LABELS[key],
    ...ARM_CONFIG.limits[key],
  }));

  return (
    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-4 rounded-lg shadow-xl">
      <h3 className="font-bold text-sm mb-3">🤖 Joint Controls</h3>
      <div className="space-y-3">
        {joints.map(({ name, key, min, max }) => (
          <div key={key} className="flex items-center gap-3">
            <label
              className={`w-20 text-sm font-medium transition-colors ${atLimit?.[key] ? 'text-red-600' : 'text-gray-700'}`}
              title={atLimit?.[key] ? `${name} at its limit (${min}° to ${max}°)` : undefined}
            >
              {name}{atLimit?.[key] ? ' \u26a0' : ''}
            </label>
            <input
              type="range"
              min={min}
              max={max}
              value={angles[key] || 0}
              onChange={(e) => setAngle(key, parseFloat(e.target.value))}
              className="w-40 accent-blue-500"
            />
            <span className="w-12 text-sm font-mono text-gray-600">
              {Math.round(angles[key] || 0)}°
            </span>
          </div>
        ))}
      </div>

      {/* Preset poses */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Presets</p>
        <div className="flex gap-2 flex-wrap">
          {Object.keys(PRESETS).map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PRESETS = {
  Home: { base: 0, shoulder: 0, elbow: 0, wrist: 0, gripper: 45 },
  Wave: { base: 45, shoulder: 30, elbow: -45, wrist: 0, gripper: 0 },
  Reach: { base: 0, shoulder: 60, elbow: -90, wrist: 30, gripper: 0 },
  Pick: { base: 0, shoulder: 45, elbow: -60, wrist: 0, gripper: 0 },
  Inspect: { base: -30, shoulder: 15, elbow: -30, wrist: -45, gripper: 20 },
};

function applyPreset(name) {
  const store = useStore.getState();
  const preset = PRESETS[name];
  Object.entries(preset).forEach(([key, value]) => {
    store.setAngle(key, value);
  });
}

export default ArmControls;