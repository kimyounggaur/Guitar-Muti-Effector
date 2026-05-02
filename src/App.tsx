import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AudioEngine, MeterReading, TunerReading } from './audio/AudioEngine';
import {
  EFFECT_DEFINITIONS,
  EffectDefinition,
  Pedal,
  PedalParamDefinition,
  getEffectDefinition,
} from './audio/types';
import { usePedalStore } from './store/pedalStore';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

const emptyMeter: MeterReading = { rms: 0, peak: 0, db: -120 };
const emptyTuner: TunerReading = { note: '--', frequency: null, cents: 0, confidence: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const meterPercent = (meter: MeterReading) => clamp((meter.db + 60) / 60, 0, 1);

const formatDb = (db: number) => (db <= -90 ? '-inf dB' : `${db.toFixed(1)} dB`);

const formatParamValue = (definition: PedalParamDefinition, value: number) => {
  if (definition.kind === 'db') {
    return `${value > 0 ? '+' : ''}${value.toFixed(value % 1 === 0 ? 0 : 1)} dB`;
  }

  if (definition.kind === 'ms') {
    return `${Math.round(value)} ms`;
  }

  if (definition.kind === 'hz') {
    return value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`;
  }

  if (definition.kind === 'percent') {
    return `${Math.round(value * 100)}%`;
  }

  if (definition.key === 'ratio') {
    return `${value.toFixed(value % 1 === 0 ? 0 : 1)}:1`;
  }

  return `${value.toFixed(1)}x`;
};

const getDeviceLabel = (device: MediaDeviceInfo, index: number) =>
  device.label || `Audio input ${index + 1}`;

function App() {
  const engineRef = useRef(new AudioEngine());
  const pedals = usePedalStore((state) => state.pedals);
  const masterVolume = usePedalStore((state) => state.masterVolume);
  const selectedDeviceId = usePedalStore((state) => state.selectedDeviceId);
  const presets = usePedalStore((state) => state.presets);
  const selectedPresetId = usePedalStore((state) => state.selectedPresetId);
  const isDragging = usePedalStore((state) => state.isDragging);
  const setSelectedDeviceId = usePedalStore((state) => state.setSelectedDeviceId);
  const setMasterVolume = usePedalStore((state) => state.setMasterVolume);
  const setDragging = usePedalStore((state) => state.setDragging);
  const updatePedal = usePedalStore((state) => state.updatePedal);
  const setPedalParam = usePedalStore((state) => state.setPedalParam);
  const reorderPedals = usePedalStore((state) => state.reorderPedals);
  const savePreset = usePedalStore((state) => state.savePreset);
  const loadPreset = usePedalStore((state) => state.loadPreset);
  const deletePreset = usePedalStore((state) => state.deletePreset);
  const resetFactory = usePedalStore((state) => state.resetFactory);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [statusText, setStatusText] = useState('Audio engine is idle.');
  const [inputMeter, setInputMeter] = useState<MeterReading>(emptyMeter);
  const [outputMeter, setOutputMeter] = useState<MeterReading>(emptyMeter);
  const [tuner, setTuner] = useState<TunerReading>(emptyTuner);
  const [presetName, setPresetName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const mediaDevices = await navigator.mediaDevices.enumerateDevices();
    setDevices(mediaDevices.filter((device) => device.kind === 'audioinput'));
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  useEffect(() => {
    return () => engineRef.current.dispose();
  }, []);

  useEffect(() => {
    if (status !== 'connected') {
      return undefined;
    }

    let raf = 0;
    let lastMeterAt = 0;
    let lastTunerAt = 0;

    const tick = (time: number) => {
      const engine = engineRef.current;

      if (time - lastMeterAt > 32) {
        setInputMeter(engine.readInputMeter());
        setOutputMeter(engine.readOutputMeter());
        lastMeterAt = time;
      }

      if (time - lastTunerAt > 130) {
        setTuner(engine.readTuner());
        lastTunerAt = time;
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [status]);

  const syncPedalToEngine = useCallback((pedalId: string) => {
    const pedal = usePedalStore.getState().pedals.find((item) => item.id === pedalId);
    if (pedal) {
      engineRef.current.updatePedal(pedal);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setStatusText('This browser does not expose getUserMedia.');
      return;
    }

    setStatus('connecting');
    setStatusText('Requesting guitar input permission...');

    try {
      const state = usePedalStore.getState();
      await engineRef.current.connect(state.selectedDeviceId || undefined, state.pedals, state.masterVolume);
      setStatus('connected');
      setStatusText('Live input connected.');
      await refreshDevices();
    } catch (error) {
      setStatus('error');
      setStatusText(error instanceof Error ? error.message : 'Could not connect audio input.');
    }
  }, [refreshDevices]);

  const handleDeviceChange = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);

      if (status !== 'connected') {
        return;
      }

      setStatusText('Switching input device...');
      try {
        await engineRef.current.switchInput(deviceId || undefined, usePedalStore.getState().pedals);
        setStatusText('Live input connected.');
        await refreshDevices();
      } catch (error) {
        setStatus('error');
        setStatusText(error instanceof Error ? error.message : 'Could not switch audio input.');
      }
    },
    [refreshDevices, setSelectedDeviceId, status],
  );

  const handleMasterVolume = useCallback(
    (volume: number) => {
      setMasterVolume(volume);
      engineRef.current.setMasterVolume(volume);
    },
    [setMasterVolume],
  );

  const handlePedalPatch = useCallback(
    (pedalId: string, patch: Partial<Omit<Pedal, 'params'>> & { params?: Record<string, number> }) => {
      updatePedal(pedalId, patch);
      syncPedalToEngine(pedalId);
    },
    [syncPedalToEngine, updatePedal],
  );

  const handlePedalParam = useCallback(
    (pedalId: string, key: string, value: number) => {
      setPedalParam(pedalId, key, value);
      syncPedalToEngine(pedalId);
    },
    [setPedalParam, syncPedalToEngine],
  );

  const handleDragStart = useCallback(
    (_event: DragStartEvent) => {
      setDragging(true);
    },
    [setDragging],
  );

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      setDragging(false);
    },
    [setDragging],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragging(false);
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      reorderPedals(String(active.id), String(over.id));
      window.requestAnimationFrame(() => {
        engineRef.current.rebuildChain(usePedalStore.getState().pedals);
      });
    },
    [reorderPedals, setDragging],
  );

  const handleSavePreset = useCallback(() => {
    savePreset(presetName);
    setPresetName('');
  }, [presetName, savePreset]);

  const handleLoadPreset = useCallback(
    (presetId: string) => {
      if (!presetId) {
        return;
      }

      loadPreset(presetId);
      const state = usePedalStore.getState();
      engineRef.current.setMasterVolume(state.masterVolume);
      engineRef.current.rebuildChain(state.pedals);
    },
    [loadPreset],
  );

  const handleDeletePreset = useCallback(() => {
    if (selectedPresetId) {
      deletePreset(selectedPresetId);
    }
  }, [deletePreset, selectedPresetId]);

  const handleReset = useCallback(() => {
    resetFactory();
    const state = usePedalStore.getState();
    engineRef.current.setMasterVolume(state.masterVolume);
    engineRef.current.rebuildChain(state.pedals);
  }, [resetFactory]);

  const handlePanic = useCallback(() => {
    engineRef.current.panic(usePedalStore.getState().pedals);
    setStatusText('Panic reset sent to the audio chain.');
  }, []);

  const pedalIds = useMemo(() => pedals.map((pedal) => pedal.id), [pedals]);
  const statusLabel = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : status === 'error' ? 'Needs attention' : 'Idle';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="title-block">
          <span className="eyebrow">Web Audio Multi FX</span>
          <h1>Pedalboard Lab</h1>
          <p>
            Browser-based guitar processing with AudioWorklet DSP, draggable signal flow, tuner, meters,
            and local presets.
          </p>
        </div>
        <div className={`status-pill status-${status}`}>
          <span>{statusLabel}</span>
          <strong>{statusText}</strong>
        </div>
      </header>

      <main>
        <section className="top-grid" aria-label="Audio controls">
          <div className="connect-panel tool-panel">
            <div className="panel-heading">
              <span>Input</span>
              <strong>Guitar connection</strong>
            </div>
            <label className="field-label" htmlFor="input-device">
              Input device
            </label>
            <select
              id="input-device"
              value={selectedDeviceId}
              onChange={(event) => handleDeviceChange(event.target.value)}
            >
              <option value="">Default system input</option>
              {devices.map((device, index) => (
                <option key={device.deviceId || index} value={device.deviceId}>
                  {getDeviceLabel(device, index)}
                </option>
              ))}
            </select>
            <div className="button-row">
              <button className="primary-action" type="button" onClick={handleConnect} disabled={status === 'connecting'}>
                {status === 'connected' ? 'Reconnect Guitar' : 'Connect Guitar'}
              </button>
              <button className="danger-action" type="button" onClick={handlePanic}>
                Panic
              </button>
            </div>
          </div>

          <div className="meter-panel tool-panel">
            <div className="panel-heading">
              <span>Meters</span>
              <strong>Input and output</strong>
            </div>
            <LevelMeter label="Input" meter={inputMeter} />
            <LevelMeter label="Output" meter={outputMeter} />
            <label className="slider-row master-row">
              <span>Master</span>
              <input
                type="range"
                min="0"
                max="1.25"
                step="0.01"
                value={masterVolume}
                onChange={(event) => handleMasterVolume(Number(event.target.value))}
              />
              <output>{Math.round(masterVolume * 100)}%</output>
            </label>
          </div>

          <TunerPanel tuner={tuner} connected={status === 'connected'} />
        </section>

        <section className="board-section" aria-label="Pedalboard">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Signal chain</span>
              <h2>Drag pedals to reorder</h2>
            </div>
            <span className={isDragging ? 'drag-state is-active' : 'drag-state'}>
              {isDragging ? 'Audio chain held until drop' : 'Drop to rebuild chain'}
            </span>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={pedalIds} strategy={horizontalListSortingStrategy}>
              <div className="pedal-chain">
                {pedals.map((pedal, index) => (
                  <SortablePedalCard
                    key={pedal.id}
                    index={index}
                    pedal={pedal}
                    onPatch={handlePedalPatch}
                    onParam={handlePedalParam}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        <section className="preset-section" aria-label="Presets">
          <div className="preset-panel tool-panel">
            <div className="panel-heading">
              <span>Presets</span>
              <strong>Saved in localStorage</strong>
            </div>
            <div className="preset-controls">
              <input
                type="text"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Preset name"
                aria-label="Preset name"
              />
              <button type="button" onClick={handleSavePreset}>
                Save
              </button>
              <select value={selectedPresetId ?? ''} onChange={(event) => handleLoadPreset(event.target.value)}>
                <option value="">Load preset</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleDeletePreset} disabled={!selectedPresetId}>
                Delete
              </button>
              <button type="button" onClick={handleReset}>
                Factory
              </button>
            </div>
          </div>

          <div className="next-panel tool-panel">
            <div className="panel-heading">
              <span>Version 2</span>
              <strong>Queued modules</strong>
            </div>
            <div className="module-tags">
              {['Chorus', 'Flanger', 'Phaser', 'Tremolo', 'Looper', 'Rhythm', 'Tap Tempo', 'MIDI EXP'].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

type SortablePedalCardProps = {
  index: number;
  pedal: Pedal;
  onPatch: (pedalId: string, patch: Partial<Omit<Pedal, 'params'>> & { params?: Record<string, number> }) => void;
  onParam: (pedalId: string, key: string, value: number) => void;
};

function SortablePedalCard({ index, pedal, onPatch, onParam }: SortablePedalCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pedal.id });
  const definition = getEffectDefinition(pedal.type);
  const active = pedal.enabled && !pedal.bypassed;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    '--pedal-accent': definition.accent,
  } as React.CSSProperties;

  return (
    <article
      ref={setNodeRef}
      className={`pedal-card ${active ? 'is-active' : 'is-muted'} ${isDragging ? 'is-dragging' : ''}`}
      style={style}
    >
      <div className="pedal-top">
        <button className="drag-handle" type="button" {...attributes} {...listeners} aria-label={`Move ${pedal.label}`}>
          <span />
          <span />
          <span />
        </button>
        <div>
          <span className="pedal-index">{String(index + 1).padStart(2, '0')}</span>
          <h3>{pedal.label}</h3>
          <p>{definition.description}</p>
        </div>
      </div>

      <PedalFace definition={definition} pedal={pedal} />

      <div className="pedal-actions" aria-label={`${pedal.label} state`}>
        <button
          type="button"
          className={pedal.enabled ? 'state-button is-on' : 'state-button'}
          onClick={() => onPatch(pedal.id, { enabled: !pedal.enabled })}
        >
          {pedal.enabled ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          className={pedal.bypassed ? 'state-button is-bypassed' : 'state-button'}
          onClick={() => onPatch(pedal.id, { bypassed: !pedal.bypassed })}
        >
          {pedal.bypassed ? 'Bypassed' : 'Bypass'}
        </button>
      </div>

      <div className="pedal-sliders">
        <label className="slider-row">
          <span>Mix</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={pedal.mix}
            onChange={(event) => onPatch(pedal.id, { mix: Number(event.target.value) })}
          />
          <output>{Math.round(pedal.mix * 100)}%</output>
        </label>
        <label className="slider-row">
          <span>Level</span>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.01"
            value={pedal.level}
            onChange={(event) => onPatch(pedal.id, { level: Number(event.target.value) })}
          />
          <output>{Math.round(pedal.level * 100)}%</output>
        </label>
        {definition.params.map((param) => (
          <label className="slider-row" key={param.key}>
            <span>{param.label}</span>
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={pedal.params[param.key] ?? param.defaultValue}
              onChange={(event) => onParam(pedal.id, param.key, Number(event.target.value))}
            />
            <output>{formatParamValue(param, pedal.params[param.key] ?? param.defaultValue)}</output>
          </label>
        ))}
      </div>
    </article>
  );
}

function PedalFace({ definition, pedal }: { definition: EffectDefinition; pedal: Pedal }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(220, rect.width || 220);
    const height = Math.max(96, rect.height || 96);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#151817';
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(255,255,255,0.08)';
    context.lineWidth = 1;
    for (let x = 16; x < width; x += 22) {
      context.beginPath();
      context.moveTo(x, 12);
      context.lineTo(x, height - 12);
      context.stroke();
    }

    context.strokeStyle = definition.accent;
    context.fillStyle = definition.accent;
    context.lineWidth = 2.5;
    context.globalAlpha = pedal.enabled && !pedal.bypassed ? 1 : 0.32;

    drawEffectGlyph(context, definition.type, width, height);

    context.globalAlpha = 0.18;
    context.fillRect(0, height - 6, width * pedal.mix, 6);
    context.globalAlpha = 1;
  }, [definition, pedal.bypassed, pedal.enabled, pedal.mix]);

  return (
    <div className="pedal-face" aria-hidden="true">
      <canvas ref={canvasRef} />
      <span>{definition.shortLabel}</span>
    </div>
  );
}

function drawEffectGlyph(context: CanvasRenderingContext2D, type: Pedal['type'], width: number, height: number) {
  if (type === 'ampEq') {
    const bars = [0.52, 0.38, 0.66, 0.46];
    bars.forEach((bar, index) => {
      const x = 34 + index * 44;
      context.fillRect(x, height * (1 - bar), 18, height * bar - 20);
    });
    return;
  }

  if (type === 'cabinet') {
    context.strokeRect(36, 24, width - 72, height - 44);
    for (let x = 52; x < width - 48; x += 16) {
      context.beginPath();
      context.moveTo(x, 28);
      context.lineTo(x - 16, height - 24);
      context.stroke();
    }
    context.beginPath();
    context.arc(width * 0.5, height * 0.53, 19, 0, Math.PI * 2);
    context.stroke();
    return;
  }

  if (type === 'delay') {
    [0.88, 0.58, 0.36, 0.22].forEach((scale, index) => {
      context.globalAlpha = scale;
      context.beginPath();
      context.arc(54 + index * 42, height * 0.52, 14 + index * 2, 0, Math.PI * 2);
      context.stroke();
    });
    context.globalAlpha = 1;
    return;
  }

  if (type === 'reverb') {
    for (let index = 0; index < 5; index += 1) {
      context.globalAlpha = 0.95 - index * 0.13;
      context.beginPath();
      context.arc(width * 0.5, height * 0.78, 24 + index * 15, Math.PI * 1.1, Math.PI * 1.9);
      context.stroke();
    }
    context.globalAlpha = 1;
    return;
  }

  context.beginPath();
  for (let x = 18; x < width - 18; x += 4) {
    const phase = (x / (width - 36)) * Math.PI * 4;
    let y = height * 0.52 + Math.sin(phase) * 22;

    if (type === 'compressor') {
      y = height * 0.52 + Math.sin(phase) * 13;
    }

    if (type === 'drive') {
      y = clamp(y, height * 0.34, height * 0.7);
    }

    if (type === 'noiseGate' && x < width * 0.42) {
      y = height * 0.52;
    }

    if (x === 18) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();

  if (type === 'noiseGate') {
    context.beginPath();
    context.moveTo(width * 0.42, height * 0.25);
    context.lineTo(width * 0.42, height * 0.78);
    context.stroke();
  }
}

function LevelMeter({ label, meter }: { label: string; meter: MeterReading }) {
  const level = meterPercent(meter);
  const peak = clamp(meter.peak, 0, 1);

  return (
    <div className="level-meter">
      <div className="meter-label">
        <span>{label}</span>
        <output>{formatDb(meter.db)}</output>
      </div>
      <div className="meter-track">
        <span className="meter-fill" style={{ transform: `scaleX(${level})` }} />
        <span className="meter-peak" style={{ left: `${peak * 100}%` }} />
      </div>
    </div>
  );
}

function TunerPanel({ tuner, connected }: { tuner: TunerReading; connected: boolean }) {
  const cents = clamp(tuner.cents, -50, 50);
  const needleLeft = ((cents + 50) / 100) * 100;
  const tuned = tuner.frequency !== null && Math.abs(tuner.cents) <= 5;

  return (
    <div className="tuner-panel tool-panel">
      <div className="panel-heading">
        <span>Tuner</span>
        <strong>{connected ? 'Input pitch' : 'Waiting for input'}</strong>
      </div>
      <div className={tuned ? 'tuner-note is-tuned' : 'tuner-note'}>
        <span>{tuner.note}</span>
        <output>{tuner.frequency ? `${tuner.frequency.toFixed(1)} Hz` : 'No pitch'}</output>
      </div>
      <div className="tuner-scale" aria-label="Tuning cents">
        <span>-50</span>
        <span>0</span>
        <span>+50</span>
        <i style={{ left: `${needleLeft}%` }} />
      </div>
      <div className="tuner-readout">
        <span>{tuner.frequency ? `${tuner.cents > 0 ? '+' : ''}${tuner.cents} cents` : 'Play a single note'}</span>
        <span>{Math.round(tuner.confidence * 100)}%</span>
      </div>
    </div>
  );
}

export default App;
