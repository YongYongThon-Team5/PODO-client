import { Link, useNavigate } from 'react-router-dom';
import Gnb from '../components/Gnb';
import LoadError from '../components/LoadError';
import foxSitBig from '../assets/fox-sit-big.webp';
import {
  useActiveVisit,
  useAuth,
  useCompletedPlaces,
  useCancelVisit,
  useCompletedVisitOf,
  usePlace,
  useQuiz,
  type QuizQuestion,
} from '../api/queries';
import { formatShortDate } from '../lib/format';
import { guideLine, nextUnanswered, visitPath } from '../lib/quiz';
import { DISTRICT_LABEL } from './visit/QuizComplete';
import styles from './Mission.module.css';

type RowState = 'done' | 'current' | 'locked';

/**
 * Figma "미션": 지금 탐험 중인 장소의 퀴즈 진행상황.
 * Figma 메모 "기록 다시보기 · 중간 이탈시 들어갈 수 있는" — 퀴즈 중에 나갔다가 여기서 이어 푼다.
 */
export default function Mission() {
  const navigate = useNavigate();
  const auth = useAuth();
  const active = useActiveVisit();
  const v = active.data;
  const inQuiz = v?.status === 'QUIZ_IN_PROGRESS';
  const quiz = useQuiz(inQuiz ? v.id : undefined);
  const place = usePlace(v?.placeId);
  const completed = useCompletedPlaces();
  const lastDone = completed.data?.items[0];
  const lastVisit = useCompletedVisitOf(!v ? lastDone?.placeId : null);
  const cancel = useCancelVisit();

  const questions = quiz.data ? [...quiz.data.questions].sort((a, b) => a.position - b.position) : [];
  const total = questions.length || 3;
  const answered = quiz.data?.answeredCount ?? v?.answeredCount ?? 0;
  const next = quiz.data ? nextUnanswered(quiz.data) : undefined;
  const percent = Math.round((answered / total) * 100);
  const district = place.data?.districtCode ? DISTRICT_LABEL[place.data.districtCode] : null;

  const rowState = (q: QuizQuestion): RowState =>
    q.submittedAnswer ? 'done' : q.questionId === next?.questionId ? 'current' : 'locked';

  let heading: [string, string];
  if (auth.status === 'signedOut') heading = ['로그인하면 탐험 미션을', '여기서 볼 수 있어요'];
  else if (!v) heading = ['나들이 장소를 고르면', '오늘의 탐험 미션이 열려요'];
  else if (v.status === 'PLANNED') heading = ['방문하면 미션이 열려요', `오늘의 탐험 미션 (0/${total})`];
  else heading = ['현재 미션 기준을 알려줘요', `오늘의 탐험 미션 (${answered}/${total})`];

  const foxHint = !v
    ? '“마음에 드는 장소를 고르면 같이 탐험하자!”'
    : v.status === 'PLANNED'
      ? `“${formatShortDate(v.plannedDate)}에 만나! 도착하면 사진부터 찍자!”`
      : `“${guideLine(next, answered === 0 ? '첫' : answered === total - 1 ? '마지막' : '다음')}”`;

  return (
    <main className={`screen ${styles.screen}`}>
      <div className={styles.scroll}>
        <div className={styles.hero}>
          <h1 className={styles.heading}>
            {heading[0]}
            <br />
            {heading[1]}
          </h1>

          <section className={styles.placeCard}>
            <div className={styles.placeText}>
              <p>{v ? (inQuiz ? '현재 현장 탐험지' : `${formatShortDate(v.plannedDate)} 방문 예정`) : '현재 현장 탐험지'}</p>
              <strong>{v ? [district, v.placeName].filter(Boolean).join(' ') : '아직 없어요'}</strong>
            </div>
            <div className={styles.rate}>
              <span>달성률 {v ? percent : 0}%</span>
              <span className={styles.rateBar}>
                <span style={{ width: `${v ? percent : 0}%` }} />
              </span>
            </div>
          </section>

          <section className={styles.hint}>
            <img src={foxSitBig} width={54} height={54} alt="" />
            <div>
              <h2>여우의 현장 힌트</h2>
              <p>{foxHint}</p>
            </div>
          </section>
        </div>

        <div className={styles.progress}>
          <h2 className={styles.progressTitle}>진행상황</h2>

          {active.isError && <LoadError message={active.error.message} onRetry={() => active.refetch()} />}
          {quiz.isError && <LoadError message={quiz.error.message} onRetry={() => quiz.refetch()} />}

          {inQuiz && questions.length > 0 && (
            <ol className={styles.list}>
              {questions.map((q) => {
                const state = rowState(q);
                const body = (
                  <>
                    <span className={styles.num}>{q.position}</span>
                    <span className={styles.rowText}>{q.text}</span>
                    <span className={styles.tag}>{state === 'done' ? '완료' : state === 'current' ? '진행중' : '🔒잠김'}</span>
                  </>
                );
                return (
                  <li key={q.questionId}>
                    {state === 'locked' ? (
                      <div className={`${styles.row} ${styles.locked}`} aria-disabled>
                        {body}
                      </div>
                    ) : (
                      <Link className={`${styles.row} ${styles[state]}`} to={visitPath.question(v.id, q.position)}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {v?.status === 'PLANNED' && (
            <>
              <ol className={styles.list}>
                {[1, 2, 3].map((n) => (
                  <li key={n}>
                    <div className={`${styles.row} ${styles.locked}`} aria-disabled>
                      <span className={styles.num}>{n}</span>
                      <span className={styles.rowText}>현장에 도착하면 열려요</span>
                      <span className={styles.tag}>🔒잠김</span>
                    </div>
                  </li>
                ))}
              </ol>
              <button type="button" className={styles.cta} onClick={() => navigate(visitPath.photos(v.id))}>
                지금 방문하기
              </button>
              <button
                type="button"
                className={styles.recent}
                onClick={() => {
                  if (window.confirm(`${v.placeName} 방문 예정을 취소할까요?`)) cancel.mutate(v.id);
                }}
                disabled={cancel.isPending}
              >
                {cancel.isPending ? '취소하는 중…' : '방문 예정 취소'}
              </button>
              {cancel.isError && <p className={styles.empty}>{cancel.error.message}</p>}
            </>
          )}

          {auth.status === 'signedOut' && (
            <button type="button" className={styles.cta} onClick={() => navigate('/login')}>
              로그인하기
            </button>
          )}

          {auth.status === 'signedIn' && active.isSuccess && !v && (
            <>
              <p className={styles.empty}>진행 중인 탐험이 없어요.</p>
              <button type="button" className={styles.cta} onClick={() => navigate('/conditions')}>
                맞춤 장소 찾기
              </button>
              {lastVisit.data && (
                <Link className={styles.recent} to={visitPath.complete(lastVisit.data.id)}>
                  지난 탐험 기록 다시보기 · {lastVisit.data.placeName}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
      <Gnb />
    </main>
  );
}
