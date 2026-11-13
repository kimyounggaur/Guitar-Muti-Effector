// Development-only calibration harness. Renders the real effects, not a simulated transfer curve.
import { usePresetStore } from '../src/store/presetStore';
import { NoiseGateEffect, prepareNoiseGate } from '../src/audio/nodes/NoiseGateEffect';
import { CompressorEffect, prepareCompressor } from '../src/audio/nodes/CompressorEffect';
import { DriveEffect } from '../src/audio/nodes/DriveEffect';
import { AmpEQEffect } from '../src/audio/nodes/AmpEQEffect';
import { CabinetIREffect } from '../src/audio/nodes/CabinetIREffect';
import { ModulationEffect } from '../src/audio/nodes/ModulationEffect';
import { DelayEffect } from '../src/audio/nodes/DelayEffect';
import { ReverbEffect } from '../src/audio/nodes/ReverbEffect';
import type { EffectNodeWrapper, PedalType } from '../src/audio/types';

const status = document.querySelector<HTMLElement>('#status')!;
const output = document.querySelector<HTMLTextAreaElement>('#result')!;
const button = document.querySelector<HTMLButtonElement>('#start')!;
const clear = document.querySelector<HTMLButtonElement>('#clear')!;
const rmsOutput = document.querySelector<HTMLTextAreaElement>('#rms')!;
const peakOutput = document.querySelector<HTMLTextAreaElement>('#peaks')!;
const category = new URLSearchParams(location.search).get('category');
const key = `calibration-results-v1:${category || 'all'}`;
type Measurement = {id:string; rmsDb:number; peakDb:number};
let rows: Measurement[] = [];
try { rows = JSON.parse(sessionStorage.getItem(key) || '[]'); if (!Array.isArray(rows)) rows = []; } catch { rows = []; }
function showRows() {
  output.value = JSON.stringify(rows);
  rmsOutput.value = rows.map(row => row.rmsDb).join(',');
  peakOutput.value = rows.map(row => row.peakDb).join(',');
  status.textContent = `저장된 결과: ${rows.length}개`;
}
clear.addEventListener('click', () => { rows = []; sessionStorage.removeItem(key); showRows(); });
showRows();
const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
const constructors: Partial<Record<PedalType, new (context: AudioContext, id: string) => EffectNodeWrapper>> = {
  noiseGate: NoiseGateEffect, compressor: CompressorEffect, drive: DriveEffect, ampEQ: AmpEQEffect,
  cabinetIR: CabinetIREffect, modulation: ModulationEffect, delay: DelayEffect, reverb: ReverbEffect,
};

button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    const presets = usePresetStore.getState().presets.filter(p => p.origin === 'factory' && (!category || p.category === category));
    if (rows.some((row, index) => row.id !== presets[index]?.id)) throw new Error('Preset list changed; clear previous results and start over.');
    clear.disabled = true;
    for (let n = rows.length; n < presets.length; n++) {
      status.textContent = `측정 중 ${n + 1} / ${presets.length}`;
      const preset = presets[n];
      const rate = 44100, duration = 2.5;
      const offline = new OfflineAudioContext(2, rate * duration, rate);
      const ctx = offline as unknown as AudioContext;
      await Promise.all([prepareNoiseGate(ctx), prepareCompressor(ctx)]);
      const source = offline.createBufferSource();
      const input = offline.createBuffer(1, rate * duration, rate);
      const samples = input.getChannelData(0);
      const frequencies = [82.4069, 110, 146.832, 196];
      for (let i = 0; i < samples.length; i++) {
        const t = i / rate;
        let v = 0;
        for (let note = 0; note < frequencies.length; note++) {
          const x = t - (0.12 + note * 0.5);
          if (x < 0) continue;
          const env = Math.min(1, x / 0.008) * Math.exp(-x * 3.1);
          const f = frequencies[note];
          v += 0.15 * env * (Math.sin(2*Math.PI*f*x) + .45*Math.sin(4*Math.PI*f*x) + .2*Math.sin(6*Math.PI*f*x));
        }
        samples[i] = v;
      }
      source.buffer = input;
      let previous: AudioNode = source;
      const effects: EffectNodeWrapper[] = [];
      for (const pedal of preset.pedals) {
        if (!pedal.enabled || pedal.bypassed) continue;
        const Ctor = constructors[pedal.type];
        if (!Ctor) continue; // tuner, stopped looper and stopped rhythm are pass-through
        const effect = new Ctor(ctx, pedal.id);
        for (const [name, value] of Object.entries(pedal.params)) effect.setParam(name, value);
        effect.setBypass(false);
        previous.connect(effect.input);
        previous = effect.output;
        effects.push(effect);
      }
      previous.connect(offline.destination);
      // Let asynchronous recorded IR fetch/decode and debounced reverb generation complete before rendering.
      await wait(450);
      source.start();
      const buffer = await offline.startRendering();
      let sum = 0, peak = 0, count = 0;
      const begin = Math.floor(rate * 0.1);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const values = buffer.getChannelData(channel);
        for (let i = begin; i < values.length; i++) { const v = values[i]; sum += v*v; peak = Math.max(peak, Math.abs(v)); count++; }
      }
      const rmsDb = 20*Math.log10(Math.max(1e-12, Math.sqrt(sum/count)));
      const peakDb = 20*Math.log10(Math.max(1e-12, peak));
      if (!Number.isFinite(rmsDb) || !Number.isFinite(peakDb)) throw new Error(`Invalid result for ${preset.id}`);
      rows.push({id:preset.id, rmsDb:Math.round(rmsDb*100)/100, peakDb:Math.round(peakDb*100)/100});
      effects.forEach(effect => effect.dispose());
      sessionStorage.setItem(key, JSON.stringify(rows));
      showRows();
    }
    status.textContent = `완료: ${rows.length} / ${presets.length}`;
  } catch (error) {
    status.textContent = `실패: ${error instanceof Error ? error.message : String(error)}`;
  } finally { button.disabled = false; clear.disabled = false; }
});
