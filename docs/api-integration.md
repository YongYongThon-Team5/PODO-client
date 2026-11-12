# PODO 프론트 ↔ 백엔드 연동 설계

- 기준 자료: `docs/openapi.json` (`npm run api:pull`로 `https://52.78.237.200/v3/api-docs/podo`에서 갱신), Notion "API 명세서"(28개)
- 2026-11-08 기준 Swagger에 **28개 전부** 올라와 있다. 타입은 `npm run api:types`로 `src/api/schema.d.ts`에 생성한다.

## 1. 서버 확인 결과 (2026-11-06)

| 항목 | 결과 | 연동 영향 |
|---|---|---|
| 서버 | `https://52.78.237.200` (Caddy → Spring), 정상 인증서 | 브라우저에서 바로 HTTPS 호출 가능 |
| CORS | 다른 출처의 사전 요청(OPTIONS)에 `401`, CORS 헤더 없음 | 다른 도메인(로컬·Vercel)에서 직접 호출 불가 |
| CSRF | `GET /api/auth/csrf` → 본문 `csrfToken` + `__Host-csrf` 쿠키(HttpOnly, **SameSite=Strict**, 1시간) | 이중 제출 방식. 프론트와 API가 **같은 사이트**여야 쿠키가 전송됨 |
| Refresh | `__Host-refresh` HttpOnly 쿠키, 갱신마다 회전 | 위와 같음 |
| Access | 불투명 토큰, `Authorization: Bearer <token>`, `expiresIn`(초) | 메모리에만 보관 |
| 오류 형식 | `{ "error": { code, message, details, requestId } }` | 공통 오류 처리 한 곳에서 |
| 목록 | 커서 방식 `{ items, nextCursor }`, `limit` 기본 20 · 최대 100 | 무한 스크롤 공통 훅 |

## 2. 결론: 프론트를 API와 같은 출처로 띄운다

`SameSite=Strict` + `__Host-` 쿠키는 **다른 사이트에서 보낸 요청에는 실리지 않는다.** CORS를 열어도 로그인 유지(토큰 갱신)가 안 된다. 그래서 브라우저 입장에서 프론트와 `/api`가 같은 주소가 되게 만든다.

| 환경 | 방법 |
|---|---|
| 개발 | Vite 프록시: `localhost:5173/api/*` → `https://52.78.237.200/api/*` |
| 배포 (추천) | **백엔드 Caddy가 프론트 빌드 파일도 서빙**: `/api/*`·`/swagger-ui/*` → Spring, 나머지 → `dist/` (SPA 폴백). 카카오 콜백 주소 변경 불필요 |
| 배포 (대안) | Vercel `rewrites`로 `/api/*`를 서버로 프록시. 이 경우 카카오 Redirect URI를 Vercel 도메인으로 바꾸고 카카오 콘솔에 등록해야 함 |

## 3. 로그인 흐름

```
[로그인 화면] "카카오로 시작하기"
   └─ location.href = '/api/auth/login/kakao'        (페이지 이동, fetch 아님)
        └─ 카카오 인가 → /api/auth/callback/kakao (서버)
             └─ 서버가 Refresh 쿠키 설정 후 프론트 성공/오류 화면으로 이동  ← 주소 합의 필요
                  └─ [성공 화면] 세션 복구(아래) → 아이 프로필 없으면 /signup, 있으면 /home
```

세션 복구 (앱 시작 시, 로그인 직후 공통)

1. `GET /api/auth/csrf` → `csrfToken` 메모리 보관
2. `POST /api/auth/token` (헤더 `X-CSRF-Token`, 쿠키 자동) → `accessToken` 메모리 보관
   - 실패(401 등) → 비로그인 상태 (둘러보기 가능)
3. `expiresIn - 60초`에 2번을 다시 실행해 미리 갱신

API 호출 규칙

- 모든 요청: `credentials: 'include'`(같은 출처라 기본 동작), 로그인 상태면 `Authorization: Bearer`
- GET 이외 요청: `X-CSRF-Token` 첨부 (Swagger는 token·logout에만 표시돼 있지만 붙여도 무해. 서버 규칙 확인 필요)
- 401 → 토큰 갱신을 **한 번만**(동시 요청은 같은 갱신을 기다림) 하고 원래 요청 재시도. 갱신도 실패하면 로그아웃 처리 후 `/login`
- CSRF 오류 → `GET /api/auth/csrf` 다시 받고 1회 재시도
- 로그아웃: `POST /api/auth/logout` (Bearer + CSRF) → 메모리 비우기 → `/login`

## 4. 프론트 구조

```
src/api/
  schema.d.ts        # openapi-typescript로 docs/openapi.json에서 자동 생성 (직접 수정 금지)
  client.ts          # openapi-fetch 클라이언트 + 미들웨어(Bearer·CSRF·401 재시도)
  auth.ts            # 세션 복구·갱신 예약·로그아웃, 토큰/CSRF 메모리 보관
  errors.ts          # ApiError, 오류 코드 → 사용자 문구 (Notion 공통 오류 코드 26개)
  queries/           # TanStack Query 훅: useProfileOptions, useChildProfiles, ...
src/mocks/           # MSW: Swagger에 아직 없는 B·C API 임시 응답
```

