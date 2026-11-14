import { useEffect, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { getAuthState, subscribeAuth } from './auth';
import { unwrap } from './errors';
import type { components } from './schema';

export type Schemas = components['schemas'];
export type ChildProfile = Schemas['ChildProfile'];
export type CreateChildProfile = Schemas['CreateChildProfile'];
export type RecommendationRequest = Schemas['RecommendationRequest'];
export type RecommendationItem = Schemas['RecommendationItem'];
export type PlaceSummary = Schemas['PlaceSummary'];
export type PlaceDetail = Schemas['PlaceDetail'];
export type Visit = Schemas['Visit'];

export const queryKeys = {
  profileOptions: ['profile-options'] as const,
  childProfiles: ['child-profiles'] as const,
  recommendationOptions: ['recommendation-options'] as const,
  recommendations: (req: RecommendationRequest) => ['recommendations', req] as const,
  popularPlaces: ['places', 'popular'] as const,
  activeVisits: ['visits', 'active'] as const,
  completedPlaces: ['me', 'completed-places'] as const,
};

export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuthState);
}

/* ── 회원가입(아이 프로필) ── */

export function useProfileOptions() {
  return useQuery({
    queryKey: queryKeys.profileOptions,
    queryFn: async () => unwrap(await api.GET('/api/profile-options')),
    staleTime: 10 * 60 * 1000,
  });
}

export function useChildProfiles() {
  const auth = useAuth();
  return useQuery({
    queryKey: queryKeys.childProfiles,
    queryFn: async () => unwrap(await api.GET('/api/child-profiles', { params: { query: { limit: 100 } } })).items,
    enabled: auth.status === 'signedIn',
  });
}

export function useCreateChildProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateChildProfile) => unwrap(await api.POST('/api/child-profiles', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.childProfiles }),
  });
}

export function useUploadProfileImage() {
  return useMutation({
    mutationFn: async (file: File) =>
      unwrap(
        await api.POST('/api/profile-images', {
          body: { file: file as unknown as string },
          bodySerializer: (b) => {
            const form = new FormData();
            form.append('file', b.file as unknown as Blob);
            return form;
          },
        }),
      ),
  });
}

export type PatchChildProfile = Schemas['PatchChildProfile'];

/** 아이 프로필 수정. 보내지 않은 필드는 유지, profileImageId에 null을 보내면 사진 해제 */
export function usePatchChildProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, body }: { profileId: string; body: PatchChildProfile }) =>
      unwrap(await api.PATCH('/api/child-profiles/{profileId}', { params: { path: { profileId } }, body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.childProfiles }),
  });
}

/** 프로필 사진은 로그인해야 받을 수 있어 Bearer를 붙여 받은 뒤 화면용 주소로 바꾼다 */
export function useProfileImageUrl(imageId: string | null | undefined) {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ['profile-images', imageId],
    queryFn: async () => {
      const blob = unwrap(
        await api.GET('/api/profile-images/{imageId}', { params: { path: { imageId: imageId! } }, parseAs: 'blob' }),
      ) as Blob;
      return URL.createObjectURL(blob);
    },
    enabled: !!imageId && auth.status === 'signedIn',
    staleTime: Infinity,
  });
  return query.data ?? null;
}

/* ── 오늘의 조건 → 맞춤 장소 목록 ── */

export function useRecommendationOptions() {
  return useQuery({
    queryKey: queryKeys.recommendationOptions,
    queryFn: async () => unwrap(await api.GET('/api/recommendation-options')),
    staleTime: 10 * 60 * 1000,
  });
}

export function useRecommendations(req: RecommendationRequest | null) {
  return useQuery({
    queryKey: req ? queryKeys.recommendations(req) : ['recommendations', 'none'],
    queryFn: async () => unwrap(await api.POST('/api/recommendations', { body: req! })),
    enabled: req !== null,
    staleTime: 5 * 60 * 1000,
  });
}

/* ── 홈 ── */

