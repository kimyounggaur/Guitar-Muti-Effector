# 조작부 점검표 (F9)

- 점검일: 2026-11-22, 기준 커밋 `main` (P0 병합 후)
- 방법: 코드 확인 + `tests/e2e/controls-audit.spec.ts`(데스크톱 1280px, 빌드 결과)로 화면에서 직접 눌러 확인
- 분류: 정상 / 이름 변경 필요 / 구현 필요 / 삭제 필요. 분석 문서(11-12)의 14곳 순서를 따랐습니다.

| # | 위치 | 표시 | 실제 동작 | 분류 | 근거 |
|---|---|---|---|---|---|
| 1 | 왼쪽 패널 | 페달 보드 / 루퍼 열기 / 프리셋 열기 | 각각 LCD로 이동, 루퍼 선택 후 상세로 이동, 프리셋 목록 펼침 후 이동 | 정상 | `LeftModePanel.tsx`, e2e `left panel buttons navigate` |
| 2 | 튜너 | MUTE | 화면에 없음(11-13 커밋에서 제거) | 정상 | e2e: `MUTE` 버튼 0개 |
| 3 | 튜너 | POWER | "튜너 켜짐/꺼짐" 버튼으로 교체, 누르면 튜너 켜기·끄기 | 정상 | `TunerPanel.tsx` `.rack-tuner-right`, e2e 클릭 후 문구 변경 |
| 4 | 튜너 상세 하단 | Amp EQ | `setSelectedPedal('ampEQ')`를 호출하지만 EQ 페달 ID는 `amp-eq`라 **아무 일도 일어나지 않음** | 삭제 필요 | `PedalDetailPanel.tsx` 튜너 상세, e2e 클릭 후에도 튜너 상세 유지 |
| 5 | 튜너 | CALIB | 버튼 없음. 기준 주파수(A4) 슬라이더가 대신 동작 | 정상 | e2e: `CALIB` 버튼 0개 |
| 6 | 튜너 | DISPLAY | 화면에 없음 | 정상 | e2e: `DISPLAY` 버튼 0개 |
| 7 | 오른쪽 패널 | HOLD TO TUNER | "튜너 열기"로 이름이 바뀌었고 튜너 선택 후 튜너 상세로 이동 | 정상 | `RightUtilityPanel.tsx`, e2e |
| 8 | 드라이브 상세 | SPRING REVERB · Blend | 화면에 없음. 대신 WET 100% 스위치(mix 100↔72)가 실제 파라미터를 바꿈 | 정상 | e2e: 해당 문구 0개 |
| 9 | 드라이브 상세 | EQ/AMP MODEL 화살표 | "PRE MODEL" 위·아래 화살표가 드라이브 모드를 실제로 바꿈 | 정상 | e2e: 모델 이름 변경 확인 |
| 10 | 컴프레서 상세 | VU 미터 | 실제 게인 리덕션 값을 구독(`subscribeCompressorReduction`), 보일 때만 갱신 | 정상 | `PedalDetailPanel.tsx` 컴프레서 패널 |
| 11 | 컴프레서 상세 | GR / +10 / +4 | GR은 미터 표시(정상). +10/+4 전환 스위치는 화면에 없음 | 정상 | e2e: `+10`/`+4` 버튼 0개 |
| 12 | 노이즈 게이트 상세 | Attack / Hold / Decay | Attack·Hold는 이름대로 동작. **Decay는 실제로 `releaseMs`(닫힘 시간)를 바꿈** | 이름 변경 필요 | `NoiseGateRackPanel` |
| 13 | LCD 상단 | PEAK/RMS 막대 | IN/OUT 두 막대가 실제 RMS를 30fps로 표시 | 정상 | `PatchHeader.tsx`, e2e 막대 2개 |
| 14 | 상태 막대 | CPU / Latency | CPU 표시는 없음. "출력 지연"은 `baseLatency + outputLatency` 추정값 | 정상 | `MasterStatusBar.tsx`, e2e |
| 15 | 캐비닛 상세 | Custom | "사용자 IR" 선택지. WAV 업로드 전에는 비활성, 업로드하면 실제 IR 사용 | 정상 | `CabinetIRPedal.tsx`, e2e `disabled` 확인 |

## 점검 중 새로 찾은 것

| 위치 | 표시 | 실제 동작 | 분류 | 근거 |
|---|---|---|---|---|
| 노이즈 게이트 상세 | Depth 다이얼 | Sensitivity 다이얼, Threshold 페이더와 **같은 값**(`thresholdDb`)을 바꿈. "깊이(감쇄량)"처럼 보이지만 감쇄량 조절 기능은 없음 | 삭제 필요 | `NoiseGateRackPanel` |
| 노이즈 게이트 상세 | Auto mode | 게이트 켜기·끄기 버튼. "자동 모드"라는 별도 기능은 없음 | 이름 변경 필요 | `NoiseGateRackPanel` |

P2에서 처리할 것: 4·Depth 삭제, 12·Auto mode 이름 변경. 설계서 §4 결정 2에 따라 "구현 필요"는 루퍼·리듬·IR 업로드만 대상이며, 이번 점검에서 그 셋은 모두 동작합니다.
