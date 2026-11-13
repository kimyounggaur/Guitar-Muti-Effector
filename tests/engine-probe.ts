import { AudioEngine } from '../src/audio/AudioEngine';
const button = document.querySelector<HTMLButtonElement>('#run')!;
const result = document.querySelector<HTMLPreElement>('#result')!;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
button.onclick = async () => {
  button.disabled = true;
  let generator: AudioContext | null = null;
  let engine: AudioEngine | null = null;
  const devices = navigator.mediaDevices;
  const original = devices.getUserMedia;
  try {
    result.textContent = '검사 중';
    generator = new AudioContext();
    const dest = generator.createMediaStreamDestination();
    const merger = generator.createChannelMerger(2);
    const oscillators = [0.2, 0.05].map((amplitude, channel) => {
      const oscillator = generator!.createOscillator();
      const gain = generator!.createGain();
      oscillator.frequency.value = 440;
      gain.gain.value = amplitude;
      oscillator.connect(gain).connect(merger, 0, channel);
      oscillator.start();
      return oscillator;
    });
    merger.connect(dest);
    await generator.resume();
    devices.getUserMedia = async () => dest.stream;
    engine = new AudioEngine();
    await engine.connect('', 0);
    const graph = engine as any;
    const context: AudioContext = graph.audioContext;
    // No signal is sent to the user's system output.
    graph.outputMeter.output.disconnect();
    const split = context.createChannelSplitter(2);
    graph.outputMeter.output.connect(split);
    const analysers = [context.createAnalyser(), context.createAnalyser()];
    split.connect(analysers[0], 0); split.connect(analysers[1], 1);
    analysers.forEach(a => { a.fftSize = 2048; });
    const sink = context.createMediaStreamDestination();
    analysers.forEach(a => a.connect(sink));
    engine.setMasterVolume(1);
    const read = async (channel: '1' | '2' | 'mix') => {
      engine!.setInputChannel(channel);
      await wait(350);
      return analysers.map(analyser => {
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return Math.sqrt(samples.reduce((sum, n) => sum + n*n, 0) / samples.length);
      });
    };
    const one = await read('1'), two = await read('2'), mix = await read('mix');
    const ok = one.every(x => x > 0.04) && two.every(x => x > 0.005) && one[0] > two[0] * 2 && Math.abs(one[0]-one[1]) < .02 && Math.abs(two[0]-two[1]) < .02 && mix[0] > two[0] && mix[0] < one[0];
    if (!ok) throw new Error(`선택 결과 ${JSON.stringify({one,two,mix})}`);
    engine.panicDisconnect();
    const stopped = dest.stream.getTracks().every(track => track.readyState === 'ended');
    if (!stopped) throw new Error('PANIC 후 가상 입력 트랙이 종료되지 않음');
    oscillators.forEach(o => o.stop());
    result.textContent = `통과\n입력1 L/R ${one.map(x => x.toFixed(4)).join('/')}\n입력2 L/R ${two.map(x => x.toFixed(4)).join('/')}\n합치기 L/R ${mix.map(x => x.toFixed(4)).join('/')}\nPANIC 입력 트랙 종료 확인`;
  } catch (e) { result.textContent = `실패: ${e instanceof Error ? e.message : String(e)}`; }
  finally {
    devices.getUserMedia = original;
    if (engine) await engine.stop().catch(() => {});
    if (generator && generator.state !== 'closed') await generator.close().catch(() => {});
    button.disabled = false;
  }
};