export function usePopularPlaces() {
  return useQuery({
    queryKey: queryKeys.popularPlaces,
    queryFn: async () => unwrap(await api.GET('/api/places/popular')),
  });
}

/** visitDate를 주면 그 날짜의 날씨(weather)도 함께 온다. 예보는 며칠 앞까지만 있다 */
export function usePlace(placeId: string | null | undefined, visitDate?: string) {
  return useQuery({
    queryKey: ['places', placeId, visitDate ?? null],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/places/{placeId}', {
          params: { path: { placeId: placeId! }, query: visitDate ? { visitDate } : {} },
        }),
      ),
    enabled: !!placeId,
  });
}

export type CreateVisit = Schemas['CreateVisit'];

/**
 * 방문 예정 등록. 같은 요청을 다시 보내도 한 번만 생기도록 Idempotency-Key를 붙인다.
 * 키는 화면에서 한 번 만들어 재시도 때 그대로 넘긴다.
 */
export function useCreateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, key }: { body: CreateVisit; key: string }) =>
      unwrap(await api.POST('/api/visits', { params: { header: { 'Idempotency-Key': key } }, body })),
    onSuccess: (visit) => {
      qc.setQueryData(queryKeys.activeVisits, visit);
      // 다음 화면(사진 추가)이 같은 방문을 다시 받지 않게
      qc.setQueryData(['visits', visit.id], visit);
    },
  });
}

/** 방문 예정·퀴즈 진행 중인 방문 (계정당 활성 방문은 1건) */
export function useActiveVisit() {
  const auth = useAuth();
  return useQuery({
    queryKey: queryKeys.activeVisits,
    queryFn: async () =>
      unwrap(
        await api.GET('/api/visits', { params: { query: { status: 'PLANNED,QUIZ_IN_PROGRESS', limit: 1 } } }),
      ).items[0] ?? null,
    enabled: auth.status === 'signedIn',
  });
}

/* ── 방문 → 탐험 퀴즈 ── */

export type QuizProgress = Schemas['QuizProgress'];
export type QuizQuestion = Schemas['QuizQuestion'];
export type QuizFeedback = Schemas['QuizFeedback'];

const visitKey = (visitId: string) => ['visits', visitId] as const;
const quizKey = (visitId: string) => ['visits', visitId, 'quiz'] as const;

export function useVisit(visitId: string | undefined) {
  const auth = useAuth();
  return useQuery({
    queryKey: visitKey(visitId ?? ''),
    queryFn: async () => unwrap(await api.GET('/api/visits/{visitId}', { params: { path: { visitId: visitId! } } })),
    enabled: !!visitId && auth.status === 'signedIn',
  });
}

/** 같은 장소의 지난 방문 (지도에서 "기록 다시보기") */
export function useCompletedVisitOf(placeId: string | null | undefined) {
  const auth = useAuth();
  return useQuery({
    queryKey: ['visits', 'completed', placeId],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/visits', { params: { query: { status: 'COMPLETED', placeId: placeId!, sort: 'COMPLETED_AT_DESC', limit: 1 } } }),
      ).items[0] ?? null,
    enabled: !!placeId && auth.status === 'signedIn',
  });
}

/** 다녀온 방문 전체 (마이페이지 탐험 카드 → 탐험 결과) */
export function useCompletedVisits() {
  const auth = useAuth();
  return useQuery({
    queryKey: ['visits', 'completed', 'all'],
    queryFn: async () => {
      const items: Visit[] = [];
      const seen = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = unwrap(await api.GET('/api/visits', {
          params: { query: { status: 'COMPLETED', sort: 'COMPLETED_AT_DESC', limit: 100, cursor } },
        }));
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
        if (cursor && seen.has(cursor)) throw new Error('기록 목록을 불러오지 못했어요. 다시 시도해 주세요.');
        if (cursor) seen.add(cursor);
      } while (cursor);
      return items;
    },
    enabled: auth.status === 'signedIn',
  });
}

