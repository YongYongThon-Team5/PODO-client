import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import FlowScreen, { flow } from '../../components/FlowScreen';
import LoadError from '../../components/LoadError';
import foxHello from '../../assets/fox-hello.png';
import { useAuth, usePlace, useQuiz, useVisit } from '../../api/queries';
import { formatShortDate, toIsoDate } from '../../lib/format';
import { arrivalMessage, useArrivalCheck } from '../../lib/geo';
import { nextUnanswered, visitPath } from '../../lib/quiz';
import styles from './ExploreStart.module.css';

const WEATHER: Record<string, string> = { CLEAR: '맑음', CLOUDY: '흐림', RAIN: '비' };
/** OX 한 문제에 걸리는 시간 (Figma "3문제 · 약 15분") */
const MINUTES_PER_QUESTION = 5;

/** Figma "탐험 시작" (도착 확인 + 오늘 안내) */
export default function ExploreStart() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const auth = useAuth();
  const visit = useVisit(visitId);
  const quiz = useQuiz(visitId);
  const today = toIsoDate(new Date());
  const place = usePlace(visit.data?.placeId, today);
  const [retry, setRetry] = useState(0);
  const arrival = useArrivalCheck(place.data, retry);

  if (auth.status === 'signedOut') return <Navigate to="/login" replace />;
  if (visit.data?.status === 'PLANNED') return <Navigate to={visitPath.photos(visit.data.id)} replace />;

  const p = place.data;
  const count = quiz.data?.questions.length ?? 3;
  const next = quiz.data ? nextUnanswered(quiz.data) : undefined;

  const condition = p?.weather?.condition;
  const weatherText = condition && WEATHER[condition];
  const indoor = p?.environment === 'INDOOR';
  const dayLine = [
    `오늘 ${formatShortDate(today)}${weatherText ? ` ${weatherText}` : ''}`,
    indoor ? '실내 진행' : condition === 'RAIN' ? '실내 위주로 둘러봐요' : weatherText ? '야외 진행 가능' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const lines = [
    dayLine,
    `준비물 물, 편한 신발${condition === 'RAIN' ? ', 우산' : ''}`,
    '보호자와 함께 · 출입 금지 구역엔 문제 없음',
    ...(p?.cautions?.length ? [`주의 ${p.cautions.join(', ')}`] : []),
    `OX 퀴즈 ${count}문제 · 약 ${count * MINUTES_PER_QUESTION}분`,
  ];

  const start = () => {
    if (!visitId) return;
    navigate(next ? visitPath.question(visitId, next.position) : visitPath.complete(visitId));
  };

  return (
    <FlowScreen
      title={visit.data ? `${visit.data.placeName} 도착` : '탐험 시작'}
      footer={
        <button type="button" className={flow.primary} onClick={start} disabled={!quiz.data}>
          퀴즈 시작
        </button>
      }
    >
      {visit.isError ? (
        <div className={styles.error}>
          <LoadError message={visit.error.message} onRetry={() => visit.refetch()} />
        </div>
      ) : (
        <>
          <div className={styles.greet}>
            <img src={foxHello} width={66} height={66} alt="" />
            <p className={styles.bubble}>
              도착했구나!
              <br />
              안내판 보면서 퀴즈 풀어 볼까?
            </p>
          </div>

          <section className={styles.arrival}>
            <h2>방문했어요 확인</h2>
            <p>{arrivalMessage(arrival)}</p>
            {arrival.status !== 'near' && arrival.status !== 'checking' && (
              <button type="button" className={styles.recheck} onClick={() => setRetry((n) => n + 1)}>
                다시 확인
              </button>
            )}
          </section>

          <ul className={styles.info}>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
    </FlowScreen>
  );
}
