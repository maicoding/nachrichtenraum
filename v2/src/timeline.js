export const phases = [
  {
    type: "active",
    key: "slow",
    label: "PHASE I · LANGSAM",
    duration: 20,
    initial: 6,
    target: 18,
    intensity: 0.7,
    startRate: 1250,
    endRate: 520,
    batch: 1,
  },
  { type: "pause", key: "silence-1", label: "STILLE", duration: 6 },
  {
    type: "active",
    key: "medium",
    label: "PHASE II · MITTEL",
    duration: 20,
    initial: 16,
    target: 40,
    intensity: 1.25,
    startRate: 460,
    endRate: 150,
    batch: 2,
  },
  { type: "pause", key: "silence-2", label: "STILLE", duration: 6 },
  {
    type: "active",
    key: "overload",
    label: "PHASE III · GANZ VIELE",
    duration: 20,
    initial: 32,
    target: 72,
    intensity: 2.2,
    startRate: 145,
    endRate: 48,
    batch: 3,
  },
  { type: "pause", key: "silence-3", label: "STILLE", duration: 6 },
];

export const cycleDuration = phases.reduce((sum, phase) => sum + phase.duration, 0);

export function phaseAt(elapsedSeconds) {
  let cycleTime = ((elapsedSeconds % cycleDuration) + cycleDuration) % cycleDuration;
  for (let index = 0; index < phases.length; index += 1) {
    const phase = phases[index];
    if (cycleTime < phase.duration) {
      return { index, phase, progress: cycleTime / phase.duration, cycleTime };
    }
    cycleTime -= phase.duration;
  }
  return { index: 0, phase: phases[0], progress: 0, cycleTime: 0 };
}