/** 방문 예정 취소 (PLANNED에서만). 취소하면 활성 방문이 없어진다 */
export function useCancelVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visitId: string) =>
      unwrap(await api.POST('/api/visits/{visitId}/cancel', { params: { path: { visitId } } })),
    onSuccess: (visit) => {
      qc.setQueryData(visitKey(visit.id), visit);
      qc.setQueryData(queryKeys.activeVisits, null);
    },
  });
}

/** 방문 예정일 변경 (PLANNED에서만) */
export function usePatchVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, plannedDate }: { visitId: string; plannedDate: string }) =>
      unwrap(await api.PATCH('/api/visits/{visitId}', { params: { path: { visitId } }, body: { plannedDate } })),
    onSuccess: (visit) => {
      qc.setQueryData(visitKey(visit.id), visit);
      qc.setQueryData(queryKeys.activeVisits, visit);
    },
  });
}

/** 방문 신고 = 준비된 퀴즈 시작 (PLANNED → QUIZ_IN_PROGRESS). 재전송하면 현재 방문을 돌려준다 */
export function useReportVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visitId: string) =>
      unwrap(await api.POST('/api/visits/{visitId}/report', { params: { path: { visitId } } })),
    onSuccess: (visit) => {
      qc.setQueryData(visitKey(visit.id), visit);
      qc.setQueryData(queryKeys.activeVisits, visit);
      qc.invalidateQueries({ queryKey: quizKey(visit.id) });
    },
  });
}

export function useQuiz(visitId: string | undefined) {
  const auth = useAuth();
  return useQuery({
    queryKey: quizKey(visitId ?? ''),
    queryFn: async () => unwrap(await api.GET('/api/visits/{visitId}/quiz', { params: { path: { visitId: visitId! } } })),
    enabled: !!visitId && auth.status === 'signedIn',
  });
}

/* ── 관찰 사진 (사진 추가 → 나만의 탐험 소개 생성) ── */

export type Observation = Schemas['ObservationState'];

/** 서버 multipart 계약: files 필드에 사진 1~3장을 반복해서 보낸다. */
const OBSERVATION_FIELD = 'files';

const observationKey = (visitId: string, observationId: string) =>
  ['visits', visitId, 'observations', observationId] as const;
const latestObservationKey = (visitId: string) => ['visits', visitId, 'observations', 'latest'] as const;

/** READY는 생성 완료다. 공개 여부와 실제 시작 가능 여부는 별도로 확인한다. */
export function observationSettled(o: Observation | undefined) {
  return o?.generationStatus === 'READY' || o?.generationStatus === 'FAILED';
}

export function observationSucceeded(o: Observation | undefined) {
  return o?.generationStatus === 'READY' && o.startAvailable === true;
}

/** 관찰 사진 1~3장 업로드 + 생성 예약. 같은 키로 다시 보내도 한 번만 만들어진다 */
export function useUploadObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, files, key }: { visitId: string; files: File[]; key: string }) =>
      unwrap(
        await api.POST('/api/visits/{visitId}/observations', {
          params: { path: { visitId }, header: { 'Idempotency-Key': key } },
          body: files as never,
          bodySerializer: (list) => {
            const form = new FormData();
            for (const f of list as unknown as File[]) form.append(OBSERVATION_FIELD, f);
            return form;
          },
        }),
      ) as Observation,
    onSuccess: (o, { visitId }) => {
      if (o.id) qc.setQueryData(observationKey(visitId, o.id), o);
      qc.setQueryData(latestObservationKey(visitId), o);
    },
  });
}

/** 생성 상태. 끝날 때까지 1.5초마다 다시 본다 */
export function useObservation(visitId: string | undefined, observationId: string | null | undefined) {
  return useQuery({
    queryKey: observationKey(visitId ?? '', observationId ?? ''),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/visits/{visitId}/observations/{observationId}', {
          params: { path: { visitId: visitId!, observationId: observationId! } },
        }),
      ) as Observation,
    enabled: !!visitId && !!observationId,
    refetchInterval: (q) => (observationSettled(q.state.data) ? false : 1500),
  });
}

