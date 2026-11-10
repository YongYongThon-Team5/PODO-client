import { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Gnb from '../components/Gnb';
import LoadError from '../components/LoadError';
import LoadingGate from '../components/LoadingGate';
import backIcon from '../assets/icon-back.svg';
import {
  useActiveVisit,
  useAuth,
  useChildProfiles,
  useCreateVisit,
  usePlace,
  type CreateVisit,
  type RecommendationItem,
} from '../api/queries';
import { ApiError } from '../api/errors';
import { toIsoDate, upcomingSaturday, withJosaWa } from '../lib/format';
import styles from './PlaceDetail.module.css';

/** 맞춤 장소 목록에서 넘어올 때 함께 받는 "맞는 조건" */
export type PlaceDetailState = { matched?: RecommendationItem['matchedConditions'] };

const SOURCES = ['RECOMMENDATION', 'POPULAR', 'MAP'] as const;

type PlaceQuery = { date?: string | null; child?: string | null; source?: CreateVisit['source'] };

/** 장소 상세 주소: /places/:id?date=YYYY-MM-DD&child=UUID&source=RECOMMENDATION */
export function toPlaceUrl(placeId: string, q: PlaceQuery = {}) {
  const params = new URLSearchParams();
  if (q.date) params.set('date', q.date);
  if (q.child) params.set('child', q.child);
  if (q.source) params.set('source', q.source);
  const s = params.toString();
  return `/places/${placeId}${s ? `?${s}` : ''}`;
}

/**
 * Figma "장소 상세"
 * 흐름 메모(11.10): 지도 탐색 = 방문 예정 → 지도 탐색 화면 / 지금 방문 = 방문 확정 → 사진 추가 화면
 */
export default function PlaceDetail() {
  const navigate = useNavigate();
  const { placeId } = useParams();
  const [params] = useSearchParams();
  const state = (useLocation().state ?? {}) as PlaceDetailState;
  const auth = useAuth();
  const profiles = useChildProfiles();
  const activeVisit = useActiveVisit();
  const createVisit = useCreateVisit();
  // 재시도해도 방문이 두 번 생기지 않도록 화면마다 키 하나
  const idempotencyKey = useRef(crypto.randomUUID());
  const [message, setMessage] = useState<string | null>(null);

  const date = params.get('date');
  const childId = params.get('child');
  const source = SOURCES.find((s) => s === params.get('source')) ?? 'MAP';
  const place = usePlace(placeId, date ?? undefined);

  const child = profiles.data?.find((p) => p.id === childId) ?? profiles.data?.[0];
  const matched = state.matched ?? [];

  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/home'));

  /** 방문 등록 (계정당 활성 방문은 1건). 이미 이 장소가 잡혀 있으면 새로 만들지 않는다 */
  const registerVisit = (plannedDate: string, onDone: () => void) => {
    if (!placeId) return;
    if (activeVisit.data?.placeId === placeId) {
      onDone();
      return;
    }
    if (activeVisit.data) {
      setMessage(`이미 ${activeVisit.data.placeName} 방문이 예정돼 있어요.`);
      return;
    }
    setMessage(null);
    createVisit.mutate(
      {
        key: idempotencyKey.current,
        body: {
          placeId,
          plannedDate,
          childProfileId: child && child.id === childId ? child.id : null,
          source,
        },
      },
      {
        onSuccess: onDone,
        onError: (e) => {
          if (e instanceof ApiError && e.status === 401) navigate('/login');
          else if (e instanceof ApiError && e.status === 409)
            setMessage('지금은 방문 예정으로 등록할 수 없어요. 이미 예정된 방문이 있는지 확인해 주세요.');
          else setMessage(e.message);
        },
      },
    );
  };

  /** 지도 탐색 = 방문 예정. 로그인 전이거나 다른 방문이 잡혀 있으면 등록 없이 지도만 연다 */
  const exploreMap = () => {
    if (auth.status !== 'signedIn' || (activeVisit.data && activeVisit.data.placeId !== placeId)) {
      navigate('/map');
      return;
    }
    registerVisit(date ?? upcomingSaturday(), () => navigate('/map'));
  };

  /** 지금 방문 = 방문 확정 (오늘). TODO: 사진 추가 화면이 생기면 그쪽으로 이동 */
  const visitNow = () => {
    if (auth.status !== 'signedIn') {
      navigate('/login');
      return;
    }
    registerVisit(toIsoDate(new Date()), () => navigate('/home'));
  };

  const p = place.data;
  const photo = p?.images[0]?.url ?? p?.thumbnailUrl;
  const infoLines = p
    ? [
        p.openingHours && `운영 ${p.openingHours}`,
        p.feeInfo && `요금 ${p.feeInfo}`,
        p.amenities?.length ? p.amenities.join(' · ') : null,
      ].filter((line): line is string => !!line)
    : [];

  // 맞춤 목록에서 오면 서버가 준 "맞는 조건", 다른 곳에서 오면 주요 활동
  const tags = matched.length > 0 ? matched.map((m) => m.label) : (p?.mainActivities ?? []);
  const tagTitle =
    matched.length > 0 ? `${child ? withJosaWa(child.nickname) : '우리 아이와'} 맞는 조건` : '이런 활동을 해요';

  // Figma 흐름: 맞춤 장소 목록 → 로딩("장소 상세 · 오늘 운영 정보를 확인하는 중") → 장소 상세
  return (
    <LoadingGate type="place" pending={place.isPending}>
      <main className="screen">
        <div className={styles.scroll}>
          <div className={styles.photoWrap}>
            {photo ? <img className={styles.photo} src={photo} alt="" /> : <span className={styles.photo} aria-hidden />}
            <button type="button" className={styles.back} onClick={goBack} aria-label="뒤로 가기">
              <img src={backIcon} width={9} height={18} alt="" />
            </button>
          </div>

          {place.isPending && <div className={styles.skeleton} aria-busy />}

          {place.isError && (
            <div className={styles.error}>
              <LoadError
                message={
                  place.error instanceof ApiError && place.error.status === 404
                    ? '공개되지 않았거나 없는 장소예요.'
                    : place.error.message
                }
                onRetry={() => place.refetch()}
              />
            </div>
          )}

          {p && (
            <>
              <h1 className={styles.name}>{p.name}</h1>
              <p className={styles.address}>{p.address.replace(/^경기도\s*/, '')}</p>

              {tags.length > 0 && (
                <section className={styles.match}>
                  <h2 className={styles.boxTitle}>{tagTitle}</h2>
                  <ul className={styles.tags}>
                    {tags.map((t) => (
                      <li key={t} className={styles.tag}>
                        {t}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className={styles.info}>
                <h2 className={styles.infoTitle}>운영 정보</h2>
                {(infoLines.length > 0 ? infoLines : ['운영 정보를 준비 중이에요']).map((line) => (
                  <p key={line} className={styles.infoLine}>
                    {line}
                  </p>
                ))}
              </section>
            </>
          )}

          <div className={styles.fill} />

          {message && (
            <p className={styles.message} role="alert">
              {message}
            </p>
          )}

          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={exploreMap} disabled={createVisit.isPending}>
              지도 탐색
            </button>
            <button type="button" className={styles.primary} onClick={visitNow} disabled={!p || createVisit.isPending}>
              {createVisit.isPending ? '잠시만요…' : '지금 방문'}
            </button>
          </div>
        </div>
        <Gnb />
      </main>
    </LoadingGate>
  );
}
