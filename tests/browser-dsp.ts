import { createSafetyLimiter, prepareSafetyLimiter } from '../src/audio/nodes/SafetyLimiterEffect';
const result = document.querySelector<HTMLPreElement>('#results')!;
const button = document.querySelector<HTMLButtonElement>('#run')!;
button.addEventListener('click', async () => {
  button.disabled = true;
  result.textContent = '검사 중';
  try {
    const rate = 48000;
    const offline = new OfflineAudioContext(2, 4096, rate);
    await prepareSafetyLimiter(offline as unknown as AudioContext);
    const limiter = createSafetyLimiter(offline as unknown as AudioContext);
    const input = offline.createBuffer(2, 4096, rate);
    input.getChannelData(0)[512] = 4;
    input.getChannelData(1)[512] = -2;
    input.getChannelData(0)[1024] = .2;
    const source = offline.createBufferSource();
    source.buffer = input;
    source.connect(limiter).connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    const left = rendered.getChannelData(0);
    const right = rendered.getChannelData(1);
    const peak = Math.max(...left.map(Math.abs), ...right.map(Math.abs));
    const first = left.findIndex(x => Math.abs(x) > 1e-5);
    if (peak > .80001 || first !== 512 || Math.abs(right[512]) > .80001 || left[512] <= 0) {
      throw new Error(`리미터 실패: peak=${peak}, first=${first}, right=${right[512]}`);
    }
    const irResult: string[] = [];
    for (const name of ['dynamic', 'mixed']) {
      const response = await fetch(`/irs/cab_4x12_${name}.wav`);
      if (!response.ok) throw new Error(`IR ${name}: HTTP ${response.status}`);
      const buffer = await offline.decodeAudioData(await response.arrayBuffer());
      if (!buffer.length || !buffer.numberOfChannels || buffer.duration <= 0) throw new Error(`IR ${name}: 빈 음원`);
      irResult.push(`${name}: ${buffer.numberOfChannels}채널, ${buffer.length}샘플, ${buffer.sampleRate}Hz`);
    }
    result.textContent = `통과\n리미터 peak ${peak.toFixed(4)}, 입력 512샘플 → 출력 ${first}샘플, 좌우 링크 ${right[512].toFixed(4)}\nIR ${irResult.join('; ')}`;
  } catch (e) { result.textContent = `실패: ${e instanceof Error ? e.message : String(e)}`; }
  finally { button.disabled = false; }
});
