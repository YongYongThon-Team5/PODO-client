import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Gnb from '../../components/Gnb';
import SpeechBubble from '../../components/SpeechBubble';
import { flow } from '../../components/FlowScreen';
import foxSitBig from '../../assets/fox-sit-big.webp';
import { useAuth, useQuiz, useVisit } from '../../api/queries';
import { guideLine, nextUnanswered, visitPath } from '../../lib/quiz';
import styles from './QuizCheer.module.css';

/** Figma "미션 유지 유도": 한 문제 남았을 때 "2 문제 완료!" */
export default function QuizCheer() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const auth = useAuth();
  const visit = useVisit(visitId);
  const quiz = useQuiz(visitId);

  if (auth.status === 'signedOut') return <Navigate to="/login" replace />;
  if (!visitId) return <Navigate to="/mission" replace />;

  const q = quiz.data;
  const next = q ? nextUnanswered(q) : undefined;
  if (q && !next) return <Navigate to={visitPath.complete(visitId)} replace />;

  const questions = q ? [...q.questions].sort((a, b) => a.position - b.position) : [];
  const done = questions.filter((item) => item.submittedAnswer).length;
  const left = questions.length - done;

  return (
    <main className="screen">
      <div className={styles.scroll}>
        <SpeechBubble>{guideLine(next, left === 1 ? '마지막' : '다음')}</SpeechBubble>
        <div className={styles.fox}>
          <span className={styles.shadow} aria-hidden />
          <img src={foxSitBig} width={118} height={118} alt="" />
        </div>
        <h1 className={styles.title}>{done} 문제 완료!</h1>

        <ol className={styles.stamps}>
          {questions.map((item) => (
            <li key={item.questionId} className={item.submittedAnswer ? styles.stampDone : undefined}>
              {item.submittedAnswer ? '✓' : item.position}
            </li>
          ))}
        </ol>

        <p className={styles.lead}>
          {left === 1 ? '한 문제만 더 풀면 스탬프를 받아요' : `${left}문제 더 풀면 스탬프를 받아요`}
        </p>
        <p className={styles.sub}>{visit.data ? `${visit.data.placeName} 탐험 스탬프` : '탐험 스탬프'}</p>

        <div className={styles.fill} />
        <button
          type="button"
          className={flow.primary}
          onClick={() => next && navigate(visitPath.question(visitId, next.position), { replace: true })}
          disabled={!next}
        >
          다음 퀴즈
        </button>
      </div>
      <Gnb />
    </main>
  );
}
