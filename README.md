# Guitar Multi-effector

기타 입력이나 오디오 파일을 브라우저의 이펙트 체인으로 처리하는 웹 앱입니다.

## 사용

1. 오디오 인터페이스와 헤드폰의 물리적 음량을 낮춥니다.
2. 기타 입력 장치와 채널(입력 1, 입력 2, 합치기)을 선택하고 연결합니다.
3. LCD의 페달을 눌러 설정을 선택하고 아래 스위치로 켜고 끕니다.
4. 루퍼·리듬·캐비닛 상세 패널에서 녹음, 박자 재생, 사용자 WAV IR 업로드를 사용할 수 있습니다.
5. 긴급 음소거는 입력을 종료하고 마스터를 0으로 설정합니다.

마스터 음량은 프리셋을 바꿔도 유지됩니다. 프리셋별 출력 보정은 감쇄만 적용되며, 작업 상태는 브라우저에 자동 저장됩니다. 사용자 IR 파일은 현재 탭에서만 유지되므로 다시 열었을 때 재업로드해야 합니다.

HTTPS와 AudioWorklet을 지원하는 최신 브라우저가 필요합니다. 출력 장치 선택은 `AudioContext.setSinkId`를 지원하는 브라우저에서 제공됩니다. 앱 파일은 첫 온라인 실행 후 오프라인용으로 캐시되며, 홈 화면 추가 메뉴는 브라우저마다 다릅니다.

## 개발 및 검사

Node.js 22에서 `npm ci`, `npm run dev`를 실행합니다. `npm test`는 오디오 안전·워크릿·프리셋 회귀 검사를, `npm run build`는 타입 검사와 배포 빌드 및 오프라인 캐시 생성을 실행합니다. GitHub Pages는 `main`의 검사·빌드가 성공하면 배포됩니다.

검사 명령은 다음과 같습니다.

- `npm run lint`: ESLint와 화면 문구 검사(`scripts/check-strings.mjs`)를 실행합니다. 문구 검사는 컴포넌트에 한국어가 아니고 허용 목록(`src/i18n/ko.ts`의 `ALLOWED_ENGLISH`)에도 없는 영어 문구가 있으면 실패합니다. 화면 문구는 `src/i18n/ko.ts`에 추가하고 `t()`로 가져옵니다.
- `npm run e2e`: Playwright 크롬으로 화면과 오디오를 검사합니다(휴대폰 390px, 데스크톱 1280·1440·1920px). 처음 한 번은 `npx playwright install chromium`이 필요합니다. 검사 전에 앱을 자동으로 빌드해 `vite preview`(4173 포트)로 띄우고, 오디오 측정은 개발 서버(5174 포트)를 씁니다. 화면 픽셀 비교는 `npm run e2e:visual`로 따로 실행합니다.
- `npm run e2e:baseline`: 레이아웃 수치와 프리셋 출력 레벨을 다시 측정해 `tests/e2e/baseline.json`을 새로 씁니다. 기준선을 일부러 바꿀 때만 실행하고, 바뀐 이유를 PR에 적어 주세요.

리팩토링 전후 비교는 [docs/refactoring-result.md](docs/refactoring-result.md)에, 사람이 직접 확인할 항목은 [docs/manual-checklist.md](docs/manual-checklist.md)에 있습니다.

브라우저 개발 검증 페이지는 `tests/`에 있고 배포 빌드에는 포함되지 않습니다. 프리셋 측정 방법과 결과는 [tests/PRESET_CALIBRATION.md](tests/PRESET_CALIBRATION.md)에 있습니다.

## 음원과 검증 범위

4×12 Dynamic·Mixed 캐비닛은 실제 녹음된 CC0 IR을 사용합니다. 다른 캐비닛·마이크 설정과 리버브는 합성 임펄스를 사용합니다. 출처는 [public/irs/NOTICE.md](public/irs/NOTICE.md)에 있습니다.

브라우저의 가상 스테레오 입력으로 채널 선택·양쪽 출력·PANIC을 확인했고 실제 IR 디코딩과 리미터 피크 제한을 검사했습니다. 동일한 합성 시험 입력의 공장 프리셋 108개를 측정해 감쇄 보정했습니다. 실제 기타·인터페이스의 청감과 왕복 지연, 모바일 실기기, 네트워크를 차단한 오프라인 실행은 별도 검증이 필요합니다. 출력 보호 처리는 실제 장비의 음량 조절을 대신하지 않습니다.

## 라이선스

MIT. 자세한 내용은 [LICENSE](LICENSE)를 보세요. public/irs/ 의 IR 음원은 각 출처의 라이선스를 따릅니다([NOTICE](public/irs/NOTICE.md)).
