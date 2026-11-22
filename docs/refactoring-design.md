# 기타 멀티이펙터 웹앱 리팩토링 설계 문서

- 작성일: 2026-11-22
- 대상 저장소: [kimyounggaur/Guitar-Muti-Effector](https://github.com/kimyounggaur/Guitar-Muti-Effector) `main` (커밋 `7377791`, 2026-11-13)
- 근거 자료: Google Drive 「기타 멀티이펙터 웹앱 분석 — 수정·보완 목록.md」(2026-11-12, 43개 항목·결정 7개)
- 문서 성격: 설계 문서. 저장소 코드는 이번 작업에서 읽기만 했고 수정하지 않았습니다.

---

## 0. 먼저 알아야 할 점

분석 문서는 **11월 12일** 상태를 기준으로 쓰였습니다. 그런데 바로 다음 날인 **11월 13일** 커밋 `7377791`("Improve guitar multi-effector safety, playback and usability", 98개 파일, +3,058/−3,998줄)이 분석 항목의 대부분을 이미 고쳤습니다.

2026-11-22에 최신 `main`을 받아 다시 확인한 결과는 다음과 같습니다.

| 확인 | 결과 |
| --- | --- |
| `npm test` | 통과 (안전 13건, 컴프레서 3건, 노이즈 게이트 2건, 리미터 2건, 루퍼 검사) |
| `npm run build` | 통과 (타입 검사 포함, JS 428KB / CSS 142KB, 오프라인 캐시 15개 파일) |
| `npm audit` | 취약점 0건 (M4 해결) |
| CI | `main` 푸시 시 `npm ci → npm test → npm run build` 성공해야 배포 (M3 해결) |
| 화면 측정 (Playwright, 크롬) | 아래 §2.3 참고 |

따라서 이 설계 문서는 **"43개를 처음부터 고치는 계획"이 아니라** 다음 세 가지를 다룹니다.

1. 43개 항목 각각이 지금 어떤 상태인지 정리합니다 (§2).
2. 아직 남은 항목을 마무리합니다 (§5의 1·2단계).
3. 빠르게 한 번에 고치면서 생긴 **구조적 부채**를 정리합니다 (§3, §5의 3~6단계). 지금 코드는 동작은 하지만, 같은 정보가 여러 곳에 흩어져 있어 다음 수정 때 같은 종류의 버그가 다시 생기기 쉬운 구조입니다.

---

## 1. 목표와 비목표

### 1.1 목표

- **G1. 안전 보장 유지**: 리팩토링 중 S1~S7(볼륨 급상승 경로)이 한 번도 되살아나지 않게 합니다. 모든 단계는 안전 테스트가 통과해야 합니다.
- **G2. 단일 진실 원천(Single source of truth)**: 파라미터 범위, 템포, 저장 상태, 페달 메타데이터를 각각 한 곳에서만 정의합니다.
- **G3. 계층 분리**: 오디오 엔진 ↔ 상태(store) ↔ 화면(React) 사이의 의존 방향을 한쪽으로 고정합니다.
- **G4. 남은 사용성 문제 해결**: 휴대폰 화면 길이, 작은 글자, 영어 오류 문구.
- **G5. 검증 자동화 확대**: 지금은 사람이 브라우저에서 확인하는 화면·음질 측정을 CI에서 돌 수 있게 합니다.

### 1.2 비목표

- 새 이펙터 추가, 디자인 전면 교체, 프레임워크 교체(React·Vite·zustand 유지).
- 저장소 이름·주소 변경 (결정 7: 화면 표기만 고침. 주소를 바꾸면 기존 링크가 끊김).
- 실제 기타·오디오 인터페이스·실기기 휴대폰 검증 자동화 (사람이 할 확인 목록으로 남깁니다, §7).

---

## 2. 현재 상태: 43개 항목 대조

### 2.1 표기

- ✅ **해결**: 코드와 테스트(또는 이번 측정)로 확인
- 🟡 **부분 해결**: 핵심은 고쳤지만 남은 부분이 있음
- 🔍 **재측정 필요**: 코드상 고쳐진 것으로 보이지만 수치로 다시 확인하지 않음
- ❌ **남음**

근거 표기: [코드] 코드를 읽어 확인, [테스트] 저장소 자동 테스트가 검사, [측정] 이번에 브라우저로 측정.

### 2.2 항목별 현황

#### 1순위 — 귀와 장비 안전

| 항목 | 상태 | 지금 코드 | 남은 일 |
| --- | --- | --- | --- |
| S1 노브 줄이면 100% | ✅ [코드] | `KnobControl`이 각도 대신 **위아래 상대 드래그**(160px = 전체 범위)로 바뀜. 터치는 드래그 비활성, +/− 버튼 제공 | 노브 경계값 단위 테스트 추가(§6) |
| S2 딜레이 Feedback 발산 | ✅ [코드][테스트] | 최대 0.85로 제한, 되돌림 경로에 ±0.8 클리퍼, 톤 필터 Q 0.5(공진 없음). `delay feedback stays bounded` 테스트 | — |
| S3 PANIC 후 소리 부활 | ✅ [코드][테스트] | `panicDisconnect()`가 엔진 기억 볼륨 0, 트랙 정지, 연결 세대 무효화 후 `stop()`으로 컨텍스트 종료 | — |
| S4 익스프레션 페달 스침 | ✅ [코드][테스트] | P2: 익스프레션 페달은 볼륨 페달(`expressionGain`, 0~1, 감쇄만)로 `chainOutput → expressionGain → presetTrim → limiter → master` 경로에 연결. 마스터 숫자를 바꾸지 않음(e2e), 마스터 30%에서 페달 100%여도 30% 이하(단위 테스트). 휴대폰에서 한 번 탭으로 값이 바뀌지 않음(e2e) | — |
| S5 프리셋이 마스터 덮어씀 | ✅ [코드][테스트] | 마스터를 프리셋에서 분리. 프리셋별 `outputTrimDb`는 **감쇄만** 허용(−36~0dB), 108개 측정 보정 | — |
| S6 TAP을 마스터 노브가 덮음 | ✅ [측정] | 1280·1440·1920px 모두 TAP 버튼 가운데·좌·우·위·아래 5점이 TAP으로 눌림 | — |
| S7 최종 리미터 없음 | ✅ [코드][테스트] | `chainOutput → presetTrim → safetyLimiter(AudioWorklet) → master → outputMeter → destination` 순서 고정, 테스트로 검사 | — |

#### 2순위 — 핵심 기능

| 항목 | 상태 | 지금 코드 | 남은 일 |
| --- | --- | --- | --- |
| F1 한쪽 귀 | ✅ [코드] | 입력 채널 선택(1/2/합치기) 후 모노로 합쳐 양쪽 출력 | 실제 인터페이스 확인(§7) |
| F2 루퍼 사용 불가 | ✅ [테스트] | `LooperPanel` 연결, 왼쪽 "루퍼 열기" 동작. P1 재측정(`tests/looper-scenarios.test.mjs`): 4 Bars 3초 녹음 → 3초 유지(1샘플 아님), 레벨 85% → −1.41dB(이중 감쇄 없음), 90BPM 1마디 = 2.667초, 녹음 전 할당 0바이트, 이음매 크로스페이드, 오버더브 지연 보정 코드 있음 | — |
| F3 노이즈 게이트 미동작 | ✅ [코드][테스트] | AudioWorklet 게이트, 히스테리시스·hold·release 테스트. P1 재측정(`tests/e2e/dsp.spec.ts`): −46dBFS 백색잡음, Threshold 최대 → Clean 01 무음, High Gain 01 −129.7dBFS (기준 ≤ −80) | — |
| F4 IR 7개 404 | ✅ [코드] | 4×12 Dynamic·Mixed 2개는 실제 CC0 IR, 나머지 캐비닛·리버브는 합성. P2: 합성 선택지에 "합성" 표시와 배지, `public/irs/NOTICE.md`에 합성 목록 | 실제 IR 추가는 사람이 라이선스 확인 후 |
| F5 선택하면 꺼짐 | ✅ [코드] | LCD에서 선택(`onSelect`)과 켜기·끄기(`onToggle`) 버튼 분리 | — |
| F6 표시와 실제 소리 불일치 | ✅ [코드] | 세션 자동 저장(300ms 디바운스), 첫 실행 시 첫 프리셋 실제 적용 | 저장 구조 정리(§3.4) |
| F7 재연결 시 튜너 멈춤 | ✅ [테스트] | P1 재측정(`tests/e2e/audio.spec.ts`, 가짜 마이크로 E2→E4 음 순서 입력): 정지하면 표시가 비워지고, 재연결 후 튜너가 화면에 보이면 1초 안에 음 표시. 튜너는 화면에 보일 때만 분석(P2) | — |
| F8 템포 미반영 | 🟡 [코드] | `App.tsx`의 구독 코드가 템포를 각 페달 `params.bpm`에 복사 | **템포가 두 곳에 저장됨** → §3.3에서 구조로 해결 |
| F9 동작 안 하는 조작부 14곳 | ✅ [테스트] | `docs/controls-audit.md`: P2에서 무동작 "Amp EQ" 바로가기와 중복 Depth 다이얼 삭제, 게이트 "Decay" → "릴리스", "Auto mode" → "게이트 켜기" | — |
| F10 프리셋 이름 | ✅ [코드] | 이름이 실제 켜진 이펙트로부터 생성됨(예: "Clean 01 · Clean / Room reverb"), 측정 보정값 포함 | — |

#### 3순위 — 화면과 사용성

| 항목 | 상태 | 지금 (이번 측정) | 남은 일 |
| --- | --- | --- | --- |
| U1 휴대폰 34화면 | 🟡 [측정] | 390px에서 **8.3화면**(6,984px). 연결 버튼 0.2화면, PANIC 맨 위. 데스크톱은 연결 버튼이 첫 화면 안 | 휴대폰 3~4화면 목표(§3.6) |
| U2 페달 이름 잘림 | ✅ [코드] | `TUN`, `GATE` 같은 약칭 사용. 단 데스크톱 LCD에서 "NOISE G..."로 잘림 | 데스크톱 라벨도 약칭 통일 |
| U3 우측 하단 패널 깨짐 | 🟡 [측정] | TAP 겹침 해소. **왼쪽 브랜드 판의 "Guitar Multi-effector" 글자가 판 밖으로 넘침**(1440px). 튜너 랙 오른쪽 장식이 화면 폭을 2~4px 넘겨 **가로 스크롤 발생**(1280·1440·1920px 모두) | 두 가지 수정 |
| U4 작은 글자·명암 | ❌ [측정] | 390px 기준 글자 요소 977개 중 **708개가 11px 미만**, 최소 8px | 12px 하한, 색 토큰 정리(§3.6) |
| U5 터치 조작 | ✅ [측정] | 노브 터치 드래그 비활성 + +/− 버튼, 순서 변경용 "← 앞 / 뒤 →" 버튼. 390px에서 44px 미만 터치 대상 **4개**(이전 483개) | 4개 확인 |
| U6 확인 절차 | ✅ [코드] | 초기화·덮어쓰기·삭제·루프 지우기에 확인 창. 공장 프리셋은 항상 코드에서 로드 | `window.confirm`을 앱 안 대화상자로 교체(선택) |
| U7 내보내기 중복 | ✅ [코드] | 사용자 프리셋만 JSON 파일로 저장, 가져올 때 같은 ID 건너뜀 | — |
| U8 언어 혼용 | 🟡 [코드] | 주요 문구 한국어화, 권한 거부 안내 있음. **영어 대체 문구 10곳 남음**(`'Could not connect guitar input.'`, `'AudioContext is not ready.'` 등), 화면에 `INPUT DEVICE`, `Default system input` | 문구 사전(§3.7) |
| U9 이름·아이콘 | ✅ [코드] | 탭 제목·화면 이름 "Guitar Multi-effector"로 통일, favicon·아이콘 있음 | — |

#### 4순위 — 성능

| 항목 | 상태 | 지금 코드 | 남은 일 |
| --- | --- | --- | --- |
| P1 초당 60회 전체 다시 그리기 | ✅ [테스트] | P1 재측정(`tests/e2e/rerender.spec.ts`, 개발 빌드, 연결 후 10초): `PatchHeader` 300회, `MeterPill` 600회, `InputSafetyNotice`(연결 패널의 과부하 표시) 60회. 그 외 컴포넌트 0회 | — |
| P2 안 보는 기능 계산 | ✅ [코드] | `useElementVisible`로 튜너·상세 패널이 보일 때만 계산 | — |
| P3 켜고 끌 때 그래프 재생성 | ✅ [코드][테스트] | 순서가 같으면 바이패스만 변경, 잔향 유지 | — |
| P4 쓰지 않는 코드 | 🟡 [코드] | 연결 안 된 컴포넌트 19개 삭제됨. **`hardware.css` 6,439줄**, 빌드 CSS 142KB 그대로 | CSS 분할(§3.6) |

#### 5순위 — 음질

| 항목 | 상태 | 지금 코드 | 남은 일 |
| --- | --- | --- | --- |
| Q1 잡음 증폭 | ✅ [테스트] | P1 재측정: −60dBFS 백색잡음, 게이트 바이패스. Clean 01 −30.5dB, High Gain 01 +5.3dB (기준 ≤ 12dB) | — |
| Q2 드라이브 과포화 | ✅ [테스트] | P1 재측정: Overdrive 48, 1kHz 입력 −40/−20/−6dBFS → 출력 peak −33.0/−13.3/−3.8dBFS. −40과 −6 사이 29.2dB 차이 (기준 ≥ 6dB) | — |
| Q3 Bias 치우침 | ✅ [코드][테스트] | 20Hz 하이패스 DC 차단, `drive bias does not emit a DC offset` 테스트 | — |
| Q4 컴프레서 6ms 지연 | ✅ [코드][테스트] | 내장 컴프레서 대신 AudioWorklet, "sample aligned" 테스트 | — |
| Q5 끈 뒤 잔향 처리 | ✅ [코드][테스트] | 바이패스 시 입력만 막고 잔향은 자연 감쇠 | — |
| Q6 흔들림 폭 과다 | ✅ [테스트] | P1 재측정(`tests/dsp-measure.test.ts`): 기본 코러스 0.81ms·0.85Hz → ±7.47센트, 테이프 플러터 최대 0.08ms·8Hz → ±6.95센트 (기준 ±15/±20) | — |
| Q7 지연·과부하 표시 | ✅ [코드] | 출력 지연 추정(ms), 입력 과부하 표시, 출력 장치 선택, 장치 분리 감지 | 왕복 지연은 실측 불가 → 안내 문구 |

#### 6순위 — 저장·유지보수

| 항목 | 상태 | 지금 코드 | 남은 일 |
| --- | --- | --- | --- |
| M1 저장 실패 시 흰 화면 | ✅ [코드][테스트] | `safeStorage`가 실패를 삼키고 안내 이벤트 발생. 공장 프리셋은 저장 안 함 | `pedalStore`에 `localStorage` 직접 접근 1곳 남음(§3.4) |
| M2 공장 프리셋 갱신 미반영 | ✅ [코드] | 공장 프리셋은 항상 코드 값, 예전 수정본은 "(이전 사용자 설정)"으로 이전 | — |
| M3 자동 검사 없음 | 🟡 | 테스트·CI 게이트 있음. **린트·화면 테스트 없음**, README 있음, **LICENSE 없음** | §6 |
| M4 취약점 8건 | ✅ [측정] | `npm audit` 0건 | — |
| M5 상표 표기 | 🟡 [코드] | 화면 표시는 정리됨. **코드 이름에 남음**: `CompressorLa2aPanel`, `DriveAmplitubePanel`, `La2aKnob`, `Amp5Knob`, CSS 주석 "Teletronix LA-2A-inspired", "AmpliTube 5 CS-inspired" | 이름 변경(§3.5) |
| M6 홈 화면·오프라인 | ✅ [코드] | `manifest.webmanifest`, 오프라인 캐시 빌드 스크립트 | 오프라인 실행 실측(§7) |

### 2.3 요약

| 상태 | 개수 | 항목 |
| --- | --- | --- |
| ✅ 해결 | 35 | S1 S2 S3 S4 S5 S6 S7 F1 F2 F3 F4 F5 F6 F7 F9 F10 U2 U5 U6 U7 U9 P1 P2 P3 Q1 Q2 Q3 Q4 Q5 Q6 Q7 M1 M2 M4 M6 (F1·F3·U2는 작은 후속 있음) |
| 🟡 부분 해결 | 7 | F8 U1 U3 U8 P4 M3 M5 |
| 🔍 재측정 필요 | 0 | — (P1, 2026-11-22에 모두 측정) |
| ❌ 남음 | 1 | U4 |

> 개수는 대략적인 분류입니다. 🔍 항목은 "고쳐지지 않았다"는 뜻이 아니라 "고쳐졌다는 수치 증거가 아직 없다"는 뜻입니다.

---

## 3. 구조 리팩토링 설계

11월 13일 수정은 문제를 빠르게 막는 데 집중했습니다. 그 결과 아래 부채가 생겼거나 남았습니다. 각 절은 **문제 → 목표 구조 → 바꿀 파일 → 완료 기준** 순서입니다.

### 3.1 현재 구조

```
src/
├─ App.tsx (573줄)               ← 상태 구독, 오디오 엔진 호출, 세션 저장, 템포 동기화, 프리셋 적용이 모두 여기에
├─ audio/
│  ├─ AudioEngine.ts (561줄)     ← 그래프 구성, 입력/출력 장치, PANIC, 이펙트 생성
│  ├─ types.ts (221줄)           ← Pedal 타입 + 기본 페달 + 파라미터 기본값
│  ├─ nodes/*.ts                 ← 이펙트마다 paramHandlers에서 clamp 범위를 각자 정의
│  └─ worklets/*.ts
├─ store/
│  ├─ pedalStore.ts              ← 'guitar-multi-effector-pedals-v1'에 따로 저장
│  ├─ presetStore.ts (616줄)     ← 공장 프리셋 108개 생성 로직 + 저장 + 가져오기/내보내기
│  ├─ factoryCalibration.ts
│  ├─ tempoStore.ts / audioStore.ts / safeStorage.ts
├─ components/
│  ├─ pedalboard/PedalDetailPanel.tsx (1,088줄) ← 드라이브·컴프레서·게이트 전용 패널 + 범위 표(getNumberRange)
│  └─ hardware/*, effects/*, preset/*, audio/*
└─ styles/hardware.css (6,439줄), globals.css (1,733줄)
```

### 3.2 문제 A: 파라미터 정의가 세 곳에 흩어짐

**지금**

- 기본값: `audio/types.ts`의 `createDefaultPedals()`
- 실제 허용 범위: 각 `nodes/*Effect.ts`의 `paramHandlers` 안 `clamp(...)` (예: 딜레이 feedback 0~0.85)
- 화면 범위·단위: `PedalDetailPanel.tsx`의 `getNumberRange()` (예: threshold −60~−10dB)

세 곳이 따로 놀면, 예를 들어 화면 최대값은 0.95인데 엔진은 0.85에서 자르는 식의 불일치가 다시 생깁니다(S2가 바로 이런 종류였습니다).

**목표 구조**: 페달 종류별 **파라미터 스키마** 하나를 두고 세 곳이 모두 이를 읽습니다.

```ts
// src/audio/params/schema.ts (신규)
export type NumberParamSpec = {
  kind: 'number'; default: number; min: number; max: number; step: number;
  unit?: 'dB' | 'Hz' | 'ms' | 's' | '%'; label: string;   // label은 §3.7 문구 사전 키
  safetyMax?: number;  // 안전상 엔진이 절대 넘지 않는 값 (예: delay.feedback 0.85)
};
export type EnumParamSpec<T extends string> = { kind: 'enum'; default: T; options: readonly T[]; label: string };
export type BoolParamSpec = { kind: 'bool'; default: boolean; label: string };
export type ParamSpec = NumberParamSpec | EnumParamSpec<string> | BoolParamSpec;

export const PEDAL_SCHEMAS = {
  delay: {
    timeMs:   { kind: 'number', default: 420, min: 20, max: 2000, step: 1, unit: 'ms', label: 'param.delay.time' },
    feedback: { kind: 'number', default: 0.32, min: 0, max: 0.85, step: 0.01, label: 'param.delay.feedback', safetyMax: 0.85 },
    // ...
  },
  // noiseGate, compressor, drive, ampEQ, cabinetIR, reverb, modulation, looper, rhythm, tuner
} as const satisfies Record<PedalType, Record<string, ParamSpec>>;

export const clampParam = (type: PedalType, name: string, value: unknown): PedalParamValue => { /* 스키마 기준 정규화 */ };
```

**바꿀 파일과 순서**

1. `schema.ts` 작성: 지금 `nodes/*.ts`의 clamp 값과 `getNumberRange()` 값을 표로 뽑아 대조하고, 다른 곳은 **좁은 쪽(안전한 쪽)**으로 맞춥니다. 대조표는 PR 설명에 남깁니다.
2. `types.ts`의 `createDefaultPedals()`가 스키마의 `default`로 생성하도록 변경합니다.
3. `normalizePedalParams()`(저장·가져오기 데이터 정규화)가 `clampParam()`을 쓰게 합니다. 이렇게 하면 오래된 저장 데이터나 가져온 파일에 범위 밖 값이 있어도 걸러집니다.
4. `PedalDetailPanel`의 `getNumberRange()`를 삭제하고 스키마를 읽게 합니다.
5. 각 `Effect` 클래스의 clamp는 **남겨 둡니다**(이중 안전장치). 단 숫자는 스키마에서 가져옵니다.

**완료 기준**

- 스키마 단위 테스트: 모든 페달·모든 숫자 파라미터에 대해 `min ≤ default ≤ max`, `safetyMax`가 있으면 `max ≤ safetyMax`.
- 공장 프리셋 108개의 모든 값이 스키마 범위 안에 있음을 테스트로 확인.

### 3.3 문제 B: 템포가 두 곳에 저장됨 (F8의 근본 원인)

**지금**: 템포는 `tempoStore.bpm`과 각 페달의 `params.bpm`(리듬, 루퍼, sync 켠 딜레이·모듈레이션)에 모두 있습니다. `App.tsx`의 구독 코드와 `handleLoadPreset`이 손으로 복사합니다. 복사 조건이 두 곳에 똑같이 적혀 있어 하나만 고치면 어긋납니다.

**목표 구조**

- `bpm`은 `tempoStore`에만 둡니다. 페달 `params`에서 `bpm`을 제거합니다.
- 엔진에 `AudioEngine.setTempo(bpm)`을 추가하고, 엔진이 템포를 쓰는 이펙트에 전달합니다.

```ts
// EffectNodeWrapper에 선택 메서드 추가
interface TempoAware { setTempo(bpm: number): void }

// AudioEngine
setTempo(bpm: number) {
  this.tempo = bpm;
  this.effectMap.forEach((e) => (e as Partial<TempoAware>).setTempo?.(bpm));
}
// 이펙트 생성 시에도 this.tempo를 넣어 줌
```

- 프리셋의 `tempoBpm`은 프리셋 메타데이터로만 유지합니다.
- 저장 데이터 이전: `normalizePedals()`에서 `params.bpm`을 읽어 버리되, 세션 복원 시 `tempoBpm`이 없으면 첫 번째 `params.bpm` 값을 템포로 씁니다.

**완료 기준**: `grep -rn "'bpm'" src/`가 스키마·엔진 외에 나오지 않음. TAP → 리듬 박자 변경, 프리셋 로드 → 리듬 박자 변경을 엔진 프로브 테스트로 확인.

### 3.4 문제 C: 저장이 세 갈래

**지금**

| 키 | 쓰는 곳 | 내용 |
| --- | --- | --- |
| `guitar-multi-effector-session-v2` | `App.tsx` | 페달·마스터·트림·템포·활성 프리셋 |
| `guitar-multi-effector-pedals-v1` | `pedalStore.ts` (`setPedals`, `reorderPedals`, `resetPedals` 등에서 매번) | 페달만 |
| `web-guitar-pedalboard-presets` | `presetStore.ts` | 사용자 프리셋 |

페달이 두 키에 이중으로 저장되고, `pedalStore.readStoredPedals()`는 `safeStorage`를 거치지 않고 `window.localStorage`를 직접 읽습니다. 저장 공간(약 5MB)은 같은 `kimyounggaur.github.io` 아래 다른 앱과 공유하므로 이중 저장은 손해입니다.

**목표 구조**: `src/store/persistence.ts` 하나가 모든 저장을 맡습니다.

```ts
const KEYS = { session: 'gme.session.v3', userPresets: 'gme.userPresets.v3' } as const;

export function loadSession(): SessionV3 | null;           // v2·v1 데이터가 있으면 이전 후 옛 키 삭제
export function startSessionAutosave(): () => void;        // 각 store 구독, 300ms 디바운스, 언마운트 시 해제
export function loadUserPresets(): PedalboardPreset[];
export function saveUserPresets(presets: PedalboardPreset[]): boolean;
```

**바꿀 파일과 순서**

1. `persistence.ts` 작성, `safeStorage`만 사용.
2. `App.tsx`의 첫 `useEffect`(세션 복원·자동 저장, 약 50줄)를 `persistence.ts`로 이동. `App`에서는 `useEffect(() => startSessionAutosave(), [])` 한 줄만 남깁니다.
3. `pedalStore`에서 `writeStoredPedals`, `readStoredPedals`, `savePedalsToStorage`, `loadPedalsFromStorage` 제거. 스토어는 메모리 상태만 다룹니다.
4. 이전 규칙: v1 키·v2 키를 읽어 v3로 옮긴 뒤 옛 키를 지웁니다. 옮기기에 실패하면 옛 키를 지우지 않습니다.

**완료 기준**: 저장 차단 상태·가득 찬 상태·v1만 있는 상태·v2만 있는 상태 4가지 시나리오 테스트 통과. `grep -rn "localStorage" src/`가 `safeStorage.ts`에서만 나옴.

### 3.5 문제 D: `App.tsx`가 오디오 조정 역할까지 맡음

**지금**: `App.tsx` 573줄 중 대부분이 오디오 연결·해제·PANIC·장치 변경·업로드 재생·프리셋 적용 핸들러입니다. 각 핸들러가 `audioOperationRef`로 경쟁 상태를 따로 막고, 오류 처리 문구도 각자 씁니다.

**목표 구조**: 계층과 의존 방향을 고정합니다.

```
components (React)  ──호출──▶  controller (오디오 조정)  ──호출──▶  AudioEngine
        │                             │
        └──────구독──────▶  stores (zustand, 순수 상태) ◀──갱신──┘
```

- **AudioEngine**: Web Audio 그래프만 다룸. store를 모릅니다.
- **controller** (`src/app/audioController.ts`, 신규): 사용자 동작 하나를 받아 엔진 호출과 store 갱신을 함께 처리합니다. 연결 세대 관리(`operation` 번호)를 한 곳에서 합니다.
- **stores**: 엔진을 모릅니다.
- **components**: controller 함수와 store만 씁니다. 엔진 직접 접근 금지.

```ts
// src/app/audioController.ts
export function createAudioController(engine: AudioEngine) {
  let operation = 0;
  const run = async <T>(task: (op: number) => Promise<T>, failKey: MessageKey) => { /* 세대 확인, isConnecting, 오류 문구 통일 */ };
  return {
    connect: () => run(async () => { /* 기존 handleConnect 내용 */ }, 'error.connect'),
    switchInput: (deviceId: string) => run(...),
    stop: () => run(...),
    panic: () => { /* 동기적으로 먼저 음소거, 그 뒤 stop */ },
    loadPreset: (preset: PedalboardPreset) => { /* 트림·페달·템포 적용 후 rebuild */ },
    togglePedal: (id: string) => { ... },
    setParam: (id: string, name: string, value: PedalParamValue) => { ... },
    setMasterVolume: (v: number) => { ... },
  };
}
// React에서는 Context로 하나만 제공
export const AudioControllerContext = createContext<ReturnType<typeof createAudioController> | null>(null);
```

- 또한 `LeftModePanel`, `App.handleTunerQuick`의 `document.querySelector(...).scrollIntoView` 4곳을 `ref` 기반 내비게이션(`useScrollTarget('looper')`)으로 바꿔 화면 구조 변경에 깨지지 않게 합니다.

**`PedalDetailPanel.tsx` 분할** (1,088줄)

| 새 파일 | 옮길 내용 |
| --- | --- |
| `pedalboard/PedalDetailPanel.tsx` | 선택된 페달에 맞는 패널 고르기만 (100줄 이내 목표) |
| `effects/DriveRackPanel.tsx` | `DriveAmplitubePanel`, `Amp5Knob`, `Amp5ModelSlot` → **상표 없는 이름**으로 변경 (M5) |
| `effects/CompressorRackPanel.tsx` | `CompressorLa2aPanel`, `La2aKnob`, `La2aTrim` → 이름 변경 (M5) |
| `effects/NoiseGateRackPanel.tsx` | `NoiseGateRackPanel`, `RackDial` |
| `effects/GenericParamControls.tsx` | `DetailControl`, `MiniGraph` (스키마 기반, §3.2) |

**`presetStore.ts` 분할** (616줄)

| 새 파일 | 옮길 내용 |
| --- | --- |
| `presets/factory.ts` | 공장 프리셋 108개 생성(blueprint, describe, slug), `factoryCalibration` 연결. 순수 함수 |
| `presets/migrate.ts` | 옛 ID·옛 형식 이전(`LEGACY_FACTORY_IDS` 등) |
| `presets/io.ts` | 가져오기·내보내기 JSON 검증 |
| `store/presetStore.ts` | 상태와 동작만 |

**완료 기준**: `App.tsx` 200줄 이하, `AudioEngine`을 import하는 파일이 `audioController.ts`와 테스트뿐. 기존 테스트 전부 통과.

### 3.6 문제 E: 스타일과 화면 (U1, U3, U4, P4)

**지금**: `hardware.css` 6,439줄, `globals.css` 1,733줄. 글자 크기·색이 곳곳에 직접 적혀 있어 8px 글자와 어두운 바탕의 어두운 글자가 다시 생기기 쉽습니다.

**목표 구조**

1. **디자인 토큰** `src/styles/tokens.css`:
   - 글자: `--fs-xs: 12px`(하한), `--fs-sm: 13px`, `--fs-md: 15px`, `--fs-lg: 18px`…
   - 색: 바탕별로 글자색 쌍을 정의(`--lcd-bg` / `--lcd-fg`, `--panel-bg` / `--panel-fg`), 각 쌍 명암비 4.5:1 이상.
   - 간격·터치 크기: `--hit-min: 44px`.
2. **컴포넌트별 CSS 분할**: `hardware.css`를 `styles/components/{lcd,rack-drive,rack-comp,rack-gate,tuner,footswitch,right-panel,...}.css`로 나누고 각 컴포넌트에서 import. 분할 과정에서 어디서도 쓰이지 않는 선택자를 제거합니다(빌드 후 사용 선택자 검사 스크립트로 확인).
3. **휴대폰 배치(결정 4: 최소 수정)**:
   - 맨 위 고정 막대: 연결/정지, 입력 미터, PANIC.
   - LCD → 선택 페달 상세 → 스위치 → 프리셋 순서. 프리셋 목록과 오디오 파일 재생 패널은 기본으로 접음.
   - 하드웨어 장식(나사, 랙 귀, 브랜드 판)은 `max-width: 600px`에서 숨김.
   - 목표: 390px에서 **4화면 이하**(지금 8.3화면).
4. **데스크톱 수정**: 브랜드 판 글자 넘침, 튜너 랙 오른쪽 장식으로 인한 2~4px 가로 스크롤.

**완료 기준** (§6의 화면 테스트로 자동 확인)

| 측정 | 지금 | 목표 |
| --- | --- | --- |
| 390px 페이지 길이 | 8.3화면 | ≤ 4화면 |
| 11px 미만 글자 요소 (390px) | 708 / 977 | 0 |
| 명암비 4.5:1 미만 글자 | 미측정 | 0 |
| 가로 스크롤 (1280·1440·1920px) | 있음(2~4px) | 없음 |
| 44px 미만 터치 대상 (390px) | 4 | 0 |
| 빌드 CSS 크기 | 142KB | ≤ 90KB |

### 3.7 문제 F: 문구 (U8)

`src/i18n/ko.ts`에 문구 사전을 두고, 오류는 **코드 → 사용자 문구**로 바꿉니다.

```ts
export const ko = {
  'error.connect': '기타 입력에 연결하지 못했습니다. 장치가 연결돼 있는지 확인하고 다시 시도해 주세요.',
  'error.permission': '마이크 권한이 거부되었습니다. 주소창 왼쪽 자물쇠 아이콘에서 마이크를 허용해 주세요.',
  'error.engineNotReady': '오디오가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.',
  'input.device': '입력 장치',
  'input.defaultDevice': '시스템 기본 입력',
  // ...
} as const;
export type MessageKey = keyof typeof ko;
```

- 엔진은 `AudioEngineError(code)`를 던지고, controller가 `ko[code]`로 바꿉니다. 엔진 안에 화면 문구를 두지 않습니다.
- 페달 약칭(`TUN`, `GATE`…)과 데스크톱 LCD 라벨을 같은 표에서 가져와 "NOISE G..." 잘림을 없앱니다.

**완료 기준**: `grep -rnE "'(Could not|AudioContext is not)" src/` 결과 0건. 영어로 남길 표기(BPM, dB, PANIC 등)는 허용 목록으로 관리.

---

## 4. 결정이 필요한 사항

분석 문서의 결정 7개 중 지금 코드에 이미 반영된 것과 새로 생긴 것을 정리했습니다. 새 결정 S4-a, T-1, L-1은 2026-11-22에 확정되었습니다. 나머지는 답이 없으면 **추천안**으로 진행합니다.

| 번호 | 정할 것 | 지금 상태 | 추천 |
| --- | --- | --- | --- |
| 1 | 수정 범위 | 1~2순위 대부분 완료 | 이 문서 §5의 1~4단계까지 진행 |
| 2 | 동작 안 하는 조작부 | 왼쪽 패널만 확인 | 나머지 13곳을 점검해 "구현/이름 변경/삭제" 표로 확정 |
| 3 | 캐비닛·리버브 IR | 실제 IR 2개 + 합성 | 다른 캐비닛도 CC0 IR을 찾아 넣고, 못 찾으면 합성 유지 + "합성" 표기 |
| 4 | 휴대폰 지원 | 최소 수정 반영 중 | 최소 수정 유지, 목표 4화면 |
| 5 | 공장 프리셋 | 108개 유지·이름·음량 정리됨 | 완료로 처리 |
| 6 | 상표 표기 | 화면은 정리, 코드 이름 남음 | 코드 이름까지 변경 |
| 7 | 이름 오타 | 화면만 수정됨 | 완료로 처리 (주소 유지) |
| **S4-a (확정)** | 익스프레션 페달 연결 대상 | 마스터 볼륨 | ✅ **확정(2026-11-22)**: 볼륨 이펙트(마스터 앞단, 0~100%)로 변경. 마스터는 안전 상한으로만 남김 |
| **T-1 (확정)** | 화면 테스트 도구 | 없음 | ✅ **확정(2026-11-22)**: Playwright를 개발 의존성으로 추가하고 CI에서 실행 |
| **L-1 (확정)** | 저장소 라이선스 | 없음 | ✅ **확정(2026-11-22)**: MIT. 단계 0에서 `LICENSE` 추가, IR 음원은 각 출처 라이선스 유지 |

---

## 5. 단계별 작업 계획

모든 단계는 `main`이 아니라 작업 브랜치에서 하고, PR마다 `npm test`와 `npm run build`가 통과해야 합니다. `main`에 합치면 바로 배포되므로 **한 PR에 한 단계**를 원칙으로 합니다.

### 단계 0. 기준선 고정 (0.5일)

목적: 리팩토링 전후를 비교할 수 있게 지금 상태를 수치로 남깁니다.

1. 브랜치 `refactor/0-baseline`.
2. Playwright 화면 측정 스크립트를 `tests/e2e/layout.spec.ts`로 추가(§6.2의 수치 측정). 지금 값은 **기대값이 아니라 기록값**으로 저장(`tests/e2e/baseline.json`).
3. 엔진 프로브(`tests/engine-probe.ts`)를 헤드리스 크롬에서 돌려 프리셋 108개 출력 피크·RMS를 `baseline.json`에 기록.
4. ESLint(+ `eslint-plugin-react-hooks`) 추가, 기존 경고는 일단 경고로만 둠.
5. MIT `LICENSE` 파일 추가(결정 L-1, 2026-11-22 확정).

완료 기준: CI에서 단위 테스트 + 화면 측정 + 린트가 돌고, 기록이 PR에 첨부됨.

### 단계 1. 재측정으로 🔍 항목 확정 (1일)

목적: "아마 고쳐졌다"를 "고쳐졌다/아니다"로 바꿉니다.

| 항목 | 방법 | 통과 기준 |
| --- | --- | --- |
| F2 루퍼 | 워크릿 단위 테스트에 시나리오 추가: 4 Bars 양자화로 3초 녹음, 레벨 85% 재생, 템포 90BPM, 시작 직후 메모리, 이음매 | 루프 길이 ≥ 1마디, 재생 레벨 오차 ±0.5dB, 양자화가 현재 템포 사용, 시작 시 대용량 버퍼 선점 없음, 이음매 불연속 < −60dB |
| F3 게이트 | 잡음 파일 입력, 기본 프리셋·High Gain Lead | Threshold 최대에서 잡음 −80dBFS 이하 |
| F7 튜너 | 음이 바뀌는 입력 → 정지 → 재연결 | 재연결 1초 안에 표시 갱신, 정지 시 표시 비움 |
| F9 조작부 13곳 | 분석 문서 표를 체크리스트로 하나씩 클릭 | 각 항목을 "정상/이름 변경 필요/삭제 필요"로 분류 |
| P1 리렌더 | React Profiler, 연결 상태 10초 | 미터 외 컴포넌트 리렌더 0회 |
| Q1 Q2 Q6 | 분석 문서와 같은 측정 | Q1: 기본 체인 잡음 증폭 ≤ 12dB / Q2: 입력 −40·−20·−6dBFS에 출력 차이 ≥ 6dB / Q6: 코러스 ≤ ±15센트, 플러터 ≤ ±20센트 |

산출물: 결과표를 이 문서 §2.2에 반영. 실패한 항목은 단계 2로 넘김.

### 단계 2. 남은 기능 문제 마무리 (1~2일)

1. **S4-a (확정)**: 익스프레션 페달을 볼륨 이펙트에 연결, 마스터 노브와 분리. 엔진 프로브 테스트: 페달 100%에서도 마스터 설정 이상으로 커지지 않음.
2. **F9**: 단계 1 분류표대로 구현·이름 변경·삭제.
3. **F4**: 결정 3에 따라 IR 추가 또는 "합성" 표기. `public/irs/NOTICE.md` 갱신.
4. 단계 1에서 실패한 항목 수정.

### 단계 3. 파라미터 스키마와 템포 단일화 (2일)

§3.2, §3.3 그대로. 이 단계가 이후 단계의 기반이므로 먼저 합니다.

검증: 기존 안전 테스트 + 스키마 테스트 + 108개 프리셋 범위 테스트 + 템포 프로브. 단계 0 기준선과 프리셋 출력 피크가 ±0.1dB 이내로 같아야 합니다(소리가 바뀌지 않았다는 증거).

### 단계 4. 저장 일원화 (1일)

§3.4 그대로. v1·v2 데이터를 가진 브라우저에서 업그레이드해도 사용자 프리셋과 마지막 상태가 유지되는지 4가지 시나리오 테스트로 확인.

### 단계 5. 계층 분리와 파일 분할 (2~3일)

§3.5 순서대로, **동작 변경 없이** 옮기기만 합니다. PR을 세 개로 나눕니다.

1. `audioController` 도입, `App.tsx` 축소.
2. `PedalDetailPanel` 분할 + 상표 이름 변경(M5).
3. `presetStore` 분할.

검증: 기존 테스트 전부 + 단계 0 화면 기준선과 스크린샷 비교(픽셀 차이 없음).

### 단계 6. 화면·문구 (3~4일)

§3.6, §3.7. 이 단계만 화면이 바뀝니다.

1. 토큰 도입 → 글자 하한 12px → 명암 수정.
2. CSS 분할·미사용 선택자 제거.
3. 휴대폰 배치.
4. 문구 사전, 엔진 오류 코드화.

검증: §3.6 완료 기준표의 목표값을 Playwright 테스트의 **기대값**으로 바꿔 CI에서 강제.

### 일정 요약

| 단계 | 내용 | 예상 | 선행 |
| --- | --- | --- | --- |
| 0 | 기준선·도구 | 0.5일 | — |
| 1 | 재측정 | 1일 | 0 |
| 2 | 남은 기능 | 1~2일 | 1 |
| 3 | 스키마·템포 | 2일 | 0 |
| 4 | 저장 | 1일 | 3 |
| 5 | 계층·분할 | 2~3일 | 3, 4 |
| 6 | 화면·문구 | 3~4일 | 5 |

합계 약 10~13일. 단계 1·2와 단계 3·4는 서로 독립이라 동시에 진행할 수 있습니다.

---

## 6. 테스트 전략

### 6.1 지금 있는 것 (유지)

- `tests/safety.test.ts` 13건: 딜레이 발산, DC, 저장 차단, 바이패스 잔향, PANIC 경쟁, 그래프 유지, 리버브 캐시, 입력 분리, 출력 장치, 트림 감쇄, 108개 보정, 출력 경로 순서.
- 워크릿 테스트: 컴프레서 3건, 게이트 2건, 리미터 2건, 루퍼.

### 6.2 추가할 것

| 종류 | 파일 | 내용 |
| --- | --- | --- |
| 단위 | `tests/knob.test.ts` | 노브 상대 드래그: 어떤 시작값·이동량에서도 결과가 `[min, max]` 안이고, 아래로 끌면 값이 증가하지 않음 (S1 회귀) |
| 단위 | `tests/schema.test.ts` | §3.2 완료 기준 |
| 단위 | `tests/persistence.test.ts` | §3.4 4가지 시나리오 |
| 워크릿 | `tests/looper.test.mjs` 확장 | 단계 1의 F2 기준 |
| 헤드리스 크롬 | `tests/e2e/audio.spec.ts` | 가짜 마이크(`--use-file-for-fake-audio-capture`)로 연결 → PANIC → 페달 토글 시 출력 무음 유지 (S3 회귀), 왼쪽 채널만 입력 시 양쪽 출력 (F1) |
| 헤드리스 크롬 | `tests/e2e/layout.spec.ts` | §3.6 수치, TAP 5점 클릭 (S6 회귀) |
| 헤드리스 크롬 | `tests/e2e/presets.spec.ts` | 108개 출력 피크 ≤ −6dBFS, 프리셋 간 RMS 차 ≤ 6dB (S5) |

### 6.3 CI

```
npm ci → npm run lint → npm test → npm run build → npx playwright test → 배포
```

Playwright는 빌드 결과(`vite preview`)를 대상으로 돌립니다.

---

## 7. 사람이 직접 확인할 것

자동화할 수 없어 릴리스 전에 사람이 확인합니다. 단계 6이 끝난 뒤 한 번, 이후 큰 변경 때마다.

- [ ] 실제 기타 + 오디오 인터페이스 1번 입력: 양쪽 귀에서 소리 (F1)
- [ ] 헤드폰으로 들었을 때 프리셋 간 음량이 비슷함 (S5)
- [ ] 체감 지연: 피킹과 소리 사이 어색함 없음 (Q4, Q7)
- [ ] 아이폰 사파리·안드로이드 크롬 실기기: 연결, PANIC, 노브 +/−, 페달 순서 변경 (U1, U5)
- [ ] 네트워크를 끊고 다시 열었을 때 앱 실행 (M6)
- [ ] 연주 중 인터페이스 USB를 뽑았을 때 즉시 정지와 안내 문구 (Q7)

---

## 8. 위험과 대응

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| 리팩토링 중 안전 경로가 깨짐 | 귀·장비 손상 | 안전 테스트를 모든 PR 필수로. 출력 경로 순서 테스트(`every final output passes trim, limiter and master`)는 절대 삭제 금지 |
| 스키마 범위를 좁히면서 프리셋 소리가 바뀜 | 사용자 혼란 | 단계 3 검증: 108개 출력 피크 ±0.1dB 비교. 바뀌면 PR에 목록 첨부 |
| 저장 키 이전 실패로 사용자 프리셋 손실 | 데이터 손실 | 이전 성공 확인 후에만 옛 키 삭제. 실패 시 옛 키 유지 |
| 저장 공간 공유(같은 github.io 주소의 다른 앱) | 저장 실패 | 공장 프리셋 미저장 유지, 세션 크기 측정해 50KB 이하 유지 |
| 화면 분할 중 스타일 깨짐 | 사용성 저하 | 단계 5는 스크린샷 픽셀 비교, 단계 6만 의도적 변경 |
| `main` 푸시 = 즉시 배포 | 검증 안 된 변경 노출 | 한 PR에 한 단계, 브랜치 보호 규칙(CI 통과 필수) 설정 권장 |

---

## 9. 이번에 확인한 방법

- 저장소: `main` 최신(`7377791`)을 받아 코드 읽기, `npm ci && npm test && npm run build && npm audit` 실행.
- 화면: 빌드 결과를 `vite preview`로 띄우고 Playwright 크롬으로 390px(휴대폰 모드)·1280·1440·1920px에서 페이지 길이, 버튼 위치, 글자 크기, 터치 대상 크기, TAP 버튼 클릭 지점, 가로 넘침을 측정.
- 하지 않은 것: 오디오 수치 재측정(단계 1에서 수행), 실기기 확인, React Profiler 측정.