/** 방문의 가장 최근 관찰 (없으면 null) */
export function useLatestObservation(visitId: string | undefined) {
  const auth = useAuth();
  return useQuery({
    queryKey: latestObservationKey(visitId ?? ''),
    queryFn: async () => {
      const res = await api.GET('/api/visits/{visitId}/observations/latest', {
        params: { path: { visitId: visitId! } },
      });
      if (res.response.status === 404) return null;
      return unwrap(res) as Observation;
    },
    enabled: !!visitId && auth.status === 'signedIn',
    refetchOnMount: 'always',
  });
}

/** 실패한 생성 작업 다시 요청 (현재 시도 번호를 같이 보낸다) */
export function useRetryObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, observation }: { visitId: string; observation: Observation }) =>
      unwrap(
        await api.POST('/api/visits/{visitId}/observations/{observationId}/retry', {
          params: { path: { visitId, observationId: observation.id! } },
          body: { expectedAttempt: observation.attemptCount ?? 1 },
        }),
      ) as Observation,
    onSuccess: (o, { visitId }) => {
      if (o.id) qc.setQueryData(observationKey(visitId, o.id), o);
      qc.setQueryData(latestObservationKey(visitId), o);
    },
  });
}

/** 인증 요청으로 받은 Blob을 캐시하고, 화면별 임시 주소는 사용이 끝나면 해제한다. */
export function useObservationImageUrl(visitId?: string, observationId?: string, imageId?: string) {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ['observation-image', visitId, observationId, imageId],
    queryFn: async () => unwrap(
      await api.GET('/api/visits/{visitId}/observations/{observationId}/images/{imageId}', {
        params: { path: { visitId: visitId!, observationId: observationId!, imageId: imageId! } },
        parseAs: 'blob',
      }),
    ) as unknown as Blob,
    enabled: !!visitId && !!observationId && !!imageId && auth.status === 'signedIn',
    staleTime: Infinity,
  });
  const [objectUrl, setObjectUrl] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!query.data) return;
    const url = URL.createObjectURL(query.data);
    setObjectUrl({ blob: query.data, url });
    return () => URL.revokeObjectURL(url);
  }, [query.data]);
  return auth.status === 'signedIn' && objectUrl?.blob === query.data ? objectUrl?.url ?? null : null;
}

/** 외부 공개 사진에는 토큰을 보내지 않고, 우리 관찰 사진만 인증 API로 받는다. */
export function useReferenceImageUrl(referenceImageUrl?: string | null) {
  let ids: RegExpMatchArray | null = null;
  let isApiImage = false;
  if (referenceImageUrl) {
    try {
      const url = new URL(referenceImageUrl, window.location.origin);
      if (url.origin === window.location.origin) {
        isApiImage = url.pathname.startsWith('/api/');
        ids = url.pathname.match(/^\/api\/visits\/([0-9a-f-]{36})\/observations\/([0-9a-f-]{36})\/images\/([0-9a-f-]{36})$/i);
      }
    } catch {
      isApiImage = true;
    }
  }
  const authenticatedUrl = useObservationImageUrl(ids?.[1], ids?.[2], ids?.[3]);
  return isApiImage ? authenticatedUrl : referenceImageUrl ?? null;
}

/** 정정된 퀴즈 세트로 교체 (quizAvailability가 CORRECTION_REQUIRED일 때) */
export function useRestartQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visitId: string) =>
      unwrap(await api.POST('/api/visits/{visitId}/quiz/restart', { params: { path: { visitId } } })),
    onSuccess: (quiz) => qc.setQueryData(quizKey(quiz.visitId), quiz),
  });
}

