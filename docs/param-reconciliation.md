# 파라미터 대조표 (P3)

- 작성일: 2026-11-22
- 출처: ① `src/audio/types.ts` `createDefaultPedals()` 기본값, ② `src/audio/nodes/*` `paramHandlers`의 clamp(엔진), ③ `PedalDetailPanel.tsx` `getNumberRange()`(화면). 화면 범위가 따로 적힌 ④ `ControlKnobPanel.tsx` `controlMap`과 랙 패널(`readNumberParam`)도 함께 확인했습니다.
- 규칙: 값이 다르면 **좁은(안전한) 범위**를 채택합니다. 채택값은 `src/audio/params/schema.ts`에 있습니다.
- `step`은 값의 해상도(저장·가져오기 정규화에서 이 간격으로 맞춤), `uiStep`은 +/− 버튼 간격입니다. 공장 프리셋 값이 소수 둘째 자리까지 쓰는 파라미터는 `step`을 0.01로 두고 화면 간격은 기존 값을 `uiStep`으로 유지했습니다(소리가 바뀌지 않게).

## 숫자 파라미터

| 페달.파라미터 | ① 기본값 | ② 엔진 범위 | ③ 화면 범위 (④) | 채택(기본 / 범위 / step) | 비고 |
|---|---|---|---|---|---|
| tuner.referenceA4 | 440 | 430~450 | 430~450 | 440 / 430~450 / 1 | 같음 |
| tuner.sensitivity | 64 | 0~100 | 0~100 | 64 / 0~100 / 1 | 같음 |
| tuner.smoothing | 62 | 0~100 | 0~100 | 62 / 0~100 / 1 | 같음 |
| noiseGate.thresholdDb | −48 | **−80~0** (워크릿) | −60~−10 | −48 / −60~−10 / 1 | 화면 쪽(좁음) 채택 |
| noiseGate.attackMs | 8 | 제한 없음(워크릿 전달) | 1~200 (랙) / 0~100(기본값) | 8 / 1~200 / 1 | 랙 패널 범위 채택 |
| noiseGate.holdMs | 80 | 제한 없음 | 0~1000 (랙) / 0~100 | 80 / 0~1000 / 1 | 랙 패널 범위 채택 |
| noiseGate.releaseMs | 180 | 제한 없음 | 20~500, step 5 | 180 / 20~500 / 1 (ui 5) | 프리셋에 35, 231 같은 5의 배수가 아닌 값이 있어 step 1 |
| compressor.threshold | −28 | −60~−10 | −60~−10 | −28 / −60~−10 / 1 | 같음 |
| compressor.ratio | 3.5 | 1~20 | 1~20 | 3.5 / 1~20 / 0.1 | 같음 |
| compressor.attack | 0.012 | 0.001~0.1 | 0.001~0.1 | 같음 / 0.001 | 같음 |
| compressor.release | 0.22 | 0.05~1 | 0.05~1 | 같음 / 0.01 | 같음 |
| compressor.knee | 18 | 0~40 | 0~40 | 같음 / 1 | 같음 |
| compressor.sustain·mix·level | 42·78·72 | 0~100 | 0~100 | 같음 / 1 | 같음 |
| drive.drive·tone·level·mix | 48·58·72·100 | 0~100 | 0~100 | 같음 / 1 | 같음 |
| drive.bias | 0 | −1~1 | −1~1 | 0 / −1~1 / 0.01 | 같음 |
| ampEQ.lowCut | 70 | **40~160** | 40~200 | 70 / **40~160** / 1 | 엔진 쪽(좁음) 채택. 공장 프리셋 일부 166 → 엔진이 이미 160으로 자르던 값이라 소리 변화 없음 |
| ampEQ.bass·mid·treble·presence | 2·−1·2·1 | −12~12 | −12~12, step 0.5 | 같음 / 0.01 (ui 0.5) | 프리셋 값이 0.01 단위 |
| ampEQ.midFreq | 760 | 250~1500 | 250~1500, step 10 | 760 / 250~1500 / 1 (ui 10) | 프리셋 값 1375 등 |
| ampEQ.midQ | 0.9 | 0.3~4 | 0.3~4, step 0.1 | 0.9 / 0.3~4 / 0.01 (ui 0.1) | 프리셋 값이 0.01 단위 |
| ampEQ.level | 72 | 0~100 | 0~100 | 같음 | 같음 |
| cabinetIR.lowCut | 80 | 40~200 | 40~200 | 같음 / 1 | 같음 |
| cabinetIR.highCut | 6500 | 3000~12000 | 3000~12000, step 100 | 같음 / 1 (ui 100) | |
| cabinetIR.mix·level | 100·72 | 0~100 (기존 엔진은 mix ≤ 1을 비율로 해석) | 0~100 | 같음 / 1 | |
| modulation.rate | 0.85 | 0.05~20 | 0.05~20, step 0.05 | 같음 / 0.01 (ui 0.05) | 프리셋 값 0.01 단위 |
| modulation.depth·tone·stereoWidth·mix | 44·68·52·42 | 0~100 | 0~100 | 같음 / 1 | |
| modulation.feedback | 0.18 | **0~0.95** | **0~100** | 0.18 / **0~0.95** / 0.01, safetyMax 0.95 | **화면이 0~100으로 표시하던 불일치(S2와 같은 종류)를 엔진 범위로 맞춤** |
| delay.timeMs | 420 | 20~2000 | 20~2000, step 10 | 같음 / 1 (ui 10) | |
| delay.feedback | 0.32 | 0~0.85 | 0~0.85 | 0.32 / 0~0.85 / 0.01, **safetyMax 0.85** | 안전 상한 |
| delay.mix·tone·flutter | 28·62·0 | 0~100 | 0~100 | 같음 / 1 | |
| reverb.decay | 0.9 | 0.2~10 | 0.2~10, step 0.1 | 같음 / 0.01 (ui 0.1) | |
| reverb.preDelay | 22 | 0~200 | 0~200 | 같음 / 1 | |
| reverb.lowCut | 120 | 20~500 | 20~500 | 같음 / 1 | |
| reverb.highCut | 7600 | 1000~12000 | 1000~12000, step 100 | 같음 / 1 (ui 100) | |
| reverb.mix·level | 24·72 | 0~100 | 0~100 | 같음 | |
| looper.level·overdubLevel·feedback | 85·85·100 | 0~100 | 0~100 | 같음 | |
| rhythm.volume | 70 | 0~100 | 0~100 | 같음 | |
| **(삭제)** modulation/delay/looper/rhythm.bpm | 120 | 40~240 | 40~240 | — | 템포는 `tempoStore` 한 곳으로(§3.3) |

