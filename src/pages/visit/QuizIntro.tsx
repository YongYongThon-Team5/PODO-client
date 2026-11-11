import { Navigate, useNavigate, useParams } from 'react-router-dom';
import FlowScreen, { flow } from '../../components/FlowScreen';
import LoadError from '../../components/LoadError';
import LoadingGate from '../../components/LoadingGate';
import foxSit from '../../assets/fox-sit.png';
import speakerIcon from '../../assets/icon-speaker.svg';
import { useAuth, usePlace, useQuiz, useRestartQuiz, useVisit } from '../../api/queries';
import { guideLine, guidePlace, nextUnanswered, preloadImages, speak, visitPath } from '../../lib/quiz';
import { toIsoDate } from '../../lib/format';
import foxHello from '../../assets/fox-hello.png';
import styles from './QuizIntro.module.css';

const DEFAULT_INTRO = '안내판을 잘 보면 다 맞힐 수 있어요';

/** Figma "에피소드 소개": 사진 추가 → 로딩(OX 퀴즈 · 이 장소 퀴즈 3문제를 불러오는 중) → 여기 */
export default function QuizIntro() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const auth = useAuth();
  const visit = useVisit(visitId);
  const quiz = useQuiz(visit.data?.status === 'PLANNED' ? undefined : visitId);
  // 다음 화면(탐험 시작)이 쓰는 오늘 날씨까지 같은 요청으로 미리 받는다
  const place = usePlace(visit.data?.placeId, toIsoDate(new Date()));
  const restart = useRestartQuiz();

  if (auth.status === 'signedOut') return <Navigate to="/login" replace />;
  if (visit.data?.status === 'PLANNED') return <Navigate to={visitPath.photos(visit.data.id)} replace />;

  const q = quiz.data;
  const questions = q ? [...q.questions].sort((a, b) => a.position - b.position) : [];
  const next = q ? nextUnanswered(q) : undefined;
  const name = visit.data?.placeName ?? '';
  const intro = q?.introduction?.trim() || DEFAULT_INTRO;
  const photo = place.data?.images[0]?.url ?? place.data?.thumbnailUrl;
  const started = (q?.answeredCount ?? 0) > 0;
  const fox = guideLine(next, started ? '다음' : '첫');

  const notReady = q?.quizAvailability === 'NOT_READY';
  const needsRestart = q?.quizAvailability === 'CORRECTION_REQUIRED';

  const go = () => {
    if (!q || !visitId) return;
    if (!next || q.visitStatus === 'COMPLETED') navigate(visitPath.complete(visitId));
    else if (!started) navigate(visitPath.arrive(visitId));
    else navigate(visitPath.question(visitId, next.position));
  };

  // 탐험 시작의 여우와 첫 문제 사진을 미리 받아 둔다
  preloadImages([foxHello, next?.referenceImageUrl]);

  const error = visit.error ?? quiz.error;

  return (
    <LoadingGate type="quiz" pending={visit.isPending || (!!visit.data && quiz.isPending)}>
      <FlowScreen
        title="에피소드 소개"
        onBack={() => navigate('/mission')}
        message={
          notReady
            ? '이 장소 퀴즈를 준비 중이에요. 조금 뒤에 다시 와 주세요.'
            : needsRestart
              ? '퀴즈 내용이 고쳐졌어요. 고쳐진 퀴즈로 이어서 풀어요.'
              : restart.error?.message
        }
        footer={
          needsRestart && q?.restartAvailable ? (
            <button
              type="button"
              className={flow.primary}
              onClick={() => visitId && restart.mutate(visitId)}
              disabled={restart.isPending}
            >
              {restart.isPending ? '잠시만요…' : '고쳐진 퀴즈로 시작'}
            </button>
          ) : (
            <button type="button" className={flow.primary} onClick={go} disabled={!q || notReady || needsRestart}>
              {!next ? '탐험 결과 보기' : started ? '이어서 풀기' : '첫 번째 문제 풀기'}
            </button>
          )
        }
      >
        <div className={styles.speakerRow}>
          <button
            type="button"
            className={styles.speaker}
            onClick={() => speak(`${name} 퀴즈. ${intro}. ${fox}`)}
            aria-label="소개 듣기"
          >
            <img src={speakerIcon} width={17} height={17} alt="" />
          </button>
        </div>

        {error ? (
          <LoadError message={error.message} onRetry={() => (visit.isError ? visit.refetch() : quiz.refetch())} />
        ) : (
          <>
            {photo ? (
              <img className={styles.photo} src={photo} alt="" />
            ) : (
              <span className={styles.photo} aria-hidden />
            )}
            <h1 className={styles.name}>{name} 퀴즈</h1>
            <p className={styles.intro}>{intro}</p>

            <ol className={styles.cards}>
              {questions.map((item) => (
                <li
                  key={item.questionId}
                  className={`${styles.card} ${item.questionId === next?.questionId ? styles.cardOn : ''}`}
                >
                  <strong>
                    문제 {item.position}
                    {item.submittedAnswer && ' ✓'}
                  </strong>
                  <span>{guidePlace(item) ?? `${item.position}번째 관찰`}</span>
                </li>
              ))}
            </ol>

            <div className={styles.foxRow}>
              <img src={foxSit} width={68} height={68} alt="" />
              <p className={styles.bubble}>{fox}</p>
            </div>
          </>
        )}
      </FlowScreen>
    </LoadingGate>
  );
}