/** OX 답 제출. 첫 답만 저장되고, 세 문제를 다 풀면 서버가 방문을 완료 처리한다 */
export function useSubmitAnswer(visitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: 'O' | 'X' }) =>
      unwrap(
        await api.PUT('/api/visits/{visitId}/answers/{questionId}', {
          params: { path: { visitId, questionId } },
          body: { answer },
        }),
      ),
    onSuccess: (result) => {
      qc.setQueryData<QuizProgress>(quizKey(visitId), (quiz) =>
        quiz && {
          ...quiz,
          answeredCount: result.answeredCount,
          correctCount: result.correctCount,
          visitStatus: result.visitStatus,
          questions: quiz.questions.map((q) =>
            q.questionId === result.questionId
              ? { ...q, submittedAnswer: result.submittedAnswer, feedback: result.feedback }
              : q,
          ),
        },
      );
      // 다음 화면(탐험 완료 등)이 옛 상태를 보지 않게 방문 캐시도 바로 고치고, 나머지는 다시 받는다
      qc.setQueryData<Visit>(visitKey(visitId), (visit) =>
        visit && {
          ...visit,
          status: result.visitStatus,
          answeredCount: result.answeredCount,
          correctCount: result.correctCount,
          completedAt: result.completedAt,
        },
      );
      qc.invalidateQueries({ queryKey: visitKey(visitId), exact: true });
      if (result.visitStatus === 'COMPLETED') {
        qc.setQueryData(queryKeys.activeVisits, null);
        qc.invalidateQueries({ queryKey: queryKeys.completedPlaces });
        qc.invalidateQueries({ queryKey: queryKeys.popularPlaces });
        qc.invalidateQueries({ queryKey: ['visits', 'completed'] });
      }
    },
  });
}

/** 힌트 보기. 같은 단계를 다시 열어도 한 번만 기록된다 (본문은 이 응답으로만 받는다) */
export function useViewHint(visitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, step }: { questionId: string; step: number }) =>
      unwrap(
        await api.PUT('/api/visits/{visitId}/hint-views/{questionId}/{step}', {
          params: { path: { visitId, questionId, step: String(step) as '1' | '2' } },
        }),
      ),
    onSuccess: (hint) => {
      qc.setQueryData<QuizProgress>(quizKey(visitId), (quiz) =>
        quiz && {
          ...quiz,
          hintUsageCount: hint.hintUsageCount,
          questions: quiz.questions.map((q) =>
            q.questionId === hint.questionId && !q.viewedHintSteps.includes(hint.step)
              ? { ...q, viewedHintSteps: [...q.viewedHintSteps, hint.step] }
              : q,
          ),
        },
      );
    },
  });
}

/* ── 지도 ── */

/** 공개 장소 전체 (지도 마커). 64곳 남짓이라 커서를 끝까지 따라가 한 번에 모은다 */
export function useAllPlaces() {
  return useQuery({
    queryKey: ['places', 'all'],
    queryFn: async () => {
      const items: PlaceSummary[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page++) {
        const res = unwrap(await api.GET('/api/places', { params: { query: { limit: 100, cursor } } }));
        items.push(...res.items);
        if (!res.nextCursor) break;
        cursor = res.nextCursor;
      }
      return items;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export type CompletedPlace = Schemas['CompletedPlace'];

/** 우리 가족이 탐험을 마친 장소 + 구별 집계 */
export function useCompletedPlaces() {
  const auth = useAuth();
  return useQuery({
    queryKey: queryKeys.completedPlaces,
    queryFn: async () => {
      const first = unwrap(await api.GET('/api/me/completed-places', { params: { query: { limit: 100 } } }));
      const items = [...first.items];
      const seen = new Set<string>();
      let cursor = first.nextCursor;
      while (cursor) {
        if (seen.has(cursor)) throw new Error('완료 장소를 불러오지 못했어요. 다시 시도해 주세요.');
        seen.add(cursor);
        const page = unwrap(await api.GET('/api/me/completed-places', { params: { query: { limit: 100, cursor } } }));
        items.push(...page.items);
        cursor = page.nextCursor;
      }
      return { ...first, items, nextCursor: null };
    },
    enabled: auth.status === 'signedIn',
  });
}
