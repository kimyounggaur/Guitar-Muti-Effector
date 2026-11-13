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

const button = document.querySelector<HTMLButtonElement>('#start')!;
const status = document.querySelector<HTMLElement>('#status')!;
const result = document.querySelector<HTMLTextAreaElement>('#result')!;
const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
const constructors: Partial<Record<PedalType, new (context: AudioContext, id: string) => EffectNodeWrapper>> = {
 noiseGate: NoiseGateEffect, compressor: CompressorEffect, drive: DriveEffect, ampEQ: AmpEQEffect,
 cabinetIR: CabinetIREffect, modulation: ModulationEffect, delay: DelayEffect, reverb: ReverbEffect,
};
button.onclick = async () => {
 try {
  button.disabled = true;
  const index = Number(new URLSearchParams(location.search).get('index') ?? '96');
  const preset = usePresetStore.getState().presets.filter(p => p.origin === 'factory')[index];
  status.textContent = '측정 중';
      const rate = 44100, duration = 2.5;
      const offline = new OfflineAudioContext(10, rate * duration, rate);
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
      const merger = offline.createChannelMerger(10);
      const labels = ['input'];
      source.connect(merger, 0, 0);
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
        labels.push(pedal.type);
        effect.output.connect(merger, 0, labels.length - 1);
        effects.push(effect);
      }
      merger.connect(offline.destination);
      // Let asynchronous recorded IR fetch/decode and debounced reverb generation complete before rendering.
      await wait(450);
      source.start();
      const buffer = await offline.startRendering();
      const stageResults = labels.map((label, channel) => {
        const values = buffer.getChannelData(channel);
        let sum = 0, peak = 0;
        const begin = Math.floor(rate * .1);
        for (let i = begin; i < values.length; i++) { const v=values[i]; sum += v*v; peak = Math.max(peak, Math.abs(v)); }
        return { label, rmsDb: 20*Math.log10(Math.max(1e-12, Math.sqrt(sum/(values.length-begin)))), peakDb: 20*Math.log10(Math.max(1e-12,peak)) };
      });
      result.value = JSON.stringify({ preset: preset.id, settings: preset.pedals, stages: stageResults });
      effects.forEach(effect => effect.dispose());
      status.textContent = '완료';
  } catch (error) { status.textContent = String(error); }
  finally { button.disabled = false; }
};
