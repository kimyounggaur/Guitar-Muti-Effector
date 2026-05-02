export const smoothAudioParam = (context: AudioContext, param: AudioParam, value: number, timeConstant = 0.02) => {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, timeConstant);
};

export const rampAudioParam = (context: AudioContext, param: AudioParam, value: number, seconds = 0.02) => {
  const now = context.currentTime;
  const current = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(current, now);
  param.linearRampToValueAtTime(value, now + seconds);
};

export const safeDisconnect = (node?: AudioNode | null) => {
  if (!node) {
    return;
  }

  try {
    node.disconnect();
  } catch {
    // Audio graph nodes can already be disconnected during fast device switches.
  }
};