- 타입: `openapi-typescript`로 생성. 백엔드가 Swagger를 바꾸면 `npm run api:types` 한 번으로 갱신, 어긋난 곳은 타입 오류로 드러남
- 요청: `openapi-fetch` (경로·파라미터·응답이 Swagger 타입으로 검사됨)
- 서버 상태: TanStack Query (캐시, 재시도, 로딩 상태 → `LoadingScreen` 연결)
- 수정 API(PATCH) 규칙: 보내지 않은 필드는 유지, `ageBandCode`·`profileImageId`에 `null`은 해제, 배열은 전체 교체

## 5. 연동 순서

| 단계 | API | 화면 | 상태 |
|---|---|---|---|
| 1 | csrf · token · logout · login/kakao · me | 로그인, 앱 시작, 마이페이지 | csrf·token·login 연결 (`src/api/auth.ts`), logout은 마이페이지 프로필 수정에서 연결. me는 accountId뿐이라 쓰지 않음 |
| 2 | profile-options · child-profiles (목록·생성·수정) | 회원가입·마이페이지 | 연결 (`Signup`·`MyPage` 이름·사진 수정) |
| 3 | profile-images (업로드·조회) | 프로필 사진 | 마이페이지 프로필 수정에서 연결 (조회는 Bearer로 받아 화면용 주소로 바꿈) |
| 4 | recommendation-options · recommendations · places/popular · places/{id} | 오늘의 조건·맞춤 목록·홈·장소 상세 | 연결 (`Conditions`·`Recommend`·`Home`·`PlaceDetail`). 홈 날씨는 `places/{id}?visitDate=`의 weather (예보는 며칠 앞까지만) |
| 5 | visits · report | 방문 예정·방문했어요 | 목록·등록(`Idempotency-Key`)·상세·예정일 변경·report 연결 (`PlaceDetail`·`VisitPhotos`·`Mission`). report가 409이고 예정일이 오늘이 아니면 PATCH로 오늘로 바꾼 뒤 다시 report. 취소는 미션 탭 "방문 예정 취소"로 연결 |
| 6 | quiz · answers · hint-views · restart | OX 퀴즈 | 연결 (`QuizIntro`·`QuizQuestion`·`QuizCheer`·`Mission`). 첫 답만 저장되므로 "다시 한 번 더"는 해설의 정답과 화면에서만 비교 |
| 7 | places(목록) · me/completed-places | 탐방 지도·탐험 완료 | 연결 (`MapPage`·`QuizComplete`). 지도는 Figma 용인 그림 위에 위경도를 비례해 찍음 |
| 8 | visits/{id}/observations (업로드 · 상태 · 최신 · 재시도 · 사진) | 사진 추가 → 에피소드 소개 | 연결 (`VisitPhotos`·`QuizIntro`). 사진 1~3장 업로드(`Idempotency-Key`) → 1.5초마다 상태 확인 → 끝나면 report → 에피소드 소개(내 사진·생성된 소개 문구). 실패하면 다시 시도 / 사진 없이 시작 |

## 6. 백엔드에 요청할 것

1. **배포 방식 합의**: 프론트 `dist/`를 Caddy에서 같이 서빙할지(추천), Vercel 프록시로 갈지
2. **카카오 로그인 후 이동 주소**: 성공·오류 시 프론트 어느 경로로 보내는지 (예: `/auth/callback?result=success`, 오류는 `?error=CODE`)
3. **개발용 로그인**: 로컬(`localhost:5173`)에서 카카오 로그인을 끝까지 테스트할 방법 (카카오 콘솔에 개발 Redirect URI 추가 또는 개발용 토큰 발급)
4. **CSRF 범위**: `X-CSRF-Token`이 필요한 요청이 token·logout뿐인지, 모든 POST/PATCH/PUT인지
5. **Swagger 정리**
   - 응답 `content`가 `*/*`인 곳 → `application/json` (타입 생성 정확도)
   - `operationId`가 `list`·`create`·`patch`처럼 겹치기 쉬운 이름 → `listChildProfiles` 등 고유 이름
   - `cursor` 쿼리에 `type: string` 명시
   - 인증 API의 401·403·오류 코드 응답 명시
   - B·C API와 `profile-images` 추가
6. **운영 데이터**: `GET /api/profile-options`의 `ageBands`가 현재 빈 배열 → 회원가입 나이 선택지가 비어 보임
7. **관찰 사진 업로드 형식**: Swagger에 `POST /visits/{id}/observations` 요청 본문이 없음 → 지금은 multipart `images` 필드로 보냄(`OBSERVATION_FIELD`). 필드 이름과 `generationStatus` 값 목록(생성 중·성공·실패) 확인 필요
8. **report 조건**: 예정일이 오늘이 아닌 방문을 report하면 409인지, 그때 PATCH 후 report하는 흐름이 맞는지
9. **observationGuide 형식**: Figma는 "입구 안내도"처럼 짧은 위치 이름 → 실제 데이터도 짧은 이름인지 (12자 넘으면 문장으로 보고 따로 보여 줌)
10. **회원탈퇴 API**: Figma 마이페이지에 "회원탈퇴"가 있는데 API가 없음 → 지금은 "준비 중" 안내
11. **난이도별 퀴즈**: Figma 탐험 시작에 "고학년 퀴즈 / OX 퀴즈" 버튼과 "나이 연령대로 맞는 난이도 퀴즈" 메모가 있는데 API가 없음 → 지금은 OX 퀴즈만 시작
