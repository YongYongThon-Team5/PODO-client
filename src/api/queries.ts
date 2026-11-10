import { useSyncExternalStore } from 'react';
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
    onSuccess: (visit) => qc.setQueryData(queryKeys.activeVisits, visit),
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