## 선택형·켜기형 파라미터

| 페달.파라미터 | 선택지(엔진이 받는 값) | 기본값 |
|---|---|---|
| tuner.mode | chromatic, guitar, bass, ukulele | guitar |
| drive.mode | overdrive, crunch, distortion, fuzz | overdrive |
| cabinetIR.cabinetType | 1x12, 2x12, 4x12, openBack, custom | 2x12 |
| cabinetIR.mic | dynamic, ribbon, condenser, mixed | dynamic |
| cabinetIR.customIRName | 글자(최대 200자), 업로드한 IR 이름 | (없음) |
| modulation.mode | chorus, flanger, phaser, tremolo, vibrato | chorus |
| modulation.division | 1/1, 1/2, 1/4, 1/8, dotted1/8, 1/16 | 1/4 |
| delay.mode | digital, analog, tape, slapback, pingpong | digital |
| delay.division | 1/4, 1/8, dotted1/8, 1/16 | 1/4 |
| reverb.mode | room, hall, plate, spring, ambient | room |
| looper.quantize | off, 1bar, 2bar, 4bar | off |
| rhythm.pattern | metronome, rock1, rock2, bluesShuffle, funk, ballad, sixEight, pop | metronome |
| modulation.sync, delay.sync, looper.reverse, looper.halfSpeed, rhythm.playing | true / false | false |

엔진이 받는 옛 별칭(`thresholdDb`(컴프레서), `gain`(드라이브), `bassDb` 등, `cabinet`, `size`, `damping`, `referenceHz`)은 저장 데이터 호환을 위해 엔진에 그대로 남겨 두었고 스키마에는 넣지 않았습니다. 스키마에 없는 키는 정규화 때 지금처럼 그대로 통과합니다.

현재 캐비닛·모듈레이션·딜레이·리버브의 Mix 노브는 전 구간에서 퍼센트를 사용합니다. 예를 들어 2%에서 1%로 줄이면 이펙트 신호 비율도 0.02에서 0.01로 줄어듭니다. 예전 페달 데이터의 소수 비율(예: 딜레이 0.22)은 불러올 때 22%로 변환합니다. 숫자 1은 옛 파라미터 구성이 확인될 때만 100%로 변환하며, 현재 형식에서 저장한 1은 1%로 유지합니다.

## 템포 기준선 차이 (P3 확인 사항)

P0 프리셋 측정기는 페달마다 저장된 `bpm` 값(지연 68~100, 모듈레이션 90~140)을 그대로 넣었습니다.
그러나 실제 앱은 프리셋을 불러올 때 `preset.tempoBpm`으로 그 값을 덮어썼기 때문에, 이 값은 앱에서 한 번도 소리로 나간 적이 없습니다.

P3에서는 측정기도 앱과 똑같이 `setTempo(preset.tempoBpm)`를 사용합니다. 그 결과 템포 동기(sync)가 켜진 13개 프리셋이 P0 기준선과 ±0.1 dB 넘게 다릅니다.

같은 측정을 P2 코드(9c72cf8)에 앱과 같은 템포를 넣어 돌리면 P3 결과와 108개 모두 소수 둘째 자리까지 같습니다. 즉 소리 변화가 아니라 측정 방식 차이입니다.
2026-11-22 사용자 승인을 받아 `tests/e2e/baseline.json`의 presets 항목을 P2 코드 + 앱 템포로 다시 기록했습니다(layout 항목은 그대로).

| 프리셋 | peak 차이 | rms 차이 |
| --- | --- | --- |
| Ambient 01 | −0.34 | +0.13 |
| Ambient 03 | −1.73 | −0.37 |
| Ambient 05 | −1.14 | +0.04 |
| Ambient 07 | −0.33 | +0.04 |
| Ambient 09 | +0.13 | +0.47 |
| Ambient 11 | +0.69 | +1.24 |
| Modulation 01 | +0.01 | +0.24 |
| Modulation 04 | +1.36 | 0.00 |
| Modulation 07 | +1.49 | +0.22 |
| Modulation 10 | −0.10 | −0.06 |
| Experimental 01 | −0.58 | −0.10 |
| Experimental 05 | −0.03 | +0.79 |
| Experimental 09 | −0.32 | +1.24 |

가장 큰 peak는 두 측정 모두 −26.43 dBFS로 같습니다.
