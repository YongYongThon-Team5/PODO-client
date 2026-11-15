import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import FlowScreen, { flow } from '../../components/FlowScreen';
import LoadError from '../../components/LoadError';
import YonginMap from '../../components/YonginMap';
import {
  useAllPlaces,
  useAuth,
  useCompletedPlaces,
  usePlace,
  usePopularPlaces,
  useQuiz,
  useVisit,
  type PlaceSummary,
} from '../../api/queries';
import { ENVIRONMENT_LABEL, formatShortDate, toIsoDate } from '../../lib/format';
import { resumePath } from '../../lib/quiz';
import { toPlaceUrl } from '../PlaceDetail';
import type { MapPageState } from '../MapPage';
import styles from './QuizComplete.module.css';

export const DISTRICT_LABEL: Record<string, string> = { CHEOIN: '처인구', GIHEUNG: '기흥구', SUJI: '수지구' };

/** Figma "탐험 완료": 지도 → OX 결과 · 지금까지 → 다음에 가볼 곳 → 탐방 지도 보기 / 다음 나들이 찾기 */
export default function QuizComplete() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const auth = useAuth();
  const visit = useVisit(visitId);
  // 방문 정보를 기다리지 않고 같이 받는다 (문제 수 표시용)
  const quiz = useQuiz(visitId);
  const place = usePlace(visit.data?.placeId);
  const completed = useCompletedPlaces();
  const popular = usePopularPlaces();
  const allPlaces = useAllPlaces();

  if (auth.status === 'signedOut') return <Navigate to="/login" replace />;
  const v = visit.data;
  // 캐시가 옛 상태일 수 있으니 새로 받은 뒤에만 다른 화면으로 보낸다
  if (v && v.status !== 'COMPLETED' && !visit.isFetching) return <Navigate to={resumePath(v)} replace />;

  const total = quiz.data?.questions.length ?? 3;
  const doneAt = v?.completedAt ? formatShortDate(toIsoDate(new Date(v.completedAt))) : '';
  const summary = completed.data?.summary;
  const districts = (summary?.districts ?? [])
    .filter((d) => d.completedPlaceCount > 0)
    .map((d) => `${(d.districtCode && DISTRICT_LABEL[d.districtCode]) ?? '기타'} ${d.completedPlaceCount}`)
    .join(' · ');

  // 다음에 가볼 곳: 인기 탐험지 중 아직 안 간 곳, 없으면 같은 구의 안 간 곳
  const doneIds = new Set(completed.data?.items.map((c) => c.placeId));
  if (v) doneIds.add(v.placeId);
  const candidates: PlaceSummary[] = [
    ...(popular.data?.items.map((i) => i.place) ?? []),
    ...(allPlaces.data ?? []).filter((p) => p.districtCode === place.data?.districtCode),
    ...(allPlaces.data ?? []),
  ];
  const nextPlace = candidates.find((p) => !doneIds.has(p.id));
  const fromPopular = !!nextPlace && !!popular.data?.items.some((i) => i.place.id === nextPlace.id);

  const p = place.data;

  return (
    <FlowScreen
      title="탐험 완료 !"
      onBack={() => navigate('/home')}
      footer={
        <div className={flow.row}>
          <button
            type="button"
            className={flow.secondary}
            onClick={() =>
              navigate(`/map${v ? `?place=${v.placeId}` : ''}`, { state: { loading: 'mission' } satisfies MapPageState })
            }
          >
            탐방 지도 보기
          </button>
          <button type="button" className={flow.primary} onClick={() => navigate('/conditions')}>
            다음 나들이 찾기
          </button>
        </div>
      }
    >
      {visit.isError ? (
        <div className={styles.error}>
          <LoadError message={visit.error.message} onRetry={() => visit.refetch()} />
        </div>
      ) : (
        <>
          <p className={styles.when}>{v ? `${v.placeName}${doneAt ? ` · ${doneAt}` : ''}` : ' '}</p>

          {p ? (
            <YonginMap
              className={styles.map}
              markers={[{ id: p.id, name: p.name, latitude: p.latitude, longitude: p.longitude, kind: 'done' }]}
              focusId={p.id}
              initialZoom={1.6}
            />
          ) : (
            <div className={styles.map} aria-hidden />
          )}

          <div className={styles.stats}>
            <section className={`${styles.stat} ${styles.statQuiz}`}>
              <h2>OX 퀴즈</h2>
              <strong>
                {total}문제 중 {v?.correctCount ?? 0}개 정답
              </strong>
              <span>{v?.hintUsageCount ? `힌트 ${v.hintUsageCount}번 사용` : '힌트 없이 풀었어요'}</span>
            </section>
            <section className={styles.stat}>
              <h2>지금까지</h2>
              <strong>{summary ? `${summary.completedPlaceCount}곳 탐험` : '…'}</strong>
              <span>{districts || ' '}</span>
            </section>
          </div>

          {nextPlace && (
            <>
              <h2 className={styles.nextTitle}>다음에 가볼 곳</h2>
              <Link
                className={styles.next}
                to={toPlaceUrl(nextPlace.id, { source: fromPopular ? 'POPULAR' : 'MAP' })}
              >
                {nextPlace.thumbnailUrl ? (
                  <img className={styles.nextThumb} src={nextPlace.thumbnailUrl} alt="" />
                ) : (
                  <span className={styles.nextThumb} aria-hidden />
                )}
                <span className={styles.nextInfo}>
                  <strong>{nextPlace.name}</strong>
                  <span className={styles.nextMeta}>
                    {[
                      nextPlace.districtCode && DISTRICT_LABEL[nextPlace.districtCode],
                      nextPlace.mainActivities[0],
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className={styles.nextTags}>
                    {[ENVIRONMENT_LABEL[nextPlace.environment], nextPlace.mainActivities[1]]
                      .filter(Boolean)
                      .map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                  </span>
                </span>
              </Link>
            </>
          )}
        </>
      )}
    </FlowScreen>
  );
}
